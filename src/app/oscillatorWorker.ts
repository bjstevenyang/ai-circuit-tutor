import { compileOscillator, createOscillatorAnalysis, advanceOscillatorAnalysis } from '../circuit/oscillator/analysis';
import type { WorkerRequest, WorkerResponse } from './oscillatorSession';
import { OSCILLATOR_DEADLINE_MS, oscillatorFailure } from './oscillatorSession';

const scope=globalThis as unknown as {onmessage:((event:MessageEvent<WorkerRequest>)=>void)|null;postMessage:(message:WorkerResponse)=>void};
scope.onmessage=({data})=>{
  const {sessionId,documentRevision,generation,modelProfileId}=data;
  const identity={sessionId,documentRevision,generation,modelProfileId},started=performance.now();
  let lastProgress=-Infinity,lastTimeS=0;
  const finish=(result:import('../circuit/oscillator/types').OscillatorResult)=>scope.postMessage({...identity,type:'result',result,elapsedMs:performance.now()-started});
  try {
    const compiled=compileOscillator(data.document,data.controls);
    if(!compiled.ok){finish(compiled.result);return;}
    let state=createOscillatorAnalysis(compiled.compiled);
    for(;;){
      if(performance.now()-started>=OSCILLATOR_DEADLINE_MS){finish(oscillatorFailure('完整计算超过5秒墙钟预算；未产生本次读数。',lastTimeS));return;}
      const next=advanceOscillatorAnalysis(compiled.compiled,state);
      if(next.done){finish(next.result);return;}
      state=next.state;
      lastTimeS=next.progress.timeS;
      if(performance.now()-lastProgress>=100||next.progress.pass===2&&lastProgress<0){scope.postMessage({...identity,type:'progress',progress:next.progress});lastProgress=performance.now();}
    }
  } catch {finish({outcome:'numerical-failure',timeS:lastTimeS,reason:'数值计算未能完成；未产生本次读数，作品已保留。',entities:[]});}
};
