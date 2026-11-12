const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { chromium } = require('@playwright/test');

let server, browser;
const url = 'http://127.0.0.1:8767';
const state = () => {
  const left = robotjointcollection.findWhere({ name: 'left_finger_joint' });
  const right = robotjointcollection.findWhere({ name: 'right_finger_joint' });
  scene.updateMatrixWorld(true);
  return {
    left: left.theta, right: right.theta,
    leftY: left.childobject3d.getWorldPosition(new THREE.Vector3()).y,
    rightY: right.childobject3d.getWorldPosition(new THREE.Vector3()).y,
    controls: Object.keys(App.robotjointmanipall.jointsdict)
  };
};
before(async () => {
  server = spawn('python3', ['-c', readFileSync('tests/serve.py', 'utf8').replace('8765', '8767')], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(url); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
});
after(async () => { await browser?.close(); server?.kill(); });

test('URDF mimic gripper follows its driver through controls, CSV and pose tool', async () => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.waitForFunction(() => window.robotlinkcollection?.length);
  await page.locator('#tab-files').click();
  await page.getByRole('button', { name: 'Mimic gripper' }).click();
  await page.waitForFunction(() => App.currentrobot.get('urdf').includes('mimic_parallel_gripper'));
  assert.deepEqual(await page.evaluate(state), { left: 0, right: 0, leftY: .104, rightY: -.104, controls: ['left_finger_joint'] });
  await page.locator('#tab-joints').click();
  const input = page.locator('.cr.number').filter({ hasText: 'left_finger_joint' }).locator('input[type=text]');
  const slider = page.locator('#joint-controls input.joint-slider[aria-label="left_finger_joint"]');
  await input.fill('0.03'); await input.press('Tab');
  let pose = await page.evaluate(state);
  assert.ok(Math.abs(pose.left - .03) < 1e-9, JSON.stringify({pose,input:await input.inputValue(),slider:await slider.inputValue(),dummy:await page.evaluate(()=>App.robotjointmanipall.jointsdict.left_finger_joint.dummy.val)}));
  assert.ok(Math.abs(pose.right - .03) < 1e-9);
  assert.ok(Math.abs(pose.leftY - .074) < 1e-9 && Math.abs(pose.rightY + .074) < 1e-9);
  assert.ok(Math.abs(Number(await slider.inputValue()) - .03) < 1e-9);
  assert.ok(Math.abs(Number(await slider.getAttribute('aria-valuenow')) - .03) < 1e-9);
  await page.evaluate(() => { robotjointcollection.findWhere({ name: 'right_finger_joint' }).upper = .035; });
  await input.fill('0.05'); await input.press('Tab');
  pose = await page.evaluate(state);
  assert.ok(Math.abs(pose.left - .03) < 1e-9 && Math.abs(pose.right - .03) < 1e-9, 'A dependent limit rejects the entire driver move');
  assert.ok(Math.abs(Number(await input.inputValue()) - .03) < 1e-9, 'Rejected input returns to the actual pose');
  assert.ok(Math.abs(Number(await slider.inputValue()) - .03) < 1e-9);
  await page.evaluate(() => { robotjointcollection.findWhere({ name: 'right_finger_joint' }).upper = .075; });
  assert.equal(await page.evaluate(() => robotjointcollection.findWhere({ name: 'right_finger_joint' }).movejoint(.06)), false);
  await page.locator('#tab-animation').click();
  await page.locator('#csv-template').click();
  assert.match(await page.locator('#robotcsv').inputValue(), /^time,left_finger_joint\n/);
  await page.locator('#robotcsv').fill('time,right_finger_joint\n0,0.02\n');
  assert.match(await page.locator('#animation-status').innerText(), /right_finger_joint/);
  await page.locator('#robotcsv').fill('time,left_finger_joint\n0,0\n0.2,0.05\n');
  await page.locator('#loadcsv').click();
  await page.evaluate(() => App.animform.settostaticframe(1));
  pose = await page.evaluate(state);
  assert.ok(Math.abs(pose.left - .05) < 1e-9 && Math.abs(pose.right - .05) < 1e-9);
  assert.ok(Math.abs(Number(await slider.inputValue()) - .05) < 1e-9);
  // The pose tool's IK path must update the sibling dependent branch too.
  await page.evaluate(() => {
    const link = robotlinkcollection.get('left_finger').get('link');
    scene.updateMatrixWorld(true);
    const meshes = robotlinkcollection.get('left_finger').meshvis_array;
    const hit = { object: link, point: link.getWorldPosition(new THREE.Vector3()), owners: new Map(meshes.map(mesh => [mesh, link])) };
    App.poseTool.setEnabled(true);
    if (!App.poseTool.begin(hit)) throw new Error('Pose tool did not start');
    App.poseTool.active.target.y += .025;
    for (let i = 0; i < 10; i++) App.poseTool.update();
    App.poseTool.finish();
  });
  pose = await page.evaluate(state);
  assert.ok(pose.left < .04 && pose.left > .015, JSON.stringify(pose));
  assert.ok(Math.abs(pose.left - pose.right) < 1e-9);
  assert.ok(Math.abs(Number(await slider.inputValue()) - pose.left) < 1e-9);
  await page.locator('#tab-urdf').click();
  await page.locator('#loadbutton').click();
  pose = await page.evaluate(state);
  assert.ok(Math.abs(pose.left - pose.right) < 1e-9 && pose.left > .015);
  assert.deepEqual(errors, []);
  await page.close();
});

