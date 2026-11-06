# 阶段 2 实施确认与验收证据

## 固定基线与授权（2026-11-04）

- 需求 PR：https://github.com/bjstevenyang/ai-circuit-tutor/pull/2，已合并。
- 主线实际需求 SHA：`4ff251e78368ce9984ff02dfdba7a6404cadcc19`。
- 原审查 head：`53bd1f4538f955ec4c6a05c41c734452333c7f38`；正常 merge 的第二父提交，文件树与合并提交一致；不将它替代主线基线。
- 功能基线：`06ab7572452f8b078ec06f62c55ed54543f5c75c`，历史 240 项模块测试／35 个 Chromium 场景；本次开始时未复验。
- 起点仓库：`bjstevenyang/ai-circuit-tutor`；原分支 `codex/stage-2-requirements`／HEAD 为上述原 head，工作区干净。更新 master 后从主线需求 SHA 创建 `codex/stage-2-implementation`。
- 批准者：当前会话任务提出者，不推定 GitHub 身份。批准依据为用户本次指令：“请开始 ai-circuit-tutor 阶段 2‘电子元件扩展’的实现”“授权你从更新后的 master 创建独立 codex/ 实现分支、创建 Draft Implementation PR，并按已合并需求实施、验证、提交和推送。”该依据将原文记录在实现 PR，作为可访问交接记录；GitHub 独立 APPROVE 事件读取结果为空，不虚构审阅事件。
- 授权覆盖已合并完整规格及 EX2-01–12；不含 EX1 基础测量、阶段 3／4、部署、新依赖、代理批准／合并。

## 实施前确认

已读取 AGENTS、两 PR 流程及固定版本的 PRD、CR-STAGE-2、电路模型、系统设计、四实验、性能规程、测试计划和影响报告。授权与规格一致，可继续，无需重复许可。

新增验收 EX2-01/02 为 RGB 通道与诊断；03/04 为有限 NPN 三工作区、严格唯一性及课程限值；05/06 为单电容解析与运行生命周期；07/08 为周期驱动及声音；09/10 为编辑与 v4 迁移；11 为说明及四实验；12 为资源与固定性能规程。AC-06/11/17增加动态适用规则，旧 DC 保留；其余 AC 回归，EX1 继续暂缓，无删除。

按 RGB → NPN → RC → 压电切片推进同一个实现 PR。涉及 circuit 类型／目录／解析／网络／求解、editor 物理安装与显示、app 会话、tutor 证据、storage 白名单、音频和测试。风险为多解误判、动态状态失效、旧作品损失、音频残留及超预算计算；相应纯模型测试、迁移测试和 Chromium 场景作为门槛。

## 验收证据（2026-11-05）

这是 Implementation PR #3 的实际验证记录，不改变已批准的 PRD、模型、脚本或数值门槛。下面每行分别列明已验证范围及限制；自动化通过不等于全部 EX2 完成。

### 可复现命令

- U：`npm test -- --reporter=json --outputFile=/tmp/ai-circuit-stage2-tests.json`，21 文件、335/335 项通过（原 240 项保留，新增 95 项）。
- E：`npm run test:e2e -- --project=chromium --workers=1`，44/44通过（原35、新阶段2共9），含四实验完整键盘流程。
- Q：`npm run build`（含严格类型检查）、`npm run lint`、`git diff --check`，通过。
- P：`npx vite build --config tests/performance/vite.config.ts`；`npm run test:performance -- --grep-invert 'M-|B-RC background'`，固定核心及RGB/NPN/压电/最大DC指针与键盘UI/停止、压电变频/变幅的11个场景通过；RC两输入组独立重跑通过：`npm run test:performance -- --grep 'B-RC UI/Stop'`，2/2（42.7分钟）。13个固定核心/UI场景均已有完整通过证据（11组+RC2组，分别执行）。首次RC组在第10个准备周期前被提前中断，整组作废，不计通过；已经独立完成的其余组原始数据保留。
- M：`npm run test:performance -- --grep 'M-RC'` 和 `npm run test:performance -- --grep 'M-PIEZO'`，各十次真实前台墙钟 60 s 会话，受控 GC，均通过；见性能节的代码版本边界。

