const {test}=require('node:test'),assert=require('node:assert/strict');
const allowed=(headers,url='/library.js')=>require('../lib/http-guard.cjs').allowRequest({headers:{host:'localhost:8869',...headers},url},8869);
test('same-origin app requests work but cross-origin localhost scripts cannot read snapshots',()=>{
 assert.equal(allowed({'sec-fetch-site':'same-origin','sec-fetch-mode':'no-cors'}),true);
 assert.equal(allowed({'sec-fetch-site':'same-site','sec-fetch-mode':'no-cors'}),false);
 assert.equal(allowed({origin:'http://localhost:9999'}),false);
});
test('external navigation can open the homepage, never a private API or snapshot',()=>{
 const h={'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate'};assert.equal(allowed(h,'/'),true);assert.equal(allowed(h,'/api/library'),false);assert.equal(allowed(h),false);assert.equal(allowed({host:'evil.test:8869'}),false);
});
