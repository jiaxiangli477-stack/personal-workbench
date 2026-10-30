'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);if(r.status!==0)throw Error('Check failed: '+args.join(' '));return r.stdout||'';}
async function main(){
 for(const name of ['dist/app.js','dist/enrich.js','dist/model.js','dist/ai-ui.js','dist/data.js','server.cjs','start.cjs','lib/library.cjs','lib/ai-config.cjs','lib/ai-relay.cjs','lib/ai-images.cjs','lib/distillations.cjs','dist/distill-ui.js','lib/http-guard.cjs','lib/public-news.cjs'])run(['--check',path.join(root,name)]);
 const testOutput=run(['--test','--test-concurrency=1',...fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.cjs')).map(n=>path.join(root,'tests',n))]);
 const testCount=Number(testOutput.match(/(?:ℹ|#) tests (\d+)/)?.[1]);if(!testCount)throw Error('Cannot read test count');
 const response=await fetch('http://localhost:8869/api/library/refresh',{method:'POST'});if(!response.ok)throw Error('Local library refresh failed');const catalog=await response.json();
 for(const k of ['projects','works','skills','knowledge','ideas'])if(!Array.isArray(catalog[k])||!catalog[k].length)throw Error('Missing real collection: '+k);
 const news=await(await fetch('http://localhost:8869/api/news')).json();
 const checks=[];
 const health=await(await fetch('http://localhost:8869/api/health')).json();
 const fingerprint=require('node:crypto').createHash('sha256').update(Buffer.concat(['server.cjs','lib/ai-config.cjs','lib/ai-relay.cjs','lib/ai-images.cjs'].map(name=>fs.readFileSync(path.join(root,name))))).digest('hex');
 if(health.version!==fs.readFileSync(path.resolve(root,'../VERSION'),'utf8').trim()||health.codeFingerprint!==fingerprint)throw Error('Running server does not match current verified code; restart the project server');checks.push('running version and backend code fingerprint match');
 for(const [name,url,headers,expected] of [
  ['cross-port snapshot denied','/library.js',{'sec-fetch-site':'same-site','sec-fetch-mode':'no-cors'},403],
  ['cross-origin API denied','/api/library',{origin:'http://localhost:9999'},403],
  ['project documents not served','/AGENTS.md',{},404],
  ['arbitrary file path not supported','/api/source?path=C:/Windows/win.ini',{},404]
 ]){const r=await fetch('http://localhost:8869'+url,{headers});if(r.status!==expected)throw Error(name+': '+r.status);checks.push(name);}
 const work=catalog.works.find(w=>w.kind==='video'&&w.fileId);const media=await fetch('http://localhost:8869/api/asset/'+work.fileId,{headers:{range:'bytes=0-1023'}});if(media.status!==206||(await media.arrayBuffer()).byteLength!==1024)throw Error('Video Range failed');checks.push('video range: 206 / 1024 bytes');
 const reference=catalog.knowledge.find(k=>k.fileId);const text=await(await fetch('http://localhost:8869/api/source/'+reference.fileId)).json();if(!text.text)throw Error('Knowledge source preview empty');checks.push('knowledge original readable');
 const report={date:'2026-10-29 America/Los_Angeles',version:fs.readFileSync(path.resolve(root,'../VERSION'),'utf8').trim(),unitTests:{passed:testCount,failed:0},counts:catalog.counts,featuredSkills:catalog.skills.filter(s=>s.featured).length,thumbnails:catalog.works.filter(w=>w.thumbnailUrl).length,news:{attemptedAt:news.updatedAt,items:news.items.length,sources:news.sources.map(s=>({id:s.id,status:s.status,count:s.count,retainedCount:s.retainedCount||0,lastSuccessAt:s.lastSuccessAt,error:s.error||null}))},integrationChecks:checks,browserChecks:fs.existsSync(path.join(root,'evidence','browser-ai-acceptance.json'))?JSON.parse(fs.readFileSync(path.join(root,'evidence','browser-ai-acceptance.json'),'utf8')).checks:[],limits:['not a full semantic reread of all historical chats','no production re-verification of external projects','no website business-account integration; AI is explicit manual input only','no deployment; no independent provider billing or upstream-identity verification','provider primary image503 and backup returned1254square for1024request remain explicit limitations','source reachability changes; old cache explicitly retained','HTML/PPT originals indexed but not executed by local preview'],privateData:{directory:'preview/local-data',trackedInGit:false,rawSourcesCopied:false}};
 fs.mkdirSync(path.join(root,'evidence'),{recursive:true});fs.writeFileSync(path.join(root,'evidence','verification-'+report.version+'.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(root,'evidence','verification-latest.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({verified:true,counts:report.counts,tests:report.unitTests,news:report.news.items}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
