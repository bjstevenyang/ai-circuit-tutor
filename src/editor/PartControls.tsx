import { COMPONENTS, getComponentPins, MIN_RESISTANCE, MAX_RESISTANCE } from '../circuit';
import type { ComponentInstance, ComponentReading, ModelProfileId } from '../circuit';
import { NumberEditor } from './NumberEditor';
import { relativeLedBrightness } from './ledAppearance';
import { CapacitanceEditor } from './CapacitanceEditor';

type Settings=Pick<ComponentInstance,'resistance'|'closed'|'position'|'light'|'capacitanceF'|'transistorModel'>;
export function PartControls({part,reading,pressed,onConfigure,onPress,autoAnnounce=true,profile='legacy-stage2-v1'}:{part:ComponentInstance;reading?:ComponentReading;pressed:boolean;autoAnnounce?:boolean;profile?:ModelProfileId;onConfigure:(settings:Settings)=>void;onPress:(pressed:boolean)=>void}) {
  const pins=getComponentPins(part),brightness=relativeLedBrightness(reading);
  const presets=[100,330,1000,4700,10000,100000];
  const potTotal=part.resistance??10000,potPosition=part.position??50;
  return <>
    {part.kind==='led'&&pins&&<div className="led-connection-guide" aria-label="LED 极性与接点"><strong>LED 接线方向</strong><span><b>A＋ 阳极 · {pins[0]}</b>朝向电源正极，支路串入限流电阻</span><span><b>K− 阴极 · {pins[1]}</b>朝向电源负极，灯体平边靠近 K</span><small>＋／− 表示引脚极性，不表示已经接通电源。</small><span>相对亮度：{brightness===null?'未计算，请运行电路':`${Math.round(brightness*100)}%（教学示意）`}</span></div>}
    {part.kind==='potentiometer'&&pins&&<div className="pot-connection-guide" role="region" aria-label="电位器引脚与接线">
      <strong>认清三个脚，再接线</strong>
      <dl className="pot-pin-list"><div><dt>A · {pins[0]}</dt><dd>电阻轨一端</dd></div><div><dt>W · {pins[1]}</dt><dd>滑臂，随旋钮移动</dd></div><div><dt>B · {pins[2]}</dt><dd>电阻轨另一端</dd></div></dl>
      <p>A、B 没有固定正负极。A–B 总阻值不变，旋钮改变 A–W 和 W–B 两段。</p>
      <p className="pot-segments" aria-label="电位器内部电阻段">A–W：{(potTotal*potPosition/100).toLocaleString()} Ω · W–B：{(potTotal*(100-potPosition)/100).toLocaleString()} Ω</p>
      <div className="pot-wiring-example"><strong>LED 调光：用 A 和 W，B 留空</strong><code>电池＋ → 固定限流电阻 → A〔电位器〕W → A＋〔LED〕K− → 电池−</code><p>4.5 V 入门实验保留 330 Ω 固定电阻。B（{pins[2]}）不接；旋钮 0% 时 A–W 为零，仍靠固定电阻限流。</p></div>
      <details><summary>三脚分压怎么接？</summary><p>一种接法：A 接电池正极方向，B 接负极方向，W 接负载，负载另一端回负极。调旋钮可改变输出；接负载后电压还受负载影响。</p></details>
      <p className="pot-wiring-note">引脚孔已占用，请接到同一五孔组的其他空孔。A、W、B 不要落入同一导电组，也不要用导线直接短接。</p>
    </div>}
    {part.kind==='resistor'&&<><label>阻值预设 <select aria-label="所选电阻阻值" value={part.resistance??330} onChange={e=>onConfigure({resistance:Number(e.target.value)})}>{!presets.includes(part.resistance??330)&&<option value={part.resistance}>{part.resistance} Ω（自定义）</option>}{presets.map(value=><option key={value} value={value}>{value.toLocaleString()} Ω</option>)}</select></label><NumberEditor key={`${part.id}:${part.resistance??330}`} label="电阻阻值" value={part.resistance??330} unit="Ω" min={MIN_RESISTANCE} max={MAX_RESISTANCE} onApply={resistance=>onConfigure({resistance})}/></>}
    {part.kind==='switch'&&<button className="small-button" aria-label="开关接通" aria-pressed={part.closed??false} onClick={()=>onConfigure({closed:!part.closed})}>{part.closed?'已接通 · 点击断开':'已断开 · 点击接通'}</button>}
    {part.kind==='button'&&<button className="small-button hold-button" aria-label="按住按钮" aria-pressed={pressed}
      onPointerDown={e=>{if(e.button>0)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture?.(e.pointerId);onPress(true);}}
      onPointerUp={()=>onPress(false)} onPointerCancel={()=>onPress(false)} onLostPointerCapture={()=>onPress(false)} onBlur={()=>onPress(false)}
      onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)onPress(true);}}}
      onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();onPress(false);}}}>{pressed?'正在按下':'按住接通，松开断开'}</button>}
    {part.kind==='potentiometer'&&<><label>总阻值 <select aria-label="电位器总阻值" value={part.resistance??10000} onChange={e=>onConfigure({resistance:Number(e.target.value)})}>{[1000,10000,100000].map(value=><option key={value} value={value}>{value/1000} kΩ</option>)}</select></label><label className="range-control">旋钮位置 <input aria-label="旋钮位置" type="range" min="0" max="100" step="1" value={part.position??50} onChange={e=>onConfigure({position:Number(e.target.value)})}/><output>{part.position??50}%</output></label></>}
    {part.kind==='ldr'&&<label className="range-control">模拟光照 <input aria-label="模拟光照" type="range" min="0" max="100" step="1" value={part.light??50} onChange={e=>onConfigure({light:Number(e.target.value)})}/><output>{part.light??50}%</output></label>}
    {(part.kind==='npn'||part.kind==='pnp')&&profile==='oscillator-em-v2'&&<div className="transistor-model-settings"><label>晶体管参数模型 <select aria-label="晶体管参数模型" value={part.transistorModel??'generic'} onChange={e=>onConfigure({transistorModel:e.target.value as ComponentInstance['transistorModel']})}><option value="generic">通用虚拟模型（原版）</option><option value={part.kind==='npn'?'2n3904':'2n3906'}>{part.kind==='npn'?'2N3904':'2N3906'}（SPICE 参数子集）</option></select></label><small>型号参数来自已公开的 SPICE 模型；仅使用 IS/BF/CJE/CJC 的固定线性近似，非完整 SPICE、未验证真实振荡频率、器件安全或实际封装引脚。</small></div>}
    {part.kind==='capacitor'&&<CapacitanceEditor key={`${part.id}:${profile}`} part={part} profile={profile} onApply={capacitanceF=>onConfigure({capacitanceF})}/>}
    {reading&&<span className="part-reading" aria-live={autoAnnounce?'polite':'off'}>{COMPONENTS[part.kind].name}：{reading.currentMa===undefined?'电流未提供':`${reading.currentMa.toFixed(4)} mA`}{reading.resistanceOhms!==undefined?` · ${Math.round(reading.resistanceOhms).toLocaleString()} Ω`:''}{reading.on!==undefined?` · ${reading.on?'工作中':'未导通/未鸣响'}`:''}</span>}
  </>;
}
