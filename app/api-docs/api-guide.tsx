'use client';

import { useState } from 'react';
import Link from 'next/link';
import fixture from '../../fixtures/manifest.json';
import { openapi } from '../../src/spec.mjs';

const HOST = 'https://documentation-tracker-ani131.hazyrobin67.chatgpt.site';
const REPO = 'https://github.com/ani131/documentation-tracker-phase3';
type Service = 'system' | 'tester';
type Endpoint = { id:string; service:Service; method:'GET'|'POST'; path:string; title:string; description:string; note:string };
type Field = { type?:string|string[]; required?:string[]; properties?:Record<string,Field>; pattern?:string; maxProperties?:number };
type Operation = { requestBody?:{content:Record<string,{schema:Field}>}; parameters?:{name:string;in:string;required?:boolean;schema:Field}[]; responses:Record<string,unknown> };
type Spec = {paths:Record<string,Record<string,Operation>>};
const endpoints:Endpoint[] = [
  { id:'analyze',service:'system',method:'POST',path:'/analyze',title:'Analyze a repository',description:'Compare two public GitHub commits, classify changed files, and save the result as an immutable JSON record.',note:'If you omit base_commit, the first parent of the head commit is used. A root commit is compared with an empty tree. Phase 3 returns changes; documentation-warning detection is planned for Phase 4.' },
  { id:'retrieve',service:'system',method:'GET',path:'/analysis/{analysis_id}',title:'Retrieve a saved analysis',description:'Read the exact analysis record saved by an earlier request. This does not start a new analysis.',note:'Use analysis_id from a successful analyze response. The original record remains unchanged when later analyses run.' },
  { id:'system-setup',service:'system',method:'POST',path:'/test/setup',title:'Prepare a system session',description:'Register a unique session ID supplied by a tester or grader. The public fixture needs no starting data or reset.',note:'This prepares the session and returns 201. It does not run tests. Reusing a session ID returns 409; choose a new ID for each suite.' },
  { id:'system-report',service:'system',method:'GET',path:'/test/report',title:'Read system coverage',description:'Return the code-coverage information available for a prepared system session.',note:'Per-session code instrumentation is not installed. covered and total are null with an explanation; this does not mean zero coverage.' },
  { id:'tester-setup',service:'tester',method:'POST',path:'/test/setup',title:'Choose and prepare a target',description:'Create a fresh tester session and wait for the target system to finish setup. Use this first when running the suite.',note:'Our own system URL is approved. Before testing Team 15, the owner must add their exact system base URL to APPROVED_TARGETS. No test-code edits are needed.' },
  { id:'tester-run',service:'tester',method:'POST',path:'/test/run',title:'Run the acceptance suite',description:'Run the 14-test sequence once against the target chosen during setup. The response includes outcomes and coverage.',note:'Allow up to 300 seconds. Each session permits one run, including an aborted run. After a timeout or lost response, retrieve the report instead of sending this request again.' },
  { id:'tester-report',service:'tester',method:'GET',path:'/test/report',title:'Retrieve a test report',description:'Read a stored suite report after completion, an aborted run, or a lost run response. This never repeats tests.',note:'409 means the suite has not ended yet; check this report endpoint again later. 404 means the session is unknown.' },
];

