import { useState } from 'react';
import type { ComponentInstance, ModelProfileId } from '../circuit';
import { NumberEditor } from './NumberEditor';

function decimalShift(value:number,places:number):number {
  const [coefficient,exponent='0']=String(value).split('e');
  return Number(`${coefficient}e${Number(exponent)+places}`);
}

/** Unit selection is a display preference; only a complete, valid application edits the document. */
export function CapacitanceEditor({part,profile,onApply}:{part:ComponentInstance;profile:ModelProfileId;onApply:(capacitanceF:number)=>void}) {
  const oscillator=profile==='oscillator-em-v1';
  const [unit,setUnit]=useState<'nF'|'μF'>(oscillator?'nF':'μF');
  const places=unit==='nF'?9:6;
  const displayed=(value:number)=>decimalShift(value,places);
  const presetF=oscillator?[47e-9,100e-9,220e-9]:[10e-6,100e-6,1000e-6];
  const min=oscillator?47e-9:10e-6,max=oscillator?220e-9:1000e-6;
  const value=part.capacitanceF!;
  return <>
    <label>显示单位 <select aria-label="电容显示单位" value={unit} onChange={e=>setUnit(e.target.value as 'nF'|'μF')}><option value="nF">nF</option><option value="μF">μF</option></select></label>
    <label>容量预设 <select aria-label="电容容量预设" value={value} onChange={e=>onApply(Number(e.target.value))}>
      {!presetF.includes(value)&&<option value={value}>{displayed(value)} {unit}（保留的配置）</option>}
      {presetF.map(v=><option key={v} value={v}>{displayed(v)} {unit}</option>)}
    </select></label>
    <NumberEditor key={`${part.id}:${profile}:${value}:${unit}`} label="电容容量" value={displayed(value)} unit={unit}
      min={displayed(min)} max={displayed(max)} onApply={v=>onApply(decimalShift(v,-places))}/>
    {value<min||value>max?<p role="status">已保留容量；该值不在当前模型范围内，运行前请调整。</p>:null}
    {oscillator&&<small>100 nF = 0.1 μF；所有电容从零初态重新计算。</small>}
  </>;
}