| 验收 ID | 输入、操作与期望的测试证据 | 命令与结果／未验证边界 |
| --- | --- | --- |
| EX2-01 | `src/circuit/rgb.test.ts`：独立电流／RGB 数值、8 开关组合、R=1 kΩ；`src/app/Stage2.test.tsx` 的 independent named pin mapping：独立 R/K/G/B→孔位期望、四方向、预览及移动；`tests/e2e/stage2.spec.ts` RGB 与 keyboard RGB | U 通过；E 通过。真实学生能否理解混色未验证 |
| EX2-02 | `stage2-regression.test.ts`：反向／旁路／无限流的 channel/entities、等 Vf 共阻拒绝非唯一、不同 Vf 唯一结果及共阻说明／独立限流不误报；`rgb.test.ts`：R=100 Ω 只 R 通道 25 mA；RGB 浏览器场景逐级三提示→330 Ω 修复清旧证据 | U 通过；E 通过 |
| EX2-03 | `npn.test.ts`：断开／Rb10k 饱和／100k 受控的 Ib/Ic/Ie/VCE/电源总流；VBE=.7 V 的截止重合边界、VCE=.2 V／Ic=100Ib 的饱和重合边界与优先级；NPN 浏览器三态 | U 通过；E 通过。参考支路与 LED 支路在同一耦合网络中求解 |
| EX2-04 | `npn.test.ts` 去集电极参考／恢复；`stage2-regression.test.ts` 直连 B、C/E 反接、基极 Ib 超限；独立 Rb1k/Rc50Ω 得 Ib3.793 mA/Ic86 mA、保留有限读数、Rc1k 修复清超流；浏览器 NPN 删除参考→无 VCE→撤销恢复 | U 通过；E 通过。未知状态不输出 0 电压 |
| EX2-05 | `transient.test.ts`：独立 0/1τ/5τ、充转放、双闭带载、双断保持、R/C 各增十倍的新 τ；`stage2-regression.test.ts`：浮置岛无假泄漏、脚交换／多 C／非线性／零 R／无参考限制；`Stage2.test.tsx`：运行中 R／电压变更后的连续电压及后续解析轨迹 | U 通过；E 通过 |
| EX2-06 | `Stage2.test.tsx`：普通推进不保存／不加历史、失焦暂停无追赶、R 延续／C 应用停止、旧回调失效、模拟 60 s 自动停止／零初态重启、fault 释放不重启；RC 浏览器覆盖停止／刷新及容量非法输入 | U 通过；E 通过。真实桌面后台 10×10 s 检查未通过测试环境焦点门槛，见下文；模拟失焦不替代实际后台证据 |
| EX2-07 | `piezo.test.ts`：三频率/Vpp、串 1 MΩ 幅度不足、DC/断开、KCL 与独立 C·dv/dt；回归覆盖旁路／并联／闭环／源误用／交换脚；压电浏览器源切换与三频率 | U 通过；E 通过；不把方波源当成可叠加的第二电源 |
| EX2-08 | `useBuzzerSound.test.tsx`：主动许可、0 音量、不重启振荡器、sine/250/500/1000 Hz、Vpp 精确增益及平滑、API 不可用；压电 Chromium 核对真实 AudioContext 参数；P 的频率与仍受驱动时变幅独立 100 样本，验证两参数达到目标 95%；M-PIEZO 核对停止／断开／单 Context／退出关闭 | U 通过；E/P本机通过，M 通过。实际扬声器音量及音色试听未执行 |
| EX2-09 | `stage2-regression.test.ts`：四新器件所有方向安装、碰撞原子拒绝；`Stage2.test.tsx`：独立脚名映射、移动和预览；四个 keyboard 场景从空板放置／接线／运行；原有 `editor/model.test.ts`、`editor/components.test.ts` 及旧浏览器流程回归通用移动／旋转／删除／取消／撤销逻辑 | U 通过；E 通过；不重复为每个新外形复制整个通用编辑测试套件 |
| EX2-10 | `stage2-regression.test.ts`：v4 白名单剥离瞬态、只读加载、F/源/频率配置、v1/v2/v3 默认与电压、超分析预算作品可解析；`Stage2.test.tsx` 容量应用／撤销、不保存时间；原 storage 19 项及参数／历史回归；RGB/RC 刷新后停止 | U 通过；E 通过。未知／损坏／写失败保护沿用并回归原测试 |
| EX2-11 | `Stage2.test.tsx` 四类用途与接法及查阅不改变诊断／提示／存档，逐脚独立对应；四实验分别有表单搭建→错误／修复和纯键盘搭建；RC 使用 RC 求解文字及明确时间/Vc/Ic，不以蜂鸣器完成标题替代 | U 通过；E 通过。1 教师／至少 3 名 12–16 岁学生教学试用未执行，不宣称通过 |
| EX2-12 | `npn.test.ts` B-MAX 24 件/576 候选/51.693333333 mA；`stage2-regression.test.ts` 固定 23 件 P9/T2、T>2、单 C/压电及真实 128/129 维合成支路、120/121 不重用孔位边界；B-OVER 第25件拒绝、仍24件可运行；P 核心独立核对 B-MAX P/T/候选/内部 KCL≤10 nA；M 两组内存回收 | U 通过；E/P本机通过，M 通过。当前 M1 Pro/16 GB 只是本机补充，指定 M1/8 GB 的性能门槛未验证 |

