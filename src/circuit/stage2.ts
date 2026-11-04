import { getComponentPins } from './board';
import { resistanceOf } from './catalog';
import { buildNets } from './network';
import { supplyVoltageOf } from './parameters';
import { solveBounded } from './boundedSolver';
import type { Transistor, BoundedSolution } from './boundedSolver';
import type { Branch } from './solver';
import type { AnalysisResult, CircuitDocument, ComponentReading, Diagnostic, SimulationControls } from './types';

export const isExtended=(d:CircuitDocument)=>d.sourceMode==='teaching-square'||d.components.some(p=>['rgb-led','npn','capacitor','piezo-passive'].includes(p.kind));
export const limitation=(reason:string,entities:string[]=[]):AnalysisResult=>({status:'unsupported',mode:'dc',complete:false,diagnostics:[{code:'unsupported',entities,reason}]});
export const failure=(code:Diagnostic['code'],entities:string[],reason?:string):AnalysisResult=>({status:'fault',complete:false,diagnostics:[{code,entities,...(reason?{reason}:{})}]});
export const cleanCurrent=(amperes:number)=>Math.abs(amperes)<1e-9?0:amperes*1000;
export function analysisBudget(d:CircuitDocument):string|null {
  const count=(kind:string)=>d.components.filter(p=>p.kind===kind).length;
  const p=count('rgb-led')*3+count('led')+count('diode')+count('buzzer'),t=count('npn');
  if(count('rgb-led')>2||p>6||t>2||2**p*3**t>576)return '分析预算：RGB最多2只、P≤6、NPN最多2只、候选≤576；作品已保留';
  if(count('capacitor')>1||count('piezo-passive')>1||count('capacitor')&&count('piezo-passive'))return '首批最多一只电容或一只无源压电，二者不能混接';
  return null;
}
export function compileNetwork(d:CircuitDocument,controls:SimulationControls={}) {
  const nets=buildNets(d,controls),net=(pin:string)=>nets.get(pin)!;
  const positive=net('battery:+'),negative=net('battery:-'),branches:Branch[]=[],transistors:Transistor[]=[],diagnostics:Diagnostic[]=[];
  const add=(part:string,from:string,to:string,resistance:number,drop=0,polar=false,id=part)=>{if(from!==to)branches.push({id,part,from,to,resistance,drop,polar});};
  for(const p of [...d.components].sort((a,b)=>a.id.localeCompare(b.id))){const pins=getComponentPins(p)!,ns=pins.map(net),a=ns[0]!,b=ns[1]!;
    if(p.kind==='resistor'&&a===b)diagnostics.push({code:'resistor-bypassed',entities:[p.id,...pins]});
    if(p.kind==='led'&&a===b)diagnostics.push({code:'led-bypassed',entities:[p.id,...pins]});
    switch(p.kind){
      case 'resistor':case 'ldr':add(p.id,a,b,resistanceOf(p));break;
      case 'led':add(p.id,a,b,0,2,true);break;
      case 'diode':add(p.id,a,b,0,.7,true);break;
      case 'buzzer':add(p.id,a,b,1000,0,true);break;
      case 'piezo-passive':add(p.id,a,b,1e6);break;
      case 'rgb-led': for(const [ch,i,v] of [['R',0,2],['G',2,3],['B',3,3]] as const){if(ns[i]===b)diagnostics.push({code:'led-bypassed',entities:[p.id,pins[i]!,pins[1]],channel:ch});else add(p.id,ns[i]!,b,0,v,true,`${p.id}:${ch}`);}break;
      case 'npn':transistors.push({id:p.id,base:a,collector:b,emitter:ns[2]!});break;
      case 'potentiometer':{const ratio=(p.position??50)/100,r=resistanceOf(p);if(ratio>0)add(p.id,a,b,r*ratio,0,false,`${p.id}:AW`);if(ratio<1)add(p.id,b,ns[2]!,r*(1-ratio),0,false,`${p.id}:WB`);break;}
    }
  }
  return {nets,net,positive,negative,branches,transistors,diagnostics};
}
export type CompiledNetwork=ReturnType<typeof compileNetwork>;
function baseReachable(c:CompiledNetwork,start:string):Set<string>{
  const set=new Set([start]);let change=true;
  while(change){change=false;for(const b of c.branches.filter(b=>!b.polar)){if(set.has(b.from)&&!set.has(b.to)&&b.to!==c.positive&&b.to!==c.negative){set.add(b.to);change=true;}if(set.has(b.to)&&!set.has(b.from)&&b.from!==c.positive&&b.from!==c.negative){set.add(b.from);change=true;}}}
  return set;
}
function unlimitedPath(c:CompiledNetwork,supply:number):Diagnostic|null {
  for(const t of c.transistors)if(t.base===c.positive&&supply>.7)return {code:'missing-resistor',entities:[t.id],pin:'B',reason:'基极直连电源，没有有限基极限流'};
  const paths=[{node:c.positive,drop:0,parts:[] as string[]}],cost=new Map<string,number>();
  while(paths.length){paths.sort((a,b)=>b.drop-a.drop);const path=paths.pop()!;if(path.drop>=(cost.get(path.node)??Infinity))continue;cost.set(path.node,path.drop);
    if(path.node===c.negative&&path.drop<supply-1e-7){const channel=path.parts.map(id=>id.match(/:(R|G|B)$/)?.[1]).find(Boolean) as 'R'|'G'|'B'|undefined;return {code:'missing-resistor',entities:path.parts.map(id=>c.branches.find(b=>b.id===id)?.part??id),...(channel?{channel}:{})};}
    const edges=[...c.branches.filter(b=>b.resistance===0),...c.transistors.map(t=>({id:t.id,part:t.id,from:t.collector,to:t.emitter,resistance:0,drop:.2,polar:true}))];
    for(const b of edges){const to=b.from===path.node?b.to:!b.polar&&b.to===path.node?b.from:null;if(to!==null)paths.push({node:to,drop:path.drop+b.drop,parts:[...path.parts,b.id]});}
  }return null;
}
export function networkReadings(d:CircuitDocument,c:CompiledNetwork,s:BoundedSolution):Record<string,ComponentReading>{
  const readings:Record<string,ComponentReading>={};
  for(const p of d.components){if(['switch','button','capacitor'].includes(p.kind))continue;
    const pins=getComponentPins(p)!,edges=c.branches.filter(b=>b.part===p.id),currentMa=Math.max(0,...edges.map(b=>Math.abs(cleanCurrent(s.currents.get(b.id)??0))));
    const r:ComponentReading={currentMa};
    if(s.determined.has(c.net(pins[0]))&&s.determined.has(c.net(pins[1])))r.voltageV=s.voltages.get(c.net(pins[0]))!-s.voltages.get(c.net(pins[1]))!;
    if(['resistor','ldr','potentiometer'].includes(p.kind))r.resistanceOhms=resistanceOf(p);
    if(p.kind==='led')r.on=currentMa>.001;
    if(p.kind==='buzzer')r.on=currentMa>0&&r.voltageV!==undefined&&r.voltageV>=3-1e-7&&r.voltageV<=5+1e-7;
    if(p.kind==='piezo-passive'){r.on=false;r.driveState='直流：仅稳态，无持续音；忽略接通瞬间';}
    if(p.kind==='rgb-led'){
      const channel=(ch:'R'|'G'|'B')=>{const i=Math.max(0,cleanCurrent(s.currents.get(`${p.id}:${ch}`)??0));return {currentMa:i,on:i>.001,level:Math.min(i/20,1)};};
      r.channels={R:channel('R'),G:channel('G'),B:channel('B')};r.rgb=['R','G','B'].map(ch=>Math.round(255*Math.sqrt(r.channels![ch as 'R'].level))) as [number,number,number];r.on=Object.values(r.channels).some(v=>v.on);
    }
    if(p.kind==='npn'){const t=c.transistors.find(t=>t.id===p.id)!;r.baseCurrentMa=cleanCurrent(s.currents.get(`${p.id}:Ib`)??0);r.collectorCurrentMa=cleanCurrent(s.currents.get(`${p.id}:Ic`)??0);r.emitterCurrentMa=r.baseCurrentMa+r.collectorCurrentMa;r.currentMa=r.collectorCurrentMa;r.vceV=s.voltages.get(t.collector)!-s.voltages.get(t.emitter)!;r.region=s.regions.get(p.id)!;}
    readings[p.id]=r;
  }return readings;
}
export function analyzeExtendedDC(d:CircuitDocument,controls:SimulationControls={}):AnalysisResult {
  const c=compileNetwork(d,controls);
  if(c.positive===c.negative)return failure('source-short',['battery:+','battery:-']);
  const budget=analysisBudget(d);if(budget)return limitation(budget,d.components.map(p=>p.id));
  if(c.diagnostics.length)return {status:'fault',complete:false,diagnostics:c.diagnostics};
  const unlimited=unlimitedPath(c,supplyVoltageOf(d));if(unlimited)return {status:'fault',complete:false,diagnostics:[unlimited]};
  for(const t of c.transistors){
    if(t.emitter!==c.negative)return limitation('NPN仅支持E与电源负端同网的低侧工作',[t.id]);
    const baseNodes=baseReachable(c,t.base);
    if(c.branches.some(b=>b.polar&&(baseNodes.has(b.from)||baseNodes.has(b.to)))||c.transistors.some(other=>baseNodes.has(other.collector)))return limitation('基极只能由电阻、光敏电阻、电位器或触点驱动，首批不支持级联',[t.id]);
  }
  const result=solveBounded(c.branches,c.positive,c.negative,supplyVoltageOf(d),c.transistors);
  if(!result.ok)return limitation(result.reason,d.components.filter(p=>['npn','rgb-led','led'].includes(p.kind)).map(p=>p.id));
  const s=result.solution,readings=networkReadings(d,c,s),diagnostics:Diagnostic[]=[];
  for(const p of d.components){const r=readings[p.id];if(!r)continue;const pins=getComponentPins(p)!;
    if(p.kind==='rgb-led'){for(const [ch,i] of [['R',0],['G',2],['B',3]] as const){if(r.channels![ch].currentMa>20+1e-6)diagnostics.push({code:'overcurrent',entities:[p.id],channel:ch});
      if(s.determined.has(c.net(pins[i]!))&&s.determined.has(c.net(pins[1]))&&s.voltages.get(c.net(pins[i]!))!-s.voltages.get(c.net(pins[1]))!< -1e-5)diagnostics.push({code:'reversed-led',entities:[p.id,pins[i]!,pins[1]],channel:ch});}
    }
    if(p.kind==='led'&&(r.currentMa??0)>20+1e-6)diagnostics.push({code:'overcurrent',entities:[p.id]});
    if(p.kind==='npn'&&((r.baseCurrentMa??0)>5+1e-6||(r.collectorCurrentMa??0)>50+1e-6))diagnostics.push({code:'overcurrent',entities:[p.id],reason:'NPN课程限制：Ib≤5 mA、Ic≤50 mA'});
    if(['led','diode','buzzer'].includes(p.kind)&&r.voltageV!==undefined&&r.voltageV< -1e-5)diagnostics.push({code:p.kind==='buzzer'?'buzzer-reversed':p.kind==='diode'?'reversed-diode':'reversed-led',entities:[p.id,...pins]});
    if(p.kind==='buzzer'&&(r.currentMa??0)>0&&!r.on)diagnostics.push({code:(r.voltageV??0)>5?'buzzer-overvoltage':'buzzer-undervoltage',entities:[p.id]});
  }
  let source=0;for(const b of c.branches){if(b.from===c.positive)source+=s.currents.get(b.id)??0;if(b.to===c.positive)source-=s.currents.get(b.id)??0;}
  const output=Object.entries(readings).some(([id,r])=>r.on&&['led','rgb-led','buzzer'].includes(d.components.find(p=>p.id===id)!.kind));
  return {status:diagnostics.length?'fault':'supported',mode:'dc',complete:output&&!diagnostics.length,currentMa:cleanCurrent(source),readings,diagnostics,ledOn:d.components.some(p=>['led','rgb-led'].includes(p.kind)&&readings[p.id]?.on)};
}
