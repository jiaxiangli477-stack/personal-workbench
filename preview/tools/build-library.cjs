'use strict';
const fs=require('node:fs'),path=require('node:path');
const {loadCatalog}=require('../lib/library.cjs');
const root=path.resolve(__dirname,'..'),{catalog}=loadCatalog(path.join(root,'local-data'));
for(const w of catalog.works)if(w.fileId&&fs.existsSync(path.join(root,'local-data','thumbnails',w.fileId+'.jpg')))w.thumbnailUrl='/api/thumbnail/'+w.fileId;
fs.mkdirSync(path.join(root,'local-data'),{recursive:true});
fs.writeFileSync(path.join(root,'local-data','library.json'),JSON.stringify(catalog,null,2));
// Imported private metadata stays outside dist and is served only by the guarded local API.
console.log(JSON.stringify({updatedAt:catalog.updatedAt,counts:catalog.counts}));