### 固定输入与复现信息

实际安装输入在 `tests/fixtures/stage2-reference.json`（受控测试样例，不是学生作品或运行数据），生成器在 `tests/fixtures/stage2.ts`。每份 document 使用 UTF-8 `JSON.stringify(document)` 的 SHA256；回归测试核对快照、哈希及生成器一致性。B-OVER 是故意非法的 25 件输入；其新增 1 kΩ 两脚通过同组空孔接到 P/N，不以重叠或悬空元件冒充该固定样例。P-OVER 为按规格去掉 D4 两电阻、加入第3只 RGB 共用 U1 各色网络的 23 件输入。

UI 初始差异按固定规程：B-RGB 的 R 开关断开，B-NPN 断开，B-PIEZO 250 Hz，B-MAX 的 T1 Rb=100 kΩ；JSON 中是核心完整参考配置，UI 文件另写入每组实际输入哈希，不能混同。

本机 Apple M1 Pro／16 GB、macOS 26.5.1、Node 24.21.0、npm 11.19.0，Playwright 1.64.1；默认headless Chromium（保留Playwright焦点模拟），完整版本及每组原始样本在测量JSON／PR评论；它不提供实际桌面后台切换证据。单 worker，1440×900，无 CPU 节流、无 trace／录像／截图，无其他测试混跑。性能构建隔离于 `/tmp/ai-circuit-stage2-benchmark-dist`，不修改生产入口或增加依赖；正常生产包不包含 benchmark harness。

本轮生产构建可核对的资产指纹：`assets/app-Bi8WXI8z.js` SHA256 `15916e6ae50b31659713376e26fb1c0c55ac6c2dfed54bd93479f417efebab26`；模型 `assets/model-DwFnRPH9.js` SHA256 `83159e2c5d3816c6619ca9000646d06ae27d7a5eff4676ade9737aa8782a1283`。测量开始时Git起点为`785e2c60c7959be71a08cbb81e4021cac7531463`加本轮工作树；最终提交完整SHA由PR固定，不能把构建前HEAD冒称成包含未提交变更的测量代码。

