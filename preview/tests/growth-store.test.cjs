'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const store=()=>require('../lib/growth-store.cjs');
const model=()=>require('../dist/growth-model.js');
const base=path.resolve(__dirname,'../evidence');
function fixture(t){
 fs.mkdirSync(base,{recursive:true});
 const dir=fs.mkdtempSync(path.join(base,'v05-growth-'));
 if(process.platform==='win32')assert.match(dir,/^[DE]:\\/i);
 t.after(()=>{const resolved=path.resolve(dir);if(!resolved.startsWith(base+path.sep))throw Error('unsafe cleanup');fs.rmSync(resolved,{recursive:true,force:true});});
 return dir;
}

test('missing growth data is null; valid records persist and previous backup is the exact prior bytes',t=>{
 const dir=fixture(t),m=model(),s=store(),file=path.join(dir,'growth-state.json'),previous=path.join(dir,'growth-state.previous.json');
 assert.equal(s.readGrowth(dir),null);
 const first=m.addReference(m.empty(),{title:'第一份资料'});assert.deepEqual(s.writeGrowth(dir,first),first);assert.deepEqual(s.readGrowth(dir),first);assert.equal(fs.existsSync(previous),false);
 const original=fs.readFileSync(file),second=m.addResearch(first,{title:'第二份研究'});s.writeGrowth(dir,second);
 assert.ok(fs.readFileSync(previous).equals(original));assert.deepEqual(s.readGrowth(dir),second);assert.equal(fs.readdirSync(dir).some(name=>name.endsWith('.writing')),false);
 const prior=fs.readFileSync(file);s.writeGrowth(dir,m.updateProfile(second,{audience:'同行'}));assert.ok(fs.readFileSync(previous).equals(prior));
});

test('invalid incoming data cannot replace either the primary file or its backup',t=>{
 const dir=fixture(t),s=store(),m=model();s.writeGrowth(dir,m.addReference(m.empty(),{title:'旧记录'}));s.writeGrowth(dir,m.addReference(m.empty(),{title:'当前记录'}));
 const file=path.join(dir,'growth-state.json'),previous=path.join(dir,'growth-state.previous.json'),before=fs.readFileSync(file),backup=fs.readFileSync(previous);
 assert.throws(()=>s.writeGrowth(dir,{version:1,references:'bad'}));assert.ok(fs.readFileSync(file).equals(before));assert.ok(fs.readFileSync(previous).equals(backup));
});

test('corrupt existing files throw on both read and write and are never silently overwritten',t=>{
 const dir=fixture(t),s=store(),file=path.join(dir,'growth-state.json'),previous=path.join(dir,'growth-state.previous.json');
 for(const raw of ['{broken','null','{"version":1,"references":{}}']){
  fs.writeFileSync(file,raw);fs.writeFileSync(previous,'keep-backup');
  assert.throws(()=>s.readGrowth(dir));assert.throws(()=>s.writeGrowth(dir,model().empty()));assert.equal(fs.readFileSync(file,'utf8'),raw);assert.equal(fs.readFileSync(previous,'utf8'),'keep-backup');
 }
});

test('write and rename failures retain the primary bytes and a recoverable previous copy',t=>{
 const dir=fixture(t),s=store(),m=model();s.writeGrowth(dir,m.addReference(m.empty(),{title:'保留的旧记录'}));
 const file=path.join(dir,'growth-state.json'),previous=path.join(dir,'growth-state.previous.json'),before=fs.readFileSync(file),next=m.addResearch(m.empty(),{title:'新研究'}),rename=fs.renameSync;
 fs.renameSync=function(from,to){if(to===file){const error=new Error('fixture rename failure');error.code='EIO';throw error;}return rename.apply(this,arguments);};
 try{assert.throws(()=>s.writeGrowth(dir,next),/fixture rename failure/);}finally{fs.renameSync=rename;}
 assert.ok(fs.readFileSync(file).equals(before));assert.ok(fs.readFileSync(previous).equals(before));assert.equal(fs.readdirSync(dir).some(name=>name.endsWith('.writing')),false);
});

test('backup failure stops before replacing primary data',t=>{
 const dir=fixture(t),s=store(),m=model();s.writeGrowth(dir,m.addReference(m.empty(),{title:'不能丢失'}));
 const file=path.join(dir,'growth-state.json'),previous=path.join(dir,'growth-state.previous.json'),before=fs.readFileSync(file);
 fs.mkdirSync(previous);
 assert.throws(()=>s.writeGrowth(dir,m.empty()));assert.ok(fs.readFileSync(file).equals(before));
});

test('staging-write failure leaves both the primary and existing backup unchanged',t=>{
 const dir=fixture(t),s=store(),m=model();s.writeGrowth(dir,m.addReference(m.empty(),{title:'上一份'}));s.writeGrowth(dir,m.addResearch(m.empty(),{title:'当前份'}));
 const file=path.join(dir,'growth-state.json'),previous=path.join(dir,'growth-state.previous.json'),before=fs.readFileSync(file),backup=fs.readFileSync(previous),write=fs.writeFileSync;
 fs.writeFileSync=function(){throw new Error('fixture write failure');};
 try{assert.throws(()=>s.writeGrowth(dir,m.empty()),/fixture write failure/);}finally{fs.writeFileSync=write;}
 assert.ok(fs.readFileSync(file).equals(before));assert.ok(fs.readFileSync(previous).equals(backup));assert.equal(fs.readdirSync(dir).some(name=>name.endsWith('.writing')),false);
});

test('a foreign staging file is preserved and cannot be truncated by a retry',t=>{
 const dir=fixture(t),s=store(),m=model();s.writeGrowth(dir,m.addReference(m.empty(),{title:'现存资料'}));
 const file=path.join(dir,'growth-state.json'),stage=file+'.writing',before=fs.readFileSync(file);fs.writeFileSync(stage,'foreign-staging-data');
 assert.throws(()=>s.writeGrowth(dir,m.empty()));assert.equal(fs.readFileSync(stage,'utf8'),'foreign-staging-data');assert.ok(fs.readFileSync(file).equals(before));
});

test('store rejects relative paths and symlinked state files',t=>{
 const dir=fixture(t),s=store();assert.throws(()=>s.readGrowth('relative-path'));assert.throws(()=>s.writeGrowth('relative-path',model().empty()));
 if(process.platform==='win32'){assert.throws(()=>s.writeGrowth('C:\\fixture-not-allowed',model().empty()));return;}
 const target=path.join(dir,'target.json');fs.writeFileSync(target,JSON.stringify(model().empty()));fs.symlinkSync(target,path.join(dir,'growth-state.json'));assert.throws(()=>s.readGrowth(dir),/符号链接/);assert.throws(()=>s.writeGrowth(dir,model().empty()),/符号链接/);
});

test('Windows directory junctions cannot redirect a D-drive write to the C drive',t=>{
 const dir=fixture(t),s=store();if(process.platform!=='win32')return;
 // Simulate the real path of a junction without creating any C-drive files.
 const realpath=fs.realpathSync;
 fs.realpathSync=function(value){return path.resolve(value)===dir?'C:\\fixture-disallowed':realpath.apply(this,arguments);};
 try{assert.throws(()=>s.readGrowth(dir),/实际目录/);assert.throws(()=>s.writeGrowth(dir,model().empty()),/实际目录/);}finally{fs.realpathSync=realpath;}
 assert.deepEqual(fs.readdirSync(dir),[]);
});
