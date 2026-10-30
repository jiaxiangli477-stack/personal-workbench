'use strict';
const fs=require('node:fs');const path=require('node:path');
const DEFAULT_FILE=path.resolve(__dirname,'../../.secrets/api-connections.private.v2.ini');
const SPECS=[
 {id:'primary',name:'主线路 · 深空',host:'xkrelay.com',section:'主线路',text:'密钥1_主用国模',image:'密钥2_主用生图',routes:{text:'/v1/chat/completions',image:'/v1/images/generations'}},
 {id:'backup',name:'备用线路 · TokenStation',host:'tokenstation.top',section:'备用线路',text:'密钥3_备用国模',image:'密钥4_备用生图',routes:{text:'/chat/completions',image:'/v1/images/generations'}}
];
const MODELS={text:'deepseek-v4.1-flash',image:'gpt-image-2'};
function parseConfig(text){
 const sections=Object.create(null);let current;
 for(const raw of String(text).replace(/^\uFEFF/,'').split(/\r?\n/)){
  if(/^\s*[;#]/.test(raw)||!raw.trim())continue;
  const heading=/^\s*\[([^\]]+)\]\s*$/.exec(raw);
  if(heading){if(sections[heading[1]])throw Error('连接表有重复分区，请核对本机文件');current=sections[heading[1]]=Object.create(null);continue;}
  const i=raw.indexOf('=');if(!current||i<1)continue;const key=raw.slice(0,i).trim();if(Object.hasOwn(current,key))throw Error('连接表有重复字段，请核对本机文件');current[key]=raw.slice(i+1).trim();
 }
 const providers=SPECS.map(spec=>{
  const baseUrl=sections[spec.section]?.['基础地址URL']||'https://'+spec.host;
  let base;try{base=new URL(baseUrl);}catch{throw Error('连接表的基础地址格式不正确');}
  if(base.protocol!=='https:'||base.hostname!==spec.host||base.username||base.password||base.search||base.hash||(base.port&&base.port!=='443')||!['/','/v1','/v1/'].includes(base.pathname))throw Error('连接表地址必须是对应服务商的HTTPS基础地址');
  const keys={},models={...MODELS};
  for(const kind of ['text','image']){
   const row=sections[spec[kind]]||{};const key=row.API_KEY||'';
   keys[kind]=['待填写','不知道'].includes(key)?'':key;
   if(keys[kind]&&!/^[A-Za-z0-9._~+\/-]{8,512}$/.test(keys[kind]))throw Error('密钥格式不正确，请核对本机填写表');
   if(row['模型名称']&&row['模型名称']!=='不知道'&&row['模型名称']!==MODELS[kind])throw Error('模型名称与本轮约定不同，请核对填写表');
  }
  return {id:spec.id,name:spec.name,host:spec.host,baseUrl:base.href,origin:base.origin,keys,models,routes:{...spec.routes}};
 });
 return {providers};
}
function loadConfig(file=DEFAULT_FILE){try{return parseConfig(fs.readFileSync(file,'utf8'));}catch(error){if(error.code==='ENOENT')return {...parseConfig(''),notice:'尚未找到本机密钥填写表'};throw error;}}
function endpointFor(provider,kind){if(!['text','image'].includes(kind))throw Error('未知能力');return provider.origin+provider.routes[kind];}
function publicConfig(config){return {notice:config.notice||null,providers:config.providers.map(p=>({id:p.id,name:p.name,baseUrl:p.baseUrl,capabilities:Object.fromEntries(['text','image'].map(kind=>[kind,{configured:!!p.keys[kind],model:p.models[kind],endpoint:endpointFor(p,kind)}]))}))};}
module.exports={DEFAULT_FILE,parseConfig,loadConfig,publicConfig,endpointFor};
