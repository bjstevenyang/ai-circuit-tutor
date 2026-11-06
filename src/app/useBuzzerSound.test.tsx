// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBuzzerSound } from './useBuzzerSound';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function audioMock(){
  const created=vi.fn(),start=vi.fn(),stop=vi.fn(),close=vi.fn().mockResolvedValue(undefined);
  const parameter={value:0,cancelScheduledValues:vi.fn(),setTargetAtTime:vi.fn()};
  const gain={gain:parameter,connect:vi.fn(),disconnect:vi.fn()};
  const oscillator={type:'',frequency:{value:0,setTargetAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn(),start,stop};
  const createOscillator=vi.fn(()=>oscillator);
  vi.stubGlobal('AudioContext',class{state='running';destination={};currentTime=2;constructor(){created();}resume=vi.fn().mockResolvedValue(undefined);createOscillator=createOscillator;createGain=()=>gain;close=close;});
  return {created,start,stop,close,parameter,createOscillator,oscillator};
}
describe('louder, adjustable opt-in buzzer',()=>{
  it('reports unavailable audio without enabling sound or losing visual feedback',async()=>{vi.stubGlobal('AudioContext',undefined);const {result}=renderHook(()=>useBuzzerSound(true,{frequency:500,waveform:'sine',level:1}));await act(()=>result.current.toggle());expect(result.current.enabled).toBe(false);expect(result.current.error).toContain('声音不可用');});
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
  it.each([250,500,1000])('uses model sine frequency %i and Vpp gain without restarting',async frequency=>{
    const audio=audioMock(),level=4.495504496/4.5;const {result,rerender}=renderHook(({frequency,level})=>useBuzzerSound(true,{frequency,waveform:'sine',level}),{initialProps:{frequency:250,level}});await act(()=>result.current.toggle());expect(audio.oscillator.type).toBe('sine');expect(audio.oscillator.frequency.value).toBe(250);expect(audio.parameter.value).toBeCloseTo(.125*level,10);
    rerender({frequency,level:.5});expect(audio.oscillator.frequency.setTargetAtTime).toHaveBeenLastCalledWith(frequency,2,.015);expect(audio.parameter.setTargetAtTime).toHaveBeenLastCalledWith(.0625,2,.015);expect(-Math.log(.05)*.015*1000).toBeLessThan(100);expect(audio.createOscillator).toHaveBeenCalledOnce();
  });
});
