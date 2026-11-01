import { describe, expect, it } from 'vitest';
import { createEmptyDocument, getComponentPins } from '../circuit';
import type { CircuitDocument, ComponentInstance, Wire } from '../circuit';
import { applyEdit, commitDocument, createHistory, redo, undo } from './model';

const resistor = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({ id: 'r1', kind: 'resistor', anchor: 'a10', rotation: 0, resistance: 330, ...overrides });
const led = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({ id: 'l1', kind: 'led', anchor: 'c13', rotation: 0, ...overrides });
const wire = (overrides: Partial<Wire> = {}): Wire => ({ id: 'w1', from: 'battery:+', to: 'b10', color: '#b45b49', bend: 'horizontal', ...overrides });
function edited(document: CircuitDocument, command: Parameters<typeof applyEdit>[1]) {
  const result = applyEdit(document, command);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

describe('physical placement commands', () => {
  it('places both terminals using the declared footprint and retains the original document', () => {
    const initial = createEmptyDocument();
    const next = edited(initial, { type: 'place', component: resistor() });
    expect(initial.components).toEqual([]);
    expect(getComponentPins(next.components[0]!)).toEqual(['a10', 'a13']);
    const moved = edited(next, { type: 'move', id: 'r1', anchor: 'a20', rotation: 90 });
    expect(getComponentPins(moved.components[0]!)).toEqual(['a20', 'd20']);
    expect(getComponentPins(next.components[0]!)).toEqual(['a10', 'a13']);
  });
  it('rejects off-board placement and rotation atomically', () => {
    const initial = createEmptyDocument();
    expect(applyEdit(initial, { type: 'place', component: resistor({ anchor: 'a30' }) }).ok).toBe(false);
    const placed = edited(initial, { type: 'place', component: resistor({ anchor: 'a1' }) });
    const snapshot = JSON.stringify(placed);
    expect(applyEdit(placed, { type: 'move', id: 'r1', anchor: 'a1', rotation: 180 }).ok).toBe(false);
    expect(JSON.stringify(placed)).toBe(snapshot);
  });
  it('reserves all component and wire insertion points including battery ports', () => {
    const placed = edited(createEmptyDocument(), { type: 'place', component: resistor() });
    expect(applyEdit(placed, { type: 'wire', wire: wire({ to: 'a10' }) }).ok).toBe(false);
    const connected = edited(placed, { type: 'wire', wire: wire() });
    expect(applyEdit(connected, { type: 'wire', wire: wire({ id: 'w2', to: 'c10' }) }).ok).toBe(false);
    expect(applyEdit(connected, { type: 'move', id: 'r1', anchor: 'b10', rotation: 0 }).ok).toBe(false);
    expect(connected.components[0]?.anchor).toBe('a10');
  });
  it('rejects overlapping component bodies while allowing wires to cross a body', () => {
    const placed = edited(createEmptyDocument(), { type: 'place', component: resistor() });
    const overlap = applyEdit(placed, { type: 'place', component: led({ anchor: 'a11' }) });
    expect(overlap).toEqual({ ok: false, error: expect.stringContaining('重叠') });
    expect(applyEdit(placed, { type: 'wire', wire: wire({ from: 'top+:11', to: 'bottom-:11', bend: 'vertical' }) }).ok).toBe(true);
  });
  it('allows electrically wrong but physically legal same-strip LED placement', () => {
    const next = edited(createEmptyDocument(), { type: 'place', component: led({ anchor: 'a20', rotation: 90 }) });
    expect(getComponentPins(next.components[0]!)).toEqual(['a20', 'b20']);
  });
  it('allows multiple instances while requiring unique object identities', () => {
    const placed = edited(createEmptyDocument(), { type: 'place', component: resistor() });
    expect(applyEdit(placed, { type: 'place', component: resistor({ id: 'r2', anchor: 'a20' }) }).ok).toBe(true);
    expect(applyEdit(placed, { type: 'place', component: led({ id: 'r1' }) }).ok).toBe(false);
    expect(applyEdit(placed, { type: 'wire', wire: wire({ id: 'r1' }) }).ok).toBe(false);
  });
  it('deleting a component leaves hole-connected wires intact and frees the pins', () => {
    const connected = edited(edited(createEmptyDocument(), { type: 'place', component: resistor() }), { type: 'wire', wire: wire() });
    const removed = edited(connected, { type: 'remove', id: 'r1' });
    expect(removed.components).toEqual([]);
    expect(removed.wires).toEqual([wire()]);
    expect(applyEdit(removed, { type: 'place', component: resistor() }).ok).toBe(true);
  });
  it('updates only the selected properties and rejects malformed wire edits', () => {
    const document = edited(createEmptyDocument(), { type: 'wire', wire: wire() });
    const next = edited(document, { type: 'update-wire', id: 'w1', color: '#3d7560', bend: 'vertical' });
    expect(next.wires[0]).toEqual({ ...wire(), color: '#3d7560', bend: 'vertical' });
    expect(document.wires[0]).toEqual(wire());
    expect(applyEdit(document, { type: 'update-wire', id: 'w1', color: 'url(evil)' }).ok).toBe(false);
    expect(applyEdit(document, { type: 'wire', wire: wire({ id: 'w2', from: 'a1', to: 'a1' }) }).ok).toBe(false);
    expect(applyEdit(document, { type: 'wire', wire: wire({ id: 'w2', from: 'unknown' }) }).ok).toBe(false);
  });
  it('changes the resistor value without creating another component and reset is a document edit', () => {
    const document = edited(createEmptyDocument(), { type: 'place', component: resistor() });
    const next = edited(document, { type: 'resistance', id: 'r1', value: 1000 });
    expect(next.components).toHaveLength(1);
    expect(next.components[0]?.resistance).toBe(1000);
    expect(edited(next, { type: 'reset' })).toEqual(createEmptyDocument());
  });
});

describe('bounded document history', () => {
  it('undoes and redoes one completed edit, including reset', () => {
    const empty = createEmptyDocument();
    const document = edited(empty, { type: 'place', component: resistor() });
    const placed = commitDocument(createHistory(empty), document);
    expect(undo(placed).document).toEqual(empty);
    expect(redo(undo(placed)).document).toEqual(document);
    const reset = commitDocument(placed, edited(document, { type: 'reset' }));
    expect(undo(reset).document).toEqual(document);
  });
  it('clears redo on a new edit but preserves history for no-op commits', () => {
    const empty = createEmptyDocument();
    const first = commitDocument(createHistory(empty), edited(empty, { type: 'place', component: resistor() }));
    const previous = undo(first);
    expect(commitDocument(previous, createEmptyDocument())).toBe(previous);
    const newBranch = commitDocument(previous, edited(empty, { type: 'place', component: led() }));
    expect(newBranch.future).toEqual([]);
    expect(redo(newBranch)).toBe(newBranch);
    expect(undo(createHistory(empty)).document).toBe(empty);
  });
  it('keeps at most fifty snapshots', () => {
    const document = edited(createEmptyDocument(), { type: 'place', component: resistor() });
    let history = createHistory(document);
    for (let index = 0; index < 60; index++) {
      history = commitDocument(history, edited(history.document, { type: 'resistance', id: 'r1', value: index % 2 ? 330 : 100 }));
    }
    expect(history.past).toHaveLength(50);
    for (let index = 0; index < 50; index++) history = undo(history);
    expect(history.past).toHaveLength(0);
    expect(history.document.components[0]?.resistance).toBe(330);
    expect(undo(history)).toBe(history);
  });
});
