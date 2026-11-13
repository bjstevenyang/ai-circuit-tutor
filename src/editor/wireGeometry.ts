import { ENDPOINT_BY_ID } from '../circuit/board';
import { CURVE_BOUNDS } from '../circuit/wires';
import type { CurveControl, Wire } from '../circuit/types';

export type WireStyle=Pick<Wire,'bend'|'curveControl'>;
export function clampCurveControl(point:CurveControl):CurveControl {
  return {x:Math.max(CURVE_BOUNDS.minX,Math.min(CURVE_BOUNDS.maxX,point.x)),
    y:Math.max(CURVE_BOUNDS.minY,Math.min(CURVE_BOUNDS.maxY,point.y))};
}
export function defaultCurveControl(a:CurveControl,b:CurveControl):CurveControl {
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  return clampCurveControl({x:(a.x+b.x)/2-48*dy/length,y:(a.y+b.y)/2+48*dx/length});
}
/** New shapes only; persisted curves must pass strict validation without defaults. */
export function newWireShape(from:string,to:string,bend:Wire['bend']):WireStyle {
  const a=ENDPOINT_BY_ID.get(from),b=ENDPOINT_BY_ID.get(to);
  return bend==='curve'&&a&&b?{bend,curveControl:defaultCurveControl(a,b)}:{bend};
}
