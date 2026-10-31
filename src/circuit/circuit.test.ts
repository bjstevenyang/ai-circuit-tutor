import { describe, expect, it } from 'vitest';
import { analyzeCircuit, createEmptyDocument, getComponentPins, HOLES, inspectConnectivity } from './index';
import type { CircuitDocument } from './index';
import { makeWire, validCircuit } from '../../tests/fixtures/circuits';

// This oracle expresses the reviewed board specification without reading group
// fields or calling the implementation's grouping algorithm.
function expectedGroup(id: string) {
  if (id.includes(':')) return id.split(':')[0];
  const column = id.charAt(0);
  return `${'abcde'.includes(column) ? 'a-e' : 'f-j'}-${id.slice(1)}`;
}

describe('breadboard connectivity', () => {
  it('matches every hole pair against the independent 30-row / four-rail specification', () => {
    expect(HOLES).toHaveLength(420);
    expect(new Set(HOLES.map(hole => hole.id)).size).toBe(420);
    const document = createEmptyDocument();
    for (const source of HOLES) {
      const connected = new Set(inspectConnectivity(document, source.id));
      for (const target of HOLES) {
        const expected = expectedGroup(source.id) === expectedGroup(target.id);
        if (connected.has(target.id) !== expected) throw new Error(`Incorrect connectivity ${source.id} → ${target.id}`);
      }
    }
  });

  it('keeps the gap, neighboring rows, rails and battery ports isolated', () => {
    const document = createEmptyDocument();
    expect(inspectConnectivity(document, 'a1')).toEqual(['a1', 'b1', 'c1', 'd1', 'e1']);
    expect(inspectConnectivity(document, 'a1')).not.toContain('f1');
    expect(inspectConnectivity(document, 'a1')).not.toContain('a2');
    expect(inspectConnectivity(document, 'top+:1')).toHaveLength(30);
    expect(inspectConnectivity(document, 'top+:1')).not.toContain('bottom+:1');
    expect(inspectConnectivity(document, 'battery:+')).toEqual(['battery:+']);
    expect(inspectConnectivity(document, 'not-a-hole')).toEqual([]);
  });

  it('merges wire chains transitively and splits the network when its bridge is removed', () => {
    const document = createEmptyDocument();
    document.wires = [makeWire('a1', 'a2'), makeWire('b2', 'f3')];
    expect(inspectConnectivity(document, 'c1')).toContain('j3');
    document.wires.pop();
    expect(inspectConnectivity(document, 'c1')).not.toContain('j3');
    expect(inspectConnectivity(document, 'c1')).toHaveLength(10);
  });

  it('ignores route crossings, bends and colours', () => {
    const document = createEmptyDocument();
    document.wires = [makeWire('a1', 'j8'), makeWire('a8', 'j1')];
    const original = inspectConnectivity(document, 'a1');
    expect(original).not.toContain('a8');
    document.wires = document.wires.map(wire => ({ ...wire, bend: 'vertical', color: '#000000', from: wire.to, to: wire.from }));
    expect(inspectConnectivity(document, 'a1')).toEqual(original);
  });

  it('does not merge nets through resistor, LED or source terminals', () => {
    const document = validCircuit();
    expect(inspectConnectivity(document, 'a10')).not.toContain('a13');
    expect(inspectConnectivity(document, 'c13')).not.toContain('c14');
    expect(inspectConnectivity(document, 'battery:+')).not.toContain('battery:-');
  });
});

