'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const library=require('./lib/library.cjs');
const {CatalogLoader}=require('./lib/catalog-loader.cjs');
const {allowRequest}=require('./lib/http-guard.cjs');
const root=path.resolve(__dirname,'dist');
const localDir=path.resolve(process.env.WORKBENCH_LOCAL_DATA_DIR||path.join(__dirname,'local-data'));
const cacheDir=path.resolve(process.env.WORKBENCH_PUBLIC_CACHE_DIR||path.join(__dirname,'public-cache'));
const {createRelay,RelayError}=require('./lib/ai-relay.cjs');
const ai=createRelay({localDir,maxUpstreamCalls:process.env.WORKBENCH_AI_MAX_CALLS===undefined?Infinity:Number(process.env.WORKBENCH_AI_MAX_CALLS)});
const loadedVersion=fs.readFileSync(path.resolve(__dirname,'../VERSION'),'utf8').trim();
const codeFingerprint=crypto.createHash('sha256').update(Buffer.concat(['server.cjs','lib/ai-config.cjs','lib/ai-relay.cjs','lib/ai-images.cjs','lib/catalog-loader.cjs','lib/catalog-worker.cjs','lib/library.cjs','dist/model.js','lib/growth-store.cjs','dist/growth-model.js','lib/site-health.cjs','lib/site-probe.ps1'].map(name=>fs.readFileSync(path.join(__dirname,name))))).digest('hex');
const siteHealth=require('./lib/site-health.cjs').createSiteHealth({dir:localDir});
const port=Number(process.env.WORKBENCH_PORT)||8869;
const hosts=new Set(['localhost:'+port,'127.0.0.1:'+port]);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.mp4':'video/mp4','.webm':'video/webm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.pdf':'application/pdf'};
let current=null,refreshing=null;const catalogLoader=new CatalogLoader({dir:localDir,delayMs:process.env.WORKBENCH_CATALOG_DELAY_MS});
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'});res.end(JSON.stringify(value));}
async function refreshCatalog(){current=await catalogLoader.load();fs.mkdirSync(localDir,{recursive:true});fs.writeFileSync(path.join(localDir,'library.json'),JSON.stringify(current.catalog,null,2));return current.catalog;}
async function body(req){const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>1024*1024)throw Error('记录过大，请减少单次内容');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
function allowed(req){
 return allowRequest(req,port);
}
function media(req,res,file){
 const stat=fs.statSync(file);const headers={'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'private, max-age=120','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"};
 let start=0,end=stat.size-1,status=200;
 if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});res.end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;status=206;if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});res.end();return;}headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
 headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);
 if(req.method==='HEAD'||stat.size===0){res.end();return;}
 const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
