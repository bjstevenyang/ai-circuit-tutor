import {analyzeCircuit,createComponent} from '../../src/circuit';
import {rgbExperiment,npnExperiment,rcExperiment,piezoExperiment,maxExperiment} from '../fixtures/stage2';
import {compileNetwork} from '../../src/circuit/stage2';
import {solveBounded} from '../../src/circuit/boundedSolver';
const fixtures={ 'B-RGB':rgbExperiment(),'B-NPN':npnExperiment(),'B-RC':rcExperiment(),'B-PIEZO':piezoExperiment(),'B-MAX':maxExperiment() };
const max=fixtures['B-MAX'];
const inputs={...fixtures,'B-OVER':{...max,components:[...max.components,createComponent('resistor','a1',0,'over')]}};
const bench={fixtures:inputs,core:()=>Object.entries(inputs).map(([name,document])=>{
  const times:number[]=[];let status='';
  for(let i=0;i<110;i++){const t0=performance.now(),result=analyzeCircuit(document,name==='B-RC'?{deltaTimeS:.05}:{}),t1=performance.now();status=result.status;if(i>=10)times.push(t1-t0);if(name==='B-OVER'?status!=='unsupported':status!=='supported')throw new Error(`${name}: unexpected ${status}`);}
  const c=compileNetwork(document),compiled=name==='B-OVER'?null:solveBounded(c.branches,c.positive,c.negative,document.supplyVoltage??4.5,c.transistors);
  return {name,times,p95:[...times].sort((a,b)=>a-b)[94]!,status,unknowns:compiled?.ok?compiled.solution.unknowns:null,candidates:compiled?.ok?compiled.solution.candidates:null};
})};
declare global {interface Window {stage2Bench:typeof bench}}
window.stage2Bench=bench;
