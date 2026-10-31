import { describe, expect, it } from 'vitest';
import { getDiagnosticCopy, nextHintLevel } from './index';
import type { DiagnosticCode } from '../circuit';

const codes: DiagnosticCode[] = ['source-short', 'missing-resistor', 'resistor-bypassed', 'led-bypassed', 'open-circuit', 'reversed-led', 'overcurrent', 'unsupported', 'missing-led'];

describe('reviewed progressive teaching guidance', () => {
  it.each(codes)('provides exactly three ordered, distinct hints for %s', code => {
    const copy = getDiagnosticCopy(code);
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.description.length).toBeGreaterThan(0);
    expect(copy.hints).toHaveLength(3);
    expect(new Set(copy.hints).size).toBe(3);
    expect(copy.hints.every(hint => hint.trim().length > 0)).toBe(true);
  });

  it('reveals only one step per explicit request and stops after the repair', () => {
    let level = 0;
    const copy = getDiagnosticCopy('reversed-led');
    expect(copy.hints.slice(0, level)).toEqual([]);
    level = nextHintLevel(level);
    expect(copy.hints.slice(0, level)).toEqual([copy.hints[0]]);
    expect(copy.hints[0]).not.toContain('交换');
    level = nextHintLevel(level);
    expect(copy.hints.slice(0, level)).toHaveLength(2);
    expect(copy.hints[1]).not.toContain('交换');
    level = nextHintLevel(level);
    expect(copy.hints.slice(0, level)[2]).toContain('交换');
    expect(nextHintLevel(level)).toBe(3);
  });

  it('keeps approximation and unsupported-topology explanations honest', () => {
    expect(getDiagnosticCopy('source-short').description).toContain('没有可用的有限电流估算');
    expect(getDiagnosticCopy('overcurrent').description).toContain('不是所有 LED');
    expect(getDiagnosticCopy('unsupported').hints[0]).toContain('不代表真实电路必然不能工作');
  });

  it.each([-1, Number.NaN, Number.NEGATIVE_INFINITY])('normalizes invalid progress %s', level => {
    expect(nextHintLevel(level)).toBe(1);
  });
});
