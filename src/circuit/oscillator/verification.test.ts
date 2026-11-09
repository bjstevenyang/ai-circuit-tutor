import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compileOscillator } from './compile';
import { fullVoltages, oscillatorPointEvidence, runOscillatorAnalysis } from './analysis';
import { advanceNumeric, initializeNumeric } from './integration';
import { DEFAULT_PRECISION, domainViolation, STRICT_PRECISION } from './numeric';
import type { Precision } from './numeric';
import type { CompiledOscillator } from './types';
import { oscillatorFixtureDetails } from './fixtures';
import type { OscillatorFixtureName, OscillatorLayout } from './fixtures';

/**
 * Expected measurements are frozen in CIRCUIT_MODEL.md, from the independently
 * implemented five-variable BDF2 reference. This test-only observer keeps a trace;
 * the production implementation must use its bounded two-pass observer instead.
 */
type TracePoint = { timeS: number; values: number[] };
type Trace = { points: TracePoint[]; rises: number[]; sourcePeakA: number; maxResidualA: number; accepted: number; rejected: number; minStepS: number };
const PHASES = [.01, .10, .20, .40, .60, .80, .90, .99] as const;
const REFERENCE_PHASE_PABD = [
  [1.362087699, .770330496, .565630859, 1.334503247],
  [2.407465040, .715828111, 1.624062933, 2.331650478],
  [8.991157900, -1.518808405, 8.395987084, .003357025],
  [8.996119348, -.945393882, 8.574209247, .001457185],
  [8.996336874, -.401933458, 8.710241629, .001375463],
  [8.996537072, .111831160, 8.838764516, .001300291],
  [8.996632772, .358086596, 8.900271757, .001264171],
  [8.995832187, .569706077, 8.572145166, .000897620],
] as const;
const REFERENCE_RISES = [.0007541498020748211, .004220366770616388, .007686583925987580, .011152801241322686, .014619018687528108];

