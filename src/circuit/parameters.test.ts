import { describe, expect, it } from 'vitest';
import { analyzeCircuit, createComponent, createEmptyDocument } from './index';
import type { CircuitDocument } from './index';
import { validCircuit, makeWire } from '../../tests/fixtures/circuits';

describe('variable supply and custom resistance',()=>{
  it.each([1.5,2,3,4.5,6,9])('solves the LED reference circuit at %s volts',supplyVoltage=>{
    const result=analyzeCircuit({...validCircuit(),supplyVoltage});
    expect(result.currentMa).toBeCloseTo(Math.max(0,supplyVoltage-2)/330*1000,6);
    expect(result.ledOn).toBe(supplyVoltage>2);
    expect(result.diagnostics.map(d=>d.code)).toEqual(supplyVoltage<=2?['insufficient-voltage']:supplyVoltage===9?['overcurrent']:[]);
  });
  it('recognizes the same three-LED circuit as blocked at 6 V and conducting at 9 V',()=>{
    const document={...createEmptyDocument(),supplyVoltage:6,components:[createComponent('resistor','a1',0,'r'),createComponent('led','c4',0,'l1'),createComponent('led','e5',0,'l2'),createComponent('led','a6',0,'l3')],wires:[makeWire('battery:+','b1'),makeWire('b7','battery:-')]};
    expect(analyzeCircuit(document).diagnostics[0]?.code).toBe('insufficient-voltage');
    document.supplyVoltage=9;
    const result=analyzeCircuit(document);
    expect(result.complete).toBe(true);
    expect(result.currentMa).toBeCloseTo(3000/330,6);
  });
  it.each([10,470,470.5,1000000])('solves a valid custom resistance %s ohms',resistance=>{
    const document=validCircuit();document.components[0]!.resistance=resistance;
    expect(analyzeCircuit(document).currentMa).toBeCloseTo(2500/resistance,6);
  });
  it.each([1.5,3,4.5,5,6,9])('checks buzzer operating voltage at %s V',supplyVoltage=>{
    const document={...createEmptyDocument(),supplyVoltage,components:[createComponent('buzzer','a1',0,'buzz')],wires:[makeWire('battery:+','b1'),makeWire('b3','battery:-')]};
    const result=analyzeCircuit(document);
    expect(result.currentMa).toBeCloseTo(supplyVoltage,6);
    expect(result.readings?.buzz?.on).toBe(supplyVoltage>=3&&supplyVoltage<=5);
    expect(result.diagnostics.map(d=>d.code)).toEqual(supplyVoltage<3?['buzzer-undervoltage']:supplyVoltage>5?['buzzer-overvoltage']:[]);
  });
  it.each([Number.NaN,Infinity,-1,0,1.49,9.01,undefined,'4.5'])('rejects malformed or out-of-range v3 supply %s',supplyVoltage=>{
    const document={...validCircuit(),supplyVoltage} as unknown as CircuitDocument;
    const result=analyzeCircuit(document);
    expect(result.status).toBe('unsupported');expect(result.currentMa).toBeUndefined();expect(result.complete).toBe(false);
  });
  it('does not invent finite short-circuit current at a higher supply voltage',()=>{
    const result=analyzeCircuit({...createEmptyDocument(),supplyVoltage:9,wires:[makeWire('battery:+','b1'),makeWire('battery:-','c1')]});
    expect(result.diagnostics[0]?.code).toBe('source-short');expect(result.currentMa).toBeUndefined();
  });
});
