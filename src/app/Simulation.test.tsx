// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createComponent, createEmptyDocument } from '../circuit';
import type { CircuitDocument } from '../circuit';
import { STORAGE_KEY } from '../storage';
import { makeWire, switchedCircuit, validCircuit } from '../../tests/fixtures/circuits';

beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function open(document:CircuitDocument){localStorage.setItem(STORAGE_KEY,JSON.stringify(document));render(<App/>);}
const start=()=>fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
const stop=()=>fireEvent.click(screen.getByRole('button',{name:'停止运行'}));
const status=()=>screen.getByRole('status',{name:'仿真状态'});

describe('explicit simulation lifecycle',()=>{
  it('starts stopped, clears live output on stop, and resumes without editing or saving the circuit',()=>{
    open(validCircuit());
    const saved=localStorage.getItem(STORAGE_KEY);
    expect(status()).toHaveTextContent('已停止');
    start();expect(status()).toHaveTextContent('运行中');
    expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
    stop();
    expect(status()).toHaveTextContent('已停止');
    expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
    expect(document.querySelector('.current-reading')).toBeNull();
    expect(document.querySelector('[data-led-level]')).toHaveAttribute('data-led-level','unknown');
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    start();expect(screen.getByText('7.58')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });

  it('toggles the switch directly while running and only selects it while stopped',()=>{
    open(switchedCircuit());start();
    const control=screen.getByRole('button',{name:'通断开关，锚点 a8'});
    fireEvent.click(control);expect(control).toHaveAttribute('aria-pressed','true');
    const saved=localStorage.getItem(STORAGE_KEY);
    stop();fireEvent.click(control);fireEvent.keyDown(control,{key:'Enter'});
    expect(control).toHaveAttribute('aria-pressed','true');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(status()).toHaveTextContent('已停止');
    start();expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
    fireEvent.keyDown(control,{key:' '});expect(control).toHaveAttribute('aria-pressed','false');
    expect(status()).toHaveTextContent('运行中');
    fireEvent.click(screen.getByRole('button',{name:'撤销'}));
    expect(status()).toHaveTextContent('已停止');
    expect(control).toHaveAttribute('aria-pressed','true');
  });

  it.each([
    ['fault',{...createEmptyDocument(),wires:[makeWire('battery:+','b1'),makeWire('c1','battery:-')]}],
    ['unsupported',{...createEmptyDocument(),components:[createComponent('resistor','a1',0,'r'),createComponent('led','c4',0,'l1'),createComponent('led','f4',0,'l2')],wires:[makeWire('battery:+','b1'),makeWire('d5','battery:-'),makeWire('e4','g4'),makeWire('e5','g5')]}],
  ] satisfies [string,CircuitDocument][])('can stop a %s result and clears diagnostics and requested hints',(name,document)=>{
    open(document);start();
    expect(screen.getByText(name==='unsupported'?'MODEL LIMIT':'LET’S INVESTIGATE')).toBeInTheDocument();
    expect(screen.getByLabelText('诊断项目')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'揭开第一个线索'}));
    expect(window.document.querySelectorAll('.hint-list li')).toHaveLength(1);
    stop();
    expect(status()).toHaveTextContent('已停止');
    expect(screen.queryByLabelText('诊断项目')).not.toBeInTheDocument();
    expect(window.document.querySelectorAll('.hint-list li')).toHaveLength(0);
    expect(screen.getByRole('button',{name:'揭开第一个线索'})).toBeDisabled();
  });

  it('releases a held momentary button on stop without changing its saved circuit',()=>{
    open(switchedCircuit(true));start();
    fireEvent.click(screen.getByRole('button',{name:'常开按钮，锚点 e8'}));
    const hold=screen.getByRole('button',{name:'按住按钮'}),saved=localStorage.getItem(STORAGE_KEY);
    fireEvent.keyDown(hold,{key:' '});
    expect(hold).toHaveAttribute('aria-pressed','true');
    stop();expect(hold).toHaveAttribute('aria-pressed','false');
    start();expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
  });

  it('stops buzzer playback and restarts it only when simulation resumes, preserving sound preferences',async()=>{
    const startAudio=vi.fn(),stopAudio=vi.fn(),createOscillator=vi.fn(()=>({type:'',frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start:startAudio,stop:stopAudio}));
    vi.stubGlobal('AudioContext',class{state='running';destination={};resume=vi.fn().mockResolvedValue(undefined);createOscillator=createOscillator;createGain=()=>({gain:{value:0},connect:vi.fn(),disconnect:vi.fn()});close=vi.fn().mockResolvedValue(undefined);});
    open({...createEmptyDocument(),components:[createComponent('buzzer','a1',0,'buzz')],wires:[makeWire('battery:+','b1'),makeWire('b3','battery:-')]});
    start();fireEvent.click(screen.getByRole('button',{name:'启用蜂鸣器声音'}));
    await waitFor(()=>expect(startAudio).toHaveBeenCalledOnce());
    stop();expect(stopAudio).toHaveBeenCalledOnce();
    expect(screen.getByRole('button',{name:'关闭声音'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByLabelText('蜂鸣器音量')).toHaveValue('50');
    fireEvent.change(screen.getByLabelText('电池预设电压'),{target:{value:'3'}});
    expect(createOscillator).toHaveBeenCalledOnce();
    expect(status()).toHaveTextContent('已停止');
    start();expect(startAudio).toHaveBeenCalledTimes(2);
  });
});
