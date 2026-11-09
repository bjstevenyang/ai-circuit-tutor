import { OscillatorSession } from '../../src/app/oscillatorSession';
import type { OscillatorProgress, OscillatorResult } from '../../src/circuit/oscillator/types';
import { oscillatorVariant } from '../../src/circuit/oscillator/fixtures';
import type { OscillatorFixtureName } from '../../src/circuit/oscillator/fixtures';

export type RunSample = {
  scenario: OscillatorFixtureName; workerMs: number; renderedMs: number; feedbackMs: number;
  outcome: OscillatorResult['outcome']; timeS: number; stats: OscillatorResult['stats'] | null;
  activeWorkers: number; displaySamples: number;
};
export type StopSample = { pass: 1 | 2; stopMs: number; activeWorkers: number; staleResult: boolean };
const status = document.querySelector<HTMLOutputElement>('#status')!;
const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const workers = new Set<Worker>();
let sequence = 0;
const session = new OscillatorSession(() => {
  const worker = new Worker(new URL('../../src/app/oscillatorWorker.ts', import.meta.url), { type: 'module' });
  workers.add(worker);
  const terminate = worker.terminate.bind(worker);
  worker.terminate = () => { workers.delete(worker); terminate(); };
  return worker;
});
let currentProgress: OscillatorProgress | undefined;
let running = false;
let lastResult: OscillatorResult | undefined;
let configuredName: OscillatorFixtureName = 'REF';
let runResolve: ((sample: RunSample) => void) | undefined;

const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
runButton.onclick = () => {
  const started = performance.now();
  status.textContent = '计算中';
  const feedbackMs = performance.now() - started;
  currentProgress = undefined; lastResult = undefined; running = true;
  session.start(oscillatorVariant(configuredName), {}, { sessionId: ++sequence, documentRevision: sequence }, (result, workerMs) => {
    running = false; lastResult = result; status.textContent = result.outcome;
    void paint().then(() => {
      runResolve?.({ scenario: configuredName, workerMs, renderedMs: performance.now() - started, feedbackMs,
        outcome: result.outcome, timeS: result.timeS, stats: result.stats ?? null, activeWorkers: workers.size, displaySamples: result.samples?.length ?? 0 });
      runResolve = undefined;
    });
  }, progress => { currentProgress = progress; status.textContent = `计算中 ${progress.pass}/2`; });
};
stopButton.onclick = () => { session.cancel(); running = false; currentProgress = undefined; lastResult = undefined; status.textContent = '已停止'; };

const harness = {
  run(name: OscillatorFixtureName): Promise<RunSample> {
    configuredName = name;
    return new Promise(resolve => { runResolve = resolve; runButton.click(); });
  },
  stop() { stopButton.click(); },
  activeWorkers: () => workers.size,
  async stopDuringPass(pass: 1 | 2): Promise<StopSample> {
    configuredName = 'REF'; runResolve = undefined; runButton.click();
    const waiting = performance.now();
    while (currentProgress?.pass !== pass) {
      if (!running || performance.now() - waiting > 5000) throw new Error(`Cannot observe pass ${pass}`);
      await new Promise<void>(resolve => setTimeout(resolve, 1));
    }
    const started = performance.now();
    stopButton.click();
    await paint();
    const stopMs = performance.now() - started;
    await new Promise<void>(resolve => setTimeout(resolve, 150));
    return { pass, stopMs, activeWorkers: workers.size, staleResult: lastResult !== undefined || status.textContent !== '已停止' };
  },
};
declare global { interface Window { oscPerformance: typeof harness } }
window.oscPerformance = harness;
