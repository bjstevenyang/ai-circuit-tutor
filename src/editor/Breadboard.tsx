import { useEffect, useRef, useState } from 'react';
import { ENDPOINTS, ENDPOINT_BY_ID, HOLES, getComponentPins, COMPONENTS, componentBody, supplyVoltageOf } from '../circuit';
import { PartShape } from './PartShape';
import { relativeLedBrightness, ledDescriptionId } from './ledAppearance';
import { applyEdit } from './model';
import type { WireEnd } from './model';
import { snapAnchor, snapEndpoint } from './drag';
import type { BoardPoint } from './drag';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CircuitDocument, ComponentInstance, ComponentReading, CurveControl, Wire } from '../circuit';
import { endpointOccupancy } from '../circuit/wires';
import { clampCurveControl, defaultCurveControl, newWireShape } from './wireGeometry';
import { wirePath } from './wirePath';

type Props = {
  document: CircuitDocument;
  connected: readonly string[];
  selected: string | null;
  selectedEndpoint: string | null;
  highlighted: readonly string[];
  wireStart: string;
  wiring: boolean;
  wireStyle: Pick<Wire,'color'|'bend'>;
  preview: ComponentInstance | null;
  previewValid: boolean;
  readings?: Record<string, ComponentReading>;
  pressedButtons?: readonly string[];
  running: boolean;
  onButtonPress: (id: string, pressed: boolean) => void;
  onEndpoint: (id: string) => void;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
  onHover: (id: string | null) => void;
  onMove: (id: string, anchor: string | null) => void;
  onWireDrag: (from: string, to: string | null) => void;
  onWireReconnect: (id: string, endpoint: WireEnd, to: string | null) => void;
  onWireEndSelect: (endpoint: WireEnd) => void;
  onWireCurveChange: (id:string,point:CurveControl) => void;
};

type Drag = { part: ComponentInstance; pointerId: number; start: BoardPoint; client: BoardPoint; moved: boolean };
type Reconnect = { id: string; endpoint: WireEnd };
type WireView = { from: string; to: string | null; point: BoardPoint; reconnect?: Reconnect };
type CurveSession={id:string;pointerId:number;client:BoardPoint;start:BoardPoint;original:CurveControl;moved:boolean;document:CircuitDocument;selected:string|null;wiring:boolean};
type CurveView=Pick<CurveSession,'id'|'document'|'selected'|'wiring'>&{point:CurveControl};

