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
  const panel = name => page.locator('#tab-'+name).click();
  const requests=[]; page.on('request', request=>requests.push(request.url()));
  await page.goto(url);
  await page.waitForFunction(()=>window.robotlinkcollection?.length>0);
  await settled(page);
  assert.equal(await page.evaluate(()=>THREE.REVISION),'187');
  assert.equal(await page.evaluate(()=>robot.name),'robot');
  assert.ok(await page.evaluate(()=>App.currentrobot.get('urdf').includes('name="pi_robot"')),'Pi robot loads automatically');
  assert.ok(!requests.some(url=>new URL(url).pathname.startsWith('/robots/')),'Standalone startup does not call the backend');
  await panel('files');
  await page.locator('#local-name').fill('Teaching Pi');
  await page.locator('#local-save').click(); await settled(page);
  const defaultCsv='time,torso_joint\n0,0\n1,0.1\n';
  await panel('animation');
  await page.locator('#robotcsv').fill(defaultCsv);
  await page.locator('#loadcsv').click();
  await settled(page);
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
    await page.locator('#standard-view').selectOption(view);
    const actual=await page.evaluate(()=>App.camera.position.clone().sub(App.cameraControls.target).normalize().toArray());
    actual.forEach((value,i)=>assert.ok(Math.abs(value-direction[i])<0.001,view+' camera direction'));
  }
  await page.locator('#standard-view').selectOption('iso');
  const csv='time,hinge\n0,0\n1,0.5\n';
  await panel('animation');
  await page.locator('#robotcsv').fill(csv);
  await page.waitForFunction(csv=>App.localRobots.records.some(r=>r.name==='Mesh robot' && r.csv===csv),csv);
  await page.locator('#loadcsv').click();
  await settled(page);
  const savedId=await page.locator('#local-library').inputValue();
  await page.reload();
  await page.waitForFunction(()=>window.robotlinkcollection?.length>0);
  await settled(page);
  await page.waitForFunction(csv=>document.getElementById('robotcsv').value.trim()===csv.trim(),defaultCsv);
  assert.equal(await page.locator('#local-name').inputValue(),'Teaching Pi');
  await panel('files');
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
  await panel('files');
  await page.locator('#local-delete').click();
  await page.waitForFunction(()=>!App.localRobots.records.some(r=>r.name==='Other robot'));
  // The canvas follows its pane through desktop, mobile and orientation changes.
  for (const [width,height] of [[1440,900],[1024,768],[390,844],[844,390],[667,375],[320,568]]) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{
      const host=document.getElementById('container');
      const canvas=renderer.domElement;
      return Math.abs(canvas.clientWidth-host.clientWidth)<2 && Math.abs(canvas.clientHeight-host.clientHeight)<2 && Math.abs(App.camera.aspect-host.clientWidth/host.clientHeight)<0.01;
    });
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No horizontal overflow');
    assert.equal(await page.locator('#container canvas').count(),1);
    await panel('urdf');
    assert.ok(await page.locator('#loadbutton').isVisible());
    assert.ok(await page.locator('#local-status').isVisible());
  }
  assert.deepEqual(errors,[]);
  await context.close();
});

test('meter-scale robots fit the camera after file load and reopening', async () => {
  const context=await browser.newContext({viewport:{width:900,height:700}});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const source='<robot name="Meter arm"><link name="base"><visual><geometry><box size="2 1 1"/></geometry></visual></link><link name="tip"><visual><geometry><box size="0.5 0.5 1"/></geometry></visual></link><joint name="arm" type="fixed"><parent link="base"/><child link="tip"/><origin xyz="0 0 4"/></joint></robot>';
  const visible=()=>page.evaluate(()=>{
    const bounds=new THREE.Box3().setFromObject(robot), camera=App.camera;
    camera.updateMatrixWorld();
    const points=[];
    for(const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z]) points.push(new THREE.Vector3(x,y,z).project(camera));
    return points.every(point=>Math.abs(point.x)<.85&&Math.abs(point.y)<.85&&point.z>-1&&point.z<1);
  });
  await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);
  await page.locator('#local-files').setInputFiles(upload('meter-arm.urdf',Buffer.from(source)));
  await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('Meter arm'));
  await settled(page);
  assert.ok(await visible(),'Imported meter-scale robot fits the viewport');
  const savedId=await page.locator('#local-library').inputValue();
  await page.evaluate(()=>{App.camera.position.copy(App.cameraControls.target).addScaledVector(App.camera.position.clone().sub(App.cameraControls.target),.1);App.cameraControls.update();});
  assert.ok(!(await visible()),'The test first zooms close enough to clip the robot');
  await page.locator('#tab-files').click();await page.locator('#local-library').selectOption(savedId);await page.locator('#local-open').click();
  await page.waitForFunction(()=>App.camera.position.distanceTo(App.cameraControls.target)>5);
  assert.ok(await visible(),'Reopening a saved robot restores its framing');
  await page.reload();await page.waitForFunction(()=>window.robotlinkcollection?.length);await settled(page);
  await page.locator('#tab-files').click();await page.locator('#local-library').selectOption(savedId);await page.locator('#local-open').click();
  await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('Meter arm'));
  assert.ok(await visible(),'Opening the saved robot after page reload fits it');
  await context.close();
});

