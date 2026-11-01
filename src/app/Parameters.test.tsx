// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { STORAGE_KEY } from '../storage';
import type { CircuitDocument } from '../circuit';
import { dimmingCircuit, parallelLedCircuit, validCircuit } from '../../tests/fixtures/circuits';

beforeEach(()=>localStorage.clear());afterEach(cleanup);
function open(document:CircuitDocument=validCircuit()){localStorage.setItem(STORAGE_KEY,JSON.stringify(document));render(<App/>);}
const run=()=>fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
const totalCurrent=()=>document.querySelector('.current-reading strong');
const level=(name:string)=>Number(screen.getByRole('button',{name}).querySelector('[data-led-level]')!.getAttribute('data-led-level'));

describe('validated electrical parameter controls',()=>{
  it('commits a complete resistor draft once, recalculates brightness and supports undo/redo',()=>{
    open();run();
    fireEvent.click(screen.getByRole('button',{name:'电阻 330 欧姆，锚点 a10'}));
    const saved=localStorage.getItem(STORAGE_KEY),original=level('红色 LED，锚点 c13');
    fireEvent.change(screen.getByLabelText('电阻阻值'),{target:{value:'470.5'}});
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'应用电阻阻值'}));
    expect(totalCurrent()).toHaveTextContent('5.31');
    expect(level('红色 LED，锚点 c13')).toBeLessThan(original);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components[0].resistance).toBe(470.5);
    fireEvent.click(screen.getByRole('button',{name:'撤销'}));
    expect(screen.getByRole('button',{name:'电阻 330 欧姆，锚点 a10'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'重做'}));
    expect(screen.getByRole('button',{name:'电阻 470.5 欧姆，锚点 a10'})).toBeInTheDocument();
  });
  it('keeps invalid resistor drafts for correction without replacing the valid circuit',()=>{
    open();run();fireEvent.click(screen.getByRole('button',{name:'电阻 330 欧姆，锚点 a10'}));
    const saved=localStorage.getItem(STORAGE_KEY);
    for(const value of ['','abc','Infinity','0','-1','1000001','1e309']){
      fireEvent.change(screen.getByLabelText('电阻阻值'),{target:{value}});
      fireEvent.click(screen.getByRole('button',{name:'应用电阻阻值'}));
      expect(screen.getByLabelText('电阻阻值')).toHaveValue(value);
      expect(screen.getByRole('alert')).toHaveTextContent('有效数值');
      expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
      expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
      expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    }
  });
  it('changes a custom battery voltage consistently, then restores it with undo',()=>{
    open();run();
    fireEvent.change(screen.getByLabelText('电池电压'),{target:{value:'5.2'}});
    expect(totalCurrent()).toHaveTextContent('7.58');
    fireEvent.click(screen.getByRole('button',{name:'应用电池电压'}));
    expect(totalCurrent()).toHaveTextContent('9.70');
    expect(screen.getByText('5.2 V DC')).toBeInTheDocument();
    expect(screen.getByLabelText('电池预设电压')).toHaveValue('5.2');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).supplyVoltage).toBe(5.2);
    fireEvent.click(screen.getByRole('button',{name:'撤销'}));
    expect(screen.getByLabelText('电池电压')).toHaveValue('4.5');expect(screen.getByText('4.5 V DC')).toBeInTheDocument();
    expect(screen.queryByRole('heading',{name:'亮起来了！'})).not.toBeInTheDocument();
  });
  it('rejects invalid voltages but allows an educational overcurrent at 9 V',()=>{
    open();run();const saved=localStorage.getItem(STORAGE_KEY);
    for(const value of ['0','1.4','9.1','Infinity']){
      fireEvent.change(screen.getByLabelText('电池电压'),{target:{value}});fireEvent.click(screen.getByRole('button',{name:'应用电池电压'}));
      expect(screen.getByRole('alert')).toHaveTextContent('有效数值');expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    }
    fireEvent.change(screen.getByLabelText('电池电压'),{target:{value:'9'}});fireEvent.click(screen.getByRole('button',{name:'应用电池电压'}));
    expect(screen.getByRole('heading',{name:'电流超过了课程限制'})).toBeInTheDocument();
    expect(level('红色 LED，锚点 c13')).toBe(1);
    expect(totalCurrent()).toHaveTextContent('21.21');
  });
  it('preserves results and history when applying an unchanged parameter',()=>{
    open();run();const saved=localStorage.getItem(STORAGE_KEY);
    fireEvent.click(screen.getByRole('button',{name:'应用电池电压'}));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
    expect(screen.getByRole('heading',{name:'亮起来了！'})).toBeInTheDocument();
  });
});

describe('visible LED polarity and individual current response',()=>{
  it('identifies actual A/K holes before running and follows rotation',()=>{
    const document=validCircuit();document.components[1]={...document.components[1]!,anchor:'c14',rotation:180};
    open(document);
    const part=screen.getByRole('button',{name:'红色 LED，锚点 c14'});
    expect(part).toHaveAccessibleDescription(/阳极 A＋ 在 c14/);
    fireEvent.click(part);
    const guide=within(screen.getByLabelText('LED 极性与接点'));
    expect(guide.getByText('A＋ 阳极 · c14')).toBeInTheDocument();expect(guide.getByText('K− 阴极 · c13')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'旋转 90°'}));
    expect(guide.getByText('K− 阴极 · b14')).toBeInTheDocument();
    expect(part.querySelector('[data-led-level]')).toHaveAttribute('data-led-level','unknown');
  });
  it('dims continuously as an existing potentiometer changes the series resistance',()=>{
    open(dimmingCircuit());run();fireEvent.click(screen.getByRole('button',{name:'电位器，锚点 c4'}));
    const normal=level('红色 LED，锚点 f10');
    fireEvent.change(screen.getByLabelText('旋钮位置'),{target:{value:'0'}});
    expect(level('红色 LED，锚点 f10')).toBeGreaterThan(normal);
    fireEvent.change(screen.getByLabelText('旋钮位置'),{target:{value:'100'}});
    expect(level('红色 LED，锚点 f10')).toBeLessThan(normal);
  });
  it('uses each LED branch current rather than total battery current for brightness',()=>{
    open(parallelLedCircuit());run();
    expect(level('红色 LED，锚点 c4')).toBeCloseTo((2500/330)/20,6);
    expect(level('红色 LED，锚点 c13')).toBeCloseTo(2.5/20,6);
    expect(level('红色 LED，锚点 c4')).not.toBe(level('红色 LED，锚点 c13'));
  });
});
