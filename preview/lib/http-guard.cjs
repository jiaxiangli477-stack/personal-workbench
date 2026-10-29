'use strict';
function allowRequest(req,port){
 const hosts=new Set(['localhost:'+port,'127.0.0.1:'+port]);
 if(!hosts.has(req.headers.host))return false;
 if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(origin.protocol!=='http:'||origin.host!==req.headers.host)return false;}catch{return false;}}
 const site=req.headers['sec-fetch-site'];
 if(site&&site!=='same-origin'&&site!=='none'){
  // A user may navigate to the app from another site, but that site cannot
  // embed a private snapshot or call a private endpoint from another port.
  let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{return false;}
  return req.headers['sec-fetch-mode']==='navigate'&&['/','/index.html'].includes(pathname)&&req.method!=='POST';
 }
 return true;
}
module.exports={allowRequest};
