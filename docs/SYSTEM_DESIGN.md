# AI Circuit Tutor：系统设计

更新：2026-11-01，v0.3。需求见 [PRD](PRD.md)，数值约定见 [CIRCUIT_MODEL](CIRCUIT_MODEL.md)。

## 模块与依赖

React、TypeScript strict、Vite、SVG 单包静态前端，无后端及新增依赖。

| 模块 | 职责与入口 |
| --- | --- |
| circuit/types、catalog、board | 文档类型、器件默认值／安装定义、稳定孔位、引脚与本体推导 |
| circuit/network | 板／导线／闭合触点的网络合并；inspectConnectivity |
| circuit/validation | readCircuitDocument 运行时结构校验和 v1／v2 → v3 规范化 |
| circuit/solver、analysis | 有界直流求解、支持范围判断、逐元件读数、结构化诊断；analyzeCircuit |
| editor/model | 物理校验、applyEdit 原子命令、最多 50 份文档历史 |
| editor/Breadboard、PartShape、PartControls、drag | SVG、器件图形、控制面板、拖动及吸附 |
| tutor | 诊断与三级提示；components.ts 的静态元件教学内容及 ComponentGuide 说明视图 |
| storage | 加载、物理／引用校验、保存和错误反馈 |
| app | 组合、运行／重新求解、提示进度、选择和声音生命周期 |

circuit 保持纯 TypeScript，独立于 React、DOM、SVG、浏览器存储和音频。求解层处理网络支路，不读取渲染坐标；坐标只在安装定义中决定引脚落孔。板定义和器件目录同时用于显示和校验。

## 权威状态

CircuitDocument 包含 schemaVersion、boardId、lessonId、元件、导线。当前写入版本为 3，并保存 supplyVoltage；元件保存 ID、kind、anchor、rotation 及适用的 resistance／closed／position／light；引脚由安装定义推导。导线保存 ID、显式 from/to、颜色和折线路径。

AnalysisResult 为派生状态：status、可用的电池总电流、逐实例 readings、诊断及 complete。保留聚合 ledOn 供摘要使用，绘图必须读取逐实例状态。无法计算时省略数值。理想开关／按钮已合并成网络，不伪造其独立电流。

文档以外的按压状态由 SimulationControls.pressedButtons 传给分析及连接观察器，默认全部释放。选择、预览、焦点、缩放、声音许可、网络、结果、提示和历史均不持久化。按钮释放不产生历史。

## 操作与失效

1. 放置、配置、移动、删除或接线产生纯命令。applyEdit 校验完整候选文档，成功后提交；失败保留旧状态和输入。
2. 文档变化提交历史并尝试保存；无变化不新增历史。参数滑块每次数值变化形成一次可撤销配置。
3. 拓扑编辑、导线外观编辑、重置、撤销／重做清除分析和提示，释放按钮。首轮必须点击“运行”。
4. 运行中应用阻值／电池电压、切换开关、旋钮或光照会对新文档重新求解；按钮按下／释放以临时 controls 重新求解。每次求解重置提示进度，避免引用旧证据。
5. 诊断按固定优先级显示；用户每次请求一层提示，修复仍由学生执行。

删除按钮与 Delete／Backspace 共用命令。文本框、下拉框、可编辑区域、组合输入及修饰键操作不删除选中对象。删元件只释放其插孔，孔位上的导线保持不动。

## 运行与停止

当前为按事件求解的直流模型，没有持续计时循环。`analysis !== null` 表示运行会话有效，包括正常、故障和不支持结果；不新增重复的 running 状态。运行按钮显示“停止运行”，再次激活派发 stop：清空分析、诊断选择和提示进度，释放 pressedButtons。分析消失后 LED 回到未计算外观，声音 hook 的 active 变为 false 并清理振荡器。作品、保存状态、历史、选择、保持开关位置及音量／声音许可保留。

停止时参数编辑只保存作品、不求解；板上开关激活只选择。重新运行用当前文档及已释放的按钮重新分析；若用户本会话已允许声音且蜂鸣器工作，会恢复声音。刷新不恢复运行状态。拓扑编辑或撤销使分析失效时，同样显示“已停止”。运行／停止都不写入 CircuitDocument 或追加撤销记录。

## 拖动