代码观测点保留 sessionId/documentRevision，t0 在实际 click/keydown 入口，t1 为匹配本次结果的 DOM/SVG 之后首个 RAF；音频取频率及增益 95% 时间戳与视觉较晚者。各操作／输入组分别预热10次、100原始样本，第95个顺序统计为P95。不删除慢样本；失败／中断组不计通过。

### 本机固定延迟结果

单位ms；所有组各10次预热、100个正式样本，P95取升序第95个。环境为上述M1 Pro/16GB/headless Chromium 156.0.8078.4，不能替代M1/8GB目标验收。

| 核心输入 | P95 | P/T | 候选 | 未知数 |
| --- | ---: | --- | ---: | ---: |
| B-RGB | 0.30 | 3/0 | 8 | 6 |
| B-NPN | 0.20 | 1/1 | 6 | 6 |
| B-RC | 0.20 | 0/0 | 1 | 2 |
| B-PIEZO | 0.20 | 0/0 | 1 | 0 |
| B-MAX | 6.20 | 6/2 | 576 | 24 |
| B-OVER | <0.10（计时分辨率） | 6/2 | 预检拒绝 | — |

B-MAX内部节点独立KCL最大残差8.7×10⁻¹⁹ A（≤10 nA）。RC/压电使用各自解析器，图计数不冒充通用瞬态矩阵。B-OVER预检拒绝无有限读数，不当作支持电路的运行性能。

| UI输入 | 操作 | 响应P95 | 停止P95 |
| --- | --- | ---: | ---: |
| B-RGB | pointer | 14.60 | 14.80 |
| B-RGB | keyboard | 15.60 | 16.80 |
| B-NPN | pointer | 14.40 | 14.40 |
| B-NPN | keyboard | 15.70 | 16.50 |
| B-PIEZO | pointer | 66.40 | 3.70 |
| B-PIEZO | keyboard | 54.50 | 6.10 |
| B-MAX | pointer | 15.10 | 14.90 |
| B-MAX | keyboard | 15.80 | 15.00 |
| B-RC | pointer（断充电／闭放电） | 11.40／12.50 | 15.30 |
| B-RC | keyboard（断充电／闭放电） | 15.10／15.90 | 16.20 |

压电变频的上述响应取视觉与频率/增益95%完成两者较晚者，兼作音频完成的保守上界；pointer/keyboard P95为66.4/54.5 ms，100个样本分别全部≤100 ms。仍持续受驱动时改幅，pointer/keyboard P95为64.7/62.0 ms，全部100样本≤100 ms。未扣除RAF或计时开销。实际扬声器试听仍未验证。

原始核心/UI/RC数组及两组内存10点随PR评论交接，不把运行数据提交仓库。源码与固定fixture留在仓库；代码完整提交SHA及远端CI结果由最终PR记录固定。

### 长运行实测与版本边界

- M-RC 在 `1ba9c2619cb9bc897262bcd5ce752ccf9578b3a2` 生产构建执行：十个真实60 s会话，H1=6,026,656、H10=6,470,640，所有点最大增长443,984字节，停止后计时器清理；实际模拟终点51.55–54.20 s按规程记录，不把墙钟60 s说成模拟60 s。自动模拟60 s上限另由U中的专用测试验证。
- M-PIEZO 在 `785e2c60c7959be71a08cbb81e4021cac7531463` 生产构建执行：H1=5,128,736、H10=5,862,220，所有点最大增长733,484字节，十次振荡器开始/停止/断开数一致，仅保留一个Context，pagehide后关闭。首次脚本误等RC专用时钟的组已中断，未计通过；上述是修复脚本后的完整重测。
- 两组均遵循停止→真实等1 s→GC→100 ms→GC→100 ms→JSHeapUsedSize，不保存heap snapshot或测量结果对象于浏览器。原始文件在`/tmp/ai-circuit-stage2-memory-RC.json`及`...-PIEZO.json`，数据随PR评论交接。
- 后续生产代码只调整单选控件/参数焦点删除保护、重复空按压清理及footer排版，未改求解、RC定时/状态或声音生命周期。没有声称长运行发生在尚未形成的最终提交上；新UI响应／功能测试针对最终代码重跑。

