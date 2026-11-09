import { describe, expect, it } from 'vitest';
import { createComponent, createEmptyDocument } from '../circuit';
import { loadWorkspace, parseDocument, saveWorkspace, STORAGE_KEY } from './index';
import { readCircuitDocument } from '../circuit/validation';

describe('OSC-06 v5 configuration and legacy model migration',()=>{
  it.each([1,2,3,4])('migrates v%s to the legacy profile without reading new model fields',schemaVersion=>{
    const part=createComponent('resistor','c13',0,'stable-id');
    const old={...createEmptyDocument(),schemaVersion,lessonId:schemaVersion===1?'led-series-v1':'dc-lab-v2',supplyVoltage:9,
      components:[part],modelProfileId:'oscillator-em-v2'};
    const raw=JSON.stringify(old);let contents=raw,writes=0;
    const storage={getItem:()=>contents,setItem:(_key:string,value:string)=>{contents=value;writes++;}};
    const result=loadWorkspace(storage);
    expect(result.status).toBe('loaded');
    if(result.status!=='loaded')throw new Error('failed migration');
    expect(result.document).toMatchObject({schemaVersion:5,modelProfileId:'legacy-stage2-v1',supplyVoltage:schemaVersion<3?4.5:9,components:[part]});
    expect(contents).toBe(raw);expect(writes).toBe(0);
    expect(saveWorkspace(result.document,storage).ok).toBe(true);
    expect(JSON.parse(contents).modelProfileId).toBe('legacy-stage2-v1');
  });
  it.each(['oscillator-em-v1','oscillator-em-v2'] as const)('round-trips %s, both new kinds/capacity and strips all transient data',modelProfileId=>{
    const d={...createEmptyDocument(),modelProfileId,supplyVoltage:9,components:[
      createComponent('pnp','c3',0,'q2'),createComponent('speaker','c10',0,'spk'),createComponent('capacitor','c20',0,'c','oscillator-em-v2')],
      wires:[{id:'w',from:'battery:+',to:'b3',color:'#123456',bend:'horizontal' as const}]};
    let raw='';const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};
    const polluted={...d,voltage:[9,0],charges:[1],timeS:.04,worker:{generation:9},samples:[1],frequencyHz:290,volume:100,enabled:true};
    expect(saveWorkspace(polluted,storage).ok).toBe(true);
    expect(JSON.parse(raw)).toEqual(d);
    expect(loadWorkspace(storage)).toEqual({status:'loaded',document:d});
    expect(raw).not.toContain('samples');
  });
  it('protects unknown/missing model versions and prohibits new kinds in old schemas',()=>{
    const valid=createEmptyDocument();
    for(const modelProfileId of [undefined,'oscillator-em-v3','unknown']){
      const raw=JSON.stringify({...valid,modelProfileId});let writes=0;
      const storage={getItem:(key:string)=>key===STORAGE_KEY?raw:null,setItem:()=>{writes++;}};
      expect(loadWorkspace(storage).status).toBe('error');expect(writes).toBe(0);
      expect(parseDocument({...valid,modelProfileId})).toBeNull();
    }
    for(const kind of ['pnp','speaker'] as const)expect(readCircuitDocument({...valid,schemaVersion:4,components:[createComponent(kind,'c10',0,'new')]})).toBeNull();
    expect(readCircuitDocument({...valid,schemaVersion:4,components:[createComponent('capacitor','c10',0,'new','oscillator-em-v2')]})).toBeNull();
  });
  it('retains physically legal unsupported mixtures without relaxing the legacy eight-kind limit',()=>{
    const d={...createEmptyDocument(),modelProfileId:'oscillator-em-v2' as const,
      components:Array.from({length:7},(_,i)=>createComponent('led',`a${1+4*i}`,0,`led${i}`))};
    expect(parseDocument(d)).not.toBeNull();
    expect(parseDocument({...d,modelProfileId:'legacy-stage2-v1'})).toBeNull();
  });
});
