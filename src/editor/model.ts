import { createEmptyDocument, ENDPOINT_BY_ID, getComponentPins, componentBody, MAX_COMPONENTS, MAX_POLAR_COMPONENTS, MAX_WIRES } from '../circuit';
import { validComponent } from '../circuit/validation';
import { isCapacitanceForProfile, isKnownModelProfile, isSupplyVoltage, profileOf } from '../circuit/parameters';
import type { CircuitDocument, ComponentInstance, Rotation, RunnableModelProfileId, Wire } from '../circuit';

export type WireEnd = 'from' | 'to';
export type EditCommand =
  | { type: 'place'; component: ComponentInstance }
  | { type: 'move'; id: string; anchor: string; rotation: Rotation }
  | { type: 'remove'; id: string }
  | { type: 'wire'; wire: Wire }
  | { type: 'update-wire'; id: string; color?: string; bend?: Wire['bend'] }
  | { type: 'reconnect-wire'; id: string; endpoint: WireEnd; to: string }
  | { type: 'resistance'; id: string; value: 100 | 330 | 1000 }
  | { type: 'configure'; id: string; settings: Pick<ComponentInstance, 'resistance' | 'closed' | 'position' | 'light' | 'capacitanceF' | 'transistorModel'> }
  | { type: 'set-source'; mode: 'battery'|'teaching-square' }
  | { type: 'set-profile'; profile: RunnableModelProfileId }
  | { type: 'set-frequency'; value: 250|500|1000 }
  | { type: 'set-voltage'; value: number }
  | { type: 'reset' };

export type EditResult = { ok: true; document: CircuitDocument } | { ok: false; error: string };
export type Bounds = { x: number; y: number; width: number; height: number };

export function componentBounds(component: ComponentInstance): Bounds | null {
  const body = componentBody(component);
  if (!body) return null;
  const horizontal = component.rotation === 0 || component.rotation === 180;
  const width = horizontal ? body.width : body.height;
  const height = horizontal ? body.height : body.width;
  return { x: body.cx-width/2, y: body.cy-height/2, width, height };
}

function overlaps(a: Bounds, b: Bounds) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Physical constraints are independent of electrical correctness. */
export function validateDocument(document: CircuitDocument): string | null {
  if(document.schemaVersion>=3&&!isSupplyVoltage(document.supplyVoltage))return '电池电压必须是 1.5–9 V 范围内的有限数值。';
  if(document.schemaVersion>=4&&(!['battery','teaching-square'].includes(document.sourceMode??'')||![250,500,1000].includes(document.signalFrequencyHz??0)))return '请选择有效的电源模式和 250／500／1000 Hz 频率。';
  if(document.schemaVersion===5&&!isKnownModelProfile(document.modelProfileId))return '请选择有效的实验模型。';
  if(document.schemaVersion<5&&document.components.some(p=>['pnp','speaker'].includes(p.kind)||p.kind==='capacitor'&&(p.capacitanceF??0)<10e-6))return '旧格式不能包含新模型元件或容量，请先迁移作品。';
  const identities = new Set<string>();
  const occupied = new Set<string>();
  if (document.components.length > MAX_COMPONENTS) return `工作台最多放置 ${MAX_COMPONENTS} 个元件。`;
  if (document.wires.length > MAX_WIRES) return `工作台最多连接 ${MAX_WIRES} 根导线。`;
  if (profileOf(document)==='legacy-stage2-v1'&&!document.components.some(p=>['rgb-led','npn','capacitor','piezo-passive','pnp','speaker'].includes(p.kind))&&document.components.filter(p => ['led','diode','buzzer'].includes(p.kind)).length > MAX_POLAR_COMPONENTS) return `LED、二极管和蜂鸣器合计最多 ${MAX_POLAR_COMPONENTS} 个，以保证仿真响应。`;
  const bounds: Bounds[] = [];
  const reserveId = (id: string) => {
    if (!id.trim() || identities.has(id)) return false;
    identities.add(id); return true;
  };
  for (const component of document.components) {
    if (!reserveId(component.id)) return '对象标识重复或为空。';
    if (!validComponent(component)) return '元件参数或引脚位置无效，请检查锚点、方向与参数。';
    if (!/^[a-j](?:[1-9]|[12]\d|30)$/.test(component.anchor)) return '元件锚点必须是 a1–j30 的中间孔位。';
    if (![0, 90, 180, 270].includes(component.rotation)) return '请选择一个有效的安装方向。';
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
    case 'reconnect-wire': {
      if (!document.wires.some(wire => wire.id === command.id)) return { ok: false, error: '找不到要修改的导线。' };
      next = { ...document, wires: document.wires.map(wire => wire.id === command.id ? { ...wire, [command.endpoint]: command.to } : wire) };
      break;
    }
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
    case 'set-voltage': next={...document,supplyVoltage:command.value};break;
    case 'set-source': next={...document,sourceMode:command.mode};break;
    case 'set-profile': {
      if(command.profile!=='legacy-stage2-v1'&&command.profile!=='oscillator-em-v2')return {ok:false,error:'新实验请选择原实验模型或自激发声·虚拟模型v2。'};
      next={...document,schemaVersion:5,modelProfileId:command.profile};break;
    }
    case 'set-frequency': next={...document,signalFrequencyHz:command.value};break;
    case 'configure': {
      if (!document.components.some(p => p.id === command.id)) return { ok: false, error: '找不到要修改的元件。' };
      next = { ...document, components: document.components.map(p => p.id === command.id ? { ...p, ...command.settings } : p) };
      break;
    }
  }
  const changedCap = command.type === 'place' && command.component.kind === 'capacitor' ? command.component :
    command.type === 'configure' && command.settings.capacitanceF !== undefined ? next.components.find(p => p.id === command.id) : undefined;
  if (changedCap) {
    if (!isCapacitanceForProfile(changedCap.capacitanceF,profileOf(document)))
      return { ok:false, error:'电容值不在当前实验模型的支持范围内，请检查单位。' };
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
