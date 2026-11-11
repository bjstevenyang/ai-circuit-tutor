import type { CircuitDocument, ModelProfileId } from './types';

export const profileOf = (document: CircuitDocument) => document.schemaVersion===5 ? document.modelProfileId==='oscillator-spice-gp-v1'?'oscillator-em-v2':document.modelProfileId ?? 'legacy-stage2-v1' : 'legacy-stage2-v1';
export const isOscillatorProfile = (profile: ModelProfileId) => profile === 'oscillator-em-v1' || profile === 'oscillator-em-v2' || profile === 'oscillator-spice-gp-v1';
export const isKnownModelProfile = (profile: unknown): profile is ModelProfileId => profile === 'legacy-stage2-v1' || profile === 'oscillator-em-v1' || profile === 'oscillator-em-v2' || profile === 'oscillator-spice-gp-v1';
export const DEFAULT_CAPACITANCE_F = 100e-9;
/** Numeric input bounds; use isCapacitanceForProfile to reject gaps inside them. */
export function capacitanceRangeForProfile(profile:ModelProfileId):readonly [number,number] {
  if((profile==='oscillator-em-v2'||profile==='oscillator-spice-gp-v1'))return [47e-9,1e-6];
  return profile==='oscillator-em-v1'?[47e-9,220e-9]:[DEFAULT_CAPACITANCE_F,1000e-6];
}
export function capacitanceRange(document: CircuitDocument): readonly [number, number] {
  return capacitanceRangeForProfile(profileOf(document));
}
/** The original model adds exactly 100nF; intermediate unsupported capacities stay invalid. */
export function isCapacitanceForProfile(value:unknown,profile:ModelProfileId):value is number {
  if(typeof value!=='number'||!Number.isFinite(value))return false;
  const [min,max]=capacitanceRangeForProfile(profile);
  return isOscillatorProfile(profile)?value>=min&&value<=max:value===DEFAULT_CAPACITANCE_F||value>=10e-6&&value<=max;
}
export function isCapacitance(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    (value >= 47e-9 && value <= 1e-6 || value >= 10e-6 && value <= 1000e-6);
}

export const DEFAULT_SUPPLY_VOLTAGE = 4.5;
export const MIN_SUPPLY_VOLTAGE = 1.5;
export const MAX_SUPPLY_VOLTAGE = 9;
export const MIN_RESISTANCE = 10;
export const MAX_RESISTANCE = 1_000_000;
export const LED_CURRENT_LIMIT_MA = 20;
export const isResistance = (value: unknown): value is number => typeof value==='number' && Number.isFinite(value) && value>=MIN_RESISTANCE && value<=MAX_RESISTANCE;
export const isSupplyVoltage = (value: unknown): value is number => typeof value==='number' && Number.isFinite(value) && value>=MIN_SUPPLY_VOLTAGE && value<=MAX_SUPPLY_VOLTAGE;
export function supplyVoltageOf(document: CircuitDocument): number { return document.supplyVoltage ?? DEFAULT_SUPPLY_VOLTAGE; }
