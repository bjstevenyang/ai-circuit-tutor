import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createEmptyDocument, componentBody, ENDPOINT_BY_ID, getComponentPins } from '../../src/circuit';
import { oscillatorFixture } from '../../src/circuit/oscillator/fixtures';
import { STORAGE_KEY } from '../../src/storage';
import { audioCounters, openFixture } from '../performance/helpers';
import { switchedCircuit, validCircuit } from '../fixtures/circuits';
import type { CircuitDocument, Wire } from '../../src/circuit';

const wire=(from:string,to:string):Wire=>({id:'test-wire',from,to,color:'#b45b49',bend:'horizontal'});
const stored=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!) as CircuitDocument,STORAGE_KEY);
async function point(page:Page,x:number,y:number){
  const board=page.locator('.breadboard-svg');await board.scrollIntoViewIfNeeded();
  return board.evaluate((element,p)=>{const matrix=(element as SVGSVGElement).getScreenCTM()!;const result=new DOMPoint(p.x,p.y).matrixTransform(matrix);return {x:result.x,y:result.y};},{x,y});
}
async function clickAt(page:Page,x:number,y:number){const p=await point(page,x,y);await page.mouse.click(p.x,p.y);}
async function dragTo(page:Page,from:{x:number;y:number},to:{x:number;y:number}){
  const a=await point(page,from.x,from.y),b=await point(page,to.x,to.y);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
}
const selectWire=(page:Page,w:Wire)=>page.getByRole('button',{name:`导线 ${w.from} 到 ${w.to}`,exact:true}).press('Enter');

test('WIRING physical clicks prefer a wire over holes in inspect and holes in wiring',async({page})=>{
  const doc=validCircuit();doc.wires.push(wire('a20','a24'));await openFixture(page,doc);
  await page.getByRole('button',{name:'运行电路',exact:true}).click();
  await expect(page.getByLabel('仿真状态')).toContainText('运行中');
  const before=await stored(page);
  await clickAt(page,560,170); // a22 lies under the visible folded wire.
  await expect(page.getByRole('button',{name:'导线 a20 到 a24',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('仿真状态')).toContainText('运行中');
  expect(await stored(page)).toEqual(before);await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'连线',exact:true}).click();await clickAt(page,560,170);
  await expect(page.getByLabel('导线起点',{exact:true})).toHaveValue('a22');
  expect(await stored(page)).toEqual(before);
});

test('WIRING new curves drag once, undo, keyboard-adjust and restore exact geometry',async({page},testInfo)=>{
  await page.addInitScript(key=>{
    const evidence={writes:0},original=Storage.prototype.setItem;
    Object.assign(window,{wireStorageEvidence:evidence});
    Storage.prototype.setItem=function(name,value){if(name===key)evidence.writes++;original.call(this,name,value);};
  },STORAGE_KEY);
  const writes=()=>page.evaluate(()=>(window as unknown as {wireStorageEvidence:{writes:number}}).wireStorageEvidence.writes);
  await openFixture(page,createEmptyDocument());
  await expect(page.getByLabel('导线路径',{exact:true})).toHaveValue('curve');
  await page.getByLabel('导线起点',{exact:true}).fill('a1');await page.getByLabel('导线终点',{exact:true}).fill('a5');
  await page.getByRole('button',{name:'添加导线',exact:true}).click();
  const first=(await stored(page)).wires[0]!;expect(first).toMatchObject({from:'a1',to:'a5',bend:'curve',curveControl:{x:180,y:218}});
  await selectWire(page,first);
  const count=await writes();await dragTo(page,first.curveControl!,{x:230,y:288});
  expect((await stored(page)).wires[0]).toEqual(first); // Preview never saves.
  expect(await writes()).toBe(count);
  await page.mouse.up();
  expect(await writes()).toBe(count+1);
  const moved=(await stored(page)).wires[0]!;expect(moved.curveControl!.x).toBeCloseTo(230,3);expect(moved.curveControl!.y).toBeCloseTo(288,3);
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await stored(page)).wires[0]).toEqual(first);
  await page.getByRole('button',{name:'重做',exact:true}).click();expect((await stored(page)).wires[0]).toEqual(moved);
  await selectWire(page,moved);const handle=page.getByRole('button',{name:'导线曲线控制点',exact:true});
  await handle.press('ArrowRight');await handle.press('Shift+ArrowUp');
  const adjusted=(await stored(page)).wires[0]!;expect(adjusted.curveControl!.x).toBeCloseTo(240,3);expect(adjusted.curveControl!.y).toBeCloseTo(287,3);
  await handle.focus();await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');
  expect((await stored(page)).wires[0]!.curveControl!.x).toBeCloseTo(250,3);
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await stored(page)).wires[0]).toEqual(adjusted);
  await page.reload();expect((await stored(page)).wires[0]).toEqual(adjusted);await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await selectWire(page,adjusted);await page.getByRole('button',{name:'导线曲线控制点',exact:true}).click();
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  await page.locator('.workbench-panel').screenshot({path:testInfo.outputPath('curved-wire.png')});
  await page.getByLabel('所选导线路径',{exact:true}).selectOption('vertical');expect((await stored(page)).wires[0]).not.toHaveProperty('curveControl');
  await page.getByLabel('所选导线路径',{exact:true}).selectOption('curve');expect((await stored(page)).wires[0]!.curveControl).toEqual(first.curveControl);
});

