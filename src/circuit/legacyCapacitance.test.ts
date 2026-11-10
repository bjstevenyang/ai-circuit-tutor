import { describe, expect, it } from 'vitest';
import { analyzeCircuit, createComponent, createEmptyDocument } from './index';
import { applyEdit, commitDocument, createHistory, redo, undo } from '../editor/model';
import { loadWorkspace, saveWorkspace } from '../storage';
import { rcExperiment } from '../../tests/fixtures/stage2';

describe('CAP-100NF approved legacy capacitance extension',()=>{
  it('creates 100nF capacitors in every model and permits placement in the original model',()=>{
    for(const profile of ['legacy-stage2-v1','oscillator-em-v1','oscillator-em-v2'] as const)
      expect(createComponent('capacitor','c13',0,'c',profile).capacitanceF).toBe(100e-9);
    const placed=applyEdit(createEmptyDocument(),{type:'place',component:{...createComponent('capacitor','c13',0,'c'),capacitanceF:100e-9}});
    expect(placed.ok).toBe(true);
  });
  it('accepts only the new discrete 100nF option and the existing 10–1000µF interval',()=>{
    const d={...createEmptyDocument(),components:[{...createComponent('capacitor','c13',0,'c'),capacitanceF:100e-6}]};
    for(const capacitanceF of [100e-9,10e-6,100e-6,1000e-6])expect(applyEdit(d,{type:'configure',id:'c',settings:{capacitanceF}}).ok).toBe(true);
    for(const capacitanceF of [47e-9,99e-9,101e-9,220e-9,1e-6,9e-6,NaN,Infinity])expect(applyEdit(d,{type:'configure',id:'c',settings:{capacitanceF}}).ok).toBe(false);
    expect(d.components[0]!.capacitanceF).toBe(100e-6);
  });
  it('solves 100nF and 10kΩ at 0/1τ/5τ with the existing analytic RC model',()=>{
    const d=rcExperiment();d.components.find(p=>p.id==='cap')!.capacitanceF=100e-9;
    for(const multiples of [0,1,5]){
      const result=analyzeCircuit(d,{deltaTimeS:multiples*.001});expect(result.status).toBe('supported');
      expect(result.readings!.cap!.voltageV).toBeCloseTo(4.5*(1-Math.exp(-multiples)),8);
      expect(result.readings!.cap!.currentMa).toBeCloseTo(.45*Math.exp(-multiples),8);
    }
  });
  it('saves/restores 100nF and preserves old stored values and undo/redo',()=>{
    const old={...createEmptyDocument(),components:[{...createComponent('capacitor','c13',0,'c'),capacitanceF:100e-6}]};
    let raw=JSON.stringify({...old,schemaVersion:4});const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};
    const loaded=loadWorkspace(storage);expect(loaded.status).toBe('loaded');if(loaded.status!=='loaded')throw Error('old workspace not loaded');
    expect(loaded.document.components[0]!.capacitanceF).toBe(100e-6);
    const changed=applyEdit(loaded.document,{type:'configure',id:'c',settings:{capacitanceF:100e-9}});expect(changed.ok).toBe(true);if(!changed.ok)throw Error(changed.error);
    const history=commitDocument(createHistory(loaded.document),changed.document);
    expect(undo(history).document.components[0]!.capacitanceF).toBe(100e-6);expect(redo(undo(history)).document.components[0]!.capacitanceF).toBe(100e-9);
    expect(saveWorkspace(changed.document,storage).ok).toBe(true);expect(loadWorkspace(storage)).toEqual({status:'loaded',document:changed.document});
  });
});
