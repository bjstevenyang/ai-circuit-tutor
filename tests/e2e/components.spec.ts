import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createComponent, createEmptyDocument } from '../../src/circuit';
import type { CircuitDocument, ComponentKind } from '../../src/circuit';
import { STORAGE_KEY } from '../../src/storage';
import { makeWire, switchedCircuit, validCircuit, dimmingCircuit, parallelLedCircuit } from '../fixtures/circuits';

async function open(page:Page,document:CircuitDocument){
  await page.addInitScript(({key,document})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(document));},{key:STORAGE_KEY,document});
  await page.goto('/');
}
const run=(page:Page)=>page.getByRole('button',{name:'运行电路',exact:true}).click();
async function place(page:Page,kind:ComponentKind,anchor:string){
  await page.getByLabel('元件',{exact:true}).selectOption(kind);
  await page.getByLabel('锚点孔位',{exact:true}).fill(anchor);
  await page.getByRole('button',{name:'放置元件',exact:true}).click();
}

test('place all eight kinds with repeated instances, configure and restore them',async({page})=>{
  await page.goto('/');
  for(const [kind,anchor] of [['resistor','a1'],['led','a6'],['switch','a10'],['button','e26'],['potentiometer','a15'],['buzzer','a20'],['diode','f1'],['ldr','f6'],['resistor','f15']] as [ComponentKind,string][]){
    await place(page,kind,anchor);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('button',{name:'光敏电阻，锚点 f6',exact:true}).click();
  await page.getByLabel('模拟光照').fill('75');
  await page.reload();
  await expect(page.locator('.component-item')).toHaveCount(9);
  await page.getByRole('button',{name:'光敏电阻，锚点 f6',exact:true}).click();
  await expect(page.getByLabel('模拟光照')).toHaveValue('75');
});

test('switch recomputes a running circuit and retains its state on reload',async({page})=>{
  await open(page,switchedCircuit());await run(page);
  await page.getByRole('button',{name:'通断开关，锚点 a8',exact:true}).click();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await page.reload();await run(page);
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
});

test('button holds with keyboard or pointer, releases on blur and does not persist a press',async({page})=>{
  await open(page,switchedCircuit(true));await run(page);
  await page.getByRole('button',{name:'常开按钮，锚点 e8',exact:true}).click();
  const hold=page.getByRole('button',{name:'按住按钮'});
  await hold.focus();await page.keyboard.down('Space');
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await page.keyboard.up('Space');
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
  await hold.hover();await page.mouse.down();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
  await hold.focus();await page.keyboard.down('Space');
  await page.getByRole('button',{name:'停止运行',exact:true}).focus();
  await page.keyboard.up('Space');
  await expect(hold).toHaveAttribute('aria-pressed','false');
  await page.reload();await run(page);
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
});

test('pressing the round button body conducts until pointer release',async({page})=>{
  await open(page,switchedCircuit(true));await run(page);
  const button=page.getByRole('button',{name:'常开按钮，锚点 e8',exact:true}),body=button.locator('[data-button-cap]');
  const saved=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await body.hover();await page.mouse.down();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible({timeout:1500});
  await expect(button).toHaveAttribute('aria-pressed','true');
  await page.getByRole('region',{name:'电路工作台'}).screenshot({path:'test-results/button-body-pressed.png'});
  const box=(await body.boundingBox())!;
  await page.mouse.move(box.x+box.width+60,box.y+box.height+50,{steps:5});
  await expect(page.locator('.drag-preview')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
  await expect(button).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(saved);
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
});

test('board button releases on keyboard, blur, cancellation and Stop without latching',async({page})=>{
  await open(page,switchedCircuit(true));await run(page);
  const button=page.getByRole('button',{name:'常开按钮，锚点 e8',exact:true});
  for(const key of ['Space','Enter']){
    await button.focus();await page.keyboard.down(key);await page.keyboard.down(key);
    await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
    await page.keyboard.up(key);await expect(button).toHaveAttribute('aria-pressed','false');
  }
  await page.keyboard.down('Space');await page.keyboard.press('Escape');await page.keyboard.up('Space');
  await expect(button).toHaveAttribute('aria-pressed','false');
  await page.keyboard.down('Enter');await page.getByRole('button',{name:'停止运行',exact:true}).focus();await page.keyboard.up('Enter');
  await expect(button).toHaveAttribute('aria-pressed','false');
  await button.locator('[data-button-cap]').hover();await page.mouse.down();
  await expect(button).toHaveAttribute('aria-pressed','true');
  await button.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
  await expect(button).toHaveAttribute('aria-pressed','false');
  await button.focus();await page.keyboard.down('Space');
  await page.getByRole('button',{name:'停止运行',exact:true}).click();await page.keyboard.up('Space');
  await expect(button).toHaveAttribute('aria-pressed','false');
  await button.locator('[data-button-cap]').click();
  await expect(button).toHaveAttribute('aria-pressed','false');
  await run(page);await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
});

test('dragging the button housing moves it without pressing the control',async({page})=>{
  await open(page,switchedCircuit(true));await run(page);
  const button=page.getByRole('button',{name:'常开按钮，锚点 e8',exact:true});
  const housing=button.locator('.part-shape > g > rect');await housing.scrollIntoViewIfNeeded();
  const box=(await housing.boundingBox())!,a=await boardPoint(page,0,0),b=await boardPoint(page,60,0);
  await page.mouse.move(box.x+2,box.y+2);await page.mouse.down();
  await expect(button).toHaveAttribute('aria-pressed','false');
  await page.mouse.move(box.x+2+b.x-a.x,box.y+2+b.y-a.y,{steps:8});await page.mouse.up();
  await expect(page.getByRole('button',{name:'常开按钮，锚点 e11',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('status',{name:'仿真状态'})).toContainText('已停止');
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(button).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
});

test('potentiometer controls a loaded divider and LDR light updates an overcurrent diagnosis',async({page})=>{
  const document={...createEmptyDocument(),components:[createComponent('potentiometer','a1',0,'pot'),createComponent('led','c2',0,'led')],wires:[makeWire('battery:+','b1'),makeWire('b3','battery:-')]};
  await open(page,document);await run(page);
  await page.getByRole('button',{name:'电位器，锚点 a1',exact:true}).click();
  await page.getByLabel('旋钮位置').fill('25');
  await expect(page.locator('.current-reading strong')).toContainText('1.00');
  await page.getByRole('button',{name:'重置工作台'}).click();
  await place(page,'ldr','a1');await place(page,'led','c3');
  for(const [from,to] of [['battery:+','b1'],['d4','battery:-']]){
    await page.getByLabel('导线起点').fill(from!);await page.getByLabel('导线终点').fill(to!);
    await page.getByRole('button',{name:'添加导线',exact:true}).click();
  }
  await run(page);
  await page.getByRole('button',{name:'光敏电阻，锚点 a1',exact:true}).click();
  await page.getByLabel('模拟光照').fill('100');
  await expect(page.getByRole('heading',{name:'电流超过了课程限制'})).toBeVisible();
  await expect(page.locator('.current-reading strong')).toContainText('25.00');
});

test('diode polarity gets hints and buzzer sound remains opt-in',async({page})=>{
  const document={...createEmptyDocument(),components:[createComponent('resistor','a1',0,'r'),createComponent('diode','c6',180,'d')],wires:[makeWire('battery:+','b1'),makeWire('d6','battery:-')]};
  await open(page,document);await run(page);
  await expect(page.locator('.diagnostic-list')).toContainText('二极管');
  await page.getByRole('button',{name:'揭开第一个线索'}).click();
  await expect(page.locator('.hint-list li')).toHaveCount(1);
  await page.getByRole('button',{name:'重置工作台'}).click();
  await place(page,'buzzer','a1');
  for(const [from,to] of [['battery:+','b1'],['b3','battery:-']]){
    await page.getByLabel('导线起点').fill(from!);await page.getByLabel('导线终点').fill(to!);
    await page.getByRole('button',{name:'添加导线',exact:true}).click();
  }
  await run(page);
  await expect(page.getByRole('heading',{name:'蜂鸣器工作了！'})).toBeVisible();
  await expect(page.getByRole('button',{name:'启用蜂鸣器声音'})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'启用蜂鸣器声音'}).click();
  await expect(page.getByRole('button',{name:'关闭声音'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'关闭声音'}).click();
});

async function boardPoint(page:Page,x:number,y:number){
  return page.locator('.breadboard-svg').evaluate((element,{x,y})=>{
    const matrix=(element as unknown as SVGSVGElement).getScreenCTM()!;
    const point=new DOMPoint(x,y).matrixTransform(matrix);
    return {x:point.x,y:point.y};
  },{x,y});
}
async function beginDrag(page:Page,dx:number,dy:number){
  const rect=page.getByRole('button',{name:'电阻 330 欧姆，锚点 a10',exact:true}).locator('.part-shape rect');
  await rect.scrollIntoViewIfNeeded();
  const box=(await rect.boundingBox())!;
  const start={x:box.x+box.width/2,y:box.y+box.height/2};
  const a=await boardPoint(page,0,0),b=await boardPoint(page,dx,dy);
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(start.x+b.x-a.x,start.y+b.y-a.y,{steps:8});
}

test('drag snaps at zoom, submits one edit, preserves hole wires and supports undo/redo',async({page})=>{
  await open(page,validCircuit());await run(page);
  await page.getByRole('button',{name:'放大画布'}).click();
  await beginDrag(page,160,0);
  await expect(page.locator('.drag-preview.valid')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('button',{name:'电阻 330 欧姆，锚点 a18',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'导线 battery:+ 到 b10',exact:true})).toBeAttached();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(page.getByRole('button',{name:'电阻 330 欧姆，锚点 a10',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'重做',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'电阻 330 欧姆，锚点 a18',exact:true})).toBeVisible();
});

test('drag rejects occupancy and off-board drops; Escape cancels with no history',async({page})=>{
  await open(page,validCircuit());
  await beginDrag(page,0,20); // b10 is occupied by the battery lead.
  await expect(page.locator('.drag-preview.invalid')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('alert')).toContainText('占用');
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  await beginDrag(page,0,-120);
  await expect(page.locator('.drag-preview.invalid')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('alert')).toContainText('没有可安装孔位');
  await beginDrag(page,100,0);
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect(page.locator('.drag-preview')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'电阻 330 欧姆，锚点 a10',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
});

async function dragWire(page:Page,from:[number,number],to:[number,number],release=true){
  const start=await boardPoint(page,...from),end=await boardPoint(page,...to);
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(end.x,end.y,{steps:8});
  if(release)await page.mouse.up();
}

test('drag wires from battery or socket, then run and undo a single connection',async({page})=>{
  await page.goto('/');
  await place(page,'resistor','a10');await place(page,'led','c13');
  await page.getByRole('button',{name:'连线',exact:true}).click();
  await page.locator('.breadboard-svg').scrollIntoViewIfNeeded();
  await dragWire(page,[285,565],[320,190],false); // battery:+ → b10
  await expect(page.locator('.wire-preview.valid')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('button',{name:'导线 battery:+ 到 b10',exact:true})).toBeAttached();
  await dragWire(page,[400,230],[325,565]); // d14 → battery:-
  await expect(page.locator('.wire-item')).toHaveCount(2);
  await run(page);
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(page.locator('.wire-item')).toHaveCount(1);
  await page.getByRole('button',{name:'重做',exact:true}).click();
  await page.reload();await run(page);
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
});

test('wire drag rejects occupied or identical endpoints and cancels without a new wire',async({page})=>{
  await open(page,validCircuit());
  await page.getByRole('button',{name:'连线',exact:true}).click();
  await page.locator('.breadboard-svg').scrollIntoViewIfNeeded();
  await dragWire(page,[140,100],[320,170],false); // top+:1 → occupied a10
  await expect(page.locator('.wire-preview.invalid')).toBeVisible();
  await page.mouse.up();await expect(page.getByRole('alert')).toContainText('占用');
  await dragWire(page,[140,100],[150,100]); // snaps back to the same endpoint
  await expect(page.getByRole('alert')).toContainText('不同');
  await dragWire(page,[140,100],[200,170],false);
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect(page.locator('.wire-preview')).toHaveCount(0);
  await expect(page.locator('.wire-item')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  // Original click-click interaction still works after cancelling a drag.
  await page.getByRole('button',{name:'孔位 top+:1，空闲',exact:true}).click();
  await page.getByRole('button',{name:'孔位 a4，空闲',exact:true}).click();
  await expect(page.locator('.wire-item')).toHaveCount(3);
});

async function selectSupplyWire(page:Page){
  const point=await boardPoint(page,302,565);
  await page.mouse.click(point.x,point.y);
  await expect(page.getByRole('button',{name:'导线终点 b10',exact:true})).toBeVisible();
}
async function reconnect(page:Page,name:string,to:[number,number],release=true){
  const handle=page.getByRole('button',{name,exact:true});
  await handle.scrollIntoViewIfNeeded();
  const box=(await handle.boundingBox())!,target=await boardPoint(page,...to);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(target.x,target.y,{steps:8});
  if(release)await page.mouse.up();
}

test('existing wire endpoints reconnect at zoom with stable identity, one-step undo and reload',async({page})=>{
  const document=validCircuit();document.wires[0]!.bend='vertical';document.wires[0]!.color='#695c8d';
  await open(page,document);await run(page);
  await page.getByRole('button',{name:'放大画布'}).click();
  // The original line uses a vertical-first bend in this case: select it via keyboard.
  await page.getByRole('button',{name:'导线 battery:+ 到 b10',exact:true}).focus();await page.keyboard.press('Enter');
  await reconnect(page,'导线终点 b10',[320,250],false); // same conductive strip, e10
  await expect(page.locator('.wire-preview.valid')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('button',{name:'导线终点 e10',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
  const wires=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).wires,STORAGE_KEY);
  expect(wires).toEqual([{...document.wires[0],to:'e10'},document.wires[1]]);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(page.getByRole('button',{name:'导线 battery:+ 到 b10',exact:true})).toBeAttached();
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'重做',exact:true}).click();
  await page.getByRole('button',{name:'导线 battery:+ 到 e10',exact:true}).focus();await page.keyboard.press('Enter');
  await reconnect(page,'导线起点 battery:+',[140,100]); // move the other end to top+:1
  await expect(page.getByRole('button',{name:'导线 top+:1 到 e10',exact:true})).toBeAttached();
  await expect(page.locator('.wire-item')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('button',{name:'导线 top+:1 到 e10',exact:true})).toBeAttached();
});

test('reconnecting rejects occupied, identical and empty targets; cancellation and no-op preserve results',async({page})=>{
  await open(page,validCircuit());await run(page);
  await page.locator('.breadboard-svg').scrollIntoViewIfNeeded();
  await selectSupplyWire(page);
  for(const [point,message] of [[[320,170],'占用'],[[400,230],'占用'],[[285,565],'不同'],[[140,280],'没有有效接点']] as [[number,number],string][]){
    await reconnect(page,'导线终点 b10',point);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByRole('button',{name:'导线终点 b10',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  }
  await reconnect(page,'导线终点 b10',[320,250],false);
  await page.keyboard.press('Escape');await page.mouse.up();
  await reconnect(page,'导线终点 b10',[320,250],false);
  await page.getByRole('button',{name:'导线终点 b10',exact:true}).dispatchEvent('pointercancel',{pointerId:1});
  await page.mouse.up();
  // A moved gesture that returns to its original socket is a no-op.
  const handle=page.getByRole('button',{name:'导线终点 b10',exact:true}),box=(await handle.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  const away=await boardPoint(page,320,250),back=await boardPoint(page,320,190);
  await page.mouse.move(away.x,away.y);await page.mouse.move(back.x,back.y);await page.mouse.up();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await expect(page.locator('.wire-item')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
});

test('wire handles expose a keyboard alternative for editing either endpoint',async({page})=>{
  await open(page,validCircuit());await run(page);
  await page.getByRole('button',{name:'导线 battery:+ 到 b10',exact:true}).focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'导线起点 battery:+',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('新接点孔位')).toBeFocused();
  await expect(page.getByLabel('改接端点')).toHaveValue('from');
  await page.getByLabel('新接点孔位').fill('z99');await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('新接点孔位')).toHaveValue('z99');
  await page.getByLabel('新接点孔位').fill('top+:1');await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'导线 top+:1 到 b10',exact:true})).toBeAttached();
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
});

test('all eight parts explain their purpose and wiring from the tray without editing',async({page})=>{
  await page.goto('/');
  for(const [name,pins] of [['电阻',2],['红色 LED',2],['通断开关',2],['常开按钮',4],['电位器',3],['有源蜂鸣器',2],['二极管',2],['光敏电阻',2]] as [string,number][]){
    const card=page.getByRole('button',{name:`添加${name}`,exact:true});
    await card.focus();await page.keyboard.press('Enter');
    const guide=page.getByRole('region',{name:`${name}使用说明`,exact:true});
    await expect(guide).toBeVisible();
    await expect(guide.getByRole('heading',{name:'怎么接入电路',exact:true})).toBeVisible();
    await expect(guide.locator('dt')).toHaveCount(pins);
    await expect(guide.getByLabel('示例连接路径')).toContainText('电池');
    if(name==='常开按钮'){
      await guide.getByText('常见错误与模型说明',{exact:true}).click();
      await expect(guide.getByText(/封装约定/)).toBeVisible();
      await guide.screenshot({path:'test-results/component-guide-button.png'});
    }
    if(name==='电位器')await guide.screenshot({path:'test-results/component-guide-potentiometer.png'});
    await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
    expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBeNull();
    await expect(page.locator('.component-item')).toHaveCount(0);
  }
});

test('placed component guides show actual pins and preserve current diagnostics and requested hints',async({page})=>{
  await open(page,switchedCircuit(true));await run(page);
  await page.getByRole('button',{name:'揭开第一个线索'}).click();
  const saved=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await page.getByRole('button',{name:'常开按钮，锚点 e8',exact:true}).locator('.part-shape > g > rect').click({position:{x:2,y:2}});
  const guide=page.getByRole('region',{name:'常开按钮使用说明',exact:true});
  await expect(guide.locator('dt')).toHaveText(['1e8','2e9','3f8','4f9']);
  await expect(page.locator('.hint-list li')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'开关或按钮当前未接通',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(saved);
  await page.getByLabel('元件',{exact:true}).selectOption('potentiometer');
  await expect(guide).toHaveCount(0);
  await expect(page.getByRole('region',{name:'电位器使用说明',exact:true}).locator('code')).toHaveCount(0);
  await page.getByRole('button',{name:'导线 battery:+ 到 b1',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(guide).toHaveCount(0);
  await expect(page.locator('.hint-list li')).toHaveCount(1);
});

test('custom resistance validates drafts, preserves good results and supports one-step undo and restore',async({page})=>{
  await open(page,validCircuit());await run(page);
  await page.getByRole('button',{name:'电阻 330 欧姆，锚点 a10',exact:true}).click();
  const saved=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  for(const value of ['','abc','0','1000001','Infinity']){
    await page.getByLabel('电阻阻值',{exact:true}).fill(value);await page.getByRole('button',{name:'应用电阻阻值',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('有效数值');
    expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(saved);
    await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  }
  await page.getByLabel('电阻阻值',{exact:true}).fill('470.5');await page.getByRole('button',{name:'应用电阻阻值',exact:true}).click();
  await expect(page.locator('.current-reading strong')).toContainText('5.31');
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(page.getByRole('button',{name:'电阻 330 欧姆，锚点 a10',exact:true})).toBeAttached();
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'重做',exact:true}).click();await page.reload();
  await expect(page.getByRole('button',{name:'电阻 470.5 欧姆，锚点 a10',exact:true})).toBeAttached();
});

test('battery voltage validates, recalculates each result, updates labels and survives undo/reload',async({page})=>{
  await open(page,validCircuit());await run(page);
  const saved=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  for(const value of ['1.4','9.1','Infinity']){
    await page.getByLabel('电池电压',{exact:true}).fill(value);await page.getByRole('button',{name:'应用电池电压',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('有效数值');
    expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(saved);
  }
  await page.getByLabel('电池电压',{exact:true}).fill('5.2');await page.getByRole('button',{name:'应用电池电压',exact:true}).click();
  await expect(page.getByText('5.2 V DC',{exact:true})).toBeVisible();
  await expect(page.locator('.current-reading strong')).toContainText('9.70');
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(page.getByLabel('电池电压',{exact:true})).toHaveValue('4.5');await run(page);
  await page.getByLabel('电池预设电压').selectOption('9');
  await expect(page.getByRole('heading',{name:'电流超过了课程限制'})).toBeVisible();
  await expect(page.getByRole('button',{name:'红色 LED，锚点 c13',exact:true}).locator('[data-led-level]')).toHaveAttribute('data-led-level','1');
  await page.reload();await expect(page.getByLabel('电池电压',{exact:true})).toHaveValue('9');await run(page);
  await expect(page.getByRole('heading',{name:'电流超过了课程限制'})).toBeVisible();
  await page.getByLabel('电池预设电压').selectOption('1.5');
  await expect(page.getByRole('heading',{name:'电源电压不足以让这条路径导通'})).toBeVisible();
});

test('LED polarity is explicit at every orientation and its display responds to its current',async({page})=>{
  await open(page,validCircuit());
  const led=page.getByRole('button',{name:'红色 LED，锚点 c13',exact:true});
  await expect(led).toHaveAccessibleDescription(/阳极 A＋ 在 c13.*阴极 K− 在 c14/);
  await led.click();
  await expect(page.getByText('A＋ 阳极 · c13',{exact:true})).toBeVisible();
  await expect(page.getByText('K− 阴极 · c14',{exact:true})).toBeVisible();
  await run(page);
  const normal=Number(await led.locator('[data-led-level]').getAttribute('data-led-level'));
  await led.screenshot({path:'test-results/led-polarity-current.png'});
  await page.getByRole('button',{name:'电阻 330 欧姆，锚点 a10',exact:true}).click();
  await page.getByLabel('所选电阻阻值').selectOption('1000');
  const dim=Number(await led.locator('[data-led-level]').getAttribute('data-led-level'));
  expect(dim).toBeCloseTo(.125,6);expect(dim).toBeLessThan(normal);
  await page.getByRole('button',{name:'重置工作台'}).click();
  await place(page,'led','c15');
  const part=page.getByRole('button',{name:'红色 LED，锚点 c15',exact:true});
  for(const k of ['c16','d15','c14','b15']){
    await expect(part).toHaveAccessibleDescription(new RegExp(`阳极 A＋ 在 c15.*阴极 K− 在 ${k}`));
    await page.getByRole('button',{name:'旋转 90°',exact:true}).click();
  }
  await page.getByRole('button',{name:'添加红色 LED',exact:true}).click();
  await page.getByRole('button',{name:'孔位 c20，空闲',exact:true}).hover();
  await expect(page.locator('.preview.valid .led-pin-positive')).toHaveText('A＋');
  await expect(page.locator('.preview.valid .led-pin-negative')).toHaveText('K−');
});

test('potentiometer A-W connection changes LED brightness continuously with a fixed current limiter',async({page})=>{
  await open(page,dimmingCircuit());await run(page);
  const led=page.getByRole('button',{name:'红色 LED，锚点 f10',exact:true}).locator('[data-led-level]');
  const normal=Number(await led.getAttribute('data-led-level'));
  await page.getByRole('button',{name:'电位器，锚点 c4',exact:true}).click();
  await page.getByLabel('旋钮位置').fill('0');expect(Number(await led.getAttribute('data-led-level'))).toBeGreaterThan(normal);
  await page.getByLabel('旋钮位置').fill('100');expect(Number(await led.getAttribute('data-led-level'))).toBeLessThan(normal);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('parallel LEDs use independent branch currents for brightness',async({page})=>{
  await open(page,parallelLedCircuit());await run(page);
  const a=Number(await page.getByRole('button',{name:'红色 LED，锚点 c4',exact:true}).locator('[data-led-level]').getAttribute('data-led-level'));
  const b=Number(await page.getByRole('button',{name:'红色 LED，锚点 c13',exact:true}).locator('[data-led-level]').getAttribute('data-led-level'));
  expect(a).toBeCloseTo(2500/330/20,6);expect(b).toBeCloseTo(.125,6);
});

test('buzzer has adjustable live gain, zero-volume mute and overvoltage cutoff',async({page})=>{
  await page.addInitScript(()=>{
    const original=AudioContext.prototype.createGain;
    const gains:GainNode[]=[];
    Object.defineProperty(window,'testBuzzerGains',{value:gains});
    AudioContext.prototype.createGain=function(){const node=original.call(this);gains.push(node);return node;};
  });
  await open(page,{...createEmptyDocument(),components:[createComponent('buzzer','a1',0,'buzz')],wires:[makeWire('battery:+','b1'),makeWire('b3','battery:-')]});await run(page);
  const saved=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await expect(page.getByLabel('蜂鸣器音量')).toHaveValue('50');
  await page.getByRole('button',{name:'启用蜂鸣器声音'}).click();
  const gain=()=>page.evaluate(()=>{
    const nodes=(window as unknown as {testBuzzerGains:GainNode[]}).testBuzzerGains;
    return nodes.at(-1)?.gain.value??0;
  });
  await expect.poll(gain).toBeGreaterThan(.12);
  await page.getByLabel('蜂鸣器音量').fill('100');await expect.poll(gain).toBeGreaterThan(.24);
  await page.getByLabel('蜂鸣器音量').fill('0');await expect.poll(gain).toBeLessThan(.001);
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(saved);
  await page.getByLabel('电池预设电压').selectOption('9');
  await expect(page.getByRole('heading',{name:'蜂鸣器电压超过了工作范围'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'蜂鸣器工作了！'})).toHaveCount(0);
  await page.reload();await expect(page.getByLabel('蜂鸣器音量')).toHaveValue('50');
  await expect(page.getByRole('button',{name:'启用蜂鸣器声音'})).toHaveAttribute('aria-pressed','false');
});

test('a running switch toggles by body click or keyboard while dragging only moves it',async({page})=>{
  await open(page,switchedCircuit());
  const control=page.getByRole('button',{name:'通断开关，锚点 a8',exact:true});
  await control.click();await expect(control).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  await run(page);await control.click();
  await expect(control).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await control.click();await expect(control).toHaveAttribute('aria-pressed','false');
  await control.focus();await page.keyboard.press('Space');await expect(control).toHaveAttribute('aria-pressed','true');
  await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');
  await expect(control).toHaveAttribute('aria-pressed','false');
  await page.keyboard.press('Enter');await expect(control).toHaveAttribute('aria-pressed','true');
  const body=control.locator('.part-shape rect').first();await body.scrollIntoViewIfNeeded();
  const box=(await body.boundingBox())!,a=await boardPoint(page,0,0),b=await boardPoint(page,60,0);
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+b.x-a.x,y+b.y-a.y,{steps:8});await page.mouse.up();
  await expect(page.getByRole('button',{name:'通断开关，锚点 a11',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.reload();await expect(page.getByRole('button',{name:'通断开关，锚点 a11',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('simulation starts and stops explicitly while retaining switch settings and wiring',async({page})=>{
  await open(page,switchedCircuit());
  const status=page.getByRole('status',{name:'仿真状态'}),control=page.getByRole('button',{name:'通断开关，锚点 a8',exact:true});
  await expect(status).toContainText('已停止');
  await run(page);await control.click();
  await expect(status).toContainText('运行中');
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await page.getByRole('region',{name:'电路工作台'}).screenshot({path:'test-results/simulation-running.png'});
  const saved=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await page.getByRole('button',{name:'停止运行',exact:true}).click();
  await expect(status).toContainText('已停止');
  await expect(page.locator('.current-reading')).toHaveCount(0);
  await expect(page.locator('[data-led-level]')).toHaveAttribute('data-led-level','unknown');
  await expect(page.getByRole('button',{name:'运行电路',exact:true})).toBeFocused();
  await control.click();await control.focus();await page.keyboard.press('Enter');
  await expect(control).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(saved);
  await page.getByRole('button',{name:'运行电路',exact:true}).focus();await page.keyboard.press('Space');
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await control.focus();await page.keyboard.press('Enter');await expect(control).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'停止运行',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(status).toContainText('已停止');
  await run(page);await page.reload();
  await expect(status).toContainText('已停止');
  await expect(control).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('button',{name:'停止运行',exact:true})).toHaveCount(0);
});

test('stopping simulation silences actual browser audio and preserves session sound settings',async({page})=>{
  await page.addInitScript(()=>{
    const original=AudioContext.prototype.createOscillator,counts={started:0,stopped:0};
    Object.defineProperty(window,'testSimulationAudio',{value:counts});
    AudioContext.prototype.createOscillator=function(){
      const node=original.call(this),start=node.start.bind(node),stop=node.stop.bind(node);
      node.start=(...args:Parameters<OscillatorNode['start']>)=>{counts.started++;start(...args);};
      node.stop=(...args:Parameters<OscillatorNode['stop']>)=>{counts.stopped++;stop(...args);};
      return node;
    };
  });
  await open(page,{...createEmptyDocument(),components:[createComponent('buzzer','a1',0,'buzz')],wires:[makeWire('battery:+','b1'),makeWire('b3','battery:-')]});
  await run(page);await page.getByRole('button',{name:'启用蜂鸣器声音'}).click();
  const counts=()=>page.evaluate(()=>(window as unknown as {testSimulationAudio:{started:number;stopped:number}}).testSimulationAudio);
  await expect.poll(counts).toEqual({started:1,stopped:0});
  const saved=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
  await page.getByRole('button',{name:'停止运行',exact:true}).click();
  await expect.poll(counts).toEqual({started:1,stopped:1});
  await expect(page.getByRole('button',{name:'关闭声音'})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(saved);
  await page.getByLabel('电池预设电压').selectOption('3');
  expect(await counts()).toEqual({started:1,stopped:1});
  await run(page);await expect.poll(counts).toEqual({started:2,stopped:1});
  await expect(page.getByRole('heading',{name:'蜂鸣器工作了！'})).toBeVisible();
});

test('potentiometer pins remain individually readable and follow actual holes in every rotation',async({page})=>{
  await page.goto('/');await place(page,'potentiometer','c13');
  const part=page.getByRole('button',{name:'电位器，锚点 c13',exact:true});
  const panel=page.getByRole('region',{name:'电位器引脚与接线'});
  for(const [index,holes] of [['c13','c14','c15'],['c13','d13','e13'],['c13','c12','c11'],['c13','b13','a13']].entries()){
    await expect(part.locator('.pot-pin-label')).toHaveText(['A','W','B']);
    await expect(part).toHaveAccessibleDescription(new RegExp(`A 电阻端在 ${holes[0]}，W 滑臂在 ${holes[1]}，B 电阻端在 ${holes[2]}`));
    await expect(panel.locator('dt')).toHaveText(holes.map((hole,i)=>`${['A','W','B'][i]} · ${hole}`));
    await part.screenshot({path:`test-results/pot-pins-${index*90}.png`});
    await page.getByRole('button',{name:'旋转 90°',exact:true}).click();
  }
  await page.getByRole('button',{name:'添加电位器',exact:true}).click();
  await page.getByRole('button',{name:'孔位 c20，空闲',exact:true}).hover();
  await expect(page.locator('.preview.valid .pot-pin-label')).toHaveText(['A','W','B']);
});

test('potentiometer wiring instructions can build the A-W LED dimming example from an empty board',async({page})=>{
  await page.goto('/');
  await place(page,'resistor','a1');await place(page,'potentiometer','c4');await place(page,'led','f10');
  await page.getByRole('button',{name:'电位器，锚点 c4',exact:true}).click();
  const panel=page.getByRole('region',{name:'电位器引脚与接线'});
  await expect(panel.locator('dt')).toHaveText(['A · c4','W · c5','B · c6']);
  await expect(panel).toContainText('同一五孔组的其他空孔');
  await expect(panel).toContainText('B（c6）不接');
  await panel.getByText('三脚分压怎么接？',{exact:true}).click();
  await expect(panel.getByText(/W 接负载/)).toBeVisible();
  for(const [from,to] of [['battery:+','b1'],['e5','g10'],['g11','battery:-']]){
    await page.getByLabel('导线起点').fill(from!);await page.getByLabel('导线终点').fill(to!);
    await page.getByRole('button',{name:'添加导线',exact:true}).click();
  }
  await run(page);
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toBeVisible();
  await page.getByRole('button',{name:'电位器，锚点 c4',exact:true}).click();
  await page.getByRole('region',{name:'电路工作台'}).screenshot({path:'test-results/pot-wiring-guide.png'});
  const level=()=>page.getByRole('button',{name:'红色 LED，锚点 f10',exact:true}).locator('[data-led-level]').getAttribute('data-led-level');
  const original=Number(await level());
  await page.getByLabel('旋钮位置').fill('0');
  expect(Number(await level())).toBeGreaterThan(original);
  await expect(page.getByLabel('电位器内部电阻段')).toContainText('A–W：0 Ω');
  await page.getByLabel('旋钮位置').fill('100');
  expect(Number(await level())).toBeLessThan(original);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
