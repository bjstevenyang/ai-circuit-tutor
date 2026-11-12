// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createComponent, createEmptyDocument } from '../circuit';
import { STORAGE_KEY } from '../storage';
import { oscillatorFixture } from '../circuit/oscillator/fixtures';

beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('OSC-01/02/06 configuration slice (not numerical conformance)',()=>{
  it('SPICE model selection explains and prevents unsupported generic combinations without replacing cards',()=>{
    const Worker=vi.fn();vi.stubGlobal('Worker',Worker);
    const doc=oscillatorFixture();
    const raw=JSON.stringify(doc);localStorage.setItem(STORAGE_KEY,raw);render(<App/>);
    const spice=screen.getByRole('checkbox',{name:/标准SPICE晶体管动态模型/});
    expect(spice).toBeDisabled();
    expect(screen.getByText(/先点击板上的晶体管/)).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    for(const [kind,model] of [['NPN','2n3904'],['PNP','2n3906']]){
      fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${kind} 晶体管，锚点`)}));
      fireEvent.change(screen.getByLabelText('晶体管参数模型'),{target:{value:model}});
      if(kind==='NPN')expect(spice).toBeDisabled();
    }
    expect(spice).toBeEnabled();fireEvent.click(spice);
    expect(spice).toBeChecked();
    fireEvent.change(screen.getByLabelText('晶体管参数模型'),{target:{value:'generic'}});
    expect(spice).toBeChecked();expect(spice).toBeEnabled();
    expect(screen.getByRole('button',{name:'运行电路'})).toBeDisabled();
    expect(Worker).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components.find((p:{id:string})=>p.id==='Q2').transistorModel).toBe('generic');
    fireEvent.click(spice);
    expect(spice).not.toBeChecked();
    expect(screen.getByRole('button',{name:'运行电路'})).toBeEnabled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).transistorDynamics).toBeUndefined();
  });
  it('restores known v1 without a Worker, supports explicit keyboard conversion and undo, and preserves every configuration value',()=>{
    const Worker=vi.fn();vi.stubGlobal('Worker',Worker);
    const d={...createEmptyDocument(),modelProfileId:'oscillator-em-v1' as const,supplyVoltage:6,
      components:[createComponent('capacitor','c13',0,'cap','oscillator-em-v1'),createComponent('pnp','c20',180,'q2')],
      wires:[{id:'wire-id',from:'battery:+',to:'b13',color:'#123456',bend:'vertical' as const}]};
    const raw=JSON.stringify(d);localStorage.setItem(STORAGE_KEY,raw);render(<App/>);
    expect(screen.getByText(/当前为旧版虚拟模型v1/)).toBeVisible();
    expect(screen.queryByRole('radio',{name:/旧版/})).not.toBeInTheDocument();
    expect(screen.getByRole('radio',{name:'原实验模型'})).toHaveAttribute('tabindex','0');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
    expect(Worker).not.toHaveBeenCalled();
    expect(screen.getByRole('heading',{name:/旧版虚拟模型/})).toBeVisible();
    fireEvent.keyDown(screen.getByRole('radio',{name:'原实验模型'}),{key:'ArrowRight'});
    expect(screen.getByRole('radio',{name:'自激发声·虚拟模型v2'})).toBeChecked();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({...d,modelProfileId:'oscillator-em-v2'});
    expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');
    fireEvent.click(screen.getByRole('button',{name:'撤销'}));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(d);
    fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
    expect(Worker).not.toHaveBeenCalled();
  });
  it('explicitly switches profiles, preserves capacitance and voltage, stops and undoes',()=>{
    const d={...createEmptyDocument(),supplyVoltage:6,components:[{...createComponent('capacitor','c13',0,'cap'),capacitanceF:100e-6}]};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
    fireEvent.click(screen.getByRole('radio',{name:'自激发声·虚拟模型v2'}));
    expect(screen.getByRole('radio',{name:'自激发声·虚拟模型v2'})).toBeChecked();
    expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');
    const changed=JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(changed.modelProfileId).toBe('oscillator-em-v2');expect(changed.supplyVoltage).toBe(6);
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
    render(<App/>);fireEvent.click(screen.getByRole('radio',{name:'自激发声·虚拟模型v2'}));
    fireEvent.change(screen.getByLabelText('元件',{exact:true}),{target:{value:'capacitor'}});
    fireEvent.change(screen.getByLabelText('锚点孔位'),{target:{value:'c13'}});
    fireEvent.click(screen.getByRole('button',{name:'放置元件'}));
    const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toMatchObject({schemaVersion:5,modelProfileId:'oscillator-em-v2',components:[{kind:'capacitor',capacitanceF:100e-9}]});
    cleanup();render(<App/>);
    expect(screen.getByRole('radio',{name:'自激发声·虚拟模型v2'})).toBeChecked();
    expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');
    expect(screen.getByRole('button',{name:'电容，锚点 c13'})).toBeVisible();
  });
  it.each([['pnp','PNP 晶体管'],['speaker','无源扬声器']] as const)('explains %s without editing or requesting a hint',(kind,name)=>{
    const d={...createEmptyDocument(),modelProfileId:'oscillator-em-v2' as const,components:[createComponent(kind,'c13',0,'part')]};
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
