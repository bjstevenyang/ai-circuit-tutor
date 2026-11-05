import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import type {CircuitDocument} from '../../src/circuit';
import {STORAGE_KEY} from '../../src/storage';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export async function openFixture(page:Page,d:CircuitDocument){await page.goto('/');await page.evaluate(({key,d})=>localStorage.setItem(key,JSON.stringify(d)),{key:STORAGE_KEY,d});await page.reload();await page.bringToFront();}
export const run=(page:Page)=>page.getByRole('button',{name:'运行电路',exact:true}).click();
export const stop=(page:Page)=>page.getByRole('button',{name:'停止运行',exact:true}).click();
export async function audioCounters(page:Page,timing=false){await page.addInitScript((timing)=>{
  const data={contexts:0,closed:0,created:0,started:0,stopped:0,disconnected:0,frequency:0,type:'',readyAudioTime:0,lastTargetHz:0,timers:[] as number[]};
  Object.assign(window,{audioEvidence:data});
  const Original=window.AudioContext;
  window.AudioContext=class extends Original{constructor(options?:AudioContextOptions){super(options);data.contexts++;if(timing)Object.defineProperty(data,'audioTime',{configurable:true,get:()=>this.currentTime});}override close(){data.closed++;return super.close();}override createOscillator(){const node=super.createOscillator();data.created++;if(timing){const setTarget=node.frequency.setTargetAtTime.bind(node.frequency);node.frequency.setTargetAtTime=(value,start,constant)=>{data.lastTargetHz=value;data.readyAudioTime=start-Math.log(.05)*constant;return setTarget(value,start,constant);};}const start=node.start.bind(node),stop=node.stop.bind(node),disconnect=node.disconnect.bind(node);node.start=(when?:number)=>{data.started++;data.frequency=node.frequency.value;data.type=node.type;start(when);};node.stop=(when?:number)=>{data.stopped++;stop(when);};node.disconnect=()=>{data.disconnected++;disconnect();};return node;}};
  const originalSet=window.setTimeout.bind(window),originalClear=window.clearTimeout.bind(window);
  window.setTimeout=((handler:TimerHandler,timeout?:number,...args:unknown[])=>{if(typeof handler!=='function')return originalSet(handler,timeout,...args);let id=0;id=originalSet(()=>{data.timers=data.timers.filter(n=>n!==id);handler(...args);},timeout);if(timeout===50)data.timers.push(id);return id;}) as typeof window.setTimeout;
  window.clearTimeout=((id?:number)=>{data.timers=data.timers.filter(n=>n!==id);originalClear(id);}) as typeof window.clearTimeout;
},timing);}
export async function writeEvidence(name:string,value:unknown){await writeFile(`/tmp/ai-circuit-stage2-${name}.json`,JSON.stringify(value,null,2));}
export function fixtureHash(d:CircuitDocument){return createHash('sha256').update(JSON.stringify(d)).digest('hex');}
export async function waitStopped(page:Page){await expect(page.getByLabel('仿真状态')).toContainText('已停止');}
