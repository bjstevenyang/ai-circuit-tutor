import type {AnalysisResult,CircuitDocument} from '../circuit';
import {COMPONENTS} from '../circuit';
const number=(v:number)=>Number(v.toPrecision(7)).toString();
export function StageReadings({result,document}:{result:AnalysisResult;document:CircuitDocument}){
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
