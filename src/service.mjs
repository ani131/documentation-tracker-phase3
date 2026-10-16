import { VERSION, Store, Fault, invalid, keys, sessionId, readBody, analyze, ID } from './analysis.mjs';
import { emptyCode, targetUrl, callTarget, req, runSuite } from './tester.mjs';
import { openapi } from './spec.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function handle(request,env,fetcher=fetch){
  const start=Date.now();const store=new Store(env);const url=new URL(request.url);const p=url.pathname.replace(/\/$/,'');
  const tester=p.startsWith('/tester/');const source=tester?'tester':'system';
  try{
    if(request.method==='GET'&&p==='/health')return json({status:'ok',tool_version:VERSION,release:env.RELEASE_SHA??'development',storage:env.DB&&env.BUCKET?'configured':'missing'});
    if(request.method==='GET'&&p==='/system/openapi.json')return json(openapi('system'));
    if(request.method==='GET'&&p==='/tester/openapi.json')return json(openapi('tester'));
    if(request.method==='GET'&&p==='/system/metrics')return json(await store.metrics());
    if(request.method==='POST'&&p==='/system/test/setup'){
      const d=await readBody(request);keys(d,['session_id','setup']);const id=sessionId(d.session_id);
      if(!d.setup||typeof d.setup!=='object'||Array.isArray(d.setup)||Object.keys(d.setup).length)invalid('setup must be an empty object; fixtures need no reset.');
      if(!await store.insert('system:'+id,{session_id:id,created_at:new Date().toISOString()}))throw new Fault(409,'SESSION_EXISTS','Session ID already exists.');
      return json({session_id:id},201);
    }
    if(request.method==='GET'&&p==='/system/test/report'){
      const id=sessionId(url.searchParams.get('session_id'));if(!await store.get('system:'+id))throw new Fault(404,'SESSION_NOT_FOUND','Unknown system session.');
      return json({session_id:id,coverage:{code:emptyCode()}});
    }
    if(request.method==='POST'&&(p==='/system/analyze'||p==='/analyze')){
      const id=request.headers.get('X-Test-Session');if(id!==null&&!await store.get('system:'+sessionId(id)))throw new Fault(404,'SESSION_NOT_FOUND','Unknown system session.');
      const result=await analyze(await readBody(request),store,fetcher);
      await store.event('analysis_completed',result.status,Date.now()-start,result.analysis_id).catch(()=>{});return json(result);
    }
    if(request.method==='GET'&&(p.startsWith('/system/analysis/')||p.startsWith('/analysis/'))){
      const id=p.split('/').at(-1);if(!ID.test(id))invalid('Invalid analysis ID.');const result=await store.result(id);
      if(!result)throw new Fault(404,'ANALYSIS_NOT_FOUND','Analysis ID was not found.');return json(result);
    }
    if(request.method==='POST'&&p==='/tester/test/setup'){
      const d=await readBody(request);keys(d,['target_url']);const target=targetUrl(d.target_url,request,env);const id=crypto.randomUUID();
      const r=await callTarget(target,'/test/setup',req({session_id:id,setup:{}}),fetcher);
      if(r.status!==201){
        if(r.value&&typeof r.value.message==='string'&&r.value.message&&['system','tester','communication','unknown'].includes(r.value.source))return json(r.value,r.status>=400&&r.status<=599?r.status:500);
        throw new Fault(500,'SETUP_FAILED','Target setup returned an invalid response.','system');
      }
      if(r.value?.session_id!==id)throw new Fault(500,'SETUP_FAILED','Target setup did not return the supplied session ID.','system');
      if(!await store.insert('tester:'+id,{session_id:id,target_url:target,created_at:new Date().toISOString()}))throw new Fault(500,'SETUP_FAILED','Tester session could not be saved.','tester');
      return json({session_id:id},201);
    }
    if(request.method==='GET'&&p==='/tester/test/report'){
      const id=sessionId(url.searchParams.get('session_id'));const s=await store.get('tester:'+id);
      if(!s)throw new Fault(404,'SESSION_NOT_FOUND','Unknown tester session.','tester');
      if(!['completed','aborted'].includes(s._state))throw new Fault(409,'REPORT_NOT_READY','Suite has not ended.','tester');return json(s.report);
    }
    if(request.method==='POST'&&p==='/tester/test/run'){
      const d=await readBody(request);keys(d,['session_id']);const id=sessionId(d.session_id);const key='tester:'+id;const s=await store.get(key);
      if(!s)throw new Fault(404,'SESSION_NOT_FOUND','Unknown tester session.','tester');
      const session={session_id:s.session_id,target_url:s.target_url,created_at:s.created_at};
      if(!await store.transition(key,'ready','running',session))throw new Fault(409,'RUN_CONFLICT','This session has already started its one allowed suite.','tester');
      const {report,aborted}=await runSuite(session,fetcher);
      if(!await store.transition(key,'running',aborted?'aborted':'completed',{...session,report}))throw new Fault(500,'STORAGE_FAILED','Tester report could not be saved.','tester');
      if(aborted)throw new Fault(500,'TESTER_ABORTED','Tester aborted; retrieve recorded results through /test/report.','tester');return json(report);
    }
    throw new Fault(404,'NOT_FOUND','Endpoint was not found.',source);
  }catch(error){
    const f=error instanceof Fault?error:new Fault(500,'INTERNAL_ERROR','The operation could not be completed.',source);
    await store.event(f.code,f.status,Date.now()-start).catch(()=>{});
    return json({code:f.code,message:f.message,source:tester&&f.code==='INVALID_REQUEST'?'tester':f.source},f.status);
  }
}
