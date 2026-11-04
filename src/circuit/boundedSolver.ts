import type { Branch, Solution } from './solver';

export type Transistor = { id:string; base:string; collector:string; emitter:string };
export type Region = 'cutoff'|'controlled'|'saturated';
export type BoundedSolution = Solution & { regions:Map<string,Region>; determined:Set<string>; unknowns:number; candidates:number };
export type SolveResult = {ok:true; solution:BoundedSolution}|{ok:false; reason:string};
const GMIN=1e-12;
const close=(a:number,b:number,absolute:number)=>Math.abs(a-b)<=Math.max(absolute,Math.abs(a)*1e-6,Math.abs(b)*1e-6);
function reachable(seeds:Iterable<string>,links:readonly (readonly string[])[]):Set<string>{
  const known=new Set(seeds);let changed=true;
  while(changed){changed=false;for(const [a,b] of links){if(known.has(a!)&&!known.has(b!)){known.add(b!);changed=true;}if(known.has(b!)&&!known.has(a!)){known.add(a!);changed=true;}}}
  return known;
}

/** Dense elimination is bounded before allocation. No browser or rendering state. */
export function gaussian(matrix:number[][],rhs:number[]):number[]|null {
  const a=matrix.map((r,i)=>[...r,rhs[i]!]),n=rhs.length;
  for(let k=0;k<n;k++){
    let pivot=k;
    for(let i=k+1;i<n;i++)if(Math.abs(a[i]![k]!)>Math.abs(a[pivot]![k]!))pivot=i;
    if(Math.abs(a[pivot]![k]!)<1e-16)return null;
    [a[k],a[pivot]]=[a[pivot]!,a[k]!];
    const d=a[k]![k]!;for(let j=k;j<=n;j++)a[k]![j]=a[k]![j]!/d;
    for(let i=0;i<n;i++)if(i!==k){const f=a[i]![k]!;if(f!==0)for(let j=k;j<=n;j++)a[i]![j]=a[i]![j]!-f*a[k]![j]!;}
  }
  const result=a.map(r=>r[n]!);return result.every(Number.isFinite)?result:null;
}

export function matrixBudget(size:number):boolean{return Number.isInteger(size)&&size>=0&&size<=128;}

