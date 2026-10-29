const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(){const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/model.js'),'utf8'),ctx);return ctx.window.WBModel;}
test('tasks can be completed and reopened without affecting other tasks',()=>{const m=load(),s=m.empty();m.toggleTask(s,'a');assert.equal(s.done.a,true);assert.equal(s.done.b,undefined);m.toggleTask(s,'a');assert.equal(s.done.a,false);});
test('tool trial creates a single linked task even when added twice',()=>{const m=load(),s=m.empty();assert.equal(m.addTrial(s,'grok'),true);assert.equal(m.addTrial(s,'grok'),false);assert.equal(s.trials.length,1);});
test('trial can be removed and added again',()=>{const m=load(),s=m.empty();m.addTrial(s,'grok');m.removeTrial(s,'grok');assert.equal(s.trials.length,0);assert.equal(m.addTrial(s,'grok'),true);});
test('notes and task state survive serialization',()=>{const m=load(),s=m.empty();s.notes.home='下次先看资讯';m.toggleTask(s,'a');const restored=m.restore(JSON.stringify(s));assert.equal(restored.notes.home,s.notes.home);assert.equal(restored.done.a,true);});
test('corrupt or incompatible stored state safely falls back',()=>{const m=load();for(const raw of ['{','null','{"version":200}','{"version":1,"done":null,"notes":42,"trials":"oops"}']){const s=m.restore(raw);assert.equal(s.version,1);assert.ok(Array.isArray(s.trials));assert.equal(typeof s.notes,'object');assert.ok(s.done);}});
test('blank tasks are rejected and valid custom tasks preserved',()=>{const m=load(),s=m.empty();assert.equal(m.addTask(s,'  ',20),null);const t=m.addTask(s,'整理一个案例',20);assert.equal(t.title,'整理一个案例');assert.equal(s.tasks.length,1);assert.equal(m.restore(JSON.stringify(s)).tasks[0].title,t.title);});
