// Opt-in integration check. Pass a local directory containing the downloaded T12 URDF and STL files.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const directory=process.argv[2];
  if (!directory) throw new Error('Usage: node tests/check-external-robot.cjs /path/to/T12');
  const files=fs.readdirSync(directory).filter(name=>/\.(urdf|stl)$/i.test(name)).map(name=>path.join(directory,name));
  const browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.MODELROBOT_TEST_URL || 'http://127.0.0.1:8765/standalone.html');
    await page.waitForFunction(()=>window.robotlinkcollection?.length);
    await page.locator('#local-files').setInputFiles(files);
    await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('name="T12"'));
    await page.evaluate(()=>App.localRobots.pendingSave);
    const summary=await page.evaluate(()=>{
      let meshes=0,triangles=0;
      robot.traverse(item=>{if(item.isMesh){meshes++;triangles+=item.geometry.attributes.position.count/3;}});
      return {links:robotlinkcollection.length,joints:robotjointcollection.length,meshes,triangles,warnings:App.localRobots.messages,assets:App.localRobots.records.find(r=>r.name==='T12').assets.length};
    });
    assert.equal(summary.links,37);assert.equal(summary.joints,36);assert.equal(summary.meshes,37);assert.equal(summary.assets,37);assert.deepEqual(summary.warnings,[]);
    // Compare every link's zero-pose transform with URDF's fixed-axis roll/pitch/yaw convention.
    const maxError=await page.evaluate(()=>{
      const doc=new DOMParser().parseFromString(App.currentrobot.get('urdf'),'application/xml');
      const transforms=new Map([['Body',new THREE.Matrix4()]]);
      let joints=[...doc.querySelectorAll('robot > joint')];let max=0;
      while(joints.length){
        let progress=false;
        joints=joints.filter(joint=>{
          const parent=joint.querySelector('parent').getAttribute('link'),child=joint.querySelector('child').getAttribute('link');
          if(!transforms.has(parent))return true;
          const origin=joint.querySelector('origin');
          const xyz=origin.getAttribute('xyz').trim().split(/\s+/).map(Number),rpy=origin.getAttribute('rpy').trim().split(/\s+/).map(Number);
          const rotation=new THREE.Matrix4().makeRotationZ(rpy[2]).multiply(new THREE.Matrix4().makeRotationY(rpy[1])).multiply(new THREE.Matrix4().makeRotationX(rpy[0]));
          rotation.setPosition(...xyz);
          const expected=transforms.get(parent).clone().multiply(rotation);transforms.set(child,expected);
          robot.updateMatrixWorld(true);const actual=robotlinkcollection.get(child).get('link').matrixWorld;
          expected.elements.forEach((number,i)=>max=Math.max(max,Math.abs(number-actual.elements[i])));
          progress=true;return false;
        });
        if(!progress)throw new Error('Disconnected joint graph');
      }
      return max;
    });
    assert.ok(maxError<1e-5,'URDF zero-pose matrices agree, maximum error '+maxError);
    await page.locator('#collision-enabled').check();
    const collision=await page.evaluate(()=>({shapes:App.collisions.shapes.length,candidates:App.collisions.candidates.length,issues:App.collisions.issues,pairs:App.collisions.pairs.length}));
    assert.equal(collision.shapes,37);assert.ok(collision.candidates>0);assert.deepEqual(collision.issues,[]);
    await page.screenshot({path:'/tmp/modelrobot-T12.png'});
    const jointName=await page.evaluate(()=>robotjointcollection.find(j=>j.type==='revolute').name);
    const csv=`time,${jointName}\n0,0\n1,0.3\n`;
    await page.locator('#tab-animation').click();
    await page.locator('#robotcsv').fill(csv);await page.locator('#loadcsv').click();
    await page.evaluate(()=>App.localRobots.pendingSave);
    const id=await page.locator('#local-library').inputValue();
    await page.reload();await page.waitForFunction(()=>window.robotlinkcollection?.length);
    await page.evaluate(()=>App.localRobots.pendingSave);
    await page.locator('#tab-files').click();
    await page.locator('#local-library').selectOption(id);await page.locator('#local-open').click();
    await page.waitForFunction(()=>App.currentrobot.get('urdf').includes('name="T12"'));
    await page.evaluate(()=>App.localRobots.pendingSave);
    assert.equal((await page.locator('#robotcsv').inputValue()).trim(),csv.trim());
    await page.evaluate(()=>App.animform.settostaticframe(1));
    assert.equal(await page.evaluate(name=>robotjointcollection.findWhere({name}).theta,jointName),0.3);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({...summary,collision,maxTransformError:maxError,csvRestored:true,jointMotion:true,screenshot:'/tmp/modelrobot-T12.png'},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
