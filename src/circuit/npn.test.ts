import { it,expect } from 'vitest';
import { analyzeCircuit } from './index';
import { npnExperiment,maxExperiment,circuitFixture } from '../../tests/fixtures/stage2';
it.each([
  [false,10000,0,0,0,4.5,0],
  [true,10000,.373,7.012696970,7.385696970,.2,7.392696970],
  [true,100000,.031,3.1,3.131,1.486943088,3.138],
] as const)('EX2-03 exact coupled case %s %s',(closed,rb,ib,ic,ie,vce,source)=>{const a=analyzeCircuit(npnExperiment(rb,closed));expect(a.status,JSON.stringify(a.diagnostics)).toBe('supported');const r=a.readings!.npn!;expect(r.baseCurrentMa).toBeCloseTo(ib,6);expect(r.collectorCurrentMa).toBeCloseTo(ic,6);expect(r.emitterCurrentMa).toBeCloseTo(ie,6);expect(r.vceV).toBeCloseTo(vce,6);expect(a.currentMa).toBeCloseTo(source,6);});
it('EX2-04 refuses floating collector and recovers with reference',()=>{const d=npnExperiment(10000,false),pins=d.components.find(p=>p.id==='ref')!;d.components=d.components.filter(p=>p!==pins);const a=analyzeCircuit(d);expect(a.status).toBe('unsupported');expect(a.readings).toBeUndefined();expect(analyzeCircuit(npnExperiment(10000,false)).status).toBe('supported');});
it('EX2-12 compiles a physically valid 24-component 576-candidate fixture',()=>{const d=maxExperiment(),a=analyzeCircuit(d);expect(d.components).toHaveLength(24);expect(a.status,JSON.stringify(a.diagnostics)).toBe('supported');expect(a.currentMa).toBeCloseTo(51.693333333,6);});
it.each([
  [38000,430,'saturated',.1,10,.2],
  [38000,1000,'cutoff',0,0,4.5],
] as const)('EX2-03 coincident region boundary prefers %s/%s/%s',(baseResistance,loadResistance,region,ib,ic,vce)=>{
  const d=circuitFixture([{id:'t',kind:'npn',nets:['B','C','N']},{id:'rb',kind:'resistor',nets:['P','B'],settings:{resistance:baseResistance}},{id:'rc',kind:'resistor',nets:['P','C'],settings:{resistance:loadResistance}},...(region==='cutoff'?[{id:'down',kind:'resistor' as const,nets:['B','N'],settings:{resistance:7000}}]:[])]);
  const a=analyzeCircuit(d);expect(a.status).toBe('supported');expect(a.readings!.t!.region).toBe(region);expect(a.readings!.t!.baseCurrentMa).toBeCloseTo(ib,6);expect(a.readings!.t!.collectorCurrentMa).toBeCloseTo(ic,6);expect(a.readings!.t!.vceV).toBeCloseTo(vce,6);
});
it('EX2-04 independent collector overcurrent retains finite readings and clears after repair',()=>{
  const d=circuitFixture([{id:'t',kind:'npn',nets:['B','C','N']},{id:'rb',kind:'resistor',nets:['P','B'],settings:{resistance:1000}},{id:'down',kind:'resistor',nets:['B','N'],settings:{resistance:100000}},{id:'rc',kind:'resistor',nets:['P','C'],settings:{resistance:50}}]);
  const a=analyzeCircuit(d);expect(a.status).toBe('fault');expect(a.readings!.t!.baseCurrentMa).toBeCloseTo(3.793,6);expect(a.readings!.t!.collectorCurrentMa).toBeCloseTo(86,6);expect(a.diagnostics).toContainEqual(expect.objectContaining({code:'overcurrent',entities:['t']}));d.components.find(p=>p.id==='rc')!.resistance=1000;expect(analyzeCircuit(d).diagnostics.some(d=>d.code==='overcurrent')).toBe(false);
});