test('editing session, workspace tabs, keyboard Apply, save copy and camera gestures', async () => {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);await settled(page);
  await page.locator('#help-button').click();
  assert.ok(await page.locator('#help-dialog').isVisible());
  assert.match(await page.locator('#help-dialog').innerText(),/Shift-drag/);
  await page.keyboard.press('Escape');
  assert.ok(!(await page.locator('#help-dialog').isVisible()));
  assert.equal(await page.evaluate(()=>document.activeElement.id),'help-button');
  const original=await page.evaluate(()=>App.localRobots.currentXml);
  const id=await page.evaluate(()=>App.localRobots.document.id);
  const count=await page.evaluate(()=>App.localRobots.records.length);
  await page.locator('#tab-animation').click();
  const csv='time,torso_joint\n0,0\n1,0.4\n';
  await page.locator('#robotcsv').fill(csv);await page.locator('#loadcsv').click();await settled(page);
  const before=await page.evaluate(()=>{
    robotjointcollection.findWhere({name:'torso_joint'}).movejoint(.3);
    App.camera.position.add(new THREE.Vector3(.2,.1,.3));App.cameraControls.update();
    return {camera:App.camera.position.toArray(),target:App.cameraControls.target.toArray()};
  });
  await page.locator('#tab-urdf').click();
  const editing=await page.evaluate(()=>{
    const cm=App.forumula.myCodeMirror;
    cm.setValue(cm.getValue().replace('0.32 0.26 0.085','0.34 0.26 0.085'));
    cm.setCursor({line:35,ch:4});cm.scrollTo(0,480);cm.focus();
    return {cursor:cm.getCursor(),scroll:cm.getScrollInfo().top};
  });
  assert.match(await page.locator('#draft-status').innerText(),/Unapplied/);
  await page.keyboard.press('Control+Enter');await settled(page);
  assert.equal(await page.evaluate(()=>App.localRobots.document.id),id);
  assert.equal(await page.evaluate(()=>App.localRobots.records.length),count);
  assert.equal(await page.locator('#robotcsv').inputValue(),csv);
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'torso_joint'}).theta),.3);
  const after=await page.evaluate(()=>({camera:App.camera.position.toArray(),target:App.cameraControls.target.toArray(),cursor:App.forumula.myCodeMirror.getCursor(),scroll:App.forumula.myCodeMirror.getScrollInfo().top}));
  before.camera.forEach((n,i)=>assert.ok(Math.abs(n-after.camera[i])<1e-8));
  assert.deepEqual(after.target,before.target);assert.deepEqual(after.cursor,editing.cursor);assert.ok(Math.abs(after.scroll-editing.scroll)<3);
  const changedXml=await page.evaluate(()=>App.localRobots.currentXml);
  await page.evaluate(()=>{App.forumula.myCodeMirror.setValue('<robot');App.forumula.myCodeMirror.focus();});
  await page.keyboard.press('Control+Enter');
  assert.match(await page.locator('#local-status').innerText(),/valid URDF/);
  assert.ok(await page.locator('#local-status').isVisible());
  assert.equal(await page.evaluate(()=>App.localRobots.currentXml),changedXml);
  await page.evaluate(xml=>App.forumula.myCodeMirror.setValue(xml),changedXml);
  await page.locator('#tab-files').click();await page.locator('#local-copy').click();
  await page.waitForFunction(count=>App.localRobots.records.length===count+1,count);
  assert.notEqual(await page.evaluate(()=>App.localRobots.document.id),id);
  assert.ok(await page.evaluate(id=>App.localRobots.records.some(r=>r.id===id),id));
  await page.locator('#tab-urdf').click();
  const divider=page.locator('#workspace-divider');const oldWidth=await page.locator('#controldiv').evaluate(el=>el.clientWidth);
  await divider.focus();await page.keyboard.press('ArrowRight');
  assert.ok(await page.locator('#controldiv').evaluate(el=>el.clientWidth)>oldWidth);
  const canvas=page.locator('#container canvas');const box=await canvas.boundingBox();
  const start={x:box.x+box.width*.5,y:box.y+box.height*.5};
  const initial=await page.evaluate(()=>({p:App.camera.position.toArray(),t:App.cameraControls.target.toArray()}));
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+65,start.y+30,{steps:8});await page.mouse.up();
  assert.ok(await page.evaluate(p=>App.camera.position.distanceTo(new THREE.Vector3(...p))>.01,initial.p));
  assert.deepEqual(await page.evaluate(()=>App.camera.up.toArray()),[0,0,1]);
  assert.deepEqual(await page.evaluate(()=>App.cameraControls.target.toArray()),initial.t);
  const target=await page.evaluate(()=>App.cameraControls.target.toArray());
  await page.mouse.move(start.x,start.y);await page.mouse.down({button:'right'});await page.mouse.move(start.x+50,start.y,{steps:8});await page.mouse.up({button:'right'});
  assert.ok(await page.evaluate(t=>App.cameraControls.target.distanceTo(new THREE.Vector3(...t))>.001,target));
  const distance=await page.evaluate(()=>App.camera.position.distanceTo(App.cameraControls.target));
  await page.mouse.wheel(0,-200);await page.waitForTimeout(150);
  assert.ok(await page.evaluate(()=>App.camera.position.distanceTo(App.cameraControls.target))<distance);
  await canvas.focus();await page.keyboard.press('f');
  assert.ok(await page.evaluate(()=>App.cameraControls.target.distanceTo(new THREE.Box3().setFromObject(robot).getCenter(new THREE.Vector3()))<1e-8));
  for(const [width,height] of [[390,844],[320,568],[667,375],[844,390]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>Math.abs(renderer.domElement.clientWidth-document.getElementById('container').clientWidth)<2);
    assert.ok(await page.locator('#loadbutton').isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
    assert.ok(await page.locator('.CodeMirror').evaluate(el=>el.clientHeight)>70);
  }
  assert.deepEqual(errors,[]);await context.close();
});

test('detached joints stay live alongside editing and animation, and can be moved, resized and docked', async () => {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);await settled(page);
  await page.locator('#tab-joints').click();await page.locator('#joints-detach').click();
  const floating=page.locator('#floating-joints');
  assert.ok(await floating.isVisible());assert.ok(await page.locator('#panel-urdf').isVisible());
  assert.equal(await page.locator('#joint-controls').count(),1);
  const jointInput=()=>page.locator('#floating-joints .cr.number').filter({hasText:'torso_joint'}).locator('input[type=text]');
  await jointInput().fill('0.25');await jointInput().press('Tab');
  await page.waitForFunction(()=>Math.abs(robotjointcollection.findWhere({name:'torso_joint'}).theta-.25)<1e-8);
  await page.locator('#tab-animation').click();
  assert.ok(await floating.isVisible());assert.ok(await page.locator('#robotcsv').isVisible());
  await page.locator('#csv-template').click();assert.match(await page.locator('#robotcsv').inputValue(),/0.25/);
  await page.locator('#robotcsv').fill('time,torso_joint\n0,0\n0.15,0.4\n');await page.locator('#playbutton').click();
  await page.waitForFunction(()=>App.animform.state==='finished');
  assert.ok(Math.abs(Number(await jointInput().inputValue())-.4)<1e-8);
  await page.locator('#tab-urdf').click();
  await page.evaluate(()=>App.forumula.myCodeMirror.setValue(App.forumula.myCodeMirror.getValue().replace('0.32 0.26 0.085','0.35 0.26 0.085')));
  await page.locator('#loadbutton').click();await settled(page);
  assert.ok(await floating.isVisible());assert.equal(await page.locator('#joint-controls').count(),1);
  assert.ok(Math.abs(Number(await jointInput().inputValue())-.4)<1e-8);
  const before=await floating.boundingBox();const camera=await page.evaluate(()=>App.camera.position.toArray());
  const handle=page.locator('#joint-panel-handle');const header=await handle.boundingBox();
  await page.mouse.move(header.x+80,header.y+15);await page.mouse.down();await page.mouse.move(header.x-60,header.y+95,{steps:8});await page.mouse.up();
  const moved=await floating.boundingBox();assert.ok(moved.x<before.x-100);assert.ok(moved.y>before.y+50);
  assert.deepEqual(await page.evaluate(()=>App.camera.position.toArray()),camera);
  await handle.focus();await page.keyboard.press('ArrowRight');
  assert.ok((await floating.boundingBox()).x>moved.x+10);
  const box=await floating.boundingBox();
  await page.mouse.move(box.x+box.width-5,box.y+box.height-5);await page.mouse.down();await page.mouse.move(box.x+box.width+45,box.y+box.height+45,{steps:8});await page.mouse.up();
  const resized=await floating.boundingBox();assert.ok(resized.width>box.width+20);assert.ok(resized.height>box.height+20);
  for(const [width,height] of [[390,844],[667,375],[320,568]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{const box=document.getElementById('floating-joints').getBoundingClientRect();return box.left>=7 && box.right<=innerWidth-7 && box.top>=59 && box.bottom<=innerHeight-7;});
    assert.ok(await page.locator('#joints-dock').isVisible());
  }
  await page.locator('#joints-dock').click();
  assert.ok(!(await floating.isVisible()));assert.ok(await page.locator('#panel-joints #joint-controls').isVisible());
  assert.equal(await page.locator('#joint-controls').count(),1);
  assert.ok(Math.abs(await page.evaluate(()=>robotjointcollection.findWhere({name:'torso_joint'}).theta)-.4)<1e-8);
  assert.deepEqual(errors,[]);await context.close();
});

