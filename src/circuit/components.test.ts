import { describe, expect, it } from 'vitest';
import { analyzeCircuit, createComponent, createEmptyDocument, getComponentPins, inspectConnectivity, resistanceOf } from './index';
import type { ComponentInstance, ComponentKind, SimulationControls } from './index';
import { makeWire } from '../../tests/fixtures/circuits';
import { solveDC } from './solver';
import type { Branch } from './solver';

type Part = [ComponentKind, string[], Partial<ComponentInstance>?];
// Logical fixtures deliberately test topology, independently of editor occupancy.
// Hand-calculated expectations below never use the circuit grouping/solver code.
function circuit(parts: Part[]) {
  const document = createEmptyDocument();
  const first = new Map<string, string>([['+', 'battery:+'], ['-', 'battery:-']]);
  parts.forEach(([kind, nodes, settings], index) => {
    const part = { ...createComponent(kind, kind === 'button' ? 'e26' : `a${1+index*5}`, 0, `p${index}`), ...settings };
    document.components.push(part);
    const pins = getComponentPins(part)!;
    nodes.forEach((node, pin) => {
      if(first.has(node)) document.wires.push(makeWire(first.get(node)!, pins[pin]!, `w${index}-${pin}`));
      else first.set(node, pins[pin]!);
    });
  });
  return document;
}
const codes = (document: ReturnType<typeof circuit>, controls?: SimulationControls) => analyzeCircuit(document, controls).diagnostics.map(d => d.code);

describe('bounded DC component models', () => {
  it('adds series resistances and accepts either resistor orientation', () => {
    const document=circuit([['resistor',['+','x'],{resistance:330}],['resistor',['y','x'],{resistance:1000}],['led',['y','-']]]);
    expect(analyzeCircuit(document).currentMa).toBeCloseTo(2500/1330,6);
    expect(analyzeCircuit(document).complete).toBe(true);
  });
  it('sums independent parallel branches and checks each LED rather than total current', () => {
    const document=circuit([['resistor',['+','a'],{resistance:150}],['led',['a','-']],['resistor',['+','b'],{resistance:150}],['led',['b','-']]]);
    const result=analyzeCircuit(document);
    expect(result.currentMa).toBeCloseTo(2*2500/150,6);
    expect(result.readings?.p1?.currentMa).toBeCloseTo(2500/150,6);
    expect(result.readings?.p3?.currentMa).toBeCloseTo(2500/150,6);
    expect(result.complete).toBe(true);
    document.components[2]!.resistance=100;
    expect(analyzeCircuit(document).diagnostics).toEqual([{code:'overcurrent',entities:['p3']}]);
  });
  it('subtracts the voltage drop of each series LED', () => {
    const result=analyzeCircuit(circuit([['resistor',['+','a']],['led',['a','b']],['led',['b','-']]]));
    expect(result.currentMa).toBeCloseTo(500/330,6);
    expect(result.readings?.p1?.on).toBe(true);
    expect(result.readings?.p2?.on).toBe(true);
  });
  it('reports insufficient supply voltage for three series LEDs', () => {
    const document=circuit([['resistor',['+','a']],['led',['a','b']],['led',['b','c']],['led',['c','-']]]);
    expect(codes(document)).toEqual(['insufficient-voltage']);
    expect(analyzeCircuit(document)).toMatchObject({currentMa:0,ledOn:false,complete:false});
  });
  it('refuses arbitrary current sharing between parallel ideal LEDs', () => {
    const result=analyzeCircuit(circuit([['resistor',['+','a']],['led',['a','-']],['led',['a','-']]]));
    expect(result.status).toBe('unsupported');
    expect(result.currentMa).toBeUndefined();
    expect(result.readings).toBeUndefined();
  });
  it('models a forward diode with a 0.7 V drop, independently of the LED drop', () => {
    const result=analyzeCircuit(circuit([['resistor',['+','a']],['diode',['a','b']],['led',['b','-']]]));
    expect(result.currentMa).toBeCloseTo(1800/330,6);
    expect(result.complete).toBe(true);
  });
  it('blocks a reversed diode and identifies it rather than an unrelated LED', () => {
    const document=circuit([['resistor',['+','a']],['diode',['-','a']]]);
    expect(codes(document)).toEqual(['reversed-diode']);
    expect(analyzeCircuit(document).currentMa).toBe(0);
  });
  it('does not invent a finite current for an unresisted diode or LED path', () => {
    for(const kind of ['led','diode'] as const) {
      const result=analyzeCircuit(circuit([[kind,['+','-']]]));
      expect(result.diagnostics[0]?.code).toBe('missing-resistor');
      expect(result.currentMa).toBeUndefined();
    }
  });
  it('solves an ordinary parallel resistor network with no output device', () => {
    const result=analyzeCircuit(circuit([['resistor',['+','-'],{resistance:1000}],['resistor',['-','+'],{resistance:1000}]]));
    expect(result.currentMa).toBeCloseTo(9,6);
    expect(result.complete).toBe(false);
    expect(result.diagnostics).toEqual([]);
  });
  it('drives an active buzzer directly, and distinguishes reversed and undervoltage states', () => {
    const powered=analyzeCircuit(circuit([['buzzer',['+','-']]]));
    expect(powered).toMatchObject({complete:true,currentMa:4.5,readings:{p0:{on:true,voltageV:4.5}}});
    expect(codes(circuit([['buzzer',['-','+']]]))).toEqual(['buzzer-reversed']);
    const low=analyzeCircuit(circuit([['resistor',['+','x'],{resistance:1000}],['buzzer',['x','-']]]));
    expect(low.readings?.p1).toMatchObject({on:false});
    expect(low.currentMa).toBeCloseTo(2.25,6);
    expect(low.diagnostics[0]?.code).toBe('buzzer-undervoltage');
  });
  it.each([0,50,100])('maps light %s percent to an explicit, reproducible LDR resistance', light => {
    const document=circuit([['ldr',['+','x'],{light}],['led',['x','-']]]);
    const expected=light===0?100000:light===50?Math.sqrt(100000*100):100;
    expect(resistanceOf(document.components[0]!)).toBeCloseTo(expected,6);
    expect(analyzeCircuit(document).currentMa).toBeCloseTo(2500/expected,6);
    expect(codes(document)).toEqual(light===100?['overcurrent']:[]);
  });
  it('is invariant under object order, wire direction, and visual style', () => {
    const document=circuit([['resistor',['+','a']],['diode',['a','b']],['led',['b','-']]]);
    const original=analyzeCircuit(document);
    document.components.reverse();
    document.wires.reverse();
    document.wires=document.wires.map(w=>({...w,from:w.to,to:w.from,color:'#000000',bend:'vertical'}));
    expect(analyzeCircuit(document)).toEqual(original);
  });
});

