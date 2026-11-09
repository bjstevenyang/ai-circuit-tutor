// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createComponent, createEmptyDocument } from '../circuit';
import { STORAGE_KEY } from '../storage';

beforeEach(()=>localStorage.clear());
afterEach(cleanup);
describe('OSC-01/02/06 configuration slice (not numerical conformance)',()=>{
  it('explicitly switches profiles, preserves capacitance and voltage, stops and undoes',()=>{
    const d={...createEmptyDocument(),supplyVoltage:6,components:[createComponent('capacitor','c13',0,'cap')]};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
    fireEvent.click(screen.getByRole('radio',{name:'自激发声·虚拟模型'}));
    expect(screen.getByRole('radio',{name:'自激发声·虚拟模型'})).toBeChecked();
    expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');
    const changed=JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(changed.modelProfileId).toBe('oscillator-em-v1');expect(changed.supplyVoltage).toBe(6);
    expect(changed.components[0].capacitanceF).toBe(100e-6);
    fireEvent.click(screen.getByRole('button',{name:'电容，锚点 c13'}));
    expect(screen.getByText('已保留容量；该值不在当前模型范围内，运行前请调整。')).toBeVisible();
    fireEvent.change(screen.getByLabelText('电容容量',{exact:true}),{target:{value:'100'}});
    fireEvent.click(screen.getByRole('button',{name:'应用电容容量'}));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components[0].capacitanceF).toBe(100e-9);
    fireEvent.click(screen.getByRole('button',{name:'撤销'}));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components[0].capacitanceF).toBe(100e-6);
    fireEvent.click(screen.getByRole('button',{name:'撤销'}));
    expect(screen.getByRole('radio',{name:'原实验模型'})).toBeChecked();
  });
  it('places a 100nF capacitor in the new profile and restores only configuration',()=>{
    render(<App/>);fireEvent.click(screen.getByRole('radio',{name:'自激发声·虚拟模型'}));
    fireEvent.change(screen.getByLabelText('元件',{exact:true}),{target:{value:'capacitor'}});
    fireEvent.change(screen.getByLabelText('锚点孔位'),{target:{value:'c13'}});
    fireEvent.click(screen.getByRole('button',{name:'放置元件'}));
    const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toMatchObject({schemaVersion:5,modelProfileId:'oscillator-em-v1',components:[{kind:'capacitor',capacitanceF:100e-9}]});
    cleanup();render(<App/>);
    expect(screen.getByRole('radio',{name:'自激发声·虚拟模型'})).toBeChecked();
    expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');
    expect(screen.getByRole('button',{name:'电容，锚点 c13'})).toBeVisible();
  });
  it.each([['pnp','PNP 晶体管'],['speaker','无源扬声器']] as const)('explains %s without editing or requesting a hint',(kind,name)=>{
    const d={...createEmptyDocument(),modelProfileId:'oscillator-em-v1' as const,components:[createComponent(kind,'c13',0,'part')]};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(d));const before=localStorage.getItem(STORAGE_KEY);render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:`${name}，锚点 c13`}));
    const guide=screen.getByRole('region',{name:`${name}使用说明`});
    expect(within(guide).getByRole('heading',{name:'引脚怎么认'})).toBeVisible();
    expect(within(guide).getByRole('heading',{name:'怎么接入电路'})).toBeVisible();
    fireEvent.click(within(guide).getByText('常见错误与模型说明'));
    expect(guide).toHaveTextContent('虚拟');
    expect(guide.querySelectorAll('dt')).toHaveLength(kind==='pnp'?3:2);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
  });
});