describe('component terminal geometry', () => {
  it('uses the approved pin pitch and preserves the LED terminal order', () => {
    expect(getComponentPins({ id: 'r', kind: 'resistor', anchor: 'a10', rotation: 0 })).toEqual(['a10', 'a13']);
    expect(getComponentPins({ id: 'r', kind: 'resistor', anchor: 'a10', rotation: 90 })).toEqual(['a10', 'd10']);
    expect(getComponentPins({ id: 'r', kind: 'resistor', anchor: 'e10', rotation: 90 })).toEqual(['e10', 'f10']);
    expect(getComponentPins({ id: 'l', kind: 'led', anchor: 'c14', rotation: 180 })).toEqual(['c14', 'c13']);
    expect(getComponentPins({ id: 'l', kind: 'led', anchor: 'c14', rotation: 270 })).toEqual(['c14', 'b14']);
  });

  it('rejects off-board pins, rail anchors, and a short LED footprint across the trench', () => {
    expect(getComponentPins({ id: 'r', kind: 'resistor', anchor: 'a30', rotation: 0 })).toBeNull();
    expect(getComponentPins({ id: 'l', kind: 'led', anchor: 'e10', rotation: 90 })).toBeNull();
    expect(getComponentPins({ id: 'l', kind: 'led', anchor: 'top+:1', rotation: 0 })).toBeNull();
  });
});

