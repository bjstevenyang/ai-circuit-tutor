import { ENDPOINTS, ENDPOINT_BY_ID, getComponentPins } from './board';
import type { CircuitDocument, SimulationControls } from './types';

export function buildNets(document: CircuitDocument, controls: SimulationControls = {}): Map<string,string> {
  const parents = new Map(ENDPOINTS.map(h=>[h.id,h.id]));
  const find = (id: string): string => { const parent=parents.get(id); if (!parent || parent===id) return id; const root=find(parent);parents.set(id,root);return root; };
  const join = (a: string,b: string) => { if(parents.has(a)&&parents.has(b)) parents.set(find(b),find(a)); };
  const groups=new Map<string,string>();
  for(const h of ENDPOINTS) {const first=groups.get(h.group);if(first)join(first,h.id);else groups.set(h.group,h.id);}
  for(const wire of document.wires) join(wire.from,wire.to);
  for(const part of document.components) {
    const pins=getComponentPins(part);if(!pins)continue;
    if(part.kind==='switch'&&part.closed) join(pins[0],pins[1]);
    if(part.kind==='button') {join(pins[0],pins[1]);join(pins[2]!,pins[3]!);if(controls.pressedButtons?.includes(part.id))join(pins[0],pins[2]!);}
    if(part.kind==='potentiometer') {if((part.position??50)===0)join(pins[0],pins[1]);if(part.position===100)join(pins[1],pins[2]!);}
  }
  return new Map(ENDPOINTS.map(h=>[h.id,find(h.id)]));
}
export function inspectConnectivity(document: CircuitDocument, endpoint: string, controls: SimulationControls = {}): string[] {
  if(!ENDPOINT_BY_ID.has(endpoint))return [];
  const nets=buildNets(document,controls);
  return ENDPOINTS.filter(h=>nets.get(h.id)===nets.get(endpoint)).map(h=>h.id);
}
