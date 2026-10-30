'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const zlib=require('node:zlib');
const {parseConfig,publicConfig,endpointFor}=require('../lib/ai-config.cjs');
const {createRelay}=require('../lib/ai-relay.cjs');
const {imageInfo}=require('../lib/ai-images.cjs');
const fixture=()=>`[主线路]\n基础地址URL=https://xkrelay.com\n[备用线路]\n基础地址URL=https://tokenstation.top\n[密钥1_主用国模]\n模型名称=deepseek-v4.1-flash\nAPI_KEY=fixture-primary-text-0001\n[密钥2_主用生图]\n模型名称=gpt-image-2\nAPI_KEY=fixture-primary-image-0002\n[密钥3_备用国模]\n模型名称=deepseek-v4.1-flash\nAPI_KEY=fixture-backup-text-0003\n[密钥4_备用生图]\n模型名称=gpt-image-2\nAPI_KEY=fixture-backup-image-0004`;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function png(w,h){
 function chunk(type,data){const typeData=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff;for(const b of typeData){crc^=b;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);typeData.copy(out,4);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.alloc((w*3+1)*h))),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
function relay(t,fetchImpl){const dir=path.resolve(__dirname,'../evidence','ai-unit-'+process.pid+'-'+Math.random().toString(16).slice(2));fs.mkdirSync(dir,{recursive:true});t.after(()=>{if(!dir.startsWith(path.resolve(__dirname,'../evidence')+path.sep))throw Error('unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});});return {...createRelay({configLoader:()=>parseConfig(fixture()),localDir:dir,fetchImpl}),testDir:dir};}
test('provider-specific paths do not conflate text and image or duplicate v1',()=>{
 const c=parseConfig(fixture());assert.equal(endpointFor(c.providers[0],'text'),'https://xkrelay.com/v1/chat/completions');assert.equal(endpointFor(c.providers[1],'text'),'https://tokenstation.top/chat/completions');assert.equal(endpointFor(c.providers[1],'image'),'https://tokenstation.top/v1/images/generations');
 const versioned=parseConfig(fixture().replace('https://xkrelay.com','https://xkrelay.com/v1'));assert.equal(endpointFor(versioned.providers[0],'image'),'https://xkrelay.com/v1/images/generations');
});
test('public status never contains credential values',()=>{const c=parseConfig(fixture()),value=JSON.stringify(publicConfig(c));for(const p of c.providers)for(const key of Object.values(p.keys))assert.equal(value.includes(key),false);assert.equal(publicConfig(c).providers[0].capabilities.text.configured,true);});
test('configuration refuses external hosts, embedded credential URLs and duplicate sections',()=>{
 for(const url of ['https://evil.test','http://xkrelay.com','https://xkrelay.com?key=abc','https://name:secret@xkrelay.com','https://xkrelay.com/other'])assert.throws(()=>parseConfig(fixture().replace('https://xkrelay.com',url)));
 assert.throws(()=>parseConfig(fixture()+'\n[主线路]\n基础地址URL=https://xkrelay.com'));
});
test('text sends only explicit prompt and secret header, then idempotently reuses result',async t=>{
 const calls=[];const r=relay(t,async(url,options)=>{calls.push({url,options});return json({choices:[{message:{content:'OK'}}],usage:{total_tokens:8}});});
 const input={prompt:'Reply OK',requestId:'text-request-000001'};const first=await r.run('text',input),second=await r.run('text',input);assert.equal(first.text,'OK');assert.deepEqual(second,first);assert.equal(calls.length,1);assert.equal(first.provider,'primary');assert.deepEqual(JSON.parse(calls[0].options.body).messages,[{role:'user',content:'Reply OK'}]);assert.equal(JSON.stringify(first).includes('fixture-'),false);
 await assert.rejects(()=>r.run('text',{...input,prompt:'different'}));
});
test('HTML200 is a failure; text can fall back once to independently configured backup',async t=>{
 const urls=[];const r=relay(t,async url=>{urls.push(url);return urls.length===1?new Response('<html>app</html>',{headers:{'Content-Type':'text/html'}}):json({choices:[{message:{content:'备用结果'}}]});});const out=await r.run('text',{prompt:'公开测试',requestId:'text-fallback-00001'});assert.equal(out.provider,'backup');assert.equal(out.usedFallback,true);assert.match(urls[1],/tokenstation\.top\/chat\/completions$/);assert.equal(out.attempts.length,2);
});
test('explicit no-route503 image falls back once and reports real size mismatch',async t=>{
 let calls=0;const r=relay(t,async()=>++calls===1?json({error:{message:'No available route for model gpt-image-2 right now'}},503):json({data:[{b64_json:png(1254,1254)}]}));
 const out=await r.run('image',{prompt:'A blue ceramic teapot',requestId:'image-fallback-0001'});assert.equal(calls,2);assert.equal(out.provider,'backup');assert.equal(out.width,1254);assert.equal(out.height,1254);assert.equal(out.sizeMatches,false);assert.equal(fs.existsSync(r.imageFile(out.imageId)),true);assert.match(out.imageUrl,/^\/api\/ai\/image\/[a-f0-9]{24}$/);
});
test('image timeout does not issue another generation or claim clear billing',async t=>{
 let calls=0;const r=relay(t,async()=>{calls++;throw Error('timeout');});await assert.rejects(()=>r.run('image',{prompt:'public image',requestId:'image-timeout-00001'}),e=>e.code==='uncertain'&&e.attempts.length===1);assert.equal(calls,1);
});
test('ambiguous upstream image500 does not trigger backup',async t=>{let calls=0;const r=relay(t,async()=>{calls++;return json({error:{message:'upstream failure'}},500);});await assert.rejects(()=>r.run('image',{prompt:'public image',requestId:'image-server-500-001'}),e=>e.code==='upstream');assert.equal(calls,1);});
test('a task-bearing rejection never sends a second image generation',async t=>{let calls=0;const r=relay(t,async()=>{calls++;return json({taskId:'already-started',error:{message:'No available route'}},503);});await assert.rejects(()=>r.run('image',{prompt:'public image',requestId:'image-task-bearing-1'}),e=>e.attempts.length===1);assert.equal(calls,1);});
test('an image already returned but failing download never triggers backup generation',async t=>{
 let calls=0;const r=relay(t,async()=>{calls++;return json({data:[{url:'http://127.0.0.1/private'}]});});await assert.rejects(()=>r.run('image',{prompt:'public image',requestId:'image-download-0001'}),e=>e.code==='image_download'&&e.attempts.length===1);assert.equal(calls,1);
});
test('provider errors redact exact keys and bearer tokens before status or history',async t=>{
 const r=relay(t,async()=>json({error:{message:'fixture-primary-image-0002 Bearer private-diagnostic-secret'}},401));await assert.rejects(()=>r.run('text',{prompt:'test',requestId:'redact-request-001'}),e=>!JSON.stringify(e.attempts).includes('fixture-')&&!JSON.stringify(e.attempts).includes('private-diagnostic-secret'));assert.equal(JSON.stringify(r.status()).includes('fixture-'),false);
});
test('known credentials in a prompt and malformed IDs never reach a provider',async t=>{
 let calls=0;const r=relay(t,async()=>{calls++;return json({});});await assert.rejects(()=>r.run('text',{prompt:'fixture-primary-text-0001',requestId:'reject-secret-00001'}));await assert.rejects(()=>r.run('text',{prompt:'test',requestId:'../bad'}));assert.equal(calls,0);assert.equal(r.imageFile('../../private'),null);
});
test('in-flight duplicate joins the existing job and other submissions are rejected',async t=>{
 let calls=0,release;const gate=new Promise(resolve=>{release=resolve;});const r=relay(t,async()=>{calls++;await gate;return json({choices:[{message:{content:'OK'}}]});});const input={prompt:'test',requestId:'concurrent-request-1'};const a=r.run('text',input),b=r.run('text',input);await assert.rejects(()=>r.run('text',{prompt:'another',requestId:'concurrent-request-2'}),e=>e.code==='busy');release();assert.deepEqual(await a,await b);assert.equal(calls,1);
});
test('successful provider output survives local final-save failure without a second billable request',async t=>{
 let calls=0,renames=0;const rename=fs.renameSync;const r=relay(t,async()=>{calls++;return json({choices:[{message:{content:'primary result'}}]});});
 fs.renameSync=function(...args){if(++renames===2)throw Error('synthetic final save failure');return rename.apply(this,args);};
 try{const out=await r.run('text',{prompt:'test',requestId:'storage-failure-0001'});assert.equal(out.provider,'primary');assert.equal(out.text,'primary result');assert.ok(out.storageWarning);assert.equal(calls,1);}finally{fs.renameSync=rename;}
});
test('PNG must have complete verified chunks, pixel data and end marker',()=>{
 const valid=Buffer.from(png(2,3),'base64');assert.deepEqual(imageInfo(valid),{width:2,height:3,extension:'png'});
 const header=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(header);header.write('IHDR',12);header.writeUInt32BE(1024,16);header.writeUInt32BE(1024,20);
 assert.throws(()=>imageInfo(header));assert.throws(()=>imageInfo(valid.subarray(0,valid.length-12)));
 const broken=Buffer.from(valid);broken[broken.length-20]^=1;assert.throws(()=>imageInfo(broken));
});
test('truncated image response never triggers another provider generation',async t=>{let calls=0;const r=relay(t,async()=>{calls++;return json({data:[{b64_json:Buffer.from(png(1,1),'base64').subarray(0,24).toString('base64')}]});});await assert.rejects(()=>r.run('image',{prompt:'test image',requestId:'truncated-image-001'}),e=>e.code==='image_download');assert.equal(calls,1);});
test('unsupported JPEG or WebP cannot masquerade as a verified image',()=>{const b=Buffer.alloc(24);b[0]=255;b[1]=216;b[2]=255;b[3]=192;b.writeUInt16BE(17,4);b.writeUInt16BE(1024,7);b.writeUInt16BE(1024,9);b[12]=255;b[13]=218;b[22]=255;b[23]=217;assert.throws(()=>imageInfo(b),/PNG/);const webp=Buffer.alloc(40);webp.write('RIFF',0);webp.write('WEBP',8);assert.throws(()=>imageInfo(webp),/PNG/);});
test('completed request recovers after service recreation without another provider call',async t=>{let calls=0;const r=relay(t,async()=>{calls++;return json({choices:[{message:{content:'durable result'}}]});});const input={prompt:'test',requestId:'restart-recovery-001'};const original=await r.run('text',input);const restored=createRelay({configLoader:()=>parseConfig(fixture()),localDir:r.testDir,fetchImpl:async()=>{calls++;throw Error('must not call');}});assert.deepEqual(await restored.run('text',input),original);assert.equal(calls,1);});
test('interrupted reserved request refuses regeneration after service recreation',async t=>{let calls=0;const r=relay(t,async()=>{calls++;return json({});});const crypto=require('node:crypto');const prompt='test';const record={requestId:'interrupted-request1',kind:'image',fingerprint:crypto.createHash('sha256').update('image\0'+prompt).digest('hex'),status:'processing',createdAt:new Date().toISOString()};fs.mkdirSync(path.join(r.testDir,'ai-results'),{recursive:true});fs.writeFileSync(path.join(r.testDir,'ai-results','runs.json'),JSON.stringify([record]));const restored=createRelay({configLoader:()=>parseConfig(fixture()),localDir:r.testDir,fetchImpl:async()=>{calls++;return json({});}});await assert.rejects(()=>restored.run('image',{prompt,requestId:record.requestId}),e=>e.code==='uncertain');assert.equal(calls,0);});
