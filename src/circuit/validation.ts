import { COMPONENTS } from './catalog';
import { getComponentPins, ENDPOINT_BY_ID } from './board';
import { MAX_COMPONENTS, MAX_POLAR_COMPONENTS, MAX_WIRES } from './types';
import { DEFAULT_SUPPLY_VOLTAGE, isResistance, isSupplyVoltage } from './parameters';
import type { CircuitDocument, ComponentInstance, Wire } from './types';
const record = (value: unknown): value is Record<string, unknown> => typeof value==='object'&&value!==null&&!Array.isArray(value);
const percentage = (value: unknown) => typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=100;
export function validComponent(value: unknown): value is ComponentInstance {
  if(!record(value)||typeof value.id!=='string'||!value.id.trim()||typeof value.kind!=='string'||!Object.hasOwn(COMPONENTS,value.kind)||typeof value.anchor!=='string'||![0,90,180,270].includes(value.rotation as number))return false;
  if(value.resistance!==undefined&&(!['resistor','potentiometer'].includes(value.kind)||!isResistance(value.resistance)))return false;
  if(value.closed!==undefined&&(value.kind!=='switch'||typeof value.closed!=='boolean'))return false;
  if(value.position!==undefined&&(value.kind!=='potentiometer'||!percentage(value.position)))return false;
  if(value.light!==undefined&&(value.kind!=='ldr'||!percentage(value.light)))return false;
  if(value.kind==='capacitor' ? !(typeof value.capacitanceF==='number'&&Number.isFinite(value.capacitanceF)&&value.capacitanceF>=10e-6&&value.capacitanceF<=1000e-6) : value.capacitanceF!==undefined)return false;
  return getComponentPins(value as ComponentInstance)!==null;
}
export function readCircuitDocument(value: unknown): CircuitDocument | null {
  if(!record(value)||value.boardId!=='breadboard-30-v1'||!Array.isArray(value.components)||!Array.isArray(value.wires))return null;
  const legacy=value.schemaVersion===1&&value.lessonId==='led-series-v1';
  const previous=value.schemaVersion===2&&value.lessonId==='dc-lab-v2';
  const v3=value.schemaVersion===3&&value.lessonId==='dc-lab-v2';
  const current=value.schemaVersion===4&&value.lessonId==='dc-lab-v2';
  if(!legacy&&!previous&&!v3&&!current)return null;
  if((current||v3)&&!isSupplyVoltage(value.supplyVoltage))return null;
  if(current&&(!['battery','teaching-square'].includes(value.sourceMode as string)||![250,500,1000].includes(value.signalFrequencyHz as number)))return null;
  const supplyVoltage=current||v3?value.supplyVoltage as number:DEFAULT_SUPPLY_VOLTAGE;
  if(value.components.length>MAX_COMPONENTS||value.wires.length>MAX_WIRES)return null;
  const ids=new Set<string>();
  const identity=(id: unknown)=>{if(typeof id!=='string'||!id.trim()||ids.has(id))return false;ids.add(id);return true;};
  const components: ComponentInstance[]=[];
  for(const part of value.components) {
    if(!validComponent(part)||!identity(part.id)||(legacy&&!['resistor','led'].includes(part.kind)))return null;
    if(!current&&['rgb-led','npn','capacitor','piezo-passive'].includes(part.kind))return null;
    components.push({id:part.id,kind:part.kind,anchor:part.anchor,rotation:part.rotation,
      ...(part.resistance===undefined?{}:{resistance:part.resistance}),...(part.closed===undefined?{}:{closed:part.closed}),
      ...(part.position===undefined?{}:{position:part.position}),...(part.light===undefined?{}:{light:part.light}),...(part.capacitanceF===undefined?{}:{capacitanceF:part.capacitanceF})});
  }
  if(!components.some(p=>['rgb-led','npn','capacitor','piezo-passive'].includes(p.kind))&&components.filter(p=>['led','diode','buzzer'].includes(p.kind)).length>MAX_POLAR_COMPONENTS)return null;
  const wires: Wire[]=[];
  for(const wire of value.wires) {
    if(!record(wire)||!identity(wire.id)||typeof wire.from!=='string'||typeof wire.to!=='string'||!ENDPOINT_BY_ID.has(wire.from)||!ENDPOINT_BY_ID.has(wire.to)||wire.from===wire.to||typeof wire.color!=='string'||!/^#[0-9a-f]{6}$/i.test(wire.color)||(wire.bend!=='horizontal'&&wire.bend!=='vertical'))return null;
    wires.push({id:wire.id as string,from:wire.from,to:wire.to,color:wire.color,bend:wire.bend});
  }
  return {schemaVersion:4,boardId:'breadboard-30-v1',lessonId:'dc-lab-v2',supplyVoltage,sourceMode:current?value.sourceMode as 'battery'|'teaching-square':'battery',signalFrequencyHz:current?value.signalFrequencyHz as 250|500|1000:500,components,wires};
}