const descriptions:Record<string,string> = {
  repository:'Public GitHub repository in owner/name format.',
  commit_id:'Head commit to analyze: 7–40 hexadecimal characters; use a full 40-character SHA for repeatable tests.',
  base_commit:'Commit to compare against. Omit to use the first parent.',
  session_id:'Unique session ID. Use the ID returned by tester setup for tester run/report.',
  setup:'An empty object {}. No fixture mutation or destructive reset is needed.',
  target_url:'Approved system base URL, ending in /system for our service. Do not append /test.',
  analysis_id:'ID returned by a prior analysis request.',
  'X-Test-Session':'Optional prepared system session ID for project requests.',
};
const statuses:Record<string,string> = {
  '200':'Result or report returned. A completed tester report may still contain failed tests.',
  '201':'Setup finished; the returned session ID is ready.',
  '400':'Invalid request, malformed JSON, or a target URL that has not been approved.',
  '404':'Repository, commit, saved analysis, or session was not found.',
  '409':'Duplicate session, run already started, or report not ready.',
  '500':'Upstream/storage failure, service error, or tester abort. Read message and source.',
};
function example(id:string,session:string,analysis:string):Record<string,unknown> {
  if(id==='analyze')return {repository:fixture.repository,commit_id:fixture.commit_id,base_commit:fixture.base_commit};
  if(id==='system-setup')return {session_id:session||'choose-a-new-session-id',setup:{}};
  if(id==='tester-setup')return {target_url:HOST+'/system'};
  if(id==='tester-run')return {session_id:session||'paste-session-id-from-setup'};
  if(id==='retrieve')return {analysis_id:analysis||'paste-analysis-id'};
  return {session_id:session||'paste-session-id-from-setup'};
}
function responseExample(id:string) {
  if(id==='analyze'||id==='retrieve')return {analysis_id:'<returned-uuid>',repository:fixture.repository,head_commit:fixture.commit_id,base_commit:fixture.base_commit,configuration_version:'classification-v1',tool_version:'3.0.0',created_at:'<ISO-8601-timestamp>',status:'SUCCESS',changes:fixture.expected_changes,issues:[],skipped:[],error:null};
  if(id.endsWith('setup'))return {session_id:'<returned-or-supplied-session-id>'};
  const code={covered:null,total:null,basis:'Per-session source-line instrumentation is unavailable; local test coverage is separate.'};
  if(id==='system-report')return {session_id:'<session-id>',coverage:{code}};
  return {session_id:'<session-id>',target_url:HOST+'/system',results:[{test_id:'T-01',outcome:'pass',message:'Exact addition/modification/deletion/category set: expected behavior observed.'}],coverage:{code,component:{covered:null,total:null,basis:'Pod component inventory and exercise rules await agreement.'},system:{covered:3,total:10,basis:'Full AC-01, AC-07 and AC-10 exercised; other checks are partial or deferred.'}}};
}
const pretty=(data:unknown)=>JSON.stringify(data,null,2);

