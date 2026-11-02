// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';
import { createComponent, createEmptyDocument } from '../circuit';
import type { ComponentKind } from '../circuit';
import { STORAGE_KEY } from '../storage';
import { validCircuit } from '../../tests/fixtures/circuits';

beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const examples: [ComponentKind,string,string,number][] = [
  ['resistor','电阻','限流阀',2],
  ['led','红色 LED','发光二极管',2],
  ['switch','通断开关','保持',2],
  ['button','常开按钮','门铃',4],
  ['potentiometer','电位器','可以用旋钮调整',3],
  ['buzzer','有源蜂鸣器','发声',2],
  ['diode','二极管','单向门',2],
  ['ldr','光敏电阻','感受光线',2],
];

describe('component knowledge at the point of use',()=>{
  it.each(examples)('explains %s from the tray before placing anything',(kind,name,concept,pinCount)=>{
    render(<App/>);
    const write=vi.spyOn(Storage.prototype,'setItem');
    fireEvent.click(screen.getByRole('button',{name:`添加${name}`}));
    const guide=within(screen.getByRole('region',{name:`${name}使用说明`}));
    expect(guide.getByText(new RegExp(concept))).toBeInTheDocument();
    expect(guide.getByRole('heading',{name:'引脚怎么认'})).toBeInTheDocument();
    expect(guide.getByRole('heading',{name:'怎么接入电路'})).toBeInTheDocument();
    expect(guide.getByLabelText('示例连接路径')).toHaveTextContent('电池');
    expect(screen.getByRole('region',{name:`${name}使用说明`}).querySelectorAll('dt')).toHaveLength(pinCount);
    expect(screen.getByLabelText('元件',{exact:true})).toHaveValue(kind);
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('follows a placed component and maps pin names to holes after rotation and movement',()=>{
    const document={...createEmptyDocument(),components:[createComponent('potentiometer','a20',90,'pot')]};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(document));
    render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'电位器，锚点 a20'}));
    const guide=screen.getByRole('region',{name:'电位器使用说明'});
    expect([...guide.querySelectorAll('dt')].map(pin=>pin.textContent)).toEqual(['Aa20','Wb20','Bc20']);
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('所选元件新锚点'),{target:{value:'f20'}});
    fireEvent.click(screen.getByRole('button',{name:'移动元件'}));
    expect([...guide.querySelectorAll('dt')].map(pin=>pin.textContent)).toEqual(['Af20','Wg20','Bh20']);
  });

  it('explains actual potentiometer connections and synchronizes segment values, rotation and movement',()=>{
    const document={...createEmptyDocument(),components:[createComponent('potentiometer','c13',0,'pot')]};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(document));
    render(<App/>);
    const saved=localStorage.getItem(STORAGE_KEY);
    fireEvent.click(screen.getByRole('button',{name:'电位器，锚点 c13'}));
    const panel=screen.getByRole('region',{name:'电位器引脚与接线'});
    expect([...panel.querySelectorAll('dt')].map(pin=>pin.textContent)).toEqual(['A · c13','W · c14','B · c15']);
    expect(panel).toHaveTextContent('没有固定正负极');
    expect(panel).toHaveTextContent('LED 调光：用 A 和 W，B 留空');
    expect(panel).toHaveTextContent('同一五孔组的其他空孔');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    expect(screen.getByLabelText('电位器内部电阻段')).toHaveTextContent('A–W：5,000 Ω · W–B：5,000 Ω');
    fireEvent.change(screen.getByLabelText('旋钮位置'),{target:{value:'25'}});
    expect(screen.getByLabelText('电位器内部电阻段')).toHaveTextContent('A–W：2,500 Ω · W–B：7,500 Ω');
    fireEvent.click(screen.getByRole('button',{name:'旋转 90°'}));
    expect([...panel.querySelectorAll('dt')].map(pin=>pin.textContent)).toEqual(['A · c13','W · d13','B · e13']);
    fireEvent.change(screen.getByLabelText('所选元件新锚点'),{target:{value:'f13'}});
    fireEvent.click(screen.getByRole('button',{name:'移动元件'}));
    expect([...panel.querySelectorAll('dt')].map(pin=>pin.textContent)).toEqual(['A · f13','W · g13','B · h13']);
  });

  it('explains the two button groups and distinguishes its virtual footprint',()=>{
    render(<App/>);
    fireEvent.change(screen.getByLabelText('元件',{exact:true}),{target:{value:'button'}});
    const guide=within(screen.getByRole('region',{name:'常开按钮使用说明'}));
    expect(guide.getByText('与 2 永久相连，属于第一组')).toBeInTheDocument();
    expect(guide.getByText('与 4 永久相连，属于第二组')).toBeInTheDocument();
    fireEvent.click(guide.getByText('常见错误与模型说明'));
    expect(guide.getByText(/封装约定/)).toBeVisible();
    expect(guide.getByText(/只接 1 与 2/)).toBeVisible();
  });

  it('preserves the run result, hint progress, document and history while reading about a component',()=>{
    const document=validCircuit();
    document.components[1]={...document.components[1]!,anchor:'c14',rotation:180};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(document));
    render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
    fireEvent.click(screen.getByRole('button',{name:'揭开第一个线索'}));
    const saved=localStorage.getItem(STORAGE_KEY),write=vi.spyOn(Storage.prototype,'setItem');
    fireEvent.click(screen.getByRole('button',{name:'红色 LED，锚点 c14'}));
    expect(screen.getByRole('region',{name:'红色 LED使用说明'})).toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'LED 的方向反了'})).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(write).not.toHaveBeenCalled();
  });

  it('replaces old content when choosing another kind and clears it for a hole or wire selection',()=>{
    const document=validCircuit();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(document));
    render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'电阻 330 欧姆，锚点 a10'}));
    expect(screen.getByRole('region',{name:'电阻使用说明'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'添加二极管'}));
    expect(screen.getByRole('region',{name:'二极管使用说明'})).toBeInTheDocument();
    expect(screen.queryByRole('region',{name:'电阻使用说明'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'导线 battery:+ 到 b10'}));
    expect(screen.queryByRole('region',{name:'二极管使用说明'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'电阻 330 欧姆，锚点 a10'}));
    fireEvent.change(screen.getByLabelText('元件',{exact:true}),{target:{value:'potentiometer'}});
    expect(screen.getByRole('region',{name:'电位器使用说明'}).querySelectorAll('code')).toHaveLength(0);
    expect(screen.queryByRole('region',{name:'电阻使用说明'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'电阻 330 欧姆，锚点 a10'}));
    fireEvent.click(screen.getByRole('button',{name:'孔位 a1，空闲'}));
    expect(screen.queryByRole('region',{name:'电阻使用说明'})).not.toBeInTheDocument();
  });
});
