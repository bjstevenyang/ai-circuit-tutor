export type Rotation = 0 | 90 | 180 | 270;
export type Resistance = 100 | 330 | 1000;
export type ComponentInstance = {
  id: string;
  kind: 'resistor' | 'led';
  anchor: string;
  rotation: Rotation;
  resistance?: Resistance;
};
export type Wire = {
  id: string;
  from: string;
  to: string;
  color: string;
  bend: 'horizontal' | 'vertical';
};
export type CircuitDocument = {
  schemaVersion: 1;
  boardId: 'breadboard-30-v1';
  lessonId: 'led-series-v1';
  components: ComponentInstance[];
  wires: Wire[];
};
export type DiagnosticCode = 'source-short' | 'missing-resistor' | 'resistor-bypassed' | 'led-bypassed' | 'open-circuit' | 'reversed-led' | 'overcurrent' | 'unsupported' | 'missing-led';
export type Diagnostic = { code: DiagnosticCode; entities: string[] };
export type AnalysisResult = {
  status: 'supported' | 'fault' | 'unsupported';
  currentMa?: number;
  ledOn?: boolean;
  complete: boolean;
  diagnostics: Diagnostic[];
};
export type BoardEndpoint = { id: string; x: number; y: number; group: string };

const holes: BoardEndpoint[] = [];
for (let row = 1; row <= 30; row += 1) {
  for (const [index, column] of [...'abcdefghij'].entries()) {
    holes.push({ id: `${column}${row}`, x: 140 + (row - 1) * 20,
      y: index < 5 ? 170 + index * 20 : 310 + (index - 5) * 20,
      group: `${index < 5 ? 'upper' : 'lower'}:${row}` });
  }
  for (const [rail, y] of [['top+', 100], ['top-', 120], ['bottom+', 440], ['bottom-', 460]] as const) {
    holes.push({ id: `${rail}:${row}`, x: 140 + (row - 1) * 20, y, group: rail });
  }
}
export const HOLES: readonly BoardEndpoint[] = holes;
export const HOLE_BY_ID: ReadonlyMap<string, BoardEndpoint> = new Map(HOLES.map(hole => [hole.id, hole]));
export const ENDPOINTS: readonly BoardEndpoint[] = [...HOLES,
  { id: 'battery:+', x: 285, y: 565, group: 'battery:+' },
  { id: 'battery:-', x: 325, y: 565, group: 'battery:-' },
];
export const ENDPOINT_BY_ID: ReadonlyMap<string, BoardEndpoint> = new Map(ENDPOINTS.map(endpoint => [endpoint.id, endpoint]));

export function createEmptyDocument(): CircuitDocument {
  return { schemaVersion: 1, boardId: 'breadboard-30-v1', lessonId: 'led-series-v1', components: [], wires: [] };
}

export function getComponentPins(component: ComponentInstance): [string, string] | null {
  const first = HOLE_BY_ID.get(component.anchor);
  if (!first || !/^[a-j]\d+$/.test(first.id)) return null;
  const distance = component.kind === 'resistor' ? 60 : 20;
  const directions: Record<Rotation, readonly [number, number]> = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] };
  const direction = directions[component.rotation];
  if (!direction) return null;
  const second = HOLES.find(hole => /^[a-j]\d+$/.test(hole.id) && hole.x === first.x + direction[0] * distance && hole.y === first.y + direction[1] * distance);
  return second ? [first.id, second.id] : null;
}

function buildNets(document: CircuitDocument): Map<string, string> {
  const parents = new Map(ENDPOINTS.map(endpoint => [endpoint.id, endpoint.id]));
  const find = (id: string): string => {
    const parent = parents.get(id);
    if (parent === undefined) return id;
    if (parent === id) return id;
    const root = find(parent);
    parents.set(id, root);
    return root;
  };
  const join = (a: string, b: string) => {
    if (parents.has(a) && parents.has(b)) parents.set(find(b), find(a));
  };
  const groups = new Map<string, string>();
  for (const endpoint of ENDPOINTS) {
    const first = groups.get(endpoint.group);
    if (first) join(first, endpoint.id);
    else groups.set(endpoint.group, endpoint.id);
  }
  for (const wire of document.wires) join(wire.from, wire.to);
  return new Map(ENDPOINTS.map(endpoint => [endpoint.id, find(endpoint.id)]));
}

