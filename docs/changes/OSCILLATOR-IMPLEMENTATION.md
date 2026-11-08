# CR-OSCILLATOR 实施确认与验收证据

## 实施前确认（2026-11-08）

本文件记录实现和实际验证，不改变已合并需求。初始状态：实施确认完成，业务代码尚未修改；当前进度见末节，OSC-01–06尚未完成验收。最终实现由用户体验验收和合并，不公开部署，仅Chromium。

- 仓库：`bjstevenyang/ai-circuit-tutor`，origin=`git@github.com:bjstevenyang/ai-circuit-tutor.git`。
- 原工作区：`/Users/stevenyang/workspace/ai-circuit-tutor`，原分支`codex/stage-2-implementation`、HEAD `40dd29ed6eafae43afc7d84bc02d3188daee1b22`、干净，保留不修改。
- 已实现功能基线：上述40dd，阶段2用户合并SHA `f80a1703cd95d18ad51af1ce8d693527afd92fd3`；其335模块/44 Chromium等是历史验证，不冒充本轮结果。目标设备/人工未验证边界见[阶段2记录](STAGE-2-IMPLEMENTATION.md)。
- 需求PR [#5](https://github.com/bjstevenyang/ai-circuit-tutor/pull/5)实际已合并；实施采用的主线完整SHA **`4a3340cc0263985c6d5b5bf810b794bcdb5c0454`**。启动时GitHub master实际等于该SHA；已检查阶段2合并为其祖先。
- 原独立审查head `b7cfe8103341a206e1ca3d893821b89a608d3a24`与主线合并SHA完整树相同，不能用原head代替主线基线。真实[双轴PASS](https://github.com/bjstevenyang/ai-circuit-tutor/pull/5#issuecomment-6726111136)、[Verify #52](https://github.com/bjstevenyang/ai-circuit-tutor/actions/runs/42511599720) completed/success及[合并/派发](https://github.com/bjstevenyang/ai-circuit-tutor/pull/5#issuecomment-6726123858)已读取核对。
- 实现隔离工作区：`/tmp/ai-circuit-oscillator-implementation`，分支`codex/oscillator-implementation`，从该需求SHA创建，起始干净；此前无同名worktree/分支/开放PR，不重复创建。首次push显式配置origin upstream，随后在此分支提交推送。
- 派发键：`bjstevenyang/ai-circuit-tutor|CR-OSCILLATOR|implementation|4a3340cc0263985c6d5b5bf810b794bcdb5c0454|start-1`。只在此工作区写本任务，不写需求作者工作区。

### 已核验授权与规范

[PR #4原问答](https://github.com/bjstevenyang/ai-circuit-tutor/pull/4)转录用户直接“授权需求自动合并并实施”，覆盖指定NPN+PNP实验、独立实现分支/Draft PR、编码/测试/返修；最终实现用户合并。普通Git持续授权见PR #5，[GitHub评论持续授权](https://github.com/bjstevenyang/ai-circuit-tutor/pull/6#issuecomment-6724908332)及[两个唯一聊天双向授权](https://github.com/bjstevenyang/ai-circuit-tutor/pull/5#issuecomment-6718387899)已核验，不为同范围反复申请。

已读取固定需求SHA下AGENTS、[交接协议](AUTOMATED_HANDOFF.md)、[流程](README.md)、[CR](CR-OSCILLATOR.md)、[PRD](../PRD.md)、[电路模型](../CIRCUIT_MODEL.md)、[设计](../SYSTEM_DESIGN.md)、[测试计划](../TEST_PLAN.md)的完整OSC规格及[完整分析归档](CR-OSCILLATOR-IMPACT.md)。部分标题仍保留需求提交时“待审查”的历史状态，实际授权/合并依据为上述GitHub记录；不把旧分析建议中未采用部分当规范。

## 范围、差异与切片

采用显式`legacy-stage2-v1`/`oscillator-em-v1`及v5配置。新增PNP/speaker，47–220nF电容；纯circuit EM+10/5pF结C、隐式BE步加倍LTE、模型域/12未知量/迭代和步数预算；内置Worker、5s截止、代际取消；40ms有限观察和冻结周期/DC判据；speaker实际端口频率/RMS的许可后正弦声音；中文说明和三级证据提示。

不新增依赖/服务/费用/公开部署，不用隐藏方波、固定290Hz、1/RC、目标图匹配或预置波形代替求解；不宣称真实3904/3906/SL27001或真实安全。基础测量/EX1继续暂缓，不进入其他阶段。

1. 配置切片：安装、两profile、容量单位及v5迁移/历史，补对应测试。
2. 数值切片：通用有限网络编译/EM/内部电荷/BE-LTE/预算和独立参考、变体/反例/等价性，先核数值。
3. 会话切片：Worker取消/过期结果、完整事件表、40ms分类/声音/说明/提示及Chromium流程。
4. 交付切片：必要回归/typecheck/lint/build、固定有限性能、逐ID证据；全新只读Standards/Spec审查及定向返修（最多3轮）；最终用户验收，不自行合并。

### 全部新增/修改适用规则/回归

新增OSC-01–06，无删除。旧AC-01–19/EX2-01–12保留；新profile适用差异已在需求冻结：

| 范围 | 前行为 → 本轮适用规则 |
| --- | --- |
| OSC-01 | 无PNP/speaker → 两封装四方向明确端点、物理原子拒绝、键盘搭建、六项中文说明 |
| OSC-02 | 旧10–1000μF/分段NPN → 新profile47–220nF、100nF=.1μF、冷态及BE-LTE；旧默认/范围不变 |
| OSC-03 | 参考网络不支持 → 独立五上穿/周期/8相位/RMS/源流、两档误差及五变体 |
| OSC-04 | 蜂鸣器/外驱压电 → speaker负载反馈/端口交流音频/许可/清理，不变旧音频 |
| OSC-05 | 无该网络结果语义 → 精确删C/R1/speaker、旁路/短接/错脚等逐例，DC/无周期/限制不混同；提示有时刻和端点 |
| OSC-06 | 无新profile/v5/非线性预算 → 三布局等价、迁移/历史/全事件/Worker/12–13未知量及固定性能 |
| EX2-03/04 | 旧低侧NPN/5和50mA课程限值完整保留；新EM传导域≤250mA不等于真实安全 |
| EX2-05/06、AC-06/11/17/18 | 旧RC连续/后台续算/1×60s保留；新有限窗/参数控制冷重算/后台取消、恢复冷启、旧代际无效 |
| EX2-07/08、AC-12 | 压电/有源蜂鸣器保留；speaker独立模型驱动及许可/静音/清理 |
| EX2-09/10/11/12、AC-02/08/13/14 | 新安装/profile/v5/说明/专用预算，旧门槛不放宽 |
| 其余AC、EX2-01/02 | 显式连接/物理/编辑/键盘/保存/LED/RGB/电位器等旧功能回归，无行为变化 |
| EX1-01–05 | 仍暂缓 |

影响circuit类型/目录/校验/分派和新瞬态核心，editor命令/图形/参数，app会话/Worker/读数/音频，storage、tutor、测试及实际验证文档。风险：刚性积分和LTE可能触发预算；有限窗口无周期不代表没电或永不起振；所有接受状态/读数必须有方程依据；旧迁移/模式不能静默改变；取消/后台不得复活旧结果。若冻结数值/性能确实不可达，回报具体失败，不在实现PR改需求/放容差。当前没有阻塞范围歧义，授权和冻结规格一致，继续实施。

## 逐项验收证据入口

所有“待执行”均非通过记录，后续逐项填写真实文件/场景/命令/结果和完整代码SHA。

| 验收 | 必需场景/证据 | 命令/实际结果 | 代码SHA |
| --- | --- | --- | --- |
| OSC-01 | catalog/editor四方向/拒绝/取消/键盘参考搭建/六项说明 | 待执行 | 无业务提交 |
| OSC-02 | profile/容量双单位/边界/非法、v5、零态/上电/LTE/KCL/失败及旧RC | 待执行 | 无业务提交 |
| OSC-03 | 独立REF两档五上穿/8相位/周期/RMS/源流及5变体 | 待执行 | 无业务提交 |
| OSC-04 | 端口频率/交流强度、交换/旁路、API/音量/许可/停止/后台/卸载 | 待执行 | 无业务提交 |
| OSC-05 | 所有冻结反例/β负对照/分类/三级提示/修复 | 待执行 | 无业务提交 |
| OSC-06 | 3布局/顺序/颜色/折点/v1–v5/50步/全事件/旧代际/12–13预算/固定性能和旧回归 | 待执行 | 无业务提交 |

类型/静态/构建/模块/Chromium、固定性能及CI实际结果后续记录；仅相关切片后补完整必要检查，无新改动或疑点不重复长测。新有限窗性能按冻结3次预热/20样本/P95、停止两场景及20次内存规程，不套用阶段2十分钟RC长测。

## 未执行/人工边界与审查

M1/8GB目标性能、真实后台/失焦、读屏、200%缩放、设备试听、教师和至少3名学生任务当前全部未执行。可用本机性能仅补充，不冒称目标设备通过；无环境时真实列交付边界，不无限等待。独立实现审查/协调者需求覆盖尚未执行；作者不自认独立审查者，不批准或合并实现PR。

实施确认当前只有本文档，验证为基线/主线/合并/授权/规范/验收映射和文档差异检查，不运行与纯确认无关的应用测试。后续实际结果在本记录和实现PR更新。

## 数值切片实际失败（2026-11-08）

[冻结hmin/LTE失败及独立复现](OSCILLATOR-INTEGRATION-BLOCKER.md)：首次反馈跳变约0.788093ms时，冻结10ps下限的LTE仍>1，数值切片明确失败，尚未产生所需5次上穿。未放宽任何需求。归档的独立参考加相同控制器从零态复现，已排查本地最小步建议bug并重跑。依赖数值的OSC-02/03/04/05和OSC-06动态/性能部分暂停，独立安装/profile/单位/迁移继续；不能将部分配置通过冒充完整OSC通过。

相关命令`npm test -- src/circuit/oscillator/numeric.test.ts`实际失败；本地业务改动仍未提交，没有推送失败业务测试或声称CI通过。本轮新增文档记录事实，不修改冻结需求；完整独立失败命令在上述文档，后续数值恢复需要核对修订的已合并需求SHA。
