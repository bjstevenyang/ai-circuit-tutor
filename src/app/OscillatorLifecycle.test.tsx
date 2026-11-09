// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { oscillatorFixture } from '../circuit/oscillator/fixtures';
import { STORAGE_KEY } from '../storage';
import { createComponent } from '../circuit';
import type { WorkerRequest } from './oscillatorSession';
import type { OscillatorResult } from '../circuit/oscillator/types';

class FakeWorker {
  static instances:FakeWorker[]=[];
  onmessage:Worker['onmessage']=null;onerror:Worker['onerror']=null;request!:WorkerRequest;terminate=vi.fn();
  constructor(){FakeWorker.instances.push(this);}
  postMessage(request:WorkerRequest){this.request=request;}
  result(result:OscillatorResult={outcome:'periodic',timeS:.04,reason:'0–40 ms稳定周期',entities:[],readings:{},speaker:{id:'SPK1',voltageV:.2,acRmsV:.365,frequencyHz:288.5,bypassed:false}}){act(()=>this.onmessage?.call(this as unknown as Worker,{data:{...this.request,type:'result',result,elapsedMs:1}} as MessageEvent));}
}
const latest=()=>FakeWorker.instances.at(-1)!;
const start=()=>fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
const status=()=>screen.getByLabelText('仿真状态');
beforeEach(()=>{localStorage.clear();FakeWorker.instances=[];vi.stubGlobal('Worker',FakeWorker);vi.spyOn(document,'hasFocus').mockReturnValue(true);localStorage.setItem(STORAGE_KEY,JSON.stringify(oscillatorFixture()));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('oscillator cold-run event contract',()=>{
  it('publishes calculating without readings, rejects an old completion, and restarts from the current config',()=>{
    render(<App/>);const saved=localStorage.getItem(STORAGE_KEY);start();const old=latest();
    expect(status()).toHaveTextContent('计算中');expect(screen.queryByText(/稳定频率/)).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    fireEvent.click(screen.getByRole('button',{name:'停止运行'}));expect(old.terminate).toHaveBeenCalledOnce();old.result();expect(status()).toHaveTextContent('已停止');
    start();expect(latest()).not.toBe(old);latest().result();expect(screen.getByRole('heading',{name:'检测到稳定周期'})).toBeInTheDocument();
    expect(screen.getByLabelText('实验读数')).toHaveTextContent('288.5 Hz');expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
  it('recomputes R/C/source values from cold state, but topology and undo stop and invalidate generations',()=>{
    render(<App/>);start();const first=latest();
    fireEvent.change(screen.getByLabelText('电池预设电压'),{target:{value:'6'}});
    expect(first.terminate).toHaveBeenCalledOnce();expect(latest().request.document.supplyVoltage).toBe(6);expect(status()).toHaveTextContent('计算中');
    first.result();expect(screen.queryByRole('heading',{name:'检测到稳定周期'})).not.toBeInTheDocument();
    const current=latest();fireEvent.click(screen.getByRole('button',{name:'撤销'}));expect(current.terminate).toHaveBeenCalledOnce();expect(status()).toHaveTextContent('已停止');current.result();expect(status()).toHaveTextContent('已停止');
  });
  it('restarts capacitance, persistent switch and momentary button changes, and keeps guide reading inert',()=>{
    const fixture=oscillatorFixture();fixture.components.push(createComponent('switch','f1',0,'control'),createComponent('button','e25',0,'momentary'));
    localStorage.setItem(STORAGE_KEY,JSON.stringify(fixture));render(<App/>);start();
    fireEvent.click(screen.getByRole('button',{name:'电容，锚点 a13'}));
    const before=latest();fireEvent.change(screen.getByLabelText('电容容量预设'),{target:{value:'4.7e-8'}});
    expect(before.terminate).toHaveBeenCalledOnce();expect(latest().request.document.components.find(p=>p.kind==='capacitor')?.capacitanceF).toBe(47e-9);
    fireEvent.click(screen.getByRole('button',{name:'通断开关，锚点 f1'}));expect(latest().request.document.components.find(p=>p.id==='control')?.closed).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'常开按钮，锚点 e25'}));const saved=localStorage.getItem(STORAGE_KEY);
    const hold=screen.getByRole('button',{name:'按住按钮'});fireEvent.keyDown(hold,{key:' '});expect(latest().request.controls.pressedButtons).toEqual(['momentary']);
    fireEvent.keyUp(hold,{key:' '});expect(latest().request.controls.pressedButtons).toEqual([]);expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    const count=FakeWorker.instances.length;fireEvent.click(screen.getByRole('button',{name:'添加PNP 晶体管'}));expect(FakeWorker.instances).toHaveLength(count);expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    fireEvent.click(screen.getByRole('radio',{name:'教学方波'}));expect(status()).toHaveTextContent('已停止');expect(latest().terminate).toHaveBeenCalledOnce();
  });
  it('cancels and clears in the background, returns from zero, and never resumes after a background stop/edit',()=>{
    render(<App/>);start();latest().result();const old=latest();fireEvent.blur(window);
    expect(status()).toHaveTextContent('后台已暂停');expect(screen.queryByText(/稳定频率/)).not.toBeInTheDocument();old.result();
    fireEvent.focus(window);expect(status()).toHaveTextContent('计算中');expect(FakeWorker.instances).toHaveLength(2);
    fireEvent.blur(window);fireEvent.click(screen.getByRole('button',{name:'停止运行'}));fireEvent.focus(window);expect(status()).toHaveTextContent('已停止');expect(FakeWorker.instances).toHaveLength(2);
    start();fireEvent.blur(window);fireEvent.change(screen.getByLabelText('电池预设电压'),{target:{value:'6'}});fireEvent.focus(window);expect(status()).toHaveTextContent('已停止');expect(FakeWorker.instances).toHaveLength(3);
  });
  it('keeps the failed reason and accepted time as evidence, with no fake readings or persisted runtime',()=>{
    render(<App/>);start();latest().result({outcome:'numerical-failure',timeS:.003,reason:'LTE在最小步仍失败',entities:['Q1']});
    expect(status()).toHaveTextContent('运行受限');expect(screen.getByRole('heading',{name:'数值计算未完成'})).toBeInTheDocument();
    expect(screen.getByLabelText('实验读数')).toHaveTextContent('最后接受时刻');expect(document.querySelector('.current-reading')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'揭开第一个线索'}));expect(screen.getByText(/提示证据快照/)).toHaveTextContent('0.003 s');
    expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(/numerical-failure|sessionId|samples/);
    fireEvent(window,new Event('pagehide'));expect(status()).toHaveTextContent('已停止');
  });
});
