import { describe,it,expect } from 'vitest';
import { oscillatorFixture, oscillatorVariant } from '../circuit/oscillator/fixtures';
import { spiceNetlist } from './netlist';
import { applyEdit,commitDocument,createHistory,undo,redo } from '../editor/model';
import { parseDocument } from '../storage';
import { readCircuitDocument } from '../circuit/validation';
import { SPICE_CARDS } from './cards';

describe('standard SPICE dynamics version and topology',()=>{
  it('requires explicit cards and rejects source shorts without geometric inference',()=>{
    expect(spiceNetlist(oscillatorFixture()).ok).toBe(false);
    const d=oscillatorVariant('VSHORT');
    const r=spiceNetlist(d);expect(r.ok).toBe(false);if(!r.ok)expect(r.result.reason).toContain('短接');
  });
  it('selects an explicit protected version, round-trips it and restores the old version on undo',()=>{
    const original=oscillatorFixture(),result=applyEdit(original,{type:'set-dynamics',enabled:true});
    expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
    expect(result.document.modelProfileId).toBe('oscillator-spice-gp-v1');
    expect(parseDocument(result.document)).toEqual(result.document);
    const h=commitDocument(createHistory(original),result.document);expect(undo(h).document).toEqual(original);expect(redo(undo(h)).document).toEqual(result.document);
    expect(readCircuitDocument({...result.document,transistorDynamics:'unknown'})).toBeNull();
    expect(readCircuitDocument({...result.document,transistorDynamics:undefined})).toBeNull();
    expect(readCircuitDocument({...result.document,modelProfileId:'oscillator-em-v2'})).toBeNull();
    const changed=applyEdit(result.document,{type:'set-profile',profile:'legacy-stage2-v1'});expect(changed.ok).toBe(true);
    if(changed.ok)expect(changed.document.transistorDynamics).toBeUndefined();
  });
  it('uses full cards, measured source ramp and explicit terminal sensors',()=>{
    const d=oscillatorFixture();for(const p of d.components){if(p.kind==='npn')p.transistorModel='2n3904';if(p.kind==='pnp')p.transistorModel='2n3906';}
    const r=spiceNetlist(d);expect(r.ok).toBe(true);if(!r.ok)throw Error(r.result.reason);
    expect(r.netlist).toContain('PWL(0 0 100u 9)');
    expect(r.netlist).toContain(SPICE_CARDS);expect(r.netlist).toContain('.tran .25u 40m 0 .25u uic');
    expect(r.netlist).not.toContain('undefined');expect(r.netlist.match(/^v[bce]\d+/gm)).toHaveLength(6);
    expect(SPICE_CARDS).toContain('TF=301.2p');expect(SPICE_CARDS).toContain('BR=4.977');
  });
});
