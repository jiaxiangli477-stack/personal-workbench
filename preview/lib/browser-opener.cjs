'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function browserCommand(url,{platform=process.platform,env=process.env,exists=fs.existsSync}={}){
 if(platform==='win32'){
  const roots=[env['ProgramFiles(x86)'],env.ProgramFiles,env.LOCALAPPDATA].filter(Boolean);
  for(const root of roots){const exe=path.join(root,'Microsoft','Edge','Application','msedge.exe');if(exists(exe))return {exe,args:['--app='+url],browser:'edge'};}
  return {exe:'rundll32.exe',args:['url.dll,FileProtocolHandler',url],browser:'system'};
 }
 return {exe:platform==='darwin'?'open':'xdg-open',args:[url],browser:'system'};
}
function openWorkbenchBrowser(url,options={}){
 const command=browserCommand(url,options),spawn=options.spawn||cp.spawn;
 return new Promise((resolve,reject)=>{const child=spawn(command.exe,command.args,{detached:true,windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref?.();resolve({browser:command.browser});});});
}
module.exports={browserCommand,openWorkbenchBrowser};
