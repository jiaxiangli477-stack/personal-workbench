'use strict';
const dns=require('node:dns/promises');const https=require('node:https');const net=require('node:net');
const zlib=require('node:zlib');
const crcTable=Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&255];return (crc^0xffffffff)>>>0;}
function validatePNG(bytes){
 let offset=8,ihdr=null,palette=false,ended=false;const parts=[];
 while(offset+12<=bytes.length){
  const length=bytes.readUInt32BE(offset),end=offset+12+length;if(end>bytes.length)throw Error('图片PNG数据被截断');
  const type=bytes.subarray(offset+4,offset+8).toString('ascii'),data=bytes.subarray(offset+8,offset+8+length);
  if(crc32(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))throw Error('图片PNG校验失败');
  if(!ihdr&&type!=='IHDR')throw Error('图片缺少PNG头');
  if(type==='IHDR'){if(ihdr||length!==13)throw Error('图片PNG头不完整');ihdr=data;}
  if(type==='PLTE'){if(length<3||length>768||length%3)throw Error('图片调色板不正确');palette=true;}
  if(type==='IDAT'){if(!length)throw Error('图片像素为空');parts.push(data);}
  if(type==='IEND'){if(length!==0)throw Error('图片结束标记不正确');ended=true;offset=end;break;}
  offset=end;
 }
 if(!ihdr||!ended||offset!==bytes.length||!parts.length)throw Error('图片PNG结构不完整');
 const width=ihdr.readUInt32BE(0),height=ihdr.readUInt32BE(4),depth=ihdr[8],color=ihdr[9],channels={0:1,2:3,3:1,4:2,6:4}[color];
 const validDepth=color===0?[1,2,4,8,16]:color===3?[1,2,4,8]:[8,16];
 if(!width||!height||width>8192||height>8192||!channels||!validDepth.includes(depth)||ihdr[10]!==0||ihdr[11]!==0||ihdr[12]>1||(color===3&&!palette))throw Error('图片PNG参数不正确');
 const passes=ihdr[12]===0?[[0,0,1,1]]:[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];
 const rows=passes.map(([x,y,dx,dy])=>{const w=Math.max(0,Math.ceil((width-x)/dx)),h=Math.max(0,Math.ceil((height-y)/dy));return {height:w?h:0,stride:1+Math.ceil(w*channels*depth/8)};});
 const expected=rows.reduce((sum,p)=>sum+p.height*p.stride,0);if(expected>64*1024*1024)throw Error('图片解码体积过大');
 const pixels=zlib.inflateSync(Buffer.concat(parts),{maxOutputLength:expected+1});if(pixels.length!==expected)throw Error('图片像素数据不完整');
 let position=0;for(const pass of rows)for(let row=0;row<pass.height;row++){if(pixels[position]>4)throw Error('图片行数据损坏');position+=pass.stride;}
 return {width,height,extension:'png'};
}
function imageInfo(bytes){
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return validatePNG(bytes);
 // These providers returned PNG in live tests. Do not pretend to decode other codecs.
 throw Error('本轮仅接收可完整验证的PNG图片');
}
function publicAddress(address){
 if(net.isIPv4(address)){const n=address.split('.').map(Number);return !(n[0]===0||n[0]===10||n[0]===127||n[0]>=224||(n[0]===169&&n[1]===254)||(n[0]===172&&n[1]>=16&&n[1]<=31)||(n[0]===192&&n[1]===168)||(n[0]===100&&n[1]>=64&&n[1]<=127));}
 return /^2[0-9a-f]{3}:/i.test(address);
}
async function downloadImage(value){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.hash||(url.port&&url.port!=='443'))throw Error('不接受这个图片下载地址');
 const addresses=await dns.lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('不接受本机或内网图片地址');
 const target=addresses[0];
 return new Promise((resolve,reject)=>{
  // Pin the checked public address; never send provider credentials to storage hosts.
  const request=https.get(url,{lookup:(host,options,callback)=>options?.all?callback(null,[target]):callback(null,target.address,target.family)},response=>{
   if(response.statusCode!==200){response.resume();reject(Error('图片下载失败'));return;}
   const chunks=[];let length=0;response.on('data',chunk=>{length+=chunk.length;if(length>24*1024*1024){response.destroy();reject(Error('图片过大'));}else chunks.push(chunk);});response.on('end',()=>resolve(Buffer.concat(chunks)));response.on('error',reject);
  });const deadline=setTimeout(()=>request.destroy(Error('图片下载超时')),45000);request.on('close',()=>clearTimeout(deadline));request.on('error',reject);
 });
}
module.exports={imageInfo,downloadImage,publicAddress};
