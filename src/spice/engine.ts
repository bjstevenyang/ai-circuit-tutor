import { Simulation } from 'eecircuit-engine';
import type { CircuitDocument, SimulationControls, ComponentReading } from '../circuit';
import type { OscillatorResult } from '../circuit/oscillator/types';
import { resistanceOf } from '../circuit/catalog';
import { spiceNetlist } from './netlist';

/** Worker-owned instance: the parent session enforces the deadline and terminates on cancellation. */
export async function runSpice(document:CircuitDocument,controls:SimulationControls={}):Promise<OscillatorResult>{
  const input=spiceNetlist(document,controls);if(!input.ok)return input.result;
  const sim=new Simulation();await sim.start();sim.setNetList(input.netlist);
  const raw=await sim.runSim();
  const fail=(reason:string):OscillatorResult=>({outcome:'numerical-failure',timeS:0,reason,entities:[]});
  if(raw.dataType!=='real'||raw.numPoints>1_000_000)return fail('SPICE结果格式或采样数量超出限制');
  const data=new Map(raw.data.map(v=>[v.name.toLowerCase(),v.values]));
  const t=data.get('time');if(!t||t.length<2||!Number.isFinite(t.at(-1))||t[0]!>1e-6||!t.every((v,i)=>i===0||v>t[i-1]!)||Math.abs(t.at(-1)!-.04)>1e-9)return fail('SPICE未完成40ms观察窗');
  if(raw.data.some(v=>v.values.length!==t.length||v.values.some(x=>!Number.isFinite(x))))return fail('SPICE返回无效数值');
  const voltage=(name:string,i:number)=>name==='0'?0:data.get(`v(${name})`)?.[i];
  if(!data.has('i(vbat)'))return fail('SPICE缺少电源读数');
  const last=t.length-1,readings:Record<string,ComponentReading>={};
  let speaker:OscillatorResult['speaker'];let wave:number[]|undefined;
  for(const {part,index,pins:[a,b]} of input.parts){
    if(part.kind==='switch'||part.kind==='button')continue;
    const va=voltage(a!,last),vb=voltage(b!,last);if(va===undefined||vb===undefined)return fail('SPICE缺少节点读数');
    const v=va-vb;
    if(part.kind==='npn'||part.kind==='pnp'){
      const currents=['b','c','e'].map(p=>data.get(`i(v${p}${index})`)?.[last]);
      if(currents.some(i=>i===undefined))return fail('SPICE缺少端口电流');
      const ports=['b','c','e'].map(p=>data.get(`i(v${p}${index})`)!);
      if(t.some((_,i)=>Math.abs(ports[0]![i]!+ports[1]![i]!+ports[2]![i]!)>1e-9))return fail('SPICE端口电流未满足守恒容差');
      readings[part.id]={baseCurrentMa:currents[0]!*1000,collectorCurrentMa:currents[1]!*1000,emitterCurrentMa:currents[2]!*1000};
    }else if(part.kind==='resistor'||part.kind==='speaker')readings[part.id]={voltageV:v,currentMa:v/(part.kind==='speaker'?8:resistanceOf(part))*1000};
    else if(part.kind==='capacitor'){const current=data.get(`i(vcap${index})`)?.[last];if(current===undefined)return fail('SPICE缺少电容电流');readings[part.id]={voltageV:v,currentMa:current*1000};}
    if(part.kind==='speaker'){
      wave=t.map((_,i)=>voltage(a!,i)!-voltage(b!,i)!);
      speaker={id:part.id,voltageV:v,acRmsV:0,bypassed:a===b};
    }
  }
  const tail=t.findIndex(x=>x>=.035);
  const settled=[...data].filter(([name])=>name.startsWith('v(')).every(([,values])=>{
    let min=Infinity,max=-Infinity;for(let i=tail;i<values.length;i++){min=Math.min(min,values[i]!);max=Math.max(max,values[i]!);if(i>0&&Math.abs((values[i]!-values[i-1]!)/(t[i]!-t[i-1]!))>.01)return false;}return max-min<=.001;
  });
  let periodic=false;
  if(wave&&speaker&&!speaker.bypassed){
    let min=Infinity,max=-Infinity;for(let i=0;i<t.length;i++)if(t[i]!>=.005){min=Math.min(min,wave[i]!);max=Math.max(max,wave[i]!);}
    const threshold=(min+max)/2,crossings:number[]=[];let armed=false;
    for(let i=1;i<t.length;i++)if(t[i]!>=.005){if(wave[i]!<threshold-(max-min)*.1)armed=true;if(armed&&wave[i-1]!<threshold&&wave[i]!>=threshold){crossings.push(t[i-1]!+(t[i]!-t[i-1]!)*(threshold-wave[i-1]!)/(wave[i]!-wave[i-1]!));armed=false;}}
    const times=crossings.slice(-5),periods=times.slice(1).map((x,i)=>x-times[i]!),period=periods.reduce((s,x)=>s+x,0)/4;
    if(max-min>=.002&&periods.length===4&&periods.every(p=>Math.abs(p/period-1)<=.01)){
      const rms=periods.map((_,cycle)=>{
        let area=0,square=0;const start=times[cycle]!,end=times[cycle+1]!;
        for(let i=1;i<t.length;i++){const lo=Math.max(start,t[i-1]!),hi=Math.min(end,t[i]!);if(hi<=lo)continue;const v0=wave![i-1]!+(wave![i]!-wave![i-1]!)*(lo-t[i-1]!)/(t[i]!-t[i-1]!);const v1=wave![i-1]!+(wave![i]!-wave![i-1]!)*(hi-t[i-1]!)/(t[i]!-t[i-1]!);area+=(hi-lo)*(v0+v1)/2;square+=(hi-lo)*(v0*v0+v1*v1)/2;}
        return Math.sqrt(Math.max(0,square/(end-start)-(area/(end-start))**2));
      });
      speaker.acRmsV=rms.reduce((a,b)=>a+b,0)/4;
      periodic=speaker.acRmsV>=.001&&rms.every(v=>Math.abs(v/speaker!.acRmsV-1)<=.01);if(periodic)speaker.frequencyHz=1/period;
    }
  }
  return {outcome:periodic?'periodic':settled?'settled-DC':'window-no-period',timeS:.04,reason:periodic?'标准SPICE模型在观察窗内检测到周期':'标准SPICE模型已完成40ms；未检测到稳定周期',entities:[],readings,...(speaker?{speaker}:{}),currentMa:-(data.get('i(vbat)')?.[last]??0)*1000};
}
