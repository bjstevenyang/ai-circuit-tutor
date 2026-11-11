import type {AnalysisResult,CircuitDocument} from '../circuit';
import {COMPONENTS} from '../circuit';
const number=(v:number)=>Number(v.toPrecision(7)).toString();
export function StageReadings({result,document}:{result:AnalysisResult;document:CircuitDocument}){
  if(result.mode==='oscillator'){
    const oscillator=result.oscillator;
    return <div className="stage-readings" aria-live="off" aria-label="实验读数">
      {oscillator&&<p data-testid="simulation-time">{oscillator.readings?'观察窗：0–40 ms · 模拟时刻':'最后接受时刻（诊断证据）'}：{number(oscillator.timeS*1000)} ms</p>}
      {oscillator?.speaker&&<p>扬声器端口：{oscillator.speaker.bypassed?'被旁路 · 端压0 V':`${number(oscillator.speaker.voltageV)} V`}{oscillator.speaker.frequencyHz===undefined?'':` · 稳定频率 ${number(oscillator.speaker.frequencyHz)} Hz · 交流RMS ${number(oscillator.speaker.acRmsV)} V`}</p>}
      {Object.entries(oscillator?.readings??{}).map(([id,r])=><div key={id} data-part-reading={id}><strong>{COMPONENTS[document.components.find(p=>p.id===id)!.kind].name}</strong>
        {r.voltageV!==undefined&&<p>端压 {number(r.voltageV)} V{r.currentMa===undefined?'':` · 有符号电流 ${number(r.currentMa)} mA`}</p>}
        {r.baseCurrentMa!==undefined&&<p>流入端口：B {number(r.baseCurrentMa)} mA · C {number(r.collectorCurrentMa!)} mA · E {number(r.emitterCurrentMa!)} mA；{document.transistorDynamics?'标准SPICE端口电流。':'包含EM传导和结电容位移电流。'}</p>}
      </div>)}
      {oscillator?.outcome==='periodic'&&<p>声音按已计算稳定周期作正弦示意；不是持续实时仿真或真实器件音色。</p>}
    </div>;
  }
  return <div className="stage-readings" aria-live="off" aria-label="实验读数">
    {result.timeS!==undefined&&<p data-testid="simulation-time">模拟时间：{result.timeS.toFixed(3)} s</p>}
    {Object.entries(result.readings??{}).filter(([id])=>['rgb-led','npn','capacitor','piezo-passive'].includes(document.components.find(p=>p.id===id)?.kind??'')).map(([id,r])=><div key={id} data-part-reading={id}>
      <strong>{COMPONENTS[document.components.find(p=>p.id===id)!.kind].name}</strong>
      {r.channels&&<p>{(['R','G','B'] as const).map(ch=>`${ch} ${number(r.channels![ch].currentMa)} mA ${r.channels![ch].on?'导通':'截止'}`).join(' · ')}；混色 {r.rgb?.join(', ')}</p>}
      {r.region&&<p>{({cutoff:'截止',controlled:'受控导通',saturated:'饱和'} as const)[r.region]}；Ib {number(r.baseCurrentMa!)} mA · Ic {number(r.collectorCurrentMa!)} mA · Ie {number(r.emitterCurrentMa!)} mA · VCE {number(r.vceV!)} V</p>}
      {r.capacitorState&&<p>Vc {number(r.voltageV!)} V · Ic {number(r.currentMa!)} mA · {r.capacitorState}；脚{r.referencePin}接参考负端，正电流流入另一脚</p>}
      {r.driveState&&<p>{r.driveState}{r.vppV===undefined?'':` · Vpp ${number(r.vppV)} V`}{r.frequencyHz?' · 周期稳态教学近似，忽略起始瞬态和机械谐振':''}</p>}
    </div>)}
  </div>;
}
