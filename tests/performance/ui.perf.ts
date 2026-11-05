import {test,expect} from '@playwright/test';
import type {Page,Locator} from '@playwright/test';
import type {CircuitDocument} from '../../src/circuit';
import {rgbExperiment,npnExperiment,rcExperiment,piezoExperiment,maxExperiment} from '../fixtures/stage2';
import {openFixture,run,stop,writeEvidence,fixtureHash,audioCounters} from './helpers';

type Sample={ms:number;audioMs?:number};
declare global {interface Window {interactionSample:{done:boolean;started:number|null;ms:number;audioMs?:number}}}

/** Test instrumentation only; event-entry → matching revision's submitted DOM frame. */
async function measure(page:Page,control:Locator,event:'click'|'keydown'|'change',needle:string,action:()=>Promise<unknown>,stopping=false,partId='',audioRequired=false):Promise<Sample>{
  await control.focus();
  await page.evaluate(({event,needle,stopping,partId,audioRequired})=>{
    const status=document.querySelector('#simulation-status')!,revision=status.getAttribute('data-revision'),session=status.getAttribute('data-session');
    const sample={done:false,started:null as number|null,ms:0,audioMs:0};window.interactionSample=sample;
    const listener=()=>{sample.started=performance.now();document.removeEventListener(event,listener,true);requestAnimationFrame(poll);};
    const poll=()=>{
      const now=document.querySelector('#simulation-status')!,changed=stopping?now.getAttribute('data-session')!==session:now.getAttribute('data-revision')!==revision;
      const content=stopping?now.textContent:document.querySelector(partId?`[data-part-reading="${partId}"]`:'.stage-readings')?.textContent;
      const audio=(window as unknown as {audioEvidence?:{started:number;stopped:number;disconnected:number;audioTime:number;readyAudioTime:number;lastTargetHz:number}}).audioEvidence;
      const cleaned=!stopping||!audio||audio.started===audio.stopped&&audio.stopped===audio.disconnected;
      const audioReady=!audioRequired||!!audio&&audio.lastTargetHz===500&&audio.audioTime>=audio.readyAudioTime;
      if(changed&&content?.includes(needle)&&cleaned&&audioReady){sample.ms=performance.now()-sample.started!;if(audioRequired)sample.audioMs=sample.ms;sample.done=true;}else requestAnimationFrame(poll);
    };
    document.addEventListener(event,listener,true);
  },{event,needle,stopping,partId,audioRequired});
  await action();await page.waitForFunction(()=>window.interactionSample.done);
  return page.evaluate(()=>({ms:window.interactionSample.ms,...(window.interactionSample.audioMs?{audioMs:window.interactionSample.audioMs}:{})}));
}
const byAnchor=(page:Page,kind:string,anchor:string)=>page.getByRole('button',{name:new RegExp(`${kind}.*锚点 ${anchor}$`)});
function summary(values:Sample[]){const times=values.map(s=>s.ms);return {times,p95:[...times].sort((a,b)=>a-b)[94]!};}

