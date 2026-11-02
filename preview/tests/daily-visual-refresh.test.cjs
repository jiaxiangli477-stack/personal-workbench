'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../dist/model.js'),visuals=require('../dist/visuals.js');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup(){
 const state=M.empty(),calls={saves:[],renders:0,selectors:[],focus:0},timeline={outerHTML:'old timeline'},history={innerHTML:'old history'},active={value:'原输入',selectionStart:2},button={focus:()=>calls.focus++};
 const document={activeElement:active,querySelector:s=>{calls.selectors.push(s);if(s==='.viz-review-map')return timeline;if(s==='.review-history')return history;if(s==='[data-action="daily-period"][data-value="weekly"]')return button;return null;}};
 const sandbox={window:{WBVisuals:visuals},document,FormData:class{constructor(form){return form.fields;}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/daily-ui.js'),'utf8'),sandbox);
 const ctx={M,esc,icon:()=>'',heading:()=>'',modal:()=>{},toast:()=>{},getState:()=>state,save:x=>calls.saves.push(x),render:()=>calls.renders++,isReady:()=>true};
 return {ui:sandbox.window.WBDailyUI(ctx,{}),state,calls,timeline,history,active,document};
}
test('typing updates both timeline and recent records without replacing the focused input',()=>{const x=setup(),key=M.todayKey(),form={dataset:{period:'daily',key},fields:new Map([['review-0','完成 <验证>'],['review-1',''],['review-2','下一步']])},target={closest:()=>form};assert.equal(x.ui.input(target),true);assert.equal(x.calls.renders,0);assert.equal(x.document.activeElement,x.active);assert.equal(x.active.value,'原输入');assert.equal(x.active.selectionStart,2);assert.deepEqual(x.calls.saves,[true]);assert.match(x.timeline.outerHTML,/完成 &lt;验证&gt;/);assert.match(x.history.innerHTML,/完成 &lt;验证&gt;/);assert.match(x.history.innerHTML,/data-action="review-history"/);assert.deepEqual(Array.from(x.state.reviews.daily[key]),['完成 <验证>','','下一步']);});
test('switching review period returns keyboard focus to the selected period',()=>{const x=setup();assert.equal(x.ui.handle('daily-period',{dataset:{value:'weekly'}}),true);assert.equal(x.calls.renders,1);assert.equal(x.calls.focus,1);assert.match(x.ui.review(),/每周复盘/);});
