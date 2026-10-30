'use strict';
const {parentPort,workerData}=require('node:worker_threads');
function run(){try{parentPort.postMessage(require('./library.cjs').loadCatalog(workerData.dir));}catch{parentPort.postMessage({error:true});}}
if(workerData.delayMs)setTimeout(run,workerData.delayMs);else run();
