import { describe, expect, it } from 'vitest';
import { clampCurveControl, defaultCurveControl, newWireShape } from './wireGeometry';
import { wirePath } from './wirePath';

describe('WIRING pure display geometry',()=>{
  it('uses one quadratic curve with an explicit point while preserving old folded paths',()=>{
    const a={x:100,y:100},b={x:200,y:100};
    expect(defaultCurveControl(a,b)).toEqual({x:150,y:148});
    expect(defaultCurveControl(b,a)).toEqual({x:150,y:52});
    expect(defaultCurveControl(a,{x:100,y:200})).toEqual({x:52,y:150});
    expect(wirePath(a,b,{bend:'curve',curveControl:{x:150,y:148}})).toBe('M100 100Q150 148 200 100');
    expect(wirePath(a,b,{bend:'horizontal'})).toBe('M100 100H200V100');
    expect(wirePath(a,b,{bend:'vertical'})).toBe('M100 100V100H200');
    expect(wirePath(a,b,{bend:'curve',curveControl:{x:150,y:100}})).toBe('M100 100Q150 100 200 100');
  });
  it('clamps editable points inside the fixed canvas and supplies defaults only on creation',()=>{
    expect(clampCurveControl({x:-100,y:900})).toEqual({x:16,y:634});
    expect(clampCurveControl({x:1000,y:-1})).toEqual({x:864,y:16});
    expect(defaultCurveControl({x:16,y:600},{x:16,y:620})).toEqual({x:16,y:610});
    expect(newWireShape('a1','a3','curve')).toEqual({bend:'curve',curveControl:{x:160,y:218}});
    expect(newWireShape('a1','a3','horizontal')).toEqual({bend:'horizontal'});
    expect(wirePath({x:100,y:100},{x:200,y:100},{bend:'curve'})).toBe('');
  });
});
