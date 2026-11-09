import { DEFAULT_PRECISION, domainViolation, estimateError, implicitStep, RAMP_S, sourceAt } from './numeric';
import type { emCurrents, ErrorVoltagePair, NumericModel, Precision } from './numeric';

export const NUMERIC_LIMITS = { maxNewton:80,maxAccepted:1_000_000,maxRejected:10_000,batchAttempts:256 } as const;
export type NumericLimits = { maxNewton:number;maxAccepted:number;maxRejected:number;batchAttempts:number };
export type IntegrationState = {
  timeS:number;voltage:Float64Array;stepS:number;accepted:number;rejected:number;
  maxNewton:number;minStepS:number;maxResidualA:number;
};
export type AcceptedPoint = {timeS:number;voltage:Float64Array;derivative:Float64Array;residualA:number;junctions?:readonly ReturnType<typeof emCurrents>[]};
export type IntegrationFailure = {outcome:'numerical-failure'|'resource-limit'|'unsupported-model-domain';reason:string;timeS:number};
export function initializeNumeric(model:NumericModel,precision:Precision=DEFAULT_PRECISION):IntegrationState {
  return {timeS:0,voltage:new Float64Array(model.size),stepS:precision.hMaxS,accepted:0,rejected:0,maxNewton:0,minStepS:precision.hMaxS,maxResidualA:0};
}
export type AdvanceResult = {ok:true;state:IntegrationState;points:AcceptedPoint[]}|{ok:false;state:IntegrationState;failure:IntegrationFailure};

/** Pure bounded batch. Points are consumed inside the worker and discarded after each batch. */
export function advanceNumeric(model:NumericModel,input:IntegrationState,targetS:number,pairs:readonly ErrorVoltagePair[],precision:Precision=DEFAULT_PRECISION,reducedLimits:Partial<NumericLimits>={}):AdvanceResult {
  const limits:NumericLimits={...NUMERIC_LIMITS};
  for(const key of Object.keys(limits) as (keyof NumericLimits)[]) {
    const requested=reducedLimits[key];
    if(requested!==undefined)limits[key]=Math.max(key==='batchAttempts'?1:0,Math.min(limits[key],Math.floor(requested)));
  }
  const state={...input},points:AcceptedPoint[]=[];
  const fail=(outcome:IntegrationFailure['outcome'],reason:string):AdvanceResult=>({ok:false,state,failure:{outcome,reason,timeS:state.timeS}});
  if(!Number.isFinite(targetS)||targetS<state.timeS||targetS>.04)return fail('numerical-failure','无效模拟时间');
  for(let attempt=0;attempt<limits.batchAttempts&&state.timeS<targetS;attempt++) {
    if(state.accepted>=limits.maxAccepted||state.rejected>=limits.maxRejected)return fail('resource-limit','积分推进或拒步次数超限');
    const boundary=state.timeS<RAMP_S?Math.min(RAMP_S,targetS):targetS;
    if(boundary-state.timeS<1e-15){state.timeS=boundary;continue;}
    const remaining=boundary-state.timeS;
    let h=Math.min(state.stepS,precision.hMaxS,remaining);
    // Align source/window boundaries without accepting a sub-hmin remainder.
    if(remaining>h&&remaining-h<precision.hMinS)h=remaining/2;
    if(h<precision.hMinS)return fail('numerical-failure','边界剩余区间小于最小批准步长');
    const endS=state.timeS+h;
    const full=implicitStep(model,state.voltage,h,endS,limits.maxNewton);
    const first=implicitStep(model,state.voltage,h/2,state.timeS+h/2,limits.maxNewton);
    const second=first.ok?implicitStep(model,first.voltage,h/2,endS,limits.maxNewton):first;
    const error=full.ok&&first.ok&&second.ok?estimateError(full.voltage,second.voltage,sourceAt(model,endS),pairs,precision,model.errorProjections):Infinity;
    if(!Number.isFinite(error)||error>1) {
      state.rejected++;
      const factor=Number.isFinite(error)?Math.max(.2,Math.min(.8,.9/Math.sqrt(error))):.5;
      state.stepS=h*factor;
      if(h<=precision.hMinS&&state.stepS<precision.hMinS)return fail('numerical-failure',!full.ok?full.reason:!first.ok?first.reason:!second.ok?second.reason:'LTE在最小步长仍不接受');
      state.stepS=Math.max(precision.hMinS,state.stepS);
      continue;
    }
    if(!first.ok||!second.ok||!full.ok)return fail('numerical-failure','隐式积分未收敛');
    const violation=domainViolation(model,first.voltage,state.timeS+h/2,first.junctions)??domainViolation(model,second.voltage,endS,second.junctions);
    if(violation)return fail('unsupported-model-domain',`超出虚拟模型域：${violation}`);
    const firstDerivative=first.voltage.map((v,i)=>(v-state.voltage[i]!)/(h/2));
    const secondDerivative=second.voltage.map((v,i)=>(v-first.voltage[i]!)/(h/2));
    if(!firstDerivative.every(Number.isFinite)||!secondDerivative.every(Number.isFinite))return fail('numerical-failure','电荷变化不是有限数值');
    points.push({timeS:state.timeS+h/2,voltage:first.voltage,derivative:firstDerivative,residualA:first.residualA,junctions:first.junctions},
      {timeS:endS,voltage:second.voltage,derivative:secondDerivative,residualA:second.residualA,junctions:second.junctions});
    state.voltage=second.voltage;state.timeS=endS;state.accepted++;
    state.minStepS=Math.min(state.minStepS,h);
    state.maxNewton=Math.max(state.maxNewton,full.iterations,first.iterations,second.iterations);
    state.maxResidualA=Math.max(state.maxResidualA,first.residualA,second.residualA);
    state.stepS=Math.max(precision.hMinS,Math.min(precision.hMaxS,h*Math.max(.5,Math.min(2,.9/Math.sqrt(Math.max(error,1e-16))))));
  }
  return {ok:true,state,points};
}
