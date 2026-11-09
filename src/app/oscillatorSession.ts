import type { CircuitDocument, SimulationControls } from '../circuit';
import type { OscillatorProgress, OscillatorResult } from '../circuit/oscillator/types';

export type SessionIdentity = {sessionId:number;documentRevision:number;generation:number;modelProfileId:'oscillator-em-v2'};
export type WorkerRequest = SessionIdentity & {document:CircuitDocument;controls:SimulationControls};
export type WorkerResponse = SessionIdentity & ({type:'progress';progress:OscillatorProgress}|{type:'result';result:OscillatorResult;elapsedMs:number});
export type SessionWorker = Pick<Worker,'postMessage'|'terminate'|'onmessage'|'onerror'>;
export const OSCILLATOR_DEADLINE_MS=5000;
export const oscillatorFailure=(reason:string,timeS=0):OscillatorResult=>({outcome:'resource-limit',reason,timeS,entities:[]});

/** Owns one worker. Invalidating the identity happens before termination or callbacks. */
export class OscillatorSession {
  private worker:SessionWorker|null=null;
  private deadline:ReturnType<typeof setTimeout>|undefined;
  private generation=0;
  constructor(private factory:()=>SessionWorker=()=>new Worker(new URL('./oscillatorWorker.ts',import.meta.url),{type:'module'})) {}
  cancel(){this.generation++;if(this.deadline!==undefined)clearTimeout(this.deadline);this.deadline=undefined;this.worker?.terminate();this.worker=null;}
  start(document:CircuitDocument,controls:SimulationControls,identity:Pick<SessionIdentity,'sessionId'|'documentRevision'>,onResult:(result:OscillatorResult,elapsedMs:number)=>void,onProgress:(progress:OscillatorProgress)=>void){
    this.cancel();
    const generation=this.generation,token:SessionIdentity={...identity,generation,modelProfileId:'oscillator-em-v2'};
    const finish=(result:OscillatorResult,elapsedMs:number)=>{if(generation!==this.generation)return;this.cancel();onResult(result,elapsedMs);};
    const started=performance.now();
    try {
      const worker=this.factory();this.worker=worker;
      worker.onmessage=(event:MessageEvent<WorkerResponse>)=>{
        const message=event.data;
        if(generation!==this.generation||message.generation!==generation||message.sessionId!==token.sessionId||message.documentRevision!==token.documentRevision||message.modelProfileId!==token.modelProfileId)return;
        if(message.type==='progress')onProgress(message.progress);else finish(message.result,message.elapsedMs);
      };
      worker.onerror=()=>finish({outcome:'numerical-failure',reason:'计算线程不可用；作品已保留，请停止后重试。',timeS:0,entities:[]},performance.now()-started);
      this.deadline=setTimeout(()=>finish(oscillatorFailure('完整计算超过5秒墙钟预算；未产生本次读数。'),performance.now()-started),OSCILLATOR_DEADLINE_MS);
      worker.postMessage({...token,document,controls} satisfies WorkerRequest);
    } catch {finish({outcome:'numerical-failure',reason:'浏览器无法启动计算线程；作品已保留。',timeS:0,entities:[]},performance.now()-started);}
  }
}

export function speakerDrive(result:OscillatorResult|undefined){
  const speaker=result?.speaker,frequency=speaker?.frequencyHz??0;
  const active=result?.outcome==='periodic'&&!!speaker&&!speaker.bypassed&&speaker.acRmsV>=.001&&frequency>=20&&frequency<=20000;
  return {active,frequency,waveform:'sine' as const,level:speaker?Math.min(speaker.acRmsV,1):0};
}
