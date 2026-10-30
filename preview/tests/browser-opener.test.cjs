'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {browserCommand,openWorkbenchBrowser}=require('../lib/browser-opener.cjs');
const url='http://localhost:8869';
test('Windows workbench prefers an installed Edge instead of the system URL handler',()=>{
 const command=browserCommand(url,{platform:'win32',env:{'ProgramFiles(x86)':'C:/Program Files (x86)'},exists:file=>file.replace(/\\/g,'/')==='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 assert.match(command.exe,/msedge\.exe$/);assert.deepEqual(command.args,['--app='+url]);assert.equal(command.browser,'edge');
});
test('Windows without Edge retains the existing URL handler; other platforms retain their opener',()=>{
 assert.equal(browserCommand(url,{platform:'win32',env:{},exists:()=>false}).exe,'rundll32.exe');
 assert.equal(browserCommand(url,{platform:'darwin'}).exe,'open');assert.equal(browserCommand(url,{platform:'linux'}).exe,'xdg-open');
});
test('opening uses a single safe argument and no shell; spawn failure remains visible to launcher',async()=>{
 const {EventEmitter}=require('node:events');let called;
 const spawn=(exe,args,options)=>{called={exe,args,options};const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;};
 const result=await openWorkbenchBrowser(url,{platform:'win32',env:{ProgramFiles:'D:/Apps'},exists:()=>true,spawn});assert.equal(result.browser,'edge');assert.equal(called.options.shell,undefined);assert.equal(called.options.windowsHide,true);assert.deepEqual(called.args,['--app='+url]);
 await assert.rejects(openWorkbenchBrowser(url,{platform:'win32',env:{},exists:()=>false,spawn:()=>{const child=new EventEmitter();queueMicrotask(()=>child.emit('error',Error('fixture browser unavailable')));return child;}}),/fixture browser unavailable/);
});
