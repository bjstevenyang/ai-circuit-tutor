import {analyzeCircuit} from '../../src/circuit';
import {rgbExperiment,npnExperiment,rcExperiment,piezoExperiment,maxExperiment,overExperiment} from '../fixtures/stage2';
import {compileNetwork} from '../../src/circuit/stage2';
import {solveBounded} from '../../src/circuit/boundedSolver';
const fixtures={ 'B-RGB':rgbExperiment(),'B-NPN':npnExperiment(),'B-RC':rcExperiment(),'B-PIEZO':piezoExperiment(),'B-MAX':maxExperiment() };
const inputs={...fixtures,'B-OVER':overExperiment()};
const bench={fixtures:inputs,core:()=>Object.entries(inputs).map(([name,document])=>{
  const times:number[]=[];let status='';
  for(let i=0;i<110;i++){const t0=performance.now(),result=analyzeCircuit(document,name==='B-RC'?{deltaTimeS:.05}:{}),t1=performance.now();status=result.status;if(i>=10)times.push(t1-t0);if(name==='B-OVER'?status!=='unsupported':status!=='supported')throw new Error(`${name}: unexpected ${status}`);}
  const c=compileNetwork(document),compiled=name==='B-OVER'?null:solveBounded(c.branches,c.positive,c.negative,document.supplyVoltage??4.5,c.transistors);
  let maxKclResidualA:number|null=null;
  if(compiled?.ok){const residual=new Map<string,number>(),inject=(n:string,i:number)=>residual.set(n,(residual.get(n)??0)+i);for(const b of c.branches){const i=compiled.solution.currents.get(b.id)!;inject(b.from,i);inject(b.to,-i);}for(const t of c.transistors){const ib=compiled.solution.currents.get(`${t.id}:Ib`)!,ic=compiled.solution.currents.get(`${t.id}:Ic`)!;inject(t.base,ib);inject(t.collector,ic);inject(t.emitter,-ib-ic);}maxKclResidualA=Math.max(0,...[...residual].filter(([n])=>n!==c.positive&&n!==c.negative).map(([,i])=>Math.abs(i)));}
  return {name,times,p95:[...times].sort((a,b)=>a-b)[94]!,status,polar:c.branches.filter(b=>b.polar).length,transistors:c.transistors.length,unknowns:compiled?.ok?compiled.solution.unknowns:null,candidates:compiled?.ok?compiled.solution.candidates:null,maxKclResidualA};
})};
declare global {interface Window {stage2Bench:typeof bench}}
window.stage2Bench=bench;
