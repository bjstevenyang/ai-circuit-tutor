import { COMPONENTS, getComponentPins } from '../circuit';
import type { ComponentInstance, ComponentKind } from '../circuit';
import { COMPONENT_GUIDES } from './components';

export function ComponentGuide({ kind, part }: { kind: ComponentKind; part?: ComponentInstance }) {
  const definition = COMPONENTS[kind];
  const copy = COMPONENT_GUIDES[kind];
  const holes = part ? getComponentPins(part) : null;
  return <section className="component-guide" aria-label={`${definition.name}使用说明`}>
    <div className="component-guide-heading"><span>认识元件</span><h2>{definition.name}</h2></div>
    <p className="component-about">{copy.about}</p>
    <h3>引脚怎么认</h3>
    <dl className="component-pin-list">
      {definition.pinNames.map((name, index) => <div key={name}>
        <dt>{name}{holes && <code>{holes[index]}</code>}</dt>
        <dd>{copy.pins[index]}</dd>
      </div>)}
    </dl>
    <h3>怎么接入电路</h3>
    <p>{copy.connection}</p>
    <div className="component-example"><span>示例接法</span><pre aria-label="示例连接路径">{copy.example}</pre></div>
    <p className="component-try"><strong>试一试</strong>{copy.tryIt}</p>
    <details>
      <summary>常见错误与模型说明</summary>
      <p>{copy.commonMistake}</p>
      <p className="component-model-note">{copy.modelNote}</p>
    </details>
    <p className="component-guide-note">{holes ? '孔位对应当前元件方向；接线请使用同组的其他空孔。' : '这是通用用法说明。放置后，可点击板上元件查看实际引脚孔位。'}</p>
  </section>;
}
