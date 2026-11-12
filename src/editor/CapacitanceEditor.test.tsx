// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createComponent } from '../circuit';
import { CapacitanceEditor } from './CapacitanceEditor';
import { PartShape } from './PartShape';
import type { Rotation } from '../circuit';

afterEach(cleanup);
describe('OSC-01/02 units and upright pin identification',()=>{
  it('keeps the known retired v1 capacitance editor in nF without silently converting the configuration',()=>{
    const apply=vi.fn();
    render(<CapacitanceEditor part={createComponent('capacitor','c13',0,'c','oscillator-em-v1')} profile="oscillator-em-v1" onApply={apply}/>);
    expect(screen.getByRole('textbox',{name:'电容容量'})).toHaveValue('100');
    expect(screen.getByRole('combobox',{name:'电容显示单位'})).toHaveValue('nF');
    expect(apply).not.toHaveBeenCalled();
  });
  it('changes nF/μF presentation without editing and converts a valid applied value once',async()=>{
    const user=userEvent.setup(),apply=vi.fn(),part=createComponent('capacitor','c13',0,'c','oscillator-em-v2');
    render(<CapacitanceEditor part={part} profile="oscillator-em-v2" onApply={apply}/>);
    expect(screen.getByRole('textbox',{name:'电容容量'})).toHaveValue('100');
    await user.selectOptions(screen.getByRole('combobox',{name:'电容显示单位'}),'μF');
    expect(screen.getByRole('textbox',{name:'电容容量'})).toHaveValue('0.1');expect(apply).not.toHaveBeenCalled();
    await user.clear(screen.getByRole('textbox',{name:'电容容量'}));await user.type(screen.getByRole('textbox',{name:'电容容量'}),'0.2');
    await user.click(screen.getByRole('button',{name:'应用电容容量'}));expect(apply).toHaveBeenCalledExactlyOnceWith(200e-9);
  });
  it('accepts 1 μF as exactly 1000 nF and exposes the new preset',async()=>{
    const user=userEvent.setup(),apply=vi.fn();
    render(<CapacitanceEditor part={createComponent('capacitor','c13',0,'c','oscillator-em-v2')} profile="oscillator-em-v2" onApply={apply}/>);
    await user.selectOptions(screen.getByRole('combobox',{name:'电容显示单位'}),'μF');
    const input=screen.getByRole('textbox',{name:'电容容量'});
    await user.clear(input);await user.type(input,'1');
    await user.click(screen.getByRole('button',{name:'应用电容容量'}));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(apply).toHaveBeenCalledExactlyOnceWith(1e-6);
    expect(screen.getByRole('option',{name:'1 μF'})).toBeInTheDocument();
  });
  it.each(['','1e','100 nF','0.1 μF','46','1001','Infinity','NaN'])('rejects invalid or duplicate-unit draft %j without applying',async draft=>{
    const user=userEvent.setup(),apply=vi.fn();
    render(<CapacitanceEditor part={createComponent('capacitor','c13',0,'c','oscillator-em-v2')} profile="oscillator-em-v2" onApply={apply}/>);
    const input=screen.getByRole('textbox',{name:'电容容量'});await user.clear(input);if(draft)await user.type(input,draft);
    await user.click(screen.getByRole('button',{name:'应用电容容量'}));expect(screen.getByRole('alert')).toBeVisible();expect(apply).not.toHaveBeenCalled();
  });
  it.each([0,90,180,270] as Rotation[])('keeps PNP and speaker pin identity upright at %s°',rotation=>{
    for(const kind of ['pnp','speaker'] as const){
      const {container,unmount}=render(<svg><PartShape part={createComponent(kind,'c13',rotation,kind)}/></svg>);
      const labels=[...container.querySelectorAll('text[data-hole]')];
      expect(labels.map(n=>n.textContent)).toEqual(kind==='pnp'?['B','C','E']:['1','2']);
      for(const label of labels)expect(label).not.toHaveAttribute('transform');unmount();
    }
  });
});
