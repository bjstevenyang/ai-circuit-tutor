/** The fixed virtual EM card. None of these values is a real-device safety rating. */
export const EM = { saturationA: 1e-14, thermalV: 0.02585, betaN: 100, betaP: 50, cbeF: 2e-9, cbcF: 1e-9 } as const;
export type Junction = { id: string; b: number; c: number; e: number; sign: 1 | -1; beta: number; saturationA?:number; cbeF?:number; cbcF?:number };
export type NumericModel = {
  size: number;
  g: Float64Array;
  capacitance: Float64Array;
  gSource: Float64Array;
  cSource: Float64Array;
  transistors: readonly Junction[];
  supplyV: number;
  errorProjections?: readonly {weights:Float64Array;sourceWeight:number}[];
};
export const RAMP_S = 100e-6;
export const sourceAt = (model: NumericModel, timeS: number) => model.supplyV * Math.min(1, timeS / RAMP_S);
// Negative indices are known voltages, never additional circuit connections.
export const POSITIVE = -1, GROUND = -2;
export const nodeVoltage = (v: Float64Array, index: number, source: number) => index === POSITIVE ? source : index === GROUND ? 0 : v[index]!;

/** Linear extension is a Newton trial safeguard; accepted biases are checked below 0.9V. */
function exponential(bias: number, saturationA: number): readonly [number, number] {
  const z = bias / EM.thermalV;
  if (z > 40) {
    const e = Math.exp(40);
    return [saturationA * (e * (1 + z - 40) - 1), saturationA * e / EM.thermalV];
  }
  const e=Math.exp(z);
  return [saturationA * (Math.abs(z)<1e-5?Math.expm1(z):e-1), saturationA * e / EM.thermalV];
}
export function emCurrents(t: Junction, v: Float64Array, source: number) {
  const vb = nodeVoltage(v,t.b,source), vc = nodeVoltage(v,t.c,source), ve = nodeVoltage(v,t.e,source);
  const vbe = t.sign * (vb-ve), vbc = t.sign * (vb-vc);
  const saturationA=t.saturationA??EM.saturationA;
  const [forward,df] = exponential(vbe,saturationA), [reverse,dr] = exponential(vbc,saturationA);
  const ib = t.sign * (forward/t.beta + reverse), ic = t.sign * (forward-2*reverse);
  return { ib, ic, ie:-ib-ic, df, dr, vbe, vbc };
}
export function domainViolation(model: NumericModel, v: Float64Array, timeS: number, cached?:readonly ReturnType<typeof emCurrents>[]): string | null {
  if (!v.every(Number.isFinite)) return '节点电压不是有限数值';
  const source = sourceAt(model,timeS);
  for (let i=0;i<model.transistors.length;i++) {
    const t=model.transistors[i]!,q = cached?.[i]??emCurrents(t,v,source);
    if (q.vbe < -3 || q.vbe > .9 || q.vbc < -15 || q.vbc > .9 ||
      Math.max(Math.abs(q.ib),Math.abs(q.ic),Math.abs(q.ie)) > .25) return t.id;
  }
  return null;
}

/** Pivoted dense elimination, at most 12 unknowns, without reference conductance. */
function solveDenseMutable(a:Float64Array,b:Float64Array,output?:Float64Array):Float64Array|null {
  const n=b.length;
  for (let k=0;k<n;k++) {
    let p=k;
    for (let i=k+1;i<n;i++) if (Math.abs(a[i*n+k]!) > Math.abs(a[p*n+k]!)) p=i;
    if (!Number.isFinite(a[p*n+k]) || Math.abs(a[p*n+k]!) < 1e-20) return null;
    if (p!==k) {
      for (let j=k;j<n;j++) { const x=a[k*n+j]!; a[k*n+j]=a[p*n+j]!; a[p*n+j]=x; }
      const x=b[k]!; b[k]=b[p]!; b[p]=x;
    }
    for (let i=k+1;i<n;i++) {
      const factor=a[i*n+k]!/a[k*n+k]!;
      for (let j=k+1;j<n;j++) a[i*n+j]=a[i*n+j]!-factor*a[k*n+j]!;
      b[i]=b[i]!-factor*b[k]!;
    }
  }
  const x=output??new Float64Array(n);
  for (let i=n-1;i>=0;i--) {
    let sum=b[i]!;
    for (let j=i+1;j<n;j++) sum-=a[i*n+j]!*x[j]!;
    x[i]=sum/a[i*n+i]!;
  }
  return x.every(Number.isFinite) ? x : null;
}

/** Public linear solve owns its working copies and never modifies caller inputs. */
export function solveDense(matrix:Float64Array,rhs:Float64Array):Float64Array|null {
  return solveDenseMutable(matrix.slice(),rhs.slice());
}

