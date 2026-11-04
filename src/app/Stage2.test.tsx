// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {App} from './App';
import {PartShape} from '../editor/PartShape';
import {createComponent,getComponentPins} from '../circuit';
import {STORAGE_KEY} from '../storage';
import {rcExperiment,rgbExperiment} from '../../tests/fixtures/stage2';
beforeEach(()=>{localStorage.clear();});
afterEach(()=>{cleanup();vi.useRealTimers();});
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
