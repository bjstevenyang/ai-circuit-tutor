import { describe,it,expect } from 'vitest';
import { compileOscillator, createOscillatorAnalysis, advanceOscillatorAnalysis, runOscillatorAnalysis } from './analysis';
import { oscillatorVariant,oscillatorFixtureDetails,oscillatorFixture } from './fixtures';

describe('OSC-02/05/06 generic finite analysis',()=>{
  it.each(['REF','NOC','NOR','NOSPK','BYPASS','PSHORT','MAX12'] as const)('classifies %s from equations',name=>{
    const compile=compileOscillator(oscillatorVariant(name));expect(compile.ok).toBe(true);if(!compile.ok)return;
    const result=runOscillatorAnalysis(compile.compiled);
    const expected={REF:'periodic',NOC:'settled-DC',NOR:'window-no-period',NOSPK:'settled-DC',BYPASS:'window-no-period',PSHORT:'settled-DC',MAX12:'periodic'};
    expect(result.outcome).toBe(expected[name]);
    expect(result.samples!.length).toBeLessThanOrEqual(4096);
    expect(result.stats!.maxResidualA).toBeLessThanOrEqual(1e-9);
    expect(result.stats!.maxConductionA).toBeLessThanOrEqual(.25);
    if(name==='REF'||name==='MAX12'){expect(Math.abs(result.speaker!.acRmsV/.365174583610-1)).toBeLessThanOrEqual(.02);expect(Math.abs(result.stats!.sourceMeanA!/.026083652922-1)).toBeLessThanOrEqual(.02);}
    if(name==='PSHORT')expect(result.currentMa).toBeCloseTo(9/47*1000,5);
    if(name==='BYPASS'){expect(result.speaker?.bypassed).toBe(true);expect(result.speaker?.voltageV).toBe(0);expect(result.speaker?.acRmsV).toBe(0);}
    if(name==='NOSPK')expect(result.speaker).toBeUndefined();
    if(name==='NOC'||name==='NOSPK'){const node=compile.compiled.endpointNodes[oscillatorFixtureDetails().nodeEndpoints.D![0]!]!;expect(Math.abs(result.nodeVoltages![node]!-(name==='NOC'?2.082358577:8.666383103))).toBeLessThanOrEqual(.02);}
  },20000);
  it('reproduces all numerical observations across three physical layouts and reversed speaker terminals',()=>{
    const results=[0,1,2].map(layout=>{
      const result=compileOscillator(oscillatorFixture(layout as 0|1|2));if(!result.ok)throw new Error(result.result.reason);return {compiled:result.compiled,result:runOscillatorAnalysis(result.compiled),layout:layout as 0|1|2};
    });
    const reference=results[0]!;
    for(const entry of results){
      expect(entry.result.outcome).toBe('periodic');
      expect(Math.abs(entry.result.speaker!.frequencyHz!/reference.result.speaker!.frequencyHz!-1)).toBeLessThanOrEqual(.005);
      expect(Math.abs(entry.result.speaker!.acRmsV/reference.result.speaker!.acRmsV-1)).toBeLessThanOrEqual(.02);
      expect(Math.abs(entry.result.stats!.sourceMeanA!/reference.result.stats!.sourceMeanA!-1)).toBeLessThanOrEqual(.02);
      for(const label of ['P','A','B','D','S']){
        const endpoint=oscillatorFixtureDetails(entry.layout).nodeEndpoints[label]![0]!;
        const refEndpoint=oscillatorFixtureDetails(0).nodeEndpoints[label]![0]!;
        expect(Math.abs(entry.result.nodeVoltages![entry.compiled.endpointNodes[endpoint]!]!-reference.result.nodeVoltages![reference.compiled.endpointNodes[refEndpoint]!]!)).toBeLessThanOrEqual(.1);
      }
    }
    expect(results[2]!.result.speaker!.voltageV).toBeLessThan(0);
  },30000);
  it('rejects OVER13 before integration and source short before topology',()=>{
    const over=compileOscillator(oscillatorVariant('OVER13'));expect(over.ok).toBe(false);if(!over.ok)expect(over.result.reason).toContain('13');
    const short=compileOscillator(oscillatorVariant('VSHORT'));expect(short.ok).toBe(false);if(!short.ok)expect(short.result.reason).toContain('短接');
  });
  it('shares acceptance budget between both passes without emitting a partial result',()=>{
    const compile=compileOscillator(oscillatorVariant('REF'));if(!compile.ok)throw new Error(compile.result.reason);
    let state=createOscillatorAnalysis(compile.compiled,{limits:{maxAccepted:200_000}});let result;
    do{result=advanceOscillatorAnalysis(compile.compiled,state);state=result.state;}while(!result.done);
    expect(state.pass).toBe(2);expect(result.result.outcome).toBe('resource-limit');expect(result.result.readings).toBeUndefined();
  },20000);
});
