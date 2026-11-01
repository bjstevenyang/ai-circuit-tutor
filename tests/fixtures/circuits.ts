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

/** Physically valid fixtures used by storage, UI and real-browser tests. */
export function switchedCircuit(button = false): CircuitDocument {
  return {
    ...createEmptyDocument(),
    components: [
      {id:'r',kind:'resistor',anchor:'a1',rotation:0,resistance:330},
      {id:'led',kind:'led',anchor:'c4',rotation:0},
      button ? {id:'control',kind:'button',anchor:'e8',rotation:0} : {id:'control',kind:'switch',anchor:'a8',rotation:0,closed:false},
    ],
    wires:[makeWire('battery:+','b1'),makeWire('d5',button?'d8':'b8'),makeWire(button?'j8':'b10','battery:-')],
  };
}
