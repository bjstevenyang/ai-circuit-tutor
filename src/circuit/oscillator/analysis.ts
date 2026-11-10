import { advanceNumeric, initializeNumeric } from './integration';
import type { AcceptedPoint } from './integration';
import { DEFAULT_PRECISION, EM, emCurrents, nodeVoltage, POSITIVE, RAMP_S, sourceAt } from './numeric';
import type { AnalysisOptions, CompiledOscillator, OscillatorAdvanceResult, OscillatorAnalysisState, OscillatorResult, PeriodIntegral, TransistorPortReading } from './types';
import type { ComponentReading } from '../types';
export { compileOscillator } from './compile';

export const WINDOW_S=.04, MAX_DISPLAY_SAMPLES=4096;
const SOURCED_MODEL_MIN_STEP_S=1e-13;
const zeroPoint=(compiled:CompiledOscillator):AcceptedPoint=>({timeS:0,voltage:new Float64Array(compiled.model.size),derivative:new Float64Array(compiled.model.size),residualA:0});
export function createOscillatorAnalysis(compiled:CompiledOscillator,options:AnalysisOptions={}):OscillatorAnalysisState {
  const sourcedModel=compiled.document.components.some(part=>part.transistorModel==='2n3904'||part.transistorModel==='2n3906');
  // Only the selected pF model cards need the approved finer floor; tolerances stay unchanged.
  // Explicit precision remains authoritative for strict and failure-injection tests.
  const precision=options.precision??(sourcedModel?{...DEFAULT_PRECISION,hMinS:SOURCED_MODEL_MIN_STEP_S}:DEFAULT_PRECISION);
  return {numeric:initializeNumeric(compiled.model,precision),precision,limits:options.limits??{},pass:1,
    previous:zeroPoint(compiled),previousFullVoltage:new Float64Array(compiled.nodeIds.length),previousSourceCurrentA:0,samples:[{timeS:0,voltageV:compiled.nodeIds.map(()=>0)}],nextSampleS:WINDOW_S/(MAX_DISPLAY_SAMPLES-1),
    speakerMin:Infinity,speakerMax:-Infinity,tailMin:new Float64Array(compiled.nodeIds.length).fill(Infinity),tailMax:new Float64Array(compiled.nodeIds.length).fill(-Infinity),tailDerivative:0,
    sourcePeakA:0,maxConductionA:0,maxDisplacementA:0,threshold:0,hysteresis:0,armed:false,cycles:[]};
}

