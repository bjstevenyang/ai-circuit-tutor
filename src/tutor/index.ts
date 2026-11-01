import type { DiagnosticCode } from '../circuit';

export type DiagnosticCopy = {
  readonly title: string;
  readonly description: string;
  readonly hints: readonly [string, string, string];
};

const COPY: Record<DiagnosticCode, DiagnosticCopy> = {
  'control-open': {
    title: '开关或按钮当前未接通',
    description: '控制元件断开时没有电流，这是正常的运行状态，不一定是接线错误。',
    hints: ['开关决定回路是否接通，常开按钮只有按住时才接通。','查看被指出的开关状态或按钮；四脚按钮的 1、2 内部相连，3、4 内部相连。','选中开关点击接通，或选中按钮按住接通；已经运行的电路会即时更新。'],
  },
  'insufficient-voltage': {
    title: '电源电压不足以让这条路径导通',
    description: '串联 LED 和二极管的模型压降之和达到或超过了 4.5 V，不能获得正向电流。',
    hints: ['串联器件会分担电源电压；每颗红色 LED 在模型中需要约 2 V。','检查同一串联路径上的 LED 与二极管数量。','减少串联的 LED 或二极管；并联 LED 应为每条支路配置限流电阻。'],
  },
  'reversed-diode': {
    title: '二极管正在反向阻断',
    description: '二极管的 A→K 方向与当前供电方向相反；本模型忽略反向击穿。',
    hints: ['二极管只允许一个方向的正向电流。','比较 A、K 引脚与供电方向，带条纹的一端是 K。','若题目要求这条支路导通，请调整二极管引脚连接，让 A 朝向更高电势。'],
  },
  'buzzer-reversed': {
    title: '蜂鸣器供电方向反了',
    description: '本课程使用有极性有源蜂鸣器，反接不发声。',
    hints: ['有源蜂鸣器需要正确方向的直流供电。','检查蜂鸣器标记 + 的引脚是否朝向电池正极。','交换蜂鸣器两端的供电方向，再检查其工作状态。'],
  },
  'buzzer-undervoltage': {
    title: '蜂鸣器电压没有达到工作范围',
    description: '本教学蜂鸣器的发声范围为 3–5 V；当前虽有电流，但端电压不足。',
    hints: ['有电流不代表器件已经获得足够工作电压。','检查串联电阻、其他负载及电位器是否分走过多电压。','调整供电路径，使蜂鸣器正向端电压达到 3–5 V；不要把单颗 LED 的限流规则直接套到蜂鸣器上。'],
  },
  'source-short': {
    title: '电池两极直接相连了',
    description: '正负极落在同一个导电网络中。这个理想电源短路没有可用的有限电流估算。',
    hints: [
      '电流需要经过负载。只经过导线的回路无法起到限流作用。',
      '观察电池正负极的连接高亮：它们是否经过面包板内部导体或导线连到了一起？',
      '移除或调整直接跨接电池两极的导线／触点，让电流经过你准备供电的负载。',
    ],
  },
  'missing-resistor': {
    title: '这条路径缺少限流电阻',
    description: 'LED 或二极管构成了缺少限流电阻的正向电源路径，模型无法给出有限电流。',
    hints: [
      'LED 和二极管的固定正向压降不会自动限制电流。',
      '沿着指出的正向支路观察，电流是否必须经过非零电阻？',
      '在这条支路串入电阻，并移除绕过它的导线；多条 LED 支路分别配置限流电阻。',
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
    description: '当前连接没有形成可识别的完整供电路径。需要继续检查元件两端与电池的连接。',
    hints: [
      '电流需要一条从电池正极经过元件、再回到负极的完整路径。',
      '沿着已有导线逐段观察；中央沟槽两侧和电源轨与中间孔位不会自动相连。',
      '从电池正极沿目标支路逐段补上断开的连接，经过负载回到负极；LED 支路保留串联限流电阻。',
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
    description: '被指出的 LED 估算电流超过 20 mA。这个阈值是本课程的工作限制，不是所有 LED 的统一损坏阈值，也不是电池总电流限制。',
    hints: [
      '在电源和 LED 压降固定时，串联电阻越大，回路电流越小。',
      '查看被指出 LED 所在支路的限流元件；旋钮和模拟光照也可能改变支路电阻。',
      '增大该支路的串联电阻，例如把 100 Ω 改为 330 Ω；若由光敏电阻或电位器限流，调整其设置或另串限流电阻，再检查这颗 LED 的电流。',
    ],
  },
  unsupported: {
    title: '此接法超出当前模型范围',
    description: '当前仅支持有明确直流工作点的小型电路；最多 24 个元件、120 根导线，有极性负载合计最多 6 个。不确定的电流分配不会被猜测。',
    hints: [
      '仿真模型有适用范围，超出范围不代表真实电路必然不能工作。',
      '检查规模限制，以及是否将理想 LED 或二极管直接并联、导致各支路电流无法确定。',
      '先减少元件，每个 LED 支路使用独立限流电阻，再逐条添加连接重新运行。',
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
