import { describe,it,expect } from 'vitest';
import { analyzeCircuit, getComponentPins, inspectConnectivity } from './index';
import { rgbExperiment } from '../../tests/fixtures/stage2';
describe('EX2-01/02 RGB',()=>{
  it('matches independent channel currents, colour and total',()=>{const d=rgbExperiment(),a=analyzeCircuit(d);expect(a.status).toBe('supported');expect(a.readings?.rgb?.channels?.R.currentMa).toBeCloseTo(7.575757576,6);expect(a.readings?.rgb?.channels?.G.currentMa).toBeCloseTo(4.545454545,6);expect(a.readings?.rgb?.rgb).toEqual([157,122,122]);expect(a.currentMa).toBeCloseTo(16.666666667,6);
    const pins=getComponentPins(d.components.find(p=>p.id==='rgb')!)!;expect(inspectConnectivity(d,pins[0])).not.toContain(pins[1]);});
  it.each([0,1,2,3,4,5,6,7])('supports all switch sets %i',mask=>{const d=rgbExperiment();for(const [i,ch] of ['R','G','B'].entries())d.components.find(p=>p.id===`s${ch}`)!.closed=!!(mask&(1<<i));const a=analyzeCircuit(d);expect(a.status).toBe('supported');for(const [i,ch] of (['R','G','B'] as const).entries())expect(a.readings?.rgb?.channels?.[ch].on).toBe(!!(mask&(1<<i)));});
  it('changes only red; reports per-channel overcurrent',()=>{const d=rgbExperiment();d.components.find(p=>p.id==='rR')!.resistance=1000;let a=analyzeCircuit(d);expect(a.readings?.rgb?.channels?.R.currentMa).toBeCloseTo(2.5,6);expect(a.readings?.rgb?.rgb?.[0]).toBe(90);d.components.find(p=>p.id==='rR')!.resistance=100;a=analyzeCircuit(d);expect(a.diagnostics).toEqual([{code:'overcurrent',entities:['rgb'],channel:'R'}]);expect(a.readings?.rgb?.channels?.R.currentMa).toBeCloseTo(25,6);});
});
