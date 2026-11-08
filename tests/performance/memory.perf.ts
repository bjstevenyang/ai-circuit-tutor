import {test,expect} from '@playwright/test';
import {rcExperiment,piezoExperiment} from '../fixtures/stage2';
import {audioCounters,openFixture,run,stop,waitStopped,fixtureHash,writeEvidence} from './helpers';

for(const mode of ['RC','PIEZO'] as const)test(`M-${mode}: ten real foreground 60s sessions with controlled GC`,async({page,context,browser})=>{
  await audioCounters(page);const d=mode==='RC'?rcExperiment():piezoExperiment();await openFixture(page,d);
  if(mode==='PIEZO')await page.getByRole('button',{name:'启用蜂鸣器声音',exact:true}).click();
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('HeapProfiler.enable');
  const samples:{session:number;heap:number;simulatedEnd:string|null;audio:unknown}[]=[];
  for(let i=1;i<=10;i++){
    await run(page);await page.waitForTimeout(60000);const simulatedEnd=mode==='RC'?await page.getByTestId('simulation-time').textContent():null;
    if(await page.getByRole('button',{name:'停止运行',exact:true}).count())await stop(page);await waitStopped(page);
    await page.waitForTimeout(1000);await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(100);await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(100);
    const metrics=await cdp.send('Performance.getMetrics'),heap=metrics.metrics.find(m=>m.name==='JSHeapUsedSize')!.value;
    const audio=await page.evaluate(()=>{const data=(window as unknown as {audioEvidence:Record<string,unknown>}).audioEvidence;return {...data};});
    samples.push({session:i,heap,simulatedEnd,audio});expect((audio as {timers:unknown[]}).timers).toHaveLength(0);
    if(mode==='PIEZO'){const a=audio as {started:number;stopped:number;disconnected:number;contexts:number};expect(a.started).toBe(a.stopped);expect(a.stopped).toBe(a.disconnected);expect(a.contexts).toBe(1);}
    await writeEvidence(`memory-${mode}`,{browser:browser.version(),fixtureHash:fixtureHash(d),samples});
    console.log(`M-${mode} ${i}/10: heap=${heap}, growth=${heap-samples[0]!.heap}`);
    if(i>1)expect(heap-samples[0]!.heap).toBeLessThanOrEqual(10000000);
  }
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  if(mode==='PIEZO')expect(await page.evaluate(()=>(window as unknown as {audioEvidence:{closed:number}}).audioEvidence.closed)).toBe(1);
});
