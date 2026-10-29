'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadCatalog}=require('../lib/library.cjs');
const dir=path.resolve(__dirname,'../local-data'),thumbs=path.join(dir,'thumbnails');
fs.mkdirSync(thumbs,{recursive:true});
const {catalog}=loadCatalog(dir);let saved=0,failed=0;
for(const work of catalog.works){if(work.kind!=='video'||!work.fileId)continue;const file=path.join(thumbs,work.fileId+'.jpg');if(fs.existsSync(file)){saved++;continue;}
 try{execFileSync(process.env.WORKBENCH_FFMPEG||'E:/Tools/ffmpeg/ffmpeg.exe',['-nostdin','-hide_banner','-loglevel','error','-ss','2','-i',work.path,'-frames:v','1','-vf','scale=480:-2','-q:v','4','-y',file],{timeout:25000,windowsHide:true,stdio:['ignore','ignore','pipe']});saved++;}catch{failed++;}
}
console.log(JSON.stringify({saved,failed,folder:thumbs}));