export default function ApiGuide(){
  const [selected,setSelected]=useState('analyze');
  const [search,setSearch]=useState('');
  const [draft,setDraft]=useState(pretty(example('analyze','','')));
  const [session,setSession]=useState('');
  const [analysis,setAnalysis]=useState('');
  const [lookup,setLookup]=useState('');
  const [busy,setBusy]=useState(false);
  const [response,setResponse]=useState('No request sent yet. The example below is illustrative; actual responses appear here after you send a request.');
  const [status,setStatus]=useState<number|null>(null);
  const [notice,setNotice]=useState('');
  const endpoint=endpoints.find(e=>e.id===selected)!;
  const spec=openapi(endpoint.service) as unknown as Spec;
  const operation=spec.paths[endpoint.path][endpoint.method.toLowerCase()];
  const bodySchema=operation.requestBody?.content['application/json'].schema;
  const visible=endpoints.filter(e=>(e.title+' '+e.path+' '+e.service).toLowerCase().includes(search.toLowerCase()));
  const fields=bodySchema?Object.entries(bodySchema.properties??{}).map(([name,schema])=>({name,schema,required:bodySchema.required?.includes(name),where:'body'})):(operation.parameters??[]).map(p=>({name:p.name,schema:p.schema,required:p.required,where:p.in}));
  const relativePath=endpoint.path.includes('{analysis_id}')?`/system/analysis/${encodeURIComponent(lookup||'<analysis_id>')}`:`/${endpoint.service}${endpoint.path}`+(endpoint.method==='GET'?`?session_id=${encodeURIComponent(lookup||'<session_id>')}`:'');
  const quoteShell=(value:string)=>"'"+value.replace(/'/g,"'\\''")+"'";
  const curl=`curl --request ${endpoint.method} ${quoteShell(HOST+relativePath)}`+(endpoint.method==='POST'?` \\\n  --header 'Content-Type: application/json' \\\n  --data ${quoteShell(draft)}`:'');
  function select(id:string){
    const fresh=id==='system-setup'?crypto.randomUUID():session;
    setSelected(id);setDraft(pretty(example(id,fresh,analysis)));setLookup(id==='retrieve'?analysis:session);setStatus(null);setResponse('No request sent for this endpoint yet.');setNotice('');
  }
  async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice('Copied to clipboard.');}catch{setNotice('Clipboard is unavailable. Select the example and copy it manually.');}}
  async function send(){
    setNotice('');
    if(endpoint.method==='POST'){try{JSON.parse(draft);}catch{setNotice('Enter valid JSON before sending.');return;}}
    if(endpoint.method==='GET'&&!lookup.trim()){setNotice('Paste the ID from the preceding setup or analysis response.');return;}
    setBusy(true);setStatus(null);setResponse(endpoint.id==='tester-run'?'Running the suite. Keep the session ID; retrieve its report if the response is lost.':'Sending request...');
    try{
      const result=await fetch(relativePath,{method:endpoint.method,...(endpoint.method==='POST'?{headers:{'Content-Type':'application/json'},body:draft}:{}),signal:AbortSignal.timeout(300000)});
      const text=await result.text();let data:Record<string,unknown>|undefined;
      try{data=JSON.parse(text) as Record<string,unknown>;setResponse(pretty(data));}catch{setResponse(text);}
      setStatus(result.status);
      if(result.ok&&typeof data?.session_id==='string'){setSession(data.session_id);setNotice('Session ID saved in this page. Choose the next endpoint to reuse it.');}
      if(result.ok&&typeof data?.analysis_id==='string'){setAnalysis(data.analysis_id);setNotice('Analysis ID saved in this page. Choose “Retrieve a saved analysis” to reuse it.');}
    }catch{setResponse(endpoint.id==='tester-run'?'No run response received. Do not send the run again. Choose “Retrieve a test report” with the same session ID; if it returns 409, retry that report lookup later.':'No response was received. Check your connection and the service availability.');}
    finally{setBusy(false);}
  }
  return <main className="api-docs">
    <nav><Link className="brand" href="/">DT <span>Documentation Tracker</span></Link><div className="docs-nav"><Link href="/">Dashboard</Link><a href="#finish-phase3">Finish Phase 3</a><span className="pill">API v3.0.0</span></div></nav>
    <header className="docs-hero"><p className="eyebrow">REFERENCE & REQUEST EXPLORER</p><h1>A readable guide<br/><em>to the API.</em></h1><p className="intro">Choose an endpoint, see what it expects, and try a real request. No sign-in or API key is required for the public service.</p><div className="docs-shortcuts"><button disabled={busy} onClick={()=>select('analyze')}>1. Analyze commits</button><button disabled={busy} onClick={()=>select('retrieve')}>2. Retrieve evidence</button><button disabled={busy} onClick={()=>select('tester-setup')}>3. Run a test suite</button></div></header>
    <section className="docs-bases" aria-label="Registered service addresses">{(['system','tester'] as Service[]).map(kind=><div key={kind}><span>{kind==='system'?'System base URL':'Tester base URL'}</span><code>{HOST}/{kind}</code><button className="copy-button" onClick={()=>void copy(HOST+'/'+kind)} aria-label={'Copy '+kind+' base URL'}>Copy</button></div>)}</section>
    <div className="docs-layout">
      <aside className="docs-sidebar"><label htmlFor="endpoint-search">Find an endpoint<input id="endpoint-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search endpoints..."/></label>{(['system','tester'] as Service[]).map(kind=><div key={kind}><p className="docs-group">{kind==='system'?'SYSTEM · ANALYSIS & EVIDENCE':'TESTER · CROSS-TEAM VALIDATION'}</p>{visible.filter(e=>e.service===kind).map(e=><button key={e.id} className={'endpoint-choice '+(selected===e.id?'is-selected':'')} aria-pressed={selected===e.id} disabled={busy} onClick={()=>select(e.id)}><span className={'method '+e.method.toLowerCase()}>{e.method}</span><span>{e.title}<small>{e.path}</small></span></button>)}</div>)}{visible.length===0&&<p>No matching endpoints.</p>}<div className="docs-downloads"><a href="/system/openapi.json" target="_blank" rel="noreferrer">System OpenAPI JSON ↗</a><a href="/tester/openapi.json" target="_blank" rel="noreferrer">Tester OpenAPI JSON ↗</a><a href={REPO+'/tree/main/docs'}>Project documentation ↗</a></div></aside>
      <section className="docs-endpoint panel" aria-label="Selected endpoint"><p className="endpoint-path"><span className={'method '+endpoint.method.toLowerCase()}>{endpoint.method}</span><code>/{endpoint.service}{endpoint.path}</code></p><h2>{endpoint.title}</h2><p>{endpoint.description}</p><div className="docs-callout">{endpoint.note}</div>
        <h3>{endpoint.method==='POST'?'Request body':'Request parameters'}</h3><div className="docs-table-wrap"><table><thead><tr><th>Field</th><th>Required</th><th>What to send</th></tr></thead><tbody>{fields.map(f=><tr key={f.name}><td><code>{f.name}</code><small>{f.where} · {Array.isArray(f.schema.type)?f.schema.type.join(' / '):f.schema.type??'string'}</small></td><td>{f.required?'Yes':'Optional'}</td><td>{descriptions[f.name]??'See the OpenAPI schema.'}</td></tr>)}</tbody></table></div>
        <div className="docs-heading-row"><h3>Try a request</h3><button className="copy-button" disabled={busy} onClick={()=>{const id=endpoint.id==='system-setup'?crypto.randomUUID():session;setDraft(pretty(example(endpoint.id,id,analysis)));setLookup(endpoint.id==='retrieve'?analysis:session);setNotice('Example reset.');}}>Reset example</button></div><p className="small">This sends a real request to the current deployment. Analyze requests save evidence; setup requests create sessions.</p>
        {endpoint.method==='POST'?<label className="request-label" htmlFor="request-json">JSON request<textarea id="request-json" spellCheck={false} value={draft} onChange={e=>setDraft(e.target.value)} rows={endpoint.id==='analyze'?8:5}/></label>:<label htmlFor="lookup-id">{endpoint.id==='retrieve'?'Analysis ID':'Session ID'}<input id="lookup-id" value={lookup} onChange={e=>setLookup(e.target.value)} placeholder={endpoint.id==='retrieve'?'Paste analysis_id':'Paste session_id'}/></label>}
        <div className="docs-actions"><button className="send-request" disabled={busy} onClick={()=>void send()}>{busy?'Waiting for response...':'Try request'} <span>→</span></button><button className="copy-button" onClick={()=>void copy(curl)}>Copy cURL</button></div><p className="docs-notice" role="status" aria-live="polite">{notice}</p>
        <details className="curl-example"><summary>Show cURL command</summary><pre>{curl}</pre></details>
        <div className="docs-heading-row"><h3>Actual response</h3>{status!==null&&<span className={'http-status '+(status<400?'ok':'bad')}>HTTP {status}</span>}</div><pre className="actual-response" aria-live="polite" tabIndex={0}>{response}</pre>
        <details><summary>Example successful response shape</summary><p className="small">Illustrative shape only. Tester reports contain all 14 results; this example shows one result to keep it readable.</p><pre>{pretty(responseExample(endpoint.id))}</pre></details>
        {endpoint.id==='analyze'&&<div className="docs-callout"><strong>What does SUCCESS mean?</strong><p>The change-analysis checks finished and their evidence was saved. It does not mean documentation is current or legally compliant. An empty issues array is expected in Phase 3.</p></div>}
        <h3>Response status codes</h3><div className="docs-table-wrap"><table><thead><tr><th>HTTP status</th><th>Meaning</th></tr></thead><tbody>{Object.keys(operation.responses).map(code=><tr key={code}><td><code>{code}</code></td><td>{statuses[code]}</td></tr>)}</tbody></table></div><p className="small">Error responses contain a readable message and source. A saved analysis with status ERROR may be returned with HTTP 200 when a required comparison was incomplete; inspect skipped and error.</p>
      </section>
    </div>
    <section className="docs-workflow panel"><p className="eyebrow">TESTER QUICK START</p><h2>One setup. One run. Retrieve the report.</h2><ol><li><button disabled={busy} onClick={()=>select('tester-setup')}>POST /tester/test/setup</button><p>Send the chosen system’s base URL. Wait for 201 and save session_id.</p></li><li><button disabled={busy} onClick={()=>select('tester-run')}>POST /tester/test/run</button><p>Send that session_id exactly once. The response includes every test outcome and coverage.</p></li><li><button disabled={busy} onClick={()=>select('tester-report')}>GET /tester/test/report</button><p>Use the same session_id to read the stored report. After a lost response, retry report lookup—not the run.</p></li></ol><p className="small">Code and component coverage counts are currently null with explanations. System coverage reports the three fully exercised criteria out of the ten semester criteria; that is separate from the 14 test outcomes.</p></section>
    <section id="finish-phase3" className="docs-finish panel"><p className="eyebrow">TEAM 16 · BEFORE YOU SUBMIT</p><h2>Finish Phase 3</h2><p>The implementation, deployment, tester, models and writeup are prepared. These steps need your team and Team 15; they have not been completed on your behalf.</p><ol>
      <li><strong>Update the class registry · Q2.2</strong><p>Copy both base URLs above into Team 16’s row, along with the shared-specification URL and run limits. <a href={REPO+'/blob/main/docs/registry-entry.csv'}>Open the prepared registry row ↗</a></p></li>
      <li><strong>Agree on the common contract · Q3.2 / Q6.2</strong><p>Review field names, classification/rename rules, fixture expectations, and component-coverage definitions with Team 15. Record the date, channel and agreed version. Scope changes need the approval described in your rubric. <a href={REPO+'/blob/main/docs/shared-spec.md'}>Review the proposed clarifications ↗</a></p></li>
      <li><strong>Run tests in both directions · Q6.1</strong><p>Obtain Team 15’s system and tester URLs. Have their system URL approved here, run our full suite against it, and have them run their full suite against our /system URL. Save both reports, dates, counts, coverage and problems/owners. Phase 3 requires the check and well-formed reports; every partner test need not pass.</p></li>
      <li><strong>Complete the team writeup · Q8.1 and final review</strong><p>Each teammate adds their own truthful GenAI-use and verification account. Replace the pending registry/contract/cross-test entries with actual evidence, review the code and models, then submit the report and links in the course system. <a href={REPO+'/blob/main/docs/phase3-writeup.md'}>Open the editable writeup ↗</a></p></li>
    </ol><details><summary>Information to request from Team 15</summary><pre>{'Please send your system base URL, tester base URL, and shared API/specification version.\nWe need to run our full suite against your service, and have you run yours against:\n'+HOST+'/system\nPlease share the resulting report, date, coverage and any mismatches.\nWe also need to agree on the documented schema/rule clarifications and component coverage inventory.'}</pre></details><p className="small">Documentation-warning detection is planned for Phase 4; authorized human review is planned for Phase 5. They are not missing items from the Phase 3 milestone you supplied.</p></section>
    <footer><span>Documentation Tracker · API v3.0.0</span><span><a href={REPO+'/blob/main/docs/submission-checklist.md'}>Submission checklist ↗</a></span></footer>
  </main>;
}
