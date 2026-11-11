import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { oscillatorFixture } from '../../src/circuit/oscillator/fixtures';
import { openFixture } from '../performance/helpers';
import { STORAGE_KEY } from '../../src/storage';

for(const fixture of ['reference','npn-switching','pnp-switching'])test(`complete SPICE matches independent native ${fixture}`,async({page},testInfo)=>{
  const netlist=readFileSync(`tests/spice/${fixture}.cir`,'utf8');
  const native=JSON.parse(readFileSync(`tests/spice/${fixture}-summary.json`,'utf8')) as {sha256:string;columns:string[];samples:number[][];toleranceV:number};
  expect(createHash('sha256').update(netlist).digest('hex')).toBe(native.sha256);
  await page.goto('/');
  const result=await page.evaluate(async(netlist)=>{
    const path='/node_modules/eecircuit-engine/dist/eecircuit-engine.mjs';
    const {Simulation}=await import(path);
    const sim=new Simulation();await sim.start();sim.setNetList(netlist);
    const result=await sim.runSim();
    return {info:sim.getInitInfo(),errors:sim.getError(),result};
  },netlist);
  await testInfo.attach('engine-version.txt',{body:result.info,contentType:'text/plain'});
  expect(result.result.dataType).toBe('real');
  expect(result.result.numPoints).toBeGreaterThan(1000);
  const vectors=result.result.data as {name:string;values:number[]}[];
  const time=vectors.find(v=>v.name==='time')!.values;
  for(const sample of native.samples){
    let i=time.findIndex(t=>t>=sample[0]!);if(i===0)i=1;if(i<0)i=time.length-1;
    for(let c=1;c<native.columns.length;c++){
      const vector=vectors.find(v=>v.name.toLowerCase()===native.columns[c]!.toLowerCase())!.values;
      const fraction=Math.max(0,Math.min(1,(sample[0]!-time[i-1]!)/(time[i]!-time[i-1]!)));
      const actual=vector[i-1]!+fraction*(vector[i]!-vector[i-1]!);
      expect(Math.abs(actual-sample[c]!),`${fixture} ${native.columns[c]} at ${sample[0]}`).toBeLessThan(native.columns[c]!.startsWith('i(')?1e-5:native.toleranceV);
    }
  }
});

test('SPICE mode computes the original named pair, saves its version and restores stopped',async({page})=>{
  const doc=oscillatorFixture();
  for(const p of doc.components){if(p.kind==='npn')p.transistorModel='2n3904';if(p.kind==='pnp')p.transistorModel='2n3906';}
  await openFixture(page,doc);
  await page.getByRole('checkbox',{name:/标准SPICE晶体管动态模型/}).check();
  await page.getByRole('button',{name:'运行电路',exact:true}).click();
  await expect(page.locator('.result-card h3')).toHaveText('观察窗内已近直流',{timeout:15000});
  await expect(page.getByLabel('实验读数')).toContainText('1.037');
  await expect(page.getByLabel('实验读数')).not.toContainText('稳定频率');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).transistorDynamics,STORAGE_KEY)).toBe('spice-gp-v1');
  await page.getByRole('button',{name:'停止运行',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('checkbox',{name:/标准SPICE晶体管动态模型/})).toBeChecked();
  await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await page.getByRole('button',{name:'运行电路',exact:true}).click();
  await page.getByRole('button',{name:'停止运行',exact:true}).click();
  await expect(page.getByLabel('仿真状态')).toContainText('已停止');
  await expect(page.getByLabel('实验读数')).toHaveCount(0);
});