Breadboard 使用 Pointer Events 与指针捕获，从 getScreenCTM 的逆矩阵把屏幕位置转换为 SVG 坐标，保留初始抓取偏移，兼容缩放和画布滚动。移动超过 4 屏幕像素才开始拖动，避免普通点击误移动。

拖动预览是局部临时状态；用与表单相同的 applyEdit 校验候选锚点。吸附只允许中央安装孔，不跨沟槽吸向远孔；非法位置明确提示。松手至多提交一个 move；Esc／pointercancel／丢失捕获取消，越界／占用保留原位。导线端点始终绑定原孔位，不跟随元件。

连线模式复用指针捕获和坐标转换，支持从孔位／电池端口拖到终点。终点吸附包含电源轨及电池，松手才调用 wire 命令；同一端点、占用、无效落点不提交。拖动后抑制合成 click，避免误开另一根线；普通点击仍保留点选两端方式。

已有导线选中后在孔位命中层之上显示两端手柄，避免被孔位点击截获。改接复用指针捕获、吸附和预览，提交独立 reconnect-wire 命令，仅替换一个端点。完整候选文档校验自然保留另一端占用、释放旧孔位，并拒绝组件／其他导线占用。预览沿用原线的折线方向；颜色与 ID 不变。键盘可激活端点手柄，聚焦下方改接表单。

改接到原孔位属于无变化，不保存、不增加历史、不使结果失效。合法改接提交一次历史、自动保存并清除旧分析；取消／失败保留原连接和结果。

拖动过程中只更新预览，不求解、不保存、不追加历史。表单和点选操作保留为键盘及精确操作路径。

## 数值边界

先构建网络，再为电阻、LED、二极管、蜂鸣器及电位器两段构建支路；闭合开关／按钮和电位器零阻端合并节点。先阻断电源短路和理想零阻正向路径，再进行有界直流分析。

求解器采用小矩阵节点分析，枚举至多 6 个单向器件的导通状态。每个候选检查电流方向和截止条件；多个有效状态出现不同电流时返回不支持，不任意分配并联理想 LED 的电流。近似、容差和参考算例见电路模型。

## 存储与失败

继续使用 localStorage 的 `ai-circuit-tutor.workspace.v1` 键，以找到旧作品；键名不是文档格式版本。v1 的 led-series-v1 以及 v2 的 dc-lab-v2 文档在内存中规范化为 schemaVersion 3／dc-lab-v2；旧格式按原有 4.5 V 恢复，忽略旧格式里未定义的 supplyVoltage 字段；保留原 ID、位置、参数与导线，下一次成功保存才写入新版。加载本身不改写存储。

加载先校验结构、版本和引用，再校验完整物理约束。损坏／未知版本暂停自动保存；学生明确选择后才可用当前作品替换。写入失败保留内存作品，显示未保存及重试。没有跨标签合并或备份，最后成功写入者覆盖。

## 声音与可访问性

蜂鸣器始终有文字／图形状态。主动启用后才在用户手势内创建并恢复 AudioContext；工作时播放 2 kHz 方波。会话内音量默认 50%，范围 0–100%，对应增益 0–0.25（默认 0.125，旧版为 0.025）；0% 静音。滑块调节通过 AudioParam.setTargetAtTime 在 15 ms 时间常数下平滑趋近目标，不重启振荡器。停止工作、结果失效、关闭声音或卸载时清理振荡器；不可用时保留视觉反馈。不会联网；声音开关和音量不保存、不进入电路历史，不代表真实器件声压。实际响度还受系统设置和输出设备影响。

SVG 孔位支持方向键与 Enter；按钮支持 Space／Enter 按住、松开与失焦释放。关键操作有表单与可见按钮，不依赖拖动或颜色。真实读屏、200% 缩放和学生理解仍需人工验证。未来 AI 接入须另行设计，不能覆盖确定性电气结论。


## 元件说明与教学内容

App 根据所选实例或当前放置工具派生说明器件类型；不另存一份元件选择，也不写入 CircuitDocument。点击元件盒、精确放置下拉选择及板上实例共用同一说明入口。无元件上下文时显示使用入口提示。

`tutor/components.ts` 按 ComponentKind 声明八类教学内容：用途、逐脚含义、接入方法、通用示例、操作练习、常见错误、模型近似。`ComponentGuide` 在右侧以独立区域展示；引脚名称读取器件目录，实际孔位调用 getComponentPins 推导，避免复制旋转／安装规则。常见错误和模型说明可展开，切换类型时重置该展开区域。

