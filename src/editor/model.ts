import { createEmptyDocument, ENDPOINT_BY_ID, getComponentPins } from '../circuit';
import type { CircuitDocument, ComponentInstance, Rotation, Wire } from '../circuit';

export type EditCommand =
  | { type: 'place'; component: ComponentInstance }
  | { type: 'move'; id: string; anchor: string; rotation: Rotation }
  | { type: 'remove'; id: string }
  | { type: 'wire'; wire: Wire }
  | { type: 'update-wire'; id: string; color?: string; bend?: Wire['bend'] }
  | { type: 'resistance'; id: string; value: 100 | 330 | 1000 }
  | { type: 'reset' };

export type EditResult = { ok: true; document: CircuitDocument } | { ok: false; error: string };
export type Bounds = { x: number; y: number; width: number; height: number };

export function componentBounds(component: ComponentInstance): Bounds | null {
  const pins = getComponentPins(component);
  if (!pins) return null;
  const a = ENDPOINT_BY_ID.get(pins[0]);
  const b = ENDPOINT_BY_ID.get(pins[1]);
  if (!a || !b) return null;
  const horizontal = component.rotation === 0 || component.rotation === 180;
  const width = component.kind === 'led' ? 20 : horizontal ? 38 : 16;
  const height = component.kind === 'led' ? 20 : horizontal ? 16 : 38;
  return { x: (a.x + b.x - width) / 2, y: (a.y + b.y - height) / 2, width, height };
}

function overlaps(a: Bounds, b: Bounds) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Physical constraints are independent of electrical correctness. */
export function validateDocument(document: CircuitDocument): string | null {
  const identities = new Set<string>();
  const occupied = new Set<string>();
  const kinds = new Set<string>();
  const bounds: Bounds[] = [];
  const reserveId = (id: string) => {
    if (!id.trim() || identities.has(id)) return false;
    identities.add(id); return true;
  };
  for (const component of document.components) {
    if (!reserveId(component.id)) return '对象标识重复或为空。';
    if (kinds.has(component.kind)) return '本课程每种元件只能放置一个。';
    kinds.add(component.kind);
    if (!/^[a-j](?:[1-9]|[12]\d|30)$/.test(component.anchor)) return '元件锚点必须是 a1–j30 的中间孔位。';
    if (![0, 90, 180, 270].includes(component.rotation)) return '请选择一个有效的安装方向。';
    if (component.kind === 'resistor' && component.resistance !== undefined && ![100, 330, 1000].includes(component.resistance)) return '电阻只能选择 100、330 或 1,000 Ω。';
    const pins = getComponentPins(component);
    const body = componentBounds(component);
    if (!pins || !body || pins.some(pin => !/^[a-j](?:[1-9]|[12]\d|30)$/.test(pin))) return '引脚超出可安装孔位，请更换锚点或方向。';
    if (pins.some(pin => occupied.has(pin))) return '孔位已被占用，请使用同组的其他空孔。';
    if (bounds.some(other => overlaps(body, other))) return '元件本体发生重叠，请换一个位置。';
    pins.forEach(pin => occupied.add(pin));
    bounds.push(body);
  }
  for (const wire of document.wires) {
    if (!reserveId(wire.id)) return '对象标识重复或为空。';
    if (!ENDPOINT_BY_ID.has(wire.from) || !ENDPOINT_BY_ID.has(wire.to)) return '找不到导线端点，请检查孔位或电池端口名称。';
    if (wire.from === wire.to) return '导线需要两个不同的端点。';
    if (occupied.has(wire.from) || occupied.has(wire.to)) return '孔位或电池端口已被占用，请选择其他空孔。';
    if (!/^#[0-9a-fA-F]{6}$/.test(wire.color)) return '请选择有效的导线颜色。';
    if (wire.bend !== 'horizontal' && wire.bend !== 'vertical') return '请选择有效的折线路径。';
    occupied.add(wire.from); occupied.add(wire.to);
  }
  return null;
}

export function applyEdit(document: CircuitDocument, command: EditCommand): EditResult {
  let next: CircuitDocument;
  switch (command.type) {
    case 'place': next = { ...document, components: [...document.components, { ...command.component }] }; break;
    case 'move': {
      if (!document.components.some(component => component.id === command.id)) return { ok: false, error: '找不到要移动的元件。' };
      next = { ...document, components: document.components.map(component => component.id === command.id ? { ...component, anchor: command.anchor, rotation: command.rotation } : component) };
      break;
    }
    case 'remove': {
      if (![...document.components, ...document.wires].some(item => item.id === command.id)) return { ok: false, error: '找不到要删除的对象。' };
      next = { ...document, components: document.components.filter(component => component.id !== command.id), wires: document.wires.filter(wire => wire.id !== command.id) };
      break;
    }
    case 'wire': next = { ...document, wires: [...document.wires, { ...command.wire }] }; break;
    case 'update-wire': {
      if (!document.wires.some(wire => wire.id === command.id)) return { ok: false, error: '找不到要修改的导线。' };
      next = { ...document, wires: document.wires.map(wire => wire.id === command.id ? { ...wire, ...(command.color === undefined ? {} : { color: command.color }), ...(command.bend === undefined ? {} : { bend: command.bend }) } : wire) };
      break;
    }
    case 'resistance': {
      if (!document.components.some(component => component.id === command.id && component.kind === 'resistor')) return { ok: false, error: '找不到要修改的电阻。' };
      next = { ...document, components: document.components.map(component => component.id === command.id ? { ...component, resistance: command.value } : component) };
      break;
    }
    case 'reset': next = createEmptyDocument(); break;
  }
  const error = validateDocument(next);
  return error ? { ok: false, error } : { ok: true, document: next };
}

export type HistoryState = { document: CircuitDocument; past: CircuitDocument[]; future: CircuitDocument[] };
export function createHistory(document: CircuitDocument): HistoryState { return { document, past: [], future: [] }; }
export function commitDocument(state: HistoryState, document: CircuitDocument): HistoryState {
  if (JSON.stringify(state.document) === JSON.stringify(document)) return state;
  return { document, past: [...state.past, state.document].slice(-50), future: [] };
}
export function undo(state: HistoryState): HistoryState {
  const document = state.past.at(-1);
  return document ? { document, past: state.past.slice(0, -1), future: [state.document, ...state.future] } : state;
}
export function redo(state: HistoryState): HistoryState {
  const document = state.future[0];
  return document ? { document, past: [...state.past, state.document].slice(-50), future: state.future.slice(1) } : state;
}
