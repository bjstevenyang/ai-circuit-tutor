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

## 验收执行记录

以下是实际实现证据记录，不改变批准后的需求。尚未执行的内容不得标通过。

| 验收 | 测试／命令／结果 |
| --- | --- |
| EX2-01/02 | rgb.test.ts、stage2-regression.test.ts：通道／七组合／限值／唯一性／端点证据；模型通过，浏览器RGB从空板及修复通过 |
| EX2-03/04 | npn.test.ts：批准三态、源电流、去参考失败／恢复；stage2-regression.test.ts：基极限流／课程超限。模型与NPN浏览器从空板流程通过 |
| EX2-05/06 | transient.test.ts及Stage2.test.tsx：0/1τ/5τ、连续充放电／保持、停止／重启／后台、R延续及C应用停止；RC浏览器流程通过 |
| EX2-07/08 | piezo.test.ts：三频率／Vpp／电流守恒／衰减／DC／断开；useBuzzerSound与压电浏览器流程通过，设备试听未做 |
| EX2-09/10 | stage2-regression.test.ts、Stage2.test.tsx：安装四方向／拒绝重叠、v4往返／剥离瞬态／v1–v3迁移、频率与容量边界；35个旧Chromium场景通过 |
| EX2-11 | 四实验均有合法物理fixture，从空板表单搭建、错误到修复；新元件说明只读与引脚测试通过。人工门槛未执行 |
| EX2-12 | 待固定 B／M 基准；硬件不符或工具不可用时明确未验证 |

人工教师／学生、实际辅助技术、设备试听尚未执行。自动化不替代人工教学有效性结论。仅 Chromium，不运行 Firefox／WebKit；不公开部署。

当前验证快照：`npm test -- --reporter=json --outputFile=/tmp/ai-circuit-stage2-tests.json` 298/298；之后声音更新相关2文件11项复验通过。`npm run build`及`npm run lint`通过；既有Chromium35/35，新四实验各通过。尚在补充固定性能规程及最终完整复验，不将当前记录视为完整EX2验收。

本机为Apple M1 Pro／16 GB、macOS 26.5.1，与批准M1／8 GB不同；本机性能只能作为补充，目标设备门槛仍未验证。用户再次明确许可执行性能及两组真实长运行检查。原一次性能命令许可被拒绝，未绕过，得到许可后再继续。
