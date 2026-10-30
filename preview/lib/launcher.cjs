'use strict';
const DEFAULT_WAIT_MS=30000;
async function launch({expectedVersion,port=8869,timeoutMs=DEFAULT_WAIT_MS,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),healthCheck,startServer,openBrowser,notify}){
 const began=now();let started=false;
 async function warning(reason,message){let notified=false,noticeResult=null;try{noticeResult=await notify(message);notified=true;}catch{}return {ok:false,reason,notified,noticeResult};}
 const failed=`本机工作台未能启动。${port} 端口可能被占用。日志在 preview/local-data/server.log，请检查后重试。`;
 while(now()-began<timeoutMs){
  let status=null;try{status=await healthCheck(Math.min(1000,timeoutMs-(now()-began)));}catch{}
  if(status?.name==='personal-workbench'){
   if(status.version!==expectedVersion)return warning('old-version','检测到仍在运行的旧服务（'+String(status.version||'未知版本')+'），请关闭旧服务后重试。当前文件版本：'+expectedVersion+'。日志在 preview/local-data/server.log。');
   if(status.error)return warning('catalog','本机资料暂未整理完成。'+failed);
   if(!status.loading){try{await openBrowser();return {ok:true,version:status.version};}catch{return warning('browser',`本机服务已就绪，但浏览器未能打开。请手动访问 http://localhost:${port} 。`);}}
  }else if(status)return warning('occupied',failed);
  else if(!started){try{await startServer();started=true;}catch{return warning('spawn',failed);}}
  const remaining=timeoutMs-(now()-began);if(remaining>0)await sleep(Math.min(200,remaining));
 }
 return warning('timeout',failed);
}
module.exports={launch,DEFAULT_WAIT_MS};
