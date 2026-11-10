import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { STORAGE_KEY } from '../../src/storage';
import { COMPONENTS } from '../../src/circuit';
import type { CircuitDocument } from '../../src/circuit';
import { oscillatorFixtureDetails } from '../../src/circuit/oscillator/fixtures';
import { audioCounters, openFixture } from '../performance/helpers';

async function keyboardPlace(page:Page,name:string,anchor:string) {
  await page.getByRole('button',{name:`添加${name}`,exact:true}).press('Enter');
  const input=page.getByLabel('锚点孔位',{exact:true});await input.focus();
  await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(anchor);
  await page.getByRole('button',{name:'放置元件',exact:true}).press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
}
async function keyboardText(page:Page,control:Locator,value:string) {
  await control.focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(value);
}
async function buildOscillatorByKeyboard(page:Page,document:CircuitDocument) {
  await page.goto('/');await page.bringToFront();
  await page.getByRole('radio',{name:'自激发声·虚拟模型v2',exact:true}).press('Enter');
  await keyboardText(page,page.getByLabel('电池电压',{exact:true}),String(document.supplyVoltage));
  await page.getByRole('button',{name:'应用电池电压',exact:true}).press('Enter');
  for(const part of document.components) {
    expect(part.rotation).toBe(0);
    await keyboardPlace(page,COMPONENTS[part.kind].name,part.anchor);
    if(part.kind==='resistor') {
      await keyboardText(page,page.getByLabel('电阻阻值',{exact:true}),String(part.resistance));
      await page.getByRole('button',{name:'应用电阻阻值',exact:true}).press('Enter');
    }
    if(part.kind==='capacitor')await expect(page.getByLabel('电容容量',{exact:true})).toHaveValue('100');
  }
  for(const wire of document.wires) {
    await keyboardText(page,page.getByLabel('导线起点',{exact:true}),wire.from);
    await keyboardText(page,page.getByLabel('导线终点',{exact:true}),wire.to);
    await page.getByRole('button',{name:'添加导线',exact:true}).press('Enter');
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
}
const storedDocument=(page:Page):Promise<CircuitDocument>=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),STORAGE_KEY);
const refPart=(page:Page,document:CircuitDocument,id:string)=>{
  const part=document.components.find(part=>part.id===id)!;
  return page.getByRole('button',{name:new RegExp(`${COMPONENTS[part.kind].name}.*，锚点 ${part.anchor}$`)});
};
const completedPeriodic=(page:Page)=>expect(page.locator('.result-card h3')).toHaveText('检测到稳定周期',{timeout:10000});

test('OSC model cards: completes the sourced pair as DC and restores the generic periodic audio',async({page})=>{
  await audioCounters(page,true);
  const reference=oscillatorFixtureDetails().document;
  await openFixture(page,reference);
  await page.getByRole('button',{name:'运行电路',exact:true}).click();
  await completedPeriodic(page);
  await page.getByRole('button',{name:/^启用.*声音$/,exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{started:number}}).audioEvidence.started)).toBe(1);

  await refPart(page,reference,'Q1').click();
  await page.getByLabel('晶体管参数模型').selectOption('2n3904');
  await expect(page.locator('.result-card h3')).toHaveText('观察窗内已近直流',{timeout:10000});
  await refPart(page,reference,'Q2').click();
  await page.getByLabel('晶体管参数模型').selectOption('2n3906');
  await expect(page.locator('.result-card h3')).toHaveText('观察窗内已近直流',{timeout:10000});
  await expect(page.getByLabel('仿真状态')).toContainText('运行中');
  await expect(page.getByLabel('实验读数')).toContainText(/模拟时刻：40\s*ms/);
  await expect(page.getByLabel('实验读数')).not.toContainText('稳定频率');
  const stored=await storedDocument(page);
  expect(stored.components.find(part=>part.id==='Q1')?.transistorModel).toBe('2n3904');
  expect(stored.components.find(part=>part.id==='Q2')?.transistorModel).toBe('2n3906');
  expect(await page.evaluate(()=>(window as unknown as {audioEvidence:{started:number}}).audioEvidence.started)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{stopped:number}}).audioEvidence.stopped)).toBe(1);

  await page.getByRole('button',{name:'停止运行',exact:true}).click();
  await refPart(page,reference,'Q1').click();
  await page.getByLabel('晶体管参数模型').selectOption('generic');
  await refPart(page,reference,'Q2').click();
  await page.getByLabel('晶体管参数模型').selectOption('generic');
  await page.getByRole('button',{name:'运行电路',exact:true}).click();
  await completedPeriodic(page);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{started:number}}).audioEvidence.started)).toBe(2);
});

