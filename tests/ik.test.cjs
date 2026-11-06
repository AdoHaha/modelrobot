const {test,before}=require('node:test');
const assert=require('node:assert/strict');
let T,IKSolver,limbChain;
before(async()=>{T=await import('three');({IKSolver,limbChain}=await import('../frontend/ik.js'));});

function fixture(definitions) {
  const root=new T.Group(),objects=new Map(),joints=[];
  const object=name=>{if(!objects.has(name)){const o=new T.Object3D();o.name=name;objects.set(name,o);root.add(o);}return objects.get(name);};
  for(const d of definitions){
    const parent=object(d.parent),child=object(d.child);parent.add(child);child.matrixAutoUpdate=false;
    const basic=new T.Matrix4().makeRotationFromEuler(new T.Euler(...(d.rpy||[0,0,0]),'ZYX'));basic.setPosition(...(d.xyz||[0,0,0]));
    const joint={name:d.child,type:d.type||'revolute',axis:new T.Vector3(...(d.axis||[0,0,1])).normalize(),basicMatrix:basic,parentobject3d:parent,lower:d.lower??-Math.PI,upper:d.upper??Math.PI,theta:0,
      get:key=>({parent:{link:d.parent},child:{link:d.child}}[key]),
      movejoint(value){this.theta=this.type==='continuous'?value:Math.max(this.lower,Math.min(this.upper,value));const move=new T.Matrix4();if(this.type==='prismatic')move.setPosition(this.axis.clone().multiplyScalar(this.theta));else if(this.type!=='fixed')move.makeRotationAxis(this.axis,this.theta);child.matrix.multiplyMatrices(basic,move);return this;}};
    joint.movejoint(0);joints.push(joint);
  }
  root.updateMatrixWorld(true);return {root,objects,joints};
}
const solverFor=(f,name,point=[1,0,0])=>new IKSolver({root:f.root,object:f.objects.get(name),localPoint:new T.Vector3(...point),chain:limbChain(f.joints,name),scale:2});
function solve(s,target){let result;for(let i=0;i<100;i++){result=s.step(new T.Vector3(...target),{budgetMs:Infinity});if(result.reached||result.stalled)break;}return result;}

test('CCD reaches a target using only the picked limb and respects fixed-assembly branching',()=>{
  const f=fixture([{parent:'base',child:'torso',type:'revolute'}, {parent:'torso',child:'decor',type:'fixed'}, {parent:'decor',child:'left'}, {parent:'left',child:'elbow',xyz:[1,0,0]}, {parent:'elbow',child:'hand',type:'fixed',xyz:[1,0,0]}, {parent:'torso',child:'right'}]);
  assert.deepEqual(limbChain(f.joints,'hand').map(j=>j.name),['elbow','left']);
  const s=solverFor(f,'hand',[0,0,0]);const result=solve(s,[1,1,0]);
  assert.ok(result.reached,JSON.stringify(result));assert.equal(f.joints[0].theta,0);assert.equal(f.joints.at(-1).theta,0);
  assert.deepEqual(limbChain(f.joints,'base'),[]);
});

test('transformed joint axes, off-origin picked points, and prismatic limits work',()=>{
  const f=fixture([{parent:'base',child:'arm',axis:[0,0,2],rpy:[Math.PI/2,0,0],xyz:[0,0,1]}, {parent:'arm',child:'tip',type:'prismatic',axis:[1,0,0],lower:0,upper:.5}]);
  const s=solverFor(f,'tip');assert.ok(solve(s,[0,0,2.3]).reached);
  assert.ok(f.joints[1].theta>=0&&f.joints[1].theta<=.5);
  const start=s.values();s.restore([0,0]);assert.ok(solve(s,[0,0,5]).error>2);assert.ok(f.joints[1].theta<=.5);
  s.restore(start);assert.deepEqual(s.values(),start,'Cancel restores exact scalar values');
});

test('singular straight chains escape deterministically; unreachable targets remain bounded',()=>{
  const f=fixture([{parent:'base',child:'arm'}, {parent:'arm',child:'tip',xyz:[1,0,0]}]);
  const s=solverFor(f,'tip');assert.ok(solve(s,[1.4,0,0]).reached,'Straight arm bends for an inward target');
  const result=solve(s,[20,0,0]);assert.ok(result.error>=17.99);assert.ok(s.values().every(Number.isFinite));
  const constrained=fixture([{parent:'base',child:'arm',lower:0,upper:1.6},{parent:'arm',child:'tip',xyz:[1,0,0],lower:-2,upper:2}]);
  const alternative=solverFor(constrained,'tip',[.75,-.04,0]);const alternativeResult=solve(alternative,[1.5,.4,0]);assert.ok(alternativeResult.reached,JSON.stringify({...alternativeResult,seed:alternative.seed,values:alternative.values()}));
  const g=fixture([{parent:'base',child:'arm',lower:0,upper:.25}]);
  const limited=solverFor(g,'arm');const r=solve(limited,[0,1,0]);assert.ok(!r.reached);assert.ok(g.joints[0].theta>=0&&g.joints[0].theta<=.25);
});

test('continuous joints choose equivalent angles and unsupported chains fail clearly',()=>{
  const f=fixture([{parent:'base',child:'tip',type:'continuous'}]);const s=solverFor(f,'tip');assert.ok(solve(s,[-1,-.01,0]).reached);assert.ok(Math.abs(f.joints[0].theta)<=Math.PI);
  const g=fixture([{parent:'base',child:'tip',type:'planar'}]);assert.throws(()=>limbChain(g.joints,'tip'),/does not support planar/);
});
