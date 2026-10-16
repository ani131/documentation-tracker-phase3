export const VERSION = '3.0.0';
export const CONFIG_VERSION = 'classification-v1';
export const SHA = /^[a-fA-F0-9]{7,40}$/;
export const ID = /^[A-Za-z0-9_-]{1,80}$/;
export class Fault extends Error {
  constructor(status, code, message, source = 'system') {
    super(message); this.status = status; this.code = code; this.source = source;
  }
}
export function invalid(message) { throw new Fault(400, 'INVALID_REQUEST', message); }
export function keys(data, allowed) { if (Object.keys(data).some(k => !allowed.includes(k))) invalid('Unknown request field.'); }
export function sessionId(value) { if (typeof value !== 'string' || !ID.test(value)) invalid('session_id must contain 1-80 letters, digits, underscores or hyphens.'); return value; }
export async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) invalid('Content-Type must be application/json.');
  const reader = request.body?.getReader();
  if (!reader) invalid('A JSON object is required.');
  let size = 0; const chunks = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 16384) { await reader.cancel(); invalid('Request body exceeds 16 KiB.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  let data; try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { invalid('Malformed JSON.'); }
  if (!data || Array.isArray(data) || typeof data !== 'object') invalid('A JSON object is required.');
  return data;
}
export function classify(path) {
  const p = path.toLowerCase();
  if (/^(requirements?|reqs)\//.test(p)) return 'REQUIREMENT';
  if (/^(specs?|specifications?)\//.test(p)) return 'SPECIFICATION';
  if (/^architecture\//.test(p)) return 'ARCHITECTURE';
  if (/^design\//.test(p)) return 'DESIGN';
  if (/\.(py|js|mjs|cjs|ts|tsx|jsx|java|c|cc|cpp|h|hpp|go|rs|rb|cs|swift|kt|sh)$/.test(p)) return 'IMPLEMENTATION';
  return 'OTHER';
}
export function normalize(files) {
  const rows = [];
  const add = (path, change_type) => rows.push({ path, change_type, category: classify(path) });
  for (const f of files) {
    if (!f || typeof f.filename !== 'string' || f.filename.length > 1024 || f.filename.includes('\0')) throw new Fault(500, 'ANALYSIS_FAILED', 'Invalid file metadata received.');
    if (f.status === 'renamed') {
      if (typeof f.previous_filename !== 'string') throw new Fault(500, 'ANALYSIS_FAILED', 'Rename lacks its original path.');
      add(f.previous_filename, 'DELETED'); add(f.filename, 'ADDED');
    } else if (f.status === 'added' || f.status === 'copied') add(f.filename, 'ADDED');
    else if (f.status === 'removed') add(f.filename, 'DELETED');
    else if (f.status === 'modified' || f.status === 'changed') add(f.filename, 'MODIFIED');
    else throw new Fault(500, 'ANALYSIS_FAILED', 'Unsupported change status received.');
  }
  return rows.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : a.change_type.localeCompare(b.change_type));
}
export class Store {
  constructor(env) { this.db = env.DB; this.bucket = env.BUCKET; }
  async get(key) { const row = await this.db.prepare('SELECT body, state FROM records WHERE key = ?').bind(key).first(); return row ? { ...JSON.parse(row.body), _state: row.state } : null; }
  async insert(key, data, state = 'ready') {
    const r = await this.db.prepare('INSERT OR IGNORE INTO records (key, body, state) VALUES (?, ?, ?)').bind(key, JSON.stringify(data), state).run();
    return r.meta.changes === 1;
  }
  async transition(key, from, to, data) {
    const r = await this.db.prepare('UPDATE records SET body = ?, state = ? WHERE key = ? AND state = ?').bind(JSON.stringify(data), to, key, from).run();
    return r.meta.changes === 1;
  }
  async saveResult(result) {
    const object = await this.bucket.put(`analyses/${result.analysis_id}.json`, JSON.stringify(result), { httpMetadata: { contentType: 'application/json' }, onlyIf: { etagDoesNotMatch: '*' } });
    if (!object) throw new Error('Evidence ID collision');
  }
  async result(id) { const object = await this.bucket.get(`analyses/${id}.json`); return object ? JSON.parse(await object.text()) : null; }
  async event(event, status, elapsed, analysis_id = null) {
    const entry = { event, status, elapsed_ms: elapsed, analysis_id, at: new Date().toISOString() };
    console.log(JSON.stringify(entry));
    await this.db.prepare('INSERT INTO events (id, event, status, elapsed_ms, analysis_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), event, String(status), elapsed, analysis_id, entry.at).run();
  }
  async metrics() {
    const totals = await this.db.prepare('SELECT event, status, COUNT(*) AS count, ROUND(AVG(elapsed_ms), 1) AS average_ms FROM events GROUP BY event, status').all();
    const recent = await this.db.prepare('SELECT event, status, elapsed_ms, analysis_id, created_at FROM events ORDER BY created_at DESC LIMIT 5').all();
    return { totals: totals.results, recent: recent.results };
  }
}
async function github(path, store, fetcher) {
  const key = 'github:' + path; const old = await store.get(key);
  if (old && Date.now() - old.cached_at < 10 * 60 * 1000) return old.data;
  let response;
  try { response = await fetcher('https://api.github.com/repos/' + path, { headers: { 'Accept':'application/vnd.github+json', 'User-Agent':'DocumentationTracker/3.0', 'X-GitHub-Api-Version':'2022-11-28' }, signal: AbortSignal.timeout(10000), redirect:'error' }); }
  catch { throw new Fault(500, 'UPSTREAM_UNAVAILABLE', 'GitHub could not be reached within 10 seconds.'); }
  if ([404,422,409].includes(response.status)) throw new Fault(404, 'RESOURCE_NOT_FOUND', 'Public repository or commit was not found.');
  if ([403,429].includes(response.status)) throw new Fault(500, 'UPSTREAM_RATE_LIMIT', 'GitHub access or rate limit prevented analysis; retry later.');
  if (!response.ok) throw new Fault(500, 'UPSTREAM_UNAVAILABLE', 'GitHub returned an unexpected error.');
  const text = await response.text();
  if (text.length > 4 * 1024 * 1024) throw new Fault(500, 'ANALYSIS_FAILED', 'GitHub response exceeds the supported size.');
  let raw; try { raw = JSON.parse(text); } catch { throw new Fault(500, 'UPSTREAM_UNAVAILABLE', 'GitHub returned invalid JSON.'); }
  const data = path.includes('/compare/') ? { status:raw.status, files:raw.files, paginated:response.headers.has('link') }
    : path.includes('/commits/') ? { sha:raw.sha, parents:raw.parents, files:raw.files, paginated:response.headers.has('link') }
    : { private:raw.private, full_name:raw.full_name };
  if (data.files) data.files = data.files.map(f => ({ filename:f.filename, status:f.status, previous_filename:f.previous_filename }));
  await store.insert(key, { data, cached_at:Date.now() }, 'cached');
  if (old) await store.transition(key, 'cached', 'cached', { data, cached_at:Date.now() });
  return data;
}
export async function analyze(data, store, fetcher = fetch) {
  keys(data, ['repository','commit_id','base_commit']);
  const repoPattern=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/;
  if (typeof data.repository !== 'string' || !repoPattern.test(data.repository) || /\/(\.|\.\.)$/.test(data.repository)) invalid('repository must be owner/name.');
  if (typeof data.commit_id !== 'string' || !SHA.test(data.commit_id)) invalid('commit_id must be a 7-40 character hexadecimal Git commit ID.');
  if (data.base_commit !== undefined && (typeof data.base_commit !== 'string' || !SHA.test(data.base_commit))) invalid('base_commit must be a 7-40 character hexadecimal Git commit ID.');
  const repo = await github(data.repository, store, fetcher);
  if (repo.private !== false) throw new Fault(404, 'RESOURCE_NOT_FOUND', 'Only public GitHub repositories are supported.');
  const head = await github(`${data.repository}/commits/${data.commit_id}`, store, fetcher);
  if (!SHA.test(head.sha ?? '') || !Array.isArray(head.parents)) throw new Fault(500, 'ANALYSIS_FAILED', 'GitHub commit metadata is incomplete.');
  let base = null; let comparison;
  if (data.base_commit) {
    const resolved = await github(`${data.repository}/commits/${data.base_commit}`, store, fetcher);
    base = resolved.sha;
    if (!SHA.test(base ?? '')) throw new Fault(500, 'ANALYSIS_FAILED', 'Base commit metadata is incomplete.');
  } else base = head.parents[0]?.sha ?? null;
  if (base === head.sha) comparison = { status:'identical', files:[] };
  else if (base) comparison = await github(`${data.repository}/compare/${base}...${head.sha}`, store, fetcher);
  else comparison = { ...head, status:'ahead' };
  const skipped = [];
  if (!['ahead','identical'].includes(comparison.status)) skipped.push({ path:'*', reason:'Base must be an ancestor of head; divergent and reverse comparisons are unsupported.' });
  if (!Array.isArray(comparison.files) || comparison.files.length >= 300 || comparison.paginated) skipped.push({ path:'*', reason:'Comparison may be truncated; fewer than 300 changed files and an unpaginated response are required.' });
  const result = {
    analysis_id:crypto.randomUUID(), repository:data.repository, head_commit:head.sha, base_commit:base,
    configuration_version:CONFIG_VERSION, tool_version:VERSION, created_at:new Date().toISOString(),
    status:skipped.length ? 'ERROR' : 'SUCCESS', changes:skipped.length ? [] : normalize(comparison.files),
    issues:[], skipped, error:skipped.length ? { code:'INCOMPLETE_CHECK', message:'Required change detection could not be completed.' } : null,
  };
  try { await store.saveResult(result); }
  catch { throw new Fault(500, 'STORAGE_FAILED', 'Analysis evidence could not be saved; no success is reported.'); }
  return result;
}