describe('switch and four-pin momentary button', () => {
  it('treats an open switch as intentional control and recomputes its closed state', () => {
    const document=circuit([['resistor',['+','a']],['led',['a','b']],['switch',['b','-']]]);
    expect(codes(document)).toEqual(['control-open']);
    document.components[2]!.closed=true;
    const closed=analyzeCircuit(document);
    expect(closed.complete).toBe(true);
    expect(closed.currentMa).toBeCloseTo(2500/330,6);
    expect(closed.readings?.p2).toBeUndefined();
  });
  it('does not attribute unrelated dangling wiring to an open switch', () => {
    const document=circuit([['led',['+','x']],['switch',['y','-']]]);
    expect(codes(document)).toContain('open-circuit');
    expect(codes(document)).not.toContain('control-open');
  });
  it('detects a source short through a closed switch', () => {
    const result=analyzeCircuit(circuit([['switch',['+','-'],{closed:true}]]));
    expect(result.diagnostics[0]?.code).toBe('source-short');
    expect(result.currentMa).toBeUndefined();
  });
  it('keeps button pins 1/2 and 3/4 internally connected before a press', () => {
    const document=circuit([['button',['a','a','b','b']]]);
    expect(getComponentPins(document.components[0]!)).toEqual(['e26','e27','f26','f27']);
    expect(inspectConnectivity(document,'e26')).toContain('e27');
    expect(inspectConnectivity(document,'e26')).not.toContain('f26');
    expect(inspectConnectivity(document,'e26',{pressedButtons:['p0']})).toContain('f27');
    expect(inspectConnectivity(document,'e26')).not.toContain('f26');
  });
  it('conducts only while held and never mutates the saved button instance', () => {
    const document=circuit([['resistor',['+','a']],['led',['a','b']],['button',['b','b','-','-']]]);
    const before=JSON.stringify(document);
    expect(codes(document)).toEqual(['control-open']);
    expect(analyzeCircuit(document,{pressedButtons:['p2']}).complete).toBe(true);
    expect(codes(document)).toEqual(['control-open']);
    expect(JSON.stringify(document)).toBe(before);
  });
});

