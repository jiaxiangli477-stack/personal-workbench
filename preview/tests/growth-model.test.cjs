'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const model=()=>require('../dist/growth-model.js');

test('growth model exports the same browser and Node API with an independent empty state',()=>{
 const m=model(),context={window:{},URL};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../dist/growth-model.js'),'utf8'),context);
 assert.deepEqual(Object.keys(context.window.WBGrowthModel).sort(),Object.keys(m).sort());
 const first=m.empty(),second=m.empty();
 assert.deepEqual(first,{version:1,modifiedAt:0,references:[],benchmarks:[],research:[],profile:{positioning:'',audience:'',promise:'',pillars:[],series:[]}});
 first.profile.pillars.push('第一份');assert.equal(second.profile.pillars.length,0);
});

test('reference CRUD is immutable and retains stable identity and creation time',()=>{
 const m=model(),original=m.empty(),before=JSON.stringify(original);
 const added=m.addReference(original,{title:'  公开参考  ',url:'https://example.org/reference',tags:[' 外贸 ','外贸'],note:''});
 assert.equal(JSON.stringify(original),before);assert.equal(added.references.length,1);
 const first=added.references[0];assert.equal(first.title,'公开参考');assert.deepEqual(first.tags,['外贸']);assert.ok(first.id);assert.ok(first.createdAt>0);assert.ok(first.updatedAt>=first.createdAt);assert.ok(added.modifiedAt>=first.updatedAt);
 const edited=m.updateReference(added,first.id,{title:'修改后的参考',summary:'真正读到的内容',id:'replacement',createdAt:1});
 assert.equal(added.references[0].title,'公开参考');assert.equal(edited.references[0].id,first.id);assert.equal(edited.references[0].createdAt,first.createdAt);assert.equal(edited.references[0].summary,'真正读到的内容');
 const other=m.addReference(edited,{title:'另一个参考'}),removed=m.deleteReference(other,first.id);
 assert.equal(other.references.length,2);assert.equal(removed.references.length,1);assert.equal(removed.references[0].title,'另一个参考');
 assert.throws(()=>m.updateReference(edited,'missing',{title:'不会创建'}),/不存在/);
 assert.throws(()=>m.deleteReference(edited,'missing'),/不存在/);
});

test('benchmark and research CRUD support optional notes and an empty observation date',()=>{
 const m=model(),original=m.empty();
 const benchmark=m.addBenchmark(original,{title:'拆解样例',platform:'视频号',url:'https://example.org/video',kind:'内容',topic:'买家问题',hook:'开头问题',structure:'问题到操作',evidence:'仅原文，效果未核实',learning:'讲解顺序',difference:'使用自己的实践',observedAt:''});
 const b=benchmark.benchmarks[0];assert.equal(b.note,'');assert.equal(b.observedAt,'');assert.equal(original.benchmarks.length,0);
 const edited=m.updateBenchmark(benchmark,b.id,{note:'继续核对',observedAt:'2026-11-01'});assert.equal(edited.benchmarks[0].id,b.id);assert.equal(benchmark.benchmarks[0].note,'');assert.equal(edited.benchmarks[0].createdAt,b.createdAt);
 assert.equal(m.deleteBenchmark(edited,b.id).benchmarks.length,0);assert.equal(edited.benchmarks.length,1);
 const research=m.addResearch(edited,{title:'研究一个问题',question:'需要哪些证据？',tags:['资料']});
 const r=research.research[0],updated=m.updateResearch(research,r.id,{note:'先看公开来源'});
 assert.equal(updated.research[0].question,'需要哪些证据？');assert.equal(updated.research[0].note,'先看公开来源');assert.equal(research.research[0].note,'');assert.equal(m.deleteResearch(updated,r.id).research.length,0);
});

