import type { OscillatorResult } from '../circuit/oscillator/types';
export const OSCILLATOR_DEADLINE_MS=5000;
export const oscillatorFailure=(reason:string,timeS=0):OscillatorResult=>({outcome:'resource-limit',reason,timeS,entities:[]});