describe('potentiometer divider', () => {
  it('supports a genuinely unloaded midpoint without merging its resistive terminals', () => {
    const document=circuit([['potentiometer',['+','out','-']]]);
    const result=analyzeCircuit(document);
    expect(result.currentMa).toBeCloseTo(0.45,6);
    expect(result.readings?.p0?.voltageV).toBeCloseTo(2.25,6);
    expect(inspectConnectivity(document,'a1')).not.toContain('a2');
  });
  it('accounts for a loaded divider instead of applying an unloaded ratio', () => {
    const document=circuit([['potentiometer',['+','out','-']],['resistor',['out','-'],{resistance:5000}]]);
    const result=analyzeCircuit(document);
    expect(result.currentMa).toBeCloseTo(0.6,6);
    expect(result.readings?.p1?.voltageV).toBeCloseTo(1.5,6);
    expect(result.readings?.p1?.currentMa).toBeCloseTo(0.3,6);
  });
  it.each([0,100])('handles the %s percent endpoint with no division by zero', position => {
    const document=circuit([['potentiometer',['+','out','-'],{position}]]);
    const result=analyzeCircuit(document);
    expect(result.status).toBe('supported');
    expect(result.currentMa).toBeCloseTo(0.45,6);
    const connected=inspectConnectivity(document,position===0?'a1':'a3');
    expect(connected).toContain('a2');
  });
  it('detects a zero-ohm wiper setting across the battery as a short', () => {
    const result=analyzeCircuit(circuit([['potentiometer',['+','-','unused'],{position:0}]]));
    expect(result.diagnostics[0]?.code).toBe('source-short');
    expect(result.currentMa).toBeUndefined();
  });
});

describe('solver numerical reference cases', () => {
  const edge=(id:string,from:string,to:string,resistance:number):Branch=>({id,part:id,from,to,resistance,drop:0,polar:false});
  it('satisfies Kirchhoff current conservation in an asymmetric resistor bridge', () => {
    const branches=[edge('a','+','x',1000),edge('b','x','-',2000),edge('c','+','y',3000),edge('d','y','-',4000),edge('e','x','y',5000)];
    const result=solveDC(branches,'+','-',4.5)!;
    // Solving 17x - 2y = 45, -12x + 47y = 90 gives x=459/155, y=414/155.
    expect(result.voltages.get('x')).toBeCloseTo(459/155,6);
    expect(result.voltages.get('y')).toBeCloseTo(414/155,6);
    expect(result.currents.get('a')!-result.currents.get('b')!-result.currents.get('e')!).toBeCloseTo(0,10);
    expect(result.currents.get('c')!+result.currents.get('e')!-result.currents.get('d')!).toBeCloseTo(0,10);
  });
});

describe('floating cutoff terminals',()=>{
  it('does not diagnose polarity from an arbitrary floating terminal voltage',()=>{
    for(const kind of ['led','diode','buzzer'] as const){
      const result=analyzeCircuit(circuit([[kind,['floating','+']]]));
      expect(result.diagnostics.map(d=>d.code)).toEqual(['open-circuit']);
      expect(result.currentMa).toBeUndefined();
      expect(result.readings?.p0?.voltageV).toBeUndefined();
    }
  });
  it('does not fabricate a cause when multiple cutoff devices leave the middle node floating',()=>{
    const document=circuit([['resistor',['+','a']],['diode',['a','b']],['led',['-','b']]]);
    const result=analyzeCircuit(document);
    expect(result.status).toBe('unsupported');
    expect(result.currentMa).toBeUndefined();
    expect(result.diagnostics).toEqual([{code:'unsupported',entities:[]}]);
    document.components.push(createComponent('switch','f20',0,'unrelated-switch'));
    expect(analyzeCircuit(document).diagnostics).toEqual(result.diagnostics);
  });
});
