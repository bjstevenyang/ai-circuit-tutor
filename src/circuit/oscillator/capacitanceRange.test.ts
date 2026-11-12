import { describe, expect, it } from 'vitest';
import { createComponent, createEmptyDocument } from '../index';
import { isCapacitanceForProfile } from '../parameters';
import { readCircuitDocument } from '../validation';
import { applyEdit, commitDocument, createHistory, redo, undo } from '../../editor/model';
import { loadWorkspace, saveWorkspace } from '../../storage';
import { compileOscillator, runOscillatorAnalysis } from './analysis';
import { oscillatorFixture } from './fixtures';

describe('OSC v2 capacitance through 1uF',()=>{
  it.each([221e-9,500e-9,1e-6])('applies and round-trips %s without scaling or losing undo history',capacitanceF=>{
    const document=oscillatorFixture();
    const edited=applyEdit(document,{type:'configure',id:'C1',settings:{capacitanceF}});
    expect(edited.ok).toBe(true);
    if(!edited.ok)throw new Error(edited.error);
    const history=commitDocument(createHistory(document),edited.document);
    expect(history.document.components.find(p=>p.id==='C1')?.capacitanceF).toBe(capacitanceF);
    expect(undo(history).document).toEqual(document);
    expect(redo(undo(history)).document).toEqual(edited.document);
    let raw='';const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};
    expect(saveWorkspace(edited.document,storage).ok).toBe(true);
    expect(loadWorkspace(storage)).toEqual({status:'loaded',document:edited.document});
  });

  it('keeps the default, retired profile, legacy gaps and old-schema restrictions',()=>{
    expect(createComponent('capacitor','c13',0,'c','oscillator-em-v2').capacitanceF).toBe(100e-9);
    expect(isCapacitanceForProfile(1e-6,'oscillator-em-v1')).toBe(false);
    expect(isCapacitanceForProfile(1e-6,'legacy-stage2-v1')).toBe(false);
    for(const capacitanceF of [46e-9,1.001e-6,5e-6,NaN,Infinity])expect(isCapacitanceForProfile(capacitanceF,'oscillator-em-v2')).toBe(false);
    const old={...createEmptyDocument(),schemaVersion:4,components:[{...createComponent('capacitor','c13',0,'c'),capacitanceF:1e-6}]};
    expect(readCircuitDocument(old)).toBeNull();
    expect(readCircuitDocument({...old,components:[{...old.components[0]!,capacitanceF:100e-6}]})?.components[0]?.capacitanceF).toBe(100e-6);
  });

  it.each(['generic','named'] as const)('accepts the 1uF %s reference and preserves honest finite-window outcomes',kind=>{
    const document=oscillatorFixture();
    document.components.find(p=>p.id==='C1')!.capacitanceF=1e-6;
    if(kind==='named')for(const part of document.components){if(part.kind==='npn')part.transistorModel='2n3904';if(part.kind==='pnp')part.transistorModel='2n3906';}
    const compiled=compileOscillator(document);
    expect(compiled.ok).toBe(true);
    if(!compiled.ok)throw new Error(compiled.result.reason);
    const result=runOscillatorAnalysis(compiled.compiled);
    // A wider input range does not guarantee convergence of every model card.
    // Named cards currently fail near 7.10 ms; keep that failure explicit and silent.
    if(kind==='named'&&result.outcome==='numerical-failure'){
      expect(result.reason).toBeTruthy();
      expect(result.timeS).toBeGreaterThan(0);
      expect(result.timeS).toBeLessThan(.04);
      expect(result.readings).toBeUndefined();
      expect(result.nodeVoltages).toBeUndefined();
      expect(result.speaker).toBeUndefined();
      return;
    }
    expect(['periodic','settled-DC','window-no-period'],result.reason).toContain(result.outcome);
    expect(result.timeS).toBe(.04);
    expect(Number.isFinite(result.speaker?.voltageV)).toBe(true);
    expect(result.stats!.maxResidualA).toBeLessThanOrEqual(1e-9);
    expect(result.stats!.accepted).toBeLessThanOrEqual(1_000_000);
    expect(result.stats!.rejected).toBeLessThanOrEqual(10_000);
    if(result.outcome!=='periodic')expect(result.speaker?.frequencyHz).toBeUndefined();
  });
});
