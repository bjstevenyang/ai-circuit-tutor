import { describe, expect, it } from 'vitest';
import { COMPONENT_KINDS, ENDPOINT_BY_ID, HOLES, analyzeCircuit, createComponent, createEmptyDocument, getComponentPins } from '../circuit';
import type { CircuitDocument, ComponentKind, CurveControl, Rotation, Wire } from '../circuit';
import { applyEdit, commitDocument, createHistory, redo, undo, validateDocument } from './model';
import { loadWorkspace, parseDocument, STORAGE_KEY } from '../storage';
import { endpointOccupancy } from '../circuit/wires';
import { newWireShape } from './wireGeometry';
import { validCircuit } from '../../tests/fixtures/circuits';
import { rcExperiment } from '../../tests/fixtures/stage2';
import { oscillatorFixture } from '../circuit/oscillator/fixtures';
import { spiceNetlist } from '../spice/netlist';

const lead=(to='a10'):Wire=>({id:'wire',from:'battery:+',to,color:'#123456',bend:'horizontal'});
function edit(doc:CircuitDocument,command:Parameters<typeof applyEdit>[1]) {
  const result=applyEdit(doc,command);if(!result.ok)throw Error(result.error);return result.document;
}
function sharePins(doc:CircuitDocument):CircuitDocument {
  const used=new Set(doc.wires.flatMap(w=>[w.from,w.to])),pins=doc.components.flatMap(p=>getComponentPins(p)!);
  const endpoint=(id:string)=>{
    const pin=pins.find(pin=>!used.has(pin)&&ENDPOINT_BY_ID.get(pin)!.group===ENDPOINT_BY_ID.get(id)!.group);
    if(!pin)return id;used.delete(id);used.add(pin);return pin;
  };
  return {...doc,wires:doc.wires.map(w=>{const from=endpoint(w.from),to=endpoint(w.to);return {...w,from,to,...newWireShape(from,to,'curve')};})};
}
describe('WIRING shared pins and curve documents',()=>{
  it('allows one component pin and one wire in either placement order',()=>{
    const component=createComponent('resistor','a10',0,'part');
    const withPart={...createEmptyDocument(),components:[component]};
    expect(applyEdit(withPart,{type:'wire',wire:lead()}).ok).toBe(true);
    const withWire={...createEmptyDocument(),wires:[lead()]};
    expect(applyEdit(withWire,{type:'place',component}).ok).toBe(true);
    expect(parseDocument({...withPart,wires:[lead()]})).toEqual({...withPart,wires:[lead()]});
  });
  it('retains the explicit curve point through canonical save reading',()=>{
    const wire:Wire={...lead(),bend:'curve',curveControl:{x:330,y:180}};
    const doc={...createEmptyDocument(),wires:[wire]};
    expect(parseDocument(doc)).toEqual(doc);
  });
  it.each([1,2,3,4])('does not broaden old v%s insertion rules during migration',schemaVersion=>{
    const doc={...createEmptyDocument(),schemaVersion,lessonId:schemaVersion===1?'led-series-v1':'dc-lab-v2',
      components:[createComponent('resistor','a10',0,'part')],wires:[lead()]};
    expect(parseDocument(doc)).toBeNull();
  });
  it.each(COMPONENT_KINDS.flatMap(kind=>([0,90,180,270] as Rotation[]).map(rotation=>[kind,rotation] as const)))('shares each %s pin at %s degrees without allowing a second pin or wire',(kind:ComponentKind,rotation:Rotation)=>{
    const component=HOLES.filter(h=>/^[a-j]\d+$/.test(h.id)).map(h=>createComponent(kind,h.id,rotation,'part')).find(p=>validateDocument({...createEmptyDocument(),components:[p]})===null)!;
    expect(component).toBeDefined();
    for(const pin of getComponentPins(component)!){
      const doc={...createEmptyDocument(),components:[component],wires:[lead(pin)]};
      expect(validateDocument(doc)).toBeNull();
      expect(applyEdit({...createEmptyDocument(),wires:[lead(pin)]},{type:'place',component}).ok).toBe(true);
      const raw=JSON.stringify(doc);
      expect(applyEdit(doc,{type:'wire',wire:{...lead(pin),id:'second',from:'battery:-'}}).ok).toBe(false);
      expect(applyEdit(doc,{type:'place',component:{...component,id:'second'}}).ok).toBe(false);
      expect(JSON.stringify(doc)).toBe(raw);
    }
  });
  it('moves, rotates and reconnects through shared pins, leaving wire anchors intact on removal',()=>{
    const part=createComponent('resistor','a10',0,'part');
    const doc={...createEmptyDocument(),components:[part],wires:[lead(),{...lead('d10'),id:'other',from:'battery:-'}]};
    const rotated=edit(doc,{type:'move',id:'part',anchor:'a10',rotation:90});
    expect(validateDocument(rotated)).toBeNull();expect(rotated.wires).toEqual(doc.wires);
    const reconnected=edit(doc,{type:'reconnect-wire',id:'other',endpoint:'to',to:'a13'});
    expect(endpointOccupancy(reconnected).pins.has('a13')).toBe(true);
    const moved=edit(reconnected,{type:'move',id:'part',anchor:'a20',rotation:0});
    expect(moved.wires).toEqual(reconnected.wires);
    const removed=edit(reconnected,{type:'remove',id:'part'});
    expect(removed.wires).toEqual(reconnected.wires);expect(endpointOccupancy(removed).pins.size).toBe(0);
    expect(endpointOccupancy(removed).wires.has('a10')).toBe(true);
    expect(endpointOccupancy(edit(reconnected,{type:'remove',id:'wire'})).pins.has('a10')).toBe(true);
  });
  it('changes only curve appearance, preserves its point on reconnection, and records undo/redo once',()=>{
    const doc={...createEmptyDocument(),wires:[lead()]};
    const curve=edit(doc,{type:'update-wire',id:'wire',bend:'curve'}),point={x:400,y:250};
    expect(curve.wires[0]!.curveControl).toBeDefined();
    const moved=edit(curve,{type:'update-wire',id:'wire',curveControl:point,color:'#abcdef'});
    expect(moved.wires[0]).toMatchObject({from:'battery:+',to:'a10',curveControl:point});
    point.x=0;expect(moved.wires[0]!.curveControl!.x).toBe(400);
    const connected=edit(moved,{type:'reconnect-wire',id:'wire',endpoint:'to',to:'b10'});
    expect(connected.wires[0]!.curveControl).toEqual({x:400,y:250});
    const history=commitDocument(createHistory(curve),connected);
    expect(history.past).toHaveLength(1);expect(undo(history).document).toEqual(curve);expect(redo(undo(history)).document).toEqual(connected);
    expect(commitDocument(history,edit(connected,{type:'update-wire',id:'wire',curveControl:{x:400,y:250}}))).toBe(history);
    expect(edit(connected,{type:'update-wire',id:'wire',bend:'vertical'}).wires[0]).not.toHaveProperty('curveControl');
  });
  it.each([undefined,null,{x:NaN,y:100},{x:100,y:Infinity},{x:15,y:100},{x:865,y:100},{x:100,y:15},{x:100,y:635},{x:'100',y:100}])('protects storage and rejects an invalid curve point %j',curveControl=>{
    const value={...createEmptyDocument(),wires:[{...lead(),bend:'curve',curveControl}]};
    const raw=JSON.stringify(value);let writes=0;
    expect(parseDocument(value)).toBeNull();
    expect(loadWorkspace({getItem:()=>raw,setItem:()=>{writes++;}}).status).toBe('error');expect(writes).toBe(0);
    const doc={...createEmptyDocument(),wires:[{...lead(),bend:'curve' as const,curveControl:{x:330,y:180}}]};
    if(curveControl!==undefined){expect(applyEdit(doc,{type:'update-wire',id:'wire',curveControl:curveControl as CurveControl}).ok).toBe(false);expect(doc.wires[0]!.curveControl).toEqual({x:330,y:180});}
  });
  it('accepts bounded and collinear control points and rejects unused point fields on folded wires',()=>{
    for(const point of [{x:16,y:16},{x:864,y:634},{x:302.5,y:367.5}]){
      expect(parseDocument({...createEmptyDocument(),wires:[{...lead(),bend:'curve',curveControl:point}]})).not.toBeNull();
    }
    expect(parseDocument({...createEmptyDocument(),wires:[{...lead(),curveControl:{x:330,y:180}}]})).toBeNull();
    expect(applyEdit({...createEmptyDocument(),wires:[lead()]},{type:'update-wire',id:'wire',curveControl:{x:330,y:180}}).ok).toBe(false);
  });
  it.each([1,2,3,4])('rejects new shape data in old v%s but restores its legal folded configuration read-only',schemaVersion=>{
    const doc={...createEmptyDocument(),schemaVersion,lessonId:schemaVersion===1?'led-series-v1':'dc-lab-v2',wires:[lead()]};
    const raw=JSON.stringify(doc);let saved=raw;
    const restored=loadWorkspace({getItem:()=>saved,setItem:(_key,value)=>{saved=value;}});
    expect(restored.status).toBe('loaded');expect(saved).toBe(raw);
    expect(parseDocument({...doc,wires:[{...lead(),bend:'curve',curveControl:{x:330,y:180}}]})).toBeNull();
    expect(parseDocument({...doc,wires:[{...lead(),curveControl:{x:330,y:180}}]})).toBeNull();
    expect(STORAGE_KEY).toBe('ai-circuit-tutor.workspace.v1');
  });
  it('keeps LED readings and RC time evolution equivalent when sharing pins and curving wires',()=>{
    const original=validCircuit(),shared=sharePins(original);
    expect(parseDocument(shared)).toEqual(shared);
    expect(analyzeCircuit(shared).readings?.led?.currentMa).toBeCloseTo(analyzeCircuit(original).readings!.led!.currentMa!,10);
    const rc=rcExperiment(),sharedRc=sharePins(rc),controls={timeState:{timeS:0,voltageV:0},deltaTimeS:1};
    expect(validateDocument(sharedRc)).toBeNull();
    expect(analyzeCircuit(sharedRc,controls).readings!.cap!.voltageV).toBeCloseTo(analyzeCircuit(rc,controls).readings!.cap!.voltageV!,12);
    const short={...shared,wires:[{...shared.wires[0]!,to:'battery:-'}]};
    expect(analyzeCircuit(short).diagnostics.some(d=>d.code==='source-short')).toBe(true);
  });
  it('keeps the complete-card SPICE netlist unchanged for equivalent shared-pin curved wiring',()=>{
    const original=oscillatorFixture();for(const part of original.components){if(part.kind==='npn')part.transistorModel='2n3904';if(part.kind==='pnp')part.transistorModel='2n3906';}
    const before=spiceNetlist(original),after=spiceNetlist(sharePins(original));
    expect(before.ok).toBe(true);expect(after.ok).toBe(true);
    if(before.ok&&after.ok)expect(after.netlist).toBe(before.netlist);
  });
});
