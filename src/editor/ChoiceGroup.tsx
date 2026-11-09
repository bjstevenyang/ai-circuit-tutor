import {useRef} from 'react';

/** Small visible radio choices with a complete keyboard path, no native popup. */
export function ChoiceGroup<T extends string|number>({label,value,choices,onChange}:{label:string;value:T;choices:readonly {value:T;label:string}[];onChange:(value:T)=>void}){
  const group=useRef<HTMLDivElement>(null);
  const currentAvailable=choices.some(choice=>choice.value===value);
  return <fieldset className="choice-group"><legend>{label}</legend><div ref={group} role="radiogroup" aria-label={label}>
    {choices.map((choice,index)=><button type="button" key={choice.value} role="radio" aria-checked={value===choice.value} tabIndex={value===choice.value||!currentAvailable&&index===0?0:-1} onClick={()=>onChange(choice.value)} onKeyDown={event=>{
      let next:number;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%choices.length;
      else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+choices.length-1)%choices.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=choices.length-1;
      else return;
      event.preventDefault();onChange(choices[next]!.value);group.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
    }}>{choice.label}</button>)}
  </div></fieldset>;
}
