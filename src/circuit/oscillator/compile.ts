import { getComponentPins } from '../board';
import { resistanceOf } from '../catalog';
import { transistorParameters } from '../transistorModels';
import { buildNets } from '../network';
import { profileOf, supplyVoltageOf } from '../parameters';
import type { CircuitDocument, SimulationControls } from '../types';
import { readCircuitDocument } from '../validation';
import { GROUND, POSITIVE, solveDense } from './numeric';
import type { Junction } from './numeric';
import type { CompileOscillatorResult, PassiveBranch, Reconstruction } from './types';

/** Compile only explicit electrical identities. No geometric or target-circuit recognition. */
export function compileOscillator(input:CircuitDocument,controls:SimulationControls={}):CompileOscillatorResult {
  const failure=(reason:string,entities:string[]=[],outcome:'unsupported-topology'|'unsupported-model-version'='unsupported-topology'):CompileOscillatorResult=>({ok:false,result:{outcome,timeS:0,reason,entities}});
  const document=readCircuitDocument(input);
  if(!document)return failure('作品格式或参数无效');
  const raw=buildNets(document,controls), members=new Map<string,string[]>();
  for(const [endpoint,root] of raw){const values=members.get(root)??[];values.push(endpoint);members.set(root,values);}
  const canonical=new Map([...members].map(([root,values])=>[root,values.sort()[0]!]));
  const endpointNodes=Object.fromEntries([...raw].map(([endpoint,root])=>[endpoint,canonical.get(root)!]));
  const net=(endpoint:string)=>endpointNodes[endpoint]!;
  const positive=net('battery:+'),ground=net('battery:-');
  // Ideal-source short is diagnosed before profile/topology restrictions.
  if(positive===ground)return failure('理想电源正负端被直接短接',['battery:+','battery:-']);
  if(profileOf(document)==='oscillator-em-v1')return failure('旧版虚拟模型需显式切换到v2；配置和接线已保留',[],'unsupported-model-version');
  if(profileOf(document)!=='oscillator-em-v2')return failure('请显式选择自激发声·虚拟模型v2');
  if(document.sourceMode!=='battery')return failure('自激发声模型仅支持直流电源',['battery:+','battery:-']);
  const allowed=new Set(['resistor','switch','button','npn','pnp','capacitor','speaker']);
  const unsupported=document.components.filter(part=>!allowed.has(part.kind));
  if(unsupported.length)return failure('此模型仅支持电阻、理想触点、各一只NPN/PNP、电容和无源扬声器',unsupported.map(p=>p.id));
  for(const kind of ['npn','pnp','capacitor','speaker']) {
    const parts=document.components.filter(p=>p.kind===kind);
    if(parts.length>1)return failure(`此模型最多一只${kind}`,parts.map(p=>p.id));
  }
  const invalidC=document.components.filter(p=>p.kind==='capacitor'&&(p.capacitanceF!<47e-9||p.capacitanceF!>220e-9));
  if(invalidC.length)return failure('当前模型的外部电容范围为47–220 nF；原值已保留',invalidC.map(p=>p.id));
  const used=new Set<string>();
  for(const part of document.components)if(part.kind!=='switch'&&part.kind!=='button')for(const pin of getComponentPins(part)!)used.add(net(pin));
  const nodeIds=[...used].filter(x=>x!==positive&&x!==ground).sort(),n=nodeIds.length;
  if(n>12)return failure(`电气未知节点为${n}，超过12个上限（电阻化简前计数）`,document.components.map(p=>p.id));
  const node=(endpoint:string)=>{const id=net(endpoint);return id===positive?POSITIVE:id===ground?GROUND:nodeIds.indexOf(id);};
  const g=new Float64Array(n*n),capacitance=new Float64Array(n*n),gSource=new Float64Array(n),cSource=new Float64Array(n);
  const stamp=(matrix:Float64Array,source:Float64Array,a:number,b:number,value:number)=>{
    if(a===b)return;
    if(a>=0){matrix[a*n+a]=matrix[a*n+a]!+value;if(b>=0)matrix[a*n+b]=matrix[a*n+b]!-value;else if(b===POSITIVE)source[a]=source[a]!-value;}
    if(b>=0){matrix[b*n+b]=matrix[b*n+b]!+value;if(a>=0)matrix[b*n+a]=matrix[b*n+a]!-value;else if(a===POSITIVE)source[b]=source[b]!-value;}
  };
  const branches:PassiveBranch[]=[],transistors:Junction[]=[],dynamic=new Set<number>();
  for(const part of [...document.components].sort((a,b)=>a.id.localeCompare(b.id))) {
    const pins=getComponentPins(part)!,a=node(pins[0]),b=node(pins[1]);
    if(part.kind==='resistor'||part.kind==='speaker') {
      const value=part.kind==='speaker'?8:resistanceOf(part);
      branches.push({id:part.id,a,b,value,kind:part.kind});stamp(g,gSource,a,b,1/value);
    } else if(part.kind==='capacitor') {
      branches.push({id:part.id,a,b,value:part.capacitanceF!,kind:'capacitor'});stamp(capacitance,cSource,a,b,part.capacitanceF!);dynamic.add(a);dynamic.add(b);
    } else if(part.kind==='npn'||part.kind==='pnp') {
      const c=node(pins[1]),e=node(pins[2]!);
      const parameters=transistorParameters(part.kind,part.transistorModel);
      transistors.push({id:part.id,b:a,c,e,sign:part.kind==='npn'?1:-1,...parameters});
      stamp(capacitance,cSource,a,e,parameters.cbeF);stamp(capacitance,cSource,a,c,parameters.cbcF);
      dynamic.add(a);dynamic.add(c);dynamic.add(e);
    }
  }
  // A pure resistor node has no independent charge. Exact Schur elimination
  // improves conditioning/speed while the original pre-elimination count remains authoritative.
  const keep=nodeIds.map((_,i)=>i).filter(i=>dynamic.has(i)),removed=nodeIds.map((_,i)=>i).filter(i=>!dynamic.has(i));
  const m=keep.length,r=removed.length,gee=new Float64Array(r*r);
  for(let i=0;i<r;i++)for(let j=0;j<r;j++)gee[i*r+j]=g[removed[i]!*n+removed[j]!]!;
  const reconstruction:Reconstruction[]=nodeIds.map(node=>({node,weights:new Float64Array(m),sourceWeight:0}));
  for(let j=0;j<m;j++)reconstruction[keep[j]!]!.weights[j]=1;
  for(let j=0;j<=m&&r;j++) {
    const rhs=Float64Array.from(removed.map(i=>j===m?-gSource[i]!:-g[i*n+keep[j]!]!));
    const solution=solveDense(gee,rhs);
    if(!solution)return failure('存在无法唯一确定电压的浮置电阻网络',nodeIds.filter((_,i)=>removed.includes(i)));
    for(let i=0;i<r;i++)if(j===m)reconstruction[removed[i]!]!.sourceWeight=solution[i]!;else reconstruction[removed[i]!]!.weights[j]=solution[i]!;
  }
  const reducedG=new Float64Array(m*m),reducedC=new Float64Array(m*m),reducedGs=new Float64Array(m),reducedCs=new Float64Array(m);
  for(let i=0;i<m;i++) {
    const original=keep[i]!;reducedGs[i]=gSource[original]!;reducedCs[i]=cSource[original]!;
    for(let j=0;j<m;j++){reducedG[i*m+j]=g[original*n+keep[j]!]!;reducedC[i*m+j]=capacitance[original*n+keep[j]!]!;}
    for(const removedIndex of removed) {
      const factor=g[original*n+removedIndex]!,map=reconstruction[removedIndex]!;
      reducedGs[i]=reducedGs[i]!+factor*map.sourceWeight;
      for(let j=0;j<m;j++)reducedG[i*m+j]=reducedG[i*m+j]!+factor*map.weights[j]!;
    }
  }
  const remap=(index:number)=>index<0?index:keep.indexOf(index);
  const model={size:m,g:reducedG,capacitance:reducedC,gSource:reducedGs,cSource:reducedCs,supplyV:supplyVoltageOf(document),
    errorProjections:reconstruction,
    transistors:transistors.map(t=>({...t,b:remap(t.b),c:remap(t.c),e:remap(t.e)}))};
  const pairs=branches.filter(b=>b.kind==='capacitor').map(b=>[remap(b.a),remap(b.b)] as const);
  for(const t of model.transistors)pairs.push([t.b,t.e],[t.b,t.c]);
  // At cold state, C/h+G must determine every represented node without GMIN.
  const initial=reducedG.map((value,i)=>value+reducedC[i]!/.25e-6);
  if(m&&!solveDense(initial,new Float64Array(m)))return failure('网络浮置或初态方程不唯一',nodeIds);
  return {ok:true,compiled:{model,pairs,branches,nodeIds,endpointNodes,reconstruction,unknowns:n,...(branches.find(b=>b.kind==='speaker')?{speaker:branches.find(b=>b.kind==='speaker')!}:{}),document}};
}
