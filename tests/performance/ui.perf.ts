import {test,expect} from '@playwright/test';
import type {Page,Locator} from '@playwright/test';
import type {CircuitDocument} from '../../src/circuit';
import {rgbExperiment,npnExperiment,rcExperiment,piezoExperiment,maxExperiment} from '../fixtures/stage2';
import {openFixture,run,stop,writeEvidence,fixtureHash,audioCounters} from './helpers';

type Sample={ms:number;audioMs?:number};
declare global {interface Window {interactionSample:{done:boolean;started:number|null;ms:number;audioMs?:number}}}
test.use({actionTimeout:5000});

/** Test instrumentation only; event-entry → matching revision's submitted DOM frame. */
async function measure(page:Page,control:Locator,event:'click'|'keydown'|'change',needle:string,action:()=>Promise<unknown>,stopping=false,partId='',audioRequired=false,expectedGain?:number):Promise<Sample>{
  await control.focus();
  await page.evaluate(({event,needle,stopping,partId,audioRequired,expectedGain})=>{
    const status=document.querySelector('#simulation-status')!,revision=status.getAttribute('data-revision'),session=status.getAttribute('data-session');
    const sample={done:false,started:null as number|null,ms:0,audioMs:0};window.interactionSample=sample;
    if(audioRequired){const data=(window as unknown as {audioEvidence:{lastTargetHz:number;readyAudioTime:number;gainReadyAudioTime:number;lastTargetGain:number}}).audioEvidence;data.lastTargetHz=0;data.lastTargetGain=0;data.readyAudioTime=Infinity;data.gainReadyAudioTime=Infinity;}
    const listener=()=>{sample.started=performance.now();document.removeEventListener(event,listener,true);requestAnimationFrame(poll);};
    const poll=()=>{
      const now=document.querySelector('#simulation-status')!,changed=stopping?now.getAttribute('data-session')!==session:now.getAttribute('data-revision')!==revision;
      const content=stopping?now.textContent:document.querySelector(partId?`[data-part-reading="${partId}"]`:'.stage-readings')?.textContent;
      const audio=(window as unknown as {audioEvidence?:{started:number;stopped:number;disconnected:number;audioTime:number;readyAudioTime:number;gainReadyAudioTime:number;lastTargetGain:number;lastTargetHz:number}}).audioEvidence;
      const cleaned=!stopping||!audio||audio.started===audio.stopped&&audio.stopped===audio.disconnected;
      const audioReady=!audioRequired||!!audio&&audio.lastTargetHz===500&&audio.lastTargetGain>0&&(expectedGain===undefined||Math.abs(audio.lastTargetGain-expectedGain)<1e-8)&&audio.audioTime>=Math.max(audio.readyAudioTime,audio.gainReadyAudioTime);
      if(changed&&content?.includes(needle)&&cleaned&&audioReady){sample.ms=performance.now()-sample.started!;if(audioRequired)sample.audioMs=sample.ms;sample.done=true;}else requestAnimationFrame(poll);
    };
    document.addEventListener(event,listener,true);
  },{event,needle,stopping,partId,audioRequired,expectedGain});
  await action();await page.waitForFunction(()=>window.interactionSample.done,undefined,{timeout:5000});
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
    if(name==='B-MAX')await page.getByLabel('电阻阻值',{exact:true}).fill('10000');
    const control=toggle?byAnchor(page,'通断开关',selected!.anchor):name==='B-PIEZO'?page.getByRole('radio',{name:'500 Hz',exact:true}):page.getByRole('button',{name:'应用电阻阻值',exact:true});
    const event=input==='pointer'?'click':'keydown';
    const action=()=>input==='pointer'?control.click():control.press('Space');
    const sample=await measure(page,control,event,name==='B-RGB'?'混色 157, 122, 122':name==='B-NPN'?'饱和':name==='B-PIEZO'?'受驱动，500 Hz':'饱和',action,false,name==='B-MAX'?'t1':'',name==='B-PIEZO',name==='B-PIEZO'?.125*1e6/1001000:undefined);
    const button=page.getByRole('button',{name:'停止运行',exact:true}),stopped=await measure(page,button,input==='pointer'?'click':'keydown','已停止',()=>input==='pointer'?button.click():button.press('Space'),true);
    if(i>=10){samples.push(sample);stops.push(stopped);}
    // Restore complete initial configuration while stopped; no old result is reused.
    if(toggle)await page.getByRole('button',{name:'开关接通',exact:true}).click();
    else if(name==='B-PIEZO')await page.getByRole('radio',{name:'250 Hz',exact:true}).click();else{await page.getByLabel('电阻阻值',{exact:true}).fill('100000');await control.click();}
  }
  const result={browser:browser.version(),fixtureHash:fixtureHash(d),name,input,ui:summary(samples),stop:summary(stops),inputEvent:input==='pointer'?'actual pointer activation':'actual keyboard activation'};
  await writeEvidence(`ui-${name}-${input}`,result);console.log(`${name}/${input}: UI ${result.ui.p95} ms, Stop ${result.stop.p95} ms`);
  if(name==='B-PIEZO')for(const sample of samples)expect(sample.audioMs).toBeLessThanOrEqual(100);expect(result.ui.p95).toBeLessThanOrEqual(200);expect(result.stop.p95).toBeLessThanOrEqual(100);
});

