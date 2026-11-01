import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../circuit';
import { loadWorkspace, parseDocument, saveWorkspace, STORAGE_KEY } from './index';
import type { WorkspaceStorage } from './index';

function memoryStorage(initial?: string): WorkspaceStorage & { contents: Map<string, string> } {
  const contents = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return { contents, getItem: key => contents.get(key) ?? null, setItem: (key, value) => { contents.set(key, value); } };
}
const populated = () => ({ ...createEmptyDocument(), components: [{ id: 'r1', kind: 'resistor' as const, anchor: 'a10', rotation: 0 as const, resistance: 330 as const }], wires: [{ id: 'w1', from: 'battery:+', to: 'b10', color: '#b45b49', bend: 'horizontal' as const }] });

describe('single local workspace', () => {
  it('starts empty and round-trips the complete canonical document', () => {
    const storage = memoryStorage();
    expect(loadWorkspace(storage)).toEqual({ status: 'empty', document: createEmptyDocument() });
    expect(saveWorkspace(populated(), storage)).toEqual({ ok: true });
    expect(loadWorkspace(storage)).toEqual({ status: 'loaded', document: populated() });
  });
  it('preserves malformed and unknown-version saves without writing during load', () => {
    for (const raw of ['{broken', JSON.stringify({ ...populated(), schemaVersion: 99 }), 'null', '[]']) {
      const storage = memoryStorage(raw);
      expect(loadWorkspace(storage).status).toBe('error');
      expect(storage.contents.get(STORAGE_KEY)).toBe(raw);
    }
  });
  it('rejects dangling references, impossible placement, conflicting occupancy, and unsupported parts', () => {
    const cases: unknown[] = [
      { ...populated(), wires: [{ ...populated().wires[0], to: 'a31' }] },
      { ...populated(), wires: [{ ...populated().wires[0], to: 'a10' }] },
      { ...populated(), components: [{ ...populated().components[0], anchor: 'a30' }] },
      { ...populated(), components: [{ ...populated().components[0], kind: 'capacitor' }] },
      { ...populated(), components: [{ ...populated().components[0], resistance: -1 }] },
      { ...populated(), components: [{ ...populated().components[0], rotation: 45 }] },
      { ...populated(), components: [null] },
      { ...populated(), wires: [{ ...populated().wires[0], color: 'url(javascript:bad)' }] },
      { ...populated(), boardId: 'unrecognized-board' },
      { ...populated(), lessonId: 'unrecognized-lesson' },
    ];
    for (const value of cases) expect(parseDocument(value)).toBeNull();
  });
  it('reports read and write failures while preserving previously saved content', () => {
    const raw = JSON.stringify(populated());
    const storage = memoryStorage(raw);
    storage.setItem = () => { throw new Error('quota exceeded'); };
    expect(saveWorkspace(createEmptyDocument(), storage)).toEqual({ ok: false, message: expect.stringContaining('当前工作台') });
    expect(storage.contents.get(STORAGE_KEY)).toBe(raw);
    storage.getItem = () => { throw new Error('storage denied'); };
    expect(loadWorkspace(storage).status).toBe('error');
  });
  it('does not replace valid storage with an invalid in-memory document', () => {
    const raw = JSON.stringify(populated());
    const storage = memoryStorage(raw);
    const invalid = { ...populated(), wires: [{ ...populated().wires[0]!, to: 'does-not-exist' }] };
    expect(saveWorkspace(invalid, storage).ok).toBe(false);
    expect(storage.contents.get(STORAGE_KEY)).toBe(raw);
  });
  it('handles absence of browser globals as a visible storage error', () => {
    expect(loadWorkspace().status).toBe('error');
    expect(saveWorkspace(populated()).ok).toBe(false);
  });
});

describe('version 2 component workspace compatibility', () => {
  it('migrates a v1 save in memory without changing its IDs, positions or wires', () => {
    const current=populated();
    const legacy={...current,schemaVersion:1,lessonId:'led-series-v1'};
    const raw=JSON.stringify(legacy),storage=memoryStorage(raw);
    const restored=loadWorkspace(storage);
    expect(restored).toEqual({status:'loaded',document:current});
    expect(storage.contents.get(STORAGE_KEY)).toBe(raw);
    expect(saveWorkspace(current,storage).ok).toBe(true);
    expect(JSON.parse(storage.contents.get(STORAGE_KEY)!).schemaVersion).toBe(2);
  });
  it('round-trips all eight kinds and strips transient/unrecognized fields', async () => {
    const { createComponent }=await import('../circuit');
    const kinds=['resistor','led','switch','button','potentiometer','buzzer','diode','ldr'] as const;
    const anchors=['a1','a6','a10','e26','a15','a20','f1','f6'];
    const document={...createEmptyDocument(),components:kinds.map((kind,i)=>createComponent(kind,anchors[i]!,0,`p${i}`))};
    document.components[2]!.closed=true;
    document.components[4]!.position=17;
    document.components[7]!.light=88;
    const storage=memoryStorage(JSON.stringify({...document,pressedButtons:['p3'],analysis:{complete:true}}));
    expect(loadWorkspace(storage)).toEqual({status:'loaded',document});
    expect(saveWorkspace(document,storage).ok).toBe(true);
    expect(JSON.parse(storage.contents.get(STORAGE_KEY)!)).toEqual(document);
  });
  it.each([
    {kind:'potentiometer',position:-1},{kind:'potentiometer',position:0.5},
    {kind:'ldr',light:101},{kind:'switch',closed:'true'},
    {kind:'resistor',resistance:0},{kind:'resistor',resistance:1000001},
    {kind:'led',position:50},
  ])('rejects invalid new component settings %j', settings=>{
    const value={...createEmptyDocument(),components:[{id:'bad',anchor:'a10',rotation:0,...settings}]};
    expect(parseDocument(value)).toBeNull();
  });
});