test('OSC configuration: keyboard places new parts, reads actual pins, saves and undoes model choice',async({page})=>{
  await page.goto('/');await page.getByRole('radio',{name:'自激发声·虚拟模型v2',exact:true}).press('Enter');
  await keyboardPlace(page,'PNP 晶体管','c13');await keyboardPlace(page,'无源扬声器','c20');
  await keyboardPlace(page,'电容','c25');
  await expect(page.getByLabel('电容容量',{exact:true})).toHaveValue('100');
  await page.getByRole('button',{name:'PNP 晶体管，锚点 c13',exact:true}).press('Enter');
  const guide=page.getByRole('region',{name:'PNP 晶体管使用说明'});
  await expect(guide).toContainText('Bc13');await expect(guide).toContainText('Cc14');await expect(guide).toContainText('Ec15');
  await page.screenshot({path:'/tmp/ai-circuit-oscillator-configuration.png',fullPage:true});
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),STORAGE_KEY);
  expect(stored).toMatchObject({schemaVersion:5,modelProfileId:'oscillator-em-v2'});
  expect(stored.components.find((p:{kind:string})=>p.kind==='capacitor').capacitanceF).toBe(100e-9);
  await page.reload();await expect(page.getByRole('radio',{name:'自激发声·虚拟模型v2'})).toBeChecked();
  await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await page.getByRole('radio',{name:'原实验模型',exact:true}).press('Enter');
  await page.getByRole('button',{name:'撤销',exact:true}).press('Enter');
  await expect(page.getByRole('radio',{name:'自激发声·虚拟模型v2'})).toBeChecked();
});

test('OSC configuration: nF/μF conversion and invalid drafts preserve the saved component',async({page})=>{
  await page.goto('/');await page.getByRole('radio',{name:'自激发声·虚拟模型v2'}).click();
  await keyboardPlace(page,'电容','c13');
  const saved=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await page.getByLabel('电容显示单位').selectOption('μF');
  await expect(page.getByLabel('电容容量',{exact:true})).toHaveValue('0.1');
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(saved);
  await page.getByLabel('电容容量',{exact:true}).fill('0.2');await page.getByRole('button',{name:'应用电容容量',exact:true}).click();
  const updated=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),STORAGE_KEY);
  expect(updated.components[0].capacitanceF).toBe(200e-9);
  for(const draft of ['NaN','1e','0.2 μF','1']) {
    await page.getByLabel('电容容量',{exact:true}).fill(draft);await page.getByRole('button',{name:'应用电容容量',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('有效数值');
    expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),STORAGE_KEY)).components[0].capacitanceF).toBe(200e-9);
  }
});

test('OSC-01/03/04: builds the complete seven-node reference from an empty board by keyboard, solves and opts into real Chromium audio',async({page},testInfo)=>{
  await audioCounters(page,true);
  const details=oscillatorFixtureDetails(),reference=details.document;
  await buildOscillatorByKeyboard(page,reference);
  const actual=await storedDocument(page);
  expect(actual).toMatchObject({schemaVersion:5,modelProfileId:'oscillator-em-v2',supplyVoltage:9,sourceMode:'battery'});
  expect(actual.components.map(part=>({...part,id:''}))).toEqual(reference.components.map(part=>({...part,id:''})));
  expect(actual.wires.map(wire=>({...wire,id:''}))).toEqual(reference.wires.map(wire=>({...wire,id:''})));
  await testInfo.attach('OSC-REF-keyboard-actual-input-and-pins.json',{body:Buffer.from(JSON.stringify({actual,pinTable:details.pinTable,nodeEndpoints:details.nodeEndpoints},null,2)),contentType:'application/json'});
  const before=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await page.evaluate(()=>{
    const status=document.querySelector('[aria-label="仿真状态"]')!;
    const states:string[]=[];Object.assign(window,{oscStatusEvidence:states});
    new MutationObserver(()=>states.push(status.textContent??'')).observe(status,{childList:true,characterData:true,subtree:true});
  });
  await page.getByRole('button',{name:'运行电路',exact:true}).press('Enter');
  await completedPeriodic(page);
  expect(await page.evaluate(()=>(window as unknown as {oscStatusEvidence:string[]}).oscStatusEvidence.some(text=>text.includes('计算中')))).toBe(true);
  await expect(page.getByLabel('实验读数')).toContainText(/40\s*ms|0\.040\s*s/);
  await expect(page.getByLabel('实验读数')).toContainText(/288\.\d+\s*Hz/);
  const silent=await page.evaluate(()=>(window as unknown as {audioEvidence:{started:number}}).audioEvidence.started);
  expect(silent).toBe(0);
  await page.getByRole('button',{name:/^启用.*声音$/,exact:true}).press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{started:number}}).audioEvidence.started)).toBe(1);
  const audio=await page.evaluate(()=>(window as unknown as {audioEvidence:{type:string;frequency:number;contexts:number}}).audioEvidence);
  expect(audio.type).toBe('sine');expect(audio.frequency).toBeCloseTo(288.498942,0);expect(audio.contexts).toBe(1);
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(before);
  await page.getByLabel(/扬声器音量|蜂鸣器音量/).focus();await page.keyboard.press('Home');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{lastTargetGain:number}}).audioEvidence.lastTargetGain)).toBe(0);
  await page.keyboard.press('End');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{lastTargetGain:number}}).audioEvidence.lastTargetGain)).toBeGreaterThan(.08);
  await page.getByRole('button',{name:'停止运行',exact:true}).press('Enter');
  await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await expect(page.getByLabel('实验读数')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{stopped:number;disconnected:number}}).audioEvidence.stopped)).toBe(1);
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(before);
  await page.reload();await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await expect(page.getByRole('button',{name:/^启用.*声音$/,exact:true})).toBeVisible();
  await page.screenshot({path:'/tmp/ai-circuit-oscillator-keyboard-ref.png',fullPage:true});
});

