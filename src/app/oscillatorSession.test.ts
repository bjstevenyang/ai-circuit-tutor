// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDocument } from '../circuit';
import { OscillatorSession } from './oscillatorSession';
import type { SessionWorker, WorkerRequest, WorkerResponse } from './oscillatorSession';

class FakeWorker implements SessionWorker {
  onmessage:Worker['onmessage']=null;onerror:Worker['onerror']=null;
  terminate=vi.fn();request:WorkerRequest|undefined;
  postMessage=(request:WorkerRequest)=>{this.request=request;};
  emit(message:Partial<WorkerResponse>={}){this.onmessage?.call(this as unknown as Worker,{data:{...this.request,type:'result',result:{outcome:'settled-DC',timeS:.04,reason:'DC',entities:[]},elapsedMs:1,...message}} as MessageEvent<WorkerResponse>);}
}
afterEach(()=>vi.useRealTimers());
describe('bounded oscillator worker ownership',()=>{
  it('rejects every stale identity and terminates the sole worker before delivering a result',()=>{
    const worker=new FakeWorker(),result=vi.fn(),progress=vi.fn(),session=new OscillatorSession(()=>worker);
    session.start({...createEmptyDocument(),modelProfileId:'oscillator-em-v2'},{},{sessionId:3,documentRevision:9},result,progress);
    for(const changed of [{generation:100},{sessionId:4},{documentRevision:8},{modelProfileId:'legacy-stage2-v1'}])worker.emit(changed as Partial<WorkerResponse>);
    expect(result).not.toHaveBeenCalled();
    worker.emit({type:'progress',progress:{pass:2,timeS:.01,accepted:1,rejected:0}});
    expect(progress).toHaveBeenCalledOnce();expect(result).not.toHaveBeenCalled();
    worker.emit();expect(result).toHaveBeenCalledOnce();expect(worker.terminate).toHaveBeenCalledOnce();
    worker.emit();expect(result).toHaveBeenCalledOnce();
  });
  it('invalidates stop, edit and restart before a queued old message can restore outputs',()=>{
    const old=new FakeWorker(),next=new FakeWorker(),result=vi.fn(),factory=vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(next),session=new OscillatorSession(factory);
    session.start(createEmptyDocument(),{},{sessionId:1,documentRevision:0},result,vi.fn());session.cancel();old.emit();
    expect(result).not.toHaveBeenCalled();expect(old.terminate).toHaveBeenCalledOnce();
    session.start(createEmptyDocument(),{pressedButtons:['button']},{sessionId:2,documentRevision:1},result,vi.fn());old.emit();
    expect(next.request?.controls.pressedButtons).toEqual(['button']);next.emit();expect(result).toHaveBeenCalledOnce();
  });
  it('supervises one 5-second wall clock across both passes and clears outputs on error',()=>{
    vi.useFakeTimers();const worker=new FakeWorker(),result=vi.fn(),session=new OscillatorSession(()=>worker);
    session.start(createEmptyDocument(),{},{sessionId:1,documentRevision:0},result,vi.fn());
    vi.advanceTimersByTime(4000);worker.emit({type:'progress',progress:{pass:2,timeS:.02,accepted:400000,rejected:1}});
    vi.advanceTimersByTime(1000);expect(result.mock.calls[0]?.[0]).toMatchObject({outcome:'resource-limit'});
    expect(result.mock.calls[0]?.[0]).not.toHaveProperty('readings');expect(worker.terminate).toHaveBeenCalledOnce();worker.emit();expect(result).toHaveBeenCalledOnce();
  });
  it('reports unavailable workers without pretending to calculate',()=>{
    const result=vi.fn(),session=new OscillatorSession(()=>{throw Error('unavailable');});
    session.start(createEmptyDocument(),{},{sessionId:1,documentRevision:0},result,vi.fn());
    expect(result.mock.calls[0]?.[0]).toMatchObject({outcome:'numerical-failure'});
  });
});
