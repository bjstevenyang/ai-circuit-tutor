// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {App} from './App';
import {PartShape} from '../editor/PartShape';
import * as breadboardModule from '../editor/Breadboard';
import {createComponent,getComponentPins} from '../circuit';
import {STORAGE_KEY} from '../storage';
import {applyEdit} from '../editor/model';
import {rcExperiment,rgbExperiment,piezoExperiment,circuitFixture} from '../../tests/fixtures/stage2';
beforeEach(()=>{localStorage.clear();});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
const run=()=>fireEvent.click(screen.getByRole('button',{name:'运行电路'}));
async function advance(ms:number){for(let elapsed=0;elapsed<ms;elapsed+=50)await act(async()=>{await vi.advanceTimersByTimeAsync(Math.min(50,ms-elapsed));});}
it('EX2-06/10 ordinary RC ticks do not write history or storage; stop invalidates callbacks and restarts zero',async()=>{
  vi.useFakeTimers();const d=rcExperiment();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));const saved=localStorage.getItem(STORAGE_KEY);render(<App/>);run();await advance(1000);
  expect(screen.getByTestId('simulation-time')).toHaveTextContent('1.000');expect(screen.getByLabelText('实验读数')).toHaveTextContent('2.844543');expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'停止运行'}));await advance(500);expect(screen.queryByTestId('simulation-time')).not.toBeInTheDocument();run();expect(screen.getByTestId('simulation-time')).toHaveTextContent('0.000');
});
it('EX2-06 background pause holds accepted time and resumes without catch-up',async()=>{
  vi.useFakeTimers();localStorage.setItem(STORAGE_KEY,JSON.stringify(rcExperiment()));render(<App/>);run();await advance(100);fireEvent(window,new Event('blur'));const before=screen.getByTestId('simulation-time').textContent;await advance(10000);expect(screen.getByTestId('simulation-time').textContent).toBe(before);expect(screen.getByLabelText('仿真状态')).toHaveTextContent('后台已暂停');fireEvent(window,new Event('focus'));await advance(50);expect(screen.getByTestId('simulation-time')).toHaveTextContent('0.150');
});
it('EX2-06 valid resistance updates preserve Vc but capacitance application stops, min/max validate and undo',async()=>{
  vi.useFakeTimers();const d=rcExperiment();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);run();await advance(1000);
  const charge=d.components.find(p=>p.id==='charge')!;fireEvent.click(screen.getByRole('button',{name:`电阻 10000 欧姆，锚点 ${charge.anchor}`}));const before=screen.getByLabelText('实验读数').textContent!.match(/Vc ([^ ]+) V/)![0];fireEvent.change(screen.getByLabelText('所选电阻阻值'),{target:{value:'100000'}});expect(screen.getByLabelText('实验读数').textContent).toContain(before);
  const cap=d.components.find(p=>p.id==='cap')!;fireEvent.click(screen.getByRole('button',{name:`电容，锚点 ${cap.anchor}`}));fireEvent.change(screen.getByLabelText('电容容量',{exact:true}),{target:{value:'10'}});fireEvent.click(screen.getByRole('button',{name:'应用电容容量'}));expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components.find((p:{id:string})=>p.id==='cap').capacitanceF).toBe(10e-6);fireEvent.click(screen.getByRole('button',{name:'撤销'}));expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).components.find((p:{id:string})=>p.id==='cap').capacitanceF).toBe(100e-6);
});
it('EX2-11 reading a new guide does not change diagnostics, requested hints or persisted work',()=>{
  const d=rgbExperiment();d.components.find(p=>p.id==='rR')!.resistance=100;localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);run();fireEvent.click(screen.getByRole('button',{name:'揭开第一个线索'}));const saved=localStorage.getItem(STORAGE_KEY);fireEvent.click(screen.getByRole('button',{name:'添加NPN 晶体管'}));expect(screen.getByRole('heading',{name:'R 通道：电流超过了课程限制'})).toBeInTheDocument();expect(document.querySelectorAll('.hint-list li')).toHaveLength(1);expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);expect(screen.getByRole('button',{name:'撤销'})).toBeDisabled();
});
it.each(['rgb-led','npn','capacitor','piezo-passive'] as const)('EX2-09 labels follow actual pins and remain unrotated: %s',kind=>{
  for(const rotation of [0,90,180,270] as const){const part=createComponent(kind,rotation===90?'a15':rotation===270?'e15':'c15',rotation,'p');const view=render(<svg><PartShape part={part}/></svg>);const pins=getComponentPins(part)!;for(const pin of pins){const label=view.container.querySelector(`text[data-hole="${pin}"]`);expect(label).toBeTruthy();expect(label?.getAttribute('transform')).toBeNull();}view.unmount();}
});
it('EX2-11 new components explain each actual pin via keyboard-accessible tray',()=>{render(<App/>);for(const name of ['RGB LED','NPN 晶体管','电容','无源压电']){fireEvent.click(screen.getByRole('button',{name:`添加${name}`}));expect(within(screen.getByRole('region',{name:`${name}使用说明`})).getByText('怎么接入电路')).toBeInTheDocument();}});
it('review regression: releasing a shorting button never restarts a faulted RC session',async()=>{
  vi.useFakeTimers();const d=circuitFixture([{id:'c',kind:'capacitor',nets:['X','N']},{id:'r',kind:'resistor',nets:['P','X'],settings:{resistance:10000}},{id:'button',kind:'button',nets:['P','P','N','N']}]);localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);run();await advance(100);
  const p=d.components.find(p=>p.id==='button')!;fireEvent.click(screen.getByRole('button',{name:`常开按钮，锚点 ${p.anchor}`}));const control=screen.getByRole('button',{name:'按住按钮'});fireEvent.keyDown(control,{key:'Enter'});expect(screen.getByLabelText('仿真状态')).toHaveTextContent('运行受限');fireEvent.keyUp(control,{key:'Enter'});fireEvent(window,new Event('blur'));await advance(500);expect(screen.getByLabelText('仿真状态')).toHaveTextContent('运行受限');expect(screen.queryByTestId('simulation-time')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'停止运行'}));run();expect(screen.getByTestId('simulation-time')).toHaveTextContent('0.000');
});
it('review regression: selected RC resistors do not automatically announce changing currents',()=>{
  const d=rcExperiment();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);run();const r=d.components.find(p=>p.id==='charge')!;fireEvent.click(screen.getByRole('button',{name:`电阻 10000 欧姆，锚点 ${r.anchor}`}));expect(document.querySelector('.part-reading')).toHaveAttribute('aria-live','off');expect(screen.getByRole('button',{name:'播报当前实验状态'})).toBeInTheDocument();
});
it.each(['Delete','Backspace'])('parameter radio focus protects the selected component from %s',key=>{
  const d=piezoExperiment();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);const part=d.components.find(p=>p.kind==='piezo-passive')!;
  fireEvent.click(screen.getByRole('button',{name:`无源压电，锚点 ${part.anchor}`}));const before=localStorage.getItem(STORAGE_KEY);
  for(const name of ['教学方波','500 Hz']){const control=screen.getByRole('radio',{name});control.focus();fireEvent.keyDown(control,{key});expect(localStorage.getItem(STORAGE_KEY)).toBe(before);expect(screen.getByRole('button',{name:`无源压电，锚点 ${part.anchor}`})).toBeInTheDocument();}
});
it('EX2-06 automatically stops at sixty simulated seconds and restarts from zero',async()=>{
  // This checks the app's session/timer lifecycle, not 1,200 redraws of 420 SVG sockets.
  // Real breadboard rendering is covered by the separate pin-mapping and Chromium tests.
  vi.spyOn(breadboardModule,'Breadboard').mockImplementation(()=><svg/>);
  vi.useFakeTimers();localStorage.setItem(STORAGE_KEY,JSON.stringify(rcExperiment()));render(<App/>);run();await advance(59950);expect(screen.getByTestId('simulation-time')).toHaveTextContent('59.950');await advance(50);expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');expect(screen.queryByTestId('simulation-time')).not.toBeInTheDocument();await advance(1000);expect(screen.getByLabelText('仿真状态')).toHaveTextContent('已停止');run();expect(screen.getByTestId('simulation-time')).toHaveTextContent('0.000');
},20000);
it('EX2-05/06 resistance and source voltage edits preserve Vc then follow the new analytic trajectory',async()=>{
  vi.useFakeTimers();const d=rcExperiment();localStorage.setItem(STORAGE_KEY,JSON.stringify(d));render(<App/>);run();await advance(1000);const r=d.components.find(p=>p.id==='charge')!;fireEvent.click(screen.getByRole('button',{name:`电阻 10000 欧姆，锚点 ${r.anchor}`}));fireEvent.change(screen.getByLabelText('所选电阻阻值'),{target:{value:'100000'}});await advance(1000);
  const voltage=()=>Number(screen.getByLabelText('实验读数').textContent!.match(/Vc ([^ ]+) V/)![1]);const v1=4.5*(1-Math.exp(-1)),v2=4.5+(v1-4.5)*Math.exp(-.1);expect(voltage()).toBeCloseTo(v2,5);fireEvent.change(screen.getByLabelText('电池预设电压'),{target:{value:'6'}});expect(voltage()).toBeCloseTo(v2,5);await advance(1000);expect(voltage()).toBeCloseTo(6+(v2-6)*Math.exp(-.1),5);
});
it.each([
  ['rgb-led',['R','K','G','B'],[['c15','c16','c17','c18'],['a15','b15','c15','d15'],['c15','c14','c13','c12'],['e15','d15','c15','b15']]],
  ['npn',['B','C','E'],[['c15','c16','c17'],['a15','b15','c15'],['c15','c14','c13'],['e15','d15','c15']]],
  ['capacitor',['1','2'],[['c15','c17'],['a15','c15'],['c15','c13'],['e15','c15']]],
  ['piezo-passive',['1','2'],[['c15','c17'],['a15','c15'],['c15','c13'],['e15','c15']]],
] as const)('EX2-01/09 independent named pin mapping survives rotation, preview and movement: %s',(kind,names,expected)=>{
  for(const [i,rotation] of ([0,90,180,270] as const).entries()){
    const part=createComponent(kind,expected[i]![0]!,rotation,'p');expect(getComponentPins(part)).toEqual(expected[i]);
    const view=render(<svg><PartShape part={part} ghost/></svg>);expected[i]!.forEach((hole,index)=>expect(view.container.querySelector(`text[data-hole="${hole}"]`)).toHaveTextContent(names[index]!));
    const moved=applyEdit({...rcExperiment(),components:[part],wires:[]},{type:'move',id:'p',anchor:part.anchor.replace('15','20'),rotation});expect(moved.ok).toBe(true);if(moved.ok){const p=moved.document.components[0]!;expect(getComponentPins(p)).toEqual(expected[i]!.map(h=>h.replace(/\d+/,n=>String(Number(n)+5))));view.rerender(<svg><PartShape part={p}/></svg>);getComponentPins(p)!.forEach((hole,index)=>expect(view.container.querySelector(`text[data-hole="${hole}"]`)).toHaveTextContent(names[index]!));}view.unmount();
  }
});
