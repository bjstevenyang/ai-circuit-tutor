import { useEffect, useRef, useState } from 'react';

export function useBuzzerSound(active: boolean) {
  const context=useRef<AudioContext|null>(null);
  const [enabled,setEnabled]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const audio=context.current;
    if(!enabled||!active||!audio)return;
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type='square';oscillator.frequency.value=2000;gain.gain.value=0.025;
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();
    return ()=>{oscillator.stop();oscillator.disconnect();gain.disconnect();};
  },[active,enabled]);
  useEffect(()=>()=>{void context.current?.close();},[]);
  const toggle=async()=>{
    if(enabled){setEnabled(false);return;}
    try {
      if(!window.AudioContext)throw new Error('unsupported');
      if(!context.current||context.current.state==='closed')context.current=new AudioContext();
      await context.current.resume();setEnabled(true);setError('');
    } catch {setError('声音不可用，仍可查看蜂鸣器的鸣响状态。');}
  };
  return {enabled,error,toggle};
}
