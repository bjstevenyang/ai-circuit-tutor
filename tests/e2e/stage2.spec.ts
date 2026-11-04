import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {COMPONENTS} from '../../src/circuit';
import type {CircuitDocument} from '../../src/circuit';
import {rgbExperiment,npnExperiment,rcExperiment,piezoExperiment} from '../fixtures/stage2';

export async function buildFromEmpty(page:Page,d:CircuitDocument){
  await page.goto('/');
  for(const p of d.components){
    await page.getByLabel('元件',{exact:true}).selectOption(p.kind);
    await page.getByLabel('锚点孔位',{exact:true}).fill(p.anchor);
    await page.getByLabel('方向',{exact:true}).selectOption(String(p.rotation));
    await page.getByRole('button',{name:'放置元件',exact:true}).click();
    if(p.kind==='resistor'&&p.resistance!==330){if([100,1000,4700,10000,100000].includes(p.resistance!))await page.getByLabel('所选电阻阻值').selectOption(String(p.resistance));else{await page.getByLabel('电阻阻值',{exact:true}).fill(String(p.resistance));await page.getByRole('button',{name:'应用电阻阻值',exact:true}).click();}}
    if(p.kind==='switch'&&p.closed)await page.getByRole('button',{name:'开关接通',exact:true}).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  for(const w of d.wires){await page.getByLabel('导线起点',{exact:true}).fill(w.from);await page.getByLabel('导线终点',{exact:true}).fill(w.to);await page.getByRole('button',{name:'添加导线',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);}
  if(d.sourceMode==='teaching-square')await page.getByLabel('实验电源模式').selectOption('teaching-square');
  await expect(page.locator('.component-item')).toHaveCount(d.components.length);
}
const run=(p:Page)=>p.getByRole('button',{name:'运行电路',exact:true}).click();
const part=(page:Page,d:CircuitDocument,id:string)=>{const p=d.components.find(p=>p.id===id)!;return page.getByRole('button',{name:new RegExp(`${p.kind==='resistor'?'电阻.*':COMPONENTS[p.kind].name}，锚点 ${p.anchor}$`)});};
test('stage2 RGB: build without dragging, channel fault, requested hints and repair',async({page})=>{
  const d=rgbExperiment();await buildFromEmpty(page,d);await run(page);
  await expect(page.getByLabel('实验读数')).toContainText('混色 157, 122, 122');
  await part(page,d,'rR').click();await page.getByLabel('所选电阻阻值').selectOption('100');
  await expect(page.getByRole('heading',{name:'R 通道：电流超过了课程限制'})).toBeVisible();
  await page.getByRole('button',{name:'揭开第一个线索',exact:true}).click();await expect(page.locator('.hint-list li')).toHaveCount(1);
  await page.getByRole('button',{name:'再给我一个线索',exact:true}).click();await page.getByRole('button',{name:'再给我一个线索',exact:true}).click();
  await expect(page.locator('.hint-list li')).toHaveCount(3);await page.getByLabel('所选电阻阻值').selectOption('330');
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();await expect(page.locator('.hint-list li')).toHaveCount(0);
  await page.reload();await expect(page.getByLabel('仿真状态')).toContainText('已停止');await run(page);await expect(page.getByLabel('实验读数')).toContainText('混色 157, 122, 122');
});
test('stage2 NPN: unique cutoff, saturation, controlled state and reference repair',async({page})=>{
  const d=npnExperiment();await buildFromEmpty(page,d);await run(page);await expect(page.getByLabel('实验读数')).toContainText('Ic 7.012697 mA');
  await part(page,d,'s').focus();await page.keyboard.press('Space');await expect(page.getByLabel('实验读数')).toContainText('截止');await expect(page.getByLabel('实验读数')).toContainText('VCE 4.5 V');
  await part(page,d,'ref').click();await page.getByRole('button',{name:'删除',exact:true}).click();await run(page);await expect(page.getByLabel('实验读数')).not.toContainText('VCE');
  await expect(page.getByRole('heading',{name:/非唯一/})).toBeVisible();await page.getByRole('button',{name:'撤销',exact:true}).click();await run(page);await expect(page.getByLabel('实验读数')).toContainText('VCE 4.5 V');
  await part(page,d,'s').focus();await page.keyboard.press('Space');await part(page,d,'rb').click();await page.getByLabel('所选电阻阻值').selectOption('100000');
  await expect(page.getByLabel('实验读数')).toContainText('受控导通');await expect(page.getByLabel('实验读数')).toContainText('VCE 1.486943 V');
});
test('stage2 RC: continuous charge to discharge, pause, capacity validation and restart',async({page})=>{
  const d=rcExperiment();await buildFromEmpty(page,d);await page.clock.install();await run(page);await page.clock.runFor(5000);
  await expect(page.getByLabel('实验读数')).toContainText('充电');
  const before=await page.getByTestId('simulation-time').textContent();
  await part(page,d,'sc').click();await expect(page.getByLabel('实验读数')).toContainText('保持');await part(page,d,'sd').click();await page.clock.runFor(1000);await expect(page.getByLabel('实验读数')).toContainText('放电');
  expect(await page.getByTestId('simulation-time').textContent()).not.toBe(before);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.getByLabel('仿真状态')).toContainText('后台已暂停');
  const paused=await page.getByTestId('simulation-time').textContent();await page.clock.runFor(10000);expect(await page.getByTestId('simulation-time').textContent()).toBe(paused);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await part(page,d,'cap').click();await page.getByLabel('电容容量',{exact:true}).fill('NaN');await page.getByRole('button',{name:'应用电容容量',exact:true}).click();await expect(page.getByRole('alert')).toContainText('有效数值');
  await page.getByLabel('电容容量',{exact:true}).fill('1000');await page.getByRole('button',{name:'应用电容容量',exact:true}).click();await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await run(page);await expect(page.getByLabel('实验读数')).toContainText('模拟时间');await page.getByRole('button',{name:'停止运行',exact:true}).click();await expect(page.getByLabel('实验读数')).toHaveCount(0);await page.reload();await expect(page.getByLabel('仿真状态')).toContainText('已停止');
});
test('stage2 piezo: real connected drive, frequency, attenuation repair and DC contrast',async({page})=>{
  const d=piezoExperiment(1000000);await buildFromEmpty(page,d);await run(page);await expect(page.getByLabel('实验读数')).toContainText('驱动幅度不足');
  await part(page,d,'series').click();await page.getByLabel('所选电阻阻值').selectOption('1000');await expect(page.getByLabel('实验读数')).toContainText('受驱动，500 Hz');
  await page.getByRole('button',{name:'启用蜂鸣器声音',exact:true}).click();for(const f of ['250','1000','500']){await page.getByLabel('驱动频率').selectOption(f);await expect(page.getByLabel('实验读数')).toContainText(`受驱动，${f} Hz`);}
  await page.getByLabel('蜂鸣器音量').fill('0');await expect(page.getByLabel('蜂鸣器音量')).toHaveValue('0');
  await page.getByLabel('实验电源模式').selectOption('battery');await expect(page.getByLabel('仿真状态')).toContainText('已停止');await run(page);await expect(page.getByLabel('实验读数')).toContainText('无持续音');
});
