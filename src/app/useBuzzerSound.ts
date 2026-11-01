import { useEffect, useRef, useState } from 'react';

export const DEFAULT_BUZZER_VOLUME=50;
export const MAX_BUZZER_GAIN=0.25;
export function useBuzzerSound(active: boolean) {
  const context=useRef<AudioContext|null>(null),gainNode=useRef<GainNode|null>(null);
  const volumeRef=useRef(DEFAULT_BUZZER_VOLUME);
  const [enabled,setEnabled]=useState(false),[error,setError]=useState(''),[volume,setVolume]=useState(DEFAULT_BUZZER_VOLUME);
  useEffect(()=>{
    const audio=context.current;
    if(!enabled||!active||!audio)return;
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type='square';oscillator.frequency.value=2000;
    gain.gain.value=MAX_BUZZER_GAIN*volumeRef.current/100;gainNode.current=gain;
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();
    return ()=>{gainNode.current=null;oscillator.stop();oscillator.disconnect();gain.disconnect();};
  },[active,enabled]);
  useEffect(()=>()=>{void context.current?.close();},[]);
  const changeVolume=(value:number)=>{
    if(!Number.isInteger(value)||value<0||value>100)return;
    volumeRef.current=value;setVolume(value);
    const audio=context.current,gain=gainNode.current;
    if(audio&&gain){gain.gain.cancelScheduledValues(audio.currentTime);gain.gain.setTargetAtTime(MAX_BUZZER_GAIN*value/100,audio.currentTime,0.015);}
  };
  const toggle=async()=>{
    if(enabled){setEnabled(false);return;}
    try {
      if(!window.AudioContext)throw new Error('unsupported');
      if(!context.current||context.current.state==='closed')context.current=new AudioContext();
      await context.current.resume();setEnabled(true);setError('');
    } catch {setError('声音不可用，仍可查看蜂鸣器的鸣响状态。');}
  };
  return {enabled,error,volume,changeVolume,toggle};
}