test('phone touch drags move docked and compact detached sliders without moving the camera', async () => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const touch=await context.newCDPSession(page);
  const swipe=async (start,end) => {
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:1,radiusX:8,radiusY:8,force:1}]});
    for(let i=1;i<=10;i++) await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/10,y:start.y+(end.y-start.y)*i/10,id:1,radiusX:8,radiusY:8,force:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);await settled(page);
  await page.locator('#tab-joints').tap();
  const slider=page.getByRole('slider',{name:'torso_joint',exact:true});
  const initial=await page.evaluate(()=>({value:robotjointcollection.findWhere({name:'torso_joint'}).theta,camera:App.camera.position.toArray()}));
  let box=await slider.boundingBox();
  await swipe({x:box.x+box.width*.25,y:box.y+box.height/2},{x:box.x+box.width*.8,y:box.y+box.height/2});
  const docked=await page.evaluate(()=>robotjointcollection.findWhere({name:'torso_joint'}).theta);
  assert.ok(Math.abs(docked-initial.value)>.1);
  assert.ok(Math.abs(Number(await slider.getAttribute('aria-valuenow'))-docked)<1e-8);
  (await page.evaluate(()=>App.camera.position.toArray())).forEach((n,i)=>assert.ok(Math.abs(n-initial.camera[i])<1e-8));
  await page.locator('#joints-detach').tap();
  const floating=page.locator('#floating-joints');
  await floating.waitFor({state:'visible'});
  const panel=await floating.boundingBox();assert.ok(panel.width<=251);assert.ok(panel.height<=844*.45+1);
  const preview=await page.locator('#container').boundingBox();assert.ok(panel.y>=preview.y+preview.height,'Phone preview stays uncovered');
  assert.ok(await page.locator('#panel-urdf').isVisible());
  box=await slider.boundingBox();
  await swipe({x:box.x+box.width*.8,y:box.y+box.height/2},{x:box.x+box.width*.2,y:box.y+box.height/2});
  const detached=await page.evaluate(()=>robotjointcollection.findWhere({name:'torso_joint'}).theta);
  assert.ok(Math.abs(detached-docked)>.1);
  assert.ok(Math.abs(Number(await slider.getAttribute('aria-valuenow'))-detached)<1e-8);
  (await page.evaluate(()=>App.camera.position.toArray())).forEach((n,i)=>assert.ok(Math.abs(n-initial.camera[i])<1e-8));
  const body=page.locator('#floating-joints-content');const content=await body.boundingBox();
  await swipe({x:content.x+18,y:content.y+content.height-24},{x:content.x+18,y:content.y+35});
  await page.waitForFunction(()=>document.getElementById('floating-joints-content').scrollTop>20);
  for(const [width,height] of [[667,375],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{const box=document.getElementById('floating-joints').getBoundingClientRect();return box.height<=innerHeight*.45+1 && box.bottom<=innerHeight-7 && box.top>=59 && box.left>=7 && box.right<=innerWidth-7;});
    const landscape=await floating.boundingBox();assert.ok(landscape.width<=251);assert.ok(landscape.y+landscape.height<=height-7);
  }
  await page.locator('#joints-dock').tap();assert.ok(await page.locator('#panel-joints #joint-controls').isVisible());
  await page.locator('#tab-files').tap();await page.locator('#pi-collision-demo').tap();
  await page.waitForFunction(()=>App.collisions.pairs.length>0);
  assert.ok(await page.locator('#collision-enabled').isChecked());
  await page.locator('#tab-joints').tap();
  const elbow=page.getByRole('slider',{name:'left_elbow_joint',exact:true});await elbow.scrollIntoViewIfNeeded();
  const elbowBox=await elbow.boundingBox();
  await swipe({x:elbowBox.x+elbowBox.width*.75,y:elbowBox.y+elbowBox.height/2},{x:elbowBox.x+elbowBox.width*.5,y:elbowBox.y+elbowBox.height/2});
  await page.waitForFunction(()=>App.collisions.pairs.length===0);
  assert.deepEqual(errors,[]);await context.close();
});

