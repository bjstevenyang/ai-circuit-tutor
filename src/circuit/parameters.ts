import type { CircuitDocument } from './types';

export const DEFAULT_SUPPLY_VOLTAGE = 4.5;
export const MIN_SUPPLY_VOLTAGE = 1.5;
export const MAX_SUPPLY_VOLTAGE = 9;
export const MIN_RESISTANCE = 10;
export const MAX_RESISTANCE = 1_000_000;
export const LED_CURRENT_LIMIT_MA = 20;
export const isResistance = (value: unknown): value is number => typeof value==='number' && Number.isFinite(value) && value>=MIN_RESISTANCE && value<=MAX_RESISTANCE;
export const isSupplyVoltage = (value: unknown): value is number => typeof value==='number' && Number.isFinite(value) && value>=MIN_SUPPLY_VOLTAGE && value<=MAX_SUPPLY_VOLTAGE;
export function supplyVoltageOf(document: CircuitDocument): number { return document.supplyVoltage ?? DEFAULT_SUPPLY_VOLTAGE; }
