import {it,expect} from 'vitest';
import {analyzeCircuit} from './index';
import {rcStep} from './transient';
import {rcExperiment} from '../../tests/fixtures/stage2';
it('EX2-05 matches independent 0/1τ/5τ and continuous discharge',()=>{
  const d=rcExperiment();
  for(const [t,v,i] of ([[0,0,.45],[1,2.844542515,.165545749],[5,4.469679239,.003032076]] as const)){const a=analyzeCircuit(d,{deltaTimeS:t});expect(a.status,JSON.stringify(a.diagnostics)).toBe('supported');expect(a.readings!.cap!.voltageV).toBeCloseTo(v!,6);expect(a.readings!.cap!.currentMa).toBeCloseTo(i!,6);}
  d.components.find(p=>p.id==='sc')!.closed=false;d.components.find(p=>p.id==='sd')!.closed=true;
  const a=analyzeCircuit(d,{timeState:{timeS:5,voltageV:4.5*(1-Math.exp(-5))},deltaTimeS:1});expect(a.readings!.cap!.voltageV).toBeCloseTo(1.644303100,6);expect(a.readings!.cap!.currentMa).toBeCloseTo(-.164430310,6);expect(a.currentMa).toBe(0);
});
it('supports both switches closed and isolated voltage hold',()=>{const d=rcExperiment();d.components.find(p=>p.id==='sd')!.closed=true;const a=analyzeCircuit(d,{deltaTimeS:.5});expect(a.readings!.cap!.voltageV).toBeCloseTo(2.25*(1-Math.exp(-1)),6);d.components.find(p=>p.id==='sc')!.closed=false;d.components.find(p=>p.id==='sd')!.closed=false;const b=analyzeCircuit(d,{timeState:{timeS:2,voltageV:3},deltaTimeS:1});expect(b.readings!.cap).toMatchObject({voltageV:3,currentMa:0,capacitorState:'保持'});});
it('is deterministic, obeys event continuity and rejects invalid time',()=>{const d=rcExperiment();expect(analyzeCircuit(d,{timeState:{timeS:2,voltageV:3},deltaTimeS:0}).readings!.cap!.voltageV).toBeCloseTo(3,12);expect(analyzeCircuit(d,{deltaTimeS:61}).status).toBe('unsupported');expect(rcStep(4.5,0,10000,100e-6,1).voltageV).toBeCloseTo(4.5/Math.E,10);});
