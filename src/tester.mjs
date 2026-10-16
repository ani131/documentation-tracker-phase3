import fixture from '../fixtures/manifest.json' with { type:'json' };
import { Fault, invalid, SHA } from './analysis.mjs';
export const emptyCode = () => ({covered:null,total:null,basis:'Per-session source-line instrumentation is unavailable; local test coverage is separate.'});
export const PLAN = [
  ['T-01','Exact addition/modification/deletion/category set','AC-01'],
  ['T-02','Retrieve immutable saved result','AC-06'],
  ['T-03','Default base is first parent','AC-01'],
  ['T-04','Missing commit is rejected','AC-07'],
  ['T-05','Malformed JSON is rejected','AC-07'],
  ['T-06','Repository without owner is rejected','AC-07'],
  ['T-07','Incorrect field type is rejected','AC-07'],
  ['T-08','Invalid base commit is rejected','AC-07'],
  ['T-09','Nonexistent repository returns 404','AC-08'],
  ['T-10','Nonexistent commit returns 404','AC-08'],
  ['T-11','Unknown analysis returns 404','AC-08'],
  ['T-12','Five equivalent runs have identical significant output','AC-10'],
  ['T-13','Identical commits have no changes','AC-01'],
  ['T-14','New analysis IDs preserve prior evidence','AC-06'],
];
export function targetUrl(value, request, env) {
  if(typeof value!=='string'||value.length>500) invalid('target_url is required.');
  let url;try{url=new URL(value);}catch{invalid('target_url must be an absolute URL.');}
  if(url.search||url.hash||url.username||url.password||/\/test\/?$/.test(url.pathname)) invalid('target_url must be a base URL without credentials, query, fragment or /test suffix.');
  if(url.protocol!=='https:'&&!(env.LOCAL_TEST==='1'&&url.protocol==='http:')) invalid('target_url must use HTTPS.');
  const base=url.href.replace(/\/$/,'');
  const allowed=[new URL(request.url).origin+'/system',...(env.APPROVED_TARGETS??'').split(',').map(x=>x.trim()).filter(Boolean)];
  if(!allowed.includes(base)) throw new Fault(400,'TARGET_NOT_APPROVED','Target is not an approved pod system URL; ask the owner to add it.','tester');
  return base;
}
export async function callTarget(target,path,options,fetcher,timeout=55000) {
  try {
    const response=await fetcher(target+path,{...options,signal:AbortSignal.timeout(timeout),redirect:'manual'});
    let value;try{value=await response.json();}catch{return {status:response.status,value:null};}
    return {status:response.status,value};
  } catch {throw new Fault(500,'COMMUNICATION_FAILED','No target response was available within 55 seconds.','communication');}
}
export const req=data=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
export function resultShape(r) {
  return r&&typeof r.analysis_id==='string'&&r.analysis_id.length>0&&typeof r.repository==='string'&&typeof r.configuration_version==='string'&&typeof r.tool_version==='string'&&typeof r.created_at==='string'&&Number.isFinite(Date.parse(r.created_at))&&SHA.test(r.head_commit??'')&&(r.base_commit===null||SHA.test(r.base_commit??''))&&['SUCCESS','ERROR'].includes(r.status)&&Array.isArray(r.changes)&&r.changes.every(c=>c&&typeof c.path==='string'&&['ADDED','MODIFIED','DELETED'].includes(c.change_type)&&['IMPLEMENTATION','DESIGN','ARCHITECTURE','SPECIFICATION','REQUIREMENT','OTHER'].includes(c.category))&&Array.isArray(r.issues)&&Array.isArray(r.skipped)&&Object.hasOwn(r,'error');
}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const significant=r=>({repository:r.repository,head_commit:r.head_commit,base_commit:r.base_commit,configuration_version:r.configuration_version,tool_version:r.tool_version,status:r.status,changes:r.changes,issues:r.issues,skipped:r.skipped,error:r.error});
function sameChanges(a,b) {
  const ordered=x=>[...x].map(v=>({path:v.path,change_type:v.change_type,category:v.category})).sort((x,y)=>x.path.localeCompare(y.path));
  return equal(ordered(a),ordered(b));
}
export async function runSuite(session,fetcher) {
  const results=[];const shared={};let aborted=false;
  const deadline=Date.now()+180000;
  const call=(path,options={})=>{
    const remaining=deadline-Date.now();
    if(remaining<=0)throw new Fault(500,'TESTER_TIMEOUT','Suite execution budget exceeded.','tester');
    return callTarget(session.target_url,path,{...options,headers:{...options.headers,'X-Test-Session':session.session_id}},fetcher,Math.min(55000,remaining));
  };
  const expect=(r,status,check)=>{
    if(r.status>=500) throw new Fault(500,'TARGET_FAILURE','Target returned an unexpected server error.','system');
    return r.status===status&&check(r.value);
  };
  const input={repository:fixture.repository,commit_id:fixture.commit_id,base_commit:fixture.base_commit};
  const invalidCase=async data=>expect(await call('/analyze',req(data)),400,b=>b?.code==='INVALID_REQUEST'&&typeof b.message==='string'&&b.message.length>0);
  const cases=[
    async()=>{const r=await call('/analyze',req(input));shared.first=r.value;return expect(r,200,b=>resultShape(b)&&b.status==='SUCCESS'&&sameChanges(b.changes,fixture.expected_changes));},
    async()=>{if(!shared.first?.analysis_id) throw new Fault(500,'DEPENDENCY','No saved ID available.','system');return expect(await call('/analysis/'+encodeURIComponent(shared.first.analysis_id)),200,b=>equal(b,shared.first));},
    async()=>expect(await call('/analyze',req({repository:fixture.repository,commit_id:fixture.commit_id})),200,b=>resultShape(b)&&b.base_commit===fixture.base_commit&&sameChanges(b.changes,fixture.expected_changes)),
    ()=>invalidCase({repository:fixture.repository}),
    async()=>expect(await call('/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'}),400,b=>b?.code==='INVALID_REQUEST'&&!!b.message),
    ()=>invalidCase({repository:'without-owner',commit_id:fixture.commit_id}),
    ()=>invalidCase({repository:fixture.repository,commit_id:123}),
    ()=>invalidCase({...input,base_commit:123}),
    async()=>expect(await call('/analyze',req({...input,repository:'ani131/does-not-exist-documentation-tracker-fixture'})),404,b=>b?.code==='RESOURCE_NOT_FOUND'&&!!b.message),
    async()=>expect(await call('/analyze',req({...input,commit_id:'0000000000000000000000000000000000000000'})),404,b=>b?.code==='RESOURCE_NOT_FOUND'&&!!b.message),
    async()=>expect(await call('/analysis/00000000-0000-0000-0000-000000000000'),404,b=>b?.code==='ANALYSIS_NOT_FOUND'&&!!b.message),
    async()=>{
      const runs=[];
      for(let i=0;i<5;i++){const r=await call('/analyze',req(input));if(!expect(r,200,b=>resultShape(b)&&b.status==='SUCCESS'))return false;runs.push(r.value);}
      shared.repeated=runs;return new Set(runs.map(r=>r.analysis_id)).size===5&&runs.every(r=>equal(significant(r),significant(runs[0])));
    },
    async()=>expect(await call('/analyze',req({...input,base_commit:fixture.commit_id})),200,b=>resultShape(b)&&b.status==='SUCCESS'&&b.changes.length===0),
    async()=>{
      if(!shared.first?.analysis_id||!shared.repeated?.length)throw new Fault(500,'DEPENDENCY','Prior results unavailable.','system');
      const a=await call('/analysis/'+shared.first.analysis_id);const last=shared.repeated.at(-1);const b=await call('/analysis/'+last.analysis_id);
      return expect(a,200,v=>equal(v,shared.first))&&expect(b,200,v=>equal(v,last))&&shared.first.analysis_id!==last.analysis_id;
    },
  ];
  const suiteStart=Date.now();
  for(let i=0;i<PLAN.length;i++){
    const [id,name]=PLAN[i];
    if(aborted){results.push({test_id:id,outcome:'skip',message:'Not executed because the tester aborted.'});continue;}
    if(Date.now()-suiteStart>180000){results.push({test_id:id,outcome:'error',source:'tester',message:'Suite exceeded its 180 second execution budget.'});aborted=true;continue;}
    try{const pass=await cases[i]();results.push({test_id:id,outcome:pass?'pass':'fail',message:name+(pass?': expected behavior observed.':': response differed from the fixture or contract.')});}
    catch(error){const source=error instanceof Fault?error.source:'tester';results.push({test_id:id,outcome:'error',source,message:error instanceof Fault?error.message:'Tester could not evaluate this operation.'});if(source==='tester')aborted=true;}
  }
  let code=emptyCode();
  try{const response=await call('/test/report?session_id='+encodeURIComponent(session.session_id));const c=response.value?.coverage?.code;
    if(response.status===200&&c&&typeof c.basis==='string'&&c.basis.length&&((c.covered===null&&c.total===null)||(Number.isInteger(c.covered)&&Number.isInteger(c.total)&&c.covered>=0&&c.total>=c.covered)))code=c;
    else code={covered:null,total:null,basis:'Target did not return valid code coverage.'};
  }catch{code={covered:null,total:null,basis:'Target coverage report could not be reached.'};}
  const evaluable=id=>results.some(r=>r.test_id===id&&['pass','fail'].includes(r.outcome));
  const covered=[['T-01','T-03','T-13'],['T-04','T-05','T-06','T-07','T-08'],['T-12']].filter(ids=>ids.every(evaluable)).length;
  return {aborted,report:{session_id:session.session_id,target_url:session.target_url,results,coverage:{code,
    component:{covered:null,total:null,basis:'Phase 2 supplies no agreed component inventory or exercise rule. Proposed components await pod approval.'},
    system:{covered,total:10,basis:'Full AC-01, AC-07 and AC-10 exercised by evaluable calls. AC-06 retrieval and AC-08 missing-resource checks are partial and excluded. Coverage describes execution, not passing results.'}}}};
}
