'use client';
import { useState } from 'react';
import Link from 'next/link';
import fixture from '../fixtures/manifest.json';

type Json = Record<string, unknown>;
type ApiData = Json & {status?:string; changes?:unknown[]; message?:string; session_id?:string; results?:{outcome:string}[]};
export default function Home(){
  const [repository,setRepository]=useState(fixture.repository);
  const [commit,setCommit]=useState(fixture.commit_id);
  const [base,setBase]=useState(fixture.base_commit);
  const [busy,setBusy]=useState('');
  const [result,setResult]=useState<Json|null>(null);
  const [status,setStatus]=useState('Ready to analyze the fixed example.');
  async function analyze(){
    setBusy('analysis');setStatus('Resolving commits and saving evidence...');
    try{const r=await fetch('/system/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repository,commit_id:commit,...(base?{base_commit:base}:{})})});const d=await r.json() as ApiData;setResult(d);setStatus(r.ok?`${d.status}: ${d.changes?.length??0} classified changes. Evidence saved.`:`Request failed: ${d.message}`);}
    catch{setStatus('The service could not be reached.');}finally{setBusy('');}
  }
  async function testSystem(){
    setBusy('tester');setStatus('Preparing a fresh test session...');
    try{const s=await fetch('/tester/test/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target_url:location.origin+'/system'})});const sd=await s.json() as ApiData;if(!s.ok)throw new Error(sd.message);
      setStatus('Running the full suite. This may take up to 5 minutes.');
      const r=await fetch('/tester/test/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sd)});const d=await r.json() as ApiData;setResult(d);setStatus(r.ok?`${d.results?.filter(t=>t.outcome==='pass').length??0}/${d.results?.length??0} tests passed. Session ${sd.session_id}`:`Run error: ${d.message}. Retrieve the report with session ${sd.session_id}.`);
    }catch(e){setStatus(e instanceof Error?e.message:'Tester could not be reached.');}finally{setBusy('');}
  }
  return <main>
    <nav><Link className="brand" href="/">DT <span>Documentation Tracker</span></Link><span className="pill">Phase 3 / Initial delivery</span></nav>
    <header><p className="eyebrow">REPOSITORY EVIDENCE, KEPT IN CONTEXT</p><h1>Know what changed.<br/><em>Keep the evidence.</em></h1><p className="intro">Compare public GitHub commits, classify the changes, and retrieve a permanent snapshot of every analysis.</p></header>
    <section className="workspace" aria-label="Analysis workspace"><div className="panel"><div className="section-title"><span className="step">01</span><h2>Analyze a repository</h2></div><p>Start with the reproducible example, or enter another public repository.</p><form onSubmit={e=>{e.preventDefault();void analyze();}}>
      <label>Repository <input required value={repository} onChange={e=>setRepository(e.target.value)} placeholder="owner/repository" spellCheck={false}/></label>
      <label>Head commit <input required value={commit} onChange={e=>setCommit(e.target.value)} spellCheck={false}/></label>
      <label>Base commit <span className="optional">optional; defaults to first parent</span><input value={base} onChange={e=>setBase(e.target.value)} spellCheck={false}/></label>
      <button disabled={!!busy} type="submit">{busy==='analysis'?'Analyzing...':'Analyze & save evidence'} <span>↗</span></button></form>
      <p className="small">Read-only analysis. Repository code is never executed or modified. Documentation warnings arrive in Phase 4.</p></div>
    <aside><div className="panel test-panel"><div className="section-title"><span className="step">02</span><h2>Verify the service</h2></div><p>Run the independent HTTP tester against this deployment using fixed Git commits and expected results.</p><button className="secondary" disabled={!!busy} onClick={()=>void testSystem()}>{busy==='tester'?'Running suite...':'Run the acceptance suite'} <span>→</span></button><div className="links"><a href="/system/openapi.json">System OpenAPI ↗</a><a href="/tester/openapi.json">Tester OpenAPI ↗</a><a href="/system/metrics" target="_blank" rel="noreferrer">Operational metrics ↗</a><a href="https://github.com/ani131/documentation-tracker-phase3">Source & documentation ↗</a></div></div><p className="note">For cross-team testing, send an approved system base URL to <code>/tester/test/setup</code>. The suite reports pass, fail, error, and skip separately.</p></aside></section>
    <section className="panel result"><div className="result-heading"><h2>Result & evidence</h2><span className="pill">JSON</span></div><p role="status" aria-live="polite">{status}</p>{result?<><pre tabIndex={0}>{JSON.stringify(result,null,2)}</pre>{typeof result.analysis_id==='string'&&<a href={'/system/analysis/'+result.analysis_id}>Retrieve this saved analysis ↗</a>}</>:<div className="empty">Your analysis or test report will appear here.</div>}</section>
    <footer><span>Documentation Tracker · v3.0.0</span><span>Human reviewers retain compliance responsibility.</span></footer>
  </main>;
}