test('optional collision warnings, Pi demo poses, CSV motion and collision-only STL restoration', async () => {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);await settled(page);
  assert.ok(!(await page.locator('#collision-enabled').isChecked()));
  assert.equal(await page.evaluate(()=>App.collisions.shapes.length),15);
  await page.locator('#collision-enabled').check();
  await page.waitForFunction(()=>!App.collisions.dirty);
  assert.deepEqual(await page.evaluate(()=>App.collisions.pairs),[]);
  assert.match(await page.locator('#collision-status').innerText(),/No overlaps/);
  // Both inward shoulder limits must catch arm/torso contact before the hands touch.
  await page.locator('#tab-joints').click();
  for (const [side,key] of [['left','Home'],['right','End']]) {
    const name=side+'_shoulder_forward_joint';
    await page.getByRole('slider',{name,exact:true}).press(key);
    await page.waitForFunction(side=>App.collisions.pairs.some(pair=>pair.includes(side+'_upper_arm_link')&&pair.includes('torso_link')),side);
    assert.equal(await page.evaluate(side=>robotlinkcollection.get(side+'_upper_arm_link').meshvis_array[0].children[0].material.color.getHex(),side),0xff2424);
    await page.evaluate(name=>App.robotjointmanipall.changejointval(name,0),name);
    await page.waitForFunction(()=>App.collisions.pairs.length===0);
  }
  // Pose from the reported failure: both forearms cross the torso.
  await page.evaluate(()=>{
    const pose={left_shoulder_forward_joint:-1.57,right_shoulder_forward_joint:1.57,left_shoulder_up_joint:-.458,right_shoulder_up_joint:-.531,left_elbow_joint:-.828,right_elbow_joint:-.622};
    for(const [name,value] of Object.entries(pose))App.robotjointmanipall.changejointval(name,value);
  });
  await page.waitForFunction(()=>['left','right'].every(side=>App.collisions.pairs.some(pair=>pair.includes(side+'_lower_arm_link')&&pair.includes('torso_link'))));
  await page.locator('#tab-files').click();await page.locator('#pi-collision-demo').click();
  await page.waitForFunction(()=>App.collisions.pairs.some(pair=>pair.includes('left_hand_link')&&pair.includes('torso_link')));
  assert.ok(await page.locator('#collision-enabled').isChecked());
  assert.equal(await page.evaluate(()=>robotlinkcollection.get('torso_link').meshvis_array[0].children[0].material.color.getHex()),0xff2424);
  assert.notEqual(await page.evaluate(()=>robotlinkcollection.get('right_hand_link').meshvis_array[0].material.color.getHex()),0xff2424);
  await page.evaluate(()=>window.originalCollisionMaterials=[...App.collisions.highlighted]);
  await page.locator('#collision-enabled').uncheck();
  assert.ok(await page.evaluate(()=>originalCollisionMaterials.every(([mesh,material])=>mesh.material===material)));
  assert.deepEqual(await page.evaluate(()=>App.collisions.pairs),[]);
  await page.locator('#collision-enabled').check();
  await page.waitForFunction(()=>App.collisions.pairs.length>0);
  await page.locator('#tab-joints').click();await page.locator('#joints-detach').click();await page.locator('#tab-animation').click();
  await page.locator('#robotcsv').fill('time,left_shoulder_forward_joint,left_shoulder_up_joint,left_elbow_joint,left_wrist_joint\n0,0,0,0,0\n0.3,1.35,0.4,1.55,-0.5\n0.8,0,0,0,0\n');
  await page.locator('#playbutton').click();
  await page.waitForFunction(()=>App.collisions.pairs.length===0);
  await page.waitForFunction(()=>App.collisions.pairs.length>0);
  assert.ok(await page.locator('#floating-joints').isVisible());
  await page.waitForFunction(()=>App.animform.state==='finished'&&App.collisions.pairs.length===0);
  await page.locator('#tab-urdf').click();
  await page.evaluate(()=>App.forumula.myCodeMirror.setValue(App.forumula.myCodeMirror.getValue().replace('0.32 0.26 0.085','0.33 0.26 0.085')));
  await page.locator('#loadbutton').click();await settled(page);
  assert.ok(await page.locator('#collision-enabled').isChecked());assert.equal(await page.evaluate(()=>App.collisions.shapes.length),15);
  const meshRobot='<robot name="Collision mesh"><link name="base"><visual><geometry><box size="0.2 0.2 0.2"/></geometry></visual><collision><geometry><mesh filename="package://demo/part.stl" scale="-1 2 1"/></geometry></collision></link><link name="spacer"/><link name="hand"><visual><geometry><sphere radius="0.1"/></geometry></visual><collision><origin xyz="-0.25 0.25 0"/><geometry><box size="0.1 0.1 0.1"/></geometry></collision></link><joint name="root" type="revolute"><parent link="base"/><child link="spacer"/><origin xyz="2 0 0"/><axis xyz="0 0 1"/></joint><joint name="slide" type="prismatic"><parent link="spacer"/><child link="hand"/><axis xyz="1 0 0"/><limit lower="-3" upper="3"/></joint></robot>';
  await page.locator('#local-files').setInputFiles([upload('collision.urdf',Buffer.from(meshRobot)),upload('part.stl',stl)]);
  await page.waitForFunction(()=>App.localRobots.currentXml.includes('Collision mesh'));await settled(page);
  assert.equal(await page.evaluate(()=>App.collisions.shapes.length),2);assert.deepEqual(await page.evaluate(()=>App.collisions.pairs),[]);
  assert.equal(await page.evaluate(()=>App.localRobots.records.find(r=>r.name==='Collision mesh').assets.length),1,'Collision-only STL bytes saved');
  await page.evaluate(()=>App.robotjointmanipall.changejointval('slide',-2));await page.waitForFunction(()=>App.collisions.pairs.length===1);
  const id=await page.locator('#local-library').inputValue();
  await page.reload();await page.waitForFunction(()=>window.robotlinkcollection?.length);await settled(page);
  await page.locator('#tab-files').click();await page.locator('#local-library').selectOption(id);await page.locator('#local-open').click();
  await page.waitForFunction(()=>App.localRobots.currentXml.includes('Collision mesh'));await settled(page);
  assert.equal(await page.evaluate(()=>App.collisions.shapes.length),2);assert.deepEqual(await page.evaluate(()=>App.collisions.issues),[]);
  await page.locator('#collision-enabled').check();await page.evaluate(()=>App.robotjointmanipall.changejointval('slide',-2));await page.waitForFunction(()=>App.collisions.pairs.length===1);
  await page.locator('#local-files').setInputFiles(upload('empty.urdf',Buffer.from('<robot name="Visual only"><link name="base"><visual><geometry><box size="1 1 1"/></geometry></visual></link></robot>')));
  await page.waitForFunction(()=>App.localRobots.currentXml.includes('Visual only'));await settled(page);
  assert.equal(await page.evaluate(()=>App.collisions.shapes.length),0);assert.equal(await page.evaluate(()=>App.collisions.redMaterials.size),0);
  assert.match(await page.locator('#collision-status').innerText(),/No collision shapes in/);
  await page.locator('#local-files').setInputFiles(upload('missing.urdf',Buffer.from('<robot name="Missing collider"><link name="base"><visual><geometry><box size="1 1 1"/></geometry></visual><collision><geometry><mesh filename="missing.stl"/></geometry></collision></link></robot>')));
  await page.waitForFunction(()=>App.localRobots.currentXml.includes('Missing collider'));await settled(page);
  assert.match(await page.locator('#collision-status').innerText(),/Incomplete/);
  assert.match(await page.locator('#local-status').innerText(),/Missing or ambiguous STL/);
  await page.setViewportSize({width:320,height:568});
  assert.ok(await page.locator('#collision-enabled').isVisible());assert.ok(await page.locator('#collision-status').isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await context.close();
});

const ikRobot='<robot name="IK test"><link name="base"><visual><geometry><box size="0.3 0.3 0.2"/></geometry></visual><collision><geometry><box size="6 6 1"/></geometry></collision></link><link name="torso"><visual><geometry><box size="0.2 0.2 0.2"/></geometry></visual></link><link name="upper"><visual><origin xyz="0.5 0 0"/><geometry><box size="1 0.15 0.15"/></geometry></visual></link><link name="tip"><visual><origin xyz="0.5 0 0"/><geometry><box size="1 0.15 0.15"/></geometry></visual><visual><origin xyz="0.4 0 0.09"/><geometry><mesh filename="part.stl" scale="0.5 0.5 0.5"/></geometry></visual><collision><origin xyz="0.5 0 0"/><geometry><box size="1 0.15 0.15"/></geometry></collision></link><link name="other"><visual><geometry><box size="0.1 0.1 0.1"/></geometry></visual></link><joint name="torso" type="revolute"><parent link="base"/><child link="torso"/><axis xyz="0 0 1"/><limit lower="-1" upper="1"/></joint><joint name="shoulder" type="revolute"><parent link="torso"/><child link="upper"/><axis xyz="0 0 2"/><limit lower="0" upper="1.6"/></joint><joint name="elbow" type="revolute"><parent link="upper"/><child link="tip"/><origin xyz="1 0 0"/><axis xyz="0 0 1"/><limit lower="-2" upper="2"/></joint><joint name="other" type="prismatic"><parent link="torso"/><child link="other"/><origin xyz="0 -0.5 0"/><axis xyz="1 0 0"/><limit lower="0" upper="1"/></joint></robot>';
async function loadIK(page) {
  await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);
  await page.locator('#local-files').setInputFiles([upload('ik.urdf',Buffer.from(ikRobot)),upload('part.stl',stl)]);
  await page.waitForFunction(()=>App.localRobots.currentXml.includes('IK test'));await settled(page);
  await page.locator('#standard-view').selectOption('top');
}
async function projectIK(page,point) {
  return page.evaluate(point=>{const p=new THREE.Vector3(...point).project(App.camera),r=renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},point);
}

