import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { cpus, totalmem, release } from 'node:os';
import { execFileSync } from 'node:child_process';

/** Run this file in its own Playwright invocation, separate from timing samples. */
test('OSC-06: 20 finite cold sessions after controlled-GC baseline', async ({ page, context, browser }) => {
  await page.goto('/tests/oscillator-performance/index.html');
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.oscPerformance.run('REF')); await page.evaluate(() => window.oscPerformance.stop()); }
  const cdp = await context.newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const collect = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
  const heapBytes = [await collect()];
  const evidence = { environment: { osRelease: release(), cpu: cpus()[0]?.model, memoryBytes: totalmem(), chromium: browser.version(), actualTargetHardware: false,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worktreeUncommitted: true,
    scope: 'separate Chromium process; main-thread heap, production Workers terminated after each result; audio never enabled and no AudioContext created' }, heapBytes, finalGrowthBytes: 0, thresholdPass: false };
  for (let i = 0; i < 20; i++) {
    const result = await page.evaluate(() => window.oscPerformance.run('REF'));
    expect(result.outcome).toBe('periodic');
    await page.evaluate(() => window.oscPerformance.stop());
    expect(await page.evaluate(() => window.oscPerformance.activeWorkers())).toBe(0);
    heapBytes.push(await collect());
    evidence.finalGrowthBytes = heapBytes.at(-1)! - heapBytes[0]!;
    evidence.thresholdPass = evidence.finalGrowthBytes <= 10_000_000;
    await writeFile('/tmp/ai-circuit-oscillator-memory-performance.json', JSON.stringify(evidence, null, 2));
  }
  console.log(`controlled-GC main-thread heap growth: ${evidence.finalGrowthBytes} bytes`);
});
