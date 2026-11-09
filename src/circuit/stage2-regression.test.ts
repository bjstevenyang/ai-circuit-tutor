import {describe,it,expect} from 'vitest';
import {analyzeCircuit,createComponent,getComponentPins,HOLES} from './index';
import {readCircuitDocument} from './validation';
import {matrixBudget,solveBounded} from './boundedSolver';
import {compileNetwork} from './stage2';
import {parseDocument,saveWorkspace,loadWorkspace,STORAGE_KEY} from '../storage';
import {applyEdit,validateDocument} from '../editor/model';
import {rgbExperiment,npnExperiment,rcExperiment,piezoExperiment,circuitFixture} from '../../tests/fixtures/stage2';
import {maxExperiment,overExperiment,overPolarExperiment} from '../../tests/fixtures/stage2';
import reference from '../../tests/fixtures/stage2-reference.json';
import {createHash} from 'node:crypto';

describe('EX2 safety, equivalence and configuration contracts',()=>{
  it.each([['B-RGB',rgbExperiment],['B-NPN',npnExperiment],['B-RC',rcExperiment],['B-PIEZO',piezoExperiment],['B-MAX',maxExperiment]] as const)('fixed physical fixture and canonical SHA256 remain reproducible: %s',(name,make)=>{const fixture=reference.fixtures[name];expect(parseDocument(fixture.document)).toEqual(make());expect(createHash('sha256').update(JSON.stringify(fixture.document)).digest('hex')).toBe(fixture.sha256);});
  it('review regression: grounded NPN base does not mistake independent LEDs for a semiconductor driver',()=>{
    const d=circuitFixture([{id:'t',kind:'npn',nets:['N','C','N']},{id:'rc',kind:'resistor',nets:['P','C'],settings:{resistance:1000}},{id:'led',kind:'led',nets:['A','N']},{id:'rl',kind:'resistor',nets:['P','A'],settings:{resistance:330}}]);
    const a=analyzeCircuit(d);expect(a.status).toBe('supported');expect(a.readings!.t).toMatchObject({region:'cutoff',collectorCurrentMa:0,vceV:4.5});expect(a.readings!.led!.currentMa).toBeCloseTo(7.575757576,6);
  });
  it('review regression: unique different-drop shared RGB keeps readings but explains mixing limits',()=>{
    const d=circuitFixture([{id:'u',kind:'rgb-led',nets:['X','N','X','unused']},{id:'r',kind:'resistor',nets:['P','X'],settings:{resistance:330}}]);
    const a=analyzeCircuit(d);expect(a.status).toBe('supported');expect(a.readings!.u!.channels!.R.currentMa).toBeCloseTo(7.575757576,6);expect(a.notes?.join()).toContain('不能保证预期混色');expect(analyzeCircuit(rgbExperiment()).notes).toBeUndefined();
  });
  it('review regression: piezo permits open stubs but rejects a closed loop attached at one node',()=>{
    for(const closed of [false,true]){const d=circuitFixture([{id:'p',kind:'piezo-passive',nets:['P','N']},{id:'r1',kind:'resistor',nets:['P','X']},{id:'r2',kind:'resistor',nets:['X','Y']},{id:'r3',kind:'resistor',nets:['Y',closed?'P':'Z']}]);d.sourceMode='teaching-square';expect(analyzeCircuit(d).status).toBe(closed?'unsupported':'supported');}
  });
  it('review regression: independent cathode resistors are not falsely described as a shared RGB limit',()=>{
    const d=circuitFixture([{id:'u1',kind:'rgb-led',nets:['P','K1','g1','b1']},{id:'u2',kind:'rgb-led',nets:['r2','K2','P','b2']},{id:'r1',kind:'resistor',nets:['K1','N'],settings:{resistance:330}},{id:'r2',kind:'resistor',nets:['K2','N'],settings:{resistance:330}}]);const a=analyzeCircuit(d);expect(a.status).toBe('supported');expect(a.notes).toBeUndefined();expect(a.readings!.u1!.channels!.R.currentMa).toBeCloseTo(7.575757576,6);expect(a.readings!.u2!.channels!.G.currentMa).toBeCloseTo(4.545454545,6);
  });
  it('review regression: opening the drive cannot hide an unsupported closed side loop',()=>{
    const d=circuitFixture([{id:'p',kind:'piezo-passive',nets:['OFF','N']},{id:'r1',kind:'resistor',nets:['P','X']},{id:'r2',kind:'resistor',nets:['X','Y']},{id:'r3',kind:'resistor',nets:['Y','P']}]);d.sourceMode='teaching-square';expect(analyzeCircuit(d).status).toBe('unsupported');
  });
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
  it('EX2-10 v1/v2/v3 migrate source defaults and preserve appropriate voltage',()=>{for(const version of [1,2,3]){const old={...rgbExperiment(),components:[],wires:[],schemaVersion:version,lessonId:version===1?'led-series-v1':'dc-lab-v2',supplyVoltage:9};const d=readCircuitDocument(old);expect(d).toMatchObject({schemaVersion:5,modelProfileId:'legacy-stage2-v1',supplyVoltage:version===3?9:4.5,sourceMode:'battery',signalFrequencyHz:500});}});
  it.each([0,9e-6,1001e-6,NaN,Infinity])('rejects malformed capacitor configuration %s',capacitanceF=>{const d=rcExperiment();d.components.find(p=>p.id==='cap')!.capacitanceF=capacitanceF;expect(readCircuitDocument(d)).toBeNull();});
  it.each([0,2000,NaN,Infinity])('rejects unsupported persisted frequency %s',frequency=>{expect(readCircuitDocument({...piezoExperiment(),signalFrequencyHz:frequency})).toBeNull();});
  it('budget excess is retained as configuration but refused before analysis',()=>{const d=circuitFixture([1,2,3].map(i=>({id:`rgb${i}`,kind:'rgb-led',nets:[`R${i}`,'N',`G${i}`,`B${i}`]})));expect(parseDocument(d)).not.toBeNull();expect(analyzeCircuit(d).status).toBe('unsupported');expect(matrixBudget(128)).toBe(true);expect(matrixBudget(129)).toBe(false);expect(applyEdit(piezoExperiment(),{type:'set-frequency',value:2000 as 500}).ok).toBe(false);});
  it('synthetic compiler matrix boundary accepts 128 unknowns and rejects 129 before allocation',()=>{
    const chain=(n:number)=>Array.from({length:n+1},(_,i)=>({id:`r${i}`,part:`r${i}`,from:i===0?'P':`n${i}`,to:i===n?'N':`n${i+1}`,resistance:1000,drop:0,polar:false}));
    const good=solveBounded(chain(128),'P','N',4.5);expect(good.ok).toBe(true);if(good.ok){expect(good.solution.unknowns).toBe(128);expect(good.solution.currents.get('r0')).toBeCloseTo(4.5/129000,12);}
    expect(solveBounded(chain(129),'P','N',4.5)).toMatchObject({ok:false,reason:expect.stringContaining('128')});
  });
  it('unrelated floating resistor islands do not introduce fictitious RC leakage',()=>{
    const d=circuitFixture([{id:'c',kind:'capacitor',nets:['X','N']},{id:'r',kind:'resistor',nets:['X','Y']},{id:'island',kind:'resistor',nets:['Z','Q']}]);const a=analyzeCircuit(d,{timeState:{timeS:1,voltageV:3},deltaTimeS:1});expect(a.readings!.c).toMatchObject({voltageV:3,currentMa:0,capacitorState:'保持'});
  });
  it('fixed document and expanded P/T negatives reject without discarding editable configurations',()=>{
    const over=overExperiment();expect(over.components).toHaveLength(25);expect(validateDocument({...over,components:over.components.filter(p=>p.id!=='d4b')})).toBeNull();expect(analyzeCircuit(over).status).toBe('unsupported');expect(analyzeCircuit(over).readings).toBeUndefined();
    for(const [name,d] of [['B-OVER',over],['P-OVER',overPolarExperiment()]] as const){
      // Preserve the original version-4 benchmark bytes while new documents write v5.
      const legacyDocument=JSON.parse(JSON.stringify({...d,schemaVersion:4,modelProfileId:undefined}));
      expect(reference.fixtures[name].document).toEqual(legacyDocument);
      expect(createHash('sha256').update(JSON.stringify(legacyDocument)).digest('hex')).toBe(reference.fixtures[name].sha256);
    }
    const p=overPolarExperiment();expect(p.components).toHaveLength(23);expect(validateDocument(p)).toBeNull();expect(parseDocument(p)).not.toBeNull();const compiled=compileNetwork(p);expect(compiled.branches.filter(b=>b.polar)).toHaveLength(9);expect(compiled.transistors).toHaveLength(2);expect(analyzeCircuit(p)).toMatchObject({status:'unsupported',diagnostics:[expect.objectContaining({code:'unsupported',reason:expect.stringContaining('预算')})]});
    const t=circuitFixture([1,2,3].flatMap(i=>[{id:`t${i}`,kind:'npn' as const,nets:[`b${i}`,`c${i}`,'N']},{id:`rb${i}`,kind:'resistor' as const,nets:['P',`b${i}`]},{id:`rc${i}`,kind:'resistor' as const,nets:['P',`c${i}`]}]));expect(validateDocument(t)).toBeNull();expect(analyzeCircuit(t).status).toBe('unsupported');
  });
  it('120 physically distinct wire endpoints are accepted; wire 121 is atomically rejected',()=>{
    const wire=(i:number)=>({id:`boundary-${i}`,from:HOLES[i*2]!.id,to:HOLES[i*2+1]!.id,color:'#123456',bend:'horizontal' as const});const d={...rcExperiment(),components:[],wires:Array.from({length:120},(_,i)=>wire(i))};expect(validateDocument(d)).toBeNull();const result=applyEdit(d,{type:'wire',wire:wire(120)});expect(result.ok).toBe(false);expect(d.wires).toHaveLength(120);expect(new Set(d.wires.flatMap(w=>[w.from,w.to])).size).toBe(240);
  });
});
