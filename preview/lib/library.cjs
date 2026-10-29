'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const previewExtensions=new Set(['.md','.txt','.mp4','.webm','.png','.jpg','.jpeg','.webp','.gif','.pdf']);
function redact(value){return String(value??'')
 .replace(/\b(?:sk-|sk-proj-)[A-Za-z0-9_-]{15,}/g,'[密钥已脱敏]')
 .replace(/(["']?(?:api[_ -]?key|token|password|secret|cookie|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|Bearer\s+[^\s\n,;}]+|[^\s\n,;}]+)/gi,'$1[已脱敏]')
 .replace(/(?:vless|vmess|trojan):\/\/[^\s]+/gi,'[节点凭据已隐藏]');}
function json(file,fallback={}){try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{return fallback;}}
function fileId(p){return crypto.createHash('sha256').update(path.resolve(p).toLowerCase()).digest('hex').slice(0,24);}
function buildCatalog(projectInput={},knowledgeInput={}){
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
 catalog.counts=Object.fromEntries(['projects','works','ideas','skills','knowledge'].map(k=>[k,catalog[k].length]));
 return {catalog,files};
}
function loadCatalog(dir){const result=buildCatalog(json(path.join(dir,'intake-projects.json')),json(path.join(dir,'intake-knowledge.json')));for(const w of result.catalog.works)if(w.fileId&&fs.existsSync(path.join(dir,'thumbnails',w.fileId+'.jpg')))w.thumbnailUrl='/api/thumbnail/'+w.fileId;return result;}
function validateState(value){
 if(!value||value.version!==1)throw Error('无法识别记录版本');
 const out={version:1,modifiedAt:Number.isFinite(value.modifiedAt)?value.modifiedAt:Date.now(),done:{},trials:[],notes:{},reviews:{},tasks:[],ideas:[],connection:{}};
 const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
 for(const k of ['done','notes','reviews'])if(record(value[k]))out[k]=value[k];
 for(const k of ['trials','tasks','ideas'])if(Array.isArray(value[k]))out[k]=value[k].slice(0,1000);
 if(record(value.connection))for(const k of ['provider','baseUrl','model','purpose'])if(typeof value.connection[k]==='string')out.connection[k]=value.connection[k].slice(0,1000);
 if(out.connection.baseUrl){const u=new URL(out.connection.baseUrl);if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw Error('连接草稿需要不含凭据或查询参数的HTTPS地址，或本机HTTP地址');}
 return out;
}
function readState(dir){return json(path.join(dir,'user-state.json'),null);}
function writeState(dir,value){const valid=validateState(value);fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'user-state.json');if(fs.existsSync(file))fs.copyFileSync(file,path.join(dir,'user-state.previous.json'));const temp=file+'.writing';fs.writeFileSync(temp,JSON.stringify(valid,null,2),'utf8');fs.renameSync(temp,file);return valid;}
function backupState(dir){const state=readState(dir);if(!state)throw Error('还没有可以备份的本地记录');const folder=path.join(dir,'backups');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,'workbench-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');fs.writeFileSync(file,JSON.stringify(state,null,2));return file;}
module.exports={redact,buildCatalog,loadCatalog,validateState,readState,writeState,backupState,previewExtensions};
