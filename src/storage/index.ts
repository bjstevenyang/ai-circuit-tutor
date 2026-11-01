import { createEmptyDocument } from '../circuit';
import type { CircuitDocument } from '../circuit';
import { readCircuitDocument } from '../circuit/validation';
import { validateDocument } from '../editor/model';

export const STORAGE_KEY = 'ai-circuit-tutor.workspace.v1';
export type WorkspaceStorage = Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = { status: 'empty' | 'loaded'; document: CircuitDocument } | { status: 'error'; message: string };
type SaveResult = { ok: true } | { ok: false; message: string };

export function parseDocument(value: unknown): CircuitDocument | null {
  const document = readCircuitDocument(value);
  return document && !validateDocument(document) ? document : null;
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
    const canonical=parseDocument(document);
    if (!canonical) return { ok: false, message: '当前作品未通过数据校验' };
    (storage ?? browserStorage()).setItem(STORAGE_KEY, JSON.stringify(canonical));
    return { ok: true };
  } catch {
    return { ok: false, message: '浏览器存储不可用或空间不足，作品仍保留在当前工作台' };
  }
}
