import { mkdirSync,writeFileSync } from 'node:fs';
import { openapi } from '../src/spec.mjs';
mkdirSync('docs',{recursive:true});
for(const kind of ['system','tester'])writeFileSync(`docs/openapi-${kind}.json`,JSON.stringify(openapi(kind),null,2)+'\n');
console.log('Exported the system and tester OpenAPI documents.');
