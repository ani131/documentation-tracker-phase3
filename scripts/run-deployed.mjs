import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const argument=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
const origin='https://documentation-tracker-ani131.hazyrobin67.chatgpt.site';
const system=argument('--system-url',process.env.BASE_URL??origin+'/system').replace(/\/$/,'');
const tester=argument('--tester-url',process.env.TESTER_URL??origin+'/tester').replace(/\/$/,'');
const output=argument('--output','docs/evidence/deployed-run.json');
const post=async(url,data)=>{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(300000)});
  return {status:response.status,body:await response.json()};
};
const started=new Date().toISOString();
const setup=await post(tester+'/test/setup',{target_url:system});
if(setup.status!==201)throw new Error('Setup failed: '+JSON.stringify(setup));
const session_id=setup.body.session_id;
let result;
try{result=await post(tester+'/test/run',{session_id});}
catch{console.log('Run response lost; retrieving stored report without repeating the run.');}
if(!result||result.status===500){
  for(let attempt=0;attempt<60;attempt++){
    const r=await fetch(tester+'/test/report?session_id='+encodeURIComponent(session_id),{signal:AbortSignal.timeout(15000)});
    if(r.status===409){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
    result={status:r.status,body:await r.json()};break;
  }
}
if(result?.status!==200||!Array.isArray(result.body.results))throw new Error('No complete tester report: '+JSON.stringify(result));
const health=await fetch(new URL('/health',tester)).then(r=>r.json());
const metrics=await fetch(system+'/metrics').then(r=>r.json());
const saved={started_at:started,finished_at:new Date().toISOString(),version:health.release,health,setup,response_status:result.status,report:result.body,metrics};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(saved,null,2)+'\n');
const counts=Object.fromEntries(['pass','fail','error','skip'].map(k=>[k,result.body.results.filter(t=>t.outcome===k).length]));
console.log(JSON.stringify({session_id,version:health.release,tests:result.body.results.length,...counts,output},null,2));
if(counts.fail||counts.error||counts.skip)process.exitCode=1;
