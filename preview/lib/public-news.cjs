'use strict';
const fs = require('node:fs/promises');
const {existsSync} = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {createHash} = require('node:crypto');

// Public, fixed feeds only. No user URL, account, paid API or telemetry endpoint.
const SOURCES = Object.freeze([
  {id:'openai',name:'OpenAI 官方动态',url:'https://openai.com/news/rss.xml',category:'AI工具',relevance:'官方AI产品与研究发布线索；试用成本、适用性和效果需另行核验。'},
  {id:'n8n',name:'n8n 官方版本发布',url:'https://github.com/n8n-io/n8n/releases.atom',category:'AI工具',relevance:'工作流与智能体工具的版本变化；版本发布不代表已安装或已通过本人试用。'},
  {id:'google-search',name:'Google Search Central',url:'https://feeds.feedburner.com/blogspot/amDG',category:'搜索与独立站',relevance:'搜索、索引与独立站内容的官方线索；需阅读适用范围后再决定是否改站。'},
  {id:'cloudflare',name:'Cloudflare 官方博客',url:'https://blog.cloudflare.com/rss/',category:'搜索与独立站',relevance:'独立站基础设施、网络与开发产品变化；并非每篇都需要采取行动。'},
  {id:'wto',name:'WTO news',url:'https://www.wto.org/library/rss/latest_news_e.xml',category:'外贸资讯',relevance:'国际贸易政策与多边规则线索；不替代具体国家、商品与交易条件的核验。'},
].map(Object.freeze));
const MAX_BYTES = 1536 * 1024;
const CACHE_MS = 10 * 60 * 1000;
const running = new Map();
const WINDOWS_PYTHON = 'C:/Users/21996/AppData/Local/Programs/Python/Python313/python.exe';

function getSources() { return SOURCES.map(s => ({...s})); }

function cachePath(cacheDir) {
  if (typeof cacheDir !== 'string' || !path.isAbsolute(cacheDir)) throw new Error('cacheDir 必须为绝对路径');
  const resolved = path.resolve(cacheDir);
  if (process.platform === 'win32' && !/^[DE]:\\/i.test(resolved)) throw new Error('缓存只允许写入 D: 或 E:');
  return path.join(resolved,'news.json');
}

function empty(errors=[]) {
  return {updatedAt:null,items:[],sources:getSources().map(s => ({...s,status:'not_fetched',count:0,lastSuccessAt:null})),errors};
}

async function readNews(cacheDir) {
  const file = cachePath(cacheDir);
  try {
    const raw = await fs.readFile(file,'utf8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.sources) || !Array.isArray(data.errors) ||
        typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt)) ||
        data.items.some(i => !i || typeof i.id !== 'string' || typeof i.title !== 'string' || typeof i.url !== 'string' || !SOURCES.some(s=>s.id===i.sourceId)) ||
        data.sources.some(s => !s || !SOURCES.some(known=>known.id===s.id) || !['ok','error','not_fetched'].includes(s.status)) ||
        data.errors.some(e => !e || typeof e.sourceId !== 'string' || typeof e.error !== 'string')) {
      throw new Error('invalid cache');
    }
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return empty();
    return empty([{sourceId:'cache',error:'资讯缓存无法读取；刷新可重新建立公开资讯缓存。'}]);
  }
}

function parseFeed(raw) {
  const python = process.env.WORKBENCH_PYTHON || (process.platform === 'win32' && existsSync(WINDOWS_PYTHON) ? WINDOWS_PYTHON : 'python3');
  return new Promise((resolve,reject) => {
    const proc = spawn(python,['-I','-B','-X','utf8',path.join(__dirname,'feed_parser.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output = '', diagnostic = '', settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {proc.kill();finish(new Error('XML 解析超时'));},5000);
    proc.on('error',() => finish(new Error('Python 不可用；请配置 WORKBENCH_PYTHON 后刷新')));
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data',chunk => {
      output += chunk;
      if (output.length > MAX_BYTES) {proc.kill();finish(new Error('解析结果过大'));}
    });
    proc.stderr.on('data',chunk => {diagnostic=(diagnostic+chunk).slice(0,600);});
    proc.stdin.on('error',()=>{}); // A rejected XML input can close stdin early.
    proc.on('close',code => {
      if (code !== 0) return finish(new Error(`XML 解析失败${diagnostic.includes('DTD')?'：拒绝DTD/实体声明':''}`));
      try {
        const items = JSON.parse(output);
        if (!Array.isArray(items)) throw new Error('invalid parser output');
        finish(null,items);
      } catch { finish(new Error('XML 解析结果不可用')); }
    });
    proc.stdin.end(raw);
  });
}

function publicUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ['fbclid','gclid'].includes(key)) url.searchParams.delete(key);
    return url.href;
  } catch {return null;}
}

