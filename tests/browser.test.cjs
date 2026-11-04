const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');
let server, browser;
const url = 'http://127.0.0.1:8766';
const stl = Buffer.from('solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle');
const xml = name => `<robot name="${name}"><link name="base"><visual><origin xyz="0 0 0.2" rpy="0 0 0.5"/><geometry><mesh filename="package://demo/meshes/part.stl" scale="0.1 0.2 0.3"/></geometry><material name="red"><color rgba="1 0 0 1"/></material></visual></link><link name="tip"><visual><geometry><box size="0.1 0.1 0.1"/></geometry></visual></link><joint name="hinge" type="revolute"><parent link="base"/><child link="tip"/><axis xyz="0 0 1"/><limit lower="-1" upper="1"/></joint></robot>`;
const upload = (name, buffer) => ({name, mimeType:'application/octet-stream', buffer});
async function settled(page) {
  await page.evaluate(() => App.localRobots.pendingSave);
}
before(async () => {
  server = spawn('python3', ['-c', require('node:fs').readFileSync('tests/serve.py','utf8').replace('8765','8766')], {stdio:'ignore'});
  for (let i=0;i<50;i++) { try { await fetch(url); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
  browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
});
after(async () => { await browser?.close(); server?.kill(); });
test('STL import, transforms, joints, trajectory, persistence, multiple robots, deletion and validation', async () => {
  const context=await browser.newContext();
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(()=>window.robotlinkcollection?.length>0);
  await settled(page);
  assert.equal(await page.evaluate(()=>THREE.REVISION),'187');
  await page.locator('#local-files').setInputFiles([upload('part.stl',stl),upload('mesh.urdf',Buffer.from(xml('Mesh robot')))]);
  await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('Mesh robot'));
  await settled(page);
  assert.deepEqual(await page.evaluate(()=>{
    const mesh=robotlinkcollection.get('base').meshvis_array[0];
    return {count:mesh.geometry.attributes.position.count,scale:mesh.scale.toArray(),position:mesh.position.toArray(),red:mesh.material.color.r};
  }),{count:3,scale:[0.1,0.2,0.3],position:[0,0,0.2],red:1});
  await page.evaluate(()=>{
    robotjointcollection.findWhere({name:'hinge'}).movejoint(0.7);
    scene.updateMatrixWorld(true);
    App.trajectoryview.robot_trajectory.new_name('tip');
    App.trajectoryview.robot_trajectory.add_to_trajectory();
  });
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'hinge'}).theta),0.7);
  assert.equal(await page.evaluate(()=>App.trajectoryview.robot_trajectory.allpoints.drawRange.count),1);
  const savedId=await page.locator('#local-library').inputValue();
  await page.reload();
  await page.waitForFunction(()=>window.robotlinkcollection?.length>0);
  await settled(page);
  await page.locator('#local-library').selectOption(savedId);
  await page.locator('#local-open').click();
  await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('Mesh robot'));
  await settled(page);
  assert.equal(await page.evaluate(()=>robotlinkcollection.get('base').meshvis_array[0].geometry.attributes.position.count),3);
  // Load another URDF without assets, then attach binary STL separately.
  await page.evaluate(()=>App.localRobots.clearAssets());
  await page.locator('#local-files').setInputFiles(upload('other.urdf',Buffer.from(xml('Other robot'))));
  await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('Other robot'));
  await settled(page);
  assert.match(await page.locator('#local-status').innerText(),/Missing or ambiguous STL/);
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
  assert.deepEqual(errors,[]);
  await context.close();
});
