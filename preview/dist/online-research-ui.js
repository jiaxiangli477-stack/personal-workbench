(function () {
  'use strict';
  window.WBOnlineResearchUI = function (ctx, helpers) {
    const {esc:e,icon,heading,modal,toast}=ctx;
    let ready=false,loading=false,configured=false,serverBusy=false,phase='',query='',error='',current=null,recent=[],tab='sources';
    const busy=()=>loading||!!phase||serverBusy;
    const safeURL=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
    const stamp=value=>{const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleString('zh-CN',{timeZone:'America/Los_Angeles'}):'日期未提供';};
    const sources=()=>Array.isArray(current?.sources)?current.sources.filter(s=>s&&typeof s.id==='string'&&safeURL(s.url)):[];
    const sourceById=id=>sources().find(s=>s.id===id);
    const text=value=>typeof value==='string'?value:'';
    const lines=value=>Array.isArray(value)?value.map(text).filter(Boolean).join('\n'):text(value);
    function analysisValue(){
      const result=current?.analysisResult,a=result?.analysis||current?.analysis;
      if(!a||current?.analysisStatus==='failed'||current?.analysisStatus==='processing'||result?.metadata?.truncated||!text(a.summary)||!Array.isArray(a.benchmarks)||!Array.isArray(a.topics))return null;
      const refs=x=>Array.isArray(x?.sourceIds)&&x.sourceIds.length>0&&x.sourceIds.every(id=>typeof id==='string'&&!!sourceById(id));
      if(!a.benchmarks.every(x=>text(x?.title)&&text(x?.angle)&&refs(x))||!a.topics.every(x=>text(x?.title)&&text(x?.problem)&&lines(x?.steps)&&text(x?.check)&&refs(x)))return null;
      return a;
    }
    const locked=()=>busy()?' disabled':'';
    const link=s=>`<a class="online-source-link" href="${e(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.id)} · ${e(s.title||'打开原链接')} ${icon('external-link')}</a>`;
    const citations=ids=>`<div class="online-citations" aria-label="引用来源">${ids.map(id=>sourceById(id)).filter(Boolean).map(link).join('')}</div>`;
    const actions=(kind,key)=>`<div class="online-card-actions"><button class="small-button" data-action="online-topic" data-kind="${kind}" data-key="${e(key)}"${locked()}>加入选题库</button><button class="text-button" data-action="online-task" data-kind="${kind}" data-key="${e(key)}"${locked()}>加入今天</button><button class="text-button" data-action="online-detail" data-kind="${kind}" data-key="${e(key)}"${locked()}>查看详情</button></div>`;
    async function api(path,body){
      const res=await fetch('/api/web-research'+path,body?{method:'POST',headers:{'Content-Type':'application/json','X-Workbench-Action':'manual'},body:JSON.stringify(body)}:{cache:'no-store'});
      let result;try{result=await res.json();}catch{throw Error('本机返回内容不完整；请重新读取最近研究，不会自动重新调用。');}
      if(!res.ok)throw Error(text(result?.error)||'请求未完成，请重新读取最近研究查看状态。');
      return result;
    }
    function remember(record){recent=[record,...recent.filter(x=>x.id!==record.id)].slice(0,20);}
    function recordValue(value){const r=value?.search||value;if(!r||typeof r.id!=='string'||typeof r.query!=='string'||!Array.isArray(r.sources))throw Error('研究记录不完整，已保留当前内容。');return r;}
    async function init(){
      if(loading||phase)return;loading=true;error='';ctx.render();
      try{const s=await api('/status');if(typeof s?.configured!=='boolean'||!Array.isArray(s.recent))throw Error('连接状态不完整，暂不发起研究。');configured=s.configured;serverBusy=!!s.busy;recent=s.recent.filter(r=>r&&typeof r.id==='string'&&typeof r.query==='string'&&Array.isArray(r.sources));ready=true;
        if(current){const restored=recent.find(r=>r.id===current.id);if(restored)current=restored;}
      }catch(err){error=err.message||'无法读取本机研究状态。';}
      finally{loading=false;ctx.render();}
    }
    function missingAnalysis(){
      if(!current)return '';
      if(current.status==='failed')return text(current.error)||'上次搜索未完成，没有自动重试。';
      if(current.status==='processing')return '上次搜索结果状态尚未确认。请先核对搜索服务记录；不会自动重新发送。';
      if(current.storageWarning)return text(current.storageWarning);
      if(current.analysisStatus==='processing')return '上次 AI 研究的结果状态尚未确认。请重新读取最近研究；不会自动再次调用。';
      if(current.analysisStatus==='failed')return text(current.analysisError?.message)||text(current.analysisError)||'上次 AI 研究未完成，参考来源已保留。';
      if((current.analysisResult||current.analysis)&&!analysisValue())return 'AI 返回内容不完整或引用无法核对，未展示为完整研究。参考来源仍可使用。';
      return '';
    }
    async function run(withAI){
      if(busy()){toast('当前正在处理，请稍候；不会重复提交。');return;}
      if(!ready||!configured){error='联网搜索尚未连接。请先重新读取连接状态。';ctx.render();return;}
      const keyword=query.trim();if(keyword.length<2||keyword.length>200){error='请输入 2–200 字的公开关键词。';ctx.render();return;}
      error='';phase='search';ctx.render();
      try{
        const id='web-search-'+crypto.randomUUID();
        current=recordValue(await api('/search',{query:keyword,requestId:id}));remember(current);tab='sources';
        if(withAI&&sources().length){
          phase='analyze';ctx.render();
          try{const result=await api('/analyze',{searchId:current.id,requestId:'web-ai-'+crypto.randomUUID()});current={...current,analysisResult:result,analysis:result?.analysis,analysisStatus:'done'};remember(current);
            if(!analysisValue())throw Error('AI 返回内容不完整或引用无法核对，参考来源已保留，未自动重试。');
          }catch(err){error='AI 研究未完成：'+(err.message||'本机暂时不可用')+' 参考来源已保留；没有自动重试。';}
        }else if(withAI){error='未找到可用公开来源，本次没有调用 AI 研究。请调整关键词后主动搜索。';}
      }catch(err){error=err.message||'联网搜索未完成。请重新读取最近研究；不会自动重试。';}
      finally{phase='';ctx.render();}
    }
    async function openSaved(id){
      if(busy()){toast('当前正在处理，请稍候再打开记录。');return false;}
      loading=true;error='';ctx.render();
      try{const record=recordValue(await api('/search/'+encodeURIComponent(id)));current=record;query=record.query;remember(record);tab='sources';ctx.go('research');return true;}
      catch(err){error=err.message||'这条研究暂时无法读取，已有内容已保留。';return false;}
      finally{loading=false;ctx.render();}
    }
    function itemValue(kind,key){
      if(!current)return null;
      if(kind==='source'){const s=sourceById(key);return s?{title:s.title||current.query,problem:s.snippet||'请打开原文核对内容。',steps:'阅读原文并记下一条可验证的启发。',check:'核对原文与自己的实际结果。',sourceIds:[s.id],label:'公开搜索摘要'}:null;}
      const a=analysisValue();if(!a||!/^\d+$/.test(String(key)))return null;
      const r=(kind==='benchmark'?a.benchmarks:kind==='topic'?a.topics:[])[Number(key)];
      return r?{...r,problem:r.problem||r.angle,steps:lines(r.steps)||r.angle,check:r.check||'核对引用原文；内容角度属于建议，尚未验证账号表现。',label:kind==='benchmark'?'内容对标建议 · 非已验证账号':'可做选题 · 待实测'}:null;
    }
    function localPayload(item){
      const refs=item.sourceIds.map(id=>sourceById(id)).filter(Boolean),urls=refs.map(s=>`${s.id} · ${s.title||'原文'}\n${safeURL(s.url)}`).join('\n\n');
      const source={type:'research',origin:'web-research',id:current.id,label:current.query,url:refs[0]?safeURL(refs[0].url):''};
      return {title:item.title,problem:item.problem,steps:[item.steps,'公开引用：\n'+urls].join('\n\n'),check:item.check,source,nextAction:lines(item.steps).split('\n')[0]||'先核对公开原文',verificationStatus:'待验证'};
    }
    function showDetail(kind,key){const item=itemValue(kind,key);if(!item){toast('这条结果已不可用，请重新读取研究记录。');return;}modal(item.title,`<div class="growth-detail online-detail"><p class="small-caption">${e(item.label)}</p><section class="growth-detail-section"><h3>问题与角度</h3><p>${e(item.problem)}</p></section><section class="growth-detail-section"><h3>下一步</h3><p>${e(item.steps)}</p></section><section class="growth-detail-section"><h3>如何核对</h3><p>${e(item.check)}</p></section><section class="growth-detail-section"><h3>公开引用</h3>${citations(item.sourceIds)}</section>${actions(kind,key)}</div>`,'联网研究');}
    function sourceCards(){return sources().length?sources().map(s=>`<article class="online-result online-reference"><div class="growth-result-meta"><span>${e(s.id)} · 公开搜索摘要</span><span>${e(s.publishedAt?stamp(s.publishedAt):'原文日期未提供')}</span></div><h3>${link(s)}</h3><p>${e(s.snippet||'搜索未提供摘要，请打开原文核对。')}</p><p class="online-source-note">仅有搜索摘要，未读取全文。</p>${actions('source',s.id)}</article>`).join(''):`<div class="growth-empty"><h3>${current?.status==='processing'?'搜索结果尚未确认':current?.status==='failed'?'这次搜索没有完成':'没有找到可用参考'}</h3><p>${current?.status==='processing'||current?.status==='failed'?'先核对上方状态，再决定下一步；当前不会自动重试。':'试着把大主题改成一个具体问题，再主动搜索。'}</p></div>`;}
    function benchmarkCards(a){return a.benchmarks.length?a.benchmarks.map((r,i)=>`<article class="online-result"><span class="online-result-label">内容对标建议 · 非已验证账号</span><h3>${e(r.title)}</h3><p>${e(r.angle)}</p>${citations(r.sourceIds)}${actions('benchmark',i)}</article>`).join(''):'<div class="growth-empty"><h3>暂没有足够依据提出对标建议</h3><p>可以先读参考原文，补充自己的判断。</p></div>';}
    function topicCards(a){return a.topics.length?a.topics.map((r,i)=>`<article class="online-result"><span class="online-result-label">可做选题 · 待实测</span><h3>${e(r.title)}</h3><p>${e(r.problem)}</p><dl class="online-topic-steps"><dt>先做什么</dt><dd>${e(lines(r.steps))}</dd><dt>如何验收</dt><dd>${e(r.check)}</dd></dl>${citations(r.sourceIds)}${actions('topic',i)}</article>`).join(''):'<div class="growth-empty"><h3>暂没有可核对的选题</h3><p>保留参考来源，明确一个可验证的问题后再开展研究。</p></div>';}
    function resultsHTML(){
      if(!current)return '<div class="growth-empty online-empty"><span class="growth-empty-icon">'+icon('search')+'</span><h3>从一个想弄清楚的问题开始</h3><p>搜索公开来源，查看可借鉴的内容角度，再把值得实践的一步留下来。</p></div>';
      const a=analysisValue(),warning=missingAnalysis(),warnings=Array.isArray(current.analysisResult?.warnings)?current.analysisResult.warnings.filter(x=>typeof x==='string'):[];
      return `<section class="online-results" aria-label="当前研究结果"><div class="online-results-heading"><div><h3>${e(current.query)}</h3><p>${e(stamp(current.fetchedAt))} · ${sources().length} 条可打开的公开来源</p></div></div>${warning?`<p class="online-inline-warning" role="status">${e(warning)}</p>`:''}${a?`<div class="online-summary"><h4>研究摘要</h4><p>${e(a.summary)}</p><p class="small-caption">依据搜索摘要生成，结论与效果仍需核对。</p>${warnings.length?`<ul>${warnings.map(w=>`<li>${e(w)}</li>`).join('')}</ul>`:''}</div>`:''}<div class="growth-views online-result-tabs" aria-label="查看研究结果"><button data-action="online-tab" data-value="sources" class="${tab==='sources'?'active':''}" aria-pressed="${tab==='sources'}">参考来源 · ${sources().length}</button><button data-action="online-tab" data-value="benchmarks" class="${tab==='benchmarks'?'active':''}" aria-pressed="${tab==='benchmarks'}"${a?'':' disabled'}>内容对标建议${a?' · '+a.benchmarks.length:''}</button><button data-action="online-tab" data-value="topics" class="${tab==='topics'?'active':''}" aria-pressed="${tab==='topics'}"${a?'':' disabled'}>可做选题${a?' · '+a.topics.length:''}</button></div><div class="online-result-list">${tab==='benchmarks'&&a?benchmarkCards(a):tab==='topics'&&a?topicCards(a):sourceCards()}</div></section>`;
    }
    function view(){
      const disabled=busy()||!ready||!configured,progress=phase==='search'?'正在搜索公开参考…':phase==='analyze'?'参考已找到，正在整理 AI 研究…':loading?'正在读取本机研究记录…':serverBusy?'已有研究正在处理，请稍后重新读取状态。':'';
      return `<section class="growth-workspace online-workspace">${heading('联网研究','找参考、看内容角度，再决定做什么。')}<div class="growth-layout"><div class="growth-main online-main"><form id="online-research-form" class="online-search-form" aria-busy="${!!phase}"><label for="online-query" class="online-input-label">你想研究什么？</label><div class="growth-search-field">${icon('search')}<input id="online-query" name="query" type="search" required minlength="2" maxlength="200" autocomplete="off" placeholder="输入一个具体的公开问题或关键词" value="${e(query)}"${busy()?' disabled':''} aria-describedby="online-sharing"></div><p id="online-sharing" class="online-sharing">只发送上方关键词与公开搜索摘要，不附带本机资料或私人记录。“联网并AI研究”使用搜索和文字额度；“只找参考”仅使用搜索额度。</p><div class="online-search-actions"><button type="submit" class="primary-button"${disabled?' disabled':''}>${phase==='search'?'正在找参考…':phase==='analyze'?'正在 AI 研究…':'联网并AI研究'}</button><button type="button" class="outline-button" data-action="online-search-only"${disabled?' disabled':''}>只找参考</button></div></form>${progress?`<div class="online-progress" role="status" aria-live="polite">${e(progress)}</div>`:''}${error?`<div class="online-error" role="alert"><strong>这次操作未完成</strong><p>${e(error)}</p><p>请先重新读取最近研究查看结果，再决定是否发起新研究。</p></div>`:''}${ready&&!configured?'<p class="online-inline-warning">联网搜索尚未配置，请先连接搜索服务，再重新读取状态。</p>':''}${resultsHTML()}</div><aside class="growth-aside online-aside"><section class="growth-aside-section"><div class="online-aside-heading"><h3>最近研究</h3><button type="button" class="text-button" data-action="online-refresh"${loading||phase?' disabled':''}>重新读取</button></div><p class="small-caption">打开或重新读取记录不会再次使用额度。</p><div class="online-history">${recent.length?recent.map(r=>`<button class="growth-research-link" data-action="online-open" data-id="${e(r.id)}"${busy()?' disabled':''}><span>${e(r.query)}<small>${e(stamp(r.fetchedAt))}${r.analysisStatus==='done'?' · 已有 AI 研究':r.analysisStatus==='failed'?' · AI 未完成':''}</small></span>${icon('chevron-right')}</button>`).join(''):'<p class="small-caption">还没有已保存的联网研究。</p>'}</div></section><section class="growth-aside-section growth-aside-quiet"><h3>先核对，再使用</h3><p>参考内容来自搜索摘要。对标角度和选题属于建议，不代表已验证账号、流量或业务效果。</p><p>加入选题库或今天任务只保存到本机，不会发布。</p></section></aside></div></section>`;
    }
    function handleClick(action,el){
      if(!action.startsWith('online-'))return false;const d=el?.dataset||{};
      if(action==='online-refresh'){void init();return true;}
      if(action==='online-search-only'){void run(false);return true;}
      if(action==='online-open'){void openSaved(d.id);return true;}
      if(action==='online-tab'){if(['sources','benchmarks','topics'].includes(d.value)&&(d.value==='sources'||analysisValue())){tab=d.value;ctx.render();}return true;}
      if(busy()){toast('当前正在处理，请稍候。');return true;}
      if(action==='online-detail'){showDetail(d.kind,d.key);return true;}
      if(action==='online-topic'||action==='online-task'){const item=itemValue(d.kind,d.key);if(!item){toast('没有可核对的结果，请重新读取研究记录。');return true;}const value=localPayload(item);
        if(action==='online-topic')helpers.createTopic(value);
        else helpers.addTask('研究：'+value.title,[value.problem,value.steps,'验收：'+value.check].filter(Boolean).join('\n\n'),20,{sourceType:'research',sourceId:current.id,source:value.source,evidence:value.check,dedupe:true});return true;}
      return false;
    }
    function handleSubmit(form){if(form?.getAttribute('id')!=='online-research-form')return false;const input=form.querySelector('[name="query"]');if(input)query=String(input.value||'');void run(true);return true;}
    function handleInput(input){if(input?.id!=='online-query')return false;query=String(input.value||'');return true;}
    return {init,view,handleClick,handleSubmit,handleInput,openSaved};
  };
})();
