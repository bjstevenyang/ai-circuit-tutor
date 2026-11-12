import type { AnalysisResult, CircuitDocument, Diagnostic } from '../circuit';
import { getComponentPins } from '../circuit';
import type { OscillatorResult } from '../circuit/oscillator/types';

export const OSCILLATOR_TITLES:Record<OscillatorResult['outcome'],string>={periodic:'检测到稳定周期','settled-DC':'观察窗内已近直流','window-no-period':'观察窗内未见稳定周期','unsupported-topology':'当前接法超出模型范围','unsupported-model-domain':'超出虚拟模型计算域','unsupported-model-version':'旧版虚拟模型需显式切换v2','numerical-failure':'数值计算未完成','resource-limit':'计算达到资源限制'};
export const calculatingResult=():AnalysisResult=>({status:'supported',mode:'oscillator',complete:false,timeS:0,diagnostics:[],notes:['计算中：从零初态求解0–40 ms；完成全部分析前不发声。']});
export function presentOscillator(result:OscillatorResult,document:CircuitDocument):AnalysisResult {
  const success=['periodic','settled-DC','window-no-period'].includes(result.outcome);
  const pins=result.entities.flatMap(id=>{const part=document.components.find(p=>p.id===id);return part?getComponentPins(part)??[]:[];});
  const diagnostic:Diagnostic={code:result.reason.startsWith('理想电源正负端被直接短接')?'source-short':'unsupported',entities:[...result.entities,...pins],reason:result.reason,timeS:result.timeS,context:'oscillator'};
  return {status:success?'supported':'unsupported',mode:'oscillator',complete:false,timeS:result.timeS,oscillator:result,diagnostics:result.outcome==='periodic'?[]:[diagnostic],notes:[document.transistorDynamics?'标准SPICE器件卡，固定27°C；8Ω纯电阻负载近似，不能判断真实器件安全。观察窗0–40ms；参数改变从初态重算。':'虚拟开关模型，不能判断真实器件安全。观察窗0–40 ms；参数/控制改变会从初态重算。'],...(success?{readings:result.readings??{},...(result.currentMa===undefined?{}:{currentMa:result.currentMa})}:{})};
}
