import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import fixture from '../fixtures/manifest.json' with {type:'json'};
import { handle } from '../src/service.mjs';
export function environment(){
  const sqlite=new DatabaseSync(':memory:');
  for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql'))){
    sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
  }
  const objects=new Map();
  const env={LOCAL_TEST:'1',RELEASE_SHA:'test-release',DB:{prepare(sql){return {bind(...args){return {
    async first(){return sqlite.prepare(sql).get(...args)??null;},
    async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
  };},async all(){return {results:sqlite.prepare(sql).all()};}};}},BUCKET:{
    async put(key,value){if(objects.has(key))return null;objects.set(key,value);return {key};},
    async get(key){return objects.has(key)?{async text(){return objects.get(key);}}:null;},
  }};
  return {env,sqlite,objects};
}
export function githubMock(overrides={}){
  const files=[
    {filename:'architecture/model.md',status:'modified'},
    {filename:'design/new.md',previous_filename:'design/old.md',status:'renamed'},
    {filename:'requirements/model.md',status:'added'},
    {filename:'spec/api.json',status:'removed'},
    {filename:'src/model.py',status:'modified'},
    {filename:'src/new.ts',status:'added'},
    {filename:'src/remove.py',status:'removed'},
  ];
  return async(input)=>{
    const url=String(input);
    if(overrides.throw)throw new Error('SECRET-DO-NOT-LEAK');
    if(overrides.status)return Response.json({message:'SECRET-DO-NOT-LEAK'},{status:overrides.status});
    if(url.includes('does-not-exist')||url.includes('000000000000'))return Response.json({}, {status:404});
    if(url.endsWith('/'+fixture.repository))return Response.json({private:overrides.private??false});
    if(url.includes('/compare/'))return Response.json({status:overrides.comparisonStatus??'ahead',files:overrides.files??files}, {headers:overrides.link?{link:'<https://example.test/page2>; rel="next"'}:{}});
    if(url.endsWith('/commits/'+fixture.commit_id))return Response.json({sha:fixture.commit_id,parents:[{sha:fixture.base_commit}],files});
    if(url.endsWith('/commits/'+fixture.base_commit))return Response.json({sha:fixture.base_commit,parents:[],files:[{filename:'README.md',status:'added'}]});
    return Response.json({}, {status:404});
  };
}
export function network(env,upstream=githubMock()){
  const fetcher=async(url,options)=>String(url).startsWith('https://api.github.com/')?upstream(url,options):handle(new Request(url,options),env,fetcher);
  return fetcher;
}
export const input={repository:fixture.repository,commit_id:fixture.commit_id,base_commit:fixture.base_commit};
export async function call(env,path,data,fetcher=network(env),method=data===undefined?'GET':'POST'){
  const r=await handle(new Request('https://local.test'+path,{method,...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:typeof data==='string'?data:JSON.stringify(data)})}),env,fetcher);
  return {status:r.status,body:await r.json()};
}