for(const name of ['B-RGB','B-NPN','B-PIEZO','B-MAX'] as const)for(const input of ['pointer','keyboard'] as const)test(`${name} UI and Stop ${input}: fixed 100 sample groups`,async({page,browser})=>{
  await audioCounters(page,true);
  const d:CircuitDocument=name==='B-RGB'?rgbExperiment():name==='B-NPN'?npnExperiment(10000,false):name==='B-PIEZO'?piezoExperiment():maxExperiment();
  if(name==='B-RGB')d.components.find(p=>p.id==='sR')!.closed=false;
  if(name==='B-PIEZO')d.signalFrequencyHz=250;
  if(name==='B-MAX')d.components.find(p=>p.id==='baseR1')!.resistance=100000;
  await openFixture(page,d);
  if(name==='B-PIEZO')await page.getByRole('button',{name:'启用蜂鸣器声音',exact:true}).click();
  const samples:Sample[]=[],stops:Sample[]=[];
  for(let i=0;i<110;i++){
    const selected=d.components.find(p=>p.id===(name==='B-RGB'?'sR':name==='B-NPN'?'s':'baseR1'));
    if(selected)await byAnchor(page,selected.kind==='resistor'?'电阻':'通断开关',selected.anchor).click();
    await run(page);
    const toggle=name==='B-RGB'||name==='B-NPN';
    const control=toggle?byAnchor(page,'通断开关',selected!.anchor):page.getByLabel(name==='B-PIEZO'?'驱动频率':'所选电阻阻值');
    const event=toggle?(input==='pointer'?'click':'keydown'):'change';
    const action=toggle?()=>input==='pointer'?control.click():control.press('Space'):()=>input==='keyboard'?control.press(name==='B-PIEZO'?'ArrowDown':'ArrowUp'):control.selectOption(name==='B-PIEZO'?'500':'10000');
    const sample=await measure(page,control,event,name==='B-RGB'?'混色 157, 122, 122':name==='B-NPN'?'饱和':name==='B-PIEZO'?'受驱动，500 Hz':'饱和',action,false,name==='B-MAX'?'t1':'',name==='B-PIEZO');
    const button=page.getByRole('button',{name:'停止运行',exact:true}),stopped=await measure(page,button,input==='pointer'?'click':'keydown','已停止',()=>input==='pointer'?button.click():button.press('Space'),true);
    if(i>=10){samples.push(sample);stops.push(stopped);}
    // Restore complete initial configuration while stopped; no old result is reused.
    if(toggle)await page.getByRole('button',{name:'开关接通',exact:true}).click();
    else await control.selectOption(name==='B-PIEZO'?'250':'100000');
  }
  const result={browser:browser.version(),fixtureHash:fixtureHash(d),name,input,ui:summary(samples),stop:summary(stops),inputEvent:name==='B-PIEZO'||name==='B-MAX'?input==='pointer'?'native select control change':'keyboard arrow':'button activation'};
  await writeEvidence(`ui-${name}-${input}`,result);console.log(`${name}/${input}: UI ${result.ui.p95} ms, Stop ${result.stop.p95} ms`);
  if(name==='B-PIEZO')for(const sample of samples)expect(sample.audioMs).toBeLessThanOrEqual(100);expect(result.ui.p95).toBeLessThanOrEqual(200);expect(result.stop.p95).toBeLessThanOrEqual(100);
});

test('B-RC UI/Stop: fresh t=5s intervals and ten real background pauses',async({page,browser})=>{
  test.setTimeout(1800000);
  const d=rcExperiment();await openFixture(page,d);
  const charge=d.components.find(p=>p.id==='sc')!,discharge=d.components.find(p=>p.id==='sd')!;
  const sc=byAnchor(page,'通断开关',charge.anchor),sd=byAnchor(page,'通断开关',discharge.anchor),openSamples:Sample[]=[],closeSamples:Sample[]=[],stops:Sample[]=[];
  for(let i=0;i<110;i++){
    await run(page);await page.waitForFunction(()=>Number(document.querySelector('[data-testid="simulation-time"]')?.textContent?.match(/[\d.]+/)?.[0])>=5);
    const opened=await measure(page,sc,'click','保持',()=>sc.click()),closed=await measure(page,sd,'click','放电',()=>sd.click());
    if(i>=10){openSamples.push(opened);closeSamples.push(closed);}
    await stop(page);await sc.click();await page.getByRole('button',{name:'开关接通',exact:true}).click();await sd.click();await page.getByRole('button',{name:'开关接通',exact:true}).click();
    await run(page);await page.waitForFunction(()=>Number(document.querySelector('[data-testid="simulation-time"]')?.textContent?.match(/[\d.]+/)?.[0])>=5);
    const button=page.getByRole('button',{name:'停止运行',exact:true});const stopped=await measure(page,button,'click','已停止',()=>button.click(),true);if(i>=10)stops.push(stopped);
  }
  const background:{before:number;after:number}[]=[];
  for(let i=0;i<10;i++){
    await run(page);await page.waitForFunction(()=>Number(document.querySelector('[data-testid="simulation-time"]')?.textContent?.match(/[\d.]+/)?.[0])>=5);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const before=Number((await page.getByTestId('simulation-time').textContent())!.match(/[\d.]+/)![0]);await page.waitForTimeout(10000);
    expect(Number((await page.getByTestId('simulation-time').textContent())!.match(/[\d.]+/)![0])).toBe(before);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(30);const after=Number((await page.getByTestId('simulation-time').textContent())!.match(/[\d.]+/)![0]);expect(after-before).toBeLessThanOrEqual(.050001);background.push({before,after});await stop(page);
  }
  const result={browser:browser.version(),fixtureHash:fixtureHash(d),open:summary(openSamples),close:summary(closeSamples),stop:summary(stops),background};await writeEvidence('ui-B-RC',result);expect(result.open.p95).toBeLessThanOrEqual(200);expect(result.close.p95).toBeLessThanOrEqual(200);expect(result.stop.p95).toBeLessThanOrEqual(100);
});
