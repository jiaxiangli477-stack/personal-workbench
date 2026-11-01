'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../dist/model.js'),library=require('../lib/library.cjs');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function uiSetup(file,factory,state=M.empty()){
  const captured={html:'',saved:0,modals:0,closed:0,rendered:0},sandbox={window:{},FormData:class{constructor(form){return form.fields;}},document:{querySelector:()=>({close:()=>captured.closed++,focus:()=>{}})}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),sandbox);
  const ctx={M,esc,icon:()=>'',badge:t=>`<span>${esc(t)}</span>`,heading:(t,s,a='')=>`<h2>${t}</h2><p>${s}</p>${a}`,modal:(t,html)=>{captured.html=html;captured.modals++;},toast:()=>{},getState:()=>state,save:()=>captured.saved++,render:()=>captured.rendered++,tasksHTML:()=>'',D:{tools:[]},isReady:()=>true};
  return {ui:sandbox.window[factory](ctx,{openTopic:()=>{}}),state,captured};
}
test('existing v2 content and compliant extra fields survive normalize and a real disk round trip',t=>{
  const original={version:2,modifiedAt:123,ownerLabel:'fixture only',notes:{home:'原备注'},reviews:{daily:{'2026-10-30':['原复盘']},weekly:{},monthly:{}},tasks:[{id:'original-task',title:'原任务',minutes:20,date:'2026-10-30',doneAt:321,extra:{retained:true}}],topics:[{id:'original-topic',title:'原选题',createdAt:111,problem:'原问题',steps:'原操作',result:'原结果',check:'原验收',feedback:'原反馈',status:'制作中',extra:{retained:true},source:{type:'work',id:'w1',label:'原作品',observedAt:'2026-10-30'},platforms:{小红书:{status:'已发',url:'https://example.org/old',date:'2026-10-30',views:12},抖音:{status:'草稿',url:'',date:''},视频号:{status:'未做',url:'',date:''}}}]};
  const normalized=M.normalizeState(original);
  assert.equal(normalized.version,2);assert.equal(normalized.ownerLabel,'fixture only');assert.deepEqual(normalized.topics[0].extra,{retained:true});assert.equal(normalized.topics[0].source.observedAt,'2026-10-30');assert.equal(normalized.topics[0].platforms.小红书.views,12);
  const root=path.resolve(__dirname,'../evidence'),dir=fs.mkdtempSync(path.join(root,'v05-topic-'));
  t.after(()=>{assert.ok(dir.startsWith(root+path.sep));fs.rmSync(dir,{recursive:true,force:true});});
  library.writeState(dir,normalized);const restored=M.normalizeState(library.readState(dir));
  assert.equal(restored.notes.home,'原备注');assert.deepEqual(restored.reviews.daily,original.reviews.daily);assert.equal(restored.tasks[0].id,'original-task');assert.equal(restored.tasks[0].doneAt,321);assert.deepEqual(restored.tasks[0].extra,{retained:true});
  for(const key of ['problem','steps','result','check','feedback'])assert.equal(restored.topics[0][key],original.topics[0][key]);assert.equal(restored.topics[0].createdAt,111);assert.equal(restored.topics[0].platforms.小红书.date,'2026-10-30');assert.equal(restored.topics[0].platforms.抖音.status,'草稿');
});
test('reference benchmark and research topics retain optional fields on create update and restore',()=>{
  const s=M.empty();for(const type of ['reference','benchmark','research']){
    const t=M.addTopic(s,{title:type,source:{type,id:type+'-1',label:'公开来源'},audience:'给同行',problem:'受众的问题',nextAction:'做一次最小实践',resultEvidence:'https://example.org/evidence',verificationStatus:'人工确认'});
    M.updateTopic(s,t.id,{title:type+' updated'});const r=M.restore(JSON.stringify(s)).topics.find(x=>x.id===t.id);
    assert.equal(r.source.type,type);assert.equal(r.audience,'给同行');assert.equal(r.nextAction,'做一次最小实践');assert.equal(r.resultEvidence,'https://example.org/evidence');assert.equal(r.verificationStatus,'人工确认');assert.equal(M.topicStep(r),'做一次最小实践');
  }
});
test('task results preserve links independently of completion and do not claim verification',()=>{
  const s=M.empty(),task=M.addTask(s,'执行下一步',20,{sourceType:'topic',sourceId:'topic-1',resultNote:'初次结果',resultEvidence:'D:/Codex/fixture.png'});
  assert.equal(task.resultNote,'初次结果');assert.equal(task.resultEvidence,'D:/Codex/fixture.png');assert.equal(task.verificationStatus,'待验证');
  M.toggleTask(s,task.id);assert.equal(task.verificationStatus,'待验证');
  M.recordTaskResult(s,task.id,{resultNote:'补充后的实际结果',resultEvidence:'https://example.org/result',verificationStatus:'人工确认'});
  const doneAt=task.doneAt;M.toggleTask(s,task.id);assert.equal(task.doneAt,null);assert.equal(task.verificationStatus,'人工确认');M.toggleTask(s,task.id);assert.ok(task.doneAt>=doneAt);
  const restored=M.restore(JSON.stringify(s)).tasks[0];assert.equal(restored.sourceId,'topic-1');assert.equal(restored.resultNote,'补充后的实际结果');assert.equal(restored.resultEvidence,'https://example.org/result');assert.equal(M.recordTaskResult(s,'missing',{}),null);
});
test('topic editor keeps three progressive sections mounted and uses human source labels',()=>{
  const {ui,state,captured}=uiSetup('topic-ui.js','WBTopicUI');
  const topic=M.addTopic(state,{title:'旧卡',source:{type:'reference',id:'r1',label:'文章标题'},steps:'旧操作',result:'旧结果',check:'旧验收',feedback:'旧反馈'});
  M.addTask(state,'实践任务',20,{sourceType:'topic',sourceId:topic.id,resultNote:'<b>实际结果</b>',resultEvidence:'fixture证据'});ui.edit(topic.id);
  assert.equal((captured.html.match(/<details\b/g)||[]).length,3);assert.ok(captured.html.indexOf('name="nextAction"')<captured.html.indexOf('<details'));
  for(const field of ['audience','problem','nextAction','steps','result','check','resultEvidence','verificationStatus','feedback'])assert.ok(captured.html.includes(`name="${field}"`),field);
  assert.ok(captured.html.includes('参考资料'));assert.equal(captured.html.includes(' · reference'),false);assert.ok(captured.html.includes('旧操作'));assert.ok(captured.html.includes('旧反馈'));assert.ok(captured.html.includes('&lt;b&gt;实际结果&lt;/b&gt;'));assert.ok(captured.html.includes('fixture证据'));
});
test('topic form saves optional fields and schedules the actual next action with its topic link',()=>{
  const {ui,state}=uiSetup('topic-ui.js','WBTopicUI');ui.create({title:'new',source:{type:'research',id:'r1',label:'研究'}});
  const fields=new Map([['title','标题'],['audience','同行'],['problem','真实问题'],['nextAction','录一段实际操作'],['status','候选'],['resultEvidence','证据'],['verificationStatus','待验证']]);
  assert.equal(ui.submit({getAttribute:()=> 'topic-form',fields}),true);const topic=state.topics[0];assert.equal(topic.audience,'同行');assert.equal(topic.resultEvidence,'证据');
  ui.handle('topic-task',{dataset:{id:topic.id}});assert.ok(state.tasks[0].title.includes('录一段实际操作'));assert.equal(state.tasks[0].sourceId,topic.id);assert.ok(state.tasks[0].body.includes('真实问题'));
});
test('checking any task allows later results without an automatic modal',()=>{
  const {ui,state,captured}=uiSetup('daily-ui.js','WBDailyUI');const task=M.addTask(state,'工具试用',20,{sourceType:'trial',sourceId:'fixture'});ui.toggle(task.id);assert.ok(task.doneAt);assert.equal(captured.modals,0);assert.equal(task.verificationStatus,'待验证');
});
test('home continues one genuinely unpublished card and keeps the existing weekly target',()=>{
  const {ui,state}=uiSetup('daily-ui.js','WBDailyUI');M.addTopic(state,{title:'不应继续的已发卡',status:'已发'});M.addTopic(state,{title:'平台已发卡',platforms:{抖音:{status:'已发',date:M.todayKey()}}});const draft=M.addTopic(state,{title:'待推进的卡',nextAction:'补操作证据',status:'制作中'});
  const html=ui.home({connected:true,projects:[]});assert.ok(html.includes('待推进的卡'));assert.ok(html.includes('继续选题'));assert.equal((html.match(/data-action="topic-edit"/g)||[]).length,1);assert.ok(html.includes('目标 3 条'));assert.equal(html.includes('不应继续的已发卡'),false);assert.ok(html.includes('补操作证据'));
  state.topics=state.topics.filter(x=>x.id!==draft.id);assert.ok(ui.home({connected:true,projects:[]}).includes('没有待继续的选题'));
});
test('task detail saves actual results and can return to its source topic without marking it complete',()=>{
  const initial=M.empty(),topic=M.addTopic(initial,{title:'来源选题'}),task=M.addTask(initial,'执行任务',20,{sourceType:'topic',sourceId:topic.id,body:'<script>fixture</script>',evidence:'原验收要求'});
  const listeners={},nodes=new Map(),captured={};
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',hidden:false,open:false,classList:{add(){},remove(){},contains(){return false;},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);};
  const location={hash:'#home'},document={querySelector:node,querySelectorAll:()=>[],addEventListener:(type,fn)=>listeners[type]=fn},storage=new Map([['personal-workbench.preview.v1',JSON.stringify(initial)]]);
  const sandbox={window:{WBModel:M,WBData:{sections:[{id:'home',name:'今天',short:'今天',icon:'home',desc:'描述'}]},addEventListener(){},scrollTo(){},WBEnrich:ctx=>{captured.ctx=ctx;return {isReady:()=>true,persist:async()=>{},handleClick:(action,el)=>{if(action==='topic-edit'){captured.returnTopic=el.dataset.id;return true;}return false;},handleSubmit:()=>false,views:{home:()=>''},init(){}};}},document,location,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},FormData:class{constructor(form){return form.fields;}},setTimeout:()=>0,clearTimeout(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8'),sandbox);
  const click=(action,id)=>listeners.click({target:{closest:()=>({dataset:{action,id}})}});click('task',task.id);
  const html=node('#dialog-content').innerHTML;assert.ok(html.includes('id="task-result-form"'));assert.ok(html.includes('name="resultNote"'));assert.ok(html.includes('name="resultEvidence"'));assert.ok(html.includes('name="verificationStatus"'));assert.ok(html.includes('data-action="topic-edit"'));assert.ok(html.includes('来源选题'));assert.equal(html.includes('<script>fixture</script>'),false);
  listeners.submit({preventDefault(){},target:{id:'task-result-form',getAttribute:()=> 'task-result-form',matches:()=>true,fields:new Map([['taskId',task.id],['resultNote','实际完成的结果'],['resultEvidence','D:/Codex/fixture.png'],['verificationStatus','人工确认']])}});
  const saved=captured.ctx.getState().tasks[0];assert.equal(saved.resultNote,'实际完成的结果');assert.equal(saved.resultEvidence,'D:/Codex/fixture.png');assert.equal(saved.verificationStatus,'人工确认');assert.equal(saved.doneAt,null);
  click('topic-edit',topic.id);assert.equal(captured.returnTopic,topic.id);
});