function normalize(items,source,fetchedAt) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const url = publicUrl(item.url);
    const title = String(item.title||'').trim();
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    const date = Date.parse(item.publishedAt);
    result.push({
      id:createHash('sha256').update(url).digest('hex').slice(0,20),
      title,url,source:source.name,sourceId:source.id,category:source.category,
      publishedAt:Number.isFinite(date)?new Date(date).toISOString():null,
      summary:String(item.summary||''),relevance:source.relevance,evidenceType:'official',fetchedAt,
    });
    if (result.length === 10) break;
  }
  return result;
}

async function fetchSource(source) {
  // Redirects are refused so a changed public feed cannot turn this into a
  // requester for arbitrary hosts, internal URLs or metadata services.
  const response = await fetch(source.url,{
    redirect:'manual',signal:AbortSignal.timeout(15000),
    headers:{accept:'application/rss+xml, application/atom+xml, text/xml, application/xml','user-agent':'PersonalWorkbench-PublicFeeds/1.0'},
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
  if (Number(response.headers.get('content-length')) > MAX_BYTES) {await response.body?.cancel();throw new Error('Feed 超过大小限制');}
  if (!response.body) throw new Error('Feed 内容为空');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {await reader.cancel();throw new Error('Feed 超过大小限制');}
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return parseFeed(Buffer.concat(chunks));
}

function errorText(error) {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return '公开源请求超时';
  if (error.message === 'fetch failed') return '公开源网络连接失败';
  return String(error.message||'公开源刷新失败').slice(0,160);
}

async function refresh(cacheDir,force) {
  const file = cachePath(cacheDir);
  const previous = await readNews(cacheDir);
  const previousAge = Date.now()-Date.parse(previous.updatedAt);
  if (!force && Number.isFinite(previousAge) && previousAge >= 0 && previousAge < CACHE_MS) return previous;
  const updatedAt = new Date().toISOString();
  const results = [];
  // Limit concurrency to two, including parsers, and never accept source URLs
  // from an HTTP request or from the old cache.
  let cursor = 0;
  await Promise.all(Array.from({length:2},async () => {
    while (cursor < SOURCES.length) {
      const index = cursor++;
      const source = SOURCES[index];
      const oldSource = previous.sources.find(s=>s.id===source.id);
      try {
        const rows = await fetchSource(source);
        const fetchedAt = new Date().toISOString();
        const items = normalize(rows,source,fetchedAt);
        if (rows.length && !items.length) throw new Error('Feed 没有可用标题或公开链接');
        results[index] = {items,source:{...source,status:'ok',count:items.length,attemptedAt:updatedAt,lastSuccessAt:fetchedAt}};
      } catch (error) {
        const items = previous.items.filter(i=>i.sourceId===source.id);
        const message = errorText(error);
        results[index] = {
          items,source:{...source,status:'error',count:0,retainedCount:items.length,attemptedAt:updatedAt,lastSuccessAt:oldSource?.lastSuccessAt||null,error:message},
          error:{sourceId:source.id,error:message},
        };
      }
    }
  }));
  const seen = new Set();
  const items = results.flatMap(r=>r.items).filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);return true;
  }).sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
  const result = {updatedAt,items,sources:results.map(r=>r.source),errors:results.filter(r=>r.error).map(r=>r.error)};
  await fs.mkdir(path.dirname(file),{recursive:true});
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary,JSON.stringify(result,null,2),'utf8');
    await fs.rename(temporary,file);
  } catch (error) {await fs.rm(temporary,{force:true});throw error;}
  return result;
}

async function refreshNews({cacheDir,force=false}={}) {
  const key = cachePath(cacheDir);
  if (running.has(key)) return running.get(key);
  const pending = refresh(cacheDir,force);
  running.set(key,pending);
  try {return await pending;} finally {running.delete(key);}
}

module.exports = {getSources,refreshNews,readNews};
