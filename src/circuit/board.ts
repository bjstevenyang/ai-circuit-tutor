import { COMPONENTS, rotateOffset } from './catalog';
import { DEFAULT_SUPPLY_VOLTAGE } from './parameters';
import type { BoardEndpoint, CircuitDocument, ComponentInstance } from './types';

const holes: BoardEndpoint[] = [];
for (let row = 1; row <= 30; row++) {
  for (const [index,column] of [...'abcdefghij'].entries()) holes.push({ id: `${column}${row}`, x: 140+(row-1)*20, y: index<5 ? 170+index*20 : 310+(index-5)*20, group: `${index<5?'upper':'lower'}:${row}` });
  for (const [rail,y] of [['top+',100],['top-',120],['bottom+',440],['bottom-',460]] as const) holes.push({id:`${rail}:${row}`,x:140+(row-1)*20,y,group:rail});
}
export const HOLES: readonly BoardEndpoint[] = holes;
export const HOLE_BY_ID: ReadonlyMap<string,BoardEndpoint> = new Map(HOLES.map(h=>[h.id,h]));
export const ENDPOINTS: readonly BoardEndpoint[] = [...HOLES,{id:'battery:+',x:285,y:565,group:'battery:+'},{id:'battery:-',x:325,y:565,group:'battery:-'}];
export const ENDPOINT_BY_ID: ReadonlyMap<string,BoardEndpoint> = new Map(ENDPOINTS.map(h=>[h.id,h]));
const BY_POSITION = new Map(HOLES.filter(h=>/^[a-j]\d+$/.test(h.id)).map(h=>[`${h.x},${h.y}`,h.id]));
export function createEmptyDocument(): CircuitDocument { return {schemaVersion:5,modelProfileId:'legacy-stage2-v1',boardId:'breadboard-30-v1',lessonId:'dc-lab-v2',supplyVoltage:DEFAULT_SUPPLY_VOLTAGE,sourceMode:'battery',signalFrequencyHz:500,components:[],wires:[]}; }
export function getComponentPins(part: ComponentInstance): [string,string,...string[]] | null {
  const anchor = HOLE_BY_ID.get(part.anchor);
  const definition = COMPONENTS[part.kind];
  if (!anchor || !/^[a-j]\d+$/.test(anchor.id) || !definition || ![0,90,180,270].includes(part.rotation)) return null;
  const pins = definition.offsets.map(([x,y])=>{const [dx,dy]=rotateOffset(x,y,part.rotation);return BY_POSITION.get(`${anchor.x+dx},${anchor.y+dy}`);});
  return pins.every((pin): pin is string => pin !== undefined) ? pins as [string,string,...string[]] : null;
}
export function componentBody(part: ComponentInstance) {
  const anchor = HOLE_BY_ID.get(part.anchor);
  if (!anchor || !getComponentPins(part)) return null;
  const [x,y,width,height] = COMPONENTS[part.kind].body;
  const [dx,dy] = rotateOffset(x,y,part.rotation);
  return { cx: anchor.x+dx, cy: anchor.y+dy, width, height, rotation: part.rotation };
}
