# 只读分析归档与作者处置

来源：[技术聊天原始报告](https://github.com/bjstevenyang/ai-circuit-tutor/pull/5#issuecomment-6725196789)，输入head `dd007e626c6a17277b197f88b77b452200a851d1`，作者不是本需求版本的最终独立审查者。以下原报告按原文归档，包含完整离线参考脚本；“建议／未冻结”描述分析提交当时的状态，当前规范以 PRD、CIRCUIT_MODEL、SYSTEM_DESIGN 和 TEST_PLAN 的 OSC 章节为准。

作者处置：采纳路线A。P1-OSC-A/B/C、P2-OSC-D/E分别通过显式profile、独立参考及积分误差要求、旧课程限值隔离、有限观察窗/失败/预算、虚拟电阻负载与声音映射、v5配置迁移闭合，仍须新head独立复核。原报告“9个相位检查点”以实际表格的8点为准；原脚本不含LTE，不能复制后自称生产求解达标。手册页数以原报告视觉核对后的零起索引27/28、16为准。

---

# PR #5 只读技术影响分析：互补晶体管自激发声

状态：**ANALYSIS_COMPLETE，供作者冻结规格；不是最终 PASS，不批准或合并 PR。**

- 输入需求 head：`dd007e626c6a17277b197f88b77b452200a851d1`。
- 派发键：`bjstevenyang/ai-circuit-tutor|5|technical-impact|dd007e626c6a17277b197f88b77b452200a851d1|analysis-1`；本次为原分析的 `resume-after-usage-limit-1` 恢复，没有重派或重跑先前研究。
- 执行来源：技术聊天 `01a1902f-8a44-7f03-855b-115e272388c4`。
- 恢复时实际远端 master：`68504d92d3b2e16af4822381410cd72465e00210`。已读该 SHA 的 AGENTS 和 AUTOMATED_HANDOFF；本地未包含此对象，改用 GitHub 固定 SHA 原文读取，没有 fetch/切分支。
- 本地实现基线及 HEAD：`40dd29ed6eafae43afc7d84bc02d3188daee1b22`，分支 `codex/stage-2-implementation`，工作区干净；阶段 2 合并基线为 `f80a1703cd95d18ad51af1ce8d693527afd92fd3`。需求 head 相对此实现的 src/tests/package 文件无变化。
- 输出：本评论及后续同任务参考附录；**无输出 commit、无仓库文件修改、无安装或业务实现**。作者应把选定方案和证据纳入需求文档，再对新的完整 head 做独立复核。原已同意的教学目标及自动交接方向不需再次批准。

## 1. 结论与建议路线

该图需要新的耦合非线性瞬态能力，不能复用现有线性 RC 或把 PNP 画出来就算支持。已找到并交叉复现一组**明确、有限、可执行的虚拟教学模型**：直流上电后产生约 290 Hz 的重复振荡；改变 C/R/负载会改变周期。没有隐藏方波、周期性“点火”、电路匹配后播放预设音或 `1/RC` 代替求解。

**推荐路线 A：采用下文虚拟模型和有限观察窗，保留所有旧模式，按求解结果给声音示意。** 型号说明写“参考原图的 NPN/PNP，采用虚拟教学模型”，不宣称准确复现 2N3904/2N3906 或 SL27001 的物理波形、峰值、音色、声压及安全性。两份独立实现、BE/BDF2 和步长收敛数据可用作这条路线的独立回归依据；不要求为了它安装通用 SPICE 或完成实物测量。

路线 B 是拟合真实器件、加入高注入、内部电阻、扩散储存及真实动圈负载；目前缺完整器件卡和 SL27001 的电机参数，不能给出物理预测。若选择 B，相关模型和独立校准范围需重新明确；不能借 A 的起振结果声称 B 也已验证。这不是当前最小教学交付的必要前置条件。

输入草案尚未冻结方程、时间、资源和验收细节，因此当前不能作最终合并 PASS。**按下述 A 方案落文档后可进入最终独立审查；本轮分析已收尾，不再自动增加研究或应用长测。**

## 2. 原图与资料核对

已视觉核对原作者手册扫描 A10 原理图、零件及装配页（PDF 零起索引 27/28，对应阅读器第 28/29 页，A10 首页印刷 28），以及 A5 扬声器页（PDF 零起索引 16，印刷 18）。CR 的“PDF第27/16页”应改为明确索引，避免差一页。

网表转录正确：9 V 的 VP 经 47 Ω 到 P；Q1 NPN 为 E=GND/B=A/C=B；Q2 PNP 为 E=P/B=B/C=D；120 kΩ 在 P–A；100 nF 在 A–D；扬声器在 D–S；10 Ω 在 S–GND。**A–电容的线跨过 Q1 发射极下行线时有跨线桥，不相连。** VP/P 和 S 必须保留独立端点。原图 Q1/Q2 为 3904/3906，0.1 μF(104) 不是 1 μF；同编号 SL27001 在 A5 列为 8 Ω。

原作者是 Electronic Kits International Inc.（EKI，1992），不能据此称日本 ELEKIT。来源是原作者手册的第三方托管扫描，不是厂商官网。[原手册](https://www.zpag.net/Electroniques/Kit/electronic_labs_1-15.pdf)。下载件 SHA-256：`290c3107f4e113041f6f2d5b6725659a331a8c674d07fdd9dacc3b0309aae4f2`。

8 Ω 额定阻抗没有给出 SL27001 的 Rdc、线圈电感或机械参数。下文 **8 Ω 纯电阻是本产品明示的虚拟负载选择**，不能伪称手册证明了它在所有频率和 DC 下都精确为 8 Ω。

## 3. 与实际实现的差异

| 项目 | 代码基线的实际行为 | 本轮影响及边界 |
| --- | --- | --- |
| 器件 | 12 类；有 NPN，无 PNP、动圈扬声器 | 加 pnp/speaker；安装和 B/C/E 继续由 catalog 的稳定端点推导；speaker 与蜂鸣器、压电分别建模 |
| NPN | 低侧、固定 .7 V/.2 V/β100；基极不能由半导体反馈驱动；Ib 5 mA/Ic 50 mA 课程限制 | 新实验模型处理两个结、饱和及反向有源；不能静默重解释旧电路或取消旧课程限值 |
| C | 10–1000 μF；单 C、一脚接负端、线性 Thevenin 解析 | 100 nF 混接需新的状态向量；`timeState:{timeS,voltageV}` 不足以表示内部结电容 |
| 分派 | `analysis.ts` 见 C 先走现有 RC；`stage2.ts` 禁止该类级联反馈 | 分派必须先识别已选模型及其支持域；不让旧 RC 吞掉新的网络，也不改成通用不受限求解器 |
| 时间 | RC 每批≤.05 s、1×、60 s；方波压电为专用稳态 | 新非线性模型采用有限计算窗，不能把几十纳秒级开关过程直接塞进 React 帧循环或冒称持续 1×实时 |
| 保存 | v4 配置白名单，v1–v3 迁移；不存瞬态/声音许可 | 推荐 v5 增明确模型版本及新 kind；保留旧 ID/线/参数/存储键和损坏保护 |
| 声音 | 旧蜂鸣器固定 2 kHz；压电频率由外驱模型给出 | speaker 频率/强度来自其自身端口的数值波形；计算、声音时钟和 UI 分离 |

受影响代码集中于 circuit/types/catalog/validation/analysis 及新的有限瞬态模块、editor 命令与图形、app 会话/读数/音频、storage 和 tutor。可以复用网络、物理校验、编辑历史和键盘路径；不需要后端、插件系统或新运行依赖。`App.tsx` 不宜继续堆入迭代器及全部状态，应把新会话控制和纯求解边界分开。

## 4. 路线 A 的完整数学候选（提案，未冻结）

共同参数：`IS=1e-14 A`，`VT=.02585 V`，`NF=NR=1`，`BR=1`；NPN `BF=100`，PNP `BF=50`。每管在实际 B–E 端间加入 **10 pF 正线性电容**、B–C 端间加入 **5 pF 正线性电容**。外部 C=100 nF；speaker=8 Ω 与 R2=10 Ω 串联，参考网表可约为 D–GND 的 18 Ω，实际通用装配仍保留 D–S 端口并计算 speaker 的电压/电流。

对 NPN 取 `s=+1`、PNP 取 `s=-1`，电流以流入各管端为正：

```text
vbe = s*(Vb−Ve),  vbc = s*(Vb−Vc)
F = IS*expm1(vbe/VT),  R = IS*expm1(vbc/VT)
Ib = s*(F/BF + R/BR)
Ic = s*(F − (1+1/BR)*R)
Ie = −Ib−Ic
每个电容端口 q=C*(V1−V2)，i=dq/dt；两端等量反号盖章。
KCL: G*v + I_BJT(v) + Cmatrix*dv/dt = b(t)
```

这是传输式 Ebers–Moll 加明确线性结电容；两个结都参与，饱和时不能继续假定 Ic=βIb。方程依据与更完整模型的区别可见 [OUP 教材附录 B.1.5](https://learninglink.oup.com/protected/files/content/file/1617108117122-Sedra8e_AppB.pdf)。这些具体 β/IS/C 值是虚拟选择，**不是该教材或 datasheet 对真实 3904/3906 的指定值**。

本候选没有 Early 效应、高注入、内部 RB/RC/RE、扩散储存、雪崩、温升或损坏。`BR` 表示反向有源增益，不表示 B–E 雪崩；不能拿 datasheet 的 VEBO 额定值直接充当精确硬钳位。[ngspice 手册 §7.3.3–7.3.4](https://ngspice.sourceforge.io/docs/ngspice-manual.pdf)、[onsemi 2N3906 额定/电气数据](https://www.onsemi.com/pdf/datasheet/2n3906-d.pdf)。

初态：所有外部及内部电容电压为 0，节点为 0；电源只进行一次 0→9 V 的 100 μs 单调线性上电，之后恒定。不能周期性重置状态或加音频扰动。独立计算将该上电改为 1 ns 近阶跃，仍有 5 次重复上穿，后续周期约 3.44536 ms；不是用 100 μs 周期激励制造的振荡。默认也不能先求 DC 工作点再当成同一冷启动实验。

推荐首版仅开放这一实验 profile：单理想电池、最多各一只 NPN/PNP、一只外部 C、一只 speaker，电阻及理想触点；LED/RGB/压电/蜂鸣器和更多储能/晶体管组合明确 unsupported。可保留现有 24 件/120 线作品限制，另设最多 12 个非线性电气未知量。先保证参考及列出的参数单项变体；不承诺所有参数组合必起振。几何等价布局、同网空孔、线色/折点及扬声器端点反向不改变负载，不能按画图坐标识别“正确图”。

建议新 profile 的 C 支持 47–220 nF，默认 100 nF；旧 RC 仍为 10–1000 μF。配置层可保存范围内但不受当前 profile 支持的电路，运行时明确限制；不能为迁移悄悄改变电容值。阻值/电源继续现有 10 Ω–1 MΩ/1.5–9 V 校验；数值可合法编辑与网络一定受支持、一定起振是三件事。

## 5. 已执行的独立数值证据

两份标准库 Python 实现分别编写；独立实现未读取主分析脚本。四节点/五变量节点法、解析 Jacobian、带阻尼 Newton、后退欧拉 BE 和可变步 BDF2；没有调用项目求解器、预设振荡状态或音频 API。独立 Jacobian 对中心差分的归一化最大差约 `4.63e-10`。每次接受的 KCL 残差≤1 nA（主脚本≤0.1 nA）。**两个探索实现均尚无局部截断误差控制，因此不能仅凭 Newton 收敛宣称积分误差受控。**

| 实际计算 | 窗口 | D 向上穿越 1 V | 平均周期/观察 |
| --- | --- | --- | --- |
| 主 BE，hmax=1 μs | 30 ms | 9 次 | 约 3.44753 ms |
| 主 BE，hmax=.25 μs | 15 ms | 5 次 | 3.445366 ms |
| 独立 BE，hmax=.25 μs | 15 ms | 5 次 | 3.445371 ms |
| 主 BE，hmax=.0625 μs | 15 ms | 5 次 | 3.444675 ms |
| 独立 BDF2，hmax=.25 μs | 30 ms | 9 次 | 约 3.44256 ms |
| 独立 BDF2，hmax=.0625 μs | 15 ms | 5 次 | 3.444414 ms，约 290.325 Hz |

最细 BE/BDF2 周期差约 **0.0076%**；最细 BDF2 五次上穿时间为：

```text
0.0007975048641074258
0.004241917955648099
0.007686336151297837
0.011130744891900548
0.014575162826328912   （s，线性插值）
```

最后一个完整周期 `[.011130744891900548, .014575162826328912] s` 的独立 BDF2 观察量：D 均值 `.367311 V`、AC RMS `.812681 V`；平均源电流 `.0253513 A`。参考扬声器的 AC RMS 电压为 D 的 8/18、即约 `.361192 V`；电流 AC RMS 为 D/18、约 `.045149 A`。这只是电气负载读数，不是声压。

以该周期开始的 D=1 V 上穿作相位 0，给出可复现的离散参考（P/A/B/D，V）：

| 相位 | P | A | B | D |
| --- | --- | --- | --- | --- |
| .01 | 1.363324 | .770303 | .566881 | 1.335722 |
| .10 | 2.409346 | .715528 | 1.625972 | 2.333153 |
| .20 | 8.995835 | -1.636073 | 8.617902 | .001595 |
| .40 | 8.996068 | -1.043075 | 8.768749 | .001506 |
| .60 | 8.996287 | -.483138 | 8.908830 | .001422 |
| .80 | 8.996494 | .045579 | 9.041092 | .001342 |
| .90 | 8.996593 | .298779 | 9.102571 | .001304 |
| .99 | 8.979809 | .526743 | 8.352052 | .007604 |

与主 BE 最细结果的相位采样比较，9 个检查点最大电压差约 **52.2 mV**，主要在 B；BE 的周期 RMS 是按 10 μs CSV 近似积分，D 的 AC RMS `.815116 V`，与上述差约 .30%，平均源电流差约 .89%。这证实了周期及列出的观察量，**没有证明每个开关瞬间/原始基极峰流均已收敛**。例如 BE 的 B 最大约 9.066 V，BDF2 约 9.117 V；NPN 基极峰流约 156 mA 对 186 mA，不能当成精确真实器件峰值交付。

实际最小接受步长约 `.22–.28 ns`，并非最大步长所写的 .0625/1 μs。这是刚性问题和性能风险，不是已经测得浏览器卡顿。最细 15 ms 独立参考约 240185 步、116 次拒绝、Newton 最多 36 次；Python 墙钟约 7–8 s，不能换算为 Chromium/M1 8 GB 的性能成绩。

### 参数变体与反例（主 BE，hmax=.25 μs）

每项仅改变该列，其余为参考参数；这些是实际数值积分结果，不由比例公式填表：

| 改动 | 窗口 | 结果 |
| --- | --- | --- |
| C=47 nF | 15 ms | 10 次上穿，周期 1.619935 ms |
| C=220 nF | 25 ms | 4 次上穿，周期 7.577946 ms |
| Rbias=100 kΩ | 15 ms | 5 次上穿，周期 2.998722 ms |
| Rbias=240 kΩ | 30 ms | 5 次上穿，周期 6.239546 ms |
| 负载总阻由 18 改 26 Ω | 15 ms | 4 次上穿，周期 4.476369 ms；负载确实反馈到电路 |
| 移除外部反馈 C，内部结 C 保留 | 15 ms | 仅一次上穿，最终 D=2.082358 V；有 DC 电流，不能诊断成“完全没电” |
| Rbias 开路近似（1e30 Ω） | 15 ms | 无上穿，D≈9.09e-8 V；这是有限窗观测，不把近似开路当作通用唯一 DC 证明 |
| 负载开路近似（1e30 Ω） | 15 ms | 仅一次上穿，无重复周期；实际移除器件后的浮置/初值需另按拓扑处理 |
| **βN=βP=100**，其余不变 | 15 ms | 仅一次脉冲，随后 D≈2.426168 V 的 DC；保留为重要负对照，不能继承旧 β100 后硬称起振 |

没有验证任意 R/C 笛卡尔积、错误脚序或真实扬声器。更早的任意 L/雪崩尝试出现越界电压及明显步长敏感，**已排除，不作为可接受证据或候选**。

## 6. 建议冻结的数值、时间与失败契约

以下是实施验收目标，不是假称现有应用已达到：

1. **数值**：隐式积分，Newton 有解析 Jacobian、阻尼/回退、迭代及拒步硬上限；加入局部误差估计（例如 BE 一整步与两半步），接受两半步结果。建议 `rtol=1e-4, voltage atol=10 μV`，KCL≤1 nA；必须独立验证积分误差，不能以 KCL 或换成小固定 dt 取代。最大步建议 .25 μs，最小 10 ps，单次 Newton≤80、总接受步≤1,000,000、总拒绝≤10,000；达到任一限制给 numerical/budget failure，不降精度后冒称成功。较紧容差/减半最大步的回归，只检查本次有限参考及边界，不无限扩充场景。
2. **参考验收观察量**：同初态下 15 ms 至少 5 次 D=1 V 上穿；首上穿相对参考误差≤1%，稳定周期≤.5%；上述相位电压绝对误差≤.1 V；D/speaker 的 AC RMS 和平均源电流≤2%；源峰流约174.4 mA，误差≤2%。这些是针对有限教学观察量的容差，不是每一瞬间/真实 BJT 脉冲峰值保证。实现还需在一档更严格积分设置下满足同一观测容差。若不能满足，返回证据调整需求，不修改期望掩盖问题。
3. **模型适用域**：建议仅接受规范化 BE 电压[-3,.9] V、BC[-15,.9] V、端口电流绝对值≤250 mA 的虚拟结果；超出即模型不支持，不钳成想要的波形。这些是所选教学方程的计算边界，不是器件安全额定值。参考峰流远超旧 Ib5/Ic50 mA 课程限值；新 profile 应显示“虚拟开关模型，不能判断真实器件安全”的明确说明，旧课程限制完整保留，不给真实安全结论。若作者仍要求新实验沿用5/50 mA作为成功门槛，则与本候选冲突，依赖该定义的验收阻塞。
4. **时间**：推荐每次运行只计算冷启动0–40 ms，先可显示计算状态；参考对照用0–15 ms。在有限窗内按至少4个完整周期、周期偏差≤1%及周期AC RMS变化≤1%判断稳定周期；reference 的1 V阈值只用于独立算例，通用检测不能硬编码所有电路都必须上穿1 V。未发现周期应写“观察窗内未见稳定周期”，不能证明永远不起振。稳定周期之后只做声明过的声音重建，UI 不冒称持续 1× 数值仿真。
5. **状态及失败**：区分 calculating、periodic、settled-DC、window-no-period、unsupported-topology/model-domain、numerical-failure、resource-limit、stopped/background-paused。DC/有限窗无周期是可能的计算结果，不自动当“接错”；unsupported/failure 不造电流、频率或继续旧声音。建议 DC 判据为末5 ms各节点范围≤1 mV、所有电容端电压导数≤.01 V/s且KCL≤1 nA，全部满足才标 settled-DC；不能只因未见重复上穿就宣称稳态。周期识别还需speaker交流RMS≥1 mV；这仅为检测/声音门槛，低于它不伪称数学上绝对无信号。
6. **拓扑反例**：VP–GND 的理想源短路与 P–GND 经47 Ω的有限短接不同；后者电流可有限，不能报告无限。speaker 被旁路时其端电压为0，电路仍可能振荡但 speaker 不发连续音；移除speaker时不可把其负载仍留在求解网表。错管型/脚序可以落入明确支持限制，不能自动猜正确接线或把所有错误都定为静音同一原因。

新模式不沿用旧DC的微小参考电导来证明起振或节点唯一；求解辅助项不能混入接受后的物理读数。EM方程中已声明的反向IS属于虚拟器件，与偷偷加GMIN不同。浮置/奇异网络要结合电容初态判断；无法唯一确定所报节点时明确unsupported，不给任意电压。精确删除器件和一条1e30Ω电阻不能在验收中互换，表格的两项开路近似只证明有限窗探索结果。

## 7. 接口、调度、声音与保存

- 核心建议分 `compileTransient(document, profile)`、`initialize(compiled, initial)`、`advance(compiled,state,target,budget)`；返回判别联合的 accepted state/readings 或明确失败。state 含所有独立电荷/必要节点解和模拟时间，不能只由上次渲染读数还原；模型/文档 revision 进入会话，核心不读 DOM/音频/墙钟。实际耗时与取消由外层监督。
- 采用可取消的 Worker 或有界分批调度有明确理由：已发现亚纳秒退步及数十万次隐式计算。推荐内置 Worker，无新库；停止可终止/丢弃当前 generation，旧 session/revision 的任何响应不得恢复读数或声音。不要按音频44.1/48 kHz驱动 React 或将每个求解步 setState。
- 新 profile 的 R/C/电源参数、开关或按钮事件在已运行时均取消当前计算/声音、从冷态自动重算，停止时只改配置；明确告知本轮不延续电荷。移动、旋转、改线、删件、导线外观、撤销/重做及重置按现有规则停止，等学生再次运行。旧 RC 延续 Vc 及改C停止的规则不变。
- 页面后台/窗口失焦及时静音并取消新 profile 计算；回前台恢复时从冷态重算，不补算墙钟、不恢复旧声；停止/卸载/pagehide清音频和异步结果。普通页面内焦点移动不暂停。刷新只恢复配置、保持停止。提示记录带模拟时刻及revision快照，实时推进不自动揭示后续提示。
- 声音推荐复用现有许可、音量和平滑增益，新增 speaker 分支：只在求解且识别稳定周期后，用其实际端口交流分量得频率及 `Vrms_ac`；例如正弦示意增益 `0.25*(音量/100)*min(Vrms_ac/1V,1)`。这是一种已声明的电气声音示意，非真实扬声器音色；不得用固定290 Hz、`1/RC`、sourceMode方波或拓扑匹配替代。DC/观察窗未见稳定周期默认不播连续音；不承诺重现上电“咔嗒”。声音频段建议20–20000 Hz，超出只给文字，不能把频率钳到听得见的值；API不可用保留文字。
- schema建议v5，新增明确 `modelProfileId`（旧实验/本次虚拟模型版本），以及pnp/speaker。旧v1–v4迁移到旧profile、保留节点及参数，不因新模型把旧NPN从分段改成EM。切profile是显式可撤销配置、不自动缩放C；模型不支持但结构物理合法的作品仍可保存恢复。仅配置白名单入库；时间/电荷/采样/Worker/周期缓存/许可都不存。未知模型版本、损坏或未知schema不覆盖原存档。电容统一F入库，UI可用nF/μF清晰显示，100nF=.1μF=1e-7F，不能重复乘单位。

## 8. 有限资源与可复现性能提案

旧EX2-12 的100 ms核心、200 ms交互、100 ms停止不被新求解悄悄扩大。新非线性profile另定义“完整0–40 ms数值分析完成”目标 **P95≤2 s**，交互反馈≤200 ms、停止及静音≤100 ms；数值预算或墙钟硬截止建议5 s，超限报失败。**这些阈值未测，不能写已满足**。如果达不到，先以固定样例的证据调整方案，不能绕过容差/将波形预置来达标。

性能输入固定为本报告网表及变体、允许的12未知量边界、13未知量拒绝；固定9 V、100 μs上电、40 ms目标、上述容差和步数上限，保存完整端点配置/编译后节点表及哈希。具体边界网表：将参考P–A的120 kΩ替换为8个15 kΩ串联，新增X1…X7；参考的P/A/B/D/S五个未知节点加7为12。超限例仅将其中一只15 kΩ拆成两只7.5 kΩ，新增X8变13；分别为14/15个元件，均在24件物理上限内。预算计数定义为合并导线/理想触点并消去已知电源端后、进行可选串联电阻简化之前，不能因编译优化改变12/13边界。可在编译时消去纯电阻内部节点，计算数值应仍等价。

M1/8 GB及锁定Chromium仍为目标机；其他机器标补充。单worker/1440×900/无CPU降速；每个固定场景预热3次、正式20次，均从同一冷态运行，不累加到20×40 ms。计时包括本次编译和完整窗口/明确终态，UI点击到结果另外计；记录全部原始耗时，P95采用升序第19/20个样本。Worker自身起止间隔和主线程端到端间隔分列，不混用不同performance时钟的绝对值。停止分别在计算中与已发声时触发，统计到状态停止及音频清理；不能只量UI派发。

只保留当前解、周期统计及最多4096个有界显示采样；不把每个接受步的几十万状态留在React/历史/存储。周期交叉/统计由接受步计算，不从稀疏显示样本猜频率。内存检查可用20次运行/停止的固定回收采样，单列基线及最后堆、Worker/AudioContext残留；目标增长≤10MB。**不沿用阶段2的10分钟持续RC长测反复套在有限计算窗上**。实际设备/试听/教学试用分别记未验证，不用CI总数替代，也不因此无限追加自动化测试。

## 9. OSC 验收冻结清单

无删除既有AC/EX；新OSC-01–06应保持新ID。建议将每项拆为明确输入/操作/期望/失败，而非只有“正确、有状态、符合模型”。

| ID | 固定输入与操作 | 应冻结的期望及失败 | 拟证据位置（尚未创建/执行应用测试） |
| --- | --- | --- | --- |
| OSC-01 | PNP/speaker 四方向放置，键盘/表单连相同端点；占孔/越界/取消 | 端点映射唯一、原子拒绝、无误历史；错误电气接线仍允许保存 | catalog/editor/appearance；Chromium一条非拖动参考搭建 |
| OSC-02 | 输入100nF/.1μF及非法/边界值；选新profile并运行 | 单位等价、内部/外部电荷按定义起态；拒绝不完整/非有限参数；旧RC范围和默认不变 | validation/parameters/transient/state；迁移测试 |
| OSC-03 | 固定参考、冷启动、15ms、两档精度；按独立附录比较 | 第6节的上穿/周期/相位电压/RMS/源电流容差；数值失败无成功或未知读数 | 新circuit瞬态测试、独立数值fixture；非项目求解器生成期望 |
| OSC-04 | 参考及26Ω负载变体、端点交换、音量0、未许可、停/后台/卸载 | 负载改变回馈周期；模型speaker端口驱动许可后声音；无旧声、无固定音、不可用兜底 | 音频hook/session测试；Chromium API和停止流程 |
| OSC-05 | 去反馈C/Rbias、speaker移除/旁路、错管型/脚序、β100/100负对照 | 按具体模型区分DC/窗内未见周期/unsupported/failure；旁路speaker电压0不等于整个电路不振荡；提示有端点/时间证据 | 反例fixture、tutor及一条错误→提示→修复浏览器流程 |
| OSC-06 | 三种合法等价布局、颜色/折点/对象顺序、保存/旧档迁移、撤销、重跑/取消旧回调、预算边界 | 等价观测一致、旧profile不重解释、配置往返、旧回调无效；有限内存/响应及所有旧模式回归 | circuit equivalence/storage/editor/session；固定Chromium性能规程 |

既有验收的处置必须同步进PRD/模型/设计/测试计划：

- EX2-03/04：原低侧NPN三态、基极驱动限制和5/50mA留在旧profile；新增profile另有EM与范围；不改旧期望。
- EX2-05/06：原单C线性RC、10–1000μF、Vc连续及1×/60s保留；新增profile为内部多状态和有限窗冷重算，不能笼统覆盖旧连续性要求。
- EX2-07/08：外驱压电/固定蜂鸣器保留；speaker另有模型驱动及许可/清理回归。
- EX2-09/10/11/12：安装/键盘、v5迁移、教学说明和专用预算新增；旧实验实际证据保留。
- AC-01/03连接/端点、02/09物理/键盘、04/05数值/诊断、06提示快照、07/08历史/保存、10/13模型说明、11/17/18控制/停止/释放、12声音、14参数需回归；15/16/19旧LED/电位器不退化。EX1继续暂缓。

## 10. 按严重程度的作者待办与阻塞范围

| 严重度/编号 | 输入head的问题 | 具体处理 | 阻塞范围 |
| --- | --- | --- | --- |
| P1-OSC-A | 尚无冻结模型；沿用β100/100会锁DC；.1μF单独不能保证振荡 | 推荐明确采用第4–6节虚拟profile，参考附录入需求证据；若坚持真实3904卡则走B，不混称 | OSC-02/03/05及求解实现 |
| P1-OSC-B | 新参考有大饱和脉冲，旧5/50mA与“正常完成”冲突；原始基极峰值未证收敛 | 分开旧课程与新虚拟计算域；不发布真实峰值/安全结论；冻结当前观测容差和警示语义 | 新成功/过流/失败、OSC-03/05、说明及提示 |
| P1-OSC-C | 时间/误差/起态/未起振/资源尚未定义；现有RC解析和逐帧流程不适用 | 冻结有限窗、冷重算、误差/迭代/步数/超时、取消与“窗内未见周期”状态 | 核心、会话、声音、OSC-02–06 |
| P2-OSC-D | 扬声器额定8Ω被误当完整阻抗的风险；声音规范未冻结 | 明示8Ω虚拟电阻+端口AC驱动，真实声学排除；无声状态逐项定义 | OSC-04/05 |
| P2-OSC-E | profile、保存和回归差异仅入口描述 | 冻结v5模型版本/迁移和逐ID差异，不改旧profile语义；修正PDF页索引及已视觉核对状态 | OSC-01/02/06及文档一致性 |

这些是作者可按已授权方向收敛的工程规格，不把用户已经同意的目标重新列为待批准。当前PR仍Draft，API显示mergeable=false；作者同步最新主线流程、解决文档冲突并冻结新head后再审，不用本报告替代最终固定head独立PASS。参与本候选/规格撰写者不能再自称该版本的独立审查人。

## 11. 本轮执行与未执行边界

实际执行：只读工作区/HEAD/差异/代码与文档核对、GitHub固定SHA流程读取、手册视觉核对、两份离线数学实现和上述有限参数/步长/方法对照。标准库Python3.14.6，无新增依赖。先前一个资料研究代理因用量限制中止；其已保存的原图由主执行者重新视觉核对，未循环重启或购买额度。

没有执行：业务实现、Vitest/typecheck/build/Chromium/性能长测、ngspice二进制、实物、M1/8GB、读屏/200%缩放/设备试听/教师学生试用；不把阶段2历史335/44等记录算成本轮通过。当前OSC-01–06仍未实现/未做应用验收。工作区无修改，不提交空commit，不推送或切分支。

交付后下一步：作者将选择的有限方案、参考数据、所有验收输入/操作/期望/失败及旧ID差异同步进CR/PRD/模型/设计/测试计划/影响报告；检查纯文档一致性，再交**不同作者的独立审查者**核对新的完整head。除非出现新证据或具体失败，不重跑已完成的研究、不把真实器件校准加入本轮最低交付。


## 12. 可复现独立参考附录（离线数学，不是应用实现）

下面将独立研究参考脚本收窄为上文固定候选：移除了未采用的雪崩分支、L固定为0；其余积分/Jacobian/线性求解保持。已实际重新执行，结果与独立BDF2最细结果一致。仅使用Python标准库，输出JSON、不写文件、不播放声音。默认参数即候选；禁止拿内部研究脚本的其他实验分支当成已选模型。

复现命令（保存下文为reference.py）：

```sh
python3 reference.py 6.25e-8 0.015 BDF2
python3 reference.py 2.5e-7 0.015 BE
```

参考脚本SHA-256：`f637706ebeb5ee2f20d6141a612422be1a9d529f1749db620c1d09bafbffa191`。原始独立研究脚本SHA-256：`5ee1206040aee7289e3e368ac1b433d5139ac5c43300bc40fd458f84401a31d3`；主BE探索脚本：`13149300f9e694e84fcd07a68d40b6510122f41be5214bfd0780864776b7f70b`。前两命令与表格为持久证据，不以本机/tmp路径作为唯一交接来源。

<details>
<summary>完整固定候选独立计算脚本（BE/BDF2；未加入LTE控制）</summary>

```python
"""Offline virtual-model reference only, no app code or device calibration.
Four nodes P,A,B,D plus algebraic load current iL=D/18 (L=0).
Cold start, one 100 us ramp; reciprocal EM plus 10/5 pF linear junction caps.
Independent-research solver, narrowed to the candidate; BE or variable BDF2.
No avalanche, repeated stimulus, sound output, dependencies or file writes.
Not approved; no local truncation error controller; maximum-step refinement required.
"""
import math, json, sys, time

VT=0.02585
IS=1e-14
# Fixed unapproved virtual teaching reference, not a 2N3904/3906 device fit.
BF=100.
L=0.
H=float(sys.argv[1]) if len(sys.argv)>1 else 6.25e-8
STOP=float(sys.argv[2]) if len(sys.argv)>2 else 0.015
CP=1e-11
AV=False
BFP=50.
RAMP=1e-4
METHOD=sys.argv[3] if len(sys.argv)>3 else 'BDF2'
if METHOD not in ('BE','BDF2'):raise ValueError('method')

BR=1.
C=100e-9

def lin_solve(m,b):
    n=len(b); a=[row[:]+[v] for row,v in zip(m,b)]
    for k in range(n):
        p=max(range(k,n),key=lambda j:abs(a[j][k]))
        if abs(a[p][k])<1e-30: raise ArithmeticError('singular')
        a[k],a[p]=a[p],a[k]
        for j in range(k+1,n):
            q=a[j][k]/a[k][k]
            for z in range(k+1,n+1): a[j][z]-=q*a[k][z]
            a[j][k]=0
    x=[0.]*n
    for k in range(n-1,-1,-1):
        x[k]=(a[k][n]-sum(a[k][z]*x[z] for z in range(k+1,n)))/a[k][k]
    return x

def ex(v):
    z=v/VT
    if z>60:
        y=math.exp(60)
        return IS*(y*(1+z-60)-1), IS*y/VT
    y=math.exp(z)
    return IS*math.expm1(z), IS*y/VT

def residual(x,prev,h,src,jac=True):
    p,a,b,d,i=x
    f=[(p-src)/47+(p-a)/120000,(a-p)/120000,0.,i,((i-prev[4])*L/h+18*i-d)/18]
    j=[[0.]*5 for _ in range(5)]
    j[0][0]=1/47+1/120000;j[0][1]=-1/120000
    j[1][0]=-1/120000;j[1][1]=1/120000
    j[3][4]=1;j[4][4]=(L/h+18)/18;j[4][3]=-1/18
    gc=C/h;ic=gc*((a-d)-(prev[1]-prev[3]))
    f[1]+=ic;f[3]-=ic
    j[1][1]+=gc;j[1][3]-=gc;j[3][1]-=gc;j[3][3]+=gc
    def stamp(bidx,cidx,eidx,pol):
        vb=x[bidx];vc=x[cidx];ve=x[eidx] if eidx is not None else 0
        ef,gf=ex(pol*(vb-ve));er,gr=ex(pol*(vb-vc))
        beta=BF if pol==1 else BFP
        ib=ef/beta+er/BR
        ic=ef-er*(1+1/BR)
        vals=[ib,ic,-(ib+ic)]
        # Normalized terminal derivatives w.r.t. normalized (vbe,vbc).
        ds=[(gf/beta,gr/BR),(gf,-gr*(1+1/BR)),(-gf*(1+1/beta),gr)]
        for row,val,(df,dr) in zip((bidx,cidx,eidx),vals,ds):
            if row is None:continue
            f[row]+=pol*val
            j[row][bidx]+=df+dr
            j[row][cidx]-=dr
            if eidx is not None:j[row][eidx]-=df
        for n1,n2,cap in [(bidx,eidx,CP),(bidx,cidx,CP/2)]:
            if not cap:continue
            cv=x[n1]-(x[n2] if n2 is not None else 0)
            pv=prev[n1]-(prev[n2] if n2 is not None else 0)
            cg=cap/h;ci=cg*(cv-pv)
            f[n1]+=ci;j[n1][n1]+=cg
            if n2 is not None:
                f[n2]-=ci;j[n1][n2]-=cg;j[n2][n1]-=cg;j[n2][n2]+=cg
    stamp(1,2,None,1)
    stamp(2,3,0,-1)
    return f,j

def step(prev,h,t):
    src=9*min(1,t/RAMP)
    x=prev[:]
    for it in range(75):
        f,j=residual(x,prev,h,src)
        norm=max(abs(v) for v in f)
        if norm<1e-9:return x,it,norm
        dx=lin_solve(j,[-v for v in f])
        fac=min(1.,0.2/max(1e-30,max(abs(v) for v in dx[:4])),0.02/max(1e-30,abs(dx[4])))
        while fac>1e-9:
            xn=[v+fac*w for v,w in zip(x,dx)]
            fn,_=residual(xn,prev,h,src)
            if max(abs(v) for v in fn)<norm:break
            fac*=0.5
        else:raise ArithmeticError('line search stalled '+repr((t,x,norm)))
        x=xn
    raise ArithmeticError('Newton exhausted '+repr((t,x,norm)))

def run():
    x=[0.]*5;t=0;h=H;reject=0;maxit=0;maxres=0.;tail=[];rises=[];last=0;mins=[float('inf')]*5;maxs=[-float('inf')]*5;tic=time.monotonic();older=None;oldh=H;count=0;minh=H
    biasmin=[float('inf')]*4;biasmax=[-float('inf')]*4;currmax=[0.]*5
    while t<STOP:
        hn=min(h,STOP-t)
        effective=x;heff=hn
        if METHOD=='BDF2' and older is not None:
            ratio=hn/oldh;aa=(1+2*ratio)/(1+ratio)
            effective=[((1+ratio)*v-ratio*ratio/(1+ratio)*w)/aa for v,w in zip(x,older)]
            heff=hn/aa
        try:y,it,res=step(effective,heff,t+hn)
        except ArithmeticError:
            h*=0.5;reject+=1
            if h<1e-13:raise
            continue
        if x[3]<1<=y[3]:rises.append(t+hn*(1-x[3])/(y[3]-x[3]))
        t+=hn;older=x;oldh=hn;x=y;count+=1;minh=min(minh,hn)
        if t>STOP/2:
            for k,v in enumerate(x):mins[k]=min(mins[k],v);maxs[k]=max(maxs[k],v)
            biases=[x[1],x[1]-x[2],x[0]-x[2],x[3]-x[2]]
            for k,v in enumerate(biases):biasmin[k]=min(biasmin[k],v);biasmax[k]=max(biasmax[k],v)
            fn,_=ex(biases[0]);rn,_=ex(biases[1]);fp,_=ex(biases[2]);rp,_=ex(biases[3])
            currents=[fn/BF+rn/BR,fn-(1+1/BR)*rn,fp/BFP+rp/BR,fp-(1+1/BR)*rp,(9-x[0])/47]
            for k,v in enumerate(currents):currmax[k]=max(currmax[k],abs(v))
        if len(tail)<20 or t-last>STOP/100:
            tail.append([t]+x);last=t
        maxit=max(maxit,it);maxres=max(maxres,res)
        if it<7:h=min(H,h*1.5)
    print(json.dumps({'BFN':BF,'BFP':BFP,'BR':BR,'IS':IS,'VT':VT,'L_proposed':L,'CBE_proposed':CP,'CBC_proposed':CP/2,'avalanche_teaching_proposal':AV,'supply_ramp_s':RAMP,'method':METHOD,'h_max':H,'h_min':minh,'steps':count,'stop':STOP,'final':x,'tail_min':mins,'tail_max':maxs,'normalized_bias_min_NBE_NBC_PEB_PCB':biasmin,'normalized_bias_max_NBE_NBC_PEB_PCB':biasmax,'abs_current_peak_NB_NC_PB_PC_SOURCE':currmax,'rises_1V':rises[-30:],'rise_count':len(rises),'reject':reject,'maxit':maxit,'maxres_A':maxres,'wall_s':time.monotonic()-tic,'sample':tail[-10:]},indent=2))

if __name__=='__main__':run()

```

</details>

本脚本用于独立算例，不是可复制为生产求解器的成品：它未实施局部积分误差/所有失败预算/取消/迁移/UI。其结果不代表应用验收。
