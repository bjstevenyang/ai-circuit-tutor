import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createComponent, createEmptyDocument } from '../../src/circuit';
import type { CircuitDocument, ComponentKind } from '../../src/circuit';
import { STORAGE_KEY } from '../../src/storage';
import { makeWire, switchedCircuit, validCircuit } from '../fixtures/circuits';

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
  await page.getByRole('button',{name:'开关接通'}).click();
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
  await page.getByRole('button',{name:'运行电路',exact:true}).focus();
  await page.keyboard.up('Space');
  await expect(hold).toHaveAttribute('aria-pressed','false');
  await page.reload();await run(page);
  await expect(page.getByRole('heading',{name:'亮起来了！'})).toHaveCount(0);
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
