import { getComponentPins } from './board';
import type { CircuitDocument, CurveControl } from './types';

export const CURVE_BOUNDS={minX:16,maxX:864,minY:16,maxY:634} as const;
export function isCurveControl(value:unknown):value is CurveControl {
  if(typeof value!=='object'||value===null)return false;
  const point=value as Record<string,unknown>;
  return typeof point.x==='number'&&Number.isFinite(point.x)&&point.x>=CURVE_BOUNDS.minX&&point.x<=CURVE_BOUNDS.maxX&&
    typeof point.y==='number'&&Number.isFinite(point.y)&&point.y>=CURVE_BOUNDS.minY&&point.y<=CURVE_BOUNDS.maxY;
}
export function isWireShape(value:{bend:unknown;curveControl?:unknown},allowCurve=true):boolean {
  return value.bend==='curve'?allowCurve&&isCurveControl(value.curveControl):
    (value.bend==='horizontal'||value.bend==='vertical')&&value.curveControl===undefined;
}
export function endpointOccupancy(document:Pick<CircuitDocument,'components'|'wires'>) {
  return {
    pins:new Set(document.components.flatMap(part=>getComponentPins(part)??[])),
    wires:new Set(document.wires.flatMap(wire=>[wire.from,wire.to])),
  };
}
