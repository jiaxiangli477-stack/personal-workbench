'use strict';
// A review marker is a workflow guard, not proof that a method works.
// The controller still checks original sources and the stated evidence limits.
function reviewedCards(document={},options={}){
 const issues=[],cards=[],seen=new Set(),clean=options.redact||String;
 if(!document||document.reviewStatus!=='controller-reviewed')return {cards,issues};
 if(!Array.isArray(document.cards))return {cards,issues:[{id:'collection',reason:'cards必须为数组'}]};
 const strings=value=>(Array.isArray(value)?value:typeof value==='string'?[value]:[]).map(x=>clean(x)).filter(x=>x.trim());
 for(const source of document.cards){
  const id=source?.id||'unknown';
  const fail=reason=>issues.push({id,reason});
  if(!/^[a-z][a-z0-9-]{2,80}$/.test(id)||!['case','method','opportunity'].includes(source.kind)){fail('卡片身份或类型不正确');continue;}
  if(seen.has(id)){fail('卡片ID重复');continue;}
  if(['title','summary','whenToUse','output','status'].some(k=>typeof source[k]!=='string'||!source[k].trim())){fail('缺少用途、结论或状态');continue;}
  if(!Array.isArray(source.evidence)||!source.evidence.length||source.evidence.some(r=>!r||typeof r.path!=='string'||!Number.isInteger(r.line)||r.line<1||!r.note)){fail('缺少可追溯的原始证据');continue;}
  const input=strings(source.input),steps=strings(source.steps),acceptance=strings(source.acceptance),limits=strings(source.limits);
  if(!input.length||steps.length<3||steps.length>7||acceptance.length<2||!limits.length){fail('缺少输入、步骤、检查或适用边界');continue;}
  if(!source.nextAction?.title||!Number.isFinite(source.nextAction.minutes)||source.nextAction.minutes<5||source.nextAction.minutes>60){fail('下一步时间须为5至60分钟的小行动建议');continue;}
  const card={...source,input,steps,acceptance,limits,evidence:source.evidence.map(r=>({...r,note:clean(r.note),...(r.quote?{quote:clean(r.quote)}:{})})),nextAction:{title:clean(source.nextAction.title),minutes:source.nextAction.minutes}};
  for(const k of ['title','summary','whenToUse','output','status'])card[k]=clean(card[k]);
  for(const k of ['projectIds','workIds','knowledgeIds','skillNames'])card[k]=strings(source[k]);
  card.publicationStatus=clean(source.publicationStatus||'公开前仍需核对资料权限与事实');
  seen.add(id);cards.push(card);
 }
 return {cards,issues};
}
module.exports={reviewedCards};