const server=http.createServer(async(req,res)=>{
 try{
  if(!allowed(req)){send(res,403,{error:'仅允许本机工作台访问'});return;}
  let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{send(res,400,{error:'地址格式不正确'});return;}
  if(url.startsWith('/api/')){
   if(!['GET','HEAD','POST'].includes(req.method)){send(res,405,{error:'不支持的操作'});return;}
   if(url==='/api/health'&&req.method==='GET'){send(res,200,{name:'personal-workbench',version:loadedVersion,codeFingerprint,loading:catalogLoader.loading,...(catalogLoader.error?{error:catalogLoader.error}:{}),aiCalls:ai.diagnostics()});return;}
   if(url==='/api/growth'&&req.method==='GET'){send(res,200,{state:require('./lib/growth-store.cjs').readGrowth(localDir)});return;}
   if(url==='/api/growth'&&req.method==='POST'){const revision=req.headers['x-workbench-growth-revision'];if(!/^\d+$/.test(revision||'')){send(res,400,{error:'请先读取最新资料再保存'});return;}try{send(res,200,{saved:true,state:require('./lib/growth-store.cjs').writeGrowth(localDir,await body(req),{expectedModifiedAt:Number(revision)})});}catch(err){if(err.code==='conflict')send(res,409,{error:err.message});else throw err;}return;}
   if(url==='/api/site-health'&&req.method==='GET'){send(res,200,siteHealth.read());return;}
   if(url==='/api/site-health/check'&&req.method==='POST'){if(req.headers['x-workbench-action']!=='manual'||!String(req.headers['content-type']||'').startsWith('application/json')){send(res,403,{error:'请点击工作台的公开检查按钮'});return;}const input=await body(req);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length){send(res,400,{error:'只检查固定Packrivo入口，不接受任意网址或额外内容'});return;}send(res,200,await siteHealth.check());return;}
   if(url==='/api/ai/status'&&req.method==='GET'){send(res,200,ai.status());return;}
   if(['/api/ai/text','/api/ai/image','/api/ai/explain-news'].includes(url)&&req.method==='POST'){
    if(req.headers['x-workbench-action']!=='manual'||!String(req.headers['content-type']||'').startsWith('application/json')){send(res,403,{error:'请通过工作台的生成按钮手动提交'});return;}
    try{const input=await body(req);send(res,200,url==='/api/ai/explain-news'?await ai.explainNews(input,()=>require('./lib/public-news.cjs').readNews(cacheDir)):await ai.run(url.endsWith('/text')?'text':'image',input));}
    catch(error){const known=error instanceof RelayError;const status=error.code==='not_found'?404:error.code==='busy'?409:error.code==='budget'?429:error.code==='uncertain'?504:known&&['input','previous_failure'].includes(error.code)?400:502;send(res,status,{error:known?error.message:'AI请求未完成，请核对本机连接表与输入格式',code:known?error.code:'configuration',attempts:known?error.attempts:[]});}
    return;
   }
   const aiImage=/^\/api\/ai\/image\/([a-f0-9]{24})$/.exec(url);
   if(aiImage&&['GET','HEAD'].includes(req.method)){const file=ai.imageFile(aiImage[1]);if(file){media(req,res,file);}else send(res,404,{error:'没有找到这张本机生成图片'});return;}
   if(url==='/api/library'&&req.method==='GET'){if(catalogLoader.loading||!current){send(res,503,{loading:catalogLoader.loading,error:catalogLoader.error||'正在整理资料，请稍候'});return;}send(res,200,current.catalog);return;}
   if(url==='/api/library/refresh'&&req.method==='POST'){send(res,200,await refreshCatalog());return;}
   if(url==='/api/state'&&req.method==='GET'){send(res,200,{state:library.readState(localDir)});return;}
   if(url==='/api/state/legacy-backup'&&req.method==='POST'){const input=await body(req);if(!input||Object.keys(input).some(k=>k!=='state')){send(res,400,{error:'旧记录备份只接受state'});return;}send(res,200,{saved:true,...library.backupLegacyState(localDir,input.state)});return;}
   if(url==='/api/state'&&req.method==='POST'){const valid=library.writeState(localDir,await body(req));send(res,200,{saved:true,version:valid.version});return;}
   if(url==='/api/state/backup'&&req.method==='POST'){send(res,200,{saved:true,path:library.backupState(localDir)});return;}
   if(url==='/api/news'&&req.method==='GET'){send(res,200,await require('./lib/public-news.cjs').readNews(cacheDir));return;}
   if(url==='/api/news/refresh'&&req.method==='POST'){
    if(!refreshing)refreshing=require('./lib/public-news.cjs').refreshNews({cacheDir,force:true}).finally(()=>{refreshing=null;});
    send(res,200,await refreshing);return;
   }
   const match=/^\/api\/(source|asset|thumbnail)\/([a-f0-9]{24})$/.exec(url);
   if(match&&['GET','HEAD'].includes(req.method)){
    if(!current){send(res,503,{error:'正在整理资料，请稍候'});return;}const file=current.files.get(match[2]);if(!file||!fs.existsSync(file.path)){send(res,404,{error:'原文件不存在，请重新核对入口'});return;}
    if(match[1]==='source'){
     if(!['.md','.txt'].includes(file.ext)){send(res,415,{error:'这个文件请使用素材预览'});return;}
     const fd=fs.openSync(file.path,'r');let text;try{const b=Buffer.alloc(Math.min(file.size,256*1024));const read=fs.readSync(fd,b,0,b.length,0);text=b.subarray(0,read).toString('utf8');}finally{fs.closeSync(fd);}
     send(res,200,{text:library.redact(text),path:file.path,modifiedAt:file.modifiedAt,truncated:file.size>256*1024});return;
    }
    if(match[1]==='thumbnail'){
     const thumb=path.join(localDir,'thumbnails',file.id+'.jpg');if(fs.existsSync(thumb)){media(req,res,thumb);return;}send(res,404,{error:'暂无缩略图'});return;
    }
    if(['.md','.txt'].includes(file.ext)){send(res,415,{error:'请通过文字预览查看'});return;}
    media(req,res,file.path);return;
   }
   send(res,404,{error:'没有这个本地功能'});return;
  }
  if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'不支持的操作'});return;}
  const file=path.resolve(root,'.'+(url==='/'?'/index.html':url));
  if(!file.startsWith(root+path.sep)){send(res,403,{error:'不可访问此路径'});return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"});
  if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch(error){if(!res.headersSent)send(res,400,{error:library.redact(error.message||'本地操作失败')});else res.destroy();}
});
server.listen(port,'127.0.0.1',()=>{console.log('Local workbench: http://localhost:'+port);catalogLoader.load().then(result=>{current=result;}).catch(()=>console.error('本机资料暂未整理完成，请核对资料目录后重试'));});
