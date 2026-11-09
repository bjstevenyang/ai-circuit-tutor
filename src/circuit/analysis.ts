import { getComponentPins } from './board';
import { resistanceOf } from './catalog';
import { buildNets } from './network';
import { solveDC } from './solver';
import type { Branch } from './solver';
import { readCircuitDocument } from './validation';
import { capacitanceRange, profileOf, supplyVoltageOf, LED_CURRENT_LIMIT_MA } from './parameters';
import type { AnalysisResult, CircuitDocument, ComponentReading, Diagnostic, DiagnosticCode, SimulationControls } from './types';
import { analyzeExtendedDC, isExtended } from './stage2';
import { analyzeRC } from './transient';
import { analyzePiezo } from './piezo';

function pathDrop(branches: readonly Branch[], from: string, to: string, oriented: boolean, zeroResistanceOnly=false): {drop:number;parts:string[]} {
  const costs=new Map<string,number>([[from,0]]), paths=new Map<string,string[]>([[from,[]]]), visited=new Set<string>();
  while(true) {
    const node=[...costs.keys()].filter(n=>!visited.has(n)).sort((a,b)=>costs.get(a)!-costs.get(b)!||a.localeCompare(b))[0];
    if(node===undefined)return {drop:Infinity,parts:[]};
    if(node===to)return {drop:costs.get(node)!,parts:paths.get(node)!};
    visited.add(node);
    for(const branch of branches) {
      if(zeroResistanceOnly&&branch.resistance>0)continue;
      const next=branch.from===node?branch.to:branch.to===node&&(!oriented||!branch.polar)?branch.from:null;
      if(next===null)continue;
      const cost=costs.get(node)!+(oriented?branch.drop:0);
      if(cost<(costs.get(next)??Infinity)) {costs.set(next,cost);paths.set(next,[...paths.get(node)!,branch.part]);}
    }
  }
}
const clean=(value:number)=>Math.abs(value)<1e-6?0:value;
export function analyzeCircuit(input: CircuitDocument, controls: SimulationControls = {}): AnalysisResult {
  const unsupported=(): AnalysisResult=>({status:'unsupported',complete:false,diagnostics:[{code:'unsupported',entities:[]}]});
  const document=readCircuitDocument(input);
  if(!document)return unsupported();
  if(profileOf(document)==='oscillator-em-v1')return {status:'unsupported',complete:false,diagnostics:[{code:'unsupported',entities:[],reason:'此模型需要自激发声瞬态会话，直流分析入口不提供结果。'}]};
  if(document.components.some(p=>['pnp','speaker'].includes(p.kind)))return {status:'unsupported',complete:false,diagnostics:[{code:'unsupported',entities:document.components.filter(p=>['pnp','speaker'].includes(p.kind)).map(p=>p.id),reason:'PNP和无源扬声器需要显式选择自激发声虚拟模型。'}]};
  const [minimumC,maximumC]=capacitanceRange(document);
  if(document.components.some(p=>p.kind==='capacitor'&&(p.capacitanceF!<minimumC||p.capacitanceF!>maximumC)))return {status:'unsupported',complete:false,diagnostics:[{code:'unsupported',entities:document.components.filter(p=>p.kind==='capacitor').map(p=>p.id),reason:'原实验模型的电容范围为10–1000 μF；作品参数已保留。'}]};
  if(document.components.some(p=>p.kind==='capacitor'))return analyzeRC(document,controls);
  if(document.sourceMode==='teaching-square')return analyzePiezo(document,controls);
  if(isExtended(document))return analyzeExtendedDC(document,controls);
  const supplyVoltage=supplyVoltageOf(document);
  const nets=buildNets(document,controls), net=(pin:string)=>nets.get(pin)!;
  const positive=net('battery:+'),negative=net('battery:-');
  const faults: Diagnostic[]=[];
  const add=(code:DiagnosticCode,entities:string[])=>{if(!faults.some(d=>d.code===code&&d.entities.join()===entities.join()))faults.push({code,entities});};
  if(positive===negative)add('source-short',['battery:+','battery:-']);
  const branches: Branch[]=[],openControls: Branch[]=[];
  const branch=(part:string,from:string,to:string,resistance:number,drop=0,polar=false,id=part)=>{if(from!==to)branches.push({id,part,from,to,resistance,drop,polar});};
  for(const part of [...document.components].sort((a,b)=>a.id.localeCompare(b.id))) {
    const pins=getComponentPins(part)!;
    const a=net(pins[0]),b=net(pins[1]);
    if(part.kind==='resistor'&&a===b)add('resistor-bypassed',[part.id,...pins]);
    if(part.kind==='led'&&a===b)add('led-bypassed',[part.id,...pins]);
    switch(part.kind) {
      case 'resistor': case 'ldr': branch(part.id,a,b,resistanceOf(part));break;
      case 'led': branch(part.id,a,b,0,2,true);break;
      case 'diode': branch(part.id,a,b,0,0.7,true);break;
      case 'buzzer': branch(part.id,a,b,1000,0,true);break;
      case 'potentiometer': {
        const c=net(pins[2]!),r=resistanceOf(part),position=(part.position??50)/100;
        if(position>0)branch(part.id,a,b,r*position,0,false,`${part.id}:A-W`);
        if(position<1)branch(part.id,b,c,r*(1-position),0,false,`${part.id}:W-B`);
        break;
      }
      case 'switch': if(!part.closed)openControls.push({id:part.id,part:part.id,from:a,to:b,resistance:0,drop:0,polar:false});break;
      case 'button': if(!controls.pressedButtons?.includes(part.id))openControls.push({id:part.id,part:part.id,from:a,to:net(pins[2]!),resistance:0,drop:0,polar:false});break;
    }
  }
  // Zero-resistance, forward-polarity paths cannot be given a finite load current.
  const unbounded=pathDrop(branches,positive,negative,true,true);
  if(positive!==negative&&unbounded.drop<supplyVoltage-1e-7)add('missing-resistor',unbounded.parts);
  const priorities: Partial<Record<DiagnosticCode,number>>={'source-short':0,'resistor-bypassed':1,'missing-resistor':2,'led-bypassed':3,'overcurrent':4};
  const sortFaults=()=>faults.sort((a,b)=>(priorities[a.code]??9)-(priorities[b.code]??9)||a.code.localeCompare(b.code)||a.entities.join().localeCompare(b.entities.join()));
  sortFaults();
  if(faults.length)return {status:'fault',complete:false,diagnostics:faults,...(faults.every(d=>d.code==='led-bypassed')?{ledOn:false}:{})};
  const solution=solveDC(branches,positive,negative,supplyVoltage);
  if(!solution)return unsupported();
  // GMIN chooses arbitrary potentials for floating, blocked terminals. Only
  // voltages anchored through resistors or genuinely conducting devices can
  // justify a polarity diagnosis.
  const determined=new Set([positive,negative]);
  const conducting=branches.filter(b=>!b.polar||Math.abs(solution.currents.get(b.id)??0)>1e-9);
  let changed=true;
  while(changed) {
    changed=false;
    for(const b of conducting) {
      if(determined.has(b.from)&&!determined.has(b.to)){determined.add(b.to);changed=true;}
      if(determined.has(b.to)&&!determined.has(b.from)){determined.add(b.from);changed=true;}
    }
  }
  const readings: Record<string,ComponentReading>={};
  let sourceCurrent=0;
  for(const edge of branches) {
    const current=solution.currents.get(edge.id)??0;
    if(edge.from===positive)sourceCurrent+=current;
    if(edge.to===positive)sourceCurrent-=current;
  }
  let anyLed=false,hasLed=false,anyOutput=false;
  for(const part of document.components) {
    // Ideal contacts are collapsed into nets; their individual current is not
    // uniquely recoverable. Do not display a fabricated zero-current reading.
    if(part.kind==='switch'||part.kind==='button')continue;
    const pins=getComponentPins(part)!;
    const voltage=(solution.voltages.get(net(pins[0]))??0)-(solution.voltages.get(net(pins[1]))??0);
    const knownVoltage=determined.has(net(pins[0]))&&determined.has(net(pins[1]));
    const edges=branches.filter(b=>b.part===part.id);
    const currentMa=clean(edges.reduce((max,b)=>Math.max(max,Math.abs(solution.currents.get(b.id)??0)*1000),0));
    const reading: ComponentReading={currentMa};
    if(currentMa>0)reading.voltageV=voltage;
    if(['resistor','potentiometer','ldr'].includes(part.kind))reading.resistanceOhms=resistanceOf(part);
    if(part.kind==='led') {
      hasLed=true;reading.on=currentMa>0.001;anyLed ||= reading.on;anyOutput ||= reading.on;
      if(currentMa>LED_CURRENT_LIMIT_MA+1e-6)add('overcurrent',[part.id]);
      if(!reading.on&&knownVoltage&&voltage < -1e-5)add('reversed-led',[part.id,...pins]);
    }
    if(part.kind==='diode'&&knownVoltage&&voltage < -1e-5)add('reversed-diode',[part.id,...pins]);
    if(part.kind==='buzzer') {
      reading.on=voltage>=3-1e-7&&voltage<=5+1e-7&&currentMa>0;
      anyOutput ||= reading.on;
      if(knownVoltage&&voltage < -1e-5)add('buzzer-reversed',[part.id,...pins]);
      else if(currentMa>0&&voltage>5+1e-7)add('buzzer-overvoltage',[part.id]);
      else if(currentMa>0&&!reading.on)add('buzzer-undervoltage',[part.id]);
    }
    readings[part.id]=reading;
  }
  const currentMa=clean(Math.max(0,sourceCurrent*1000));
  if(currentMa===0&&faults.length===0) {
    const route=pathDrop(branches,positive,negative,true);
    const withControls=pathDrop([...branches,...openControls],positive,negative,false);
    const relevantControls=openControls.filter(b=>withControls.parts.includes(b.part));
    if(route.drop>=supplyVoltage&&Number.isFinite(route.drop))add('insufficient-voltage',route.parts);
    else if(withControls.drop===0&&relevantControls.length>0)add('control-open',relevantControls.map(b=>b.part));
    else if(pathDrop(branches,positive,negative,false).drop===0)return unsupported();
    else add('open-circuit',document.components.map(p=>p.id));
  }
  sortFaults();
  const normalOff=faults.every(d=>d.code==='control-open'||d.code==='reversed-led'||d.code==='reversed-diode'||d.code==='buzzer-reversed');
  return {status:faults.length&&!normalOff?'fault':'supported',...(faults.some(d=>d.code==='open-circuit')?{}:{currentMa}),complete:anyOutput&&faults.length===0,diagnostics:faults,readings,...(hasLed?{ledOn:anyLed}:{})};
}
