import type { CurveControl } from '../circuit/types';
import type { WireStyle } from './wireGeometry';

/** SVG serialization stays outside the numeric document/placement boundary. */
export function wirePath(a:CurveControl,b:CurveControl,style:WireStyle):string {
  if(style.bend==='curve')return style.curveControl?`M${a.x} ${a.y}Q${style.curveControl.x} ${style.curveControl.y} ${b.x} ${b.y}`:'';
  return style.bend==='horizontal'?`M${a.x} ${a.y}H${b.x}V${b.y}`:`M${a.x} ${a.y}V${b.y}H${b.x}`;
}