describe('bounded series-circuit simulation', () => {
  it('computes the reference 330-ohm circuit and accepts the lesson', () => {
    const result = analyzeCircuit(validCircuit());
    expect(result.status).toBe('supported');
    expect(result.currentMa).toBeCloseTo(7.575757575757576, 10);
    expect(result.ledOn).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it.each([[100, 25, false], [330, 7.575757575757576, true], [1000, 2.5, true]] as const)('applies %i ohms and the declared teaching limit', (resistance, expectedMa, complete) => {
    const document = validCircuit();
    document.components[0] = { ...document.components[0]!, resistance };
    const result = analyzeCircuit(document);
    expect(result.currentMa).toBeCloseTo(expectedMa, 10);
    expect(result.complete).toBe(complete);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(complete ? [] : ['overcurrent']);
  });

  it('allows the resistor on either side of the LED', () => {
    const document = validCircuit();
    document.components = [
      { id: 'resistor', kind: 'resistor', anchor: 'a14', rotation: 180, resistance: 330 },
      { id: 'led', kind: 'led', anchor: 'c10', rotation: 0 },
    ];
    expect(analyzeCircuit(document)).toEqual(analyzeCircuit(validCircuit()));
  });

  it('is invariant to resistor terminal order, hole choice within a group, IDs, redundant wire and presentation', () => {
    const document = validCircuit();
    document.components[0] = { ...document.components[0]!, id: 'new-r', anchor: 'b13', rotation: 180 };
    document.components[1] = { ...document.components[1]!, id: 'new-l', anchor: 'd13' };
    document.components.reverse();
    document.wires = document.wires.map((wire, index) => ({ ...wire, id: `renamed-${index}`, from: wire.to, to: wire.from, color: '#abcdef', bend: 'vertical' }));
    document.wires.push(makeWire('e10', 'c10'));
    expect(analyzeCircuit(document)).toEqual(analyzeCircuit(validCircuit()));
  });

  it('returns the declared zero-current approximation for a reversed LED', () => {
    const document = validCircuit();
    document.components[1] = { ...document.components[1]!, anchor: 'c14', rotation: 180 };
    const result = analyzeCircuit(document);
    expect(result.status).toBe('supported');
    expect(result.currentMa).toBe(0);
    expect(result.ledOn).toBe(false);
    expect(result.complete).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('reversed-led');
  });

  it('does not label an isolated LED reversed merely from its drawing', () => {
    const document = validCircuit();
    document.wires = [];
    document.components[1] = { ...document.components[1]!, anchor: 'c14', rotation: 180 };
    const result = analyzeCircuit(document);
    expect(result.currentMa).toBeUndefined();
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['open-circuit']);
  });

  it('prioritizes a source short and never invents a current', () => {
    const document = validCircuit();
    document.wires.push(makeWire('e10', 'e14'));
    const result = analyzeCircuit(document);
    expect(result.diagnostics[0]?.code).toBe('source-short');
    expect(result.currentMa).toBeUndefined();
    expect(result.ledOn).toBeUndefined();
    expect(result.complete).toBe(false);
  });

  it('diagnoses a missing or bypassed resistor without numerical overflow', () => {
    const missing = validCircuit();
    missing.components = missing.components.filter(component => component.kind !== 'resistor');
    missing.wires[0] = makeWire('battery:+', 'b13');
    expect(analyzeCircuit(missing).diagnostics[0]?.code).toBe('missing-resistor');
    expect(analyzeCircuit(missing).currentMa).toBeUndefined();
    expect(analyzeCircuit(missing).ledOn).toBeUndefined();
    const bypassed = validCircuit();
    bypassed.wires.push(makeWire('e10', 'e13'));
    expect(analyzeCircuit(bypassed).diagnostics[0]?.code).toBe('resistor-bypassed');
    expect(analyzeCircuit(bypassed).currentMa).toBeUndefined();
    expect(analyzeCircuit(bypassed).ledOn).toBeUndefined();
  });

  it('does not accept a disconnected resistor as current limiting for a directly powered LED', () => {
    const document = validCircuit();
    document.wires[0] = makeWire('battery:+', 'b13');
    const result = analyzeCircuit(document);
    expect(result.diagnostics[0]?.code).toBe('missing-resistor');
    expect(result.currentMa).toBeUndefined();
    expect(result.complete).toBe(false);
  });

  it('diagnoses the LED bypass and an incomplete circuit with evidence', () => {
    const bypassed = validCircuit();
    bypassed.wires.push(makeWire('e13', 'e14'));
    const result = analyzeCircuit(bypassed);
    expect(result.diagnostics[0]).toEqual({ code: 'led-bypassed', entities: ['led', 'c13', 'c14'] });
    expect(result.currentMa).toBeUndefined();
    const open = validCircuit();
    open.wires.pop();
    expect(analyzeCircuit(open).diagnostics[0]?.code).toBe('open-circuit');
    expect(analyzeCircuit(open).complete).toBe(false);
  });

  it('keeps multi-fault ordering stable under serialization reordering', () => {
    const document = validCircuit();
    document.wires.push(makeWire('e10', 'e13'), makeWire('e13', 'e14'));
    const result = analyzeCircuit(document);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['source-short', 'resistor-bypassed', 'led-bypassed']);
    document.wires.reverse();
    document.components.reverse();
    expect(analyzeCircuit(document)).toEqual(result);
  });

  it('rejects additional components or invalid references as unsupported', () => {
    const document = validCircuit();
    document.components.push({ id: 'another-led', kind: 'led', anchor: 'h20', rotation: 0 });
    expect(analyzeCircuit(document).status).toBe('unsupported');
    expect(analyzeCircuit(document).currentMa).toBeUndefined();
    const badWire = validCircuit();
    badWire.wires[0] = makeWire('battery:+', 'z99');
    expect(analyzeCircuit(badWire).status).toBe('unsupported');
  });

  it('reports an out-of-model powered resistor arrangement without series measurements', () => {
    const document = validCircuit();
    document.wires = [makeWire('battery:+', 'b10'), makeWire('d13', 'battery:-')];
    const result = analyzeCircuit(document);
    expect(result.status).toBe('unsupported');
    expect(result.currentMa).toBeUndefined();
    expect(result.complete).toBe(false);
  });

  it.each([
    null,
    {},
    { ...createEmptyDocument(), wires: null },
    { ...createEmptyDocument(), components: [null] },
    { ...createEmptyDocument(), wires: [null] },
    { ...createEmptyDocument(), components: [{ id: 'bad', kind: 'led', anchor: 'a1', rotation: '0' }] },
  ])('returns unsupported for malformed direct input without throwing', input => {
    const result = analyzeCircuit(input as unknown as CircuitDocument);
    expect(result.status).toBe('unsupported');
    expect(result.complete).toBe(false);
    expect(result.currentMa).toBeUndefined();
    expect(result.ledOn).toBeUndefined();
  });

  it('does not report success for ambiguous duplicate entity identities', () => {
    const document = validCircuit();
    document.components[1] = { ...document.components[1]!, id: 'resistor' };
    expect(analyzeCircuit(document).status).toBe('unsupported');
    expect(analyzeCircuit(document).complete).toBe(false);
  });
});
