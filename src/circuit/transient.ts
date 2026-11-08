import { getComponentPins } from './board';
import { solveBounded } from './boundedSolver';
import { compileNetwork, analysisBudget, limitation, failure, networkReadings, cleanCurrent } from './stage2';
import { supplyVoltageOf } from './parameters';
import type { AnalysisResult,CircuitDocument,SimulationControls } from './types';

export function rcStep(initial:number,final:number,resistance:number,capacitance:number,dt:number):{voltageV:number;currentA:number}{
  if(!Number.isFinite(initial)||!Number.isFinite(final)||!Number.isFinite(capacitance)||capacitance<=0||!Number.isFinite(dt)||dt<0||!(resistance>0))throw new Error('Invalid RC interval');
  if(resistance===Infinity)return {voltageV:initial,currentA:0};
  const voltageV=final+(initial-final)*Math.exp(-dt/(resistance*capacitance));return {voltageV,currentA:(final-voltageV)/resistance};
}

/** Rebuild the linear Thevenin equivalent at each explicit control event. */
export function analyzeRC(d:CircuitDocument,controls:SimulationControls={}):AnalysisResult {
  const c=compileNetwork(d,controls),cap=d.components.find(p=>p.kind==='capacitor')!;
  if(c.positive===c.negative)return failure('source-short',['battery:+','battery:-']);
  const budget=analysisBudget(d);if(budget)return limitation(budget,d.components.map(p=>p.id));
  if(d.sourceMode==='teaching-square'||d.components.some(p=>!['capacitor','resistor','potentiometer','ldr','switch','button'].includes(p.kind)))return limitation('单电容RC仅支持直流电源、线性电阻、电位器、光敏电阻及触点；不能与半导体或压电混接',d.components.map(p=>p.id));
  if(c.diagnostics.length)return {status:'fault',complete:false,diagnostics:c.diagnostics};
  const pins=getComponentPins(cap)!,a=c.net(pins[0]),b=c.net(pins[1]);
  if(a!==c.negative&&b!==c.negative)return limitation('首批RC需要任一电容脚与电源负端同网；两端浮置不支持',[cap.id]);
  const node=a===c.negative?b:a,reference=a===c.negative?'1':'2';
  if(node===c.negative||node===c.positive)return limitation('电容需要有限电阻路径，不能直连理想源或同网短接',[cap.id]);
  const dt=controls.deltaTimeS??0,prior=controls.timeState??{timeS:0,voltageV:0};
  if(!Number.isFinite(dt)||dt<0||!Number.isFinite(prior.timeS)||prior.timeS<0||prior.timeS+dt>60+1e-8||!Number.isFinite(prior.voltageV))return limitation('无效或超过60 s的模拟时间；失败不推进状态',[cap.id]);
  // Zero the ideal source, then impose a unit test voltage at the capacitor port.
  const zeroed=c.branches.map(edge=>({...edge,from:edge.from===c.positive?c.negative:edge.from,to:edge.to===c.positive?c.negative:edge.to})).filter(edge=>edge.from!==edge.to);
  const test=solveBounded(zeroed,node,c.negative,1);if(!test.ok)return limitation(test.reason,[cap.id]);
  let testCurrent=0;for(const edge of zeroed){if(edge.from===node)testCurrent+=test.solution.currents.get(edge.id)??0;if(edge.to===node)testCurrent-=test.solution.currents.get(edge.id)??0;}
  const resistance=Math.abs(testCurrent)<1e-14?Infinity:1/testCurrent;
  if(!(resistance>0))return limitation('无法建立有限且唯一的Thevenin等效',[cap.id]);
  let final=prior.voltageV;
  if(resistance!==Infinity){const open=solveBounded(c.branches,c.positive,c.negative,supplyVoltageOf(d));if(!open.ok||!open.solution.determined.has(node))return limitation('RC端口缺少唯一电压参考',[cap.id]);final=open.solution.voltages.get(node)!;}
  const next=rcStep(prior.voltageV,final,resistance,cap.capacitanceF!,dt);
  const actual=solveBounded(c.branches,c.positive,c.negative,supplyVoltageOf(d),[],new Map([[node,next.voltageV]]));
  if(!actual.ok)return limitation(actual.reason,[cap.id]);
  const readings=networkReadings(d,c,actual.solution),slope=next.currentA/cap.capacitanceF!;
  readings[cap.id]={voltageV:next.voltageV,currentMa:cleanCurrent(next.currentA),referencePin:reference,capacitorState:resistance===Infinity?'保持':slope>.0001?'充电':slope<-.0001?'放电':'稳态'};
  let source=0;for(const edge of c.branches){if(edge.from===c.positive)source+=actual.solution.currents.get(edge.id)??0;if(edge.to===c.positive)source-=actual.solution.currents.get(edge.id)??0;}
  return {status:'supported',mode:'rc',timeS:prior.timeS+dt,complete:false,currentMa:cleanCurrent(source),diagnostics:[],readings};
}