test('WIRING curve preview cancels on Escape, pointer cancellation, mode change and deletion',async({page})=>{
  const w:Wire={...wire('a1','a5'),bend:'curve',curveControl:{x:180,y:218}};
  const doc={...createEmptyDocument(),wires:[w]};
  for(const cancel of ['escape','pointercancel','capture','blur','mode','document','delete']){
    await openFixture(page,doc);await selectWire(page,w);
    await dragTo(page,w.curveControl!,{x:240,y:280});
    if(cancel==='escape')await page.keyboard.press('Escape');
    if(cancel==='pointercancel')await page.locator('.breadboard-svg').dispatchEvent('pointercancel');
    if(cancel==='capture')await page.locator('.breadboard-svg').dispatchEvent('lostpointercapture');
    if(cancel==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    if(cancel==='mode'){const tool=page.getByRole('button',{name:'连线',exact:true});await tool.focus();await tool.press('Enter');}
    if(cancel==='document'){const model=page.getByRole('radio',{name:'自激发声·虚拟模型v2',exact:true});await model.focus();await model.press('Space');}
    if(cancel==='delete')await page.keyboard.press('Delete');
    await page.mouse.up();
    expect((await stored(page)).wires).toEqual(cancel==='delete'?[]:[w]);
    if(cancel==='document')expect((await stored(page)).modelProfileId).toBe('oscillator-em-v2');
    if(cancel!=='delete'&&cancel!=='document')await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
  }
});

test('WIRING scaled and scrolled curves clamp and reconnect onto a pin without changing the control point',async({page})=>{
  const w:Wire={...wire('a1','a5'),bend:'curve',curveControl:{x:180,y:218}};
  await openFixture(page,{...createEmptyDocument(),wires:[w],components:[{id:'part',kind:'resistor',anchor:'c10',rotation:0,resistance:330}]});
  const width=(await page.locator('.breadboard-svg').boundingBox())!.width;
  await page.getByRole('button',{name:'放大画布',exact:true}).click();await page.getByRole('button',{name:'放大画布',exact:true}).click();
  expect((await page.locator('.breadboard-svg').boundingBox())!.width).toBeGreaterThan(width*1.4);
  await page.mouse.wheel(0,250);await selectWire(page,w);
  await dragTo(page,w.curveControl!,{x:240,y:268});await page.mouse.up();
  const adjusted=(await stored(page)).wires[0]!;expect(adjusted.curveControl!.x).toBeCloseTo(240,3);expect(adjusted.curveControl!.y).toBeCloseTo(268,3);
  await dragTo(page,adjusted.curveControl!,{x:-100,y:268});await page.mouse.up();
  const clamped=(await stored(page)).wires[0]!;expect(clamped.curveControl!.x).toBe(16);
  await page.getByRole('button',{name:'撤销',exact:true}).click();await selectWire(page,adjusted);
  await dragTo(page,{x:220,y:170},{x:320,y:210});await page.mouse.up();
  expect((await stored(page)).wires[0]).toEqual({...adjusted,to:'c10'});
  await expect(page.locator('#socket-c10')).toHaveAttribute('data-occupancy','shared');
});

test('WIRING actual pin clicks and drags share sockets without moving parts; opposite placement and reconnection work',async({page})=>{
  const doc: CircuitDocument={...createEmptyDocument(),components:[{id:'part',kind:'resistor',anchor:'a10',rotation:0,resistance:330}]};
  await openFixture(page,doc);await page.getByRole('button',{name:'连线',exact:true}).click();
  await clickAt(page,320,170);await expect(page.getByLabel('导线起点',{exact:true})).toHaveValue('a10');
  await clickAt(page,285,565);await expect(page.locator('#socket-a10')).toHaveAttribute('data-occupancy','shared');
  await dragTo(page,{x:325,y:565},{x:380,y:170});await page.mouse.up();
  let result=await stored(page);expect(result.components[0]).toEqual(doc.components[0]);expect(result.wires).toHaveLength(2);
  await expect(page.locator('#socket-a13')).toHaveAttribute('data-occupancy','shared');
  await page.getByRole('button',{name:'查看连接',exact:true}).click();await clickAt(page,350,170);
  await page.getByRole('button',{name:'旋转 90°',exact:true}).click();result=await stored(page);
  expect(result.components[0]!.rotation).toBe(90);await expect(page.locator('#socket-a13')).toHaveAttribute('data-occupancy','wire');
  const anchors=result.wires;await page.getByLabel('所选元件新锚点').fill('a20');await page.getByRole('button',{name:'移动元件',exact:true}).click();
  expect((await stored(page)).wires).toEqual(anchors);await page.getByRole('button',{name:'删除',exact:true}).click();expect((await stored(page)).wires).toEqual(anchors);
  const old=wire('battery:+','a10');await openFixture(page,{...createEmptyDocument(),wires:[old]});
  await page.getByLabel('元件',{exact:true}).selectOption('resistor');await page.getByLabel('锚点孔位',{exact:true}).fill('a10');
  await page.getByRole('button',{name:'放置元件',exact:true}).click();await expect(page.locator('#socket-a10')).toHaveAttribute('data-occupancy','shared');
  await selectWire(page,old);await page.getByLabel('所选导线路径',{exact:true}).selectOption('curve');const curve=(await stored(page)).wires[0]!;
  await page.getByLabel('新接点孔位').fill('a13');await page.getByRole('button',{name:'修改接点',exact:true}).click();
  expect((await stored(page)).wires[0]).toEqual({...curve,to:'a13'});await expect(page.locator('#socket-a10')).toHaveAttribute('data-occupancy','pin');
  await expect(page.locator('#socket-a13')).toHaveAttribute('data-occupancy','shared');
});

test('WIRING curve editing stops a computed oscillator and audio; selection and guide reading do not',async({page})=>{
  await audioCounters(page);const doc=oscillatorFixture();doc.wires[0]={...doc.wires[0]!,bend:'curve',curveControl:{x:350,y:180}};
  await openFixture(page,doc);await page.getByRole('button',{name:'运行电路',exact:true}).click();
  await expect(page.locator('.result-card h3')).toHaveText('检测到稳定周期',{timeout:15000});
  await page.getByRole('button',{name:'启用扬声器声音',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>((window as unknown as {audioEvidence:{started:number}}).audioEvidence.started))).toBeGreaterThan(0);
  const before=await stored(page);await page.getByRole('button',{name:/^PNP 晶体管，锚点/}).press('Enter');
  await expect(page.getByRole('region',{name:'PNP 晶体管使用说明'})).toContainText('一根导线与一个引脚共孔');
  expect(await stored(page)).toEqual(before);await expect(page.locator('.result-card h3')).toHaveText('检测到稳定周期');
  await selectWire(page,doc.wires[0]!);await expect(page.locator('.result-card h3')).toHaveText('检测到稳定周期');
  await page.getByRole('button',{name:'导线曲线控制点',exact:true}).press('ArrowDown');
  await expect(page.getByLabel('仿真状态')).toContainText('已停止');await expect(page.getByLabel('实验读数')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>{const evidence=(window as unknown as {audioEvidence:{started:number;stopped:number}}).audioEvidence;return evidence.stopped>=evidence.started;})).toBe(true);
  await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.getByLabel('仿真状态')).toContainText('已停止');
});

