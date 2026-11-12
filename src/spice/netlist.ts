import { getComponentPins } from '../circuit';
import type { CircuitDocument, SimulationControls } from '../circuit';
import { compileOscillator } from '../circuit/oscillator/compile';
import { resistanceOf } from '../circuit/catalog';
import { SPICE_CARDS } from './cards';
import { hasSpiceModelSelections } from '../circuit/transistorModels';

/** Explicit net identities only; never interpolate user identifiers into SPICE commands. */
export function spiceNetlist(document:CircuitDocument,controls:SimulationControls={}) {
  const compiled=compileOscillator(document,controls);
  if(!compiled.ok)return compiled;
  if(!hasSpiceModelSelections(document.components))
    return {ok:false as const,result:{outcome:'unsupported-topology' as const,timeS:0,reason:'标准SPICE模式请明确选择NPN的2N3904和PNP的2N3906；通用模型请使用原模式。',entities:[]}};
  const roots=compiled.compiled.endpointNodes;
  const names=new Map<string,string>([[roots['battery:-']!,'0'],[roots['battery:+']!,'vp']]);
  let count=0;
  const node=(endpoint:string)=>{const root=roots[endpoint]!;if(!names.has(root))names.set(root,`n${++count}`);return names.get(root)!;};
  const parts=document.components.map((part,i)=>({part,index:i,pins:getComponentPins(part)!.map(node)}));
  const lines=['AI Circuit Tutor fixed SPICE GP v1','Vbat vp 0 PWL(0 0 100u '+document.supplyVoltage+')'];
  for(const {part,index:i,pins:[a,b,e]} of parts){
    if(part.kind==='resistor'||part.kind==='speaker')lines.push(`r${i} ${a} ${b} ${part.kind==='speaker'?8:resistanceOf(part)}`);
    if(part.kind==='capacitor')lines.push(`vcap${i} ${a} cap${i} 0`,`c${i} cap${i} ${b} ${part.capacitanceF} IC=0`);
    if(part.kind==='npn'||part.kind==='pnp'){
      lines.push(`vb${i} ${a} qb${i} 0`,`vc${i} ${b} qc${i} 0`,`ve${i} ${e} qe${i} 0`,`q${i} qc${i} qb${i} qe${i} ${part.kind==='npn'?'Q2N3904':'Q2N3906'}`);
    }
  }
  lines.push(SPICE_CARDS,'.temp 27','.options reltol=1e-4 vntol=10u abstol=1n','.save all','.tran .25u 40m 0 .25u uic','.end');
  return {ok:true as const,netlist:lines.join('\n'),parts,names};
}