test('IK picks STL and primitive links, follows the cursor, changes depth, preserves branches and restores or commits poses',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await loadIK(page);
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'shoulder'}).lower),0);
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'shoulder'}).axis.length()),1);
  await page.locator('#collision-enabled').check();await page.waitForFunction(()=>App.collisions.pairs.length>0);
  const camera=await page.evaluate(()=>App.camera.position.toArray());
  const start=await projectIK(page,[1.5,.1,.09]);await page.mouse.dblclick(start.x,start.y);
  await page.waitForFunction(()=>App.poseTool.active?.object.name==='tip');
  const markers=await page.evaluate(()=>({centre:App.poseTool.centreMarker.position.toArray(),target:App.poseTool.marker.position.toArray(),actual:App.poseTool.active.solver.position().toArray(),goal:App.poseTool.active.target.toArray(),offset:App.poseTool.active.grabOffset.length(),line:[...App.poseTool.line.geometry.getAttribute('position').array]}));
  assert.ok(markers.offset>.01,'Off-centre pick makes the old shifted tether distinguishable');
  markers.centre.forEach((n,i)=>assert.ok(Math.abs(n-markers.actual[i])<1e-10));
  markers.target.forEach((n,i)=>assert.ok(Math.abs(n-markers.goal[i])<1e-10));
  markers.line.forEach((n,i)=>assert.ok(Math.abs(n-(i<3?markers.actual[i]:markers.goal[i-3]))<1e-6));
  assert.ok(await page.locator('#pose-key').isVisible());
  assert.equal(await page.evaluate(()=>robotlinkcollection.get('tip').meshvis_array[0].material.color.getHex()),0xff2424,'Selection keeps collision red');
  assert.deepEqual(await page.evaluate(()=>App.poseTool.active.solver.chain.map(j=>j.name)),['elbow','shoulder']);
  const target=await projectIK(page,[1.25,.6,.09]);await page.mouse.move(target.x,target.y,{steps:8});
  await page.waitForFunction(()=>App.poseTool.active.solver.position().distanceTo(App.poseTool.active.target)<.01);
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'torso'}).theta),0);
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'other'}).theta),0);
  const depth=await page.evaluate(()=>App.poseTool.active.target.toArray());await page.mouse.wheel(0,120);
  await page.waitForFunction(depth=>new THREE.Vector3(...depth).distanceTo(App.poseTool.active.target)>.02,depth);
  (await page.evaluate(()=>App.camera.position.toArray())).forEach((n,i)=>assert.ok(Math.abs(n-camera[i])<1e-8));
  await page.keyboard.press('Escape');assert.ok(await page.evaluate(()=>!App.poseTool.active&&App.cameraControls.enabled));
  assert.ok(!(await page.locator('#pose-key').isVisible()));
  assert.deepEqual(await page.evaluate(()=>robotjointcollection.map(j=>j.theta)),[0,0,0,0]);
  assert.equal(await page.evaluate(()=>scene.getObjectByName('Pose target')),undefined);
  // A primitive on the same link is independently pickable.
  const primitive=await projectIK(page,[1.75,-.04,.075]);await page.mouse.click(primitive.x,primitive.y);await page.waitForFunction(()=>App.poseTool.active);
  const move=await projectIK(page,[1.5,.4,.075]);await page.mouse.move(move.x,move.y,{steps:6});
  await page.waitForFunction(()=>Math.abs(robotjointcollection.findWhere({name:'shoulder'}).theta)>.01);
  await page.mouse.click(move.x,move.y);assert.ok(await page.evaluate(()=>!App.poseTool.active&&App.cameraControls.enabled));
  await page.locator('#tab-joints').click();
  const shoulder=await page.evaluate(()=>robotjointcollection.findWhere({name:'shoulder'}).theta);
  assert.ok(Math.abs(Number(await page.getByRole('slider',{name:'shoulder',exact:true}).getAttribute('aria-valuenow'))-shoulder)<1e-8);
  const again=await page.evaluate(()=>{const v=new THREE.Vector3(.75,-.04,.075).applyMatrix4(robotlinkcollection.get('tip').get('link').matrixWorld).project(App.camera),r=renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};});
  await page.mouse.dblclick(again.x,again.y);await page.waitForFunction(()=>App.poseTool.active?.object.name==='tip');
  await page.locator('#pose-cancel').click();
  // A carriage handle on its joint axis must still translate along that axis.
  const carriage=await projectIK(page,[0,-.5,.05]);await page.mouse.click(carriage.x,carriage.y);await page.waitForFunction(()=>App.poseTool.active?.object.name==='other');
  const shifted=await projectIK(page,[.35,-.5,.05]);await page.mouse.move(shifted.x,shifted.y,{steps:5});
  await page.waitForFunction(()=>Math.abs(robotjointcollection.findWhere({name:'other'}).theta-.35)<.005);
  await page.locator('#pose-place').click();assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'torso'}).theta),0);
  await page.locator('#pose-toggle').click();assert.equal(await page.locator('#pose-toggle').getAttribute('aria-pressed'),'false');
  assert.deepEqual(errors,[]);await context.close();
});

