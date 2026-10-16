import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
for(const file of readdirSync('src').filter(f=>f.endsWith('.mjs'))){
  const r=spawnSync(process.execPath,['--check','src/'+file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);
}
for(const args of [['node_modules/typescript/bin/tsc','--noEmit'],['node_modules/eslint/bin/eslint.js','src','tests','app','db'],['scripts/export-openapi.mjs']]){
  const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);
}
