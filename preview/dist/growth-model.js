(function(){
 'use strict';
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.prototype.toString.call(value)==='[object Object]';
 const profiles=['positioning','audience','promise'];
 const types={
  reference:{collection:'references',fields:{summary:8000,note:16000,status:80},tags:true,url:true},
  benchmark:{collection:'benchmarks',fields:{platform:80,kind:80,topic:160,hook:5000,structure:8000,evidence:8000,learning:8000,difference:8000,note:16000},url:true,observedAt:true},
  research:{collection:'research',fields:{question:8000,note:16000},tags:true}
 };
 function object(value,label){if(!record(value))throw Error(label+'格式不正确');return value;}
 function text(value,label,limit=8000,required=false){
  if(value===undefined){if(required)throw Error(label+'不能为空');return '';}
  if(typeof value!=='string')throw Error(label+'必须是文字');
  const out=value.trim();
  if(required&&!out)throw Error(label+'不能为空');
  if(out.length>limit)throw Error(label+'不能超过'+limit+'个字符');
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(out))throw Error(label+'包含无效控制字符');
  return out;
 }
 function list(value,label,limit=60){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>200)throw Error(label+'必须是最多200项的文字列表');
  return [...new Set(Array.from(value,item=>text(item,label,limit,true)))];
 }
 function timestamp(value,label){if(!Number.isSafeInteger(value)||value<0)throw Error(label+'必须是有效时间');return value;}
 function safeUrl(value){
  const input=text(value,'来源网址',2000);if(!input)return '';
  try{
   if(/[\s\u0000-\u001f\u007f]/.test(input))throw Error();
   const url=new URL(input);
   if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error();
   for(const key of url.searchParams.keys())if(/^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|cookie|authorization)$/i.test(key))throw Error();
   if(url.href.length>2000)throw Error();
   return url.href;
  }catch{throw Error('来源网址必须是HTTP或HTTPS公开链接，不能包含凭据');}
 }
 function observation(value){
  const input=text(value,'观察日期',40);if(!input)return '';
  const day=input.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('观察日期不正确');
  const date=new Date(day+'T12:00:00Z');
  if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==day)throw Error('观察日期不正确');
  if(input===day)return input;
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input)||!Number.isFinite(Date.parse(input)))throw Error('观察日期不正确');
  return input;
 }
 function profileData(input){
  object(input,'IP方向');const out={};
  for(const key of profiles)out[key]=text(input[key],'IP '+key,4000);
  out.pillars=list(input.pillars,'内容支柱',500);out.series=list(input.series,'内容系列',1000);return out;
 }
 function empty(){return {version:1,modifiedAt:0,references:[],benchmarks:[],research:[],profile:{positioning:'',audience:'',promise:'',pillars:[],series:[]}};}
 function recordData(kind,input){
  object(input,'资料');const spec=types[kind],createdAt=timestamp(input.createdAt,'创建时间'),updatedAt=timestamp(input.updatedAt,'修改时间');
  if(updatedAt<createdAt)throw Error('修改时间不能早于创建时间');
  const out={id:text(input.id,'资料ID',150,true),title:text(input.title,'标题',160,true)};
  if(spec.url)out.url=safeUrl(input.url);
  for(const [key,limit]of Object.entries(spec.fields))out[key]=text(input[key],key,limit);
  if(spec.tags)out.tags=list(input.tags,'标签');
  if(spec.observedAt)out.observedAt=observation(input.observedAt);
  out.createdAt=createdAt;out.updatedAt=updatedAt;return out;
 }
 function normalizeState(input){
  object(input,'成长资料');if(input.version!==1)throw Error('无法识别成长资料版本');
  const out=empty();out.modifiedAt=timestamp(input.modifiedAt,'资料修改时间');
  for(const [kind,spec]of Object.entries(types)){
   const items=input[spec.collection];if(!Array.isArray(items))throw Error(spec.collection+'必须是资料列表');
   const seen=new Set();out[spec.collection]=Array.from(items,item=>{const value=recordData(kind,item);if(seen.has(value.id))throw Error('资料ID重复');seen.add(value.id);return value;});
  }
  out.profile=profileData(input.profile);return out;
 }
 let sequence=0;
 function newId(kind){
  if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return kind+'-'+crypto.randomUUID();
  sequence+=1;return kind+'-'+Date.now().toString(36)+'-'+sequence.toString(36)+'-'+Math.random().toString(36).slice(2,10);
 }
 function change(kind,state,input,key,remove=false){
  const out=normalizeState(state),spec=types[kind],items=out[spec.collection];
  const index=key===undefined?-1:items.findIndex(item=>item.id===key);
  if(key!==undefined&&index<0)throw Error('这条资料不存在，请刷新后重试');
  if(remove){items.splice(index,1);out.modifiedAt=Math.max(Date.now(),out.modifiedAt+1);return out;}
  object(input,'资料');const previous=index>=0?items[index]:null;
  const now=Math.max(Date.now(),out.modifiedAt+1,previous?previous.updatedAt+1:0);
  const source={...(previous||{}),...input,id:previous?previous.id:newId(kind),createdAt:previous?previous.createdAt:now,updatedAt:now};
  if(kind==='reference'&&!own(source,'status'))source.status='待整理';
  const value=recordData(kind,source);
  if(previous)items[index]=value;else items.push(value);
  out.modifiedAt=now;return out;
 }
 function mutationId(value){return text(value,'资料ID',150,true);}
 // Every mutation returns a complete, independent growth state. The caller's
 // state is unchanged even when validation fails; IDs/createdAt survive edits.
 const addReference=(state,input)=>change('reference',state,input);
 const updateReference=(state,id,input)=>change('reference',state,input,mutationId(id));
 const deleteReference=(state,id)=>change('reference',state,undefined,mutationId(id),true);
 const addBenchmark=(state,input)=>change('benchmark',state,input);
 const updateBenchmark=(state,id,input)=>change('benchmark',state,input,mutationId(id));
 const deleteBenchmark=(state,id)=>change('benchmark',state,undefined,mutationId(id),true);
 const addResearch=(state,input)=>change('research',state,input);
 const updateResearch=(state,id,input)=>change('research',state,input,mutationId(id));
 const deleteResearch=(state,id)=>change('research',state,undefined,mutationId(id),true);
 function updateProfile(state,input){
  const out=normalizeState(state);object(input,'IP方向');
  out.profile=profileData({...out.profile,...input});out.modifiedAt=Math.max(Date.now(),out.modifiedAt+1);return out;
 }
 const words=value=>typeof value==='string'?value:Array.isArray(value)?value.filter(item=>typeof item==='string').join(' '):'';
 const rows=value=>Array.isArray(value)?value:[];
 const cleanTime=value=>Number.isFinite(value)?value:typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
 function searchRecords(input={},query='',kind='all'){
  object(input,'搜索资料');const q=typeof query==='string'?query.trim().toLowerCase():'',results=[],seen=new Set();
  const sourceLabel={reference:'我的参考',benchmark:'我的对标',research:'研究主题',topic:'我的选题',task:'我的任务',idea:'我的想法',project:'项目资料',work:'作品资料',skill:'Skill说明',knowledge:'知识入口',news:'公开资讯缓存',tool:'工具说明',section:'工作台板块'};
  // Explicit searchable fields avoid indexing unknown private objects or
  // credential fields. No network request, score or business-effect claim.
  const fields=['title','name','summary','body','description','desc','note','question','tags','status','category','next','nextAction','problem','steps','result','resultNote','check','feedback','evidence','resultEvidence','actualResult','actualEvidence','completionNote','verificationStatus','sourceLabel','lane','platform','kind','topic','hook','structure','learning','difference','url','capability','benefit','cases','trial','criteria','limits','whenToUse','input','output','acceptance','help','relevance','sourceName','promise','audience','positioning','pillars','series'];
  function include(type,item,label,action='growth-open'){
   if(!record(item)||typeof item.id!=='string'||!item.id.trim())return;
   const title=words(item.title)||words(item.name);if(!title.trim())return;
   if(kind!=='all'&&type!==kind)return;
   const content=fields.map(field=>words(item[field]));
   for(const ref of [...rows(item.evidence),...rows(item.relatedPaths)])if(record(ref))content.push(words(ref.note),words(ref.excerpt),words(ref.quote),words(ref.path));
   if(record(item.source))content.push(words(item.source.label));
   if(record(item.platforms))for(const platform of Object.values(item.platforms))if(record(platform))content.push(words(platform.url),words(platform.note));
   if(q&&!content.join(' ').toLowerCase().includes(q))return;
   const unique=type+':'+action+':'+item.id;if(seen.has(unique))return;seen.add(unique);
   const summary=words(item.summary)||words(item.topic)||words(item.learning)||words(item.question)||words(item.body)||words(item.note)||words(item.desc)||words(item.description)||words(item.next)||words(item.nextAction)||words(item.problem)||words(item.capability)||words(item.help)||words(item.evidence)||words(item.result)||words(item.resultNote)||words(item.hook);
   results.push({kind:type,id:item.id,title:title.trim(),summary:summary.trim().slice(0,400),sourceLabel:label||sourceLabel[type],updatedAt:cleanTime(item.updatedAt??item.modifiedAt??item.sourceUpdatedAt??item.observedAt??item.publishedAt??item.fetchedAt??item.createdAt),action});
  }
  const growth=record(input.growth)?input.growth:{},state=record(input.state)?input.state:{},library=record(input.library)?input.library:{};
  for(const [type,spec]of Object.entries(types))for(const item of rows(growth[spec.collection]))include(type,item);
  for(const [collection,type]of [['topics','topic'],['tasks','task'],['ideas','idea']])for(const item of rows(state[collection]))include(type,item);
  for(const [collection,type]of [['projects','project'],['works','work'],['ideas','idea'],['skills','skill'],['knowledge','knowledge']])for(const item of rows(library[collection]))include(type,item,type==='idea'?'资料中的想法':undefined);
  for(const item of rows(library.distillations))include('knowledge',item,'方法与案例','distill-card');
  const news=Array.isArray(input.news)?input.news:input.news?.items;
  for(const item of rows(news))include('news',item,typeof item?.source==='string'?item.source:undefined);
  for(const item of rows(input.tools))include('tool',item);
  for(const item of rows(input.sections))include('section',item);
  return results;
 }
 const api={empty,normalizeState,addReference,updateReference,deleteReference,addBenchmark,updateBenchmark,deleteBenchmark,addResearch,updateResearch,deleteResearch,updateProfile,searchRecords};
 if(typeof window!=='undefined')window.WBGrowthModel=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