test('WIRING wires crossing a running button or switch do not steal its body controls',async({page})=>{
  for(const button of [true,false]){
    const doc=switchedCircuit(button),control=doc.components.find(p=>p.id==='control')!,body=componentBody(control)!;
    const a=ENDPOINT_BY_ID.get('e1')!,b=ENDPOINT_BY_ID.get('f16')!;
    // Construct a curve through the body centre at t=1/2.
    doc.wires.push({...wire(a.id,b.id),bend:'curve',curveControl:{x:2*body.cx-(a.x+b.x)/2,y:2*body.cy-(a.y+b.y)/2}});
    await openFixture(page,doc);await page.getByRole('button',{name:'运行电路',exact:true}).click();
    const item=page.getByRole('button',{name:button?/^常开按钮，锚点/:/^通断开关，锚点/});
    if(button){const p=await point(page,body.cx,body.cy);await page.mouse.move(p.x,p.y);await page.mouse.down();await expect(item).toHaveAttribute('aria-pressed','true');await page.mouse.up();await expect(item).toHaveAttribute('aria-pressed','false');}
    else {await clickAt(page,body.cx,body.cy);expect((await stored(page)).components.find(p=>p.id==='control')!.closed).toBe(true);}
    expect((await stored(page)).components.find(p=>p.id==='control')!.anchor).toBe(control.anchor);
    await page.getByRole('button',{name:'连线',exact:true}).click();
    const pin=ENDPOINT_BY_ID.get(getComponentPins(control)![0]!)!;await clickAt(page,pin.x,pin.y);
    await expect(page.getByLabel('导线起点',{exact:true})).toHaveValue(pin.id);
    await expect(item).toHaveAttribute('aria-pressed',button?'false':'true');
    expect((await stored(page)).components.find(p=>p.id==='control')!.anchor).toBe(control.anchor);
  }
});