/** Enumerate unilateral branches and the two coupled BJT equations per region. */
export function solveBounded(branches:readonly Branch[],positive:string,negative:string,supply:number,transistors:readonly Transistor[]=[],imposed:ReadonlyMap<string,number>=new Map()):SolveResult {
  const polar=branches.filter(b=>b.polar),candidateCount=2**polar.length*3**transistors.length;
  if(polar.length>6||transistors.length>2||candidateCount>576)return {ok:false,reason:'展开支路 P≤6、NPN T≤2、候选≤576 的分析预算超限'};
  const fixed=new Map([[positive,supply],[negative,0],...imposed]);
  const nodes=[...new Set([...branches.flatMap(b=>[b.from,b.to]),...transistors.flatMap(t=>[t.base,t.collector,t.emitter])])].filter(n=>!fixed.has(n)).sort();
  if(!matrixBudget(nodes.length+polar.length+transistors.length*2))return {ok:false,reason:'矩阵未知数超过128'};
  const index=new Map(nodes.map((n,i)=>[n,i]));
  let accepted:BoundedSolution|null=null;
  let ambiguous=false;
  for(let candidate=0;candidate<candidateCount;candidate++){
    const mask=candidate%(2**polar.length),regionCode=Math.floor(candidate/(2**polar.length));
    const active=polar.filter((_,i)=>Math.floor(mask/2**i)%2===1);
    const rows=new Map(active.map((b,i)=>[b.id,nodes.length+i]));
    const offset=nodes.length+active.length,size=offset+2*transistors.length;
    const matrix=Array.from({length:size},()=>Array<number>(size).fill(0)),rhs=Array<number>(size).fill(0);
    const add=(r:number,node:string,v:number)=>{const c=index.get(node);if(c!==undefined)matrix[r]![c]=matrix[r]![c]!+v;else rhs[r]=rhs[r]!-v*(fixed.get(node)??0);};
    const conduct=(from:string,to:string,g:number)=>{const a=index.get(from),b=index.get(to);if(a!==undefined){add(a,from,g);add(a,to,-g);}if(b!==undefined){add(b,to,g);add(b,from,-g);}};
    for(const b of branches){const row=rows.get(b.id);if(row===undefined){if(!b.polar)conduct(b.from,b.to,1/b.resistance);continue;}
      const a=index.get(b.from),z=index.get(b.to);if(a!==undefined)matrix[a]![row]=matrix[a]![row]!+1;if(z!==undefined)matrix[z]![row]=matrix[z]![row]!-1;
      add(row,b.from,1);add(row,b.to,-1);matrix[row]![row]=-b.resistance;rhs[row]=rhs[row]!+b.drop;
    }
    const regions=new Map<string,Region>();
    transistors.forEach((t,i)=>{
      const region=(['cutoff','controlled','saturated'] as const)[Math.floor(regionCode/3**i)%3]!,ib=offset+2*i,ic=ib+1;
      regions.set(t.id,region);
      for(const [node,col,v] of [[t.base,ib,1],[t.collector,ic,1],[t.emitter,ib,-1],[t.emitter,ic,-1]] as const){const row=index.get(node);if(row!==undefined)matrix[row]![col]=matrix[row]![col]!+v;}
      if(region==='cutoff'){matrix[ib]![ib]=1;matrix[ic]![ic]=1;}
      else {add(ib,t.base,1);add(ib,t.emitter,-1);rhs[ib]=.7;
        if(region==='controlled'){matrix[ic]![ic]=1;matrix[ic]![ib]=-100;}
        else {add(ic,t.collector,1);add(ic,t.emitter,-1);rhs[ic]=.2;}
      }
    });
    let x=gaussian(matrix,rhs);
    if(!x){
      const links=branches.filter(b=>!b.polar||rows.has(b.id)).map(b=>[b.from,b.to]);
      for(const t of transistors){if(regions.get(t.id)!=='cutoff')links.push([t.base,t.emitter]);if(regions.get(t.id)==='saturated')links.push([t.collector,t.emitter]);}
      const anchored=reachable(fixed.keys(),links);
      for(let i=0;i<nodes.length;i++)if(!anchored.has(nodes[i]!))matrix[i]![i]=matrix[i]![i]!+GMIN;
      x=gaussian(matrix,rhs);
    }
    if(!x)continue;
    const voltages=new Map(fixed);nodes.forEach((n,i)=>voltages.set(n,x[i]!));
    const currents=new Map<string,number>();let valid=true;
    for(const b of branches){const v=voltages.get(b.from)!-voltages.get(b.to)!,row=rows.get(b.id);
      if(b.polar){if(row===undefined){if(v>b.drop+1e-7){valid=false;break;}currents.set(b.id,0);}else {if(x[row]! < -1e-8){valid=false;break;}currents.set(b.id,Math.max(0,x[row]!));}}
      else currents.set(b.id,v/b.resistance);
    }
    transistors.forEach((t,i)=>{const ib=x[offset+2*i]!,ic=x[offset+2*i+1]!,vbe=voltages.get(t.base)!-voltages.get(t.emitter)!,vce=voltages.get(t.collector)!-voltages.get(t.emitter)!,region=regions.get(t.id)!;
      if(ic< -1e-8||vce< -1e-7||ib< -1e-8)valid=false;
      if(region==='cutoff'&&(vbe>.7+1e-7||vbe<-.3-1e-7))valid=false;
      if(region==='controlled'&&vce<.2-1e-7)valid=false;
      if(region==='saturated'&&ic>100*ib+1e-8)valid=false;
      currents.set(`${t.id}:Ib`,Math.max(0,ib));currents.set(`${t.id}:Ic`,Math.max(0,ic));
    });
    if(!valid)continue;
    // GMIN is numerical stabilization, not a reference for transistor terminals.
    const links=branches.filter(b=>!b.polar||(currents.get(b.id)??0)>1e-9).map(b=>[b.from,b.to]);
    for(const t of transistors){if(regions.get(t.id)!=='cutoff')links.push([t.base,t.emitter]);if(regions.get(t.id)==='saturated')links.push([t.collector,t.emitter]);}
    const determined=reachable(fixed.keys(),links);
    if(transistors.some(t=>![t.base,t.collector,t.emitter].every(n=>determined.has(n)))){ambiguous=true;continue;}
    if(accepted){
      if([...currents].some(([id,i])=>!close(i,accepted!.currents.get(id)??0,1e-9))||transistors.some(t=>[t.base,t.collector,t.emitter].some(n=>!close(voltages.get(n)!,accepted!.voltages.get(n)!,1e-6))))return {ok:false,reason:'电流或NPN端电压非唯一'};
      // At coincident boundaries prefer cutoff, then saturation.
      for(const t of transistors){const r=regions.get(t.id)!;if(r==='cutoff'||r==='saturated'&&accepted.regions.get(t.id)==='controlled')accepted.regions.set(t.id,r);}
    }else accepted={voltages,currents,regions,determined,unknowns:size,candidates:candidateCount};
  }
  if(ambiguous)return {ok:false,reason:'NPN端电压缺少确定参考，存在非唯一解'};
  return accepted?{ok:true,solution:accepted}:{ok:false,reason:'无一致的唯一工作点，或矩阵奇异／工作区不支持'};
}
