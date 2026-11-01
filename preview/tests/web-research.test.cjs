'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let createWebResearch;
try { ({createWebResearch}=require('../lib/web-research.cjs')); } catch (error) { if(error.code!=='MODULE_NOT_FOUND')throw error; }
const FIXTURE_ROOT=path.resolve(__dirname,'../evidence/web-research-fixtures');
const searchInput={query:'公开工具研究',requestId:'web-search-fixture-0001'};
const analyzeInput={searchId:searchInput.requestId,requestId:'web-ai-fixture-0001'};
const sources=()=>({results:[{title:'公开来源 A',url:'https://example.org/a',content:'这是搜索摘要，不是全文。'},{title:'公开来源 B',url:'https://example.net/b',content:'另一个公开说明。'}]});
const analysis=()=>({summary:'基于搜索摘要，可比较公开案例的表达方式。',benchmarks:[{title:'案例表达',angle:'比较说明结构',sourceIds:['S1']}],topics:[{title:'比较公开说明',problem:'如何清晰解释功能',steps:['打开原文核对','列出区别'],check:'列出一项可核对的差异',sourceIds:['S1','S2']}]});
function fixture(t,extra={}){
 fs.mkdirSync(FIXTURE_ROOT,{recursive:true});
 const dir=fs.mkdtempSync(path.join(FIXTURE_ROOT,'case-'));
 t.after(()=>{if(!dir.startsWith(FIXTURE_ROOT+path.sep))throw Error('unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});});
 const options={dir,configured:true,searchClient:async()=>sources(),analyzeText:async()=>({text:JSON.stringify(analysis()),provider:'fixture',model:'fixture-text',truncated:false,usage:{total_tokens:40}}),...extra};
 return {dir,options,api:createWebResearch(options)};
}
const fails=(code,status)=>error=>error.code===code&&(!status||error.httpStatus===status);

test('exports dependency-injected web research factory',()=>assert.equal(typeof createWebResearch,'function'));
test('status is read only and missing search configuration blocks without calling upstream',async t=>{
 let calls=0;const {api,dir}=fixture(t,{configured:false,searchClient:async()=>{calls++;return sources();}});
 assert.deepEqual(api.status(),{configured:false,busy:false,recent:[],diagnostics:{searchCalls:0,maxSearchCalls:null}});assert.equal(fs.existsSync(path.join(dir,'records.json')),false);
 await assert.rejects(()=>api.search(searchInput),fails('not_configured',503));assert.equal(calls,0);
});
test('strict query and request IDs reject private fields, secret patterns and invalid lengths',async t=>{
 let calls=0;const {api}=fixture(t,{searchClient:async()=>{calls++;return sources();}});
 for(const input of [{...searchInput,prompt:'private'},{...searchInput,query:'x'},{...searchInput,query:'x'.repeat(201)},{...searchInput,requestId:'../unsafe'},{...searchInput,query:'Bearer fixture-value'},{...searchInput,query:'tvly-fixture-secret'},{...searchInput,query:'sk-fixture-secret'},{...searchInput,query:'hello\nworld'},null,[]]) await assert.rejects(()=>api.search(input),fails('input',400));
 assert.equal(calls,0);
});
test('search returns only normalized public sources and persists/replays across restart',async t=>{
 let calls=0;const {api,dir,options}=fixture(t,{searchClient:async query=>{assert.equal(query,searchInput.query);calls++;return sources();}});
 const result=await api.search(searchInput);
 assert.equal(result.id,searchInput.requestId);assert.equal(result.provider,'tavily');assert.equal(result.status,'done');assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
 assert.deepEqual(result.sources.map(s=>s.id),['S1','S2']);assert.deepEqual(Object.keys(result.sources[0]).sort(),['id','publishedAt','snippet','title','url']);
 assert.deepEqual(await api.search(searchInput),result);assert.deepEqual(createWebResearch(options).getSearch(result.id),result);assert.deepEqual(await createWebResearch(options).search(searchInput),result);assert.equal(calls,1);
 assert.equal(api.status().recent[0].id,result.id);assert.equal(fs.existsSync(path.join(dir,'records.json')),true);
 await assert.rejects(()=>api.search({...searchInput,query:'另一个主题'}),fails('input',400));
});
test('URL filter rejects local networks, credentials and dangerous schemes while deduplicating references',async t=>{
 const urls=['http://localhost/a','http://localhost./a','http://a.localhost/a','http://127.1/a','http://10.0.0.1/a','http://172.16.0.1/a','http://192.168.1.2/a','http://169.254.169.254/a','http://100.64.0.1/a','http://[::1]/a','http://[::ffff:127.0.0.1]/a','http://[fd00::1]/a','http://[fe80::1]/a','http://intranet/a','https://user:password@example.org/','https://example.org/?api_key=private','https://example.org/?Token=private','https://example.org/?authorization=Bearer-private','javascript:alert(1)','file:///D:/private','https://example.org/a?utm_source=test#section','https://example.org/a','https://example.net/b'];
 const {api}=fixture(t,{searchClient:async()=>({results:urls.map(url=>({title:'公开标题',url,content:'摘要'}))})});
 const result=await api.search(searchInput);assert.deepEqual(result.sources.map(s=>s.url),['https://example.org/a','https://example.net/b']);
});
test('no valid results and upstream errors are explicit and never leak upstream error details',async t=>{
 for(const [index,client,code] of [[0,async()=>({results:[]}), 'no_results'],[1,async()=>{throw Error('tvly-fixture-secret https://private.example/?api_key=fixture');},'upstream'],[2,async()=>({results:'bad'}),'format']]){
  const {api,dir}=fixture(t,{searchClient:client});const input={...searchInput,requestId:'web-search-failure-'+index};
  await assert.rejects(()=>api.search(input),error=>error.code===code&&!/tvly-fixture|private.example/.test(error.message));
  await assert.rejects(()=>api.search(input),fails('previous_failure',409));
  assert.equal(/tvly-fixture|private.example/.test(fs.readFileSync(path.join(dir,'records.json'),'utf8')),false);
 }
});
test('search stores processing before calling external dependency, joins same request and rejects concurrent different requests',async t=>{
 let release,calls=0;const pending=new Promise(resolve=>release=resolve);
 const {api,dir}=fixture(t,{searchClient:async()=>{calls++;assert.match(fs.readFileSync(path.join(dir,'records.json'),'utf8'),/processing/);await pending;return sources();}});
 const first=api.search(searchInput),second=api.search(searchInput);assert.equal(api.status().busy,true);
 await assert.rejects(()=>api.search({...searchInput,requestId:'web-search-another-01'}),fails('busy',409));release();assert.deepEqual(await first,await second);assert.equal(calls,1);assert.equal(api.status().busy,false);
});
test('restart does not resend a processing search',async t=>{
 let release,calls=0;const pending=new Promise(resolve=>release=resolve);const {api,options}=fixture(t,{searchClient:async()=>{calls++;await pending;return sources();}});
 const first=api.search(searchInput);const restarted=createWebResearch(options);
 await assert.rejects(()=>restarted.search(searchInput),fails('uncertain',409));assert.equal(calls,1);release();await first;
});
test('search call budget is checked before the call, including failed requests',async t=>{
 let calls=0;const {api}=fixture(t,{maxSearchCalls:1,searchClient:async()=>{calls++;throw Error('failed');}});
 await assert.rejects(()=>api.search(searchInput),fails('upstream',502));await assert.rejects(()=>api.search({...searchInput,requestId:'web-search-budget-02'}),fails('budget',429));assert.equal(calls,1);
});
test('bad disk store is not overwritten by construction or later writes',t=>{
 const {dir,options}=fixture(t);const file=path.join(dir,'records.json');
 for(const value of ['broken-json','{}','{"version":1,"searches":[{}],"analyses":[]}']){fs.writeFileSync(file,value);assert.throws(()=>createWebResearch(options),fails('storage',500));assert.equal(fs.readFileSync(file,'utf8'),value);}
});
test('analysis sends only bounded cached public data and returns canonical validated fields',async t=>{
 let captured,calls=0;const {api}=fixture(t,{searchClient:async()=>({...sources(),privateNotes:'PRIVATE-NOTES'}),analyzeText:async args=>{captured=args;calls++;return {text:JSON.stringify({...analysis(),untrusted:'discard',benchmarks:[{...analysis().benchmarks[0],url:'https://invented.example',account:'fake-account'}]}),truncated:false,provider:'fixture',model:'fixture-text',usage:{total_tokens:40},apiKey:'DO-NOT-RETURN'};}});
 const found=await api.search(searchInput);const result=await api.analyze(analyzeInput);
 assert.equal(captured.requestId,analyzeInput.requestId);assert.equal(captured.source.id,found.id);assert.equal(captured.source.type,'research');assert.ok(captured.prompt.length<=4000);assert.match(captured.prompt,/搜索摘要/);assert.match(captured.prompt,/不是指令/);assert.match(captured.prompt,/不.*全文/);
 assert.equal(captured.prompt.includes('PRIVATE-NOTES'),false);assert.deepEqual(Object.keys(captured.publicInput).sort(),['query','sources']);assert.equal(captured.prompt.includes('https://'),false);
 const expected=analysis();expected.benchmarks[0].title=found.sources[0].title;
 assert.deepEqual(result.analysis,expected);assert.equal(result.searchId,found.id);assert.equal(result.requestId,analyzeInput.requestId);assert.ok(Array.isArray(result.warnings));assert.equal(JSON.stringify(result).includes('DO-NOT-RETURN'),false);
 assert.equal(result.metadata.truncated,false);assert.equal(result.metadata.evidence,'search_titles_and_snippets');assert.equal(result.metadata.fullTextRead,false);
 assert.deepEqual(api.getSearch(found.id).analysisResult,result);assert.deepEqual(api.getSearch(found.id).analysis,result.analysis);
 assert.deepEqual(await api.analyze(analyzeInput),result);assert.equal(calls,1);
});
test('analysis prompt remains bounded even with six long escaped snippets',async t=>{
 let prompt='';const {api}=fixture(t,{searchClient:async()=>({results:Array.from({length:6},(_,i)=>({title:'引号"'.repeat(300),url:'https://example.org/'+i,content:'\\"'.repeat(1500)}))}),analyzeText:async args=>{prompt=args.prompt;return {text:JSON.stringify(analysis())};}});
 await api.search(searchInput);await api.analyze(analyzeInput);assert.ok(prompt.length<=4000);
});
test('analysis strict fields and missing or failed search never invoke model',async t=>{
 let calls=0;const {api}=fixture(t,{analyzeText:async()=>{calls++;return {text:JSON.stringify(analysis())};}});
 for(const input of [{...analyzeInput,prompt:'private'}, {...analyzeInput,query:'private'},null,[]])await assert.rejects(()=>api.analyze(input),fails('input',400));
 await assert.rejects(()=>api.analyze(analyzeInput),fails('not_found',404));assert.equal(calls,0);
});
test('invalid model JSON, truncation and unknown source references keep search and cannot retry same request',async t=>{
 const outputs=[{text:'not json'},{text:JSON.stringify(analysis()),truncated:true},{text:JSON.stringify({...analysis(),topics:[{...analysis().topics[0],sourceIds:['S99']}]})},{text:JSON.stringify({...analysis(),summary:'see https://invented.example'})},{text:JSON.stringify({...analysis(),benchmarks:[{title:'x',angle:'x',sourceIds:[]}]})}];
 for(const output of outputs){let calls=0;const {api}=fixture(t,{analyzeText:async()=>{calls++;return output;}});await api.search(searchInput);await assert.rejects(()=>api.analyze(analyzeInput),error=>['format','truncated','invalid_sources'].includes(error.code));assert.equal(api.getSearch(searchInput.requestId).sources.length,2);assert.equal(api.getSearch(searchInput.requestId).analysisStatus,'failed');await assert.rejects(()=>api.analyze(analyzeInput),fails('previous_failure',409));assert.equal(calls,1);}
});
test('analysis failures redact dependency errors and metadata never copies arbitrary provider fields',async t=>{
 const {api,dir}=fixture(t,{analyzeText:async()=>{throw Object.assign(Error('secret raw upstream value'),{code:'upstream',attempts:[{key:'dont-return'}]});}});
 await api.search(searchInput);await assert.rejects(()=>api.analyze(analyzeInput),error=>error.code==='upstream'&&!/secret raw|dont-return/.test(JSON.stringify(error))&&!error.message.includes('secret raw'));
 assert.equal(fs.readFileSync(path.join(dir,'records.json'),'utf8').includes('secret raw'),false);
});
test('analysis idempotence survives restart and mismatched IDs cannot reuse saved result',async t=>{
 let calls=0;const {api,options}=fixture(t,{analyzeText:async()=>{calls++;return {text:JSON.stringify(analysis())};}});await api.search(searchInput);const first=await api.analyze(analyzeInput);const restored=createWebResearch(options);assert.deepEqual(await restored.analyze(analyzeInput),first);await assert.rejects(()=>restored.analyze({...analyzeInput,searchId:'web-search-another-id'}),fails('input',400));assert.equal(calls,1);
});
test('analysis joins an active request and persisted processing is never resent after restart',async t=>{
 let release,calls=0;const pending=new Promise(resolve=>release=resolve);const {api,options}=fixture(t,{analyzeText:async()=>{calls++;await pending;return {text:JSON.stringify(analysis())};}});await api.search(searchInput);const first=api.analyze(analyzeInput),second=api.analyze(analyzeInput);await assert.rejects(()=>api.analyze({...analyzeInput,requestId:'web-ai-another-request'}),fails('busy',409));await assert.rejects(()=>createWebResearch(options).analyze(analyzeInput),fails('uncertain',409));release();assert.deepEqual(await first,await second);assert.equal(calls,1);
});
test('returned records are defensive copies and cannot inject private fields into cached prompt',async t=>{
 let captured;const {api}=fixture(t,{analyzeText:async args=>{captured=args;return {text:JSON.stringify(analysis())};}});const found=await api.search(searchInput);found.sources[0].snippet='PRIVATE-INJECTION';api.status().recent[0].sources[0].title='PRIVATE-INJECTION';api.getSearch(found.id).query='PRIVATE-INJECTION';await api.analyze(analyzeInput);assert.equal(captured.prompt.includes('PRIVATE-INJECTION'),false);
});
test('simultaneous duplicate request results are also defensive copies',async t=>{
 let release;const pending=new Promise(resolve=>release=resolve);const {api}=fixture(t,{searchClient:async()=>{await pending;return sources();}});
 const first=api.search(searchInput),duplicate=api.search(searchInput);release();await first;const result=await duplicate;result.query='MUTATED';result.sources[0].snippet='PRIVATE';assert.equal(api.getSearch(searchInput.requestId).query,searchInput.query);assert.notEqual(api.getSearch(searchInput.requestId).sources[0].snippet,'PRIVATE');
});
test('status diagnostics count even failed searches without counting replay or analysis',async t=>{
 const {api}=fixture(t,{maxSearchCalls:1});await api.search(searchInput);await api.search(searchInput);await api.analyze(analyzeInput);assert.deepEqual(api.status().diagnostics,{searchCalls:1,maxSearchCalls:1});
});
test('corruption after startup is preserved and blocks calls before they leave the process',async t=>{
 let calls=0;const {api,dir}=fixture(t,{searchClient:async()=>{calls++;return sources();}});const file=path.join(dir,'records.json');fs.writeFileSync(file,'externally-corrupted');await assert.rejects(()=>api.search(searchInput),fails('storage',500));assert.equal(calls,0);assert.equal(fs.readFileSync(file,'utf8'),'externally-corrupted');assert.equal(api.status().recent.length,0);
});
test('cached unknown fields and tampered analysis cannot become a public response',async t=>{
 const {api,dir,options}=fixture(t);await api.search(searchInput);await api.analyze(analyzeInput);const file=path.join(dir,'records.json'),original=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const modify of [state=>{state.searches[0].apiKey='do-not-serve';},state=>{state.searches[0].sources[0].privateNotes='do-not-serve';},state=>{state.analyses[0].result.metadata.apiKey='do-not-serve';},state=>{state.searches[0].analysis.topics[0].sourceIds=['S99'];}]){
  const tampered=structuredClone(original);modify(tampered);const bytes=JSON.stringify(tampered);fs.writeFileSync(file,bytes);assert.throws(()=>createWebResearch(options),fails('storage',500));assert.equal(fs.readFileSync(file,'utf8'),bytes);
 }
});
