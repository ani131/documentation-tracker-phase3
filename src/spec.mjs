const text={type:'string',minLength:1};
const session={type:'object',required:['session_id'],additionalProperties:false,properties:{session_id:{...text,pattern:'^[A-Za-z0-9_-]{1,80}$'}}};
const error={type:'object',required:['code','message','source'],properties:{code:text,message:text,source:{enum:['tester','system','communication','unknown']}}};
const coverageEntry={type:'object',required:['covered','total','basis'],properties:{covered:{type:['integer','null'],minimum:0},total:{type:['integer','null'],minimum:0},basis:text}};
const request={type:'object',required:['repository','commit_id'],additionalProperties:false,properties:{repository:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]{1,100}$'},commit_id:{type:'string',pattern:'^[a-fA-F0-9]{7,40}$'},base_commit:{type:'string',pattern:'^[a-fA-F0-9]{7,40}$'}}};
const result={type:'object',required:['analysis_id','repository','head_commit','base_commit','configuration_version','tool_version','created_at','status','changes','issues','skipped','error'],properties:{analysis_id:text,repository:text,head_commit:text,base_commit:{type:['string','null']},configuration_version:text,tool_version:text,created_at:{type:'string',format:'date-time'},status:{enum:['SUCCESS','ERROR']},changes:{type:'array',items:{type:'object',required:['path','change_type','category'],additionalProperties:false,properties:{path:text,change_type:{enum:['ADDED','MODIFIED','DELETED']},category:{enum:['IMPLEMENTATION','DESIGN','ARCHITECTURE','SPECIFICATION','REQUIREMENT','OTHER']}}}},issues:{type:'array',maxItems:0,items:{type:'object'}},skipped:{type:'array',items:{type:'object',required:['path','reason'],properties:{path:text,reason:text}}},error:{anyOf:[{type:'null'},{type:'object',required:['code','message'],properties:{code:text,message:text}}]}}};
const report={type:'object',required:['session_id','target_url','results','coverage'],properties:{session_id:text,target_url:{type:'string',format:'uri'},results:{type:'array',items:{type:'object',required:['test_id','outcome','message'],properties:{test_id:text,outcome:{enum:['pass','fail','error','skip']},message:text,source:{enum:['tester','system','communication','unknown']}},allOf:[{if:{properties:{outcome:{const:'error'}}},then:{required:['source']}}]}},coverage:{type:'object',required:['code','component','system'],properties:{code:coverageEntry,component:coverageEntry,system:coverageEntry}}}};
const response=schema=>({description:'Response',content:{'application/json':{schema}}});
function op(summary,input,success,schema,errors=[400,404,409,500]){
  return {summary,...(input?{requestBody:{required:true,content:{'application/json':{schema:input}}}}:{}),responses:{[success]:response(schema),...Object.fromEntries(errors.map(c=>[c,response(error)]))}};
}
const query={in:'query',name:'session_id',required:true,schema:session.properties.session_id};
export function openapi(kind){
  const paths=kind==='tester'?{
    '/test/setup':{post:op('Create a session; prepare the approved target without running tests',{type:'object',required:['target_url'],additionalProperties:false,properties:{target_url:{type:'string',format:'uri'}}},201,session)},
    '/test/run':{post:op('Run one complete suite exactly once per session',session,200,report)},
    '/test/report':{get:{...op('Read stored report without running tests',null,200,report),parameters:[query]}},
  }:{
    '/analyze':{post:{...op('Resolve public GitHub commits, classify changes and save immutable JSON evidence',request,200,result,[400,404,500]),parameters:[{in:'header',name:'X-Test-Session',required:false,schema:session.properties.session_id}]}},
    '/analysis/{analysis_id}':{get:{...op('Retrieve original saved result',null,200,result,[400,404,500]),parameters:[{in:'path',name:'analysis_id',required:true,schema:text}]}},
    '/test/setup':{post:op('Register supplied session; no fixture mutation or reset',{type:'object',required:['session_id','setup'],additionalProperties:false,properties:{session_id:session.properties.session_id,setup:{type:'object',maxProperties:0}}},201,session)},
    '/test/report':{get:{...op('Return per-session code coverage availability',null,200,{type:'object',required:['session_id','coverage'],properties:{session_id:text,coverage:{type:'object',required:['code'],properties:{code:coverageEntry}}}}),parameters:[query]}},
  };
  return {openapi:'3.1.1',info:{title:`Documentation Tracker ${kind}`,version:'3.0.0',description:'Phase 3 implementation contract based on Phase 2 v1 and the course testing interface. Clarifications await pod agreement; this is not evidence of approval.'},servers:[{url:kind==='tester'?'/tester':'/system'}],paths};
}
