'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const url='http://localhost:8869';
async function health(){try{const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(1000)});const j=await r.json();return j.name==='personal-workbench';}catch{return false;}}
(async()=>{if(!await health()){
 const dir=path.resolve(__dirname,'local-data');fs.mkdirSync(dir,{recursive:true});
 const log=fs.openSync(path.join(dir,'server.log'),'a');
 const child=spawn(process.execPath,[path.join(__dirname,'server.cjs')],{cwd:__dirname,detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();fs.closeSync(log);
 let ready=false;for(let n=0;n<25;n++){if(await health()){ready=true;break;}await new Promise(r=>setTimeout(r,200));}
 if(!ready){console.error('本机服务未启动。请检查8869端口是否被占用；记录位于preview/local-data/server.log。');process.exitCode=1;return;}
 }
 const child=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,windowsHide:true,stdio:'ignore'}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{detached:true,stdio:'ignore'});child.on('error',()=>console.log('请在浏览器打开 '+url));child.unref();console.log('工作台已就绪：'+url);
})();