### 审查、失败记录与交付边界

对需求主线至`1ba9c2619cb9bc897262bcd5ce752ccf9578b3a2`按code-review的Standards/Spec两轴只读审查：五项P2均修复（fault按钮释放、RC自动播报、NPN基极参考、RGB共阻说明、压电附加闭环），补回归并由两个审查轴静态复核闭合。最终定向复核又发现单选控件聚焦时删除键误删选择对象，已增加radio保护和Delete/Backspace回归；补齐NPN边界/Ic超流、RC自动上限/新τ轨迹、真实音频参数、固定预算负例、独立脚名映射等证据。

早期纯键盘测试卡在原生下拉弹出菜单驱动；改为明确可见的电源/频率单选控件、元件盒及数字输入路径后四实验通过。单选支持方向键、首尾、单一Tab停靠及可见焦点，电气选项和原子编辑契约不变。旧测试脚本误点禁用的第25件放置按钮、随后误用不存在的孔位selector已修正，旧失败不计通过。

真实后台检查尝试过无界面和可见Chromium：默认Playwright启用焦点模拟，不会产生预期实际失焦；关闭模拟后可见窗口被当前桌面焦点打断，停在模拟2.25 s，未完成十次检查。受控blur单元/浏览器测试通过，但不代替实际后台结论。实际桌面检查入口为 `RUN_REAL_FOCUS=1 npm run test:performance -- --grep 'B-RC background' --headed`，需独占前台桌面；默认跳过并明确原因，不能计作通过。

下列仍未验证，不以用户授权或自动化总数替代执行：指定M1/8 GB、真实后台十次检查、真实读屏、实际浏览器200%缩放、扬声器试听、教师/学生教学任务。没有公开部署，没有运行Firefox/WebKit，没有自行批准或合并PR。目标设备、辅助技术及人类参与者当前不可由本地自动化提供；手工执行清单在下节。

### 人工验证交接清单

| 项目 | 输入／操作 | 通过条件／失败记录 |
| --- | --- | --- |
| M1/8 GB | 按固定性能规程，在指定设备运行P、M两组，记录OS/浏览器/fixture/hash/代码SHA，保留所有原始数据 | 核心P95≤100 ms、UI≤200、停止≤100；音频≤100；所有Hi−H1≤10 MB；任一错误/超时都失败 |
| 实际后台 | 专用前台桌面运行上述RUN_REAL_FOCUS入口，十次模拟5 s→实际切后台10 s→返回 | 后台时间不变、首批增加≤.05 s、无追赶/残余声音；桌面焦点失控计未验证，不能替换成合成事件 |
| 真实读屏 | 使用实际读屏软件，纯键盘完成四实验，查元件脚名、诊断、逐级提示，RC主动播报 | 控件名称/状态可理解、焦点可见、无陷阱，RC不连续打断读屏；记录软件/版本及具体失败步骤 |
| 200%缩放 | 实际Chromium设置200%，四实验完成元件选择、参数应用、接线、运行、停止和提示 | 所有关键控件及文字可读取/操作，必要的板内滚动可用；记录视口/截图及受阻控件 |
| 设备试听 | 许可开、50%音量，压电三频率、仍受驱动时改幅、0静音、停止/后台/退出；旧蜂鸣器对照 | 能分辨频率变化且无残音；记录系统/输出设备/音量，不把API数值当作实际响度 |
| 教师/学生 | 1名教师、至少3名12–16岁学生按四实验脚本搭建、故障→提示→自己修复并解释 | 每实验至少2/3学生无需成人代接线能完成并解释；记录逐实验结果/失败点，不能用功能测试替代 |
