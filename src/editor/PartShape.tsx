import { componentBody, ENDPOINT_BY_ID, getComponentPins } from '../circuit';
import type { ComponentInstance } from '../circuit';
import { ledDescriptionId } from './ledAppearance';

export function PartShape({part,ghost=false,lit=false,activated=false,brightness=null}:{part:ComponentInstance;ghost?:boolean;lit?:boolean;activated?:boolean;brightness?:number|null}) {
  const pins=getComponentPins(part),body=componentBody(part);
  if(!pins||!body)return null;
  const points=pins.map(pin=>ENDPOINT_BY_ID.get(pin)!);
  const glow=brightness===null?0:Math.sqrt(Math.max(0,Math.min(1,brightness)));
  return <g className={ghost?'part-shape ghost':'part-shape'} data-led-level={part.kind==='led'?(brightness??'unknown'):undefined}>
    {part.kind==='led'&&!ghost&&<desc id={ledDescriptionId(part.id)}>阳极 A＋ 在 {pins[0]}，朝向电源正极并串联限流电阻；阴极 K− 在 {pins[1]}，朝向电源负极。{brightness===null?'亮度未计算。':`相对亮度 ${Math.round(brightness*100)}%，为教学示意。`}</desc>}
    {points.map(p=><line key={p.id} x1={p.x} y1={p.y} x2={body.cx} y2={body.cy} className="part-lead" />)}
    <g transform={`translate(${body.cx} ${body.cy}) rotate(${part.rotation})`}>
      {part.kind==='resistor'&&<><rect x="-19" y="-8" width="38" height="16" rx="5" fill="#ddc49b" stroke="#aa885e"/><path d="M-11-8v16M-4-8v16M4-8v16M13-8v16" stroke="#be603c" strokeWidth="3"/><path d="M-4-8v16" stroke="#6d5139" strokeWidth="3"/></>}
      {part.kind==='led'&&<><circle className="led-glow" r={14+12*glow} fill="#ff7c35" opacity={0.4*glow}/><path d="M5-8.66A10 10 0 1 0 5 8.66Z" fill="#9b3e36" stroke="#71382e"/><path className="led-light" d="M5-8.66A10 10 0 1 0 5 8.66Z" fill="#ff643a" opacity={glow}/><circle cx="-2" r="3.5" fill="#ffe8aa" opacity={0.85*glow}/><path d="M5-7v14" stroke="#ffe1d0" strokeWidth="2"/><ellipse cx="-3" cy="-3" rx="3" ry="4" fill="white" opacity=".25"/></>}
      {part.kind==='switch'&&<><rect x="-14" y="-9" width="28" height="18" rx="3" fill="#526b5a" stroke="#284e3e"/><rect x={part.closed?2:-11} y="-6" width="9" height="12" rx="2" fill={part.closed?'#c5e59b':'#d5dbcb'}/><text x="-11" y="-14" className="pin-mark">{part.closed?'ON':'OFF'}</text></>}
      {part.kind==='button'&&<><rect x="-17" y="-21" width="34" height="42" rx="5" fill="#60706b" stroke="#334e43"/><circle data-button-cap="true" r="12" fill={activated?'#b57932':'#e6b25e'} stroke="#946c36" strokeWidth="2"><title>运行中按住接通，松开断开；拖动灰色外壳移动</title></circle><text x="-14" y="-26" className="pin-mark">1—2</text><text x="-14" y="30" className="pin-mark">3—4</text></>}
      {part.kind==='potentiometer'&&<><rect x="-17" y="-12" width="34" height="24" rx="4" fill="#4b7a9d" stroke="#315467"/><circle r="9" fill="#dce0d2"/><path d="M0 0v-7" stroke="#486b77" strokeWidth="2.5" transform={`rotate(${(part.position??50)*2.7-135})`}/><text x="-20" y="24" className="pin-mark">A W B</text></>}
      {part.kind==='buzzer'&&<><circle r="14" fill="#34463f" stroke="#182f27"/><circle r="5" fill="#172a22"/><text x="-11" y="-17" className="pin-mark">+</text>{lit&&<><path d="M17-7q8 7 0 14m5-19q12 12 0 24" fill="none" stroke="#65934d" strokeWidth="2"/><text x="-10" y="25" className="pin-mark">鸣响</text></>}</>}
      {part.kind==='diode'&&<><rect x="-11" y="-6" width="22" height="12" rx="3" fill="#454b4a" stroke="#252f2b"/><path d="M6-6v12" stroke="#d8dbcf" strokeWidth="4"/><text x="-21" y="-11" className="pin-mark">A</text><text x="14" y="-11" className="pin-mark">K</text></>}
      {part.kind==='ldr'&&<><circle r="12" fill="#d7b080" stroke="#957249"/><path d="M-8-6h14l-12 4h12L-6 2H6L-6 6H8" fill="none" stroke="#a35d43" strokeWidth="1.7"/><path d="m-18-20 7 7m-16 0 7 7" stroke="#bf9d42" strokeWidth="2"/></>}
    </g>
    {points.map(p=><circle key={p.id} cx={p.x} cy={p.y} r="3" fill="#6c797a"/>)}
    {part.kind==='led'&&points.map((p,index)=>{
      const other=points[index===0?1:0]!,horizontal=p.y===other.y;
      const onLeft=p.x<other.x;
      return <g key={`polarity-${index}`} className="led-polarity" pointerEvents="none" aria-hidden="true">
        {index===0?<circle cx={p.x} cy={p.y} r="4.4" fill="none" stroke="#a7442d" strokeWidth="1.5"/>:<rect x={p.x-4} y={p.y-4} width="8" height="8" rx="1" fill="none" stroke="#345d78" strokeWidth="1.5"/>}
        <text x={horizontal?p.x+(onLeft?-3:3):p.x+17} y={horizontal?p.y-16:p.y+4} textAnchor={horizontal&&onLeft?'end':'start'} className={index===0?'led-pin-positive':'led-pin-negative'}>{index===0?'A＋':'K−'}</text>
      </g>;
    })}
  </g>;
}
