// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createComponent, createEmptyDocument } from '../circuit';
import { STORAGE_KEY } from '../storage';
import { rcExperiment } from '../../tests/fixtures/stage2';

beforeEach(()=>localStorage.clear());afterEach(cleanup);
describe('CAP-100NF original model editor',()=>{
  it('places and restores a default 100nF capacitor without switching model',()=>{
    render(<App/>);expect(screen.getByRole('button',{name:'添加电容'})).toHaveTextContent('100 nF');
    fireEvent.change(screen.getByLabelText('元件',{exact:true}),{target:{value:'capacitor'}});
    fireEvent.change(screen.getByLabelText('锚点孔位'),{target:{value:'c13'}});fireEvent.click(screen.getByRole('button',{name:'放置元件'}));
    expect(screen.getByLabelText('电容显示单位')).toHaveValue('nF');expect(screen.getByLabelText('电容容量',{exact:true})).toHaveValue('100');
    const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)!);expect(stored.modelProfileId).toBe('legacy-stage2-v1');expect(stored.components[0].capacitanceF).toBe(100e-9);
    cleanup();render(<App/>);fireEvent.click(screen.getByRole('button',{name:'电容，锚点 c13'}));expect(screen.getByLabelText('电容容量',{exact:true})).toHaveValue('100');
  });
  it('converts 0.1µF once, preserves old values, and rejects the gap without stopping a valid run',()=>{
    const d=rcExperiment();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);
    const cap=d.components.find(p=>p.id==='cap')!;fireEvent.click(screen.getByRole('button',{name:`电容，锚点 ${cap.anchor}`}));
    expect(screen.getByLabelText('电容容量',{exact:true})).toHaveValue('100');expect(screen.getByLabelText('电容显示单位')).toHaveValue('μF');
    fireEvent.click(screen.getByRole('button',{name:'运行电路'}));const saved=localStorage.getItem(STORAGE_KEY);
    fireEvent.change(screen.getByLabelText('电容容量',{exact:true}),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'应用电容容量'}));
    expect(screen.getByRole('alert')).toHaveTextContent('100 nF');expect(screen.getByLabelText('电容容量',{exact:true})).toHaveAttribute('aria-invalid','true');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);expect(screen.getByLabelText('仿真状态')).toHaveTextContent('运行中');
    fireEvent.change(screen.getByLabelText('电容容量',{exact:true}),{target:{value:'0.1'}});fireEvent.click(screen.getByRole('button',{name:'应用电容容量'}));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components.find((p:{id:string})=>p.id==='cap').capacitanceF).toBe(100e-9);
    fireEvent.click(screen.getByRole('button',{name:'撤销'}));expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    fireEvent.click(screen.getByRole('button',{name:`电容，锚点 ${cap.anchor}`}));
    fireEvent.change(screen.getByLabelText('电容容量预设'),{target:{value:'1e-7'}});expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components.find((p:{id:string})=>p.id==='cap').capacitanceF).toBe(100e-9);
  });
  it('switching units is read-only for a saved 100nF value',()=>{
    const d={...createEmptyDocument(),components:[{...createComponent('capacitor','c13',0,'c'),capacitanceF:100e-9}]};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);fireEvent.click(screen.getByRole('button',{name:'电容，锚点 c13'}));const raw=localStorage.getItem(STORAGE_KEY);
    fireEvent.change(screen.getByLabelText('电容显示单位'),{target:{value:'μF'}});expect(screen.getByLabelText('电容容量',{exact:true})).toHaveValue('0.1');expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    fireEvent.change(screen.getByLabelText('电容显示单位'),{target:{value:'nF'}});expect(screen.getByLabelText('电容容量',{exact:true})).toHaveValue('100');expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
  });
});
