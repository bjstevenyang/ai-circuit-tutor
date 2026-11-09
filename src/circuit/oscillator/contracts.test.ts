import { describe,it,expect } from 'vitest';
import { advanceNumeric, initializeNumeric } from './integration';
import { DEFAULT_PRECISION, EM, estimateError, domainViolation, GROUND, POSITIVE, sourceAt, type NumericModel } from './numeric';
import { compileOscillator,createOscillatorAnalysis,advanceOscillatorAnalysis,runOscillatorAnalysis,fullVoltages } from './analysis';
import { oscillatorFixture,oscillatorVariant,oscillatorFixtureDetails } from './fixtures';
const rc=():NumericModel=>({size:1,g:Float64Array.of(.001),capacitance:Float64Array.of(1e-7),gSource:Float64Array.of(-.001),cSource:new Float64Array(1),transistors:[],supplyV:9});
describe('OSC-02/06 frozen integration and failure contracts',()=>{
  it('does not mutate its input state and gives the same batch for repeated identical input',()=>{
    const compiled=compileOscillator(oscillatorFixture());if(!compiled.ok)throw new Error(compiled.result.reason);
    const initial=createOscillatorAnalysis(compiled.compiled),before=structuredClone(initial);
    const first=advanceOscillatorAnalysis(compiled.compiled,initial),second=advanceOscillatorAnalysis(compiled.compiled,initial);
    expect(initial).toEqual(before);expect(first).toEqual(second);expect(first.state).not.toBe(initial);
    expect(first.state.numeric.timeS).toBeGreaterThan(0);
    // The next batch must also leave already populated sample and tail arrays untouched.
    const populated=first.state,previous=structuredClone(populated);
    advanceOscillatorAnalysis(compiled.compiled,populated);expect(populated).toEqual(previous);
  });
  it('uses cold zero state, one aligned ramp, and checks voltage differences independently of node error',()=>{
    const model=rc(),state=initializeNumeric(model);expect([...state.voltage]).toEqual([0]);expect(sourceAt(model,0)).toBe(0);expect(sourceAt(model,.00005)).toBe(4.5);expect(sourceAt(model,.0001)).toBe(9);expect(sourceAt(model,.04)).toBe(9);
    expect(EM.cbeF).toBe(2e-9);expect(EM.cbcF).toBe(1e-9);
    const p={...DEFAULT_PRECISION,rtol:.01,atolV:1e-5};
    const f=Float64Array.of(10,10),h=Float64Array.of(10.001,9.999);
    expect(estimateError(f,h,9,[],p)).toBeLessThan(1);expect(estimateError(f,h,9,[[0,1]],p)).toBeGreaterThan(1);
    let current=state,seenRamp=false;
    while(current.timeS<.000101){const next=advanceNumeric(model,current,.000101,[[0,GROUND]]);expect(next.ok).toBe(true);if(!next.ok)break;expect(next.points.every(p=>p.residualA<=1e-9)).toBe(true);seenRamp ||= next.points.some(p=>p.timeS===.0001);current=next.state;}
    expect(seenRamp).toBe(true);expect(current.minStepS).toBeGreaterThanOrEqual(1e-11);
  });
  it('fails Newton/hmin explicitly, separates rejection and total acceptance budgets',()=>{
    const model=rc();
    const newton=advanceNumeric(model,initializeNumeric(model),.001,[],DEFAULT_PRECISION,{maxNewton:0,batchAttempts:256});
    expect(newton.ok).toBe(false);if(!newton.ok)expect(newton.failure.outcome).toBe('numerical-failure');
    for(const limit of [{maxAccepted:0},{maxRejected:0}]){const result=advanceNumeric(model,initializeNumeric(model),.001,[],DEFAULT_PRECISION,limit);expect(result.ok).toBe(false);if(!result.ok)expect(result.failure.outcome).toBe('resource-limit');}
    const stiff=advanceNumeric(model,initializeNumeric(model),.001,[],{...DEFAULT_PRECISION,atolV:1e-40,rtol:1e-40,hMinS:DEFAULT_PRECISION.hMaxS});
    expect(stiff.ok).toBe(false);if(!stiff.ok)expect(stiff.failure.outcome).toBe('numerical-failure');
  });
  it('never approves a sub-10ps step when aligning the ramp or window boundary',()=>{
    const model:NumericModel={size:1,g:Float64Array.of(1),capacitance:Float64Array.of(0),gSource:Float64Array.of(-1),cSource:Float64Array.of(0),transistors:[],supplyV:9};
    for(const boundary of [.0001,.04]){
      const state=initializeNumeric(model);state.timeS=boundary-5e-12;state.voltage[0]=sourceAt(model,state.timeS);
      const result=advanceNumeric(model,state,boundary,[]);
      expect(result.ok).toBe(false);expect(result.state.accepted).toBe(0);expect(result.state.timeS).toBe(state.timeS);
      if(!result.ok)expect(result.failure.outcome).toBe('numerical-failure');
    }
    const state=initializeNumeric(model);state.timeS=.0001-(1e-7+5e-12);state.stepS=1e-7;state.voltage[0]=sourceAt(model,state.timeS);
    const first=advanceNumeric(model,state,.0001,[],DEFAULT_PRECISION,{batchAttempts:1});
    expect(first.ok).toBe(true);expect(first.state.timeS).toBeLessThan(.0001);expect(first.state.accepted).toBe(1);
    const second=advanceNumeric(model,first.state,.0001,[]);
    expect(second.ok).toBe(true);expect(second.state.timeS).toBe(.0001);expect(second.state.minStepS).toBeGreaterThanOrEqual(1e-11);
    expect(second.state.accepted).toBe(2);
  });
  it('enforces the conduction domain at accepted half steps, including known-voltage nodes',()=>{
    const model:NumericModel={size:0,g:new Float64Array(),capacitance:new Float64Array(),gSource:new Float64Array(),cSource:new Float64Array(),supplyV:9,
      transistors:[{id:'Q',b:GROUND,c:GROUND,e:POSITIVE,sign:1,beta:100}]};
    expect(domainViolation(model,new Float64Array(),.0001)).toBe('Q');
    let state=initializeNumeric(model),failure='';
    while(state.timeS<.04){const result=advanceNumeric(model,state,.04,[[GROUND,POSITIVE]]);state=result.state;if(!result.ok){failure=result.failure.outcome;break;}}
    expect(failure).toBe('unsupported-model-domain');expect(state.timeS).toBeLessThan(.0001);
  });
  it('retains v1 configuration but refuses to run it; topology restrictions do not fabricate readings',()=>{
    const old=oscillatorFixture();old.modelProfileId='oscillator-em-v1';const result=compileOscillator(old);expect(result.ok).toBe(false);if(!result.ok){expect(result.result.outcome).toBe('unsupported-model-version');expect(result.result.readings).toBeUndefined();}
    const wrong=oscillatorVariant('WRONGKIND');const next=compileOscillator(wrong);expect(next.ok).toBe(false);if(!next.ok)expect(next.result.outcome).toBe('unsupported-topology');
    const square=oscillatorFixture();square.sourceMode='teaching-square';expect(compileOscillator(square).ok).toBe(false);
    const range=oscillatorFixture();range.components.find(p=>p.kind==='capacitor')!.capacitanceF=100e-6;expect(compileOscillator(range).ok).toBe(false);
  });
  it('cannot revive a cached partial waveform when the second-pass rejection budget is exhausted',()=>{
    const result=compileOscillator(oscillatorFixture());if(!result.ok)throw new Error(result.result.reason);
    let state=createOscillatorAnalysis(result.compiled);let next;
    do{next=advanceOscillatorAnalysis(result.compiled,state);state=next.state;}while(!next.done&&state.pass===1);
    expect(next.done).toBe(false);expect(state.result).toBeUndefined();expect(state.samples.length).toBeLessThanOrEqual(4096);
    state.limits={maxRejected:state.numeric.rejected};next=advanceOscillatorAnalysis(result.compiled,state);
    expect(next.done).toBe(true);if(next.done){expect(next.result.outcome).toBe('resource-limit');expect(next.result.speaker).toBeUndefined();expect(next.result.readings).toBeUndefined();}
  },20000);
  it('applies the same generic DC criteria for the internal beta negative control',()=>{
    const result=compileOscillator(oscillatorFixture());if(!result.ok)throw new Error(result.result.reason);
    result.compiled.model.transistors=result.compiled.model.transistors.map(t=>({...t,beta:100}));
    const answer=runOscillatorAnalysis(result.compiled);expect(answer.outcome).toBe('settled-DC');
    expect(answer.speaker?.frequencyHz).toBeUndefined();expect(answer.readings?.Q2?.collectorCurrentMa).toBeDefined();
    const dNode=result.compiled.endpointNodes[oscillatorFixtureDetails().nodeEndpoints.D![0]!]!;
    expect(Math.abs(answer.nodeVoltages![dNode]!-2.426166878)).toBeLessThanOrEqual(.02);
    let state=initializeNumeric(result.compiled.model),lastD=0,rises=0;const dIndex=result.compiled.nodeIds.indexOf(dNode);
    while(state.timeS<.015){const next=advanceNumeric(result.compiled.model,state,.015,result.compiled.pairs);if(!next.ok)throw new Error(next.failure.reason);for(const p of next.points){const d=fullVoltages(result.compiled,p)[dIndex]!;if(lastD<1&&d>=1)rises++;lastD=d;}state=next.state;}expect(rises).toBe(1);
  },20000);
});
