import { COMPONENTS, createComponent } from '../catalog';
import { createEmptyDocument, ENDPOINT_BY_ID, getComponentPins, HOLES } from '../board';
import type { CircuitDocument, ComponentInstance, ComponentKind, Rotation } from '../types';
import { validateDocument } from '../../editor/model';

/** Test inputs only: these names describe the independent seven-node specification. */
export type OscillatorFixtureName = 'REF' | 'C47' | 'C220' | 'R100' | 'R240' | 'L26' |
  'NOC' | 'NOR' | 'NOSPK' | 'BYPASS' | 'PSHORT' | 'VSHORT' | 'WRONGPIN' | 'WRONGKIND' | 'MAX12' | 'OVER13';
export type OscillatorLayout = 0 | 1 | 2;
type PartSpec = { id: string; kind: ComponentKind; nodes: string[]; settings?: Partial<ComponentInstance> };
export type PinTableRow = { id: string; kind: ComponentKind; anchor: string; rotation: Rotation; pins: string[]; nodes: string[] };
export type OscillatorFixtureDetails = {
  document: CircuitDocument;
  pinTable: PinTableRow[];
  nodeEndpoints: Record<string, string[]>;
};

const resistor = (id: string, resistance: number, a: string, b: string): PartSpec =>
  ({ id, kind: 'resistor', nodes: [a, b], settings: { resistance } });

function specifications(name: OscillatorFixtureName): PartSpec[] {
  const q2Nodes = name === 'WRONGPIN' ? ['D', 'B', 'P'] : ['B', 'D', 'P'];
  const parts: PartSpec[] = [
    { id: 'Q1', kind: 'npn', nodes: ['A', 'B', 'GND'] },
    { id: 'Q2', kind: name === 'WRONGKIND' ? 'npn' : 'pnp', nodes: q2Nodes },
    resistor('R3', 47, 'VP', 'P'),
    ...(name === 'NOR' ? [] : name === 'MAX12' || name === 'OVER13'
      ? Array.from({ length: name === 'OVER13' ? 9 : 8 }, (_, i) => {
        const count = name === 'OVER13' ? 9 : 8;
        return resistor(`R1-${i + 1}`, name === 'OVER13' && i < 2 ? 7500 : 15000,
          i === 0 ? 'P' : `X${i}`, i === count - 1 ? 'A' : `X${i + 1}`);
      })
      : [resistor('R1', name === 'R100' ? 100000 : name === 'R240' ? 240000 : 120000, 'P', 'A')]),
    ...(name === 'NOC' ? [] : [{ id: 'C1', kind: 'capacitor' as const, nodes: ['A', 'D'], settings: {
      capacitanceF: name === 'C47' ? 47e-9 : name === 'C220' ? 220e-9 : 100e-9,
    } }]),
    ...(name === 'NOSPK' ? [] : [{ id: 'SPK1', kind: 'speaker' as const, nodes: ['D', 'S'] }]),
    resistor('R2', name === 'L26' ? 18 : 10, 'S', 'GND'),
  ];
  return parts;
}

/**
 * The fixture allocator knows only installation constraints and desired net labels.
 * It never sees the oscillator equations or decides whether a circuit oscillates.
 * Each part pin starts in a distinct conductive group; wires use other, unused holes.
 */
