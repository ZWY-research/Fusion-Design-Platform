// Prepare a local candidate only. No git/network/deployment commands.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const project=fileURLToPath(new URL('../',import.meta.url));
export const sourceFiles=['LICENSE','README.md','package.json','package-lock.json','vite.config.js','scripts/release.mjs','.github/workflows/pages.yml',
  ...['index.html','main.js','geometry.js','science.js','target.js','target.test.js','style.css','cases.json','public/THIRD_PARTY_NOTICES.txt','public/DATA_LICENSE.txt'].map(p=>'web/'+p)];
const target=process.argv[2];
if(!target||!path.isAbsolute(target))throw Error('Supply an absolute, new local candidate directory outside the project.');
const destination=path.resolve(target),relative=path.relative(project,destination);
if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw Error('Candidate must be outside the project.');
if(fs.existsSync(destination))throw Error('Candidate path already exists; preserve it and choose a fresh directory.');
fs.mkdirSync(destination,{recursive:true});
const source=path.join(destination,'source'),site=path.join(destination,'site');
for(const name of sourceFiles){const from=path.join(project,name),to=path.join(source,name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
await build({configFile:path.join(project,'vite.config.js'),build:{outDir:site,emptyOutDir:false}});
const forbidden=/(?:[A-Za-z]:[\\/](?:Users|OneDrive|Dev|GitHub_Cache)|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{20,}|\.nc(?:["'\s]|$))/i;
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=walk(source).concat(walk(site));
for(const file of files){if(forbidden.test(fs.readFileSync(file,'utf8')))throw Error(`Potential private material in ${path.relative(destination,file)}`);if(/\.(map|dat|nc|pdf|png|jpg)$/i.test(file))throw Error('Unexpected artifact type: '+file);}
const manifest=files.map(file=>({file:path.relative(destination,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify({status:'candidate_not_approved_for_publication',files:manifest},null,2)+'\n');
console.log(`Prepared ${manifest.length} candidate files at ${destination}; not published.`);

