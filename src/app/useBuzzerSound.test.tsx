// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBuzzerSound } from './useBuzzerSound';
import { speakerDrive } from './oscillatorSession';
import type { OscillatorResult } from '../circuit/oscillator/types';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function audioMock(){
  const created=vi.fn(),start=vi.fn(),stop=vi.fn(),close=vi.fn().mockResolvedValue(undefined);
  const parameter={value:0,cancelScheduledValues:vi.fn(),setTargetAtTime:vi.fn()};
  const gain={gain:parameter,connect:vi.fn(),disconnect:vi.fn()};
  const oscillator={type:'',frequency:{value:0,setTargetAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn(),start,stop};
  const createOscillator=vi.fn(()=>oscillator);
  vi.stubGlobal('AudioContext',class{state='running';destination={};currentTime=2;constructor(){created();}resume=vi.fn().mockResolvedValue(undefined);createOscillator=createOscillator;createGain=()=>gain;close=close;});
  return {created,start,stop,close,parameter,createOscillator,oscillator,gain};
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

describe('OSC-04 solved speaker sine and session cleanup',()=>{
  const frequency=288.498942,acRmsV=.365174583610;
  const solved=(speaker:Partial<NonNullable<OscillatorResult['speaker']>>={}):OscillatorResult=>({outcome:'periodic',timeS:.04,reason:'',entities:[],speaker:{id:'SPK1',voltageV:1,acRmsV,frequencyHz:frequency,bypassed:false,...speaker}});
  it.each([20,20000])('includes the audio frequency boundary %s Hz without replacing the model frequency',frequencyHz=>{
    expect(speakerDrive(solved({frequencyHz,acRmsV:.001}))).toEqual({active:true,frequency:frequencyHz,waveform:'sine',level:.001});
  });
  it.each([19.999,20000.001])('keeps out-of-range %s Hz available as text data while disabling audio',frequencyHz=>{
    expect(speakerDrive(solved({frequencyHz}))).toMatchObject({active:false,frequency:frequencyHz});
  });
  it('rejects insufficient AC RMS, bypass, absent port and every nonperiodic or failed outcome',()=>{
    expect(speakerDrive(solved({acRmsV:.000999})).active).toBe(false);
    expect(speakerDrive(solved({bypassed:true,acRmsV:0})).active).toBe(false);
    expect(speakerDrive({outcome:'periodic',timeS:.04,reason:'',entities:[]}).active).toBe(false);
    for(const outcome of ['settled-DC','window-no-period','unsupported-topology','unsupported-model-domain','unsupported-model-version','numerical-failure','resource-limit'] as const)
      expect(speakerDrive({...solved(),outcome}).active).toBe(false);
    expect(speakerDrive(undefined).active).toBe(false);
  });
  it('maps only AC RMS to capped gain and keeps swapped speaker endpoint magnitude and frequency unchanged',()=>{
    expect(speakerDrive(solved({acRmsV:2})).level).toBe(1);
    expect(speakerDrive(solved({voltageV:-1}))).toEqual(speakerDrive(solved({voltageV:1})));
  });
  it('uses the solved port frequency and AC RMS gain only after a user gesture, including volume 0 and 100',async()=>{
    const audio=audioMock();
    const {result,rerender}=renderHook(({active,acRmsV})=>useBuzzerSound(active,{frequency,waveform:'sine',level:Math.min(acRmsV,1)}),{initialProps:{active:true,acRmsV}});
    expect(audio.created).not.toHaveBeenCalled();expect(audio.start).not.toHaveBeenCalled();
    await act(()=>result.current.toggle());
    expect(audio.oscillator.type).toBe('sine');expect(audio.oscillator.frequency.value).toBe(frequency);
    expect(audio.parameter.value).toBeCloseTo(.25*.5*acRmsV,12);
    act(()=>result.current.changeVolume(100));
    expect(audio.parameter.setTargetAtTime).toHaveBeenLastCalledWith(.25*acRmsV,2,.015);
    act(()=>result.current.changeVolume(0));expect(audio.parameter.setTargetAtTime).toHaveBeenLastCalledWith(0,2,.015);
    // Reversing a port leaves its AC RMS unchanged and does not restart audio.
    rerender({active:true,acRmsV});expect(audio.createOscillator).toHaveBeenCalledOnce();
    // A stronger solved port uses the declared 1 V gain ceiling.
    rerender({active:true,acRmsV:2});
    act(()=>result.current.changeVolume(100));expect(audio.parameter.setTargetAtTime).toHaveBeenLastCalledWith(.25,2,.015);
  });
  it('retains the session permission while cancelling calculation, DC/bypass or background output and recreates only for a fresh eligible result',async()=>{
    const audio=audioMock();
    const {result,rerender,unmount}=renderHook(({active})=>useBuzzerSound(active,{frequency,waveform:'sine',level:acRmsV}),{initialProps:{active:false}});
    await act(()=>result.current.toggle());expect(result.current.enabled).toBe(true);expect(audio.start).not.toHaveBeenCalled();
    rerender({active:true});expect(audio.start).toHaveBeenCalledOnce();
    rerender({active:false});expect(audio.stop).toHaveBeenCalledOnce();
    expect(audio.oscillator.disconnect).toHaveBeenCalledOnce();expect(audio.gain.disconnect).toHaveBeenCalledOnce();
    expect(result.current.enabled).toBe(true);
    rerender({active:true});expect(audio.start).toHaveBeenCalledTimes(2);
    await act(()=>result.current.toggle());expect(audio.stop).toHaveBeenCalledTimes(2);
    expect(result.current.enabled).toBe(false);
    unmount();expect(audio.close).toHaveBeenCalledOnce();
  });
  it('closes the AudioContext on pagehide and still cleans the active oscillator on unmount',async()=>{
    const audio=audioMock();const {result,unmount}=renderHook(()=>useBuzzerSound(true,{frequency,waveform:'sine',level:acRmsV}));
    await act(()=>result.current.toggle());
    act(()=>window.dispatchEvent(new Event('pagehide')));expect(audio.close).toHaveBeenCalledOnce();
    unmount();expect(audio.stop).toHaveBeenCalledOnce();expect(audio.oscillator.disconnect).toHaveBeenCalledOnce();expect(audio.gain.disconnect).toHaveBeenCalledOnce();
  });
});
