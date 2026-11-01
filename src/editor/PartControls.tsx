import { COMPONENTS } from '../circuit';
import type { ComponentInstance, ComponentReading } from '../circuit';

type Settings=Pick<ComponentInstance,'resistance'|'closed'|'position'|'light'>;
export function PartControls({part,reading,pressed,onConfigure,onPress}:{part:ComponentInstance;reading?:ComponentReading;pressed:boolean;onConfigure:(settings:Settings)=>void;onPress:(pressed:boolean)=>void}) {
  return <>
    {part.kind==='resistor'&&<label>阻值 <select aria-label="所选电阻阻值" value={part.resistance??330} onChange={e=>onConfigure({resistance:Number(e.target.value)})}>{[100,330,1000,4700,10000,100000].map(value=><option key={value} value={value}>{value.toLocaleString()} Ω</option>)}</select></label>}
    {part.kind==='switch'&&<button className="small-button" aria-label="开关接通" aria-pressed={part.closed??false} onClick={()=>onConfigure({closed:!part.closed})}>{part.closed?'已接通 · 点击断开':'已断开 · 点击接通'}</button>}
    {part.kind==='button'&&<button className="small-button hold-button" aria-label="按住按钮" aria-pressed={pressed}
      onPointerDown={e=>{if(e.button>0)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture?.(e.pointerId);onPress(true);}}
      onPointerUp={()=>onPress(false)} onPointerCancel={()=>onPress(false)} onLostPointerCapture={()=>onPress(false)} onBlur={()=>onPress(false)}
      onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)onPress(true);}}}
      onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();onPress(false);}}}>{pressed?'正在按下':'按住接通，松开断开'}</button>}
    {part.kind==='potentiometer'&&<><label>总阻值 <select aria-label="电位器总阻值" value={part.resistance??10000} onChange={e=>onConfigure({resistance:Number(e.target.value)})}>{[1000,10000,100000].map(value=><option key={value} value={value}>{value/1000} kΩ</option>)}</select></label><label className="range-control">旋钮位置 <input aria-label="旋钮位置" type="range" min="0" max="100" step="1" value={part.position??50} onChange={e=>onConfigure({position:Number(e.target.value)})}/><output>{part.position??50}%</output></label></>}
    {part.kind==='ldr'&&<label className="range-control">模拟光照 <input aria-label="模拟光照" type="range" min="0" max="100" step="1" value={part.light??50} onChange={e=>onConfigure({light:Number(e.target.value)})}/><output>{part.light??50}%</output></label>}
    {reading&&<span className="part-reading" role="status">{COMPONENTS[part.kind].name}：{reading.currentMa.toFixed(2)} mA{reading.resistanceOhms!==undefined?` · ${Math.round(reading.resistanceOhms).toLocaleString()} Ω`:''}{reading.on!==undefined?` · ${reading.on?'工作中':'未导通/未鸣响'}`:''}</span>}
  </>;
}