test('OSC-05: deleting the feedback capacitor shows DC evidence and three requested hints, then undo repairs the solved experiment',async({page})=>{
  const reference=oscillatorFixtureDetails().document;
  await openFixture(page,reference);
  await refPart(page,reference,'C1').press('Enter');
  await page.getByRole('button',{name:'删除',exact:true}).press('Enter');
  const withoutC=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await page.getByRole('button',{name:'运行电路',exact:true}).press('Enter');
  await expect(page.getByRole('heading',{name:'观察窗内已近直流',exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByLabel('实验读数')).toContainText(/40\s*ms|0\.040\s*s/);
  await page.getByRole('button',{name:'揭开第一个线索',exact:true}).press('Enter');
  await expect(page.locator('.hint-list li')).toHaveCount(1);
  await page.getByRole('button',{name:'再给我一个线索',exact:true}).press('Enter');
  await page.getByRole('button',{name:'再给我一个线索',exact:true}).press('Enter');
  await expect(page.locator('.hint-list li')).toHaveCount(3);
  await expect(page.locator('.evidence-caption')).not.toContainText('整个回路');
  await expect(page.getByText(/提示证据快照：0\.040 s/)).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(withoutC);
  await page.getByRole('button',{name:'撤销',exact:true}).press('Enter');
  expect(await storedDocument(page)).toEqual(reference);
  await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await expect(page.locator('.hint-list li')).toHaveCount(0);
  await page.getByRole('button',{name:'运行电路',exact:true}).press('Enter');await completedPeriodic(page);
  await page.screenshot({path:'/tmp/ai-circuit-oscillator-repaired.png',fullPage:true});
});

test('OSC-06: native Chromium tab focus changes cancel sound and return to a new cold calculation',async({page,context},testInfo)=>{
  await audioCounters(page,true);await openFixture(page,oscillatorFixtureDetails().document);
  await page.getByRole('button',{name:'运行电路',exact:true}).press('Enter');await completedPeriodic(page);
  await page.getByRole('button',{name:/^启用.*声音$/,exact:true}).press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{started:number}}).audioEvidence.started)).toBe(1);
  await page.evaluate(()=>{
    const events:{type:string;trusted:boolean;hidden:boolean}[]=[];Object.assign(window,{oscNativeBackgroundEvidence:events});
    for(const type of ['blur','focus'])window.addEventListener(type,event=>events.push({type,trusted:event.isTrusted,hidden:document.hidden}));
    document.addEventListener('visibilitychange',event=>events.push({type:event.type,trusted:event.isTrusted,hidden:document.hidden}));
  });
  const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
  await page.waitForFunction(()=>(window as unknown as {oscNativeBackgroundEvidence:{type:string;trusted:boolean;hidden:boolean}[]}).oscNativeBackgroundEvidence.some(event=>event.trusted&&(event.type==='blur'||event.hidden)),{},{timeout:1000}).catch(()=>undefined);
  // Some headless hosts expose no native tab visibility/focus transition. Record
  // that limitation; never substitute dispatchEvent for an OS/browser result.
  const native=await page.evaluate(()=>(window as unknown as {oscNativeBackgroundEvidence:{type:string;trusted:boolean;hidden:boolean}[]}).oscNativeBackgroundEvidence);
  await testInfo.attach('native-Chromium-background-events.json',{body:Buffer.from(JSON.stringify(native,null,2)),contentType:'application/json'});
  if(!native.some(event=>event.trusted&&(event.type==='blur'||event.hidden))) {
    await other.close();test.skip(true,'当前 Chromium/headless 环境未产生原生后台/失焦事件；真实后台验证仍待执行。');return;
  }
  await expect(page.getByLabel('仿真状态')).toContainText('后台已暂停');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{stopped:number}}).audioEvidence.stopped)).toBe(1);
  await page.bringToFront();await completedPeriodic(page);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioEvidence:{started:number}}).audioEvidence.started)).toBe(2);
  await page.getByRole('button',{name:'停止运行',exact:true}).press('Enter');await other.close();
});
