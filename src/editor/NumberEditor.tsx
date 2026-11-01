import { useId, useState } from 'react';

/** Accept a complete decimal (optionally scientific notation), never empty/hex/Infinity. */
export function parseParameter(text: string, min: number, max: number): number | null {
  const value=text.trim();
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))return null;
  const number=Number(value);
  return Number.isFinite(number)&&number>=min&&number<=max?number:null;
}

export function NumberEditor({label,value,unit,min,max,onApply}:{label:string;value:number;unit:string;min:number;max:number;onApply:(value:number)=>void}) {
  const [draft,setDraft]=useState(String(value)),[error,setError]=useState('');
  const id=useId();
  return <form className="number-editor" aria-label={`${label}设置`} noValidate onSubmit={event=>{
    event.preventDefault();
    const number=parseParameter(draft,min,max);
    if(number===null){setError(`请输入 ${min.toLocaleString()}–${max.toLocaleString()} ${unit} 范围内的有效数值。`);return;}
    setError('');setDraft(String(number));if(number!==value)onApply(number);
  }}>
    <label htmlFor={id}>{label}</label>
    <div className="number-editor-fields"><input id={id} type="text" inputMode="decimal" value={draft} aria-invalid={!!error} aria-describedby={`${id}-range${error?` ${id}-error`:''}`} onChange={event=>{setDraft(event.target.value);setError('');}}/><span>{unit}</span><button className="small-button">应用{label}</button></div>
    <small id={`${id}-range`}>{min.toLocaleString()}–{max.toLocaleString()} {unit}</small>
    {error&&<p id={`${id}-error`} role="alert">{error}</p>}
  </form>;
}
