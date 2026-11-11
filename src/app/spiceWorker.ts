import { runSpice } from '../spice/engine';
import type { WorkerRequest, WorkerResponse } from './oscillatorSession';
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<WorkerRequest>)=>void)|null;postMessage:(message:WorkerResponse)=>void};
scope.onmessage=async({data})=>{
  const {sessionId,documentRevision,generation,modelProfileId}=data;
  const identity={sessionId,documentRevision,generation,modelProfileId},start=performance.now();
  try{scope.postMessage({...identity,type:'result',result:await runSpice(data.document,data.controls),elapsedMs:performance.now()-start});}
  catch{scope.postMessage({...identity,type:'result',result:{outcome:'numerical-failure',timeS:0,reason:'SPICE加载或计算失败；未产生本次读数，作品已保留。',entities:[]},elapsedMs:performance.now()-start});}
};
