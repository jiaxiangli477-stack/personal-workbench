'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {reviewedCards}=require('./distillations.cjs');
const previewExtensions=new Set(['.md','.txt','.mp4','.webm','.png','.jpg','.jpeg','.webp','.gif','.pdf']);
function redact(value){return String(value??'')
 .replace(/\b(?:sk-|sk-proj-)[A-Za-z0-9_-]{15,}/g,'[密钥已脱敏]')
 .replace(/(["']?(?:api[_ -]?key|token|password|secret|cookie|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|Bearer\s+[^\s\n,;}]+|[^\s\n,;}]+)/gi,'$1[已脱敏]')
 .replace(/(?:vless|vmess|trojan):\/\/[^\s]+/gi,'[节点凭据已隐藏]');}
function json(file,fallback={}){try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{return fallback;}}
function fileId(p){return crypto.createHash('sha256').update(path.resolve(p).toLowerCase()).digest('hex').slice(0,24);}
function buildCatalog(projectInput={},knowledgeInput={},distillationInput={}){
 const files=new Map();
 function reference(ref){
  const r=typeof ref==='string'?{path:ref}:({...ref});if(!r.path||typeof r.path!=='string')return r;
  const absolute=path.resolve(r.path);r.exists=false;
  try { const stat=fs.statSync(absolute);r.exists=true;r.modifiedAt=stat.mtime.toISOString();
   if(stat.isFile()&&previewExtensions.has(path.extname(absolute).toLowerCase())&&!path.basename(absolute).startsWith('.')){
    r.fileId=fileId(absolute);r.bytes=stat.size;files.set(r.fileId,{id:r.fileId,path:absolute,size:stat.size,modifiedAt:r.modifiedAt,ext:path.extname(absolute).toLowerCase()});
   }
  }catch{}
  if(r.note)r.note=redact(r.note);return r;
 }
 const mapRecord=r=>{
  const item={...r};for(const k of ['title','summary','body','next','status'])if(typeof item[k]==='string')item[k]=redact(item[k]);
  if(item.path)Object.assign(item,reference({path:item.path}));
  if(item.path&&!item.exists){item.sourceStatus=item.status;item.status='原件当前不存在，需核对路径';}
  if(Array.isArray(item.evidence))item.evidence=item.evidence.map(reference);
  if(Array.isArray(item.relatedPaths))item.relatedPaths=item.relatedPaths.map(reference);
  return item;
 };
 const catalog={version:2,updatedAt:new Date().toISOString(),projects:(projectInput.projects||[]).map(mapRecord),works:(projectInput.works||[]).map(mapRecord),ideas:(projectInput.ideas||[]).map(mapRecord),skills:(knowledgeInput.skills||[]).map(mapRecord),knowledge:(knowledgeInput.knowledge||[]).map(mapRecord),coverage:{projects:projectInput.coverage||{},knowledge:knowledgeInput.coverage||{}}};
 const distilled=reviewedCards(distillationInput,{redact});catalog.distillations=distilled.cards.map(mapRecord);catalog.distillationIssues=distilled.issues;catalog.distillationReview={reviewedAt:distillationInput.reviewedAt||null,reviewStatus:distillationInput.reviewStatus||'none'};
 catalog.counts=Object.fromEntries(['projects','works','ideas','skills','knowledge','distillations'].map(k=>[k,catalog[k].length]));
 return {catalog,files};
}
function loadCatalog(dir){const result=buildCatalog(json(path.join(dir,'intake-projects.json')),json(path.join(dir,'intake-knowledge.json')),json(path.join(dir,'distillations.json')));for(const w of result.catalog.works)if(w.fileId&&fs.existsSync(path.join(dir,'thumbnails',w.fileId+'.jpg')))w.thumbnailUrl='/api/thumbnail/'+w.fileId;return result;}
function validateState(value){
 if(!value||![1,2].includes(value.version))throw Error('无法识别记录版本');
 const out=require('../dist/model.js').normalizeState(value);if(!Number.isFinite(value.modifiedAt))out.modifiedAt=Date.now();
 if(out.connection.baseUrl){const u=new URL(out.connection.baseUrl);if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw Error('连接草稿需要不含凭据或查询参数的HTTPS地址，或本机HTTP地址');}
 return out;
}
function readState(dir){return json(path.join(dir,'user-state.json'),null);}
function writeState(dir,value){const valid=validateState(value);fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'user-state.json'),before=path.join(dir,'user-state.before-v2.json'),previous=path.join(dir,'user-state.previous.json');if(fs.existsSync(file)&&readState(dir)?.version===1&&!fs.existsSync(before)){try{fs.copyFileSync(file,before,fs.constants.COPYFILE_EXCL);}catch(error){if(error.code!=='EEXIST')throw error;}}if(!fs.existsSync(file)&&value.version===1&&!fs.existsSync(before))fs.writeFileSync(before,JSON.stringify(value,null,2),{flag:'wx'});if(fs.existsSync(file)&&(!fs.existsSync(previous)||Math.floor(fs.statSync(previous).mtimeMs/60000)!==Math.floor(Date.now()/60000)))fs.copyFileSync(file,previous);const temp=file+'.writing';fs.writeFileSync(temp,JSON.stringify(valid,null,2),'utf8');fs.renameSync(temp,file);return valid;}
function backupState(dir){const state=readState(dir);if(!state)throw Error('还没有可以备份的本地记录');const folder=path.join(dir,'backups');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,'workbench-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');fs.writeFileSync(file,JSON.stringify(state,null,2));return file;}
function backupLegacyState(dir,value){if(!value||value.version!==1)throw Error('只备份旧版浏览器记录');const normalized=validateState(value),bytes=Buffer.from(JSON.stringify(value,null,2)),hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex'),folder=path.join(dir,'backups');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,'browser-before-v2-'+hash.slice(0,20)+'.json');if(!fs.existsSync(file))fs.writeFileSync(file,bytes,{flag:'wx'});if(!fs.readFileSync(file).equals(bytes))throw Error('浏览器旧记录备份不一致');const result={path:file,sha256:hash,counts:{tasks:normalized.tasks.length,trials:normalized.trials.length,ideas:normalized.ideas.length,reviews:Object.fromEntries(['daily','weekly','monthly'].map(k=>[k,Object.keys(normalized.reviews[k]).length])),notes:Object.keys(normalized.notes).length}};fs.writeFileSync(path.join(folder,'browser-before-v2-manifest.json'),JSON.stringify(result,null,2));return result;}
module.exports={redact,buildCatalog,loadCatalog,validateState,readState,writeState,backupState,backupLegacyState,previewExtensions};