test('invalid text and credential URLs fail without changing the caller state',()=>{
 const m=model(),s=m.addReference(m.empty(),{title:'原记录',url:'https://example.org'}),before=JSON.stringify(s);
 for(const input of [{title:'  '},{title:{text:'对象'}},{title:'x'.repeat(161)},{title:'错误\u0000文本'},{title:'坏链接',url:'javascript:alert(1)'},{title:'坏链接',url:'file:///D:/private.txt'},{title:'坏链接',url:'https://user:password@example.org/'},{title:'坏链接',url:'https://example.org/?api_key=fixture-only'},{title:'坏标签',tags:[{name:'不是字符串'}]}])assert.throws(()=>m.addReference(s,input));
 assert.throws(()=>m.updateReference(s,s.references[0].id,{url:'https://user@example.org'}));
 assert.throws(()=>m.addBenchmark(s,{title:'坏日期',observedAt:'2026-02-30'}));
 assert.equal(JSON.stringify(s),before);
});

test('normalization refuses malformed saved records instead of silently removing them',()=>{
 const m=model(),s=m.addResearch(m.empty(),{title:'保留旧记录'}),before=JSON.stringify(s);
 for(const bad of [null,[],{version:2},{version:1},{...s,references:{}},{...s,research:[null]},{...s,research:[{...s.research[0],id:''}]},{...s,research:[{...s.research[0],updatedAt:'yesterday'}]},{...s,research:[s.research[0],s.research[0]]},{...s,profile:{...s.profile,pillars:'错误结构'}}])assert.throws(()=>m.normalizeState(bad));
 assert.equal(JSON.stringify(s),before);
});

test('missing mutation IDs never add a replacement record or delete the final record',()=>{
 const m=model(),s=m.addResearch(m.addBenchmark(m.addReference(m.empty(),{title:'参考'}),{title:'对标'}),{title:'研究'}),before=JSON.stringify(s);
 for(const kind of ['Reference','Benchmark','Research']){
  assert.throws(()=>m['update'+kind](s,undefined,{title:'不能被添加'}));
  assert.throws(()=>m['delete'+kind](s,undefined));
 }
 assert.equal(JSON.stringify(s),before);
});

test('sparse record and text lists are invalid rather than becoming null after a save',()=>{
 const m=model(),s=m.empty();
 assert.throws(()=>m.normalizeState({...s,references:new Array(1)}));
 assert.throws(()=>m.addReference(s,{title:'坏标签列表',tags:new Array(1)}));
});

test('normalization whitelists fields and profile changes do not introduce operational claims',()=>{
 const m=model(),s=m.addReference(m.empty(),{title:'资料',apiKey:'fixture-only',metadata:{password:'fixture-only'}});
 s.apiKey='fixture-only';s.unknown={private:'fixture-only'};s.references[0].cookie='fixture-only';s.profile.secret='fixture-only';
 const normalized=m.normalizeState(s);assert.equal(JSON.stringify(normalized).includes('fixture-only'),false);
 const profile=m.updateProfile(normalized,{positioning:'  用实践分享AI工作方法  ',audience:'外贸运营同行',promise:'说明操作与验收',pillars:['外贸','网站'],series:['一次真实操作'],metrics:{sales:999},token:'fixture-only'});
 assert.equal(profile.profile.positioning,'用实践分享AI工作方法');assert.equal(profile.profile.audience,'外贸运营同行');assert.deepEqual(profile.profile.series,['一次真实操作']);assert.equal(normalized.profile.positioning,'');assert.equal(profile.profile.metrics,undefined);
 assert.throws(()=>m.updateProfile(profile,{series:[{title:'未知结构'}]}));
 assert.deepEqual(m.normalizeState(JSON.parse(JSON.stringify(profile))),profile);
});

