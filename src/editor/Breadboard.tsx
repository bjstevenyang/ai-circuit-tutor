import { useRef, useState } from 'react';
import { ENDPOINTS, ENDPOINT_BY_ID, HOLES, getComponentPins } from '../circuit';
import type { CircuitDocument, ComponentInstance } from '../circuit';

type Props = {
  document: CircuitDocument;
  connected: readonly string[];
  selected: string | null;
  selectedEndpoint: string | null;
  highlighted: readonly string[];
  wireStart: string;
  preview: ComponentInstance | null;
  previewValid: boolean;
  ledOn: boolean;
  onEndpoint: (id: string) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function PartShape({ part, ghost = false, lit = false }: {
  part: ComponentInstance;
  ghost?: boolean;
  lit?: boolean;
}) {
  const pins = getComponentPins(part);
  if (!pins) return null;
  const a = ENDPOINT_BY_ID.get(pins[0]);
  const b = ENDPOINT_BY_ID.get(pins[1]);
  if (!a || !b) return null;
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  return <g className={ghost ? 'part-shape ghost' : 'part-shape'}>
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="part-lead" />
    {part.kind === 'resistor' ? <g transform={`translate(${x} ${y}) rotate(${part.rotation})`}>
      <rect x="-19" y="-8" width="38" height="16" rx="5" fill="#ddc49b" stroke="#aa885e" />
      <path d="M-11-8v16M-4-8v16M4-8v16M13-8v16" stroke="#be603c" strokeWidth="3" />
      <path d="M-4-8v16" stroke="#6d5139" strokeWidth="3" />
      <path d="M13-8v16" stroke="#ba9a41" strokeWidth="2" />
    </g> : <g transform={`translate(${x} ${y}) rotate(${part.rotation})`}>
      {lit && <circle r="24" fill="#f45a42" opacity=".18" />}
      <circle r="10" fill={lit ? '#ff6249' : '#c44f45'} stroke="#87392f" strokeWidth="1.5" />
      <path d="M5-7v14" stroke="#ffe1d0" strokeWidth="1.5" />
      <ellipse cx="-3" cy="-3" rx="3" ry="4" fill="white" opacity=".4" />
      <text x="-19" y="-12" className="pin-mark">A</text>
      <text x="14" y="-12" className="pin-mark">K</text>
    </g>}
    <circle cx={a.x} cy={a.y} r="3" fill="#6c797a" />
    <circle cx={b.x} cy={b.y} r="3" fill="#6c797a" />
  </g>;
}

export function Breadboard(props: Props) {
  const { document: circuit, connected, highlighted, selected, selectedEndpoint, wireStart } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [focusHole, setFocusHole] = useState('a1');
  const occupied = new Set(circuit.wires.flatMap(wire => [wire.from, wire.to]));
  circuit.components.forEach(part => getComponentPins(part)?.forEach(pin => occupied.add(pin)));
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
  return <svg ref={svgRef} className="breadboard-svg" viewBox="0 0 880 650"
    role="group" aria-label="交互式面包板，方向键移动孔位，回车选择"
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
    <text x="784" y="37" textAnchor="end" className="canvas-eyebrow">4.5 V DC</text>
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
      className={`socket ${active.has(hole.id) ? 'connected' : ''} ${emphasis.has(hole.id) ? 'evidence' : ''} ${wireStart === hole.id ? 'wire-start' : ''}`}>
      <circle cx={hole.x} cy={hole.y} r="4.1" className="socket-rim" />
      <circle cx={hole.x} cy={hole.y} r="2.2" className="socket-core" />
      {selectedEndpoint === hole.id && <circle cx={hole.x} cy={hole.y} r="8" className="selected-ring" />}
    </g>)}
    <g className="battery">
      <rect x="112" y="542" width="152" height="58" rx="9" fill="#233d35" />
      <rect x="120" y="550" width="136" height="42" rx="5" fill="#304f42" />
      <path d="M142 560l-6 12h9l-6 12" fill="none" stroke="#c4e8a5" strokeWidth="2" />
      <text x="158" y="570" fill="#f3f5ea" fontSize="14" fontWeight="700">4.5 V</text>
      <text x="158" y="585" fill="#bdd0bc" fontSize="9">IDEAL BATTERY</text>
      <path d="M264 559H285V565M264 583H325V565" fill="none" stroke="#8b938a" strokeWidth="2" />
    </g>
    {circuit.wires.map(wire => {
      const a = ENDPOINT_BY_ID.get(wire.from);
      const b = ENDPOINT_BY_ID.get(wire.to);
      if (!a || !b) return null;
      const path = wire.bend === 'horizontal'
        ? `M${a.x} ${a.y}H${b.x}V${b.y}`
        : `M${a.x} ${a.y}V${b.y}H${b.x}`;
      return <g key={wire.id} role="button" tabIndex={0} className="wire-item"
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
      onClick={() => props.onEndpoint(endpoint.id)} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onEndpoint(endpoint.id); }
      }}>
      <circle cx={endpoint.x} cy={endpoint.y} r="13" fill="transparent" />
      <circle cx={endpoint.x} cy={endpoint.y} r="7" fill={endpoint.id.endsWith('+') ? '#c26e5c' : '#3b4b49'}
        stroke={active.has(endpoint.id) ? '#37987a' : '#fff'} strokeWidth="3" />
      <text x={endpoint.x} y={endpoint.y + 24} textAnchor="middle" className="port-label">{endpoint.id.endsWith('+') ? '+' : '−'}</text>
    </g>)}
    {/* Hit targets sit above wires without repainting the holes over their routes. */}
    {HOLES.map(hole => <g key={hole.id} id={`socket-${hole.id}`} role="button"
      aria-label={`孔位 ${hole.id}，${occupied.has(hole.id) ? '已占用' : '空闲'}`}
      aria-describedby={active.has(hole.id) ? 'network-members' : undefined}
      aria-pressed={selectedEndpoint === hole.id} tabIndex={focusHole === hole.id ? 0 : -1}
      className={`socket socket-hit ${active.has(hole.id) ? 'connected' : ''}`}
      onFocus={() => { setFocusHole(hole.id); props.onHover(hole.id); }}
      onClick={() => props.onEndpoint(hole.id)} onPointerEnter={() => props.onHover(hole.id)}
      onKeyDown={event => {
        if (event.key.startsWith('Arrow')) { event.preventDefault(); arrowFocus(hole.id, event.key); }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onEndpoint(hole.id); }
      }}>
      <title>{hole.id} · {hole.group}</title>
      <circle cx={hole.x} cy={hole.y} r="9" fill="transparent" className="socket-target" />
    </g>)}
    {circuit.components.map(part => <g key={part.id} role="button" tabIndex={0} className="component-item"
      aria-label={`${part.kind === 'resistor' ? `电阻 ${part.resistance ?? 330} 欧姆` : '红色 LED'}，锚点 ${part.anchor}`}
      aria-pressed={selected === part.id} onClick={() => props.onSelect(part.id)} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onSelect(part.id); }
      }}>
      {selected === part.id && (() => {
        const pins = getComponentPins(part);
        const a = pins ? ENDPOINT_BY_ID.get(pins[0]) : undefined;
        const b = pins ? ENDPOINT_BY_ID.get(pins[1]) : undefined;
        return a && b ? <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#edbd62" strokeWidth="27" strokeLinecap="round" opacity=".4" /> : null;
      })()}
      <PartShape part={part} lit={part.kind === 'led' && props.ledOn} />
    </g>)}
    {props.preview && <g className={props.previewValid ? 'preview valid' : 'preview invalid'} pointerEvents="none">
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