for(const input of ['pointer','keyboard'] as const)test(`B-PIEZO amplitude ${input}: 100 continuously driven gain changes`,async({page,browser})=>{
  await audioCounters(page,true);const d=piezoExperiment(1000);await openFixture(page,d);await page.getByRole('button',{name:'启用蜂鸣器声音',exact:true}).click();await byAnchor(page,'电阻',d.components.find(p=>p.id==='series')!.anchor).click();await run(page);
  const q=Math.exp(-.001/((101000*1e6/1101000)*10e-9)),expectedGain=.125*(1e6/1101000)*(1-q)/(1+q),samples:Sample[]=[];
  const control=page.getByRole('button',{name:'应用电阻阻值',exact:true});
  for(let i=0;i<110;i++){
    await page.getByLabel('电阻阻值',{exact:true}).fill('100000');const sample=await measure(page,control,input==='pointer'?'click':'keydown','受驱动，500 Hz',()=>input==='pointer'?control.click():control.press('Space'),false,'',true,expectedGain);if(i>=10)samples.push(sample);
    await page.getByLabel('电阻阻值',{exact:true}).fill('1000');await control.click();
  }
  const result={browser:browser.version(),fixtureHash:fixtureHash(d),input,expectedGain,audioAndUi:summary(samples)};await writeEvidence(`ui-B-PIEZO-amplitude-${input}`,result);console.log(`B-PIEZO/amplitude/${input}: P95 ${result.audioAndUi.p95} ms`);for(const sample of samples)expect(sample.audioMs).toBeLessThanOrEqual(100);await stop(page);
});

for(const input of ['pointer','keyboard'] as const)test(`B-RC UI/Stop ${input}: fresh t=5s intervals`,async({page,browser})=>{
  test.setTimeout(1800000);
  const d=rcExperiment();await openFixture(page,d);
  const charge=d.components.find(p=>p.id==='sc')!,discharge=d.components.find(p=>p.id==='sd')!;
  const sc=byAnchor(page,'通断开关',charge.anchor),sd=byAnchor(page,'通断开关',discharge.anchor),openSamples:Sample[]=[],closeSamples:Sample[]=[],stops:Sample[]=[];
  for(let i=0;i<110;i++){
    await run(page);await page.waitForFunction(()=>Number(document.querySelector('[data-testid="simulation-time"]')?.textContent?.match(/[\d.]+/)?.[0])>=5,undefined,{timeout:15000});
    const event=input==='pointer'?'click':'keydown',activate=(control:Locator)=>input==='pointer'?control.click():control.press('Space');
    const opened=await measure(page,sc,event,'保持',()=>activate(sc)),closed=await measure(page,sd,event,'放电',()=>activate(sd));
    if(i>=10){openSamples.push(opened);closeSamples.push(closed);}
    await stop(page);await sc.click();await page.getByRole('button',{name:'开关接通',exact:true}).click();await sd.click();await page.getByRole('button',{name:'开关接通',exact:true}).click();
    await run(page);await page.waitForFunction(()=>Number(document.querySelector('[data-testid="simulation-time"]')?.textContent?.match(/[\d.]+/)?.[0])>=5,undefined,{timeout:15000});
    const button=page.getByRole('button',{name:'停止运行',exact:true});const stopped=await measure(page,button,event,'已停止',()=>activate(button),true);if(i>=10)stops.push(stopped);
    if((i+1)%5===0)console.log(`B-RC/${input}: ${i+1}/110 complete`);
  }
  const result={browser:browser.version(),fixtureHash:fixtureHash(d),input,open:summary(openSamples),close:summary(closeSamples),stop:summary(stops)};await writeEvidence(`ui-B-RC-${input}`,result);console.log(`B-RC/${input}: open ${result.open.p95} ms, close ${result.close.p95} ms, Stop ${result.stop.p95} ms`);expect(result.open.p95).toBeLessThanOrEqual(200);expect(result.close.p95).toBeLessThanOrEqual(200);expect(result.stop.p95).toBeLessThanOrEqual(100);
});

test('B-RC background: ten actual tab switches with real ten second pauses',async({page,context,browser})=>{
  test.skip(process.env.RUN_REAL_FOCUS!=='1','Requires a dedicated foreground desktop; virtual focus is not evidence of actual backgrounding.');test.setTimeout(240000);
  const d=rcExperiment();await openFixture(page,d);const other=await context.newPage();await other.goto('about:blank');
  // Playwright enables focus emulation; disable it on both tabs so this measures real blur/visibility events.
  const sessions=[];for(const target of [page,other]){const cdp=await context.newCDPSession(target);sessions.push(cdp);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});}await page.bringToFront();
  const background:{before:number;after:number}[]=[];
  for(let i=0;i<10;i++){
    await page.bringToFront();await run(page);await page.waitForFunction(()=>Number(document.querySelector('[data-testid="simulation-time"]')?.textContent?.match(/[\d.]+/)?.[0])>=5,undefined,{timeout:15000});
    await other.bringToFront();await expect(page.getByLabel('仿真状态')).toContainText('后台已暂停',{timeout:5000});const before=Number((await page.getByTestId('simulation-time').textContent())!.match(/[\d.]+/)![0]);await page.waitForTimeout(10000);
    expect(Number((await page.getByTestId('simulation-time').textContent())!.match(/[\d.]+/)![0])).toBe(before);await page.bringToFront();await expect(page.getByLabel('仿真状态')).toContainText('运行中');const after=Number((await page.getByTestId('simulation-time').textContent())!.match(/[\d.]+/)![0]);expect(after-before).toBeLessThanOrEqual(.050001);background.push({before,after});await stop(page);console.log(`B-RC/background: ${i+1}/10 complete`);
  }
  for(const cdp of sessions)await cdp.detach();await other.close();await writeEvidence('background-B-RC',{browser:browser.version(),fixtureHash:fixtureHash(d),background});
});
