import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { cpus, totalmem, arch, release } from 'node:os';
import { oscillatorVariant } from '../../src/circuit/oscillator/fixtures';
import type { OscillatorFixtureName } from '../../src/circuit/oscillator/fixtures';
import type { RunSample, StopSample } from './harness';

const scenarios: OscillatorFixtureName[] = ['REF', 'C47', 'C220', 'R100', 'R240', 'L26', 'NOC', 'MAX12', 'OVER13'];
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[18]!;
const hardware = () => ({ osRelease: release(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length,
  memoryBytes: totalmem(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  targetHardware: 'Apple M1 / 8GB', actualTargetHardware: cpus()[0]?.model === 'Apple M1' && totalmem() === 8 * 1024 ** 3 });
const workerBuildHash = async () => {
  const assets = '/tmp/ai-circuit-oscillator-benchmark-dist/assets';
  const name = (await readdir(assets)).find(name => name.startsWith('oscillatorWorker-'))!;
  return createHash('sha256').update(await readFile(`${assets}/${name}`)).digest('hex');
};

test('OSC-06: fresh production Worker, all nine fixed inputs, 3 warmups and 20 measured cold runs', async ({ page, browser }) => {
  await page.goto('/tests/oscillator-performance/index.html');
  const evidence = { environment: { ...hardware(), workerBundleSha256: await workerBuildHash(), chromium: browser.version(), viewport: { width: 1440, height: 900 }, cpuThrottling: 'none',
    timingBoundary: 'workerMs: production Worker receipt through compile/all passes/classification; renderedMs: independent harness click handler through next result paint; product React UI timing measured separately',
    worktreeUncommitted: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0 }, scenarios: [] as { name: OscillatorFixtureName; sha256: string; warmups: RunSample[]; samples: RunSample[]; coreP95: number | null; renderedP95: number | null; coreThresholdPass: boolean | null }[] };
  for (const name of scenarios) {
    const warmups: RunSample[] = [], samples: RunSample[] = [];
    const record = { name, sha256: createHash('sha256').update(JSON.stringify(oscillatorVariant(name))).digest('hex'), warmups, samples,
      coreP95: null as number | null, renderedP95: null as number | null, coreThresholdPass: null as boolean | null };
    evidence.scenarios.push(record);
    for (let i = 0; i < 23; i++) {
      const sample = await page.evaluate(name => window.oscPerformance.run(name), name);
      (i < 3 ? warmups : samples).push(sample);
      await writeFile('/tmp/ai-circuit-oscillator-performance.json', JSON.stringify(evidence, null, 2));
      expect(sample.activeWorkers).toBe(0);
      expect(sample.displaySamples).toBeLessThanOrEqual(4096);
      expect(sample.outcome, `${name} run ${i}`).toBe(name === 'OVER13' ? 'unsupported-topology' : name === 'NOC' ? 'settled-DC' : 'periodic');
      if (name !== 'OVER13') {
        expect(sample.timeS).toBe(.04);
        expect(sample.stats!.accepted).toBeLessThanOrEqual(1_000_000);
        expect(sample.stats!.rejected).toBeLessThanOrEqual(10_000);
      } else expect(sample.stats).toBeNull();
    }
    const coreP95 = p95(samples.map(sample => sample.workerMs));
    record.coreP95 = coreP95; record.renderedP95 = p95(samples.map(sample => sample.renderedMs));
    record.coreThresholdPass = name === 'OVER13' ? null : coreP95 <= 2000;
    await writeFile('/tmp/ai-circuit-oscillator-performance.json', JSON.stringify(evidence, null, 2));
    console.log(`${name}: core P95=${coreP95.toFixed(2)}ms; harness render P95=${p95(samples.map(sample => sample.renderedMs)).toFixed(2)}ms`);
  }
});

test('OSC-06: cancellation in each production analysis pass, 20 samples each', async ({ page, browser }) => {
  await page.goto('/tests/oscillator-performance/index.html');
  const evidence = { environment: { ...hardware(), workerBundleSha256: await workerBuildHash(), chromium: browser.version(), timingBoundary: 'harness stop event through generation invalidation, Worker.terminate, stopped DOM and next animation frame; no audio enabled' },
    passes: [] as { pass: 1 | 2; samples: StopSample[]; p95Ms: number; thresholdPass: boolean }[] };
  for (const pass of [1, 2] as const) {
    const samples: StopSample[] = [];
    for (let i = 0; i < 20; i++) {
      const sample = await page.evaluate(pass => window.oscPerformance.stopDuringPass(pass), pass);
      samples.push(sample); expect(sample.activeWorkers).toBe(0); expect(sample.staleResult).toBe(false);
    }
    const p95Ms = p95(samples.map(sample => sample.stopMs));
    evidence.passes.push({ pass, samples, p95Ms, thresholdPass: p95Ms <= 100 });
    await writeFile('/tmp/ai-circuit-oscillator-stop-performance.json', JSON.stringify(evidence, null, 2));
    console.log(`pass ${pass}: stop P95=${p95Ms.toFixed(2)}ms`);
  }
});
