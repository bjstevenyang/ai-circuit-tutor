/** Bounded DC modified nodal analysis with constant-drop, unilateral branches. */
export type Branch = { id: string; part: string; from: string; to: string; resistance: number; drop: number; polar: boolean };
export type Solution = { voltages: Map<string,number>; currents: Map<string,number> };
const GMIN=1e-12;
function gaussian(matrix: number[][], rhs: number[]): number[] | null {
  const n=rhs.length;
  const a=matrix.map((row,i)=>[...row,rhs[i]!]);
  for(let k=0;k<n;k++) {
    let pivot=k;
    for(let i=k+1;i<n;i++)if(Math.abs(a[i]![k]!)>Math.abs(a[pivot]![k]!))pivot=i;
    if(Math.abs(a[pivot]![k]!)<1e-16)return null;
    [a[k],a[pivot]]=[a[pivot]!,a[k]!];
    const divisor=a[k]![k]!;
    for(let j=k;j<=n;j++)a[k]![j]=a[k]![j]!/divisor;
    for(let i=0;i<n;i++)if(i!==k) {
      const factor=a[i]![k]!;
      if(factor===0)continue;
      for(let j=k;j<=n;j++)a[i]![j]=a[i]![j]!-factor*a[k]![j]!;
    }
  }
  const result=a.map(row=>row[n]!);
  return result.every(Number.isFinite)?result:null;
}
export function solveDC(branches: readonly Branch[], positive: string, negative: string, supply: number): Solution | null {
  const nodes=[...new Set(branches.flatMap(b=>[b.from,b.to]))].filter(n=>n!==positive&&n!==negative).sort();
  const indices=new Map(nodes.map((n,i)=>[n,i]));
  const polar=branches.filter(b=>b.polar);
  const fixed=new Map([[positive,supply],[negative,0]]);
  let solution: Solution | null = null;
  for(let mask=0;mask<2**polar.length;mask++) {
    const active=polar.filter((_,i)=>(mask&(1<<i))!==0);
    const branchIndex=new Map(active.map((b,i)=>[b.id,nodes.length+i]));
    const size=nodes.length+active.length;
    const matrix=Array.from({length:size},()=>Array<number>(size).fill(0));
    const rhs=Array<number>(size).fill(0);
    const add=(row:number,node:string,value:number)=>{const col=indices.get(node);if(col!==undefined)matrix[row]![col]=matrix[row]![col]!+value;else rhs[row]=rhs[row]!-value*(fixed.get(node)??0);};
    const conduct=(from:string,to:string,g:number)=>{
      const a=indices.get(from),b=indices.get(to);
      if(a!==undefined){add(a,from,g);add(a,to,-g);}
      if(b!==undefined){add(b,to,g);add(b,from,-g);}
    };
    for(let i=0;i<nodes.length;i++)matrix[i]![i]=GMIN;
    for(const branch of branches) {
      const row=branchIndex.get(branch.id);
      if(row===undefined) {conduct(branch.from,branch.to,branch.polar?GMIN:1/branch.resistance);continue;}
      const a=indices.get(branch.from),b=indices.get(branch.to);
      if(a!==undefined)matrix[a]![row]=matrix[a]![row]!+1;
      if(b!==undefined)matrix[b]![row]=matrix[b]![row]!-1;
      rhs[row]=branch.drop;
      add(row,branch.from,1);add(row,branch.to,-1);
      matrix[row]![row]=-branch.resistance;
    }
    const result=gaussian(matrix,rhs);
    if(!result)continue;
    const voltages=new Map(fixed);
    nodes.forEach((node,i)=>voltages.set(node,result[i]!));
    const currents=new Map<string,number>();
    let valid=true;
    for(const branch of branches) {
      const voltage=(voltages.get(branch.from)??0)-(voltages.get(branch.to)??0);
      const idx=branchIndex.get(branch.id);
      if(branch.polar) {
        if(idx===undefined) { if(voltage>branch.drop+1e-7){valid=false;break;} currents.set(branch.id,0); }
        else {const current=result[idx]!;if(current < -1e-8){valid=false;break;}currents.set(branch.id,Math.max(0,current));}
      } else currents.set(branch.id,voltage/branch.resistance);
    }
    if(valid) {
      // Parallel ideal constant-drop devices may have arbitrary current sharing.
      // Different valid active sets are evidence that no unique answer exists.
      if(solution&&polar.some(b=>Math.abs((solution!.currents.get(b.id)??0)-(currents.get(b.id)??0))>1e-7))return null;
      solution??={voltages,currents};
    }
  }
  return solution;
}
