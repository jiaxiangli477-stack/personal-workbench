(function(root){
  'use strict';
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arrow='<svg class="viz-arrow" viewBox="0 0 60 24" aria-hidden="true"><path d="M2 12h48m-8-7 8 7-8 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const symbol=(name)=>{
    const paths={web:'M4 4h24v24H4zM4 11h24M9 8h1m3 0h1M10 18h12m-12 5h8',search:'M23 23l6 6M24 14a10 10 0 1 1-20 0 10 10 0 0 1 20 0',visit:'M5 27V17m8 10V8m8 19V13m8 14V3',inquiry:'M3 7h26v20H3zM3 8l13 10L29 8',mind:'M4 16h8m8-9h8m-8 18h8M12 16c6 0 2-9 8-9m-8 9c6 0 2 9 8 9'};
    return '<svg class="viz-symbol" viewBox="0 0 32 32" aria-hidden="true"><path d="'+paths[name]+'" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };
  const node=(kind,key,title,sub)=>`<button class="viz-node" data-action="online-detail" data-kind="${kind}" data-key="${e(key)}"><span class="viz-node-tag">${e(sub)}</span><strong>${e(title)}</strong><span class="viz-node-open" aria-hidden="true">↗</span></button>`;
  function research({query,sources=[],analysis=null}={}){
    if(!query)return `<div class="viz-intro" aria-label="研究流程图"><span>${symbol('search')}输入具体问题</span>${arrow}<span>${symbol('web')}查找公开参考</span>${arrow}<span>${symbol('mind')}拆成自己的选题</span></div>`;
    const refs=Array.isArray(sources)?sources:[],bench=analysis?.benchmarks||[],topics=analysis?.topics||[];
    return `<section class="viz-panel viz-research" aria-label="研究思维导图"><div class="viz-heading"><div><span class="viz-eyebrow">研究地图</span><h3>把参考连成自己的思路</h3></div><span class="viz-hint">点击节点，看拆解与引用</span></div><div class="viz-root"><span>${symbol('mind')}</span><div><small>这次研究的问题</small><strong>${e(query)}</strong></div></div><div class="viz-map-grid"><section class="viz-branch viz-blue"><h4><b>01</b>参考来源 <span>${refs.length}</span></h4><p class="viz-caption">搜索摘要 · 仍需阅读原文</p>${refs.slice(0,3).map(s=>node('source',s.id,s.title,s.id)).join('')||'<p class="viz-empty">尚无可用来源</p>'}${refs.length>3?`<details class="viz-more"><summary>展开其余 ${refs.length-3} 条来源</summary>${refs.slice(3).map(s=>node('source',s.id,s.title,s.id)).join('')}</details>`:''}</section><section class="viz-branch viz-purple"><h4><b>02</b>内容怎么拆 <span>${bench.length}</span></h4><p class="viz-caption">AI 建议 · 非账号表现证明</p>${bench.map((r,i)=>node('benchmark',i,r.angle,(r.sourceIds||[]).join(' · '))).join('')||'<p class="viz-empty">还没有可核对的拆解建议</p>'}</section><section class="viz-branch viz-green"><h4><b>03</b>我可以做什么 <span>${topics.length}</span></h4><p class="viz-caption">候选选题 · 点开可加入今天</p>${topics.map((r,i)=>node('topic',i,r.title,(r.sourceIds||[]).join(' · '))).join('')||'<p class="viz-empty">还没有可核对的选题</p>'}</section></div><p class="viz-footnote">节点上的 S 编号对应左侧来源；连线表示研究顺序，引用编号表示实际依据。</p></section>`;
  }
  function practice(item){
    const rows=[['01','问题',item.problem],['02','操作',Array.isArray(item.steps)?item.steps.join('\n'):item.steps],['03','结果','尚未实操，等待你补充真实结果'],['04','验收',item.check]];
    return `<section class="viz-practice" aria-label="选题拆解图">${rows.map(([n,title,body],i)=>`<div class="viz-practice-step"><span>${n}</span><div><h3>${title}</h3><p>${e(body||'待补充')}</p></div></div>${i<3?'<span class="viz-down" aria-hidden="true">↓</span>':''}`).join('')}</section>`;
  }
  function business(state,selected='health',busy=false){
    const ok=state?.status==='ok',health=ok?'最近请求成功':state?.status==='attention'?'响应需查看':state?.checkedAt?'上次检查未完成':'尚未检查';
    const stages=[
      {id:'health',icon:'web',title:'网站能打开吗',status:health,desc:'公开入口检查',question:'访客能不能顺利进入网站？',body:'检查首页、抓取规则和站点地图候选入口；这只代表当次请求，不代表表单或询盘功能正常。',next:'查看下方检查明细；需要时手动重新检查。'},
      {id:'search',icon:'search',title:'客户能搜到吗',status:'未接入',desc:'Google 搜索表现',question:'客户用哪些词找到 Packrivo？',body:'Search Console 还未接入，搜索曝光、点击、排名和关键词暂无真实数据。',next:'后续连接本站 Search Console 只读数据，再决定优先做哪些买家问题。'},
      {id:'visits',icon:'visit',title:'访客在看什么',status:'未接入',desc:'访问与来源',question:'访客从哪来，关心哪些页面？',body:'GA4 还未接入，访问量、来源和页面行为未知，不能写成零。',next:'确认本站已有 GA4 采集和授权后，再看来源与产品页面。'},
      {id:'inquiries',icon:'inquiry',title:'有没有有效询盘',status:'未接入',desc:'真实业务结果',question:'哪些需求值得继续跟进？',body:'询盘系统还未接入，数量、质量与转化未知，不能由流量推算。',next:'后续依据真实表单或业务汇总，连接需求、跟进与结果证据。'}
    ];
    const current=stages.find(x=>x.id===selected)||stages[0];
    return `<section class="viz-panel viz-business" aria-label="Packrivo业务路线图"><div class="viz-heading"><div><span class="viz-eyebrow">PACKRIVO · 业务地图</span><h2>从网站可访问，到客户愿意询盘</h2><p>点一个环节，看看现在知道什么、下一步做什么。</p></div><button class="outline-button" data-action="site-health-check" ${busy?'disabled':''}>${busy?'正在检查…':'检查公开状态'}</button></div><div class="viz-pipeline">${stages.map((s,i)=>`${i?arrow:''}<button class="viz-stage ${s.id===current.id?'is-selected':''}" data-action="site-map-select" data-value="${s.id}" aria-pressed="${s.id===current.id}" aria-controls="site-map-detail"><span class="viz-stage-icon">${symbol(s.icon)}</span><small>0${i+1} / ${s.desc}</small><strong>${s.title}</strong><span class="viz-stage-state ${s.id==='health'&&ok?'is-ok':''}">${s.id==='health'&&ok?'<i aria-hidden="true"></i>':''}${e(s.status)}</span></button>`).join('')}</div><div class="viz-business-detail" id="site-map-detail" role="region" aria-label="当前环节说明"><div><span class="viz-eyebrow">当前关注</span><h3>${e(current.question)}</h3><p>${e(current.body)}</p></div><div class="viz-next"><span>下一步</span><p>${e(current.next)}</p></div></div><p class="viz-footnote">这是业务关系图，连线不代表已采集转化率。${state?.checkedAt?'公开状态观察于 '+e(new Date(state.checkedAt).toLocaleString('zh-CN',{timeZone:'America/Los_Angeles'})):'还没有公开检查记录。'}</p></section>`;
  }
  function board({ideas=[],topics=[],userIdeas=[]}={}){
    const groups=[['已确认方向','viz-blue',ideas.filter(x=>x.state==='confirmed')],['待探索想法','viz-purple',ideas.filter(x=>!['confirmed','paused'].includes(x.state))],['已保存选题','viz-green',topics]];
    return `<section class="viz-panel" aria-label="我的思考导图"><div class="viz-heading"><div><span class="viz-eyebrow">思考地图</span><h2>我想做的事，放在一张图里</h2><p>来自已有想法与选题。点击节点查看依据或继续编辑。</p></div><button class="outline-button" data-action="new-idea">新增想法</button></div><div class="viz-root"><strong>用 AI 解决工作和生意中的实际问题</strong></div><div class="viz-map-grid">${groups.map(([name,color,items],gi)=>`<section class="viz-branch ${color}"><h3>${name}<span>${items.length}</span></h3>${items.map(i=>`<button class="viz-node" data-action="${gi===2?'topic-edit':'idea-source'}" data-id="${e(i.id)}"><strong>${e(i.title)}</strong><span class="viz-node-open" aria-hidden="true">↗</span></button>`).join('')||'<p class="viz-empty">还没有已保存的内容，可从研究结果或下方想法开始。</p>'}</section>`).join('')}</div><p class="viz-footnote">暂缓的想法、你手动记录的 ${userIdeas.length} 条想法及完整说明保留在下方，不把待探索当作已决定。</p></section>`;
  }
  const api={research,practice,business,board};root.WBVisuals=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