export function inspectConnectivity(document: CircuitDocument, endpoint: string): string[] {
  if (!ENDPOINT_BY_ID.has(endpoint)) return [];
  const nets = buildNets(document);
  const root = nets.get(endpoint);
  return ENDPOINTS.filter(candidate => nets.get(candidate.id) === root).map(candidate => candidate.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keep malformed direct callers from turning an unsupported input into a crash
// or a successful lesson. Storage separately validates physical placement.
function isAnalyzableDocument(value: unknown): value is CircuitDocument {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.boardId !== 'breadboard-30-v1' || value.lessonId !== 'led-series-v1' || !Array.isArray(value.components) || !Array.isArray(value.wires)) return false;
  const ids = new Set<string>();
  const uniqueId = (id: unknown) => {
    if (typeof id !== 'string' || id.trim() === '' || ids.has(id)) return false;
    ids.add(id);
    return true;
  };
  for (const component of value.components) {
    if (!isRecord(component) || !uniqueId(component.id) || (component.kind !== 'resistor' && component.kind !== 'led') || typeof component.anchor !== 'string' || ![0, 90, 180, 270].includes(component.rotation as number)) return false;
    if (component.kind === 'resistor' && component.resistance !== undefined && ![100, 330, 1000].includes(component.resistance as number)) return false;
    if (component.kind === 'led' && component.resistance !== undefined) return false;
  }
  for (const wire of value.wires) {
    if (!isRecord(wire) || !uniqueId(wire.id) || typeof wire.from !== 'string' || typeof wire.to !== 'string' || typeof wire.color !== 'string' || (wire.bend !== 'horizontal' && wire.bend !== 'vertical')) return false;
  }
  return true;
}

export function analyzeCircuit(document: CircuitDocument): AnalysisResult {
  const unsupported = (entities: string[] = []): AnalysisResult => ({ status: 'unsupported', complete: false, diagnostics: [{ code: 'unsupported', entities }] });
  if (!isAnalyzableDocument(document)) return unsupported();
  if (document.wires.some(wire => !ENDPOINT_BY_ID.has(wire.from) || !ENDPOINT_BY_ID.has(wire.to))) return unsupported();
  if (document.components.some(component => !getComponentPins(component) || !['resistor', 'led'].includes(component.kind))) return unsupported();
  const resistors = document.components.filter(component => component.kind === 'resistor');
  const leds = document.components.filter(component => component.kind === 'led');
  if (resistors.length > 1 || leds.length > 1) return unsupported(document.components.map(component => component.id));
  const resistor = resistors[0];
  const led = leds[0];
  if (resistor && ![100, 330, 1000].includes(resistor.resistance ?? 330)) return unsupported([resistor.id]);
  const nets = buildNets(document);
  const net = (endpoint: string) => nets.get(endpoint) ?? endpoint;
  const positive = net('battery:+');
  const negative = net('battery:-');
  const diagnostic = (code: DiagnosticCode, entities: string[]): Diagnostic => ({ code, entities });
  const faults: Diagnostic[] = [];
  if (positive === negative) faults.push(diagnostic('source-short', ['battery:+', 'battery:-']));
  const resistorPins = resistor ? getComponentPins(resistor) : null;
  const ledPins = led ? getComponentPins(led) : null;
  if (!resistor) faults.push(diagnostic('missing-resistor', led ? [led.id] : []));
  else if (resistorPins && net(resistorPins[0]) === net(resistorPins[1])) faults.push(diagnostic('resistor-bypassed', [resistor.id, ...resistorPins]));
  if (!led) faults.push(diagnostic('missing-led', []));
  else if (ledPins && net(ledPins[0]) === net(ledPins[1])) faults.push(diagnostic('led-bypassed', [led.id, ...ledPins]));
  if (faults.length) return {
    status: 'fault', complete: false, diagnostics: faults,
    ...(faults.every(fault => fault.code === 'led-bypassed') ? { ledOn: false } : {}),
  };
  if (!resistor || !led || !resistorPins || !ledPins) return unsupported();

  const r0 = net(resistorPins[0]);
  const r1 = net(resistorPins[1]);
  const anode = net(ledPins[0]);
  const cathode = net(ledPins[1]);
  const resistorOther = (node: string) => r0 === node ? r1 : r1 === node ? r0 : null;
  // A supported circuit has one two-element load path between source terminals.
  // Component order and the resistor's terminal order do not change that path.
  const afterResistor = resistorOther(positive);
  const beforeResistor = resistorOther(negative);
  const forward = (afterResistor === anode && cathode === negative) || (anode === positive && cathode === beforeResistor);
  const reversed = (afterResistor === cathode && anode === negative) || (cathode === positive && anode === beforeResistor);
  if (forward || reversed) {
    if (reversed) return { status: 'supported', currentMa: 0, ledOn: false, complete: false, diagnostics: [diagnostic('reversed-led', [led.id, ...ledPins])] };
    const currentMa = 2500 / (resistor.resistance ?? 330);
    const excessive = currentMa > 20;
    return { status: excessive ? 'fault' : 'supported', currentMa, ledOn: true, complete: !excessive,
      diagnostics: excessive ? [diagnostic('overcurrent', [resistor.id, led.id])] : [] };
  }
  // An LED wired directly across the battery has no series limiting resistor,
  // even if a disconnected or parallel resistor is present elsewhere.
  if ((anode === positive && cathode === negative) || (anode === negative && cathode === positive)) {
    return { status: 'fault', complete: false, diagnostics: [diagnostic('missing-resistor', [resistor.id, led.id])] };
  }
  // A directly powered resistor with the LED outside the series path is outside
  // this lesson model; do not apply the LED series-current estimate to it.
  if ((r0 === positive && r1 === negative) || (r0 === negative && r1 === positive)) return unsupported([resistor.id, led.id]);
  return { status: 'fault', complete: false, ledOn: false, diagnostics: [diagnostic('open-circuit', [resistor.id, led.id, 'battery:+', 'battery:-'])] };
}
