import { COMPONENTS, getComponentPins, MIN_RESISTANCE, MAX_RESISTANCE } from '../circuit';
import type { ComponentInstance, ComponentReading } from '../circuit';
import { NumberEditor } from './NumberEditor';
import { relativeLedBrightness } from './ledAppearance';

type Settings=Pick<ComponentInstance,'resistance'|'closed'|'position'|'light'>;
export function PartControls({part,reading,pressed,onConfigure,onPress}:{part:ComponentInstance;reading?:ComponentReading;pressed:boolean;onConfigure:(settings:Settings)=>void;onPress:(pressed:boolean)=>void}) {
  const pins=getComponentPins(part),brightness=relativeLedBrightness(reading);
  const presets=[100,330,1000,4700,10000,100000];
  return <>
    {part.kind==='led'&&pins&&<div className="led-connection-guide" aria-label="LED 极性与接点"><strong>LED 接线方向</strong><span><b>A＋ 阳极 · {pins[0]}</b>朝向电源正极，支路串入限流电阻</span><span><b>K− 阴极 · {pins[1]}</b>朝向电源负极，灯体平边靠近 K</span><small>＋／− 表示引脚极性，不表示已经接通电源。</small><span>相对亮度：{brightness===null?'未计算，请运行电路':`${Math.round(brightness*100)}%（教学示意）`}</span></div>}
    {part.kind==='resistor'&&<><label>阻值预设 <select aria-label="所选电阻阻值" value={part.resistance??330} onChange={e=>onConfigure({resistance:Number(e.target.value)})}>{!presets.includes(part.resistance??330)&&<option value={part.resistance}>{part.resistance} Ω（自定义）</option>}{presets.map(value=><option key={value} value={value}>{value.toLocaleString()} Ω</option>)}</select></label><NumberEditor key={`${part.id}:${part.resistance??330}`} label="电阻阻值" value={part.resistance??330} unit="Ω" min={MIN_RESISTANCE} max={MAX_RESISTANCE} onApply={resistance=>onConfigure({resistance})}/></>}
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
