import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../fixtures/manifest.json' with {type:'json'};
import { classify, normalize, Store } from '../src/analysis.mjs';
import { openapi } from '../src/spec.mjs';
import { handle } from '../src/service.mjs';
import { PLAN } from '../src/tester.mjs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { environment, githubMock, network, call, input } from './helpers.mjs';

test('AC-01: classify all categories with directory precedence',()=>{
  const expected={'requirements/model.py':'REQUIREMENT','spec/api.py':'SPECIFICATION','architecture/a.py':'ARCHITECTURE','design/a.ts':'DESIGN','src/a.py':'IMPLEMENTATION','docs/a.md':'OTHER'};
  for(const [path,category]of Object.entries(expected))assert.equal(classify(path),category);
});
test('AC-01: normalize rename and copy without dropping old paths',()=>{
  assert.deepEqual(normalize([{filename:'src/new.py',previous_filename:'src/old.py',status:'renamed'},{filename:'z.py',status:'copied'}]),[
    {path:'src/new.py',change_type:'ADDED',category:'IMPLEMENTATION'},
    {path:'src/old.py',change_type:'DELETED',category:'IMPLEMENTATION'},
    {path:'z.py',change_type:'ADDED',category:'IMPLEMENTATION'}]);
  assert.throws(()=>normalize([{filename:'a',status:'mystery'}]));
  assert.throws(()=>normalize([{filename:'a',status:'renamed'}]));
});
test('AC-01/AC-06: exact fixture result, retrieval and recreated application store',async()=>{
  const {env,objects}=environment();const r=await call(env,'/system/analyze',input);
  assert.equal(r.status,200);assert.equal(r.body.status,'SUCCESS');assert.deepEqual(r.body.changes,fixture.expected_changes);
  assert.equal(r.body.head_commit,fixture.commit_id);assert.equal(r.body.base_commit,fixture.base_commit);
  assert.deepEqual((await call(env,'/system/analysis/'+r.body.analysis_id)).body,r.body);
  assert.deepEqual(await new Store({...env}).result(r.body.analysis_id),r.body);
  const r2=await call(env,'/system/analyze',input);assert.notEqual(r.body.analysis_id,r2.body.analysis_id);assert.equal(objects.size,2);
  assert.deepEqual((await call(env,'/system/analysis/'+r.body.analysis_id)).body,r.body);
});
test('AC-01: first-parent default, root commit and identical commit boundaries',async()=>{
  const {env}=environment();
  const first=await call(env,'/system/analyze',{repository:input.repository,commit_id:input.commit_id});assert.equal(first.body.base_commit,input.base_commit);
  const root=await call(env,'/system/analyze',{repository:input.repository,commit_id:input.base_commit});assert.equal(root.body.base_commit,null);assert.equal(root.body.changes[0].change_type,'ADDED');
  const same=await call(env,'/system/analyze',{...input,base_commit:input.commit_id});assert.deepEqual(same.body.changes,[]);
});
for(const [name,bad]of Object.entries({missing:{repository:input.repository},malformed:'{bad',repository:{...input,repository:'bad'},type:{...input,commit_id:3},base:{...input,base_commit:false},extra:{...input,command:'rm'},array:'[]',null:'null',oversize:' '.repeat(17000)})){
  test('AC-07: reject '+name,async()=>{const {env}=environment();const r=await call(env,'/system/analyze',bad);assert.equal(r.status,400);assert.equal(r.body.code,'INVALID_REQUEST');assert.ok(r.body.message);});
}
test('AC-07: unsupported Content-Type rejected',async()=>{const {env}=environment();assert.equal((await handle(new Request('https://local.test/system/analyze',{method:'POST',body:'{}'}),env)).status,400);});
test('AC-08: nonexistent repo, commit and saved analysis return explicit 404',async()=>{
  const {env}=environment();
  for(const data of [{...input,repository:'ani131/does-not-exist'},{...input,commit_id:'0'.repeat(40)}])assert.equal((await call(env,'/system/analyze',data)).status,404);
  assert.equal((await call(env,'/system/analysis/missing')).body.code,'ANALYSIS_NOT_FOUND');
});
test('AC-08: incomplete comparison is saved as ERROR; no false success',async()=>{
  for(const overrides of [{files:Array.from({length:300},()=>({filename:'a.py',status:'added'}))},{link:true},{comparisonStatus:'diverged'}]){
    const {env}=environment();const r=await call(env,'/system/analyze',input,network(env,githubMock(overrides)));
    assert.equal(r.status,200);assert.equal(r.body.status,'ERROR');assert.ok(r.body.skipped.length);assert.equal(r.body.error.code,'INCOMPLETE_CHECK');
    assert.deepEqual((await call(env,'/system/analysis/'+r.body.analysis_id)).body,r.body);
  }
});
test('AC-08/AC-09: upstream errors are explicit and redact secret-bearing exceptions',async()=>{
  for(const overrides of [{throw:true},{status:403},{status:500},{private:true}]){
    const {env}=environment();const r=await call(env,'/system/analyze',input,network(env,githubMock(overrides)));
    assert.ok([404,500].includes(r.status));assert.ok(!JSON.stringify(r).includes('SECRET-DO-NOT-LEAK'));
  }
});
test('AC-08: failed evidence write returns 500 and cannot be retrieved',async()=>{
  const {env,objects}=environment();env.BUCKET.put=async()=>{throw new Error('secret');};
  const r=await call(env,'/system/analyze',input);assert.equal(r.status,500);assert.equal(r.body.code,'STORAGE_FAILED');assert.equal(objects.size,0);
});
test('AC-10: five runs are stable and use separate immutable objects',async()=>{
  const {env,objects}=environment();const all=[];
  for(let i=0;i<5;i++){const r=await call(env,'/system/analyze',input);assert.equal(r.status,200);const {analysis_id,created_at,...stable}=r.body;assert.ok(analysis_id);assert.ok(created_at);all.push(stable);}
  all.forEach(r=>assert.deepEqual(r,all[0]));assert.equal(objects.size,5);
});
test('AC-09: only fixed GitHub HTTPS GETs are made; scripts are metadata',async()=>{
  const {env}=environment();const urls=[];const mock=githubMock({files:[{filename:'scripts/execute.sh',status:'added'}]});
  const fetcher=async(url,options)=>{urls.push(url);assert.ok(url.startsWith('https://api.github.com/repos/'));assert.equal(options.method,undefined);assert.equal(options.redirect,'manual');return mock(url,options);};
  const r=await call(env,'/system/analyze',input,fetcher);assert.equal(r.body.changes[0].path,'scripts/execute.sh');assert.ok(urls.length);assert.deepEqual(r.body.issues,[]);
});
test('system sessions reject duplicates, invalid and unknown IDs',async()=>{
  const {env}=environment();assert.equal((await call(env,'/system/test/setup',{session_id:'test-1',setup:{}})).status,201);
  assert.equal((await call(env,'/system/test/setup',{session_id:'test-1',setup:{}})).status,409);
  assert.equal((await call(env,'/system/test/report?session_id=test-1')).body.coverage.code.covered,null);
  assert.equal((await call(env,'/system/test/report?session_id=unknown')).status,404);
  assert.equal((await call(env,'/system/test/report')).status,400);
  assert.equal((await call(env,'/system/test/setup',{session_id:'bad/id',setup:{}})).status,400);
  assert.equal((await call(env,'/system/test/setup',{session_id:'x',setup:{reset:true}})).status,400);
});
test('tester setup does not run tests; one complete run; immutable lookup and conflict',async()=>{
  const {env}=environment();const s=await call(env,'/tester/test/setup',{target_url:'https://local.test/system'});assert.equal(s.status,201);const id=s.body.session_id;
  assert.equal((await call(env,'/tester/test/report?session_id='+id)).status,409);
  const r=await call(env,'/tester/test/run',{session_id:id});assert.equal(r.status,200);
  assert.equal(r.body.results.length,PLAN.length);assert.ok(r.body.results.every(t=>t.outcome==='pass'),JSON.stringify(r.body));assert.equal(new Set(r.body.results.map(t=>t.test_id)).size,PLAN.length);
  assert.equal(r.body.coverage.code.covered,null);assert.equal(r.body.coverage.component.covered,null);assert.equal(r.body.coverage.system.total,10);
  assert.deepEqual((await call(env,'/tester/test/report?session_id='+id)).body,r.body);
  assert.equal((await call(env,'/tester/test/run',{session_id:id})).status,409);
});
test('tester run claims are atomic across simultaneous calls',async()=>{
  const {env}=environment();const s=await call(env,'/tester/test/setup',{target_url:'https://local.test/system'});
  const results=await Promise.all([call(env,'/tester/test/run',s.body),call(env,'/tester/test/run',s.body)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
test('tester rejects unapproved targets and SSRF, and unknown sessions',async()=>{
  const {env}=environment();for(const target_url of ['http://127.0.0.1/system','https://evil.example/system','https://local.test/system?secret=x','https://user:password@local.test/system'])assert.equal((await call(env,'/tester/test/setup',{target_url})).status,400);
  assert.equal((await call(env,'/tester/test/run',{session_id:'unknown'})).status,404);
  assert.equal((await call(env,'/tester/test/report?session_id=unknown')).status,404);
});
test('tester forwards system setup failure exactly and does not create runnable session',async()=>{
  const {env}=environment();const body={message:'Preparation failed.',source:'system'};
  const r=await call(env,'/tester/test/setup',{target_url:'https://local.test/system'},async()=>Response.json(body,{status:500}));
  assert.equal(r.status,500);assert.deepEqual(r.body,body);
  assert.equal(Number((await env.DB.prepare("SELECT COUNT(*) AS count FROM records WHERE key LIKE 'tester:%'").all()).results[0].count),0);
});
test('tester reports communication and unexpected system errors without mislabeling pass',async()=>{
  for(const mode of ['system','communication']){
    const {env}=environment();const s=await call(env,'/tester/test/setup',{target_url:'https://local.test/system'});
    const failing=async()=>{if(mode==='communication')throw new Error('timeout');return Response.json({message:'failure'},{status:500});};
    const r=await call(env,'/tester/test/run',s.body,failing);assert.equal(r.status,200);
    assert.equal(r.body.results[0].outcome,'error');assert.equal(r.body.results[0].source,mode);assert.equal(r.body.results.length,PLAN.length);
  }
});
test('tester abort retains all planned outcomes and never permits another run',async()=>{
  const {env}=environment();const s=await call(env,'/tester/test/setup',{target_url:'https://local.test/system'});
  const original=Date.now;const now=original();let reads=0;let r;
  Date.now=()=>now+(++reads>=4?200000:0);
  try{r=await call(env,'/tester/test/run',s.body);}finally{Date.now=original;}
  assert.equal(r.status,500);assert.equal(r.body.source,'tester');
  const saved=await call(env,'/tester/test/report?session_id='+s.body.session_id);
  assert.equal(saved.status,200);assert.equal(saved.body.results.length,PLAN.length);
  assert.equal(saved.body.results[0].outcome,'error');assert.equal(saved.body.results[0].source,'tester');
  assert.ok(saved.body.results.slice(1).every(t=>t.outcome==='skip'));
  assert.equal((await call(env,'/tester/test/run',s.body)).status,409);
});
test('actual observability endpoint contains durable, redacted operational evidence',async()=>{
  const {env}=environment();await call(env,'/system/analyze',input);const r=await call(env,'/system/metrics');
  assert.equal(r.status,200);assert.equal(r.body.recent[0].event,'analysis_completed');assert.equal(r.body.totals[0].count,1);
});
test('both OpenAPI documents include every required operation and defined schemas',()=>{
  for(const kind of ['system','tester']){
    const spec=openapi(kind);assert.equal(spec.openapi,'3.1.1');assert.ok(spec.paths['/test/setup']);assert.ok(spec.paths['/test/report']);
    for(const methods of Object.values(spec.paths))for(const op of Object.values(methods))for(const response of Object.values(op.responses))assert.ok(response.content['application/json'].schema.type);
  }
  assert.ok(openapi('system').paths['/analyze']);assert.ok(openapi('tester').paths['/test/run']);
});
test('contract schemas compile and validate actual success, error and tester reports',async()=>{
  const ajv=new Ajv2020({strict:false,allErrors:true});addFormats(ajv);
  for(const kind of ['system','tester'])for(const methods of Object.values(openapi(kind).paths))for(const op of Object.values(methods)){
    if(op.requestBody)ajv.compile(op.requestBody.content['application/json'].schema);
    for(const r of Object.values(op.responses))ajv.compile(r.content['application/json'].schema);
  }
  const {env}=environment();
  const validate=(kind,path,method,status,value)=>{
    const schema=openapi(kind).paths[path][method].responses[status].content['application/json'].schema;
    const check=ajv.compile(schema);assert.equal(check(value),true,JSON.stringify(check.errors));
  };
  const r=await call(env,'/system/analyze',input);validate('system','/analyze','post',200,r.body);
  const bad=await call(env,'/system/analyze',{});validate('system','/analyze','post',400,bad.body);
  const setup=await call(env,'/tester/test/setup',{target_url:'https://local.test/system'});validate('tester','/test/setup','post',201,setup.body);
  const report=await call(env,'/tester/test/run',setup.body);validate('tester','/test/run','post',200,report.body);
});