静态说明不消费分析结果，不请求 AI、不联网、不修改历史、存储、运行结果或提示层级；运行中开关本体点击会修改通断参数；黄色按钮的圆钮按压或本体按住 Enter／Space 会临时重新求解；这些都是电路控制操作，纯查阅可使用元件盒或按钮灰色外壳；现有诊断／提示仍同时可用。通用接法示例与当前电路的证据诊断分开。教学参数以 CIRCUIT_MODEL 为准，真实器件原理不能被简化参数取代。

内容核对参考：[SparkFun 电阻与 LED 入门](https://learn.sparkfun.com/tutorials/tinker-kit-circuit-guide/circuit-1-blink-an-led)、[按钮与开关](https://learn.sparkfun.com/tutorials/button-and-switch-basics)、[电位器与分压](https://learn.sparkfun.com/tutorials/voltage-dividers)、[二极管](https://learn.sparkfun.com/tutorials/diodes)、[Adafruit 光敏电阻](https://learn.adafruit.com/photocells/overview)。这些资料支持基础概念；本应用的四脚排列、蜂鸣器负载／阈值、旋钮方向和模拟光照范围仍是自己的教学约定。资料链接仅供文档查阅，应用运行不请求这些站点。


## 参数应用、LED 呈现与开关激活

`circuit/parameters.ts` 统一默认电压、有效范围和有限数值判定，供文档解析、编辑校验及分析使用。`set-voltage` 命令修改权威文档，求解器和全部可见电压标签读取同一字段。`NumberEditor` 保留局部文本草稿，完整合法后才调用编辑命令；空白、无穷大、非数字、十六进制及越界值保留供修正。支持十进制小数和科学计数法。预设仍可直接使用，自定义值作为当前选项展示。无变化应用不保存、不清除结果、不增加历史。

`editor/ledAppearance.ts` 从单颗 LED 的已求解支路电流推导显示 level：未求解为 null、截止为 0、导通为 min(I/20 mA,1)。PartShape 仅负责将 level 映射为颜色／光晕，显示不是求解依据。该值不保存，也不新增电气物理模型。超流时显示封顶，原诊断和电流保留。

A＋／K− 标记从实际引脚坐标绘制，放在旋转图形外以保持文字正向；K 侧使用平边与方形脚标记，A 为圆形脚标记。预览、选中信息和读屏说明共用 getComponentPins；未求解明确显示未计算。符号描述器件身份，不赋予孔位电压。

开关区分选择和激活：指针按下仅选择并捕获；普通 click 或 Enter／Space 激活，运行中才提交一次 configure 并重新求解。拖动达到阈值后抑制后续 click，取消或移动不改变通断；忽略重复 keydown。未运行或停止时本体激活只选择。下方开关按钮仍可配置状态，通断持续使用既有历史和自动保存；aria-pressed 与文字描述表达闭合状态。

音频实现参考 [MDN GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) 和 [AudioParam.setTargetAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime)。音频幅度验证与人耳实际听感是不同检查，不能用 API 通过代替设备试听。


## 黄色按钮本体按压

原先 SVG 本体只选择／拖动元件，未调用按压回调；绿色开关的 click 测试没有覆盖黄色按钮。新增的本体指针按下浏览器测试在修复前失败、修复后通过。

Breadboard 接收 running 与 onButtonPress，直接复用 App 的 pressButton 和既有 SimulationControls，不改变电气模型。黄色圆钮通过 data-button-cap 定义操作区域；运行时按住圆钮捕获指针并提交临时按压，松手（包括在圆钮外松手）释放。灰色外壳维持拖动路径，运行中按圆钮不会启动拖动；停止时可选中或拖动。按压图形与 aria-pressed 读取相同临时状态。

局部 heldButton 仅记录当前指针或键盘手势。Enter／Space 按下接通、匹配的按键释放断开，忽略重复；失焦、Esc、pointercancel 和 lostpointercapture 释放。停止、编辑或窗口失焦清除父状态时同步丢弃局部手势，避免下一次按压被旧状态阻塞。按压不写入作品或历史，释放不锁定为保持开关。下方控件继续作为替代操作路径。
