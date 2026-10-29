'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {getSources, refreshNews, readNews} = require('../lib/public-news.cjs');

// All fixtures stay inside this project. Network access is replaced only at the
// fetch boundary; XML parsing, normalization and cache IO run for real.
async function fixture(t) {
  const root = path.resolve(__dirname, '../public-cache/test-fixtures');
  await fs.mkdir(root, {recursive:true});
  const cacheDir = await fs.mkdtemp(path.join(root, 'news-'));
  const original = global.fetch;
  t.after(async () => { global.fetch = original; await fs.rm(cacheDir, {recursive:true, force:true}); });
  return cacheDir;
}
const rss = (title='A &amp; B') => `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>${title}</title><link>https://example.org/item?utm_source=test</link><pubDate>Thu, 29 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Useful <b>release</b>.</p><script>secret()</script>]]></description></item>
<item><title>Duplicate</title><link>https://example.org/item</link></item>
<item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>`;

test('RSS entities, HTML cleanup, unsafe links and URL deduplication', async t => {
  const cacheDir = await fixture(t);
  const sources = getSources();
  const requested = [];
  global.fetch = async url => {requested.push(url); return new Response(rss(), {status:200});};
  const result = await refreshNews({cacheDir,force:true});
  assert.deepEqual(requested.sort(), sources.map(s => s.url).sort());
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'A & B');
  assert.equal(result.items[0].summary, 'Useful release.');
  assert.equal(result.items[0].url, 'https://example.org/item');
  assert.equal(result.items[0].publishedAt, '2026-10-29T10:00:00.000Z');
  assert.equal(result.items[0].evidenceType, 'official');
  assert.equal(result.sources.every(s => s.status === 'ok'), true);
  assert.equal(result.errors.length, 0);
});

test('Atom namespace, alternate links, source caps, and missing dates remain honest', async t => {
  const cacheDir = await fixture(t);
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom">${Array.from({length:14},(_,i)=>`<entry><title>Release ${i}</title><link rel="self" href="https://example.org/api/${i}"/><link rel="alternate" href="https://example.org/releases/${i}"/><summary type="html">&lt;p&gt;New &amp;amp; useful&lt;/p&gt;</summary></entry>`).join('')}</feed>`;
  global.fetch = async () => new Response(atom);
  const result = await refreshNews({cacheDir, force:true});
  assert.equal(result.items.length, 10);
  assert.equal(result.items[0].url.startsWith('https://example.org/releases/'), true);
  assert.equal(result.items[0].summary, 'New & useful');
  assert.equal(result.items[0].publishedAt, null);
  assert.equal(result.sources.every(s => s.count === 10), true);
});

test('a failed refresh retains source old items and their fetchedAt, while successful sources update', async t => {
  const cacheDir = await fixture(t);
  const sources = getSources();
  global.fetch = async url => new Response(rss().replaceAll('example.org',new URL(url).hostname));
  const before = await refreshNews({cacheDir,force:true});
  const failed = sources[0];
  global.fetch = async url => {if (url === failed.url) throw new Error('offline'); return new Response(rss('New release').replaceAll('example.org',new URL(url).hostname));};
  const after = await refreshNews({cacheDir,force:true});
  const retained = after.items.find(i => i.sourceId === failed.id);
  assert.equal(retained.title, 'A & B');
  assert.equal(retained.fetchedAt, before.items.find(i => i.sourceId === failed.id).fetchedAt);
  assert.equal(after.sources.find(s => s.id === failed.id).status, 'error');
  assert.equal(after.sources.find(s => s.id === failed.id).retainedCount, 1);
  assert.equal(after.sources.find(s => s.id !== failed.id).status, 'ok');
  assert.equal(after.items.some(i => i.title === 'New release'), true);
  assert.equal(after.errors.length, 1);
  assert.deepEqual(await readNews(cacheDir),after);
});

test('DOCTYPE/entity payloads and HTML error documents cannot become successful feeds', async t => {
  const cacheDir = await fixture(t);
  global.fetch = async () => new Response('<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///private">]><rss><channel><item><title>&xxe;</title></item></channel></rss>');
  let result = await refreshNews({cacheDir,force:true});
  assert.equal(result.items.length, 0);
  assert.equal(result.sources.every(s => s.status === 'error'), true);
  global.fetch = async () => new Response('<html><h1>Access denied</h1></html>');
  result = await refreshNews({cacheDir,force:true});
  assert.equal(result.sources.every(s => s.status === 'error'), true);
});

test('cache reuse avoids another request, malformed cache is observable, and unknown feed inputs cannot be supplied', async t => {
  const cacheDir = await fixture(t);
  const initial = await readNews(cacheDir);
  assert.equal(initial.updatedAt, null);
  assert.equal(initial.sources.every(s => s.status === 'not_fetched'), true);
  let count = 0;
  global.fetch = async () => {count++;return new Response(rss());};
  const first = await refreshNews({cacheDir,force:true});
  const second = await refreshNews({cacheDir});
  assert.equal(count, getSources().length);
  assert.deepEqual(first, second);
  const sources = getSources(); sources[0].url = 'https://private.invalid';
  assert.notEqual(getSources()[0].url, sources[0].url);
  await fs.writeFile(path.join(cacheDir,'news.json'), '{bad');
  const broken = await readNews(cacheDir);
  assert.equal(broken.items.length,0);
  assert.equal(broken.errors.some(e => e.sourceId === 'cache'), true);
  await fs.writeFile(path.join(cacheDir,'news.json'), JSON.stringify({updatedAt:new Date().toISOString(),items:[],sources:[null],errors:[]}));
  assert.equal((await readNews(cacheDir)).errors.some(e => e.sourceId === 'cache'),true);
});

test('oversized response and off-whitelist redirect do not get parsed or followed', async t => {
  const cacheDir = await fixture(t);
  global.fetch = async () => new Response('x'.repeat(2 * 1024 * 1024));
  let result = await refreshNews({cacheDir,force:true});
  assert.equal(result.sources.every(s => s.status === 'error'),true);
  global.fetch = async (_url, options) => {
    assert.equal(options.redirect,'manual');
    return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});
  };
  result = await refreshNews({cacheDir,force:true});
  assert.equal(result.sources.every(s => s.status === 'error'),true);
});
