import { describe, expect, it } from 'vitest';
import type { TransistorModelId } from '../types';
import { compileOscillator, createOscillatorAnalysis, runOscillatorAnalysis } from './analysis';
import { oscillatorFixture } from './fixtures';
import { advanceNumeric, initializeNumeric } from './integration';
import { DEFAULT_PRECISION, STRICT_PRECISION } from './numeric';

function namedCircuit(npn?:TransistorModelId,pnp?:TransistorModelId) {
  const document=oscillatorFixture();
  for(const part of document.components) {
    const model=part.kind==='npn'?npn:part.kind==='pnp'?pnp:undefined;
    if(model!==undefined)part.transistorModel=model;
  }
  const result=compileOscillator(document);
  if(!result.ok)throw new Error(result.result.reason);
  return result.compiled;
}

describe('optional transistor card time resolution',()=>{
  it.each([
    [undefined,undefined,1e-11],
    ['generic','generic',1e-11],
    ['2n3904','generic',1e-13],
    ['generic','2n3906',1e-13],
    ['2n3904','2n3906',1e-13],
  ] as const)('selects only the approved step floor for %s / %s',(npn,pnp,hMinS)=>{
    const state=createOscillatorAnalysis(namedCircuit(npn,pnp));
    expect(state.precision).toEqual({...DEFAULT_PRECISION,hMinS});
  });

  it('finishes the 2N3904/2N3906 reference without fabricating a periodic sound',()=>{
    const compiled=namedCircuit('2n3904','2n3906'),before=structuredClone(compiled.model.transistors);
    const result=runOscillatorAnalysis(compiled);
    expect(result.outcome,result.reason).toBe('settled-DC');
    expect(result.timeS).toBe(.04);
    expect(result.speaker?.bypassed).toBe(false);
    expect(result.speaker?.frequencyHz).toBeUndefined();
    expect(result.readings?.SPK1?.on).toBe(false);
    expect(result.speaker!.voltageV).toBeGreaterThan(1);
    expect(result.speaker!.voltageV).toBeLessThan(1.1);
    expect(result.stats!.minStepS).toBeGreaterThanOrEqual(1e-13);
    expect(result.stats!.minStepS).toBeLessThan(1e-11);
    expect(result.stats!.maxResidualA).toBeLessThanOrEqual(1e-9);
    expect(result.stats!.maxConductionA).toBeLessThanOrEqual(.25);
    expect(result.stats!.accepted).toBeLessThanOrEqual(1_000_000);
    expect(result.stats!.rejected).toBeLessThanOrEqual(10_000);
    expect(compiled.model.transistors).toEqual(before);
  });

  it('agrees with a stricter integration while preserving the same named-card floor',()=>{
    const compiled=namedCircuit('2n3904','2n3906');
    const normal=runOscillatorAnalysis(compiled);
    const strict=runOscillatorAnalysis(compiled,{precision:{...STRICT_PRECISION,hMinS:1e-13}});
    expect(normal.outcome,normal.reason).toBe('settled-DC');
    expect(strict.outcome,strict.reason).toBe(normal.outcome);
    expect(strict.timeS).toBe(.04);
    expect(Math.abs(strict.speaker!.voltageV-normal.speaker!.voltageV)).toBeLessThan(1e-6);
    expect(strict.stats!.minStepS).toBeGreaterThanOrEqual(1e-13);
    expect(strict.stats!.maxResidualA).toBeLessThanOrEqual(1e-9);
    expect(strict.stats!.accepted).toBeLessThanOrEqual(1_000_000);
    expect(strict.stats!.rejected).toBeLessThanOrEqual(10_000);
  });

  it.each([
    ['2n3904','generic'],
    ['generic','2n3906'],
  ] as const)('keeps the mixed pair %s / %s DC instead of forcing a tone',(npn,pnp)=>{
    const result=runOscillatorAnalysis(namedCircuit(npn,pnp));
    expect(result.outcome,result.reason).toBe('settled-DC');
    expect(result.timeS).toBe(.04);
    expect(result.speaker?.frequencyHz).toBeUndefined();
    expect(result.readings?.SPK1?.on).toBe(false);
  });

  it('enforces the 0.1 ps floor at source and window boundaries',()=>{
    const compiled=namedCircuit('2n3904','2n3906');
    const precision=createOscillatorAnalysis(compiled).precision;
    expect(precision.hMinS).toBe(1e-13);
    for(const boundary of [.0001,.04]){
      const state=initializeNumeric(compiled.model,precision);
      state.timeS=boundary-5e-14;
      const result=advanceNumeric(compiled.model,state,boundary,compiled.pairs,precision);
      expect(result.ok).toBe(false);
      expect(result.state.accepted).toBe(0);
      expect(result.state.timeS).toBe(state.timeS);
      if(!result.ok)expect(result.failure.outcome).toBe('numerical-failure');
    }
  });

  it('honors explicit precision and budget failure injection without publishing old readings',()=>{
    const compiled=namedCircuit('2n3904','2n3906');
    const coarse=runOscillatorAnalysis(compiled,{precision:DEFAULT_PRECISION});
    expect(coarse.outcome).toBe('numerical-failure');
    expect(coarse.reason).toContain('最小步长');
    expect(coarse.readings).toBeUndefined();
    const limited=runOscillatorAnalysis(compiled,{limits:{maxAccepted:0}});
    expect(limited.outcome).toBe('resource-limit');
    expect(limited.readings).toBeUndefined();
    expect(limited.speaker).toBeUndefined();
  });
});
