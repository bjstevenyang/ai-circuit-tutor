// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createComponent } from '../circuit';
import type { Rotation } from '../circuit';
import { PartShape } from './PartShape';
import { relativeLedBrightness } from './ledAppearance';
import { parseParameter } from './NumberEditor';

afterEach(cleanup);
describe('current-driven LED display',()=>{
  it.each([[0,0],[1,.05],[5,.25],[10,.5],[20,1],[25,1]])('maps %s mA to a bounded relative level %s',(currentMa,level)=>{
    expect(relativeLedBrightness({currentMa,on:currentMa>0})).toBe(level);
  });
  it('distinguishes an unknown result from a solved off state',()=>{
    expect(relativeLedBrightness()).toBeNull();
    expect(relativeLedBrightness({currentMa:Number.NaN,on:true})).toBeNull();
    expect(relativeLedBrightness({currentMa:-1,on:true})).toBeNull();
    expect(relativeLedBrightness({currentMa:0,on:false})).toBe(0);
  });
  it('increases the visible glow continuously and saturates above the course limit',()=>{
    const part=createComponent('led','c13',0,'led');
    const {container,rerender}=render(<svg><PartShape part={part} brightness={.05}/></svg>);
    const low=Number(container.querySelector('.led-glow')!.getAttribute('opacity'));
    rerender(<svg><PartShape part={part} brightness={.5}/></svg>);
    expect(Number(container.querySelector('.led-glow')!.getAttribute('opacity'))).toBeGreaterThan(low);
    rerender(<svg><PartShape part={part} brightness={1}/></svg>);
    expect(container.querySelector('.led-glow')).toHaveAttribute('opacity','0.4');
  });
  it.each([
    [0,'c13','c13','c14'],[90,'b13','b13','c13'],[180,'c14','c14','c13'],[270,'c13','c13','b13'],
  ] as [Rotation,string,string,string][])('keeps polarity aligned and text upright at %s degrees',(rotation,anchor,a,k)=>{
    const {container}=render(<svg><PartShape part={createComponent('led',anchor,rotation,'led')} /></svg>);
    expect(container.querySelector('desc')).toHaveTextContent(`阳极 A＋ 在 ${a}`);
    expect(container.querySelector('desc')).toHaveTextContent(`阴极 K− 在 ${k}`);
    expect([...container.querySelectorAll('.led-polarity text')].map(node=>node.textContent)).toEqual(['A＋','K−']);
    expect(container.querySelector('.led-polarity')).not.toHaveAttribute('transform');
  });
  it('shows polarity in previews without duplicate description IDs',()=>{
    const {container}=render(<svg><PartShape part={createComponent('led','c13',0,'led')} ghost /></svg>);
    expect(container.querySelectorAll('.led-polarity')).toHaveLength(2);expect(container.querySelectorAll('desc')).toHaveLength(0);
  });
});
describe('numeric draft parsing',()=>{
  it.each(['','  ','abc','Infinity','NaN','0xFF','1e309','0','-1','1000001'])('rejects invalid resistance input %j',text=>{
    expect(parseParameter(text,10,1000000)).toBeNull();
  });
  it.each([['470',470],[' 470.5 ',470.5],['1e3',1000],['1000000',1000000]])('accepts a complete valid decimal %s',(text,value)=>{
    expect(parseParameter(String(text),10,1000000)).toBe(value);
  });
});

describe('potentiometer pin identification',()=>{
  it.each([
    [0,['c13','c14','c15']],
    [90,['c13','d13','e13']],
    [180,['c13','c12','c11']],
    [270,['c13','b13','a13']],
  ] as [Rotation,string[]][])('labels each actual pin upright at %s degrees',(rotation,holes)=>{
    const {container}=render(<svg><PartShape part={createComponent('potentiometer','c13',rotation,'pot')}/></svg>);
    const labels=[...container.querySelectorAll('.pot-pin-label')];
    expect(labels.map(label=>label.textContent)).toEqual(['A','W','B']);
    expect(labels.map(label=>label.getAttribute('data-hole'))).toEqual(holes);
    for(const label of labels)expect(label).not.toHaveAttribute('transform');
    expect(container.querySelector('desc')).toHaveTextContent(`A 电阻端在 ${holes[0]}，W 滑臂在 ${holes[1]}，B 电阻端在 ${holes[2]}`);
  });
  it('keeps individual pin labels in previews without duplicate description IDs',()=>{
    const {container}=render(<svg><PartShape part={createComponent('potentiometer','c13',0,'pot')} ghost/></svg>);
    expect(container.querySelectorAll('.pot-pin-label')).toHaveLength(3);
    expect(container.querySelector('desc')).toBeNull();
  });
});
