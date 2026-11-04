import { getComponentPins } from './board';
import { compileNetwork,analysisBudget,limitation,failure } from './stage2';
import type { CircuitDocument,AnalysisResult,SimulationControls } from './types';

export function piezoWave(resistance:number,frequency:number){
  if(!Number.isFinite(resistance)||resistance<0||![250,500,1000].includes(frequency))throw new Error('Invalid piezo drive');
  const r=1000+resistance,rp=1e6,cp=10e-9,k=rp/(r+rp),tau=r*rp/(r+rp)*cp,half=1/(2*frequency),q=Math.exp(-half/tau),high=k*4.5,vmax=high/(1+q),vmin=vmax*q;
  return {vmax,vmin,vpp:vmax-vmin,tau,
    sample:(phaseS:number)=>{const t=((phaseS%(2*half))+2*half)%(2*half),on=t<half;const voltage=on?high+(vmin-high)*Math.exp(-t/tau):vmax*Math.exp(-(t-half)/tau);const sourceA=((on?4.5:0)-voltage)/r,leakA=voltage/rp;return {voltageV:voltage,sourceA,leakA,capacitorA:sourceA-leakA};},
  };
}
export function analyzePiezo(d:CircuitDocument,controls:SimulationControls={}):AnalysisResult{
  const c=compileNetwork(d,controls);
  if(c.positive===c.negative)return failure('source-short',['battery:+','battery:-']);
  const budget=analysisBudget(d);if(budget)return limitation(budget,d.components.map(p=>p.id));
  const p=d.components.find(p=>p.kind==='piezo-passive');
  if(!p||d.components.some(p=>!['piezo-passive','resistor','switch','button'].includes(p.kind)))return limitation('教学方波仅支持一只无源压电与电阻、开关、按钮的唯一串联路径',d.components.map(p=>p.id));
  const [a,b]=getComponentPins(p)!.map(c.net);
  if(a===b)return {status:'fault',mode:'periodic',complete:false,diagnostics:[{code:'led-bypassed',entities:[p.id],reason:'压电两端被旁路，无有效驱动'}]};
  const paths:string[][]=[];
  const walk=(node:string,visited:Set<string>,edges:string[])=>{if(paths.length>1)return;if(node===c.negative){paths.push(edges);return;}for(const edge of c.branches){const next=edge.from===node?edge.to:edge.to===node?edge.from:null;if(next!==null&&!visited.has(next))walk(next,new Set([...visited,next]),[...edges,edge.id]);}};
  walk(c.positive,new Set([c.positive]),[]);
  const off=(driveState:string):AnalysisResult=>({status:'supported',mode:'periodic',complete:false,diagnostics:[{code:'control-open',entities:[p.id],reason:driveState}],readings:{[p.id]:{on:false,driveState}}});
  if(!paths.length)return off('无驱动：路径断开，未提供频率读数');
  if(paths.length!==1||!paths[0]!.includes(p.id))return limitation('压电仅支持包含它的唯一串联驱动路径，不支持并联负载',[p.id]);
  // A branch connected to the path may be an open stub; a second closed route was rejected above.
  const series=c.branches.filter(e=>paths[0]!.includes(e.id)&&e.part!==p.id).reduce((sum,e)=>sum+e.resistance,0),frequency=d.signalFrequencyHz??500,wave=piezoWave(series,frequency),on=wave.vpp>=1;
  return {status:'supported',mode:'periodic',complete:on,diagnostics:on?[]:[{code:'insufficient-voltage',entities:[p.id],reason:'压电驱动幅度不足1 V'}],readings:{[p.id]:{on,frequencyHz:frequency,vppV:wave.vpp,driveState:on?`受驱动，${frequency} Hz`:'驱动幅度不足'}}};
}
