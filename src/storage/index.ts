import { createEmptyDocument } from '../circuit';
import type { CircuitDocument, ComponentInstance, Wire } from '../circuit';
import { validateDocument } from '../editor/model';

export const STORAGE_KEY = 'ai-circuit-tutor.workspace.v1';
export type WorkspaceStorage = Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = { status: 'empty' | 'loaded'; document: CircuitDocument } | { status: 'error'; message: string };
type SaveResult = { ok: true } | { ok: false; message: string };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function parseComponent(value: unknown): ComponentInstance | null {
  if (!record(value) || typeof value.id !== 'string' || typeof value.anchor !== 'string' || (value.kind !== 'resistor' && value.kind !== 'led') || (value.rotation !== 0 && value.rotation !== 90 && value.rotation !== 180 && value.rotation !== 270)) return null;
  if (value.kind === 'led') return value.resistance === undefined ? { id: value.id, kind: value.kind, anchor: value.anchor, rotation: value.rotation } : null;
  if (value.resistance !== undefined && value.resistance !== 100 && value.resistance !== 330 && value.resistance !== 1000) return null;
  return { id: value.id, kind: value.kind, anchor: value.anchor, rotation: value.rotation, ...(value.resistance === undefined ? {} : { resistance: value.resistance }) };
}
function parseWire(value: unknown): Wire | null {
  if (!record(value) || typeof value.id !== 'string' || typeof value.from !== 'string' || typeof value.to !== 'string' || typeof value.color !== 'string' || (value.bend !== 'horizontal' && value.bend !== 'vertical')) return null;
  return { id: value.id, from: value.from, to: value.to, color: value.color, bend: value.bend };
}
export function parseDocument(value: unknown): CircuitDocument | null {
  if (!record(value) || value.schemaVersion !== 1 || value.boardId !== 'breadboard-30-v1' || value.lessonId !== 'led-series-v1' || !Array.isArray(value.components) || !Array.isArray(value.wires)) return null;
  const components = value.components.map(parseComponent);
  const wires = value.wires.map(parseWire);
  if (components.some(component => component === null) || wires.some(wire => wire === null)) return null;
  const document: CircuitDocument = { schemaVersion: 1, boardId: 'breadboard-30-v1', lessonId: 'led-series-v1', components: components as ComponentInstance[], wires: wires as Wire[] };
  return validateDocument(document) ? null : document;
}
function browserStorage() { return window.localStorage; }
export function loadWorkspace(storage?: WorkspaceStorage): LoadResult {
  try {
    const raw = (storage ?? browserStorage()).getItem(STORAGE_KEY);
    if (raw === null) return { status: 'empty', document: createEmptyDocument() };
    const document = parseDocument(JSON.parse(raw) as unknown);
    return document ? { status: 'loaded', document } : { status: 'error', message: '存档格式、版本或孔位数据无效，原始存档已保留' };
  } catch {
    return { status: 'error', message: '无法读取本地存档，原始内容未被覆盖' };
  }
}
export function saveWorkspace(document: CircuitDocument, storage?: WorkspaceStorage): SaveResult {
  try {
    if (!parseDocument(document)) return { ok: false, message: '当前作品未通过数据校验' };
    (storage ?? browserStorage()).setItem(STORAGE_KEY, JSON.stringify(document));
    return { ok: true };
  } catch {
    return { ok: false, message: '浏览器存储不可用或空间不足，作品仍保留在当前工作台' };
  }
}