/** Recover every resistor-eliminated node exactly from the current dynamic state. */
export function fullVoltages(compiled:CompiledOscillator,point:AcceptedPoint):Float64Array {
  const source=sourceAt(compiled.model,point.timeS);
  const values=new Float64Array(compiled.reconstruction.length);
  for(let j=0;j<values.length;j++){const map=compiled.reconstruction[j]!;let value=map.sourceWeight*source;for(let i=0;i<point.voltage.length;i++)value+=map.weights[i]!*point.voltage[i]!;values[j]=value;}
  return values;
}
function fullDerivatives(compiled:CompiledOscillator,point:AcceptedPoint):Float64Array {
  const sourceSlope=point.timeS<=RAMP_S?compiled.model.supplyV/RAMP_S:0;
  const values=new Float64Array(compiled.reconstruction.length);
  for(let j=0;j<values.length;j++){const map=compiled.reconstruction[j]!;let value=map.sourceWeight*sourceSlope;for(let i=0;i<point.derivative.length;i++)value+=map.weights[i]!*point.derivative[i]!;values[j]=value;}
  return values;
}
function speakerVoltage(compiled:CompiledOscillator,point:AcceptedPoint):number {
  const speaker=compiled.speaker;if(!speaker)return 0;
  const voltage=fullVoltages(compiled,point),source=sourceAt(compiled.model,point.timeS);
  return nodeVoltage(voltage,speaker.a,source)-nodeVoltage(voltage,speaker.b,source);
}
function portValues(compiled:CompiledOscillator,point:AcceptedPoint,includePorts=true) {
  const source=sourceAt(compiled.model,point.timeS),sourceSlope=point.timeS<=RAMP_S?compiled.model.supplyV/RAMP_S:0;
  const voltage=fullVoltages(compiled,point),derivative=fullDerivatives(compiled,point);
  const at=(index:number)=>nodeVoltage(voltage,index,source),dv=(index:number)=>nodeVoltage(derivative,index,sourceSlope);
  let sourceCurrentA=0,maxConductionA=0,maxDisplacementA=0;
  const ports:Record<string,TransistorPortReading>={};
  for(const branch of compiled.branches) {
    const current=branch.kind==='capacitor'?branch.value*(dv(branch.a)-dv(branch.b)):(at(branch.a)-at(branch.b))/branch.value;
    if(branch.a===POSITIVE)sourceCurrentA+=current;if(branch.b===POSITIVE)sourceCurrentA-=current;
    if(branch.kind==='capacitor')maxDisplacementA=Math.max(maxDisplacementA,Math.abs(current));
  }
  for(let index=0;index<compiled.model.transistors.length;index++) {
    const t=compiled.model.transistors[index]!,q=point.junctions?.[index]??emCurrents(t,point.voltage,source);
    const dd=(index:number)=>nodeVoltage(point.derivative,index,sourceSlope);
    const be=(t.cbeF??EM.cbeF)*(dd(t.b)-dd(t.e)),bc=(t.cbcF??EM.cbcF)*(dd(t.b)-dd(t.c));
    const ib=q.ib+be+bc,ic=q.ic-bc,ie=q.ie-be;
    if(includePorts)ports[t.id]={conductionA:{b:q.ib,c:q.ic,e:q.ie},displacementA:{b:be+bc,c:-bc,e:-be},totalA:{b:ib,c:ic,e:ie}};
    if(t.b===POSITIVE)sourceCurrentA+=ib;if(t.c===POSITIVE)sourceCurrentA+=ic;if(t.e===POSITIVE)sourceCurrentA+=ie;
    maxConductionA=Math.max(maxConductionA,Math.abs(q.ib),Math.abs(q.ic),Math.abs(q.ie));
    maxDisplacementA=Math.max(maxDisplacementA,Math.abs(be+bc),Math.abs(bc),Math.abs(be));
  }
  return {voltage,derivative,sourceCurrentA,maxConductionA,maxDisplacementA,ports};
}
const interpolate=(a:number,b:number,fraction:number)=>a+(b-a)*fraction;
function integral(cycle:PeriodIntegral,t0:number,t1:number,v0:number,v1:number,s0:number,s1:number) {
  const dt=t1-t0;cycle.endS=t1;cycle.area+=dt*(v0+v1)/2;cycle.square+=dt*(v0*v0+v1*v1)/2;cycle.sourceArea+=dt*(s0+s1)/2;
}
function consumePoint(compiled:CompiledOscillator,state:OscillatorAnalysisState,point:AcceptedPoint) {
  const previous=state.previous,now=portValues(compiled,point,false);
  const beforeVoltage=state.previousFullVoltage,beforeSource=state.previousSourceCurrentA;
  const sp=compiled.speaker,source=sourceAt(compiled.model,point.timeS),lastSource=sourceAt(compiled.model,previous.timeS);
  const value=sp?nodeVoltage(now.voltage,sp.a,source)-nodeVoltage(now.voltage,sp.b,source):0;
  const last=sp?nodeVoltage(beforeVoltage,sp.a,lastSource)-nodeVoltage(beforeVoltage,sp.b,lastSource):0;
  if(state.pass===1) {
    state.sourcePeakA=Math.max(state.sourcePeakA,now.sourceCurrentA);
    state.maxConductionA=Math.max(state.maxConductionA,now.maxConductionA);state.maxDisplacementA=Math.max(state.maxDisplacementA,now.maxDisplacementA);
    if(point.timeS>=.005) {
      const boundary=previous.timeS<.005?interpolate(last,value,(.005-previous.timeS)/(point.timeS-previous.timeS)):value;
      state.speakerMin=Math.min(state.speakerMin,value,boundary);state.speakerMax=Math.max(state.speakerMax,value,boundary);
    }
    if(point.timeS>=.035) {
      for(let i=0;i<now.voltage.length;i++){const boundary=previous.timeS<.035?interpolate(beforeVoltage[i]!,now.voltage[i]!, (.035-previous.timeS)/(point.timeS-previous.timeS)):now.voltage[i]!;state.tailMin[i]=Math.min(state.tailMin[i]!,now.voltage[i]!,boundary);state.tailMax[i]=Math.max(state.tailMax[i]!,now.voltage[i]!,boundary);}
      for(const [a,b] of compiled.pairs)state.tailDerivative=Math.max(state.tailDerivative,Math.abs(nodeVoltage(point.derivative,a,0)-nodeVoltage(point.derivative,b,0)));
    }
    while(state.nextSampleS<=point.timeS&&state.samples.length<MAX_DISPLAY_SAMPLES) {
      const f=(state.nextSampleS-previous.timeS)/(point.timeS-previous.timeS);
      state.samples.push({timeS:state.nextSampleS,voltageV:Array.from(now.voltage,(v,i)=>interpolate(beforeVoltage[i]!,v,f))});
      state.nextSampleS=state.samples.length===MAX_DISPLAY_SAMPLES-1?WINDOW_S:state.samples.length*WINDOW_S/(MAX_DISPLAY_SAMPLES-1);
    }
  } else if(point.timeS>=.005) {
    if(value<state.threshold-state.hysteresis)state.armed=true;
    const crossed=state.armed&&last<state.threshold&&value>=state.threshold;
    if(crossed) {
      const f=(state.threshold-last)/(value-last),cross=interpolate(previous.timeS,point.timeS,f),crossSource=interpolate(beforeSource,now.sourceCurrentA,f);
      if(state.currentCycle){integral(state.currentCycle,previous.timeS,cross,last,state.threshold,beforeSource,crossSource);state.cycles.push(state.currentCycle);if(state.cycles.length>4)state.cycles.shift();}
      state.currentCycle={startS:cross,endS:cross,area:0,square:0,sourceArea:0};
      integral(state.currentCycle,cross,point.timeS,state.threshold,value,crossSource,now.sourceCurrentA);state.armed=false;
    } else if(state.currentCycle)integral(state.currentCycle,previous.timeS,point.timeS,last,value,beforeSource,now.sourceCurrentA);
  }
  state.previous=point;state.previousFullVoltage=now.voltage;state.previousSourceCurrentA=now.sourceCurrentA;
}
function successfulResult(compiled:CompiledOscillator,state:OscillatorAnalysisState):OscillatorResult {
  const point=state.previous,evidence=portValues(compiled,point),source=sourceAt(compiled.model,point.timeS);
  const readings:Record<string,ComponentReading>={};
  for(const branch of compiled.branches) {
    const voltageV=nodeVoltage(evidence.voltage,branch.a,source)-nodeVoltage(evidence.voltage,branch.b,source);
    const currentA=branch.kind==='capacitor'?branch.value*(nodeVoltage(evidence.derivative,branch.a,0)-nodeVoltage(evidence.derivative,branch.b,0)):voltageV/branch.value;
    readings[branch.id]={voltageV,currentMa:currentA*1000,...(branch.kind==='resistor'?{resistanceOhms:branch.value}:{}),...(branch.kind==='capacitor'?{driveState:'有限观察窗末端'}:{})};
  }
  for(const [id,ports] of Object.entries(evidence.ports))readings[id]={baseCurrentMa:ports.totalA.b*1000,collectorCurrentMa:ports.totalA.c*1000,emitterCurrentMa:ports.totalA.e*1000,driveState:'EM传导及结电容位移电流'};
  const lengths=state.cycles.map(c=>c.endS-c.startS),rms=state.cycles.map(c=>Math.sqrt(Math.max(0,c.square/(c.endS-c.startS)-(c.area/(c.endS-c.startS))**2)));
  const period=lengths.reduce((a,b)=>a+b,0)/lengths.length,acRmsV=rms.reduce((a,b)=>a+b,0)/rms.length;
  const periodic=state.pass===2&&lengths.length===4&&acRmsV>=.001&&lengths.every(t=>Math.abs(t/period-1)<=.01)&&rms.every(r=>Math.abs(r/acRmsV-1)<=.01);
  const settled=state.tailDerivative<=.01&&state.numeric.maxResidualA<=1e-9&&state.tailMin.every((value,i)=>state.tailMax[i]!-value<=.001);
  const outcome=periodic?'periodic':settled?'settled-DC':'window-no-period';
  const speaker=compiled.speaker,bypassed=!!speaker&&speaker.a===speaker.b;
  const reason=bypassed?'扬声器被旁路；无连续声音不代表其他节点没有变化':periodic?'0–40 ms观察到稳定周期；声音按已计算周期示意':settled?'末5 ms符合直流判据；无连续音仍可能有直流电流':'0–40 ms窗口内未见稳定周期；不表示永不起振或接线一定错误';
  if(speaker)readings[speaker.id]={...readings[speaker.id],on:periodic,driveState:bypassed?'扬声器被旁路':reason,...(periodic?{frequencyHz:1/period}:{})};
  const first=state.firstPassCounts??{accepted:state.numeric.accepted,rejected:state.numeric.rejected};
  return {outcome,timeS:WINDOW_S,reason,entities:compiled.document.components.filter(p=>p.kind==='capacitor'||p.kind==='speaker'||p.kind==='npn'||p.kind==='pnp').map(p=>p.id),currentMa:evidence.sourceCurrentA*1000,readings,
    nodeVoltages:Object.fromEntries(compiled.nodeIds.map((id,i)=>[id,evidence.voltage[i]!])),transistorPorts:evidence.ports,
    ...(speaker?{speaker:{id:speaker.id,voltageV:readings[speaker.id]!.voltageV!,acRmsV:periodic?acRmsV:0,bypassed,...(periodic?{frequencyHz:1/period}:{})}}:{}),samples:state.samples,
    stats:{accepted:state.numeric.accepted,rejected:state.numeric.rejected,passes:state.pass,unknowns:compiled.unknowns,reducedUnknowns:compiled.model.size,
      perPass:[first,...(state.pass===2?[{accepted:state.numeric.accepted-first.accepted,rejected:state.numeric.rejected-first.rejected}]:[])],
      minStepS:Math.min(state.numeric.minStepS,state.firstPassStats?.minStepS??Infinity),maxResidualA:Math.max(state.numeric.maxResidualA,state.firstPassStats?.maxResidualA??0),maxNewton:Math.max(state.numeric.maxNewton,state.firstPassStats?.maxNewton??0),
      sourcePeakA:state.sourcePeakA,...(periodic?{sourceMeanA:state.cycles.reduce((a,c)=>a+c.sourceArea,0)/lengths.reduce((a,b)=>a+b,0)}:{}),maxConductionA:state.maxConductionA,maxDisplacementA:state.maxDisplacementA}};
}
/** One bounded pure batch; the caller supervises wall clock and cancellation. */
export function advanceOscillatorAnalysis(compiled:CompiledOscillator,input:OscillatorAnalysisState):OscillatorAdvanceResult {
  if(input.result)return {done:true,state:input,result:input.result};
  // Copy only writable, bounded accumulators. Accepted voltage/sample objects are immutable.
  const state:OscillatorAnalysisState={...input,samples:input.samples.slice(),tailMin:input.tailMin.slice(),tailMax:input.tailMax.slice(),cycles:input.cycles.map(c=>({...c})),...(input.currentCycle?{currentCycle:{...input.currentCycle}}:{})};
  const result=advanceNumeric(compiled.model,state.numeric,WINDOW_S,compiled.pairs,state.precision,state.limits);
  state.numeric=result.state;
  if(!result.ok){state.result={outcome:result.failure.outcome,timeS:result.failure.timeS,reason:result.failure.reason,entities:compiled.document.components.map(p=>p.id)};return {done:true,state,result:state.result};}
  for(const point of result.points)consumePoint(compiled,state,point);
  if(state.numeric.timeS>=WINDOW_S) {
    if(state.pass===1&&compiled.speaker&&compiled.speaker.a!==compiled.speaker.b&&state.speakerMax-state.speakerMin>=.002) {
      state.firstPassFinal=state.numeric.voltage.slice();state.firstPassCounts={accepted:state.numeric.accepted,rejected:state.numeric.rejected};
      state.firstPassStats={minStepS:state.numeric.minStepS,maxResidualA:state.numeric.maxResidualA,maxNewton:state.numeric.maxNewton};
      state.threshold=(state.speakerMin+state.speakerMax)/2;state.hysteresis=(state.speakerMax-state.speakerMin)*.1;
      const fresh=initializeNumeric(compiled.model,state.precision);fresh.accepted=state.numeric.accepted;fresh.rejected=state.numeric.rejected;
      state.numeric=fresh;state.previous=zeroPoint(compiled);state.previousFullVoltage=new Float64Array(compiled.nodeIds.length);state.previousSourceCurrentA=0;state.pass=2;
    } else {
      if(state.firstPassFinal&&!state.numeric.voltage.every((value,i)=>value===state.firstPassFinal![i]))state.result={outcome:'numerical-failure',timeS:WINDOW_S,reason:'确定性重放与第一遍结果不一致',entities:[]};
      else state.result=successfulResult(compiled,state);
      return {done:true,state,result:state.result};
    }
  }
  return {done:false,state,progress:{pass:state.pass,timeS:state.numeric.timeS,accepted:state.numeric.accepted,rejected:state.numeric.rejected}};
}
export function runOscillatorAnalysis(compiled:CompiledOscillator,options:AnalysisOptions={}):OscillatorResult {
  let state=createOscillatorAnalysis(compiled,options);
  for(;;){const next=advanceOscillatorAnalysis(compiled,state);if(next.done)return next.result;state=next.state;}
}
/** Exposed for numerical verification of source and charge/port accounting. */
export const oscillatorPointEvidence=portValues;
export { speakerVoltage };
