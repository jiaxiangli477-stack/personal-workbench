'use strict';
const path=require('node:path');const {Worker}=require('node:worker_threads');
class CatalogLoader{
 constructor({dir,delayMs=0}){this.dir=dir;this.delayMs=Math.min(20000,Math.max(0,Number(delayMs)||0));this.loading=true;this.current=null;this.error=null;this.pending=null;}
 load(){if(this.pending)return this.pending;this.loading=true;this.error=null;
  this.pending=new Promise((resolve,reject)=>{const worker=new Worker(path.join(__dirname,'catalog-worker.cjs'),{workerData:{dir:this.dir,delayMs:this.delayMs},execArgv:[]});let settled=false;
   const fail=()=>{if(settled)return;settled=true;this.loading=false;this.error='本机资料暂未整理完成，请核对资料目录后重试';reject(Error(this.error));worker.terminate().catch(()=>{});};
   worker.once('message',result=>{if(!result?.catalog||!(result.files instanceof Map)){fail();return;}settled=true;this.current=result;this.loading=false;resolve(result);worker.terminate().catch(()=>{});});worker.once('error',fail);worker.once('exit',()=>{if(!settled)fail();});
  }).finally(()=>{this.pending=null;});return this.pending;
 }
}
module.exports={CatalogLoader};
