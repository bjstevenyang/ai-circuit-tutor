import { describe, expect, it } from 'vitest';
import { createComponent } from './catalog';
import { readCircuitDocument, validComponent } from './validation';
import { createEmptyDocument } from './board';
import { applyEdit } from '../editor/model';
import { emCurrents, GROUND, POSITIVE } from './oscillator/numeric';
import { TRANSISTOR_CARDS, transistorParameters } from './transistorModels';

describe('optional model cards without legacy regression',()=>{
  it('keeps existing NPN/PNP generic parameters by default',()=>{
    expect(transistorParameters('npn',undefined)).toEqual(TRANSISTOR_CARDS.genericNpn);
    expect(transistorParameters('pnp','generic')).toEqual(TRANSISTOR_CARDS.genericPnp);
  });
  it('uses the sourced IS/BF/CJE/CJC entries and rejects reversed type choices',()=>{
    expect(transistorParameters('npn','2n3904')).toEqual({beta:416.4,saturationA:6.734e-15,cbeF:4.493e-12,cbcF:3.638e-12});
    expect(transistorParameters('pnp','2n3906')).toEqual({beta:180.7,saturationA:1.41e-15,cbeF:8.063e-12,cbcF:9.728e-12});
    expect(validComponent({...createComponent('npn','a3',0,'Q1'),transistorModel:'2n3906'})).toBe(false);
    expect(validComponent({...createComponent('pnp','a3',0,'Q2'),transistorModel:'2n3904'})).toBe(false);
  });
  it('preserves a model choice through configure and v5 JSON read',()=>{
    const doc={...createEmptyDocument(),modelProfileId:'oscillator-em-v2' as const,components:[createComponent('npn','g10',0,'Q1')]};
    const edited=applyEdit(doc,{type:'configure',id:'Q1',settings:{transistorModel:'2n3904'}});
    expect(edited.ok).toBe(true);
    if(!edited.ok)return;
    expect(readCircuitDocument(JSON.parse(JSON.stringify(edited.document)))?.components[0]?.transistorModel).toBe('2n3904');
  });
  it('the selected IS changes the EM current without changing pin identity',()=>{
    const generic=transistorParameters('npn','generic'),specific=transistorParameters('npn','2n3904');
    const v=new Float64Array([0.65,0.05]);
    const junction={id:'Q1',b:0,c:1,e:GROUND,sign:1 as const,beta:generic.beta};
    const a=emCurrents({...junction,saturationA:generic.saturationA},v,9);
    const b=emCurrents({...junction,beta:specific.beta,saturationA:specific.saturationA},v,9);
    expect(b.ib).not.toBe(a.ib);
    expect(POSITIVE).not.toBe(GROUND);
  });
});