test('IK handles fixed picks, animation, manual controls, rebuilds and resizing without stale targets',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await loadIK(page);
  await page.locator('#pose-toggle').click();const fixed=await projectIK(page,[-.13,0,.1]);await page.mouse.click(fixed.x,fixed.y);
  assert.match(await page.locator('#pose-status').innerText(),/no movable ancestors/);assert.ok(await page.evaluate(()=>!App.poseTool.active));
  await page.locator('#tab-animation').click();const csv='time,shoulder,elbow\n0,0,0\n5,0.5,0.5\n';await page.locator('#robotcsv').fill(csv);await page.locator('#playbutton').click();
  const start=await projectIK(page,[1.5,.1,.09]);await page.mouse.click(start.x,start.y);await page.waitForFunction(()=>App.poseTool.active);
  assert.equal(await page.evaluate(()=>App.animform.state),'paused');assert.equal(await page.locator('#robotcsv').inputValue(),csv);
  // This arm is planar, so a depth offset is certainly unreachable.
  await page.locator('#pose-farther').click();
  await page.waitForFunction(()=>App.poseTool.active.solver.stalled);assert.match(await page.locator('#pose-status').innerText(),/Best pose/);
  await page.locator('#pose-cancel').click();assert.deepEqual(await page.evaluate(()=>robotjointcollection.map(j=>j.theta)),[0,0,0,0]);
  await page.mouse.click(start.x,start.y);await page.waitForFunction(()=>App.poseTool.active);
  await page.locator('#playbutton').click();assert.ok(await page.evaluate(()=>!App.poseTool.active&&App.cameraControls.enabled));
  await page.locator('#pausebutton').click();
  await page.mouse.click(start.x,start.y);await page.waitForFunction(()=>App.poseTool.active);
  await page.locator('#tab-joints').click();await page.getByRole('slider',{name:'shoulder',exact:true}).press('ArrowRight');assert.ok(await page.evaluate(()=>!App.poseTool.active));
  // Restore a known pose before picking; applying URDF cancels to that snapshot.
  await page.evaluate(()=>{App.robotjointmanipall.changejointval('shoulder',0);App.robotjointmanipall.changejointval('elbow',0);});
  await page.mouse.click(start.x,start.y);await page.waitForFunction(()=>App.poseTool.active);
  const target=await projectIK(page,[1.2,.6,.09]);await page.mouse.move(target.x,target.y,{steps:5});await page.waitForFunction(()=>robotjointcollection.findWhere({name:'shoulder'}).theta>.01);
  await page.locator('#tab-urdf').click();await page.locator('#loadbutton').click();await settled(page);
  assert.ok(await page.evaluate(()=>!App.poseTool.active));assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'shoulder'}).theta),0);
  await page.mouse.click(start.x,start.y);await page.waitForFunction(()=>App.poseTool.active);await page.setViewportSize({width:1100,height:800});
  await page.waitForFunction(()=>!App.poseTool.active&&App.cameraControls.enabled);
  assert.deepEqual(errors,[]);await context.close();
});

test('touch IK drags a segment and commits on release while keeping the camera steady',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await loadIK(page);await page.locator('#pose-toggle').tap();
  const camera=await page.evaluate(()=>App.camera.position.toArray());const start=await projectIK(page,[1.5,.1,.09]),end=await projectIK(page,[1.3,.5,.09]);const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});await page.waitForFunction(()=>App.poseTool.active);
  for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/10,y:start.y+(end.y-start.y)*i/10,id:1}]});
  await page.waitForFunction(()=>robotjointcollection.findWhere({name:'shoulder'}).theta>.01);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>!App.poseTool.active&&App.cameraControls.enabled);
  (await page.evaluate(()=>App.camera.position.toArray())).forEach((n,i)=>assert.ok(Math.abs(n-camera[i])<1e-8));
  assert.ok(await page.evaluate(()=>robotjointcollection.findWhere({name:'shoulder'}).theta>.01));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
});

test('moving a Pi elbow preserves forearm and hand configuration without spinning the elbow casing',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);
  await page.evaluate(()=>{
    App.robotjointmanipall.changejointval('left_elbow_joint',.45);
    App.robotjointmanipall.changejointval('left_wrist_joint',-.55);
    scene.updateMatrixWorld(true);
    const object=robotlinkcollection.get('left_elbow_link').get('link'),hand=robotlinkcollection.get('left_hand_link').get('link');
    window.middleOriginal={angles:robotjointcollection.map(j=>j.theta),relative:object.matrixWorld.clone().invert().multiply(hand.matrixWorld).elements.slice()};
    // Off-centre point on the casing: the previous surface-point solver used
    // this small lever to twist the elbow dramatically for a small translation.
    const point=new THREE.Vector3(.0175,.008,.008).applyMatrix4(object.matrixWorld);
    App.poseTool.setEnabled(true);App.poseTool.begin({object,point,owners:App.poseTool.meshes()});
    App.poseTool.active.target.add(new THREE.Vector3(0,.03,0));
  });
  await page.waitForFunction(()=>App.poseTool.active.solver.stalled);
  const checked=await page.evaluate(()=>{
    const tool=App.poseTool,object=robotlinkcollection.get('left_elbow_link').get('link'),hand=robotlinkcollection.get('left_hand_link').get('link');
    const relative=object.matrixWorld.clone().invert().multiply(hand.matrixWorld).elements;
    return {chain:tool.active.solver.chain.map(j=>j.name),elbow:robotjointcollection.findWhere({name:'left_elbow_joint'}).theta,wrist:robotjointcollection.findWhere({name:'left_wrist_joint'}).theta,relativeError:Math.max(...relative.map((n,i)=>Math.abs(n-middleOriginal.relative[i]))),changed:robotjointcollection.filter((j,i)=>Math.abs(j.theta-middleOriginal.angles[i])>1e-10).map(j=>j.name)};
  });
  assert.equal(checked.elbow,.45);assert.equal(checked.wrist,-.55);assert.ok(checked.relativeError<1e-10);
  assert.ok(checked.changed.length>0);assert.ok(checked.changed.every(name=>['left_shoulder_forward_joint','left_shoulder_up_joint'].includes(name)));
  await page.locator('#pose-cancel').click();assert.ok(await page.evaluate(()=>robotjointcollection.every((j,i)=>j.theta===middleOriginal.angles[i])));
  assert.deepEqual(errors,[]);await context.close();
});

test('English/Polish switching translates UI and help while preserving drafts, CSV, pose, camera and saved names',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await loadIK(page);
  await page.locator('#tab-files').click();await page.locator('#local-name').fill('Front');await page.locator('#local-save').click();await settled(page);
  await page.locator('#tab-animation').click();await page.locator('#robotcsv').fill('time,shoulder,elbow\n0,0.2,-0.3\n1,0.4,-0.2\n');await settled(page);
  await page.locator('#tab-joints').click();await page.locator('#joints-detach').click();
  await page.evaluate(()=>{App.robotjointmanipall.changejointval('shoulder',.3);App.robotjointmanipall.changejointval('elbow',-.4);App.forumula.myCodeMirror.setValue(App.forumula.myCodeMirror.getValue()+'\n<!-- Front Play Robot preview -->');});
  const snapshot=()=>page.evaluate(()=>({urdf:App.forumula.myCodeMirror.getValue(),csv:document.getElementById('robotcsv').value,pose:robotjointcollection.map(j=>j.theta),camera:App.camera.position.toArray(),name:document.getElementById('local-name').value}));
  const before=await snapshot();await page.locator('#ui-language').selectOption('pl');
  assert.equal(await page.locator('html').getAttribute('lang'),'pl');assert.equal(await page.locator('#tab-files').innerText(),'Pliki');
  assert.equal(await page.locator('#draft-status').innerText(),'Niezastosowane zmiany');assert.match(await page.locator('#animation-status').innerText(),/Gotowe do odtworzenia/);
  assert.match(await page.locator('#local-status').innerText(),/Zapisano „Front”/);
  assert.equal(await page.locator('#floating-joints-title').innerText(),'Położenia przegubów');assert.equal(await page.locator('#joint-controls .title').innerText(),'Wartości przegubów');
  assert.equal(await page.getByRole('textbox',{name:'Wartość: shoulder',exact:true}).count(),1);
  assert.ok(await page.locator('#floating-joints').isVisible());
  const after=await snapshot();assert.deepEqual({...after,camera:before.camera},before);after.camera.forEach((n,i)=>assert.ok(Math.abs(n-before.camera[i])<1e-8));
  await page.locator('#help-button').click();assert.equal(await page.locator('#help-title').innerText(),'Jak korzystać z MyModelRobot');
  assert.match(await page.locator('#help-dialog').innerText(),/kinematyka odwrotna/);assert.match(await page.locator('#help-dialog').innerText(),/przeguby obrotowe/);
  await page.getByRole('button',{name:'Zamknij pomoc',exact:true}).click();
  await page.locator('#ui-language').selectOption('en');assert.equal(await page.locator('#draft-status').innerText(),'Unapplied changes');
  assert.equal(await page.locator('#joint-controls .title').innerText(),'Joint values');assert.equal(await page.locator('#tab-files').innerText(),'Files');
  const restored=await snapshot();assert.deepEqual({...restored,camera:before.camera},before);
  assert.deepEqual(errors,[]);await context.close();
});

