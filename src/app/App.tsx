import { useEffect, useReducer, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { analyzeCircuit, createEmptyDocument, ENDPOINT_BY_ID, getComponentPins, inspectConnectivity, COMPONENTS, COMPONENT_KINDS, MAX_COMPONENTS, MAX_POLAR_COMPONENTS, createComponent, supplyVoltageOf, MIN_SUPPLY_VOLTAGE, MAX_SUPPLY_VOLTAGE } from '../circuit';
import type { AnalysisResult, CircuitDocument, ComponentInstance, ComponentKind, Rotation, Wire } from '../circuit';
import { Breadboard } from '../editor/Breadboard';
import { PartControls } from '../editor/PartControls';
import { useBuzzerSound } from './useBuzzerSound';
import { applyEdit, commitDocument, createHistory, redo, undo } from '../editor/model';
import type { EditCommand, HistoryState, WireEnd } from '../editor/model';
import { loadWorkspace, saveWorkspace } from '../storage';
import { getDiagnosticCopy } from '../tutor';
import { ComponentGuide } from '../tutor/ComponentGuide';
import { NumberEditor } from '../editor/NumberEditor';

type Tool = 'inspect' | 'wire' | 'move' | ComponentKind;
const isPartTool = (tool: Tool): tool is ComponentKind => COMPONENT_KINDS.includes(tool as ComponentKind);
type AppState = {
  history: HistoryState;
  analysis: AnalysisResult | null;
  hintLevel: number;
  diagnosticIndex: number;
  saveStatus: string;
  storageBlocked: boolean;
};
type Action =
  | { type: 'edit'; history: HistoryState; saveStatus: string }
  | { type: 'run'; result: AnalysisResult }
  | { type: 'stop' }
  | { type: 'hint' }
  | { type: 'diagnostic'; index: number }
  | { type: 'save'; message: string }
  | { type: 'recover' };

function initialize(): AppState {
  const saved = loadWorkspace();
  return {
    history: createHistory(saved.status === 'error' ? createEmptyDocument() : saved.document),
    analysis: null,
    hintLevel: 0,
    diagnosticIndex: 0,
    saveStatus: saved.status === 'loaded' ? '已恢复本地作品' : saved.status === 'error' ? saved.message : '本地自动保存已就绪',
    storageBlocked: saved.status === 'error',
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'edit': return { ...state, history: action.history, analysis: null, hintLevel: 0, diagnosticIndex: 0, saveStatus: action.saveStatus };
    case 'run': return { ...state, analysis: action.result, hintLevel: 0, diagnosticIndex: 0 };
    case 'stop': return { ...state, analysis: null, hintLevel: 0, diagnosticIndex: 0 };
    case 'hint': return { ...state, hintLevel: Math.min(3, state.hintLevel + 1) };
    case 'diagnostic': return { ...state, diagnosticIndex: action.index, hintLevel: 0 };
    case 'save': return { ...state, saveStatus: action.message };
    case 'recover': return { ...state, storageBlocked: false };
  }
}

function Icon({ name, size = 18 }: { name: 'circuit' | 'play' | 'stop' | 'wire' | 'eye' | 'undo' | 'redo' | 'reset' | 'arrow' | 'check' | 'bulb' | 'move' | 'rotate' | 'trash'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    circuit: <><path d="M4 6h8v12h8M4 18h3M17 6h3" /><circle cx="20" cy="6" r="1.6" /><circle cx="4" cy="18" r="1.6" /></>,
    play: <path d="m9 5 10 7-10 7Z" fill="currentColor" strokeWidth="1" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" strokeWidth="1" />,
    wire: <><path d="M5 6h6v12h8" /><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    undo: <><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v3" /></>,
    redo: <><path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0-7 7v3" /></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    bulb: <><path d="M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7ZM8 20h8m-6 3h4" /></>,
    move: <><path d="M12 2v20M2 12h20m-13-7 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3" /></>,
    rotate: <><path d="M4 9a8 8 0 1 1 1 9M4 3v6h6" /></>,
    trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function PartIcon({ kind }: { kind: ComponentKind }) {
  return <svg viewBox="0 0 110 50" aria-hidden="true">
    {kind === 'resistor' ? <>
      <path d="M12 25h86" stroke="#8c9992" strokeWidth="3" />
      <rect x="29" y="14" width="52" height="22" rx="7" fill="#ddc49b" stroke="#b3966e" />
      <path d="M39 14v22M49 14v22M59 14v22M71 14v22" stroke="#be603c" strokeWidth="5" />
      <path d="M49 14v22" stroke="#664735" strokeWidth="5" /><path d="M71 14v22" stroke="#b49b47" strokeWidth="3" />
    </> : kind !== 'led' ? <><path d="M12 25h86" stroke="#9ba79d" strokeWidth="2"/><rect x="35" y="8" width="40" height="33" rx="7" fill="#577768"/><text x="55" y="30" textAnchor="middle" fill="#eff5df" fontSize="18">{({switch:'↔',button:'●',potentiometer:'↗',buzzer:'♪',diode:'▷|',ldr:'☀'} as const)[kind]}</text></> : <>
      <path d="M48 31v15m14-15v12" stroke="#9ba79d" strokeWidth="2" />
      <path d="M41 30V19a14 14 0 0 1 28 0v11Z" fill="#c96b5e" stroke="#a5473e" strokeWidth="1.5" />
      <rect x="38" y="29" width="34" height="5" rx="2" fill="#a54e44" />
      <path d="M47 17q0-6 6-7" fill="none" stroke="#f1c0aa" strokeWidth="3" strokeLinecap="round" />
    </>}
  </svg>;
}

const COLORS = [['#b45b49', '砖红'], ['#3d7560', '森林绿'], ['#4e78a0', '蓝色'], ['#b58b39', '金黄'], ['#695c8d', '紫色'], ['#3d474b', '深灰']] as const;
const normalizeEndpoint = (text: string) => text.trim().toLowerCase();

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialize);
  const [tool, setTool] = useState<Tool>('inspect');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [anchor, setAnchor] = useState('a10');
  const [placeKind, setPlaceKind] = useState<ComponentKind>('resistor');
  const [rotation, setRotation] = useState<Rotation>(0);
  const [wireFrom, setWireFrom] = useState('');
  const [wireTo, setWireTo] = useState('');
  const [wireColor, setWireColor] = useState<string>(COLORS[0][0]);
  const [bend, setBend] = useState<Wire['bend']>('horizontal');
  const [error, setError] = useState('');
  const [inspectInput, setInspectInput] = useState('a1');
  const [moveAnchor, setMoveAnchor] = useState('');
  const [zoom, setZoom] = useState(100);
  const [pressedButtons, setPressedButtons] = useState<string[]>([]);
  const [wireEnd,setWireEnd]=useState<WireEnd>('to');
  const [wireTarget,setWireTarget]=useState('');
  const wireTargetRef=useRef<HTMLInputElement>(null);
  const document = state.history.document;
  const voltage=supplyVoltageOf(document);
  const running=state.analysis!==null;
  useEffect(() => {
    const release = () => {
      if (!pressedButtons.length) return;
      setPressedButtons([]);
      if (state.analysis) dispatch({type:'run',result:analyzeCircuit(document)});
    };
    const visibility = () => { if (window.document.hidden) release(); };
    window.addEventListener('blur',release);
    window.document.addEventListener('visibilitychange',visibility);
    return () => { window.removeEventListener('blur',release); window.document.removeEventListener('visibilitychange',visibility); };
  },[pressedButtons,document,state.analysis]);
  const selectedPart = document.components.find(part => part.id === selected);
  const guideKind=selectedPart?.kind??(isPartTool(tool)?tool:null);
  const selectedWire = document.wires.find(wire => wire.id === selected);
  const diagnostic = state.analysis?.diagnostics[state.diagnosticIndex];
  const diagnosticCopy = diagnostic ? getDiagnosticCopy(diagnostic.code) : null;
  const connected = selectedEndpoint ? inspectConnectivity(document, selectedEndpoint, { pressedButtons }) : [];

  const sound = useBuzzerSound(document.components.some(p => p.kind === 'buzzer' && state.analysis?.readings?.[p.id]?.on));
  const run = (next = document, pressed = pressedButtons) => dispatch({ type: 'run', result: analyzeCircuit(next, { pressedButtons: pressed }) });
  const pressButton = (id: string, pressed: boolean) => {
    const next = pressed ? [...new Set([...pressedButtons, id])] : pressedButtons.filter(item => item !== id);
    setPressedButtons(next);
    if (state.analysis) run(document, next);
  };
  const save = (next: CircuitDocument) => {
    if (state.storageBlocked) return '未保存：请先处理原有存档';
    const result = saveWorkspace(next);
    return result.ok ? '已自动保存到此浏览器' : `未保存：${result.message}`;
  };
  const edit = (command: EditCommand, live = false) => {
    const result = applyEdit(document, command);
    if (!result.ok) { setError(result.error); return false; }
    setError('');
    const history=commitDocument(state.history,result.document);
    if(history===state.history)return true;
    dispatch({ type: 'edit', history, saveStatus: save(result.document) });
    if (live && state.analysis) run(result.document);
    else setPressedButtons([]);
    return true;
  };
  const deleteSelected = () => {
    if (!selected || !edit({ type: 'remove', id: selected })) return;
    setSelected(null);
    setTool('inspect');
    setWireFrom('');
    setWireTo('');
  };
  const handleDeleteKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!selected || event.repeat || event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    event.preventDefault();
    deleteSelected();
  };
  const travel = (direction: 'undo' | 'redo') => {
    const history = direction === 'undo' ? undo(state.history) : redo(state.history);
    if (history === state.history) return;
    setSelected(null);
    setTool('inspect');
    setPressedButtons([]);
    setWireFrom('');
    setWireTo('');
    setError('');
    dispatch({ type: 'edit', history, saveStatus: save(history.document) });
  };
  const addWire = (from: string, to: string) => {
    if (edit({ type: 'wire', wire: { id: crypto.randomUUID(), from: normalizeEndpoint(from), to: normalizeEndpoint(to), color: wireColor, bend } })) {
      setWireFrom(''); setWireTo(''); return true;
    }
    return false;
  };
  const newPart = (kind: ComponentKind, at: string): ComponentInstance => createComponent(kind, normalizeEndpoint(at), rotation, crypto.randomUUID());
  const place = (at: string, kind = placeKind) => {
    const part = newPart(kind, at);
    if (edit({ type: 'place', component: part })) {
      setSelected(part.id); setMoveAnchor(part.anchor); setTool('inspect');
    }
  };
  const chooseItem = (id: string) => {
    setSelected(id); setTool('inspect'); setSelectedEndpoint(null);
    const part = document.components.find(item => item.id === id);
    setMoveAnchor(part?.anchor ?? '');
    const wire=document.wires.find(item=>item.id===id);
    if(wire){setWireEnd('to');setWireTarget(wire.to);}
  };
  const reconnectWire = (id: string, endpoint: WireEnd, at: string | null) => {
    const wire=document.wires.find(item=>item.id===id);
    if(!wire)return;
    if(!at){setError('当前位置没有有效接点，导线已保留原连接。');return;}
    const to=normalizeEndpoint(at);
    if(to===wire[endpoint]){setError('');return;}
    if(edit({type:'reconnect-wire',id,endpoint,to})){
      setWireEnd(endpoint);setWireTarget(to);setTool('inspect');setWireFrom('');setWireTo('');
    }
  };
  const activatePart=(id:string)=>{
    chooseItem(id);
    const part=document.components.find(item=>item.id===id);
    if(part?.kind==='switch'&&state.analysis)edit({type:'configure',id,settings:{closed:!part.closed}},true);
  };
  const endpointClick = (id: string) => {
    if (tool === 'wire') {
      if (!wireFrom) setWireFrom(id);
      else addWire(wireFrom, id);
    } else if (isPartTool(tool)) {
      place(id, tool);
    } else if (tool === 'move' && selectedPart) {
      if (edit({ type: 'move', id: selectedPart.id, anchor: id, rotation })) {
        setTool('inspect'); setMoveAnchor(id);
      }
    } else {
      setSelectedEndpoint(id); setInspectInput(id); setSelected(null); setError('');
    }
  };
  const partTool = (kind: ComponentKind) => {
    setTool(kind); setPlaceKind(kind); setSelected(null); setError('');
  };
  const preview: ComponentInstance | null = hover && (isPartTool(tool))
    ? createComponent(tool, hover, rotation, '__preview__')
    : hover && tool === 'move' && selectedPart ? { ...selectedPart, anchor: hover, rotation } : null;
  const previewValid = !!preview && applyEdit(document, tool === 'move'
    ? { type: 'move', id: preview.id, anchor: preview.anchor, rotation: preview.rotation }
    : { type: 'place', component: preview }).ok;
  const submitPlacement = (event: FormEvent) => { event.preventDefault(); place(anchor); };
  const submitWire = (event: FormEvent) => { event.preventDefault(); addWire(wireFrom, wireTo); };
  const toolInstructions: Record<Tool, string> = {
    inspect: '点击孔位，看看哪些孔真正相连', wire: wireFrom ? `起点 ${wireFrom} · 请选择终点` : '点击两端，或从起点拖到终点',
    ...Object.fromEntries(COMPONENT_KINDS.map(kind => [kind, `预览全部引脚，点击放置${COMPONENTS[kind].name}`])) as Record<ComponentKind, string>, move: '选择新锚点，预览后点击移动元件',
  };

  return <>
    <a className="skip-link" href="#workbench">跳到电路工作台</a>
    <header className="app-header">
      <a className="brand" href="#" aria-label="AI Circuit Tutor 电路实验室"><span className="brand-icon"><Icon name="circuit" size={25} /></span><span>AI Circuit <strong>Tutor</strong></span></a>
      <nav aria-label="当前位置"><span className="nav-current">电路实验室</span><span className="nav-divider" /><span className="nav-secondary">边搭建，边理解</span></nav>
      <div className={`save-indicator ${state.saveStatus.startsWith('未保存') || state.storageBlocked ? 'unsaved' : ''}`} role="status"><span className="status-dot" />{state.saveStatus}</div>
    </header>

    <main onKeyDown={handleDeleteKey}>
      <section className="lesson-heading" aria-labelledby="lesson-title">
        <div><div className="eyebrow"><span className="lesson-number">01</span> 直流电路探索 <span className="level-tag">入门</span></div><h1 id="lesson-title">搭出你的电路<span className="heading-dot">.</span></h1><p>8 类元件，自由组合；看懂连接，试验你的想法。</p></div>
        <div className="lesson-goal"><span className="goal-icon"><Icon name="check" /></span><div><small>本次目标</small><p>搭建并检查小型直流串并联电路</p></div></div>
      </section>

      {state.storageBlocked && <div className="recovery-banner" role="alert">
        <div><strong>原有作品尚未读取成功</strong><p>{state.saveStatus}。为保护原有内容，当前暂停自动保存；你仍可在内存中操作。</p></div>
        <button onClick={() => {
          if (window.confirm('将用当前工作台替换无法读取的存档。确定继续吗？')) {
            const saved = saveWorkspace(document);
            if (saved.ok) { dispatch({ type: 'recover' }); dispatch({ type: 'save', message: '已保存当前作品' }); }
            else dispatch({ type: 'save', message: saved.message });
          }
        }}>以当前作品替换存档</button>
      </div>}

      <div className="workspace">
        <aside className="parts-panel" aria-label="元件和精确操作">
          <div className="panel-heading"><h2>元件盒</h2><span className="mono">08 PARTS</span></div>
          <p className="panel-intro">选择元件，再点击孔位放置。</p>
          <div className="part-list">
            {COMPONENT_KINDS.map(kind => {
              const count = document.components.filter(part => part.kind === kind).length;
              const polarCount = document.components.filter(part => ['led','diode','buzzer'].includes(part.kind)).length;
              const atLimit = document.components.length >= MAX_COMPONENTS || (['led','diode','buzzer'].includes(kind) && polarCount >= MAX_POLAR_COMPONENTS);
              return <button key={kind} className={`part-card ${tool === kind ? 'active' : ''}`} disabled={atLimit} onClick={() => partTool(kind)} aria-label={`添加${COMPONENTS[kind].name}`} aria-pressed={tool === kind}>
                <span className="part-illustration"><PartIcon kind={kind} /></span><span className="part-card-copy"><strong>{COMPONENTS[kind].name}</strong><small>{COMPONENTS[kind].description}</small></span><span className="add-mark">{count ? `${count} · +` : '+'}</span>
              </button>;
            })}
          </div>
          <div className="included-source"><span className="tiny-battery">＋ −</span><div><strong>{voltage} V 理想电池</strong><small>电压可调 · 1.5–9 V</small></div></div>
          <div className="battery-settings"><label>常用电压 <select aria-label="电池预设电压" value={voltage} onChange={event=>edit({type:'set-voltage',value:Number(event.target.value)},true)}>{![1.5,3,4.5,6,9].includes(voltage)&&<option value={voltage}>{voltage} V（自定义）</option>}{[1.5,3,4.5,6,9].map(value=><option key={value} value={value}>{value} V</option>)}</select></label><NumberEditor key={`voltage-${voltage}`} label="电池电压" value={voltage} unit="V" min={MIN_SUPPLY_VOLTAGE} max={MAX_SUPPLY_VOLTAGE} onApply={value=>edit({type:'set-voltage',value},true)}/></div>

          <details className="control-section" open>
            <summary>精确放置 <span>孔位操作</span></summary>
            <form onSubmit={submitPlacement} aria-label="精确放置">
              <label htmlFor="part-kind">元件</label><select id="part-kind" value={placeKind} onChange={event => partTool(event.target.value as ComponentKind)}>{COMPONENT_KINDS.map(kind => <option key={kind} value={kind}>{COMPONENTS[kind].name}</option>)}</select>
              <div className="field-pair"><div><label htmlFor="anchor">锚点孔位</label><input id="anchor" value={anchor} onChange={event => setAnchor(event.target.value)} placeholder="例如 a10" autoComplete="off" /></div><div><label htmlFor="rotation">方向</label><select id="rotation" value={rotation} onChange={event => setRotation(Number(event.target.value) as Rotation)}><option value="0">向右 →</option><option value="90">向下 ↓</option><option value="180">向左 ←</option><option value="270">向上 ↑</option></select></div></div>
              <button className="secondary-button full-width" disabled={document.components.length >= MAX_COMPONENTS}>放置元件 <Icon name="arrow" size={15} /></button>
            </form>
          </details>

          <details className="control-section" open>
            <summary>连接导线 <Icon name="wire" size={15} /></summary>
            <form onSubmit={submitWire} aria-label="精确连接导线">
              <label htmlFor="wire-from">导线起点</label><input id="wire-from" value={wireFrom} onChange={event => setWireFrom(event.target.value)} placeholder="battery:+ 或 b10" autoComplete="off" />
              <label htmlFor="wire-to">导线终点</label><input id="wire-to" value={wireTo} onChange={event => setWireTo(event.target.value)} placeholder="例如 d14" autoComplete="off" />
              <div className="field-pair"><div><label htmlFor="wire-color">颜色</label><select id="wire-color" value={wireColor} onChange={event => setWireColor(event.target.value)}>{COLORS.map(([color, label]) => <option key={color} value={color}>{label}</option>)}</select></div><div><label htmlFor="wire-bend">折线路径</label><select id="wire-bend" value={bend} onChange={event => setBend(event.target.value as Wire['bend'])}><option value="horizontal">先横后竖</option><option value="vertical">先竖后横</option></select></div></div>
              <button className="secondary-button full-width" disabled={!wireFrom.trim() || !wireTo.trim()}>添加导线 <Icon name="wire" size={15} /></button>
            </form>
          </details>
          <div className="source-note"><span className="note-label">端点写法</span><code>a1 – j30</code><code>battery:+ / battery:-</code><code>top+:1 / bottom-:1</code></div>
        </aside>

        <section className="workbench-panel" id="workbench" aria-label="电路工作台">
          <div className="workbench-toolbar" role="toolbar" aria-label="电路编辑操作">
            <div className="tool-group" role="group" aria-label="编辑工具">
              <button className={tool === 'inspect' ? 'tool active' : 'tool'} onClick={() => { setTool('inspect'); setWireFrom(''); }} aria-pressed={tool === 'inspect'}><Icon name="eye" /><span>查看连接</span></button>
              <button className={tool === 'wire' ? 'tool active' : 'tool'} onClick={() => { setTool('wire'); setSelected(null); setError(''); }} aria-pressed={tool === 'wire'}><Icon name="wire" /><span>连线</span></button>
            </div>
            <div className="tool-group history-tools" role="group" aria-label="编辑历史">
              <button className="icon-button" aria-label="撤销" title="撤销" disabled={!state.history.past.length} onClick={() => travel('undo')}><Icon name="undo" /></button>
              <button className="icon-button" aria-label="重做" title="重做" disabled={!state.history.future.length} onClick={() => travel('redo')}><Icon name="redo" /></button>
              <span className="toolbar-divider" />
              <button className="icon-button" aria-label="重置工作台" title="重置工作台（可撤销）" onClick={() => { if (edit({ type: 'reset' })) { setSelected(null); setSelectedEndpoint(null); setWireFrom(''); setTool('inspect'); } }}><Icon name="reset" /></button>
            </div>
            <button className="delete-button" title="删除选中对象（Delete / Backspace）" disabled={!selectedPart && !selectedWire} onClick={deleteSelected}><Icon name="trash" size={16} />删除</button>
            <button className={`run-button${running?' stop-button':''}`} aria-describedby="simulation-status" onClick={() => {
              setError('');
              if(running){setPressedButtons([]);dispatch({type:'stop'});}
              else {setTool('inspect');run();}
            }}><Icon name={running?'stop':'play'} size={16} />{running?'停止运行':'运行电路'}</button>
          </div>
          <div id="simulation-status" className={`simulation-status${running?' running':''}`} role="status" aria-label="仿真状态"><span className="status-dot" />{running?'运行中 · 点击开关切换通断，调整参数即时更新。':'已停止 · 可编辑电路，点击“运行电路”开始。'}</div>
          <div className="tool-message"><span className="tool-message-dot" />{toolInstructions[tool]}<span className="zoom-control"><button aria-label="缩小画布" disabled={zoom === 100} onClick={() => setZoom(Math.max(100, zoom - 25))}>−</button><span>{zoom}%</span><button aria-label="放大画布" disabled={zoom === 175} onClick={() => setZoom(Math.min(175, zoom + 25))}>+</button></span></div>
          <div className="canvas-scroll"><div className="canvas-scale" style={{ width: `${zoom}%` }}>
            <Breadboard document={document} connected={connected} selected={selected} selectedEndpoint={selectedEndpoint}
              highlighted={diagnostic?.entities ?? []} wireStart={tool === 'wire' ? wireFrom : ''}
              wiring={tool==='wire'} wireStyle={{color:wireColor,bend}}
              preview={preview} previewValid={previewValid}
              {...(state.analysis?.readings ? {readings: state.analysis.readings} : {})} pressedButtons={pressedButtons}
              onEndpoint={endpointClick} onSelect={chooseItem} onActivate={activatePart} onHover={setHover}
              onWireReconnect={reconnectWire}
              onWireEndSelect={endpoint=>{setWireEnd(endpoint);setWireTarget(selectedWire?.[endpoint]??'');wireTargetRef.current?.focus();}}
              onWireDrag={(from,to)=>{
                setWireFrom('');setWireTo('');
                if(!to){setError('请将导线拖到有效孔位或电池端口，当前未添加导线。');return;}
                addWire(from,to);
              }}
              onMove={(id, at) => {
                const part=document.components.find(item=>item.id===id);
                if (!part || !at) { setError('当前位置没有可安装孔位，元件已保留在原位。'); return; }
                if (at === part.anchor) return;
                if (edit({type:'move',id,anchor:at,rotation:part.rotation})) { setMoveAnchor(at); setTool('inspect'); }
              }} />
          </div></div>
          <div className="canvas-footer"><span><i className="legend-dot" />直接相连的孔位</span><span><i className="legend-dot occupied" />已使用</span><span className="keyboard-tip">Tab 聚焦 · 方向键移动 · Enter 选择</span></div>
          <div className="selection-panel">
            {selectedPart ? <>
              <div className="selection-heading"><strong>{COMPONENTS[selectedPart.kind].name}</strong><span className="mono">{getComponentPins(selectedPart)?.join(' ↔ ')}</span><span className="delete-tip">Delete / 退格键删除</span></div>
              <div className="selection-controls">
                <PartControls key={selectedPart.id} part={selectedPart} {...(state.analysis?.readings?.[selectedPart.id] ? {reading: state.analysis.readings[selectedPart.id]} : {})} pressed={pressedButtons.includes(selectedPart.id)} onConfigure={settings => edit({type:'configure',id:selectedPart.id,settings},true)} onPress={pressed => pressButton(selectedPart.id,pressed)} />
                <label>新锚点 <input aria-label="所选元件新锚点" value={moveAnchor} onChange={event => setMoveAnchor(event.target.value)} /></label>
                <button className="small-button" onClick={() => edit({ type: 'move', id: selectedPart.id, anchor: normalizeEndpoint(moveAnchor), rotation: selectedPart.rotation })}>移动元件</button>
                <button className="small-button" onClick={() => edit({ type: 'move', id: selectedPart.id, anchor: selectedPart.anchor, rotation: ((selectedPart.rotation + 90) % 360) as Rotation })}><Icon name="rotate" size={14} />旋转 90°</button>
                <button className="small-button" onClick={() => { setTool('move'); setRotation(selectedPart.rotation); }}><Icon name="move" size={14} />点选移动</button><span className="drag-tip">也可拖动元件 · Esc 取消</span>
              </div>
            </> : selectedWire ? <>
              <div className="selection-heading"><strong>导线</strong><span className="mono">{selectedWire.from} → {selectedWire.to}</span><span className="delete-tip">拖动两端圆点改接 · Delete 删除</span></div>
              <div className="selection-controls"><label>颜色 <select aria-label="所选导线颜色" value={selectedWire.color} onChange={event => edit({ type: 'update-wire', id: selectedWire.id, color: event.target.value })}>{COLORS.map(([color, label]) => <option key={color} value={color}>{label}</option>)}</select></label><button className="small-button" onClick={() => edit({ type: 'update-wire', id: selectedWire.id, bend: selectedWire.bend === 'horizontal' ? 'vertical' : 'horizontal' })}>切换折线路径</button></div>
              <form className="selection-controls reconnect-form" aria-label="修改导线接点" onSubmit={event=>{event.preventDefault();reconnectWire(selectedWire.id,wireEnd,wireTarget);}}>
                <label>改接端点 <select aria-label="改接端点" value={wireEnd} onChange={event=>{const end=event.target.value as WireEnd;setWireEnd(end);setWireTarget(selectedWire[end]);}}><option value="from">起点</option><option value="to">终点</option></select></label>
                <label>新接点 <input ref={wireTargetRef} aria-label="新接点孔位" value={wireTarget} onChange={event=>setWireTarget(event.target.value)} placeholder="a1 / battery:+" autoComplete="off"/></label>
                <button className="small-button" disabled={!wireTarget.trim()}>修改接点</button>
              </form>
            </> : <form className="connection-inspector" onSubmit={event => {
              event.preventDefault(); const id = normalizeEndpoint(inspectInput);
              if (!ENDPOINT_BY_ID.has(id)) { setError('找不到这个孔位或电池端口，请检查名称。'); return; }
              setTool('inspect'); setSelectedEndpoint(id); setError('');
            }}><div><strong>连接观察器</strong><p aria-live="polite">{selectedEndpoint ? `${selectedEndpoint} 所在网络包含 ${connected.length} 个孔位／端口` : '选择孔位，点亮它所在的导电网络。'}</p></div><label className="sr-only" htmlFor="inspect-hole">查看孔位连接</label><input id="inspect-hole" value={inspectInput} onChange={event => setInspectInput(event.target.value)} /><button className="small-button">查看</button></form>}
          </div>
          {selectedEndpoint && <details className="network-details"><summary>查看相连的孔位／端口</summary><p id="network-members">{connected.join('、')}</p></details>}
          {error && <div className="edit-error" role="alert"><span>!</span>{error}</div>}
          {state.saveStatus.startsWith('未保存') && !state.storageBlocked && <div className="edit-error" role="alert">{state.saveStatus}<button className="small-button" onClick={() => dispatch({ type: 'save', message: save(document) })}>重试保存</button></div>}
        </section>

        <aside className="tutor-panel" aria-label="学习指导">
          {guideKind ? <ComponentGuide key={guideKind} kind={guideKind} {...(selectedPart?{part:selectedPart}:{})}/> : <p className="component-guide-prompt">不认识元件？点击左侧元件盒或板上的元件，查看它的用途和接法。</p>}
          <div className="tutor-heading"><span className="tutor-symbol"><Icon name="bulb" size={21} /></span><div><h2>一起想一想</h2><span>先观察，再找到答案</span></div><span className="reviewed-badge">课程提示</span></div>
          <div className={`result-card ${state.analysis?.complete ? 'success' : ''}`} aria-live="polite">
            {state.analysis?.complete ? <>
              <span className="result-icon success-icon"><Icon name="check" size={24} /></span><span className="eyebrow">CIRCUIT COMPLETE</span><h3>{state.analysis.ledOn ? '亮起来了！' : '蜂鸣器工作了！'}</h3><p>至少一个 LED 或蜂鸣器正常工作，当前没有检测到模型内的电气问题。此结果不代表已匹配某张目标电路图。</p>
            </> : state.analysis ? <>
              <span className="eyebrow">{state.analysis.status === 'unsupported' ? 'MODEL LIMIT' : 'LET’S INVESTIGATE'}</span><h3>{diagnosticCopy?.title ?? '直流电路已求解'}</h3><p>{diagnosticCopy?.description ?? '可选中各元件查看电流；开关、按钮、旋钮和光照在运行后会即时更新结果。'}</p>
            </> : <>
              <div className="empty-circuit-illustration"><span>＋</span><i /><span className="mini-led" /><i /><span>−</span></div><span className="eyebrow">A LITTLE EXPERIMENT</span><h3>电流会走哪条路？</h3><p>放好电阻和 LED，接通电池，再运行电路。遇到问题时，我们一步一步寻找线索。</p>
            </>}
            {state.analysis?.currentMa !== undefined && <div className="current-reading"><span>估算电池总电流</span><strong>{state.analysis.currentMa.toFixed(2)}<small>mA</small></strong></div>}
            {state.analysis && <div className="run-status"><span className={`status-dot ${state.analysis.complete ? '' : 'amber'}`} />{state.analysis.complete ? '电路检测通过' : state.analysis.status === 'unsupported' ? '此接法超出当前仿真范围' : state.analysis.ledOn === undefined ? (state.analysis.currentMa === undefined ? '未计算 LED 状态' : '查看各元件的工作状态') : state.analysis.ledOn ? 'LED 导通 · 请处理提示的问题' : 'LED 未点亮'}</div>}
          </div>
          {!!state.analysis?.diagnostics.length && <div className="diagnostic-list" aria-label="诊断项目">
            {state.analysis.diagnostics.map((item, index) => <button key={`${item.code}-${index}`} className={index === state.diagnosticIndex ? 'active' : ''} onClick={() => dispatch({ type: 'diagnostic', index })}><span>{String(index + 1).padStart(2, '0')}</span>{getDiagnosticCopy(item.code).title}<Icon name="arrow" size={13} /></button>)}
          </div>}
          <div className="sound-control"><button className="small-button" aria-pressed={sound.enabled} onClick={() => { void sound.toggle(); }}>{sound.enabled ? '关闭声音' : '启用蜂鸣器声音'}</button><label className="volume-control">蜂鸣器音量 <input aria-label="蜂鸣器音量" type="range" min="0" max="100" step="1" value={sound.volume} onChange={event=>sound.changeVolume(Number(event.target.value))}/><output>{sound.volume}%</output></label><p>0% 静音；声音还受系统和扬声器音量影响。</p>{sound.error && <p role="status">{sound.error}</p>}</div>
          <div className="hint-section"><div className="hint-section-heading"><h3>给我一点提示</h3><span>{state.hintLevel} / 3</span></div>
            <div className="hint-progress" aria-hidden="true">{[1, 2, 3].map(level => <i key={level} className={state.hintLevel >= level ? 'revealed' : ''} />)}</div>
            {diagnosticCopy && state.hintLevel > 0 ? <ol className="hint-list">{diagnosticCopy.hints.slice(0, state.hintLevel).map((hint, index) => <li key={hint}><span>{['想一想', '看这里', '试着修复'][index]}</span><p>{hint}</p></li>)}</ol> : <p className="hint-placeholder">{state.analysis?.complete ? '试着选中孔位，解释电流经过的路径。' : '先运行电路。每次只揭开一个线索，把发现留给你。'}</p>}
            <button className="hint-button" disabled={!diagnosticCopy || state.hintLevel === 3} onClick={() => dispatch({ type: 'hint' })}><Icon name="bulb" size={17} />{state.hintLevel === 3 ? '全部线索已揭开' : state.hintLevel ? '再给我一个线索' : '揭开第一个线索'}<Icon name="arrow" size={15} /></button>
            {diagnostic && <p className="evidence-caption">检查对象：{diagnostic.entities.length ? diagnostic.entities.map(id => ENDPOINT_BY_ID.has(id) ? id : document.components.find(part => part.id === id) ? COMPONENTS[document.components.find(part => part.id === id)!.kind].name : document.wires.some(wire => wire.id === id) ? '导线' : id).join(' · ') : '整个回路'}</p>}
          </div>
          <div className="breadboard-tip"><span className="note-label">面包板小知识</span><h3>看起来靠近，不一定相连。</h3><p>同一编号的 a–e 孔内部相连，f–j 是另一组。中央沟槽两侧、电源轨与中间孔位，都需要导线连接。</p><button onClick={() => { setTool('inspect'); setSelected(null); setSelectedEndpoint('a1'); setInspectInput('a1'); }}>查看 a1 的连接 <Icon name="arrow" size={14} /></button></div>
        </aside>
      </div>
      <footer className="app-footer"><span>小小连接，大大发现。</span><details><summary>关于本课程的仿真模型</summary><p>教学近似：理想电池可调 1.5–9 V，默认 4.5 V；红色 LED 固定压降 2.0 V，相对亮度按每颗 LED 的电流示意，不是真实光度。支持最多 24 个元件、120 根导线，LED／二极管／蜂鸣器合计最多 6 个；二极管压降 0.7 V，蜂鸣器采用 1 kΩ 有极性负载及 3–5 V 发声范围。20 mA 是每颗 LED 的课程限制，超限时亮度封顶并提示。电位器为理想分压电阻；光照仅为模拟百分比。忽略电源内阻、容差、发热、击穿和损坏；数值不用于预测真实器件安全性。提示为预设课程内容，未接入生成式 AI。作品只保存在此浏览器；多标签编辑采用最后保存的内容。</p></details><span className="version-label">LEARN BY MAKING / V0.3</span></footer>
    </main>
  </>;
}