test('invalid mimic references, factors and dependency cycles are rejected before loading', async () => {
  const page = await browser.newPage(); await page.goto(url); await page.waitForFunction(() => window.App?.localRobots);
  const xml = readFileSync('testowe/mimic_gripper.urdf', 'utf8');
  const invalid = [
    [xml.replace('joint="left_finger_joint" multiplier', 'joint="missing" multiplier'), /missing driver/],
    [xml.replace('multiplier="1"', 'multiplier="NaN"'), /finite multiplier/],
    [xml.replace('<axis xyz="0 -1 0"/>', '<mimic joint="right_finger_joint"/><axis xyz="0 -1 0"/>'), /dependency cycle/]
  ];
  for (const [body, expected] of invalid) {
    const result = await page.evaluate(source => { try { App.localRobots.validate(source); return 'accepted'; } catch (error) { return error.message; } }, body);
    assert.match(result, expected);
  }
  await page.close();
});

test('mimic multiplier, offset and chained dependencies follow the driver', async () => {
  const page = await browser.newPage(); await page.goto(url);
  const xml = readFileSync('testowe/mimic_gripper.urdf', 'utf8')
    .replace('multiplier="1" offset="0"', 'multiplier="0.5" offset="0.01"')
    .replace('</robot>', '<link name="follower"/><joint name="follower_joint" type="prismatic"><parent link="palm"/><child link="follower"/><axis xyz="0 1 0"/><limit lower="0" upper="0.2"/><mimic joint="right_finger_joint" multiplier="2" offset="0.005"/></joint></robot>');
  await page.locator('#local-files').setInputFiles({ name: 'chain.urdf', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await page.waitForFunction(() => App.currentrobot.get('urdf').includes('follower_joint'));
  assert.deepEqual(await page.evaluate(() => robotjointcollection.map(joint => [joint.name, joint.theta])), [
    ['left_finger_joint', 0], ['right_finger_joint', .01], ['follower_joint', .025]
  ]);
  const values = await page.evaluate(() => {
    robotjointcollection.findWhere({ name: 'left_finger_joint' }).movejoint(.05);
    return robotjointcollection.map(joint => [joint.name, joint.theta]);
  });
  assert.ok(Math.abs(values[1][1] - .035) < 1e-12 && Math.abs(values[2][1] - .075) < 1e-12);
  assert.deepEqual(await page.evaluate(() => Object.keys(App.robotjointmanipall.jointsdict)), ['left_finger_joint']);
  await page.close();
});

test('startup chooses a feasible nonzero driver pose through a mimic chain and rejects impossible limits', async () => {
  const page = await browser.newPage(); await page.goto(url);
  const source = readFileSync('testowe/mimic_gripper.urdf', 'utf8');
  const feasible = source.replace('multiplier="1" offset="0"', 'multiplier="1" offset="-0.03"')
    .replace('</robot>', '<link name="follower"/><joint name="follower_joint" type="prismatic"><parent link="palm"/><child link="follower"/><axis xyz="0 1 0"/><limit lower="0.01" upper="0.07"/><mimic joint="right_finger_joint" multiplier="2" offset="0"/></joint></robot>');
  await page.locator('#local-files').setInputFiles({ name: 'nonzero-home.urdf', mimeType: 'application/xml', buffer: Buffer.from(feasible) });
  await page.waitForFunction(() => App.currentrobot.get('urdf').includes('follower_joint'));
  const values = await page.evaluate(() => robotjointcollection.map(joint => joint.theta));
  assert.ok(Math.abs(values[0] - .035) < 1e-12 && Math.abs(values[1] - .005) < 1e-12 && Math.abs(values[2] - .01) < 1e-12, JSON.stringify(values));
  await page.locator('#tab-joints').click();
  const input = page.locator('.cr.number').filter({ hasText: 'left_finger_joint' }).locator('input[type=text]');
  const slider = page.locator('#joint-controls input.joint-slider[aria-label="left_finger_joint"]');
  assert.ok(Math.abs(Number(await input.inputValue()) - .035) < 1e-12);
  assert.ok(Math.abs(Number(await slider.inputValue()) - .035) < 1e-12);
  assert.ok(Math.abs(Number(await slider.getAttribute('aria-valuenow')) - .035) < 1e-12);
  const impossible = source.replace('multiplier="1" offset="0"', 'multiplier="1" offset="0.2"');
  await page.locator('#local-files').setInputFiles({ name: 'impossible.urdf', mimeType: 'application/xml', buffer: Buffer.from(impossible) });
  assert.match(await page.locator('#local-status').innerText(), /no feasible pose/);
  assert.ok(await page.evaluate(() => App.currentrobot.get('urdf').includes('follower_joint')), 'Invalid URDF does not replace the working preview');
  await page.close();
});
