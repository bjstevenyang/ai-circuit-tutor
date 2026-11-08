// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { createComponent, createEmptyDocument } from '../circuit';
import type { CircuitDocument, ComponentKind } from '../circuit';
import { STORAGE_KEY } from '../storage';
import { makeWire, switchedCircuit } from '../../tests/fixtures/circuits';

beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function open(document:CircuitDocument){localStorage.setItem(STORAGE_KEY,JSON.stringify(document));render(<App/>);}
const run=()=>fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
function place(kind:ComponentKind,anchor:string){
  fireEvent.change(screen.getByLabelText('元件',{exact:true}),{target:{value:kind}});
  fireEvent.change(screen.getByLabelText('锚点孔位',{exact:true}),{target:{value:anchor}});
  fireEvent.click(screen.getByRole('button',{name:'放置元件'}));
}

describe('expanded experiment controls',()=>{
  it('offers twelve kinds and allows repeated placement of a kind',()=>{
    render(<App/>);
    expect(screen.getByLabelText('元件',{exact:true}).querySelectorAll('option')).toHaveLength(12);
    place('resistor','a1');place('resistor','a10');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components).toHaveLength(2);
    place('button','e20');
    expect(screen.getByText('e20 ↔ e21 ↔ f20 ↔ f21')).toBeInTheDocument();
  });
  it('recomputes a maintaining switch after Run, then invalidates results on undo',()=>{
    open(switchedCircuit());run();
    expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'通断开关，锚点 a8'}));
    expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components[2].closed).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'撤销'}));
    expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
    run();expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
  });
  it('holds the momentary button with keyboard/pointer, releases on blur, and never saves the press',()=>{
    open(switchedCircuit(true));run();
    fireEvent.click(screen.getByRole('button',{name:'常开按钮，锚点 e8'}));
    const hold=screen.getByRole('button',{name:'按住按钮'});
    const saved=localStorage.getItem(STORAGE_KEY);
    fireEvent.keyDown(hold,{key:' '});
    expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
    fireEvent.keyUp(hold,{key:' '});
    expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
    fireEvent.pointerDown(hold,{pointerId:1});
    expect(hold).toHaveAttribute('aria-pressed','true');
    fireEvent.blur(hold);
    expect(hold).toHaveAttribute('aria-pressed','false');
    fireEvent.keyDown(hold,{key:'Enter'});
    expect(hold).toHaveAttribute('aria-pressed','true');
    fireEvent.blur(window);
    expect(hold).toHaveAttribute('aria-pressed','false');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
  it.each([' ','Enter'])('operates the board button directly with %j without persisting the press',key=>{
    open(switchedCircuit(true));run();
    const button=screen.getByRole('button',{name:'常开按钮，锚点 e8'}),saved=localStorage.getItem(STORAGE_KEY);
    expect(button).toHaveAttribute('aria-pressed','false');
    fireEvent.keyDown(button,{key});
    expect(button).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
    fireEvent.keyDown(button,{key,repeat:true});
    fireEvent.keyUp(button,{key:key===' '?'Enter':' '});
    expect(button).toHaveAttribute('aria-pressed','true');
    fireEvent.keyUp(button,{key});
    expect(button).toHaveAttribute('aria-pressed','false');
    fireEvent.keyDown(button,{key});fireEvent.blur(button);
    expect(button).toHaveAttribute('aria-pressed','false');
    expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
  });
  it('clears a board-button hold on Stop and ignores activation while stopped',()=>{
    open(switchedCircuit(true));run();
    const button=screen.getByRole('button',{name:'常开按钮，锚点 e8'});
    fireEvent.keyDown(button,{key:' '});
    fireEvent.click(screen.getByRole('button',{name:'停止运行'}));
    expect(button).toHaveAttribute('aria-pressed','false');
    fireEvent.keyDown(button,{key:' '});
    expect(button).toHaveAttribute('aria-pressed','false');
    run();expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
    fireEvent.keyDown(button,{key:' '});
    expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
    fireEvent.keyDown(button,{key:'Escape'});
    expect(button).toHaveAttribute('aria-pressed','false');
  });
  it('recomputes LDR current and overcurrent as simulated light changes',()=>{
    const document={...createEmptyDocument(),components:[createComponent('ldr','a1',0,'ldr'),createComponent('led','c3',0,'led')],wires:[makeWire('battery:+','b1'),makeWire('d4','battery:-')]};
    open(document);run();
    fireEvent.click(screen.getByRole('button',{name:'光敏电阻，锚点 a1'}));
    fireEvent.change(screen.getByLabelText('模拟光照'),{target:{value:'100'}});
    expect(screen.getByText('25.00')).toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'电流超过了课程限制'})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('模拟光照'),{target:{value:'0'}});
    expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
    expect(screen.getByText('0.03')).toBeInTheDocument();
  });
  it('adjusts a three-terminal potentiometer and saves the setting without moving its pins',()=>{
    const document={...createEmptyDocument(),components:[createComponent('potentiometer','a1',0,'pot'),createComponent('led','c2',0,'led')],wires:[makeWire('battery:+','b1'),makeWire('b3','battery:-')]};
    open(document);run();
    fireEvent.click(screen.getByRole('button',{name:'电位器，锚点 a1'}));
    expect(screen.getByText('0.50')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('旋钮位置'),{target:{value:'25'}});
    expect(screen.getByText('1.00')).toBeInTheDocument();
    expect(screen.getByText('a1 ↔ a2 ↔ a3')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components[0].position).toBe(25);
  });
  it('keeps audio off initially, plays only after opt-in, and stops when disabled',async()=>{
    const start=vi.fn(),stop=vi.fn(),close=vi.fn().mockResolvedValue(undefined);
    const oscillator={type:'',frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start,stop};
    const gain={gain:{value:0},connect:vi.fn(),disconnect:vi.fn()};
    const createOscillator=vi.fn(()=>oscillator);
    vi.stubGlobal('AudioContext',class{state='running';destination={};resume=vi.fn().mockResolvedValue(undefined);createOscillator=createOscillator;createGain=()=>gain;close=close;});
    open({...createEmptyDocument(),components:[createComponent('buzzer','a1',0,'buzz')],wires:[makeWire('battery:+','b1'),makeWire('b3','battery:-')]});
    run();expect(screen.getByRole('heading',{name:'蜂鸣器工作了！'})).toBeInTheDocument();
    expect(createOscillator).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'启用蜂鸣器声音'}));
    await waitFor(()=>expect(start).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button',{name:'关闭声音'}));
    expect(stop).toHaveBeenCalledOnce();
    cleanup();expect(close).toHaveBeenCalledOnce();
  });
  it('reports unavailable sound while preserving the visual buzzer result',async()=>{
    vi.stubGlobal('AudioContext',undefined);
    render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'启用蜂鸣器声音'}));
    expect(await screen.findByText('声音不可用，仍可查看蜂鸣器的鸣响状态。')).toBeInTheDocument();
  });
});
