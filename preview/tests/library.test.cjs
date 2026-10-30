const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const lib=()=>require('../lib/library.cjs');
const base=path.resolve(__dirname,'../evidence/library-test');
test('real references get stable IDs; unsupported secret files are never previewed',()=>{
 fs.mkdirSync(base,{recursive:true});const doc=path.join(base,'readme.md'),secret=path.join(base,'.env');fs.writeFileSync(doc,'# 案例');fs.writeFileSync(secret,'fixture-only');
 const {catalog,files}=lib().buildCatalog({projects:[{id:'p',title:'真实项目',evidence:[{path:doc,note:'存在'},{path:secret,note:'不可预览'}]}]},{});
 assert.ok(catalog.projects[0].evidence[0].fileId);assert.equal(catalog.projects[0].evidence[1].fileId,undefined);assert.equal(files.size,1);assert.equal(lib().buildCatalog({projects:[{id:'p',evidence:[{path:doc}]}]},{}).catalog.projects[0].evidence[0].fileId,catalog.projects[0].evidence[0].fileId);
});
test('source text redacts likely credentials without losing normal context',()=>{
 const s=lib().redact('正常说明\napi_key=sk-test-abcdefghijklmnopqrstuvwxyz0123456789\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789');assert.ok(s.includes('正常说明'));assert.ok(!s.includes('sk-test-'));assert.ok(!s.includes('Bearer abcdef'));
});
test('quoted JSON credentials are redacted too',()=>{for(const s of ['{"api_key":"fixture-token-1234567890"}','{"Authorization":"Bearer fixture-token-1234567890"}'])assert.ok(!lib().redact(s).includes('fixture-token'));});
test('connection drafts only retain non-sensitive settings',()=>{
 const s=lib().validateState({version:1,done:{a:true},tasks:[],ideas:[],notes:{home:'记录'},reviews:{},trials:[],connection:{provider:'compatible',baseUrl:'https://example.com/v1',model:'example',apiKey:'do-not-store'}});assert.equal(s.connection.baseUrl,'https://example.com/v1');assert.equal(s.connection.apiKey,undefined);assert.equal(s.notes.home,'记录');
 assert.throws(()=>lib().validateState({version:200}));
});
test('state is durable and previous copy survives another write',t=>{
 fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'state-'));t.after(()=>{if(!dir.startsWith(base+path.sep))throw Error('unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});});lib().writeState(dir,{version:1,notes:{home:'first'}});lib().writeState(dir,{version:1,notes:{home:'second'}});assert.equal(lib().readState(dir).notes.home,'second');assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'user-state.previous.json'),'utf8')).notes.home,'first');
});
