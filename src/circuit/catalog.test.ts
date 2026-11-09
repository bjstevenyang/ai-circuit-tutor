import { describe, expect, it } from 'vitest';
import { createComponent, createEmptyDocument, getComponentPins } from './index';
import type { Rotation } from './types';
import { applyEdit, commitDocument, createHistory, undo } from '../editor/model';
import { analyzeCircuit } from './analysis';
import { readCircuitDocument } from './validation';

describe('OSC-01 new footprints remain independent of electrical correctness',()=>{
  it.each([
    [0,['c13','c14','c15'],['c13','c15']],
    [90,['c13','d13','e13'],['c13','e13']],
    [180,['c13','c12','c11'],['c13','c11']],
    [270,['c13','b13','a13'],['c13','a13']],
  ] as [Rotation,string[],string[]][])('maps real PNP/speaker pins at %s degrees and reserves them',(rotation,pnpPins,speakerPins)=>{
    for(const [kind,pins] of [['pnp',pnpPins],['speaker',speakerPins]] as const){
      const document=createEmptyDocument(),part=createComponent(kind,'c13',rotation,kind);
      expect(getComponentPins(part)).toEqual(pins);
      const placed=applyEdit(document,{type:'place',component:part});
      expect(placed.ok).toBe(true);
      if(!placed.ok)throw new Error(placed.error);
      expect(placed.document.modelProfileId).toBe('legacy-stage2-v1');
      for(const pin of pins)expect(applyEdit(placed.document,{type:'wire',wire:{id:'w',from:'battery:+',to:pin,color:'#123456',bend:'horizontal'}}).ok).toBe(false);
      expect(applyEdit(placed.document,{type:'move',id:kind,anchor:'j30',rotation:90}).ok).toBe(false);
      expect(applyEdit(placed.document,{type:'place',component:createComponent('resistor','c13',0,'overlap')}).ok).toBe(false);
      expect(placed.document.components[0]).toEqual(part);
      expect(readCircuitDocument(placed.document)?.components).toEqual([part]);
      expect(analyzeCircuit(placed.document).status).toBe('unsupported');
    }
  });
});

describe('OSC-02 explicit profile and capacitance edits',()=>{
  it('changes profile as one undoable configuration without changing existing capacitance',()=>{
    const document={...createEmptyDocument(),components:[createComponent('capacitor','c13',0,'cap')]};
    const changed=applyEdit(document,{type:'set-profile',profile:'oscillator-em-v1'});
    expect(changed.ok).toBe(true);
    if(!changed.ok)throw new Error(changed.error);
    expect(changed.document.components[0]?.capacitanceF).toBe(100e-6);
    expect(readCircuitDocument(changed.document)).not.toBeNull();
    const history=commitDocument(createHistory(document),changed.document);
    expect(history.past).toHaveLength(1);
    expect(undo(history).document).toEqual(document);
    expect(createComponent('capacitor','c13',0,'new','oscillator-em-v1').capacitanceF).toBe(100e-9);
    expect(createComponent('capacitor','c13',0,'old').capacitanceF).toBe(100e-6);
  });
  it.each([47e-9,100e-9,220e-9])('accepts the current profile boundary %s but preserves old RC rules',capacitanceF=>{
    const part={...createComponent('capacitor','c13',0,'cap','oscillator-em-v1'),capacitanceF};
    const oscillator={...createEmptyDocument(),modelProfileId:'oscillator-em-v1' as const};
    expect(applyEdit(oscillator,{type:'place',component:part}).ok).toBe(true);
    expect(applyEdit(createEmptyDocument(),{type:'place',component:part}).ok).toBe(false);
    const stored={...createEmptyDocument(),components:[part]};
    expect(readCircuitDocument(stored)).not.toBeNull();
    expect(analyzeCircuit(stored).diagnostics[0]?.reason).toContain('10–1000');
  });
  it.each([0,46e-9,221e-9,1e-6,9e-6,1001e-6,NaN,Infinity])('rejects out-of-range or gap configuration %s atomically',capacitanceF=>{
    const d={...createEmptyDocument(),modelProfileId:'oscillator-em-v1' as const,components:[createComponent('capacitor','c13',0,'cap','oscillator-em-v1')]};
    expect(applyEdit(d,{type:'configure',id:'cap',settings:{capacitanceF}}).ok).toBe(false);
    expect(d.components[0]?.capacitanceF).toBe(100e-9);
    expect(readCircuitDocument({...d,components:[{...d.components[0]!,capacitanceF}]})).toBeNull();
  });
});