function install(specs: PartSpec[], layout: OscillatorLayout): OscillatorFixtureDetails {
  let document: CircuitDocument = {
    ...createEmptyDocument(), modelProfileId: 'oscillator-em-v2', supplyVoltage: 9,
  };
  const groups = new Set<string>();
  const nodeEndpoints: Record<string, string[]> = { VP: ['battery:+'], GND: ['battery:-'] };
  const pinTable: PinTableRow[] = [];
  const rows = layout === 0 ? ['a', 'f', 'e', 'j', 'c', 'h', 'b', 'g', 'd', 'i']
    : layout === 1 ? ['j', 'e', 'f', 'a', 'h', 'c', 'i', 'd', 'g', 'b']
      : ['f', 'a', 'j', 'e', 'h', 'c', 'g', 'b', 'i', 'd'];
  const columns = Array.from({ length: 30 }, (_, i) => layout === 1 ? 30 - i : i + 1);
  const ordered = specs.map(spec => layout === 2 && spec.id === 'SPK1' ? { ...spec, nodes: [...spec.nodes].reverse() } : spec)
    .sort((a, b) => COMPONENTS[b.kind].offsets.length - COMPONENTS[a.kind].offsets.length);
  for (const spec of ordered) {
    const rotation: Rotation = layout === 1 || layout === 2 && ['Q2', 'SPK1'].includes(spec.id) ? 180 : 0;
    let chosen: ComponentInstance | undefined;
    for (const row of rows) {
      for (const column of columns) {
        const candidate = { ...createComponent(spec.kind, `${row}${column}`, rotation, spec.id, 'oscillator-em-v2'), ...spec.settings };
        const pins = getComponentPins(candidate);
        if (!pins || pins.some(pin => groups.has(ENDPOINT_BY_ID.get(pin)!.group))) continue;
        if (new Set(pins.map(pin => ENDPOINT_BY_ID.get(pin)!.group)).size !== pins.length) continue;
        if (validateDocument({ ...document, components: [...document.components, candidate] }) === null) {
          chosen = candidate;
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) throw new Error(`Cannot physically install oscillator fixture ${spec.id} in layout ${layout}`);
    const pins = getComponentPins(chosen)!;
    for (const [i, pin] of pins.entries()) {
      groups.add(ENDPOINT_BY_ID.get(pin)!.group);
      const node = spec.nodes[i]!;
      (nodeEndpoints[node] ??= []).push(pin);
    }
    document = { ...document, components: [...document.components, chosen] };
    pinTable.push({ id: spec.id, kind: spec.kind, anchor: chosen.anchor, rotation, pins, nodes: [...spec.nodes] });
  }
  const occupied = new Set(document.components.flatMap(part => getComponentPins(part)!));
  const spare = (endpoint: string): string => {
    if (endpoint.startsWith('battery:')) {
      if (occupied.has(endpoint)) throw new Error('Fixture source port already occupied');
      occupied.add(endpoint);
      return endpoint;
    }
    const group = ENDPOINT_BY_ID.get(endpoint)!.group;
    const hole = HOLES.find(hole => hole.group === group && !occupied.has(hole.id));
    if (!hole) throw new Error(`No spare fixture hole for ${endpoint}`);
    occupied.add(hole.id);
    return hole.id;
  };
  for (const endpoints of Object.values(nodeEndpoints)) {
    for (let i = 1; i < endpoints.length; i++) {
      document.wires.push({ id: `osc-wire-${document.wires.length + 1}`, from: spare(endpoints[i - 1]!), to: spare(endpoints[i]!),
        color: layout === 0 ? '#b45b49' : layout === 1 ? '#315f83' : '#507b46', bend: layout === 0 ? 'horizontal' : 'vertical' });
    }
  }
  if (layout === 1) {
    document.components.reverse();
    document.wires.reverse();
    document.wires = document.wires.map(wire => ({ ...wire, from: wire.to, to: wire.from }));
  }
  const error = validateDocument(document);
  if (error) throw new Error(error);
  return { document, pinTable, nodeEndpoints };
}

function bridge(details: OscillatorFixtureDetails, a: string, b: string): void {
  const { document, nodeEndpoints } = details;
  const occupied = new Set([...document.components.flatMap(part => getComponentPins(part)!),
    ...document.wires.flatMap(wire => [wire.from, wire.to])]);
  const spare = (node: string): string => {
    const endpoints = nodeEndpoints[node]!;
    for (const endpoint of endpoints) {
      const group = ENDPOINT_BY_ID.get(endpoint)!.group;
      const hole = HOLES.find(hole => hole.group === group && !occupied.has(hole.id));
      if (hole) { occupied.add(hole.id); return hole.id; }
    }
    throw new Error(`No spare bridge endpoint for ${node}`);
  };
  document.wires.push({ id: 'osc-negative-bridge', from: spare(a), to: spare(b), color: '#333333', bend: 'vertical' });
}

export function oscillatorFixtureDetails(layout: OscillatorLayout = 0, name: OscillatorFixtureName = 'REF'): OscillatorFixtureDetails {
  const details = install(specifications(name), layout);
  if (name === 'BYPASS') bridge(details, 'D', 'S');
  if (name === 'PSHORT') bridge(details, 'P', 'GND');
  if (name === 'VSHORT') bridge(details, 'VP', 'GND');
  const error = validateDocument(details.document);
  if (error) throw new Error(error);
  return details;
}
export function oscillatorFixture(layout: OscillatorLayout = 0): CircuitDocument { return oscillatorFixtureDetails(layout).document; }
export function oscillatorVariant(name: OscillatorFixtureName, layout: OscillatorLayout = 0): CircuitDocument {
  return oscillatorFixtureDetails(layout, name).document;
}