function residual(model: NumericModel, v: Float64Array, previous: Float64Array, h: number, timeS: number, f:Float64Array, jacobian:Float64Array) {
  const {size:n,g,capacitance:c} = model, source=sourceAt(model,timeS);
  const deltaSource=source-sourceAt(model,timeS-h);
  for (let i=0;i<n;i++) {
    f[i]=model.gSource[i]!*source+model.cSource[i]!*deltaSource/h;
    for (let j=0;j<n;j++) {
      const k=i*n+j;
      f[i]=f[i]!+g[k]!*v[j]!+c[k]!*(v[j]!-previous[j]!)/h;
      jacobian[k]=g[k]!+c[k]!/h;
    }
  }
  const junctions:ReturnType<typeof emCurrents>[]=[];
  const add=(row:number,col:number,value:number)=>{if(row>=0&&col>=0)jacobian[row*n+col]=jacobian[row*n+col]!+value;};
  for (const t of model.transistors) {
    const q=emCurrents(t,v,source), {b,c,e,beta}=t;junctions.push(q);
    if(b>=0)f[b]=f[b]!+q.ib;
    if(c>=0)f[c]=f[c]!+q.ic;
    if(e>=0)f[e]=f[e]!+q.ie;
    const db=q.df/beta, dr=q.dr, df=q.df;
    add(b,b,db+dr);add(b,c,-dr);add(b,e,-db);
    add(c,b,df-2*dr);add(c,c,2*dr);add(c,e,-df);
    add(e,b,-df-db+dr);add(e,c,-dr);add(e,e,df+db);
  }
  let norm=0;
  for (const value of f) norm=Math.max(norm,Math.abs(value));
  return { f,jacobian,norm,junctions };
}
export type ImplicitStep = { ok:true; voltage:Float64Array; residualA:number; iterations:number; junctions:ReturnType<typeof emCurrents>[] } | { ok:false; reason:string };
/** Scratch is private to one bounded advance batch; no input state or emitted point owns these buffers. */
type ImplicitWorkspace={v:Float64Array;candidate:Float64Array;f:Float64Array;j:Float64Array;spareF:Float64Array;spareJ:Float64Array;delta:Float64Array};
function createImplicitWorkspace(n:number):ImplicitWorkspace{return {v:new Float64Array(n),candidate:new Float64Array(n),f:new Float64Array(n),j:new Float64Array(n*n),spareF:new Float64Array(n),spareJ:new Float64Array(n*n),delta:new Float64Array(n)};}
function solveImplicitStep(model:NumericModel,previous:Float64Array,h:number,timeS:number,maxNewton:number,workspace:ImplicitWorkspace):ImplicitStep {
  let v=workspace.v,candidate=workspace.candidate;v.set(previous);
  let current=residual(model,v,previous,h,timeS,workspace.f,workspace.j);
  let spareF:Float64Array=workspace.spareF,spareJ:Float64Array=workspace.spareJ;
  for (let iteration=0;iteration<maxNewton;iteration++) {
    // Output must own its voltage: the next implicit solve reuses every scratch buffer.
    if (current.norm <= 1e-10) return {ok:true,voltage:v.slice(),residualA:current.norm,iterations:iteration,junctions:current.junctions};
    for(let i=0;i<current.f.length;i++)current.f[i]=-current.f[i]!;
    const delta=solveDenseMutable(current.jacobian,current.f,workspace.delta);
    if (!delta) return {ok:false,reason:'奇异矩阵'};
    let largest=0;
    for (const x of delta) largest=Math.max(largest,Math.abs(x));
    let scale=Math.min(1,.2/Math.max(1e-30,largest)), accepted=false;
    for (let backtrack=0;backtrack<30;backtrack++) {
      for(let i=0;i<v.length;i++)candidate[i]=v[i]!+scale*delta[i]!;
      const trial=residual(model,candidate,previous,h,timeS,spareF,spareJ);
      if (trial.norm < current.norm) {
        const oldV=v;v=candidate;candidate=oldV;
        spareF=current.f;spareJ=current.jacobian;current=trial;accepted=true;break;
      }
      scale*=.5;
    }
    if (!accepted) return {ok:false,reason:'Newton 阻尼未收敛'};
  }
  return {ok:false,reason:'Newton 迭代超限'};
}

/** A deterministic batch-local stepper. Scratch cannot escape; every result owns its data. */
export function createImplicitStepper(model:NumericModel,maxNewton=80):(previous:Float64Array,h:number,timeS:number)=>ImplicitStep {
  const workspace=createImplicitWorkspace(model.size);
  return (previous,h,timeS)=>solveImplicitStep(model,previous,h,timeS,maxNewton,workspace);
}
/** Single-call pure interface; repeated integration uses an encapsulated local stepper. */
export function implicitStep(model:NumericModel,previous:Float64Array,h:number,timeS:number,maxNewton=80):ImplicitStep {
  return createImplicitStepper(model,maxNewton)(previous,h,timeS);
}

export const DEFAULT_PRECISION = { rtol:1e-4,atolV:1e-5,hMaxS:.25e-6,hMinS:1e-11 } as const;
export const STRICT_PRECISION = { rtol:5e-5,atolV:5e-6,hMaxS:.125e-6,hMinS:1e-11 } as const;
export type Precision = { rtol:number;atolV:number;hMaxS:number;hMinS:number };
export type ErrorVoltagePair = readonly [number,number];
/** Full step versus two half steps, including terminal differences, independent of KCL. */
export function estimateError(full:Float64Array,half:Float64Array,source:number,pairs:readonly ErrorVoltagePair[],precision:Precision,projections:readonly {weights:Float64Array;sourceWeight:number}[] = []) {
  let error=0;
  const check=(a:number,b:number)=>{error=Math.max(error,Math.abs(a-b)/(precision.atolV+precision.rtol*Math.max(Math.abs(a),Math.abs(b))));};
  for(let i=0;i<full.length;i++)check(full[i]!,half[i]!);
  for(const {weights,sourceWeight} of projections) {
    let a=sourceWeight*source,b=sourceWeight*source;for(let i=0;i<weights.length;i++){a+=weights[i]!*full[i]!;b+=weights[i]!*half[i]!;}check(a,b);
  }
  for(const [a,b] of pairs)check(nodeVoltage(full,a,source)-nodeVoltage(full,b,source),nodeVoltage(half,a,source)-nodeVoltage(half,b,source));
  return error;
}
