const {test,before}=require('node:test');
const assert=require('node:assert/strict');
let T,CollisionChecker,createCollider,localCollisionBounds;
before(async()=>{T=await import('three');({CollisionChecker,createCollider,localCollisionBounds}=await import('../frontend/collisions.js'));});
const link=(name,material)=>{
  const object=new T.Object3D();object.name=name;
  object.add(new T.Mesh(new T.BoxGeometry(1,1,1),material||new T.MeshPhongMaterial({color:0x338855})));
  return object;
};
const box=(name,object,size=[1,1,1],extra={})=>createCollider(name,object,{type:'box',size,...extra});
const check=(links,joints,shapes)=>{const checker=new CollisionChecker();checker.setModel(new Map(links),joints,shapes);checker.setEnabled(true);return checker;};

test('rotated boxes reject an AABB false positive; contact and containment are detected',()=>{
  const a=link('a'),b=link('b');b.position.set(.3,-.3,0);
  const sa=box('a',a,[2,.2,.2],{rpy:[0,0,Math.PI/4]}),sb=box('b',b,[2,.2,.2],{rpy:[0,0,Math.PI/4]});
  const checker=check([['a',a],['b',b]],[],[sa,sb]);
  assert.ok(sa.worldBox.intersectsBox(sb.worldBox));assert.deepEqual(checker.pairs,[]);
  b.position.set(.05,-.05,0);checker.markDirty();checker.update(100,true);assert.equal(checker.pairs.length,1);
  checker.clear();b.position.set(1,0,0);checker.setModel(new Map([['a',a],['b',b]]),[],[box('a',a),box('b',b)]);checker.update(200,true);assert.equal(checker.pairs.length,1,'touching counts');
  b.position.set(0,0,0);checker.setModel(new Map([['a',a],['b',b]]),[],[box('a',a,[2,2,2]),box('b',b,[.1,.1,.1])]);checker.update(300,true);assert.equal(checker.pairs.length,1,'contained shapes overlap');checker.clear();
});

test('primitive bounds, offsets, rotations and mirrored nonuniform mesh scales are respected',()=>{
  const cylinder=localCollisionBounds({type:'cylinder',radius:.3,length:2});assert.deepEqual(cylinder.min.toArray(),[-.3,-.3,-1]);
  const sphere=localCollisionBounds({type:'sphere',radius:.4});assert.deepEqual(sphere.max.toArray(),[.4,.4,.4]);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([1,0,-1,3,0,-1,1,2,1],3));
  const mesh=localCollisionBounds({type:'mesh',filename:'part.stl',scale:[-2,.5,3]},()=>geometry);
  assert.deepEqual(mesh.min.toArray(),[-6,0,-3]);assert.deepEqual(mesh.max.toArray(),[-2,1,3]);
  const object=link('part');object.position.set(10,0,0);
  const shape=box('part',object,[2,1,1],{xyz:[1,2,3],rpy:[.2,.3,.5]});
  const checker=check([['part',object]],[],[shape]);
  assert.ok(shape.worldOBB.center.distanceTo(new T.Vector3(11,2,3))<1e-10);
  const expected=new T.Matrix4().makeRotationZ(.5).multiply(new T.Matrix4().makeRotationY(.3)).multiply(new T.Matrix4().makeRotationX(.2));
  const actual=new T.Matrix4().setFromMatrix3(shape.worldOBB.rotation);expected.elements.forEach((n,i)=>assert.ok(Math.abs(n-actual.elements[i])<1e-10));
  const offset=createCollider('part',object,{type:'mesh',filename:'part.stl',scale:[-2,.5,3],rpy:[0,0,Math.PI/2]},()=>geometry);
  checker.setModel(new Map([['part',object]]),[],[offset]);checker.update(500,true);
  assert.ok(offset.worldOBB.center.distanceTo(new T.Vector3(9.5,-4,0))<1e-10,'Rotated off-centre mesh bounds');
  assert.throws(()=>localCollisionBounds({type:'mesh' ,filename:'missing.stl'},()=>null),/Missing/);
  assert.throws(()=>localCollisionBounds({type:'capsule'}),/Unsupported/);
  assert.throws(()=>localCollisionBounds({type:'box',size:[0,1,1]}),/positive/);checker.clear();
});

test('fixed assemblies, adjacent assemblies and shapes on the same link are excluded',()=>{
  const names=['torso','shoulder','upper','forearm','finger'];const objects=new Map(names.map(name=>[name,link(name)]));
  const joints=[{type:'fixed',parent:'torso',child:'shoulder'},{type:'revolute',parent:'shoulder',child:'upper'},{type:'revolute',parent:'upper',child:'forearm'},{type:'fixed',parent:'forearm',child:'finger'}];
  const shapes=names.map(name=>box(name,objects.get(name)));shapes.push(box('torso',objects.get('torso')));
  const checker=check(objects,joints,shapes);const pairs=checker.pairs.map(pair=>pair.join('/'));
  assert.equal(pairs.length,4);assert.ok(pairs.includes('finger/torso'));assert.ok(!pairs.includes('torso/upper'));assert.ok(!pairs.includes('forearm/upper'));assert.ok(!pairs.includes('finger/forearm'));assert.ok(!pairs.includes('torso/torso'));checker.clear();
});

test('highlighting isolates shared materials and child links, and restores and disposes overrides',()=>{
  const material=new T.MeshPhongMaterial({color:0x338855,opacity:.6,transparent:true});
  const a=link('a',material),b=link('b',material),untagged=link('untagged',material);a.add(untagged);
  const checker=check([['a',a],['b',b],['untagged',untagged]],[],[box('a',a),box('b',b)]);
  assert.equal(checker.pairs.length,1);assert.notEqual(a.children[0].material,material);assert.equal(a.children[0].material.color.getHex(),0xff2424);
  assert.equal(untagged.children[0].material,material);assert.equal(material.color.getHex(),0x338855);
  let disposed=0;for(const red of checker.redMaterials.values())red.addEventListener('dispose',()=>disposed++);
  b.position.x=3;checker.markDirty();assert.equal(checker.update(checker.lastCheck+10),false,'pose checks are throttled');
  checker.update(checker.lastCheck+60);assert.equal(checker.pairs.length,0);assert.equal(a.children[0].material,material);
  b.position.x=0;checker.markDirty();checker.update(1000,true);assert.equal(checker.pairs.length,1);
  checker.setEnabled(false);assert.equal(a.children[0].material,material);assert.equal(b.children[0].material,material);assert.equal(material.opacity,.6);
  checker.markDirty();assert.equal(checker.update(2000),false);checker.clear();assert.equal(disposed,1);assert.equal(checker.redMaterials.size,0);
});
