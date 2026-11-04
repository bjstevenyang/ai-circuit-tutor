import {describe,it,expect} from 'vitest';
import {analyzeCircuit,createComponent,getComponentPins} from './index';
import {readCircuitDocument} from './validation';
import {matrixBudget} from './boundedSolver';
import {parseDocument,saveWorkspace,loadWorkspace,STORAGE_KEY} from '../storage';
import {applyEdit,validateDocument} from '../editor/model';
import {rgbExperiment,npnExperiment,rcExperiment,piezoExperiment,circuitFixture} from '../../tests/fixtures/stage2';

describe('EX2 safety, equivalence and configuration contracts',()=>{
  it('RGB equal-drop common resistor rejects current sharing, different drops can be unique',()=>{
    for(const equal of [true,false]){const d=circuitFixture([{id:'u',kind:'rgb-led',nets:[equal?'unused':'X','N','X',equal?'X':'unused']},{id:'r',kind:'resistor',nets:['P','X'],settings:{resistance:330}}]);const a=analyzeCircuit(d);expect(a.status).toBe(equal?'unsupported':'supported');if(equal)expect(a.readings).toBeUndefined();}
  });
  it('RGB unlimited, bypass and reverse evidence points to the instance',()=>{
    const unlimited=circuitFixture([{id:'u',kind:'rgb-led',nets:['P','N','G','B']}]);expect(analyzeCircuit(unlimited).diagnostics[0]).toMatchObject({code:'missing-resistor',entities:['u']});
    const bypass=circuitFixture([{id:'u',kind:'rgb-led',nets:['N','N','G','B']}]);expect(analyzeCircuit(bypass).diagnostics[0]).toMatchObject({code:'led-bypassed',channel:'R',entities:expect.arrayContaining(['u'])});
    const reverse=circuitFixture([{id:'u',kind:'rgb-led',nets:['N','P','N','N']}]);expect(analyzeCircuit(reverse).diagnostics.some(d=>d.code==='reversed-led'&&d.channel==='R')).toBe(true);
  });
  it('NPN rejects direct base, emitter reversal and supports finite overcurrent',()=>{
    const direct=circuitFixture([{id:'t',kind:'npn',nets:['P','C','N']},{id:'r',kind:'resistor',nets:['P','C'],settings:{resistance:1000}}]);expect(analyzeCircuit(direct).diagnostics[0]).toMatchObject({code:'missing-resistor',pin:'B'});
    const wrong=npnExperiment(),t=wrong.components.find(p=>p.id==='npn')!;t.rotation=180;expect(analyzeCircuit(wrong).status).toBe('unsupported');
    const high=npnExperiment();high.components.find(p=>p.id==='rb')!.resistance=100;expect(analyzeCircuit(high).diagnostics.some(d=>d.code==='overcurrent'&&d.entities.includes('npn'))).toBe(true);
  });
  it.each([rgbExperiment,npnExperiment,rcExperiment,piezoExperiment])('object/wire ordering and appearance do not alter electrical results',make=>{
    const d=make(),a=analyzeCircuit(d);const equivalent={...d,components:[...d.components].reverse(),wires:[...d.wires].reverse().map(w=>({...w,from:w.to,to:w.from,color:'#336699',bend:'vertical' as const}))};expect(analyzeCircuit(equivalent)).toEqual(a);
  });
  it('RC rejects nonlinear mixtures, multiple capacitors, zero R and no reference',()=>{
    const mixed=rcExperiment();mixed.components.push(createComponent('led','j27',0,'extra'));expect(analyzeCircuit(mixed).status).toBe('unsupported');
    const multiple=circuitFixture([{id:'c1',kind:'capacitor',nets:['X','N']},{id:'c2',kind:'capacitor',nets:['Y','N']}]);expect(analyzeCircuit(multiple).status).toBe('unsupported');
    for(const nets of [['P','N'],['N','N'],['X','Y']]){const d=circuitFixture([{id:'c',kind:'capacitor',nets}]);expect(analyzeCircuit(d).status).toBe('unsupported');}
  });
  it('RC pin exchange preserves voltage and signed current with reference labels',()=>{
    const a=circuitFixture([{id:'c',kind:'capacitor',nets:['X','N']},{id:'r',kind:'resistor',nets:['P','X'],settings:{resistance:10000}}]);
    const b=circuitFixture([{id:'c',kind:'capacitor',nets:['N','X']},{id:'r',kind:'resistor',nets:['P','X'],settings:{resistance:10000}}]);
    expect(analyzeCircuit(a,{deltaTimeS:1}).readings!.c!.voltageV).toBeCloseTo(analyzeCircuit(b,{deltaTimeS:1}).readings!.c!.voltageV!,10);expect(analyzeCircuit(b).readings!.c!.referencePin).toBe('1');
  });
  it('source short has priority over unsupported combinations',()=>{const d=rcExperiment();d.components.push(createComponent('led','j27',0,'extra'));d.wires.push({id:'short',from:'battery:+',to:'battery:-',color:'#000000',bend:'vertical'});expect(analyzeCircuit(d).diagnostics[0]!.code).toBe('source-short');});
  it('piezo rejects parallel loads and source misuse; swapping pins is equivalent',()=>{
    const d=circuitFixture([{id:'p',kind:'piezo-passive',nets:['P','N']},{id:'r',kind:'resistor',nets:['P','N'],settings:{resistance:1000}}]);d.sourceMode='teaching-square';expect(analyzeCircuit(d).status).toBe('unsupported');
    const wrong=rgbExperiment();wrong.sourceMode='teaching-square';expect(analyzeCircuit(wrong).status).toBe('unsupported');
    const a=piezoExperiment(),b=circuitFixture([{id:'piezo',kind:'piezo-passive',nets:['N','X']},{id:'s',kind:'switch',nets:['P','X'],settings:{closed:true}}]);b.sourceMode='teaching-square';expect(analyzeCircuit(a).readings!.piezo!.vppV).toBe(analyzeCircuit(b).readings!.piezo!.vppV);
  });
  it.each(['rgb-led','npn','capacitor','piezo-passive'] as const)('EX2-09 all four rotations have distinct identity and atomic placement %s',kind=>{
    for(const rotation of [0,90,180,270] as const){const p=createComponent(kind,rotation===90?'a15':rotation===270?'e15':'c15',rotation,'p');expect(getComponentPins(p)).not.toBeNull();const d={...rcExperiment(),components:[p],wires:[]};expect(validateDocument(d)).toBeNull();expect(applyEdit(d,{type:'place',component:{...p,id:'collision'}}).ok).toBe(false);}
  });
  it('EX2-10 v4 configuration survives while dynamic state is stripped',()=>{
    const original=rcExperiment(),data={...original,timeS:20,voltageV:4,history:[],analysis:{status:'supported'},components:original.components.map(p=>({...p,actualVoltage:4}))};
    expect(parseDocument(data)).toEqual(original);const raw=JSON.stringify(data),contents=new Map([[STORAGE_KEY,raw]]),storage={getItem:(k:string)=>contents.get(k)??null,setItem:(k:string,v:string)=>{contents.set(k,v);}};expect(loadWorkspace(storage).status).toBe('loaded');expect(contents.get(STORAGE_KEY)).toBe(raw);expect(saveWorkspace(original,storage).ok).toBe(true);expect(JSON.parse(contents.get(STORAGE_KEY)!)).toEqual(original);
  });
  it('EX2-10 v1/v2/v3 migrate source defaults and preserve appropriate voltage',()=>{for(const version of [1,2,3]){const old={...rgbExperiment(),components:[],wires:[],schemaVersion:version,lessonId:version===1?'led-series-v1':'dc-lab-v2',supplyVoltage:9};const d=readCircuitDocument(old);expect(d).toMatchObject({schemaVersion:4,supplyVoltage:version===3?9:4.5,sourceMode:'battery',signalFrequencyHz:500});}});
  it.each([0,9e-6,1001e-6,NaN,Infinity])('rejects malformed capacitor configuration %s',capacitanceF=>{const d=rcExperiment();d.components.find(p=>p.id==='cap')!.capacitanceF=capacitanceF;expect(readCircuitDocument(d)).toBeNull();});
  it.each([0,2000,NaN,Infinity])('rejects unsupported persisted frequency %s',frequency=>{expect(readCircuitDocument({...piezoExperiment(),signalFrequencyHz:frequency})).toBeNull();});
  it('budget excess is retained as configuration but refused before analysis',()=>{const d=circuitFixture([1,2,3].map(i=>({id:`rgb${i}`,kind:'rgb-led',nets:[`R${i}`,'N',`G${i}`,`B${i}`]})));expect(parseDocument(d)).not.toBeNull();expect(analyzeCircuit(d).status).toBe('unsupported');expect(matrixBudget(128)).toBe(true);expect(matrixBudget(129)).toBe(false);expect(applyEdit(piezoExperiment(),{type:'set-frequency',value:2000 as 500}).ok).toBe(false);});
});