test('Polish dynamic messages cover IK, collisions, validation and saved preference after reload',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await loadIK(page);await page.locator('#ui-language').selectOption('pl');
  await page.locator('#collision-enabled').check();await page.waitForFunction(()=>App.collisions.pairs.length>0);
  assert.match(await page.locator('#collision-status').innerText(),/Możliwe kolizje/);assert.match(await page.locator('#collision-status').innerText(),/base.*tip/);
  await page.locator('#pose-toggle').click();const start=await projectIK(page,[1.5,.1,.09]);await page.mouse.click(start.x,start.y);await page.waitForFunction(()=>App.poseTool.active);
  assert.match(await page.locator('#pose-status').innerText(),/Cel osiągnięty/);assert.match(await page.locator('#pose-status').innerText(),/tip/);
  const target=await projectIK(page,[1.25,.6,.09]);await page.mouse.move(target.x,target.y,{steps:5});await page.waitForFunction(()=>robotjointcollection.findWhere({name:'shoulder'}).theta>.01);
  await page.locator('#ui-language').selectOption('en');assert.ok(await page.evaluate(()=>Boolean(App.poseTool.active)));assert.match(await page.locator('#pose-status').innerText(),/from target/);
  await page.locator('#ui-language').selectOption('pl');await page.locator('#pose-cancel').click();assert.match(await page.locator('#pose-status').innerText(),/Kliknij segment/);
  await page.locator('#tab-animation').click();await page.locator('#robotcsv').fill('time,missing_joint\n0,1\n');
  assert.match(await page.locator('#animation-status').innerText(),/Nieznane, nieruchome lub zależne przeguby: missing_joint/);
  await page.locator('#tab-urdf').click();await page.evaluate(()=>App.forumula.myCodeMirror.setValue('<robot>'));await page.locator('#loadbutton').click();
  assert.match(await page.locator('#local-status').innerText(),/Wprowadź poprawny URDF/);
  await page.evaluate(()=>App.forumula.myCodeMirror.setValue(App.localRobots.currentXml));
  await page.locator('#local-files').setInputFiles(upload('missing.urdf',Buffer.from('<robot name="Front"><link name="base"><visual><geometry><box size="1 1 1"/></geometry></visual><collision><geometry><mesh filename="Front.stl"/></geometry></collision></link></robot>')));
  await page.waitForFunction(()=>App.localRobots.currentXml.includes('Front.stl'));await settled(page);
  assert.match(await page.locator('#local-status').innerText(),/Brak lub niejednoznaczny plik STL: Front.stl/);assert.match(await page.locator('#collision-status').innerText(),/Sprawdzenie niepełne/);
  await page.reload();await page.waitForFunction(()=>window.robotlinkcollection?.length);await settled(page);
  assert.equal(await page.locator('#ui-language').inputValue(),'pl');assert.equal(await page.locator('html').getAttribute('lang'),'pl');assert.equal(await page.locator('#pose-toggle').innerText(),'Ustaw pozycję');
  assert.match(await page.locator('#local-status').innerText(),/Zapisano/);assert.deepEqual(errors,[]);await context.close();
});

test('Polish controls fit phone and landscape viewports and language storage can be unavailable',async()=>{
  const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(key){if(key==='mymodelrobot-language')throw new Error('blocked');return get.call(this,key);};
    Storage.prototype.setItem=function(key,value){if(key==='mymodelrobot-language')throw new Error('blocked');return set.call(this,key,value);};
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);
  await page.locator('#ui-language').selectOption('pl');await page.locator('#tab-joints').tap();
  for(const [width,height]of[[320,568],[390,844],[667,375]]){
    await page.setViewportSize({width,height});
    assert.ok(await page.locator('#ui-language').isVisible());assert.ok(await page.locator('#help-button').isVisible());assert.ok(await page.locator('#open-files').isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const header=await page.locator('#ui-language').boundingBox();assert.ok(header.x>=0&&header.x+header.width<=width);
  }
  assert.deepEqual(errors,[]);await context.close();
});

test('CSV pose capture preserves the header and first row, appends current columns and saves the result',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await loadIK(page);await page.locator('#tab-animation').click();
  assert.equal(await page.locator('#addposition').count(),0,'Only one pose-capture action is visible');
  await page.locator('#csv-template').click();const first=await page.locator('#robotcsv').inputValue();assert.match(first,/^time,torso,shoulder,elbow,other\n0,0,0,0,0\n$/);
  await page.evaluate(()=>{App.robotjointmanipall.changejointval('shoulder',.3);App.robotjointmanipall.changejointval('elbow',-.4);});
  await page.locator('#csv-template').click();assert.equal(await page.locator('#robotcsv').inputValue(),first+'0.06,0,0.3,-0.4,0\n');
  assert.equal(await page.locator('#jointnames').innerText(),'Frame 2 / 2');
  await page.locator('#playbutton').click();await page.waitForFunction(()=>App.animform.state==='finished');
  assert.equal(await page.evaluate(()=>robotjointcollection.findWhere({name:'elbow'}).theta),-.4);
  // Edit the table without Apply CSV; cached animation columns must not be used.
  const edited='time,elbow,shoulder\n2,-0.2,0.1';await page.locator('#robotcsv').fill(edited);
  await page.evaluate(()=>{App.robotjointmanipall.changejointval('shoulder',.5);App.robotjointmanipall.changejointval('elbow',-.6);});
  await page.locator('#csv-template').click();const expected=edited+'\n2.06,-0.6,0.5\n';assert.equal(await page.locator('#robotcsv').inputValue(),expected);
  await settled(page);const id=await page.locator('#local-library').inputValue();
  await page.reload();await page.waitForFunction(()=>window.robotlinkcollection?.length);await settled(page);
  await page.locator('#tab-files').click();await page.locator('#local-library').selectOption(id);await page.locator('#local-open').click();
  await page.waitForFunction(()=>App.localRobots.currentXml.includes('IK test'));await settled(page);assert.equal(await page.locator('#robotcsv').inputValue(),expected);
  await page.locator('#tab-animation').click();await page.locator('#robotcsv').fill('elbow,shoulder\n-.2,.1');
  await page.evaluate(()=>{App.robotjointmanipall.changejointval('shoulder',.8);App.robotjointmanipall.changejointval('elbow',-.9);App.animform.names=[];App.animform.addposition();});
  assert.equal(await page.locator('#robotcsv').inputValue(),'elbow,shoulder\n-.2,.1\n-0.9,0.8\n');
  await page.locator('#robotcsv').fill('time,shoulder');await page.locator('#csv-template').click();assert.equal(await page.locator('#robotcsv').inputValue(),'time,shoulder\n0,0.8\n');
  const invalid='time,shoulder\n0,bad\n';await page.locator('#robotcsv').fill(invalid);await page.locator('#csv-template').click();
  assert.equal(await page.locator('#robotcsv').inputValue(),invalid);assert.match(await page.locator('#animation-status').innerText(),/Cannot add a pose/);
  await page.locator('#ui-language').selectOption('pl');assert.match(await page.locator('#animation-status').innerText(),/Nie można dodać pozycji/);
  assert.equal(await page.locator('#csv-template').innerText(),'Dodaj bieżącą pozycję do CSV');assert.deepEqual(errors,[]);await context.close();
});

