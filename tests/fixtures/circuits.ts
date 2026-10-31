import { createEmptyDocument } from '../../src/circuit';
import type { CircuitDocument, Wire } from '../../src/circuit';

export function makeWire(from: string, to: string, id = `${from}-${to}`): Wire {
  return { id, from, to, color: '#b45b49', bend: 'horizontal' };
}

export function validCircuit(): CircuitDocument {
  return {
    ...createEmptyDocument(),
    components: [
      { id: 'resistor', kind: 'resistor', anchor: 'a10', rotation: 0, resistance: 330 },
      { id: 'led', kind: 'led', anchor: 'c13', rotation: 0 },
    ],
    wires: [makeWire('battery:+', 'b10'), makeWire('d14', 'battery:-')],
  };
}
