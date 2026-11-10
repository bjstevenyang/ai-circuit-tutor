import { describe, expect, it } from 'vitest';
import { createComponent, createEmptyDocument, getComponentPins } from './index';
import type { Rotation } from './types';
import { applyEdit, commitDocument, createHistory, redo, undo } from '../editor/model';
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
  it('restores known v1 for configuration only and converts to v2 without reinterpreting values or connections',()=>{
    const document={...createEmptyDocument(),modelProfileId:'oscillator-em-v1' as const,supplyVoltage:6,
      components:[createComponent('capacitor','c13',0,'cap','oscillator-em-v1'),createComponent('pnp','c20',180,'q2')],
      wires:[{id:'wire-id',from:'battery:+',to:'b13',color:'#123456',bend:'vertical' as const}]};
    expect(readCircuitDocument(document)).toEqual(document);
    expect(analyzeCircuit(document)).toMatchObject({status:'unsupported',complete:false});
    expect(analyzeCircuit(document).oscillator?.outcome).toBe('unsupported-model-version');
    expect(analyzeCircuit(document).readings).toBeUndefined();
    const edited=applyEdit(document,{type:'configure',id:'cap',settings:{capacitanceF:220e-9}});
    expect(edited.ok).toBe(true);
    expect(createComponent('capacitor','c3',0,'new','oscillator-em-v1').capacitanceF).toBe(100e-9);
    const converted=applyEdit(document,{type:'set-profile',profile:'oscillator-em-v2'});
    expect(converted.ok).toBe(true);
    if(!converted.ok)throw new Error(converted.error);
    expect(converted.document).toEqual({...document,modelProfileId:'oscillator-em-v2'});
    const history=commitDocument(createHistory(document),converted.document);
    expect(history.past).toHaveLength(1);
    const restored=undo(history);
    expect(restored.document).toEqual(document);
    expect(analyzeCircuit(restored.document).oscillator?.outcome).toBe('unsupported-model-version');
    expect(redo(restored).document).toEqual(converted.document);
  });
  it('changes profile as one undoable configuration without changing existing capacitance',()=>{
    const document={...createEmptyDocument(),components:[{...createComponent('capacitor','c13',0,'cap'),capacitanceF:100e-6}]};
    const changed=applyEdit(document,{type:'set-profile',profile:'oscillator-em-v2'});
    expect(changed.ok).toBe(true);
    if(!changed.ok)throw new Error(changed.error);
    expect(changed.document.components[0]?.capacitanceF).toBe(100e-6);
    expect(readCircuitDocument(changed.document)).not.toBeNull();
    const history=commitDocument(createHistory(document),changed.document);
    expect(history.past).toHaveLength(1);
    expect(undo(history).document).toEqual(document);
    expect(createComponent('capacitor','c13',0,'new','oscillator-em-v2').capacitanceF).toBe(100e-9);
    expect(createComponent('capacitor','c13',0,'old').capacitanceF).toBe(100e-9);
  });
  it.each([47e-9,100e-9,220e-9,221e-9,500e-9,1e-6])('accepts the oscillator boundary %s and only the approved 100nF legacy addition',capacitanceF=>{
    const part={...createComponent('capacitor','c13',0,'cap','oscillator-em-v2'),capacitanceF};
    const oscillator={...createEmptyDocument(),modelProfileId:'oscillator-em-v2' as const};
    expect(applyEdit(oscillator,{type:'place',component:part}).ok).toBe(true);
    expect(applyEdit(createEmptyDocument(),{type:'place',component:part}).ok).toBe(capacitanceF===100e-9);
    const stored={...createEmptyDocument(),components:[part]};
    expect(readCircuitDocument(stored)).not.toBeNull();
    if(capacitanceF!==100e-9)expect(analyzeCircuit(stored).diagnostics[0]?.reason).toContain('100 nF或10–1000');
  });
  it.each([0,46e-9,1.001e-6,2e-6,9e-6,1001e-6,NaN,Infinity])('rejects out-of-range or gap configuration %s atomically',capacitanceF=>{
    const d={...createEmptyDocument(),modelProfileId:'oscillator-em-v2' as const,components:[createComponent('capacitor','c13',0,'cap','oscillator-em-v2')]};
    expect(applyEdit(d,{type:'configure',id:'cap',settings:{capacitanceF}}).ok).toBe(false);
    expect(d.components[0]?.capacitanceF).toBe(100e-9);
    expect(readCircuitDocument({...d,components:[{...d.components[0]!,capacitanceF}]})).toBeNull();
  });
});
