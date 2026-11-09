import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createEmptyDocument, ENDPOINT_BY_ID, getComponentPins } from '../board';
import { buildNets } from '../network';
import type { CircuitDocument } from '../types';
import { applyEdit, validateDocument } from '../../editor/model';
import { oscillatorFixture, oscillatorFixtureDetails, oscillatorVariant } from './fixtures';
import type { OscillatorFixtureName, OscillatorLayout } from './fixtures';

const names: OscillatorFixtureName[] = ['REF', 'C47', 'C220', 'R100', 'R240', 'L26', 'NOC', 'NOR', 'NOSPK',
  'BYPASS', 'PSHORT', 'VSHORT', 'WRONGPIN', 'WRONGKIND', 'MAX12', 'OVER13'];
const referenceHashes = [
  'bc46ee97f883abef5ea8cd066392e9d6fe8561891279aca492799d6320f0115d',
  '33d113e23c511c6990df5984828d935adf73bbc7f5461f9bf7a1233bae70aa1d',
  'a2fa860653c7dfd84fd2c3dea492222555481acdfb7474a6dca956937dfa66ac',
] as const;

describe('OSC-01/06 explicit physical fixtures', () => {
  it.each([0, 1, 2] as OscillatorLayout[])('layout %i is an editor-valid seven-node input with unique inserted endpoints', layout => {
    const { document, pinTable, nodeEndpoints } = oscillatorFixtureDetails(layout);
    expect(validateDocument(document)).toBeNull();
    const used = [...document.components.flatMap(part => getComponentPins(part)!), ...document.wires.flatMap(wire => [wire.from, wire.to])];
    expect(new Set(used).size).toBe(used.length);
    const nets = buildNets(document);
    const labels = Object.entries(nodeEndpoints).map(([label, endpoints]) => {
      const expected = nets.get(endpoints[0]!);
      expect(endpoints.every(endpoint => nets.get(endpoint) === expected), label).toBe(true);
      return expected;
    });
    expect(new Set(labels).size).toBe(7);
    expect(pinTable.find(part => part.id === 'Q1')!.nodes).toEqual(['A', 'B', 'GND']);
    expect(pinTable.find(part => part.id === 'Q2')!.nodes).toEqual(['B', 'D', 'P']);
    expect(pinTable.find(part => part.id === 'SPK1')!.nodes).toEqual(layout === 2 ? ['S', 'D'] : ['D', 'S']);
    expect(document.components).toHaveLength(7);
    expect(document.modelProfileId).toBe('oscillator-em-v2');
    expect(document.supplyVoltage).toBe(9);
    expect(createHash('sha256').update(JSON.stringify(document)).digest('hex')).toBe(referenceHashes[layout]);
  });

  it('all three layouts use different physical positions, including rotated PNP/speaker and visual-order changes', () => {
    const documents = [0, 1, 2].map(layout => oscillatorFixture(layout as OscillatorLayout));
    for (const id of ['Q2', 'SPK1']) {
      const parts = documents.map(document => document.components.find(part => part.id === id)!);
      expect(new Set(parts.map(part => part.anchor)).size).toBe(3);
      expect(parts[1]!.rotation).toBe(180);
      expect(parts[2]!.rotation).toBe(180);
    }
    expect(documents[0]!.wires[0]!.color).not.toBe(documents[1]!.wires[0]!.color);
    expect(documents[0]!.wires[0]!.bend).not.toBe(documents[1]!.wires[0]!.bend);
    expect(documents[0]!.components.map(part => part.id)).not.toEqual(documents[1]!.components.map(part => part.id));
  });

  it('OSC-REF can be built from an empty board exclusively through the shared editor commands', () => {
    const expected = oscillatorFixture();
    let document: CircuitDocument = { ...createEmptyDocument(), modelProfileId: 'oscillator-em-v2', supplyVoltage: 9 };
    for (const component of expected.components) {
      const result = applyEdit(document, { type: 'place', component });
      expect(result.ok, component.id).toBe(true);
      if (!result.ok) throw new Error(result.error);
      document = result.document;
    }
    for (const wire of expected.wires) {
      const result = applyEdit(document, { type: 'wire', wire });
      expect(result.ok, wire.id).toBe(true);
      if (!result.ok) throw new Error(result.error);
      document = result.document;
    }
    expect(document).toEqual(expected);
  });

  it.each(names)('%s is physically valid before numerical analysis', name => {
    const document = oscillatorVariant(name);
    expect(validateDocument(document)).toBeNull();
  });

  it('negative inputs remove real parts rather than inserting pseudo open-circuit resistors', () => {
    for (const [name, id] of [['NOC', 'C1'], ['NOR', 'R1'], ['NOSPK', 'SPK1']] as const) {
      const document = oscillatorVariant(name);
      expect(document.components.some(part => part.id === id)).toBe(false);
      expect(document.components.filter(part => part.kind === 'resistor').every(part => part.resistance! <= 1e6)).toBe(true);
    }
    const wrong = oscillatorFixtureDetails(0, 'WRONGPIN');
    expect(wrong.pinTable.find(part => part.id === 'Q2')!.nodes).toEqual(['D', 'B', 'P']);
    expect(oscillatorVariant('WRONGKIND').components.find(part => part.id === 'Q2')!.kind).toBe('npn');
  });

  it('MAX12/OVER13 contain the specified series replacements before any solver optimization', () => {
    for (const [name, count, extraNodes] of [['MAX12', 14, 7], ['OVER13', 15, 8]] as const) {
      const { document, nodeEndpoints } = oscillatorFixtureDetails(0, name);
      expect(document.components).toHaveLength(count);
      expect(Object.keys(nodeEndpoints).filter(node => node.startsWith('X'))).toHaveLength(extraNodes);
      const series = document.components.filter(part => part.id.startsWith('R1-'));
      expect(series.reduce((sum, part) => sum + part.resistance!, 0)).toBe(120000);
      expect(series).toHaveLength(extraNodes + 1);
      expect(new Set(series.flatMap(part => getComponentPins(part)!).map(endpoint => ENDPOINT_BY_ID.get(endpoint)!.group)).size).toBe(series.length * 2);
    }
  });
});
