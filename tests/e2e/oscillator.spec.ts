import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { STORAGE_KEY } from '../../src/storage';

async function keyboardPlace(page:Page,name:string,anchor:string) {
  await page.getByRole('button',{name:`添加${name}`,exact:true}).press('Enter');
  const input=page.getByLabel('锚点孔位',{exact:true});await input.focus();
  await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(anchor);
  await page.getByRole('button',{name:'放置元件',exact:true}).press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
}
test('OSC configuration: keyboard places new parts, reads actual pins, saves and undoes model choice',async({page})=>{
  await page.goto('/');await page.getByRole('radio',{name:'自激发声·虚拟模型',exact:true}).press('Enter');
  await keyboardPlace(page,'PNP 晶体管','c13');await keyboardPlace(page,'无源扬声器','c20');
  await keyboardPlace(page,'电容','c25');
  await expect(page.getByLabel('电容容量',{exact:true})).toHaveValue('100');
  await page.getByRole('button',{name:'PNP 晶体管，锚点 c13',exact:true}).press('Enter');
  const guide=page.getByRole('region',{name:'PNP 晶体管使用说明'});
  await expect(guide).toContainText('Bc13');await expect(guide).toContainText('Cc14');await expect(guide).toContainText('Ec15');
  await page.screenshot({path:'/tmp/ai-circuit-oscillator-configuration.png',fullPage:true});
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),STORAGE_KEY);
  expect(stored).toMatchObject({schemaVersion:5,modelProfileId:'oscillator-em-v1'});
  expect(stored.components.find((p:{kind:string})=>p.kind==='capacitor').capacitanceF).toBe(100e-9);
  await page.reload();await expect(page.getByRole('radio',{name:'自激发声·虚拟模型'})).toBeChecked();
  await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await page.getByRole('radio',{name:'原实验模型',exact:true}).press('Enter');
  await page.getByRole('button',{name:'撤销',exact:true}).press('Enter');
  await expect(page.getByRole('radio',{name:'自激发声·虚拟模型'})).toBeChecked();
});

test('OSC configuration: nF/μF conversion and invalid drafts preserve the saved component',async({page})=>{
  await page.goto('/');await page.getByRole('radio',{name:'自激发声·虚拟模型'}).click();
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
