// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBuzzerSound } from './useBuzzerSound';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function audioMock(){
  const created=vi.fn(),start=vi.fn(),stop=vi.fn(),close=vi.fn().mockResolvedValue(undefined);
  const parameter={value:0,cancelScheduledValues:vi.fn(),setTargetAtTime:vi.fn()};
  const gain={gain:parameter,connect:vi.fn(),disconnect:vi.fn()};
  const oscillator={type:'',frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start,stop};
  const createOscillator=vi.fn(()=>oscillator);
  vi.stubGlobal('AudioContext',class{state='running';destination={};currentTime=2;constructor(){created();}resume=vi.fn().mockResolvedValue(undefined);createOscillator=createOscillator;createGain=()=>gain;close=close;});
  return {created,start,stop,close,parameter,createOscillator};
}
describe('louder, adjustable opt-in buzzer',()=>{
  it('starts at a higher default gain only after the user enables sound',async()=>{
    const audio=audioMock();const {result,unmount}=renderHook(()=>useBuzzerSound(true));
    expect(result.current.volume).toBe(50);expect(result.current.enabled).toBe(false);expect(audio.created).not.toHaveBeenCalled();
    await act(()=>result.current.toggle());
    expect(audio.parameter.value).toBe(0.125);expect(audio.parameter.value).toBeGreaterThan(0.025);expect(audio.start).toHaveBeenCalledOnce();
    unmount();expect(audio.stop).toHaveBeenCalledOnce();expect(audio.close).toHaveBeenCalledOnce();
  });
  it('smoothly adjusts volume, mutes at zero, rejects invalid settings and does not restart the oscillator',async()=>{
    const audio=audioMock();const {result,rerender}=renderHook(({active})=>useBuzzerSound(active),{initialProps:{active:true}});
    await act(()=>result.current.toggle());
    act(()=>result.current.changeVolume(100));
    expect(audio.parameter.setTargetAtTime).toHaveBeenLastCalledWith(.25,2,.015);
    for(const value of [-1,101,NaN,Infinity,.5])act(()=>result.current.changeVolume(value));
    expect(result.current.volume).toBe(100);expect(audio.parameter.setTargetAtTime).toHaveBeenCalledOnce();
    act(()=>result.current.changeVolume(0));expect(audio.parameter.setTargetAtTime).toHaveBeenLastCalledWith(0,2,.015);
    expect(audio.createOscillator).toHaveBeenCalledOnce();
    rerender({active:false});expect(audio.stop).toHaveBeenCalledOnce();
    act(()=>result.current.changeVolume(80));
    rerender({active:true});expect(audio.parameter.value).toBe(.2);
    await act(()=>result.current.toggle());expect(audio.stop).toHaveBeenCalledTimes(2);
  });
});
