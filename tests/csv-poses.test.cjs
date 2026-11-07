const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
let appendPose,parse;
before(async()=>{
  ({appendPose}=await import('../frontend/csv-poses.js'));
  const context=vm.createContext({});vm.runInContext(fs.readFileSync('lib/CSVToArray.js','utf8'),context);
  parse=context.CSVToArray;
});
const values=()=>new Map([['arm',.5],['slide',.2]]);

test('empty CSV starts a table; subsequent captures append without replacing header or first pose',()=>{
  const first=appendPose('',values(),parse);assert.equal(first,'time,arm,slide\n0,0.5,0.2\n');
  const next=appendPose(first,new Map([['arm',.7],['slide',.4]]),parse);
  assert.equal(next,first+'0.06,0.7,0.4\n');
  const third=appendPose(next,values(),parse);assert.ok(third.startsWith(next));assert.equal(third.split('\n').at(-2),'0.12,0.5,0.2');
});

test('current headers control column subset/order, timed and untimed rows, header-only CSV and line endings',()=>{
  assert.equal(appendPose('time,slide,arm\n2,0,1',values(),parse),'time,slide,arm\n2,0,1\n2.06,0.2,0.5\n');
  assert.equal(appendPose('slide,arm\n0,1\n',values(),parse),'slide,arm\n0,1\n0.2,0.5\n');
  assert.equal(appendPose('time,slide',values(),parse),'time,slide\n0,0.2\n');
  assert.equal(appendPose('arm\n',values(),parse),'arm\n0.5\n');
  const crlf='time,arm\r\n4,1\r\n';assert.equal(appendPose(crlf,values(),parse),crlf+'4.06,0.5\r\n');
  assert.equal(appendPose('time,arm\n5,1\n2,0\n\n',values(),parse),'time,arm\n5,1\n2,0\n5.06,0.5\n');
});

test('quoted headers are kept or escaped and invalid CSV is rejected',()=>{
  const quoted=new Map([['arm,twist',.3]]);assert.equal(appendPose('',quoted,parse),'time,"arm,twist"\n0,0.3\n');
  const text='time,"arm,twist"\n0,0.4\n';assert.equal(appendPose(text,quoted,parse),text+'0.06,0.3\n');
  for(const text of ['time,arm\n0\n','arm,arm\n0,1\n','time,arm\n-1,0\n','time,arm\n0,no\n'])assert.throws(()=>appendPose(text,values(),parse),/Check the CSV/);
  assert.throws(()=>appendPose('time,missing\n0,0\n',values(),parse),/Unknown or fixed/);
  assert.throws(()=>appendPose('time',values(),parse),/at least one/);
});
