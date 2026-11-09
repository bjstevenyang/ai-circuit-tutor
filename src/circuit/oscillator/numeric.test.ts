import { describe, expect, it } from 'vitest';
import { advanceNumeric, initializeNumeric } from './integration';
import { createImplicitStepper, DEFAULT_PRECISION, EM, GROUND, solveDense, POSITIVE } from './numeric';
import type { NumericModel } from './numeric';

/** Independent fixture: four-node reduction of the frozen seven-node netlist. */
export function referenceNumeric():NumericModel {
  const n=4,g=new Float64Array(n*n),capacitance=new Float64Array(n*n);
  const pair=(m:Float64Array,a:number,b:number,value:number)=>{
    if(a>=0)m[a*n+a]=m[a*n+a]!+value;
    if(b>=0)m[b*n+b]=m[b*n+b]!+value;
    if(a>=0&&b>=0){m[a*n+b]=m[a*n+b]!-value;m[b*n+a]=m[b*n+a]!-value;}
  };
  pair(g,0,GROUND,1/47);pair(g,0,1,1/120000);pair(g,3,GROUND,1/18);
  pair(capacitance,1,3,100e-9);
  pair(capacitance,1,GROUND,EM.cbeF);pair(capacitance,1,2,EM.cbcF);
  pair(capacitance,2,0,EM.cbeF);pair(capacitance,2,3,EM.cbcF);
  return {size:n,g,capacitance,gSource:Float64Array.from([-1/47,0,0,0]),cSource:new Float64Array(n),supplyV:9,
    transistors:[{id:'Q1',b:1,c:2,e:GROUND,sign:1,beta:100},{id:'Q2',b:2,c:3,e:0,sign:-1,beta:50}]};
}
describe('OSC-02/03 frozen EM + BE step-doubling',()=>{
  it('keeps input state and emitted half-step snapshots independent of reused Newton scratch',()=>{
    const model=referenceNumeric(),snapshot=structuredClone(model),initial=initializeNumeric(model);
    const oldVoltage=initial.voltage.slice(),first=advanceNumeric(model,initial,.001,[]);
    expect(first.ok).toBe(true);if(!first.ok)return;
    expect(initial.voltage).toEqual(oldVoltage);expect(initial.timeS).toBe(0);expect(model).toEqual(snapshot);
    const points=structuredClone(first.points),firstState=structuredClone(first.state);
    const second=advanceNumeric(model,first.state,.001,[]);expect(second.ok).toBe(true);
    expect(first.points).toEqual(points);expect(first.state).toEqual(firstState);
    const step=createImplicitStepper(model),a=step(oldVoltage,.125e-6,.125e-6);
    expect(a.ok).toBe(true);if(!a.ok)return;const saved=structuredClone(a);
    const b=step(a.voltage,.125e-6,.25e-6);expect(b.ok).toBe(true);expect(a).toEqual(saved);
    const matrix=Float64Array.of(2,1,1,3),rhs=Float64Array.of(3,4),matrixCopy=matrix.slice(),rhsCopy=rhs.slice();
    expect(solveDense(matrix,rhs)).toEqual(Float64Array.of(1,1));expect(matrix).toEqual(matrixCopy);expect(rhs).toEqual(rhsCopy);
  });
  it('cold-starts and reproduces the independent five crossings using actual LTE',()=>{
    const model=referenceNumeric(),pairs= [[1,3],[1,GROUND],[1,2],[2,0],[2,3]] as const;
    let state=initializeNumeric(model),lastT=0,lastD=0,maxSource=0;
    const rises:number[]=[];
    while(state.timeS<.015){
      const result=advanceNumeric(model,state,.015,pairs,DEFAULT_PRECISION);
      if(!result.ok)throw new Error(JSON.stringify({failure:result.failure,state:{...result.state,voltage:[...result.state.voltage]}}));
      for(const point of result.points){
        const d=point.voltage[3]!;
        if(lastD<1&&d>=1)rises.push(lastT+(point.timeS-lastT)*(1-lastD)/(d-lastD));
        maxSource=Math.max(maxSource,(9*Math.min(1,point.timeS/1e-4)-point.voltage[0]!)/47);
        lastD=d;lastT=point.timeS;
      }
      state=result.state;
    }
    expect(rises).toHaveLength(5);
    expect(Math.abs(rises[0]!/.0007541498020748211-1)).toBeLessThanOrEqual(.01);
    expect(Math.abs(((rises[4]!-rises[0]!)/4)/.003466217221363-1)).toBeLessThanOrEqual(.005);
    expect(Math.abs(maxSource/.1744-1)).toBeLessThanOrEqual(.02);
    expect(state.maxResidualA).toBeLessThanOrEqual(1e-9);
    expect(state.rejected).toBeGreaterThan(0);
    expect(state.accepted).toBeLessThanOrEqual(1_000_000);
    expect(model.transistors[0]?.e).toBe(GROUND);
    expect(POSITIVE).not.toBe(GROUND);
  },20000);
});