test('IK torso handle shows actual centre, requested position and an axial-rotation hint',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);
  await page.locator('#standard-view').selectOption('front');
  const pick=await page.evaluate(()=>{scene.updateMatrixWorld(true);const p=new THREE.Box3().setFromObject(robotlinkcollection.get('torso_link').meshvis_array[0]).getCenter(new THREE.Vector3()).project(App.camera),r=renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};});
  await page.mouse.dblclick(pick.x,pick.y);await page.waitForFunction(()=>App.poseTool.active?.object.name==='torso_link');
  assert.match(await page.locator('#pose-status').innerText(),/This centre cannot move; use joint sliders to rotate/);
  const before=await page.evaluate(()=>({point:App.poseTool.centreMarker.position.toArray(),pose:robotjointcollection.map(j=>j.theta)}));
  await page.mouse.move(pick.x+40,pick.y+20,{steps:6});
  await page.waitForFunction(()=>App.poseTool.marker.position.distanceTo(App.poseTool.centreMarker.position)>.01);
  const after=await page.evaluate(()=>({point:App.poseTool.centreMarker.position.toArray(),pose:robotjointcollection.map(j=>j.theta),start:[...App.poseTool.line.geometry.getAttribute('position').array].slice(0,3)}));
  assert.deepEqual(after.pose,before.pose);after.point.forEach((n,i)=>assert.ok(Math.abs(n-before.point[i])<1e-10));after.start.forEach((n,i)=>assert.ok(Math.abs(n-before.point[i])<1e-6));
  await page.locator('#ui-language').selectOption('pl');assert.match(await page.locator('#pose-status').innerText(),/Ten środek jest nieruchomy/);
  await page.locator('#pose-cancel').click();assert.deepEqual(errors,[]);await context.close();
});

test('Help opens the bilingual CCD lesson with working step-by-step, constrained and touch-friendly exercises',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.robotlinkcollection?.length);await page.locator('#ui-language').selectOption('pl');
  await page.locator('#help-button').click();const link=page.locator('#ik-guide-link');assert.match(await link.innerText(),/Jak MyModelRobot realizuje/);assert.match(await link.getAttribute('href'),/ik-guide.html\?lang=pl/);
  const [guide]=await Promise.all([context.waitForEvent('page'),link.click()]);guide.setDefaultTimeout(10000);guide.on('pageerror',e=>errors.push(e.message));await guide.waitForLoadState();
  assert.equal(await guide.locator('html').getAttribute('lang'),'pl');assert.match(await guide.getByRole('heading',{level:1}).innerText(),/CCD/);
  assert.ok(await guide.getByRole('heading',{name:'Po jednym przegubie: CCD z uwzględnieniem osi',exact:true}).isVisible());
  const initial=[Number(await guide.locator('#angle-1').inputValue()),Number(await guide.locator('#angle-2').inputValue())];
  await guide.locator('#step-ccd').click();assert.equal(Number(await guide.locator('#angle-1').inputValue()),initial[0]);assert.notEqual(Number(await guide.locator('#angle-2').inputValue()),initial[1]);assert.equal(await guide.locator('#demo-steps').innerText(),'1');
  await guide.locator('#step-ccd').click();assert.notEqual(Number(await guide.locator('#angle-1').inputValue()),initial[0]);assert.equal(await guide.locator('#demo-steps').innerText(),'2');
  await guide.locator('#reset-ccd').click();await guide.locator('#solve-ccd').click();
  await guide.waitForFunction(()=>Number(document.getElementById('demo-error').dataset.value)<=.005);
  assert.match(await guide.locator('#demo-status').innerText(),/tolerancji/);
  await guide.locator('#beyond-reach').click();await guide.locator('#solve-ccd').click();await guide.waitForFunction(()=>document.getElementById('demo-status').textContent.startsWith('Obliczenia zakończone'));
  assert.ok(Number(await guide.locator('#demo-error').getAttribute('data-value'))>1);
  assert.ok(Math.abs(Number(await guide.locator('#angle-1').inputValue()))<=120);assert.ok(Math.abs(Number(await guide.locator('#angle-2').inputValue()))<=140);
  const saved=[await guide.locator('#angle-1').inputValue(),await guide.locator('#angle-2').inputValue()];await guide.locator('#guide-language').selectOption('en');
  assert.match(await guide.getByRole('heading',{level:1}).innerText(),/axis-constrained CCD/);assert.deepEqual([await guide.locator('#angle-1').inputValue(),await guide.locator('#angle-2').inputValue()],saved);
  const diagram=guide.locator('#ccd-diagram');await diagram.focus();const target=await guide.locator('#requested-centre').getAttribute('cx');await guide.keyboard.press('ArrowRight');assert.ok(Number(await guide.locator('#requested-centre').getAttribute('cx'))>Number(target));
  for(const [width,height]of[[320,568],[667,375]]){await guide.setViewportSize({width,height});assert.ok(await guide.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await guide.locator('#guide-language').isVisible());}
  await guide.locator('#joint-limits').uncheck();assert.equal(await guide.locator('#angle-1').getAttribute('max'),'180');
  assert.ok(await page.locator('#help-dialog').isVisible(),'Lesson leaves original editing tab intact');assert.deepEqual(errors,[]);await context.close();
});

test('CCD lesson target can be dragged with touch on a phone',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('ik-guide.html?lang=pl',url).href);
  await page.waitForFunction(()=>document.getElementById('demo-error').dataset.value);await page.locator('#ccd-diagram').scrollIntoViewIfNeeded();
  const box=await page.locator('#ccd-diagram').boundingBox(),touch=await context.newCDPSession(page),x=box.x+box.width*.55,y=box.y+box.height*.45;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  const initial=Number(await page.locator('#requested-centre').getAttribute('cx'));
  for(let i=1;i<=8;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*3,y:y-i,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(Number(await page.locator('#requested-centre').getAttribute('cx'))>initial+10);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
});
