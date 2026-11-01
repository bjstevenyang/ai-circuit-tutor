import { ENDPOINTS, HOLES } from '../circuit';
export type BoardPoint = { x: number; y: number };
const mountingHoles = HOLES.filter(hole => /^[a-j]\d+$/.test(hole.id));

/** Snap only within the mounting grid, never across the center gap or a rail. */
export function snapAnchor(point: BoardPoint): string | null {
  return snap(point,mountingHoles);
}
export function snapEndpoint(point: BoardPoint): string | null {
  return snap(point,ENDPOINTS);
}
function snap(point: BoardPoint, endpoints: readonly {id:string;x:number;y:number}[]): string | null {
  let closest: string | null = null;
  let distance = 14;
  for (const hole of endpoints) {
    const next = Math.hypot(hole.x - point.x, hole.y - point.y);
    if (next < distance) { distance = next; closest = hole.id; }
  }
  return closest;
}