test('search covers content in every workbench collection and returns stable source-aware results',()=>{
 const m=model();let growth=m.addReference(m.empty(),{title:'参考标题',note:'共同关键词'});
 growth=m.addBenchmark(growth,{title:'对标标题',evidence:'共同关键词，效果未核实'});growth=m.addResearch(growth,{title:'研究标题',question:'共同关键词'});
 const input={growth,state:{topics:[{id:'topic1',title:'选题标题',steps:'共同关键词'}],tasks:[{id:'task1',title:'任务标题',result:'共同关键词'}],ideas:[{id:'idea1',title:'想法标题',body:'共同关键词'}]},library:{projects:[{id:'project1',title:'项目标题',next:'共同关键词'}],works:[{id:'work1',title:'作品标题',summary:'共同关键词'}],skills:[{id:'skill1',title:'技能标题',body:'共同关键词',featured:false}],knowledge:[{id:'knowledge1',title:'知识标题',summary:'共同关键词'}],distillations:[{id:'card1',title:'方法标题',steps:['共同关键词']}]},news:{items:[{id:'news1',title:'资讯标题',summary:'共同关键词',source:'官方公开来源'}]},tools:[{id:'tool1',name:'工具标题',capability:'共同关键词'}],sections:[{id:'section1',name:'板块标题',help:'共同关键词'}]};
 const results=m.searchRecords(input,'  共同关键词  ');
 assert.equal(results.length,14);assert.equal(new Set(results.map(r=>r.kind)).size,13);
 for(const result of results){assert.deepEqual(Object.keys(result).sort(),['action','id','kind','sourceLabel','summary','title','updatedAt'].sort());assert.equal(typeof result.action,'string');assert.equal(typeof result.sourceLabel,'string');assert.ok(result.sourceLabel);assert.equal(result.score,undefined);}
 assert.equal(results.find(r=>r.kind==='news').sourceLabel,'官方公开来源');assert.equal(results.find(r=>r.id==='card1').action,'distill-card');
 assert.deepEqual(m.searchRecords(input,'共同关键词'),results);assert.equal(m.searchRecords(input,'共同关键词','reference').length,1);assert.equal(m.searchRecords(input,'不存在的关键词').length,0);
 assert.equal(m.searchRecords(input,'技能标题','skill')[0].id,'skill1');
});

test('search ignores unknown or sensitive objects and never invents missing source IDs or online evidence',()=>{
 const m=model(),input={state:{ideas:[{title:'没有ID',body:'字段'}],tasks:[{id:'t',title:'任务',body:'正常',apiKey:'不应可搜',private:{text:'不应可搜'}}]},news:[{id:'n',title:'缓存资讯',summary:'正文'}],library:{knowledge:[{id:'k',title:'知识',secret:{text:'不应可搜'}}]}};
 assert.equal(m.searchRecords(input,'不应可搜').length,0);assert.equal(m.searchRecords(input,'没有ID').length,0);
 assert.equal(m.searchRecords(input,'缓存资讯')[0].sourceLabel,'公开资讯缓存');
 assert.deepEqual(m.searchRecords({},''),[]);
});

test('search includes newly recorded task results and topic next actions',()=>{
 const input={state:{tasks:[{id:'done-task',title:'操作任务',resultNote:'已确认的操作结果',resultEvidence:'公开证据链接'}],topics:[{id:'next-topic',title:'后续选题',nextAction:'后续的可执行动作',audience:'外贸运营同行',resultEvidence:'人工核对证据'}]}};
 assert.equal(model().searchRecords(input,'已确认的操作结果')[0]?.id,'done-task');
 assert.equal(model().searchRecords(input,'后续的可执行动作')[0]?.id,'next-topic');
 assert.equal(model().searchRecords(input,'外贸运营同行')[0]?.id,'next-topic');
 assert.equal(model().searchRecords(input,'人工核对证据')[0]?.id,'next-topic');
});

test('search keeps distinct knowledge entries and method cards even when source IDs match',()=>{
 const input={library:{knowledge:[{id:'shared',title:'共同资料入口',summary:'入口'}],distillations:[{id:'shared',title:'共同方法卡片',steps:['方法步骤']}]}};
 assert.equal(model().searchRecords(input,'共同').length,2);
});
