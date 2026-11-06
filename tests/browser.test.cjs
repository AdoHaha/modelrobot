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
  assert.deepEqual(errors,[]);await context.close();
});
