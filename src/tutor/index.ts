import type { DiagnosticCode } from '../circuit';

export type DiagnosticCopy = {
  readonly title: string;
  readonly description: string;
  readonly hints: readonly [string, string, string];
};

const COPY: Record<DiagnosticCode, DiagnosticCopy> = {
  'source-short': {
    title: '电池两极直接相连了',
    description: '正负极落在同一个导电网络中。这个理想电源短路没有可用的有限电流估算。',
    hints: [
      '电流需要经过负载。只经过导线的回路无法起到限流作用。',
      '观察电池正负极的连接高亮：它们是否经过面包板内部导体或导线连到了一起？',
      '移除直接连通电池两极的导线，让从正极到负极的路径依次经过电阻和 LED。',
    ],
  },
  'missing-resistor': {
    title: 'LED 还需要限流电阻',
    description: '当前没有有效的串联限流电阻，不能据此给出安全的 LED 电流估算。',
    hints: [
      'LED 的正向压降不会自动限制电流，回路需要一个限流元件。',
      '沿着电池到 LED 的路径观察，电流是否必须经过一个电阻？',
      '在电池与 LED 的串联路径中放入电阻，并将导线接到电阻两端所在的不同导电组。',
    ],
  },
  'resistor-bypassed': {
    title: '电流绕过了电阻',
    description: '电阻的两端落在同一导电网络中，因此它没有起到串联限流的作用。',
    hints: [
      '元件两端之间需要存在电压差，才能在回路中发挥作用。',
      '观察电阻的两只引脚：它们是否插在同一五孔组，或被导线直接连在一起？',
      '将电阻两端分开到不同的导电组，并移除跨接其两端的旁路线，使电流必须经过电阻。',
    ],
  },
  'led-bypassed': {
    title: 'LED 的两端被连在一起了',
    description: 'LED 两只引脚属于同一导电网络，电流可以绕过 LED。',
    hints: [
      '看起来是两个不同的孔，也可能在面包板内部相连。',
      '选中 LED 两个引脚所在的孔，比较它们的连接高亮是否相同。',
      '把 LED 两只引脚放在彼此不直接相连的导电组，并移除跨接 LED 两端的旁路线。',
    ],
  },
  'open-circuit': {
    title: '回路还没有闭合',
    description: '当前连接尚未形成受支持的完整串联回路。需要继续检查元件两端与电池的连接。',
    hints: [
      '电流需要一条从电池正极经过元件、再回到负极的完整路径。',
      '沿着已有导线逐段观察；中央沟槽两侧和电源轨与中间孔位不会自动相连。',
      '补上断开的连接，让正极、电阻、LED 和负极构成连续的单一串联回路；电阻可在 LED 任一侧。',
    ],
  },
  'reversed-led': {
    title: 'LED 的方向反了',
    description: '回路结构已识别，但 LED 方向与电源方向相反；在本模型中它不导通。',
    hints: [
      'LED 有方向性，电流只在规定的正向条件下通过。',
      '查看 LED 的 A（阳极）和 K（阴极），比较它们与电池正负极的关系。',
      '交换 LED 两只引脚的连接方向，让 A 朝向电池正极、K 朝向负极，并保留串联限流电阻。',
    ],
  },
  overcurrent: {
    title: '电流超过了课程限制',
    description: '当前估算电流超过 20 mA。这个阈值是本课程的工作限制，不是所有 LED 的统一损坏阈值。',
    hints: [
      '在电源和 LED 压降固定时，串联电阻越大，回路电流越小。',
      '查看所选电阻的阻值，并比较估算电流与课程的 20 mA 限制。',
      '选中电阻，把 100 Ω 改为 330 Ω 或 1,000 Ω，再重新运行电路。',
    ],
  },
  unsupported: {
    title: '此接法超出当前模型范围',
    description: '本课程只对一个电阻和一个 LED 的受支持串联回路进行数值仿真，不会猜测其他接法的电流。',
    hints: [
      '仿真模型有适用范围，超出范围不代表真实电路必然不能工作。',
      '检查元件数量和连接分支，当前课程的目标是一个电阻与一个 LED 串联。',
      '将电路简化为单电池、单电阻和单 LED 的串联回路，移除额外负载或分支后重新运行。',
    ],
  },
  'missing-led': {
    title: '还没有找到 LED',
    description: '本课程需要一颗红色 LED。先完成元件放置，再检查电路连接。',
    hints: [
      '本次实验通过 LED 的导通状态来观察电路是否按预期工作。',
      '检查元件盒和工作台，LED 是否已经放在面包板上？',
      '从元件盒选择红色 LED，将两个引脚放到不同导电组，再把它串联到含电阻的回路中。',
    ],
  },
};

export function getDiagnosticCopy(code: DiagnosticCode): DiagnosticCopy {
  return COPY[code];
}

/** Call only in response to an explicit student request. */
export function nextHintLevel(current: number): number {
  const normalized = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
  return Math.min(3, normalized + 1);
}