export function Breadboard(props: Props) {
  const { document: circuit, connected, highlighted, selected, selectedEndpoint, wireStart } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [focusHole, setFocusHole] = useState('a1');
  const drag = useRef<Drag | null>(null);
  const heldButton = useRef<{id:string;pointerId?:number;key?:string}|null>(null);
  useEffect(()=>{
    if(heldButton.current&&(!props.running||!props.pressedButtons?.includes(heldButton.current.id)))heldButton.current=null;
  },[props.running,props.pressedButtons]);
  const releaseButton=()=>{
    const held=heldButton.current;
    if(!held)return;
    heldButton.current=null;
    props.onButtonPress(held.id,false);
  };
  const suppressClick = useRef(false);
  const wireDrag = useRef<{from:string;pointerId:number;client:BoardPoint;moved:boolean;reconnect?:Reconnect}|null>(null);
  const [wireView,setWireView] = useState<WireView|null>(null);
  const curveDrag=useRef<CurveSession|null>(null);
  const [curveView,setCurveView]=useState<CurveView|null>(null);
  const curvePreview=curveView?.document===circuit&&curveView.selected===selected&&curveView.wiring===props.wiring?curveView:null;
  useEffect(()=>{
    const cancel=()=>{if(curveDrag.current){curveDrag.current=null;setCurveView(null);suppressClick.current=true;}};
    window.addEventListener('blur',cancel);
    return()=>{window.removeEventListener('blur',cancel);cancel();};
  },[circuit,selected,props.wiring]);
  const [dragView, setDragView] = useState<{ part: ComponentInstance; anchor: string | null; dx: number; dy: number } | null>(null);
  const boardPoint = (event: ReactPointerEvent): BoardPoint | null => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  };
  const updateDrag = (event: ReactPointerEvent) => {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return null;
    const point = boardPoint(event);
    if (!point) return null;
    session.moved ||= Math.hypot(event.clientX-session.client.x, event.clientY-session.client.y) >= 4;
    if (!session.moved) return null;
    const origin = ENDPOINT_BY_ID.get(session.part.anchor)!;
    const dx = point.x-session.start.x, dy = point.y-session.start.y;
    const anchor = snapAnchor({x: origin.x+dx, y: origin.y+dy});
    setDragView({part: session.part, anchor, dx, dy});
    return anchor;
  };
  const beginWire = (event: ReactPointerEvent<SVGGElement>, from: string) => {
    if (!props.wiring || event.button !== 0 || drag.current || wireDrag.current || curveDrag.current) return;
    event.preventDefault();event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current = false;
    wireDrag.current={from,pointerId:event.pointerId,client:{x:event.clientX,y:event.clientY},moved:false};
  };
  const beginReconnect = (event: ReactPointerEvent<SVGGElement>) => {
    const endpoint=event.currentTarget.dataset.wireEnd;
    if(endpoint!=='from'&&endpoint!=='to')return;
    if(event.button!==0||drag.current||wireDrag.current||curveDrag.current)return;
    const wire=circuit.wires.find(item=>item.id===selected);
    if(!wire)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);suppressClick.current=false;
    wireDrag.current={from:wire[endpoint==='from'?'to':'from'],pointerId:event.pointerId,client:{x:event.clientX,y:event.clientY},moved:false,reconnect:{id:wire.id,endpoint}};
  };
  const updateWire = (event: ReactPointerEvent) => {
    const session=wireDrag.current;
    if(!session || session.pointerId!==event.pointerId)return null;
    const point=boardPoint(event);
    if(!point)return null;
    session.moved ||= Math.hypot(event.clientX-session.client.x,event.clientY-session.client.y)>=4;
    if(!session.moved)return null;
    const to=snapEndpoint(point);
    setWireView({from:session.from,to,point,...(session.reconnect?{reconnect:{...session.reconnect}}:{})});
    return to;
  };
  const beginCurve=(event:ReactPointerEvent<SVGGElement>)=>{
    const wire=circuit.wires.find(item=>item.id===selected),start=boardPoint(event);
    if(event.button!==0||!wire?.curveControl||!start||drag.current||wireDrag.current||curveDrag.current||heldButton.current)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current=false;
    curveDrag.current={id:wire.id,pointerId:event.pointerId,client:{x:event.clientX,y:event.clientY},start,
      original:{...wire.curveControl},moved:false,document:circuit,selected,wiring:props.wiring};
  };
  const updateCurve=(event:ReactPointerEvent)=>{
    const session=curveDrag.current,point=boardPoint(event);
    if(!session||session.pointerId!==event.pointerId||session.document!==circuit||session.selected!==selected||session.wiring!==props.wiring||!point)return null;
    session.moved ||= Math.hypot(event.clientX-session.client.x,event.clientY-session.client.y)>=4;
    if(!session.moved)return null;
    const next=clampCurveControl({x:session.original.x+point.x-session.start.x,y:session.original.y+point.y-session.start.y});
    setCurveView({id:session.id,document:circuit,selected,wiring:props.wiring,point:next});return next;
  };
  const endpointClick = (event: {detail:number}, id:string) => {
    if(suppressClick.current && event.detail>0){suppressClick.current=false;return;}
    props.onEndpoint(id);
  };
  const cancelDrag = () => {
    releaseButton();
    if (drag.current?.moved) suppressClick.current = true;
    if (wireDrag.current?.moved) suppressClick.current = true;
    if (curveDrag.current?.moved) suppressClick.current = true;
    drag.current = null;
    wireDrag.current = null;
    curveDrag.current=null;setCurveView(null);
    setDragView(null);
    setWireView(null);
  };
  const dragPreview = dragView?.anchor ? {...dragView.part, anchor: dragView.anchor} : null;
  const dragValid = !!dragPreview && applyEdit(circuit, {type:'move',id:dragPreview.id,anchor:dragPreview.anchor,rotation:dragPreview.rotation}).ok;
  const wireValid = !!wireView?.to && applyEdit(circuit,wireView.reconnect
    ? {type:'reconnect-wire',...wireView.reconnect,to:wireView.to}
    : {type:'wire',wire:{id:'__wire-preview__',from:wireView.from,to:wireView.to,...props.wireStyle,...newWireShape(wireView.from,wireView.to,props.wireStyle.bend)}}).ok;
  const selectedWire = circuit.wires.find(wire=>wire.id===selected);
  const occupied=endpointOccupancy(circuit);
  const occupancy=(id:string)=>occupied.pins.has(id)?occupied.wires.has(id)?'shared':'pin':occupied.wires.has(id)?'wire':'empty';
  const occupancyText=(id:string)=>({empty:'空闲',pin:'仅引脚，可接一根导线',wire:/^[a-j]\d+$/.test(id)?'仅导线，可与一个引脚共用':'仅导线，不能再接线',shared:'引脚与导线共用，不能再插入'})[occupancy(id)];
  const active = new Set(connected);
  const emphasis = new Set(highlighted);
  circuit.components.filter(part => highlighted.includes(part.id)).forEach(part => {
    getComponentPins(part)?.forEach(pin => emphasis.add(pin));
  });
  const arrowFocus = (id: string, key: string) => {
    const current = ENDPOINT_BY_ID.get(id);
    if (!current) return;
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    const next = HOLES.filter(hole => horizontal
      ? hole.y === current.y && (hole.x - current.x) * sign > 0
      : hole.x === current.x && (hole.y - current.y) * sign > 0,
    ).sort((a, b) => horizontal
      ? Math.abs(a.x - current.x) - Math.abs(b.x - current.x)
      : Math.abs(a.y - current.y) - Math.abs(b.y - current.y),
    )[0];
    if (next) {
      setFocusHole(next.id);
      (svgRef.current?.getElementById(`socket-${next.id}`) as SVGElement | null)?.focus();
    }
  };
  const holeTarget=(hole:(typeof HOLES)[number])=><g key={hole.id} id={`socket-${hole.id}`} role="button"
    aria-label={`孔位 ${hole.id}，${occupancyText(hole.id)}`} data-occupancy={occupancy(hole.id)}
    aria-describedby={active.has(hole.id)?'network-members':undefined} aria-pressed={selectedEndpoint===hole.id}
    tabIndex={focusHole===hole.id?0:-1} className={`socket socket-hit ${active.has(hole.id)?'connected':''}`}
    onFocus={()=>{setFocusHole(hole.id);props.onHover(hole.id);}} onPointerDown={event=>beginWire(event,hole.id)}
    onClick={event=>endpointClick(event,hole.id)} onPointerEnter={()=>props.onHover(hole.id)}
    onKeyDown={event=>{
      if(event.key.startsWith('Arrow')){event.preventDefault();arrowFocus(hole.id,event.key);}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();props.onEndpoint(hole.id);}
    }}>
    <title>{hole.id} · {hole.group} · {occupancyText(hole.id)}</title>
    <circle cx={hole.x} cy={hole.y} r="9" fill="transparent" className="socket-target"/>
  </g>;
  return <svg ref={svgRef} className="breadboard-svg" viewBox="0 0 880 650"
    role="group" aria-label="交互式面包板，方向键移动孔位，回车选择"
    onPointerMove={event=>{if(curveDrag.current)updateCurve(event);else if(wireDrag.current)updateWire(event);else updateDrag(event);}}
    onPointerUp={event => {
      const curve=curveDrag.current;
      if(curve?.pointerId===event.pointerId){
        const point=updateCurve(event);curveDrag.current=null;setCurveView(null);suppressClick.current=curve.moved;
        if(point&&(point.x!==curve.original.x||point.y!==curve.original.y))props.onWireCurveChange(curve.id,point);
        return;
      }
      if(heldButton.current?.pointerId===event.pointerId){releaseButton();return;}
      const connection=wireDrag.current;
      if(connection && connection.pointerId===event.pointerId){
        const to=updateWire(event);
        if(connection.moved){
          suppressClick.current=true;
          if(connection.reconnect)props.onWireReconnect(connection.reconnect.id,connection.reconnect.endpoint,to);
          else props.onWireDrag(connection.from,to);
        }
        wireDrag.current=null;setWireView(null);return;
      }
      const session = drag.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const anchor = updateDrag(event);
      if (session.moved) { suppressClick.current = true; props.onMove(session.part.id, anchor); }
      drag.current = null;
      setDragView(null);
    }}
    onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
    onKeyDown={event => { if (event.key === 'Escape' && (drag.current||wireDrag.current||curveDrag.current||heldButton.current)) { event.preventDefault(); cancelDrag(); } }}
    onPointerLeave={() => props.onHover(null)}>
    <defs>
      <filter id="board-shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#263e37" floodOpacity=".10" />
      </filter>
      <pattern id="workbench-dots" width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r=".7" fill="#ccd6cc" />
      </pattern>
    </defs>
    <rect width="880" height="650" fill="url(#workbench-dots)" />
    <text x="96" y="37" className="canvas-eyebrow">BREADBOARD / 30 ROWS</text>
    <text x="784" y="37" textAnchor="end" className="canvas-eyebrow">{circuit.sourceMode==='teaching-square'?`实验方波 0/4.5 V · ${circuit.signalFrequencyHz} Hz`:`${supplyVoltageOf(circuit)} V DC`}</text>
    <g filter="url(#board-shadow)">
      <rect x="94" y="65" width="688" height="450" rx="17" fill="#ecece4" stroke="#d1d5c9" />
      <rect x="101" y="72" width="674" height="436" rx="13" fill="#fafaf5" />
      <rect x="107" y="142" width="662" height="277" rx="5" fill="#f1f1e9" stroke="#e3e5da" />
      <rect x="108" y="270" width="660" height="22" rx="4" fill="#e3e5d9" />
      <path d="M109 273H766" stroke="#d4d8c8" />
      <text x="440" y="285" textAnchor="middle" className="trench-label">CENTER GAP · 中央沟槽两侧不相连</text>
      {[83, 477].map((y, i) => <g key={y}>
        <path d={`M128 ${y}H743`} stroke={i === 0 ? '#c96b61' : '#668ba3'} strokeWidth="1.5" />
        <text x="116" y={y + 4} textAnchor="middle" fill={i === 0 ? '#c96b61' : '#668ba3'} fontSize="14">{i === 0 ? '+' : '−'}</text>
      </g>)}
      <path d="M128 136H743" stroke="#668ba3" strokeWidth="1.5" />
      <text x="116" y="140" textAnchor="middle" fill="#668ba3" fontSize="14">−</text>
      <path d="M128 424H743" stroke="#c96b61" strokeWidth="1.5" />
      <text x="116" y="428" textAnchor="middle" fill="#c96b61" fontSize="14">+</text>
      {Array.from({ length: 30 }, (_, index) => <g key={index} className="board-labels">
        <text x={140 + index * 20} y="156" textAnchor="middle">{index + 1}</text>
        <text x={140 + index * 20} y="410" textAnchor="middle">{index + 1}</text>
      </g>)}
      {'abcdefghij'.split('').map((column, index) => <g key={column} className="board-labels">
        <text x="119" y={(index < 5 ? 170 + index * 20 : 310 + (index - 5) * 20) + 4}>{column}</text>
        <text x="752" y={(index < 5 ? 170 + index * 20 : 310 + (index - 5) * 20) + 4}>{column}</text>
      </g>)}
    </g>
    {HOLES.map(hole => <g key={hole.id} pointerEvents="none" aria-hidden="true"
      className={`socket occupancy-${occupancy(hole.id)} ${active.has(hole.id) ? 'connected' : ''} ${emphasis.has(hole.id) ? 'evidence' : ''} ${wireStart === hole.id ? 'wire-start' : ''}`}>
      <circle cx={hole.x} cy={hole.y} r="4.1" className="socket-rim" />
      <circle cx={hole.x} cy={hole.y} r="2.2" className="socket-core" />
      {occupancy(hole.id)==='shared'&&<circle cx={hole.x} cy={hole.y} r="6" className="shared-ring"/>}
      {selectedEndpoint === hole.id && <circle cx={hole.x} cy={hole.y} r="8" className="selected-ring" />}
    </g>)}
    <g className="battery">
      <rect x="112" y="542" width="152" height="58" rx="9" fill="#233d35" />
      <rect x="120" y="550" width="136" height="42" rx="5" fill="#304f42" />
      <path d="M142 560l-6 12h9l-6 12" fill="none" stroke="#c4e8a5" strokeWidth="2" />
      <text x="158" y="570" fill="#f3f5ea" fontSize="14" fontWeight="700">{circuit.sourceMode==='teaching-square'?'实验方波':`${supplyVoltageOf(circuit)} V`}</text>
      <text x="158" y="585" fill="#bdd0bc" fontSize="9">{circuit.sourceMode==='teaching-square'?'LAB SIGNAL':'IDEAL BATTERY'}</text>
      <path d="M264 559H285V565M264 583H325V565" fill="none" stroke="#8b938a" strokeWidth="2" />
    </g>
    {!props.wiring&&HOLES.map(holeTarget)}
    {circuit.wires.map(wire => {
      const a = ENDPOINT_BY_ID.get(wire.from);
      const b = ENDPOINT_BY_ID.get(wire.to);
      if (!a || !b) return null;
      const path=wirePath(a,b,curvePreview?.id===wire.id?{...wire,curveControl:curvePreview.point}:wire);
      return <g key={wire.id} role="button" tabIndex={0} className={`wire-item ${wireView?.reconnect?.id===wire.id?'reconnecting':''}`}
        aria-label={`导线 ${wire.from} 到 ${wire.to}`} aria-pressed={selected === wire.id}
        onClick={() => props.onSelect(wire.id)} onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onSelect(wire.id); }
        }}>
        {selected === wire.id && <path d={path} fill="none" stroke="#ffcd77" strokeWidth="10" opacity=".7" />}
        <path d={path} fill="none" stroke="#112d27" strokeWidth="5.5" opacity=".15" transform="translate(0 2)" />
        <path d={path} fill="none" stroke={wire.color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path} fill="none" stroke="transparent" strokeWidth="13" />
        <circle cx={a.x} cy={a.y} r="3" fill={wire.color} />
        <circle cx={b.x} cy={b.y} r="3" fill={wire.color} />
      </g>;
    })}
    {ENDPOINTS.filter(endpoint => endpoint.id.startsWith('battery:')).map(endpoint => <g
      key={endpoint.id} role="button" tabIndex={0} aria-label={`电池${endpoint.id.endsWith('+') ? '正' : '负'}极`}
      className={`battery-port ${wireStart === endpoint.id ? 'wire-start' : ''}`}
      onPointerDown={event=>beginWire(event,endpoint.id)}
      onClick={event=>endpointClick(event,endpoint.id)} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onEndpoint(endpoint.id); }
      }}>
      <circle cx={endpoint.x} cy={endpoint.y} r="13" fill="transparent" />
      <circle cx={endpoint.x} cy={endpoint.y} r="7" fill={endpoint.id.endsWith('+') ? '#c26e5c' : '#3b4b49'}
        stroke={active.has(endpoint.id) ? '#37987a' : '#fff'} strokeWidth="3" />
      <text x={endpoint.x} y={endpoint.y + 24} textAnchor="middle" className="port-label">{endpoint.id.endsWith('+') ? '+' : '−'}</text>
    </g>)}
    {props.wiring&&HOLES.filter(hole=>!occupied.pins.has(hole.id)).map(holeTarget)}
    {circuit.components.map(part => <g key={part.id} role="button" tabIndex={0} className={`component-item ${dragView?.part.id === part.id ? 'dragging' : ''}`}
      aria-label={`${part.kind === 'resistor' ? `电阻 ${part.resistance ?? 330} 欧姆` : COMPONENTS[part.kind].name}，锚点 ${part.anchor}`}
      aria-describedby={part.kind==='led'?ledDescriptionId(part.id):part.kind==='potentiometer'?`pot-pins-${encodeURIComponent(part.id)}`:['switch','button'].includes(part.kind)?`control-state-${encodeURIComponent(part.id)}`:undefined}
      aria-pressed={part.kind==='switch'?(part.closed??false):part.kind==='button'?(props.pressedButtons?.includes(part.id)??false):selected === part.id}
      onPointerDown={event => {
        if (event.button !== 0 || drag.current || wireDrag.current || curveDrag.current || heldButton.current) return;
        if(part.kind==='button'&&props.running&&event.target instanceof Element&&event.target.closest('[data-button-cap]')){
          event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
          heldButton.current={id:part.id,pointerId:event.pointerId};
          props.onSelect(part.id);props.onButtonPress(part.id,true);return;
        }
        const start = boardPoint(event);
        if (!start) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        suppressClick.current = false;
        drag.current = {part,pointerId:event.pointerId,start,client:{x:event.clientX,y:event.clientY},moved:false};
        props.onSelect(part.id);
      }}
      onClick={event => { if (suppressClick.current && event.detail > 0) { suppressClick.current = false; return; } props.onActivate(part.id); }} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();if(event.repeat)return;
          if(part.kind==='button'&&props.running){
            if(!heldButton.current){heldButton.current={id:part.id,key:event.key};props.onSelect(part.id);props.onButtonPress(part.id,true);}
          }else props.onActivate(part.id);
        }
      }} onKeyUp={event=>{
        if(heldButton.current?.id===part.id&&heldButton.current.key===event.key){event.preventDefault();releaseButton();}
      }} onBlur={()=>{if(heldButton.current?.id===part.id)releaseButton();}}>
      {part.kind==='switch'&&<desc id={`control-state-${encodeURIComponent(part.id)}`}>开关当前{part.closed?'已接通':'已断开'}。运行中点击本体或按 Enter／Space 切换通断；拖动仅移动位置。</desc>}
      {part.kind==='button'&&<desc id={`control-state-${encodeURIComponent(part.id)}`}>常开按钮当前{props.pressedButtons?.includes(part.id)?'已按下':'已释放'}。运行中按住黄色圆钮或 Enter／Space 接通，松开断开；拖动灰色外壳移动元件。</desc>}
      {selected === part.id && (() => {
        const body=componentBody(part);
        return body ? <rect x={body.cx-body.width/2-5} y={body.cy-body.height/2-5} width={body.width+10} height={body.height+10} rx="5" fill="#edbd62" opacity=".35" transform={`rotate(${part.rotation} ${body.cx} ${body.cy})`}/> : null;
      })()}
      <PartShape part={part} {...(props.readings?.[part.id]?{reading:props.readings[part.id]}:{})} lit={props.readings?.[part.id]?.on ?? false} brightness={relativeLedBrightness(props.readings?.[part.id])} activated={props.pressedButtons?.includes(part.id) ?? false} />
    </g>)}
    {props.wiring&&HOLES.filter(hole=>occupied.pins.has(hole.id)).map(holeTarget)}
    {selectedWire?.bend==='curve'&&selectedWire.curveControl&&(()=>{
      const a=ENDPOINT_BY_ID.get(selectedWire.from)!,b=ENDPOINT_BY_ID.get(selectedWire.to)!;
      const point=curvePreview?.id===selectedWire.id?curvePreview.point:selectedWire.curveControl;
      return <g className="wire-curve-controls">
        <path d={`M${a.x} ${a.y}L${point.x} ${point.y}L${b.x} ${b.y}`} fill="none" stroke="#a57528" strokeDasharray="4 4" opacity=".65" pointerEvents="none"/>
        <g role="button" tabIndex={0} className="wire-curve-handle" aria-label="导线曲线控制点" aria-describedby="curve-keyboard-help"
          onPointerDown={beginCurve} onClick={event=>{event.stopPropagation();suppressClick.current=false;}}
          onKeyDown={event=>{
            const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
            if(!delta||event.metaKey||event.ctrlKey||event.altKey)return;
            event.preventDefault();event.stopPropagation();if(event.repeat||curveDrag.current)return;
            const step=event.shiftKey?1:10,next=clampCurveControl({x:point.x+delta[0]!*step,y:point.y+delta[1]!*step});
            if(next.x!==point.x||next.y!==point.y)props.onWireCurveChange(selectedWire.id,next);
          }}>
          <desc id="curve-keyboard-help">拖动改变弧线。方向键移动10单位，Shift加方向键移动1单位。Esc取消拖动。</desc>
          <circle cx={point.x} cy={point.y} r="12" fill="transparent"/>
          <circle cx={point.x} cy={point.y} r="7" fill="#fff4cc" stroke="#a57528" strokeWidth="2"/>
          <path d={`M${point.x-3} ${point.y}h6M${point.x} ${point.y-3}v6`} stroke="#80571b" pointerEvents="none"/>
        </g>
      </g>;
    })()}
    {selectedWire && (['from','to'] as const).map(endpoint=>{
      const point=ENDPOINT_BY_ID.get(selectedWire[endpoint])!;
      return <g key={endpoint} role="button" tabIndex={0} className="wire-end-handle"
        aria-label={`导线${endpoint==='from'?'起点':'终点'} ${selectedWire[endpoint]}`}
        data-wire-end={endpoint} onPointerDown={beginReconnect}
        onClick={event=>{event.stopPropagation();suppressClick.current=false;}}
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();props.onWireEndSelect(endpoint);}}}>
        <title>拖到新孔位改接；回车可使用下方表单</title>
        <circle cx={point.x} cy={point.y} r="10" fill="transparent"/>
        <circle cx={point.x} cy={point.y} r="7" fill="#fffdf2" stroke="#a57528" strokeWidth="2"/>
        <circle cx={point.x} cy={point.y} r="3" fill={selectedWire.color}/>
      </g>;
    })}
    {wireView && (()=>{
      const fixed=ENDPOINT_BY_ID.get(wireView.from)!,moving=ENDPOINT_BY_ID.get(wireView.to??'')??wireView.point;
      const [from,to]=wireView.reconnect?.endpoint==='from'?[moving,fixed]:[fixed,moving];
      const style=wireView.reconnect?circuit.wires.find(w=>w.id===wireView.reconnect!.id)??props.wireStyle:
        {...props.wireStyle,...(props.wireStyle.bend==='curve'?{curveControl:defaultCurveControl(from,to)}:{})};
      const path=wirePath(from,to,style);
      return <g className={`preview wire-preview ${wireValid?'valid':'invalid'}`} pointerEvents="none" aria-hidden="true">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="5 3"/>
        <circle cx={moving.x} cy={moving.y} r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
        <text x="440" y="625" textAnchor="middle" className="drag-feedback">{wireValid?`${wireView.reconnect?'松开改接至':'松开连接至'} ${wireView.to}`:'请拖到没有导线的孔位（可有引脚）· Esc 取消'}</text>
      </g>;
    })()}
    {dragView && <g className={`preview drag-preview ${dragValid?'valid':'invalid'}`} pointerEvents="none" aria-hidden="true">
      {dragPreview ? <PartShape part={dragPreview} ghost /> : <g transform={`translate(${dragView.dx} ${dragView.dy})`}><PartShape part={dragView.part} ghost /></g>}
      <text x="440" y="625" textAnchor="middle" className="drag-feedback">{dragValid?'松开放置 · Esc 取消':'当前位置不可放置 · 松开返回原位'}</text>
    </g>}
    {!dragView && props.preview && <g className={props.previewValid ? 'preview valid' : 'preview invalid'} pointerEvents="none">
      <PartShape part={props.preview} ghost />
      {(() => {
        const hole = ENDPOINT_BY_ID.get(props.preview.anchor);
        return hole ? <circle cx={hole.x} cy={hole.y} r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" /> : null;
      })()}
    </g>}
    <text x="782" y="566" textAnchor="end" className="canvas-note">颜色不决定连接 · 导线交叉不连接</text>
    <text x="782" y="584" textAnchor="end" className="canvas-note">本板四条电源轨各自连续、彼此独立</text>
  </svg>;
}