function compile(name: OscillatorFixtureName = 'REF', layout: OscillatorLayout = 0) {
  const details = oscillatorFixtureDetails(layout, name);
  const result = compileOscillator(details.document);
  if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.result)}`);
  const index = (label: string) => {
    const endpoint = details.nodeEndpoints[label]![0]!;
    const id = result.compiled.endpointNodes[endpoint]!;
    const i = result.compiled.nodeIds.indexOf(id);
    if (i < 0) throw new Error(`Expected unknown fixture node ${label}`);
    return i;
  };
  return { ...details, compiled: result.compiled, indices: ['P', 'A', 'B', 'D', 'S'].map(index) };
}

/** Test-side measurement uses actual accepted half-steps and explicit R3/SPK laws. */
function measure(compiled: CompiledOscillator, indices: number[], stopS: number, precision: Precision): Trace {
  let state = initializeNumeric(compiled.model, precision);
  const points: TracePoint[] = [{ timeS: 0, values: [0, 0, 0, 0, 0, 0] }], rises: number[] = [];
  let sourcePeakA = 0, maxPortDifferenceA = 0, allFinite = true, allInDomain = true;
  while (state.timeS < stopS) {
    const batch = advanceNumeric(compiled.model, state, stopS, compiled.pairs, precision);
    if (!batch.ok) throw new Error(JSON.stringify({ failure: batch.failure, state: batch.state }));
    for (const point of batch.points) {
      const full = fullVoltages(compiled, point), pabds = indices.map(i => full[i]!);
      const sourceA = (9 * Math.min(1, point.timeS / 1e-4) - pabds[0]!) / 47;
      const speakerV = pabds[3]! - pabds[4]!;
      const values = [...pabds.slice(0, 4), speakerV, sourceA];
      const previous = points.at(-1)!;
      if (previous.values[3]! < 1 && pabds[3]! >= 1) {
        rises.push(previous.timeS + (point.timeS - previous.timeS) * (1 - previous.values[3]!) / (pabds[3]! - previous.values[3]!));
      }
      sourcePeakA = Math.max(sourcePeakA, sourceA);
      maxPortDifferenceA = Math.max(maxPortDifferenceA, Math.abs(oscillatorPointEvidence(compiled, point).sourceCurrentA - sourceA));
      allFinite &&= values.every(Number.isFinite) && point.derivative.every(Number.isFinite);
      allInDomain &&= domainViolation(compiled.model, point.voltage, point.timeS) === null;
      points.push({ timeS: point.timeS, values });
    }
    state = batch.state;
  }
  expect(allFinite).toBe(true);
  expect(allInDomain).toBe(true);
  expect(maxPortDifferenceA).toBeLessThanOrEqual(1e-12);
  expect(state.maxResidualA).toBeLessThanOrEqual(1e-9);
  expect(state.minStepS).toBeGreaterThanOrEqual(1e-11);
  return { points, rises, sourcePeakA, maxResidualA: state.maxResidualA, accepted: state.accepted, rejected: state.rejected, minStepS: state.minStepS };
}

/** Independent test-side interpolation/integration; no production cycle statistics. */
function at(points: TracePoint[], timeS: number): number[] {
  let lo = 0, hi = points.length - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid]!.timeS < timeS) lo = mid + 1; else hi = mid; }
  if (lo === 0) return [...points[0]!.values];
  const a = points[lo - 1]!, b = points[lo]!, f = (timeS - a.timeS) / (b.timeS - a.timeS);
  return a.values.map((value, i) => value + f * (b.values[i]! - value));
}
function integrate(points: TracePoint[], startS: number, endS: number, field: number) {
  let timeS = startS, value = at(points, startS)[field]!, area = 0, square = 0;
  for (const point of points) {
    if (point.timeS <= startS) continue;
    const nextS = Math.min(point.timeS, endS), next = point.timeS >= endS ? at(points, endS)[field]! : point.values[field]!;
    const dt = nextS - timeS;
    area += dt * (value + next) / 2;
    square += dt * (value * value + next * next) / 2;
    timeS = nextS; value = next;
    if (timeS >= endS) break;
  }
  const mean = area / (endS - startS);
  return { mean, acRms: Math.sqrt(Math.max(0, square / (endS - startS) - mean * mean)) };
}
const withinRelative = (actual: number, expected: number, fraction: number) => expect(Math.abs(actual / expected - 1), `${actual} vs ${expected}`).toBeLessThanOrEqual(fraction);

describe('OSC-02/03 independent v2 numerical acceptance', () => {
  it.each([['default', DEFAULT_PRECISION], ['strict', STRICT_PRECISION]] as const)('REF %s: five rises, eight phases, AC RMS and supply currents', (_name, precision) => {
    const { compiled, indices } = compile();
    const trace = measure(compiled, indices, .015, precision);
    expect(trace.rises.length).toBeGreaterThanOrEqual(5);
    withinRelative(trace.rises[0]!, REFERENCE_RISES[0]!, .01);
    const last = trace.rises.slice(-5), period = (last[4]! - last[0]!) / 4;
    withinRelative(period, .003466217221363, .005);
    const startS = last[3]!, endS = last[4]!;
    for (const [i, phase] of PHASES.entries()) {
      const values = at(trace.points, startS + phase * (endS - startS));
      for (let node = 0; node < 4; node++) expect(Math.abs(values[node]! - REFERENCE_PHASE_PABD[i]![node]!), `phase ${phase} node ${node}`).toBeLessThanOrEqual(.1);
    }
    const d = integrate(trace.points, startS, endS, 3), speaker = integrate(trace.points, startS, endS, 4), supply = integrate(trace.points, startS, endS, 5);
    withinRelative(d.mean, .379789505321, .02);
    withinRelative(d.acRms, .821642813123, .02);
    withinRelative(speaker.acRms, .365174583610, .02);
    withinRelative(speaker.acRms / 8, .045646822951, .02);
    withinRelative(supply.mean, .026083652922, .02);
    withinRelative(trace.sourcePeakA, .174423106943, .02);
    expect(trace.rejected).toBeGreaterThan(0);
  }, 60000);

  it('records the unoptimized explicit compiler node table and canonical hash', () => {
    const { compiled, nodeEndpoints } = compile();
    const table = Object.fromEntries(Object.entries(nodeEndpoints).map(([label, endpoints]) => [label, {
      endpoints, node: compiled.endpointNodes[endpoints[0]!]!, index: compiled.nodeIds.indexOf(compiled.endpointNodes[endpoints[0]!]!),
    }]));
    expect(compiled.unknowns).toBe(5);
    expect(compiled.model.size).toBe(4);
    expect(Object.keys(table).sort()).toEqual(['A', 'B', 'D', 'GND', 'P', 'S', 'VP']);
    expect(createHash('sha256').update(JSON.stringify(table)).digest('hex')).toBe('adcfe59798de50b850409c6191daba5b11226b95c630b9a665c900e43bfe0e36');
  });

  const variants = [
    ['C47', .015, 10, .001614128583],
    ['C220', .025, 4, .007627159631],
    ['R100', .015, 5, .003026331160],
    ['R240', .030, 5, .006210732274],
    ['L26', .015, 4, .004542393184],
  ] as const;
  it.each(variants)('%s: independent window crossing count and period; full 40ms is periodic', (name, windowS, count, expectedPeriodS) => {
    const { compiled, indices } = compile(name);
    const trace = measure(compiled, indices, windowS, DEFAULT_PRECISION);
    expect(trace.rises).toHaveLength(count);
    const recent = trace.rises.slice(-5);
    withinRelative((recent.at(-1)! - recent[0]!) / (recent.length - 1), expectedPeriodS, .01);
    const result = runOscillatorAnalysis(compiled);
    expect(result.outcome, JSON.stringify(result)).toBe('periodic');
    withinRelative(1 / result.speaker!.frequencyHz!, expectedPeriodS, .01);
    expect(result.timeS).toBe(.04);
    expect(result.stats!.maxResidualA).toBeLessThanOrEqual(1e-9);
    expect(result.stats!.accepted).toBeLessThanOrEqual(1_000_000);
    expect(result.stats!.rejected).toBeLessThanOrEqual(10_000);
  }, 60000);

  it.each([['REF', .003466217221363], ['C47', .001614032895], ['C220', .007627086287]] as const)('%s: strict boundary completes full 40ms in the original numerical budget', (name, expectedPeriodS) => {
    const { compiled } = compile(name);
    const result = runOscillatorAnalysis(compiled, { precision: STRICT_PRECISION });
    expect(result.outcome, JSON.stringify(result)).toBe('periodic');
    withinRelative(1 / result.speaker!.frequencyHz!, expectedPeriodS, .01);
    expect(result.timeS).toBe(.04);
    expect(result.stats!.accepted).toBeLessThanOrEqual(1_000_000);
    expect(result.stats!.rejected).toBeLessThanOrEqual(10_000);
    expect(result.stats!.minStepS).toBeGreaterThanOrEqual(1e-11);
    expect(result.stats!.maxResidualA).toBeLessThanOrEqual(1e-9);
    expect(result.stats!.maxConductionA).toBeLessThanOrEqual(.25);
    expect(Number.isFinite(result.stats!.maxDisplacementA)).toBe(true);
  }, 60000);
});
