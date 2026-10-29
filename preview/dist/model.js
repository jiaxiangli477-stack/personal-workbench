(function () {
  'use strict';
  function empty() { return {version:1,modifiedAt:0,done:{},trials:[],notes:{},reviews:{},tasks:[],ideas:[],connection:{}}; }
  const record = v => v && typeof v === 'object' && !Array.isArray(v);
  function restore(raw) {
    const base=empty();
    try { const v=JSON.parse(raw); if(!v || v.version!==1)return base;
      for(const k of ['done','notes','reviews','connection']) if(record(v[k])) base[k]=v[k];
      if(Number.isFinite(v.modifiedAt))base.modifiedAt=v.modifiedAt;
      if(Array.isArray(v.trials))base.trials=[...new Set(v.trials.filter(x=>typeof x==='string'))];
      if(Array.isArray(v.tasks))base.tasks=v.tasks.filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string'&&Number.isFinite(t.minutes));
      if(Array.isArray(v.ideas))base.ideas=v.ideas.filter(t=>t&&typeof t.title==='string'&&typeof t.body==='string');
      return base;
    } catch { return base; }
  }
  function toggleTask(s,id){s.done[id]=!s.done[id];return s.done[id];}
  function addTrial(s,id){if(s.trials.includes(id))return false;s.trials.push(id);return true;}
  function removeTrial(s,id){s.trials=s.trials.filter(x=>x!==id);}
  function addTask(s,title,minutes){title=title.trim().slice(0,120);if(!title)return null;const t={id:'task-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title,minutes:Math.min(180,Math.max(5,Number(minutes)||15)),tag:'我的安排',body:'你添加的本地任务。完成后可以勾选，也可以再次取消。'};s.tasks.push(t);return t;}
  function chooseRecovery(local,disk){return (local?.modifiedAt||0)>(disk?.modifiedAt||0)?local:disk;}
  window.WBModel={empty,restore,toggleTask,addTrial,removeTrial,addTask,chooseRecovery};
})();
