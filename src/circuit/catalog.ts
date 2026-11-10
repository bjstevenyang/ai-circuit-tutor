import type { ComponentInstance, ComponentKind, ModelProfileId } from './types';
import { DEFAULT_CAPACITANCE_F } from './parameters';

type Definition = { name: string; description: string; offsets: readonly (readonly [number, number])[]; pinNames: readonly string[]; body: readonly [number, number, number, number] };
const capacitorDefaults:Record<ModelProfileId,number> = {
  'legacy-stage2-v1':DEFAULT_CAPACITANCE_F,
  'oscillator-em-v1':DEFAULT_CAPACITANCE_F,
  'oscillator-em-v2':DEFAULT_CAPACITANCE_F,
};
export const COMPONENT_KINDS: readonly ComponentKind[] = ['resistor', 'led', 'switch', 'button', 'potentiometer', 'buzzer', 'diode', 'ldr', 'rgb-led', 'npn', 'capacitor', 'piezo-passive', 'pnp', 'speaker'];
export const COMPONENTS: Record<ComponentKind, Definition> = {
  resistor: { name: '电阻', description: '默认 330 Ω · 可调整', offsets: [[0,0],[60,0]], pinNames: ['1','2'], body: [30,0,38,16] },
  led: { name: '红色 LED', description: 'A 阳极 / K 阴极', offsets: [[0,0],[20,0]], pinNames: ['A','K'], body: [10,0,20,20] },
  switch: { name: '通断开关', description: '两脚 · 保持开 / 关', offsets: [[0,0],[40,0]], pinNames: ['1','2'], body: [20,0,28,18] },
  button: { name: '常开按钮', description: '四脚 · 按住接通', offsets: [[0,0],[20,0],[0,60],[20,60]], pinNames: ['1','2','3','4'], body: [10,30,34,42] },
  potentiometer: { name: '电位器', description: '10 kΩ · A / W / B', offsets: [[0,0],[20,0],[40,0]], pinNames: ['A','W','B'], body: [20,-10,34,24] },
  buzzer: { name: '有源蜂鸣器', description: '3–5 V 教学模型 · 有极性', offsets: [[0,0],[40,0]], pinNames: ['+','−'], body: [20,0,28,28] },
  diode: { name: '二极管', description: 'A / K · 0.7 V 近似', offsets: [[0,0],[40,0]], pinNames: ['A','K'], body: [20,0,22,12] },
  ldr: { name: '光敏电阻', description: '调节模拟光照', offsets: [[0,0],[40,0]], pinNames: ['1','2'], body: [20,0,24,24] },
  'rgb-led': { name:'RGB LED', description:'共阴 · R / K / G / B',offsets:[[0,0],[20,0],[40,0],[60,0]],pinNames:['R','K','G','B'],body:[30,-10,66,24]},
  npn: { name:'NPN 晶体管',description:'低侧开关 · B / C / E',offsets:[[0,0],[20,0],[40,0]],pinNames:['B','C','E'],body:[20,-10,34,24]},
  capacitor: { name:'电容',description:'无极性 · 默认 100 nF',offsets:[[0,0],[40,0]],pinNames:['1','2'],body:[20,0,28,22]},
  'piezo-passive': { name:'无源压电',description:'需要变化信号 · 无极性',offsets:[[0,0],[40,0]],pinNames:['1','2'],body:[20,0,28,28]},
  pnp: { name:'PNP 晶体管',description:'自激发声虚拟模型 · B / C / E',offsets:[[0,0],[20,0],[40,0]],pinNames:['B','C','E'],body:[20,-10,34,24]},
  speaker: { name:'无源扬声器',description:'虚拟 8 Ω 负载 · 无极性',offsets:[[0,0],[40,0]],pinNames:['1','2'],body:[20,0,28,28]},
};
export function createComponent(kind: ComponentKind, anchor: string, rotation: ComponentInstance['rotation'], id: string, profile: ModelProfileId = 'legacy-stage2-v1'): ComponentInstance {
  return { id, kind, anchor, rotation,
    ...(kind === 'resistor' ? { resistance: 330 } : {}),
    ...(kind === 'potentiometer' ? { resistance: 10000, position: 50 } : {}),
    ...(kind === 'switch' ? { closed: false } : {}),
    ...(kind === 'ldr' ? { light: 50 } : {}),
    ...(kind === 'capacitor' ? { capacitanceF: capacitorDefaults[profile] } : {}),
  };
}
export function rotateOffset(x: number, y: number, rotation: ComponentInstance['rotation']): [number, number] {
  switch (rotation) { case 0: return [x,y]; case 90: return [-y,x]; case 180: return [-x,-y]; case 270: return [y,-x]; }
}
export function resistanceOf(part: ComponentInstance): number {
  if (part.kind === 'ldr') return 100000 * 10 ** (-3 * (part.light ?? 50) / 100);
  return part.resistance ?? (part.kind === 'potentiometer' ? 10000 : 330);
}
