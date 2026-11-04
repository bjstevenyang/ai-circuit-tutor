import { it,expect } from 'vitest';
import { analyzeCircuit } from './index';
import { npnExperiment,maxExperiment } from '../../tests/fixtures/stage2';
it.each([
  [false,10000,0,0,0,4.5,0],
  [true,10000,.373,7.012696970,7.385696970,.2,7.392696970],
  [true,100000,.031,3.1,3.131,1.486943088,3.138],
] as const)('EX2-03 exact coupled case %s %s',(closed,rb,ib,ic,ie,vce,source)=>{const a=analyzeCircuit(npnExperiment(rb,closed));expect(a.status,JSON.stringify(a.diagnostics)).toBe('supported');const r=a.readings!.npn!;expect(r.baseCurrentMa).toBeCloseTo(ib,6);expect(r.collectorCurrentMa).toBeCloseTo(ic,6);expect(r.emitterCurrentMa).toBeCloseTo(ie,6);expect(r.vceV).toBeCloseTo(vce,6);expect(a.currentMa).toBeCloseTo(source,6);});
it('EX2-04 refuses floating collector and recovers with reference',()=>{const d=npnExperiment(10000,false),pins=d.components.find(p=>p.id==='ref')!;d.components=d.components.filter(p=>p!==pins);const a=analyzeCircuit(d);expect(a.status).toBe('unsupported');expect(a.readings).toBeUndefined();expect(analyzeCircuit(npnExperiment(10000,false)).status).toBe('supported');});
it('EX2-12 compiles a physically valid 24-component 576-candidate fixture',()=>{const d=maxExperiment(),a=analyzeCircuit(d);expect(d.components).toHaveLength(24);expect(a.status,JSON.stringify(a.diagnostics)).toBe('supported');expect(a.currentMa).toBeCloseTo(51.693333333,6);});
