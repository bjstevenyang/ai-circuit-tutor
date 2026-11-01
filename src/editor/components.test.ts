import { describe, expect, it } from 'vitest';
import { createComponent, createEmptyDocument, getComponentPins } from '../circuit';
import type { ComponentKind, Rotation } from '../circuit';
import { applyEdit, validateDocument } from './model';
import { snapAnchor, snapEndpoint } from './drag';

const cases: [ComponentKind,string[]][]=[['switch',['a10','a12']],['button',['e10','e11','f10','f11']],['potentiometer',['a10','a11','a12']],['buzzer',['a10','a12']],['diode',['a10','a12']],['ldr',['a10','a12']]];
describe('expanded component placement',()=>{
  it.each(cases)('derives all pins for %s and reserves every insertion point',(kind,pins)=>{
    const part=createComponent(kind,kind==='button'?'e10':'a10',0,'part');
    const result=applyEdit(createEmptyDocument(),{type:'place',component:part});
    expect(result.ok).toBe(true);
    expect(getComponentPins(part)).toEqual(pins);
    if(!result.ok)throw new Error(result.error);
    for(const pin of pins)expect(applyEdit(result.document,{type:'wire',wire:{id:'wire',from:'battery:+',to:pin,color:'#123456',bend:'horizontal'}}).ok).toBe(false);
  });
  it.each([0,90,180,270] as Rotation[])('rotates the full four-pin footprint at %s degrees',rotation=>{
    const part=createComponent('button','d15',rotation,'button');
    const pins=getComponentPins(part);
    // Only valid landings on the explicit board are allowed, including the gap.
    if(rotation===0)expect(pins).toBeNull();
    if(rotation===90)expect(pins).toEqual(['d15','e15','d12','e12']);
    if(rotation===180)expect(pins).toEqual(['d15','d14','a15','a14']);
    if(rotation===270)expect(pins).toEqual(['d15','c15','d18','c18']);
  });
  it('rejects occupied button pins and impossible moves without changing the anchor',()=>{
    const document={...createEmptyDocument(),components:[createComponent('button','e10',0,'button')]};
    const overlap=createComponent('led','f10',0,'led');
    expect(applyEdit(document,{type:'place',component:overlap}).ok).toBe(false);
    const result=applyEdit(document,{type:'move',id:'button',anchor:'j30',rotation:90});
    expect(result.ok).toBe(false);
    expect(document.components[0]!.anchor).toBe('e10');
  });
  it('supports valid settings and rejects wrong-type or out-of-range settings atomically',()=>{
    for(const [kind,settings] of [['switch',{closed:true}],['potentiometer',{position:25,resistance:1000}],['ldr',{light:0}]] as const){
      const document={...createEmptyDocument(),components:[createComponent(kind,'a10',0,'part')]};
      const result=applyEdit(document,{type:'configure',id:'part',settings});
      expect(result.ok).toBe(true);
      if(result.ok)expect(result.document.components[0]).toMatchObject(settings);
      expect(applyEdit(document,{type:'configure',id:'part',settings:{light:101}}).ok).toBe(false);
      expect(document.components[0]).toEqual(createComponent(kind,'a10',0,'part'));
    }
  });
  it('enforces separate total-part, polar-part and wire budgets',()=>{
    const document=createEmptyDocument();
    document.components=Array.from({length:25},(_,i)=>createComponent('resistor','a1',0,`r${i}`));
    expect(validateDocument(document)).toContain('24');
    document.components=Array.from({length:7},(_,i)=>createComponent('led','a1',0,`l${i}`));
    expect(validateDocument(document)).toContain('6');
    document.components=[];
    document.wires=Array.from({length:121},(_,i)=>({id:`w${i}`,from:'a1',to:'a2',color:'#123456',bend:'horizontal'}));
    expect(validateDocument(document)).toContain('120');
  });
});
describe('drag anchor snapping',()=>{
  it('snaps near a mounting hole without using rails or the central gap',()=>{
    expect(snapAnchor({x:143,y:171})).toBe('a1');
    expect(snapAnchor({x:140,y:280})).toBeNull();
    expect(snapAnchor({x:140,y:100})).toBeNull();
    expect(snapAnchor({x:900,y:170})).toBeNull();
    expect(snapEndpoint({x:285,y:565})).toBe('battery:+');
    expect(snapEndpoint({x:140,y:100})).toBe('top+:1');
    expect(snapEndpoint({x:140,y:280})).toBeNull();
  });
});
