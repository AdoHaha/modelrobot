const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');
let server, browser;
const url = process.env.MODELROBOT_TEST_URL || 'http://127.0.0.1:8766';
const stl = Buffer.from('solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle');
const xml = name => `<robot name="${name}"><link name="base"><visual><origin xyz="0 0 0.2" rpy="0.2 0.3 0.5"/><geometry><mesh filename="package://demo/meshes/part.stl" scale="0.1 0.2 0.3"/></geometry><material name="red"><color rgba="1 0 0 1"/></material></visual></link><link name="tip"><visual><geometry><box size="0.1 0.1 0.1"/></geometry></visual></link><joint name="hinge" type="revolute"><parent link="base"/><child link="tip"/><axis xyz="0 0 1"/><limit lower="-1" upper="1"/></joint></robot>`;
const upload = (name, buffer) => ({name, mimeType:'application/octet-stream', buffer});
async function settled(page) {
  await page.evaluate(() => App.localRobots.pendingSave);
}
before(async () => {
  if (!process.env.MODELROBOT_TEST_URL) server = spawn('python3', ['-c', require('node:fs').readFileSync('tests/serve.py','utf8').replace('8765','8766')], {stdio:'ignore'});
  for (let i=0;i<50;i++) { try { await fetch(url); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
  browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
});
after(async () => { await browser?.close(); server?.kill(); });
test('STL import, transforms, joints, trajectory, persistence, multiple robots, deletion and validation', async () => {
  const context=await browser.newContext();
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const requests=[]; page.on('request', request=>requests.push(request.url()));
  await page.goto(url);
  await page.waitForFunction(()=>window.robotlinkcollection?.length>0);
  await settled(page);
  assert.equal(await page.evaluate(()=>THREE.REVISION),'187');
  assert.equal(await page.evaluate(()=>robot.name),'robot');
  assert.ok(await page.evaluate(()=>App.currentrobot.get('urdf').includes('name="pi_robot"')),'Pi robot loads automatically');
  assert.ok(!requests.some(url=>new URL(url).pathname.startsWith('/robots/')),'Standalone startup does not call the backend');
  await page.locator('#local-files').setInputFiles([upload('part.stl',stl),upload('mesh.urdf',Buffer.from(xml('Mesh robot')))]);
  await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('Mesh robot'));
  await settled(page);
  assert.deepEqual(await page.evaluate(()=>{
    const mesh=robotlinkcollection.get('base').meshvis_array[0];
    return {count:mesh.geometry.attributes.position.count,scale:mesh.scale.toArray(),position:mesh.position.toArray(),red:mesh.material.color.r};
  }),{count:3,scale:[0.1,0.2,0.3],position:[0,0,0.2],red:1});
  assert.ok(await page.evaluate(()=>{
    const expected=new THREE.Matrix4().makeRotationZ(0.5).multiply(new THREE.Matrix4().makeRotationY(0.3)).multiply(new THREE.Matrix4().makeRotationX(0.2));
    const actual=new THREE.Matrix4().makeRotationFromEuler(robotlinkcollection.get('base').meshvis_array[0].rotation);
    return expected.elements.every((value,i)=>Math.abs(value-actual.elements[i])<1e-10);
  }),'Visual RPY uses URDF rotation order');
  await page.evaluate(()=>{
    robotjointcollection.findWhere({name:'hinge'}).movejoint(0.7);
    scene.updateMatrixWorld(true);
    App.trajectoryview.robot_trajectory.new_name('tip');
    App.trajectoryview.robot_trajectory.add_to_trajectory();
  });
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'hinge'}).theta),0.7);
  assert.equal(await page.evaluate(()=>App.trajectoryview.robot_trajectory.allpoints.drawRange.count),1);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.CodeMirror')).backgroundColor),'rgb(255, 255, 255)');
  for (const [view,direction] of Object.entries({front:[1,0,0],back:[-1,0,0],left:[0,1,0],right:[0,-1,0],top:[0,0,1],bottom:[0,0,-1]})) {
    await page.locator('#view-cube .view-cube-presets [data-view='+view+']').click();
    const actual=await page.evaluate(()=>App.camera.position.clone().sub(App.cameraControls.target).normalize().toArray());
    actual.forEach((value,i)=>assert.ok(Math.abs(value-direction[i])<0.001,view+' camera direction'));
  }
  await page.locator('#view-cube .view-cube-heading [data-view=iso]').click();
  const csv='time,hinge\n0,0\n1,0.5\n';
  await page.locator('#robotcsv').fill(csv);
  await page.waitForFunction(csv=>App.localRobots.records.some(r=>r.name==='Mesh robot' && r.csv===csv),csv);
  await page.locator('#loadcsv').click();
  await settled(page);
  const savedId=await page.locator('#local-library').inputValue();
  await page.reload();
  await page.waitForFunction(()=>window.robotlinkcollection?.length>0);
  await settled(page);
  await page.locator('#local-library').selectOption(savedId);
  await page.locator('#local-open').click();
  await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('Mesh robot'));
  await settled(page);
  assert.equal(await page.evaluate(()=>robotlinkcollection.get('base').meshvis_array[0].geometry.attributes.position.count),3);
  assert.equal((await page.locator('#robotcsv').inputValue()).trim(),csv.trim());
  assert.deepEqual(await page.evaluate(()=>App.animform.names),['hinge']);
  await page.evaluate(()=>App.animform.settostaticframe(1));
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'hinge'}).theta),0.5);
  // Load another URDF without assets, then attach binary STL separately.
  await page.evaluate(()=>App.localRobots.clearAssets());
  await page.locator('#local-files').setInputFiles(upload('other.urdf',Buffer.from(xml('Other robot'))));
  await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('Other robot'));
  await settled(page);
  assert.match(await page.locator('#local-status').innerText(),/Missing or ambiguous STL/);
  assert.equal(await page.locator('#robotcsv').inputValue(),'');
  const binary=Buffer.alloc(134); binary.write('solid binary header'); binary.writeUInt32LE(1,80);
  [0,0,1,0,0,0,1,0,0,0,1,0].forEach((n,i)=>binary.writeFloatLE(n,84+i*4));
  await page.locator('#local-files').setInputFiles(upload('part.stl',binary));
  await page.waitForFunction(()=>robotlinkcollection.get('base').meshvis_array[0].isMesh);
  await settled(page);
  assert.match(await page.locator('#local-status').innerText(),/Saved/);
  const records=await page.evaluate(()=>App.localRobots.records.map(r=>({...r,assets:r.assets.map(a=>({...a,bytes:{byteLength:a.bytes.byteLength}}))})));
  assert.ok(records.some(r=>r.name==='Mesh robot'));
  assert.ok(records.some(r=>r.name==='Other robot'));
  assert.equal(records.find(r=>r.name==='Other robot').assets[0].bytes.byteLength,134);
  await page.locator('#local-files').setInputFiles(upload('broken.stl',Buffer.from('broken')));
  await page.waitForFunction(()=>document.getElementById('local-status').classList.contains('text-danger'));
  assert.match(await page.locator('#local-status').innerText(),/broken.stl/);
  await page.locator('#local-delete').click();
  await page.waitForFunction(()=>!App.localRobots.records.some(r=>r.name==='Other robot'));
  // The canvas follows its pane through desktop, mobile and orientation changes.
  for (const [width,height] of [[1440,900],[1024,768],[390,844],[844,390],[320,568]]) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{
      const host=document.getElementById('container');
      const canvas=renderer.domElement;
      return Math.abs(canvas.clientWidth-host.clientWidth)<2 && Math.abs(canvas.clientHeight-host.clientHeight)<2 && Math.abs(App.camera.aspect-host.clientWidth/host.clientHeight)<0.01;
    });
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No horizontal overflow');
    assert.equal(await page.locator('#container canvas').count(),1);
    if (width<760) {
      assert.ok(await page.evaluate(()=>App.gui.closed));
      assert.ok(await page.locator('#joint-controls .close-button').isVisible());
    }
  }
  assert.deepEqual(errors,[]);
  await context.close();
});
