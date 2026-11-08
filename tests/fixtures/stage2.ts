import { COMPONENTS, createComponent, createEmptyDocument, getComponentPins, HOLES, ENDPOINT_BY_ID } from '../../src/circuit';
import type { CircuitDocument, ComponentInstance, ComponentKind } from '../../src/circuit';
import { validateDocument } from '../../src/editor/model';

export type PartSpec={id:string;kind:ComponentKind;nets:string[];settings?:Partial<ComponentInstance>};
/** Fixture layout is independent of the solver. Wires always use spare group holes. */
export function circuitFixture(specs:PartSpec[]):CircuitDocument {
  let d=createEmptyDocument();const groups=new Set<string>();const terminals=new Map<string,string[]>([['P',['battery:+']],['N',['battery:-']]]);
  for(const spec of [...specs].sort((a,b)=>COMPONENTS[b.kind].offsets.length-COMPONENTS[a.kind].offsets.length)){
    let chosen:ComponentInstance|null=null;
    for(const row of ['a','e','f','j','c','h','b','d','g','i'])for(let n=1;n<=30&&!chosen;n++){
      const p={...createComponent(spec.kind,`${row}${n}`,0,spec.id),...spec.settings},pins=getComponentPins(p);
      if(!pins||pins.some(pin=>groups.has(ENDPOINT_BY_ID.get(pin)!.group)))continue;
      if(new Set(pins.map(pin=>ENDPOINT_BY_ID.get(pin)!.group)).size!==pins.length)continue;
      if(!validateDocument({...d,components:[...d.components,p]}))chosen=p;
    }
    if(!chosen)throw new Error(`Cannot physically place fixture ${spec.id}`);
    const pins=getComponentPins(chosen)!;pins.forEach((pin,i)=>{groups.add(ENDPOINT_BY_ID.get(pin)!.group);const key=spec.nets[i]!;terminals.set(key,[...(terminals.get(key)??[]),pin]);});
    d={...d,components:[...d.components,chosen]};
  }
  const used=new Set(d.components.flatMap(p=>getComponentPins(p)!));
  const spare=(pin:string)=>{if(pin.startsWith('battery:')){if(used.has(pin))throw new Error('Source port reused');used.add(pin);return pin;}
    const group=ENDPOINT_BY_ID.get(pin)!.group,h=HOLES.find(h=>h.group===group&&!used.has(h.id));if(!h)throw new Error('No spare hole');used.add(h.id);return h.id;};
  for(const pins of terminals.values())for(let i=1;i<pins.length;i++)d.wires.push({id:`w${d.wires.length}`,from:spare(pins[i-1]!),to:spare(pins[i]!),color:'#b45b49',bend:'horizontal'});
  const error=validateDocument(d);if(error)throw new Error(error);return d;
}
const r=(id:string,resistance:number,a:string,b:string):PartSpec=>({id,kind:'resistor',nets:[a,b],settings:{resistance}});
export function rgbExperiment():CircuitDocument{return circuitFixture([
  {id:'rgb',kind:'rgb-led',nets:['R','N','G','B']},
  ...(['R','G','B'] as const).flatMap(ch=>[{id:`s${ch}`,kind:'switch' as const,nets:['P',`s${ch}`],settings:{closed:true}},r(`r${ch}`,330,`s${ch}`,ch)]),
]);}
export function npnExperiment(rb=10000,closed=true):CircuitDocument{return circuitFixture([
  {id:'npn',kind:'npn',nets:['B','C','N']},{id:'led',kind:'led',nets:['A','C']},r('load',330,'P','A'),
  r('rb',rb,'S','B'),r('down',100000,'B','N'),r('ref',100000,'P','C'),{id:'s',kind:'switch',nets:['P','S'],settings:{closed}},
]);}
export function rcExperiment():CircuitDocument{return circuitFixture([
  {id:'cap',kind:'capacitor',nets:['X','N']},r('charge',10000,'SC','X'),r('discharge',10000,'X','SD'),
  {id:'sc',kind:'switch',nets:['P','SC'],settings:{closed:true}},{id:'sd',kind:'switch',nets:['SD','N'],settings:{closed:false}},
]);}
export function piezoExperiment(extraResistance=0):CircuitDocument{const d=circuitFixture([
  {id:'piezo',kind:'piezo-passive',nets:['X','N']},{id:'s',kind:'switch',nets:['P',extraResistance?'S':'X'],settings:{closed:true}},
  ...(extraResistance?[r('series',extraResistance,'S','X')]:[]),
]);return {...d,sourceMode:'teaching-square',signalFrequencyHz:500};}
export function maxExperiment():CircuitDocument {
  const specs:PartSpec[]=[];
  for(let i=1;i<=2;i++){
    specs.push({id:`u${i}`,kind:'rgb-led',nets:[`r${i}`,'N',`g${i}`,`b${i}`]},r(`ur${i}`,330,'P',`r${i}`),r(`ug${i}`,330,'P',`g${i}`),r(`ub${i}`,330,'P',`b${i}`));
    specs.push({id:`t${i}`,kind:'npn',nets:[`base${i}`,`collector${i}`,'N']},r(`baseR${i}`,10000,'P',`base${i}`),r(`down${i}`,100000,`base${i}`,'N'),r(`collectorR${i}`,1000,'P',`collector${i}`));
  }
  for(let i=1;i<=4;i++)specs.push(r(`d${i}a`,1000,'P',`z${i}`),r(`d${i}b`,1000,`z${i}`,'N'));
  return circuitFixture(specs);
}
/** Deliberately over the document budget; new 1 kΩ branch is physically clear at j27–j30. */
export function overExperiment():CircuitDocument {
  const d=maxExperiment();d.components.push({...createComponent('resistor','j27',0,'over'),resistance:1000});
  d.wires.push({id:'overP',from:'top+:1',to:'i27',color:'#b45b49',bend:'horizontal'},{id:'overP-link',from:'top+:2',to:'d15',color:'#b45b49',bend:'horizontal'},{id:'overN',from:'h30',to:'d2',color:'#315f83',bend:'horizontal'});return d;
}
/** Fixed 23-part P=9/T=2 preflight negative; U3 shares U1's R/K/G/B nets through unused row-e holes. */
export function overPolarExperiment():CircuitDocument {
  const d=maxExperiment();d.components=d.components.filter(p=>!['d4a','d4b'].includes(p.id));d.components.push(createComponent('rgb-led','e1',0,'u3'));return d;
}
