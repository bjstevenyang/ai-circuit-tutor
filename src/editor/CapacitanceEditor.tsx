import { useState } from 'react';
import type { ComponentInstance, ModelProfileId } from '../circuit';
import { capacitanceRangeForProfile, DEFAULT_CAPACITANCE_F, isCapacitanceForProfile, isOscillatorProfile } from '../circuit';
import { NumberEditor } from './NumberEditor';

function decimalShift(value:number,places:number):number {
  const [coefficient,exponent='0']=String(value).split('e');
  return Number(`${coefficient}e${Number(exponent)+places}`);
}

/** Unit selection is a display preference; only a complete, valid application edits the document. */
export function CapacitanceEditor({part,profile,onApply}:{part:ComponentInstance;profile:ModelProfileId;onApply:(capacitanceF:number)=>void}) {
  const oscillator=isOscillatorProfile(profile);
  const [unit,setUnit]=useState<'nF'|'μF'>(oscillator||part.capacitanceF===DEFAULT_CAPACITANCE_F?'nF':'μF');
  const places=unit==='nF'?9:6;
  const displayed=(value:number)=>decimalShift(value,places);
  const presetF=oscillator?[47e-9,100e-9,220e-9]:[DEFAULT_CAPACITANCE_F,10e-6,100e-6,1000e-6];
  const [min,max]=capacitanceRangeForProfile(profile);
  const value=part.capacitanceF!;
  return <>
    <label>显示单位 <select aria-label="电容显示单位" value={unit} onChange={e=>setUnit(e.target.value as 'nF'|'μF')}><option value="nF">nF</option><option value="μF">μF</option></select></label>
    <label>容量预设 <select aria-label="电容容量预设" value={value} onChange={e=>onApply(Number(e.target.value))}>
      {!presetF.includes(value)&&<option value={value}>{displayed(value)} {unit}（保留的配置）</option>}
      {presetF.map(v=><option key={v} value={v}>{oscillator?`${displayed(v)} ${unit}`:v===DEFAULT_CAPACITANCE_F?'100 nF':`${decimalShift(v,6)} μF`}</option>)}
    </select></label>
    <NumberEditor key={`${part.id}:${profile}:${value}:${unit}`} label="电容容量" value={displayed(value)} unit={unit}
      min={displayed(min)} max={displayed(max)} isAllowed={v=>isCapacitanceForProfile(decimalShift(v,-places),profile)}
      {...(oscillator?{}:{rangeLabel:'100 nF（0.1 μF）或 10–1000 μF'})} onApply={v=>onApply(decimalShift(v,-places))}/>
    {!isCapacitanceForProfile(value,profile)?<p role="status">已保留容量；该值不在当前模型范围内，运行前请调整。</p>:null}
    {!oscillator&&<small>100 nF 配 10 kΩ 时 τ = 1 ms；观察缓慢充放电可选择 100 μF。</small>}
    {oscillator&&<small>100 nF = 0.1 μF；所有电容从零初态重新计算。</small>}
  </>;
}
