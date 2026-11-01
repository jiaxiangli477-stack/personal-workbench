'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {normalizeState}=require('../dist/growth-model.js');

function directory(dir){
 if(typeof dir!=='string'||!path.isAbsolute(dir))throw Error('成长资料目录必须为绝对路径');
 const resolved=path.resolve(dir);
 if(process.platform==='win32'&&!/^[DE]:\\/i.test(resolved))throw Error('成长资料只允许保存到D盘或E盘');
 // A junction may make a D/E path resolve onto the system drive. Resolve
 // the nearest existing parent before mkdir, including for a new folder.
 let ancestor=resolved;
 while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw Error('成长资料目录不可用');ancestor=parent;}
 const actual=fs.realpathSync(ancestor);
 if(process.platform==='win32'&&!/^[DE]:\\/i.test(actual))throw Error('成长资料实际目录必须位于D盘或E盘');
 return resolved;
}
function regularFile(file){
 try{const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('成长资料不能使用符号链接');if(!stat.isFile())throw Error('成长资料路径必须是文件');return true;}
 catch(error){if(error.code==='ENOENT')return false;throw error;}
}
function parse(bytes){
 let input;try{input=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('成长资料文件损坏，已停止覆盖，请先核对本地备份');}
 return normalizeState(input);
}
function readGrowth(dir){
 const file=path.join(directory(dir),'growth-state.json');
 if(!regularFile(file))return null;
 return parse(fs.readFileSync(file));
}
function atomic(file,bytes){
 const temporary=file+'.writing';let created=false;
 // Exclusive creation refuses an old/foreign staging file instead of
 // truncating it. Only a staging file created in this call may be removed.
 try{
  const fd=fs.openSync(temporary,'wx',0o600);created=true;
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temporary,file);created=false;
 }finally{
  if(created)try{fs.unlinkSync(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}
 }
}
function writeGrowth(dir,value,options={}){
 // Validate both incoming and existing data before creating or changing
 // anything. A corrupt primary is never treated as an empty state.
 const valid=normalizeState(value),folder=directory(dir),file=path.join(folder,'growth-state.json'),previous=path.join(folder,'growth-state.previous.json');
 const exists=regularFile(file),bytes=exists?fs.readFileSync(file):null;
 const current=bytes?parse(bytes):null;
 if(Object.hasOwn(options,'expectedModifiedAt')){const expected=options.expectedModifiedAt;if(!Number.isSafeInteger(expected)||expected<0)throw Error('资料版本不正确，请重新读取');if(expected!==(current?.modifiedAt||0))throw Object.assign(Error('另一窗口已更新资料；当前填写已保留，请先重新读取资料再保存'),{code:'conflict'});valid.modifiedAt=Math.max(valid.modifiedAt,(current?.modifiedAt||0)+1,Date.now());}
 if(exists)regularFile(previous);
 fs.mkdirSync(folder,{recursive:true});
 if(bytes)atomic(previous,bytes);
 atomic(file,Buffer.from(JSON.stringify(valid,null,2)+'\n','utf8'));
 return valid;
}
module.exports={readGrowth,writeGrowth};
