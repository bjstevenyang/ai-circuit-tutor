// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {ChoiceGroup} from './ChoiceGroup';
afterEach(cleanup);
function Frequency(){const [value,setValue]=useState(500);return <ChoiceGroup label="频率" value={value} choices={[250,500,1000].map(value=>({value,label:`${value} Hz`}))} onChange={setValue}/>;}
it('has one tab stop and explicit checked state',()=>{render(<Frequency/>);expect(screen.getByRole('radio',{name:'500 Hz'})).toHaveAttribute('aria-checked','true');expect(screen.getByRole('radio',{name:'500 Hz'})).toHaveAttribute('tabindex','0');expect(screen.getByRole('radio',{name:'250 Hz'})).toHaveAttribute('tabindex','-1');});
it('arrows, Home and End change selection and preserve focus in the group',()=>{render(<Frequency/>);fireEvent.keyDown(screen.getByRole('radio',{name:'500 Hz'}),{key:'ArrowRight'});expect(screen.getByRole('radio',{name:'1000 Hz'})).toHaveFocus();fireEvent.keyDown(screen.getByRole('radio',{name:'1000 Hz'}),{key:'ArrowRight'});expect(screen.getByRole('radio',{name:'250 Hz'})).toHaveAttribute('aria-checked','true');fireEvent.keyDown(screen.getByRole('radio',{name:'250 Hz'}),{key:'End'});expect(screen.getByRole('radio',{name:'1000 Hz'})).toHaveAttribute('aria-checked','true');fireEvent.keyDown(screen.getByRole('radio',{name:'1000 Hz'}),{key:'Home'});expect(screen.getByRole('radio',{name:'250 Hz'})).toHaveFocus();});
it('pointer selection cannot accidentally submit an enclosing form',()=>{const submit=vi.fn();render(<form onSubmit={submit}><Frequency/></form>);fireEvent.click(screen.getByRole('radio',{name:'1000 Hz'}));expect(screen.getByRole('radio',{name:'1000 Hz'})).toHaveAttribute('aria-checked','true');expect(submit).not.toHaveBeenCalled();});
