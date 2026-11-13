# 测试与发布验证

更新：2026-11-01，v0.3。验收来源：[PRD](PRD.md)，数值依据：[CIRCUIT_MODEL](CIRCUIT_MODEL.md)，文件及逐项列表：[TEST_INVENTORY](TEST_INVENTORY.md)。计划和实际执行结果分别记录。

## 规划优先级调整检查：2026-11-03

本次仅修改规划与决策记录，授权见 DECISIONS D43。阶段 1 EX1-01–EX1-05 从下一优先批次改为暂缓，验收行为原文保留；无新增或删除验收 ID。AC-01–AC-19 及其回归要求不变；阶段 2 尚待细化验收，不宣称已有覆盖或通过。

文档验证检查阶段优先级、交接建议、五项 EX1 的保留及本地 Markdown 引用，并执行 `git diff --check` 和差异审阅。应用代码、电气模型、状态与存档均未变化，因此本次不运行应用测试或浏览器测试；历史通过记录不作为本次复验结果。

## 测试映射

| 验收 | 自动化覆盖 | 人工补充 |
| --- | --- | --- |
| AC-01 | 420² 孔位对独立期望、隔离、电源轨、导线桥接／删除；按钮两组触点、开关与零阻滑臂 | 核对可见封装与连接说明 |
| AC-02 | 八类安装、旋转、多脚占用、边界、本体重叠、原子拒绝、规模限额 | 多元件摆放是否容易理解 |
| AC-03 | 导线显式端点、颜色／交叉／折线等价、命中及删除；起点／终点改接保留 ID／样式，失败原子拒绝 | 密集接线可读性 |
| AC-04 | 手算串并联、单颗／多颗 LED、二极管压降、空载／带载分压、桥式电阻、光敏曲线 | 教师核对模型与课程 |
| AC-05 | 源短路、无限流、旁路、断路、反向、供电不足、单 LED 超限、非唯一解／无效文档拒绝 | 提示是否准确归因 |
| AC-06 | 三层内容、主动递进、上限、旧结果／提示失效，真实反向修复流程 | 前两层是否过早泄露答案 |
| AC-07 | 50 步历史、撤销／重做、重置、拖动一次提交、失败／取消无历史、按钮不保存 | 操作可恢复性 |
| AC-08 | 八类参数及电压往返、v1／v2 → v3、未知版本／损坏保护、存储失败、刷新恢复 | 存储被禁用、清理数据的说明 |
| AC-09 | 表单和纯键盘流程；元件缩放拖动、占用／越界回退、Esc；拖动连线、已有线端点改接、同端点拒绝、取消后点击连线及改接表单键盘路径 | 读屏、200% 缩放、焦点、触控板 |
| AC-10 | 不造未知数值、课程限流、成功语义与模型边界 | 学生能否理解教学近似 |
| AC-11 | 运行中开关本体点击／键盘切换，重复按键／拖动不误切换；按钮键盘／鼠标及失焦释放、电位器与光照即时更新、逐实例 LED 电流 | 多输出电路理解 |
| AC-12 | 音频默认不启动、主动启用、音量 0–100%、平滑增益、0% 静音、不重启振荡器、过压／停用／卸载清理、不可用兜底；浏览器实际音频 API | 实际声音、系统静音和听觉舒适度 |
| AC-13 | 八类器件说明、三种选择入口、键盘浏览、真实引脚孔位随实例移动更新、切换无过期内容、纯查阅不改变文档／历史／诊断／提示，运行中开关切换／黄色按钮按压操作例外 | 教师检查术语与示例，学生是否理解，说明卡排版 |
| AC-14 | 自定义电阻／电压边界、非有限／不完整输入拒绝，预设和小数／科学计数法、单次应用、无变化保护、保存／撤销与迁移 | 数值单位与错误信息是否易懂 |
| AC-15 | 电流到亮度的独立期望、单调和封顶、未知与截止区别、电位器变阻调光、并联 LED 独立显示 | 相对亮度易辨认、不被误认为真实光度 |
| AC-16 | 四个方向的极性与实际孔位、正向文字、预览、方／圆脚和 K 平边、可访问说明 | 常用缩放下标记可读，真实读屏 |
| AC-17 | Simulation.test.tsx 六项及 Chromium B29／B30：开始／停止／恢复、清除诊断提示与读数、释放按钮、光声停止、作品／历史保留、停止编辑不重启、刷新停止；旧流程全部回归 | 运行状态和开关通断的区别是否易理解 |
| AC-18 | A49–A51、B31–B33：直接按住黄色圆钮，移出后释放、本体键盘重复／释放、失焦、Esc、取消、停止；不保存／不加历史、按压不移动、外壳拖动及单步撤销；B21 只读路径改为灰色外壳 | 学生能否分辨保持开关与瞬时按钮，是否容易找到按压和移动区域 |
| AC-19 | E63–E67、A52、B34／B35：A／W／B 逐脚映射、四方向正向文字、预览无重复 ID、移动同步、内部阻值更新、查阅不编辑；按说明从空板搭建 A–W 调光并验证亮度变化 | 标记在常用缩放下可读，学生能否区分内部电阻段和外部接线 |

连接期望独立表达五孔组规则，不调用被测分组算法。数值采用手算及明确容差，含基尔霍夫电流守恒。拓扑单元样例可直接引用引脚以隔离电气行为；保存、UI 和浏览器样例另经完整物理约束验证。测试不把求解器输出当作自身期望。

## 执行方式

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e -- --project=chromium
```

按用户最新要求先只验证 Chromium（Chrome 引擎），CI 同步采用该配置。Playwright 保留 Firefox／WebKit 项目，后续用户要求后再运行；不能把配置存在视为已通过。浏览器测试独立上下文和本地样例，不读取学生作品。

## 电位器引脚与接线说明验证：2026-11-01

| 检查 | 结果 |
| --- | --- |
| 引脚回归 | 新增四方向及预览的 5 项标记测试，在改动前因无逐脚标签而失败，改动后通过 |
| 类型／静态检查 | `npm run typecheck`、`npm run lint` 通过 |
| Vitest | `npm test -- --reporter=json --outputFile=/tmp/ai-circuit-pot-pins-tests.json`，14 个文件、240 项全部通过；新增 6 项 |
| Chromium E2E | `npm run test:e2e -- --project=chromium --workers=2`，35/35 全部通过；新增 2 个场景 |
| 生产构建 | `npm run build` 通过，主 JS gzip 约 98.51 kB；无新依赖、电气模型或存档格式变化 |
| 截图 | 已查看实际调光电路、接线面板和 90° 引脚局部截图；其余方向有自动化断言与截图，不作为已人工核对全部方向的结论 |
| 未执行 | 按用户要求未运行 Firefox／WebKit；远端 CI 未预先核对，学生理解和辅助技术仍待人工验证 |

当前结果以本记录为准，以下保留历史验证。

## 黄色按钮本体修复验证：2026-11-01

| 检查 | 结果 |
| --- | --- |
| 缺陷复现 | `npm run test:e2e -- --project=chromium --workers=1 --grep 'pressing the round button body'` 在修复前失败：实际按住黄色圆钮后没有“亮起来了”；修复后同一路径通过 |
| 类型／静态检查 | `npm run typecheck`、`npm run lint` 通过 |
| Vitest | `npm test -- --reporter=json --outputFile=/tmp/ai-circuit-button-body-tests.json`，14 个文件、234 项全部通过；新增 3 项 |
| Chromium E2E | `npm run test:e2e -- --project=chromium --workers=2`，33/33 全部通过；新增 3 个场景；原绿色开关场景另重复 3 次均通过 |
| 生产构建 | `npm run build` 通过，主 JS gzip 约 97.69 kB；无新依赖或电气模型变化 |
| 截图 | 已查看黄色按钮按下及 LED 导通时的工作台截图，状态栏和下方操作说明已区分两类控件 |
| 未执行 | Firefox／WebKit 按用户要求未执行；当前远端 CI 未预先核对，真实读屏／设备／学生试用仍待人工检查 |

该轮根因是黄色按钮的 SVG 本体没有传递临时按压，旧自动化只验证绿色保持开关或下方按压控件，测试对象与用户操作不一致。以下保留历史记录。

## 运行／停止补充验证：2026-11-01

| 检查 | 结果 |
| --- | --- |
| TypeScript strict、ESLint | `npm run typecheck`、`npm run lint` 通过；初次检查发现的测试选项／只读类型错误已修正并复验 |
| Vitest | `npm test -- --reporter=json --outputFile=/tmp/ai-circuit-stop-tests.json`，14 个文件、231 项全部通过；本次新增 6 项 |
| 生产构建 | `npm run build` 通过，主 JS gzip 约 97.34 kB；没有新增依赖 |
| Chromium E2E | `npm run test:e2e -- --project=chromium --workers=2`，30/30 全部通过；本次新增 2 个场景 |
| 截图 | 已查看工作台截图，运行状态和停止按钮清晰可见；不代表完整可访问性审计 |
| 声音 | 验证实际浏览器振荡器停止／恢复；没有进行真实设备试听 |
| Firefox／WebKit、远端 CI | 前两者按用户要求未执行；当前提交的 CI 结果未预先检查 |

以上为运行／停止这一轮的验证结果，以下保留更早版本记录。

## v0.3 参数更新记录：2026-11-01

| 检查 | 结果 |
| --- | --- |
| TypeScript strict | `npm run typecheck` 通过 |
| ESLint | `npm run lint` 通过 |
| Vitest | 13 个文件、225 项全部通过；本版新增 70 项 |
| 生产构建 | `npm run build` 通过，主 JS gzip 约 97.10 kB；未新增依赖 |
| Chromium E2E | `npm run test:e2e -- --project=chromium --workers=2`，28/28 全部通过；本版新增 7 个场景 |
| LED 截图 | 已查看 A＋／K−、平边和光晕局部截图；四个方向另有 DOM／浏览器断言 |
| 音量 | 已验证实际浏览器音频增益与平滑控制；未进行真实输出设备试听，不推断主观响度 |
| Firefox／WebKit | 按用户要求未执行 |
| CI | 当前改动的远端结果待提交后实际运行，不预先声称通过 |

本轮把“运行中开关本体点击”明确作为编辑操作；查阅元件盒仍为只读。全部现有 Chromium 场景已随本版重新执行，以下 v0.2 记录仅作为历史。

## v0.2 实际记录：2026-10-31

| 检查 | 结果 |
| --- | --- |
| TypeScript strict | `npm run typecheck` 通过 |
| ESLint | `npm run lint` 通过 |
| Vitest | 9 个文件、155 项全部通过；含元件扩展 62 项、已有线改接 9 项及元件说明 12 项新增测试 |
| 生产构建 | `npm run build` 通过，主 JS gzip 约 94.72 kB；无新增依赖 |
| Chromium E2E | 21 个场景全部通过；含元件／拖动 9 个、已有线改接 3 个、元件说明 2 个新增场景 |
| 桌面截图 | 已查看 Chromium 元件盒及按钮／电位器说明卡布局；这不是完整可访问性审计 |
| Firefox／WebKit | 用户收窄浏览器范围后未再执行；不能宣称最新版通过 |
| CI | 已改为仅 Chromium；远端运行结果尚待实际检查 |

首轮三引擎检查共 35/42 通过；发现 WebKit 鼠标按下后默认失焦会提前释放按钮，已显式管理焦点并阻止默认动作。该修复在 Chromium 复测通过；用户随后要求仅测 Chrome，因此 WebKit 修复未复测。另修正了二极管样例接线和重复文本定位。拖动连线加入后 Chromium 为 16/16；已有线改接加入后为 19/19 通过。最终将端点事件直接挂到手柄后，相关 32 项模块／界面测试和 3 个 Chromium 改接场景再次通过，Lint 与构建通过。

元件说明新增的 12 项界面回归及 2 个 Chromium 场景通过；通用教学内容与电路诊断分别展示，查阅不会消耗提示或修改电路。静态内容依据电路模型及系统设计列出的基础资料核对，仍需教师及学生试用验证理解程度。

当前模块测试验证模型，Chromium 验证浏览器事件／命中／音频 API 控制；都不能替代真实器件测试或学生理解验证。

## 发布门槛

- [x] 类型、静态检查、模块／交互测试和生产构建通过。
- [x] 当前获准的 Chromium 完整流程通过。
- [ ] Firefox／WebKit 最新版流程；实际 Chrome、Edge、Firefox、Safari 冒烟检查。
- [ ] 读屏、可见焦点、无陷阱、200% 缩放和实际触控板人工验证。
- [ ] 目标年龄学生能搭建、解释连接组并借助提示修复；记录理解困难。
- [ ] 教师审阅全部扩展器件近似、提示与课程适配。
- [ ] 公开托管及发布获授权；当前不公开部署。

## 历史基线

v0.1 首次 MVP 为 66 项 Vitest；删除交互修复后为 72 项和 7 个浏览器场景。删除快捷键、可见按钮、输入保护、撤销及刷新回归曾在 Chromium 单独通过；当时全套三引擎尚未完成。当前 v0.3 记录取代旧版本验证状态，不把过去通过的结论自动沿用到新行为。

## PR 流程文档验证：2026-11-03

仅修改 AGENTS、PRD、决策、CR 流程／模板／三个草案和 PR 模板。产品验收 ID 无增删或行为变化。验证：本地 Markdown 引用、三个阶段草案与模板字段、差异审阅、`git diff --check`；结果在本次交付报告记录。应用／浏览器测试不适用于本次纯文档变化，未运行。自动触发器、分支保护和跨工具自动审查未配置、未验证。

## 两 PR 流程同步验证：2026-11-03

本次替换单 PR 规则并同步流程、CR 模板、PR 模板、阶段草案和 PR 描述；D44 仅保留为已被 D45 取代的历史。检查两类 PR 的边界、先合并需求再实施、固定主线需求 SHA、squash／rebase 对应、三个阶段和微小变更例外的一致性，执行本地 Markdown 链接检查、旧规则检索与 `git diff --check`。产品验收无变化；纯文档调整不运行应用／浏览器测试。新触发器及自动化交接未配置、未验证。


## 阶段 2 需求提案验证：2026-11-03

新增 EX2-01–12 均为待批准验收，不是已执行测试；AC-01–19 不修改，EX1-01–05 保持暂缓。产品行为提案见 PRD；模型、生命周期、存档和驱动源待决见 CR-STAGE-2 Q1–Q6。现有测试不构成新增器件覆盖。

| ID | 拟测试位置／独立场景 | 未来命令 | 本次实际结果 |
| --- | --- | --- | --- |
| EX2-01 | circuit、appearance、Chromium：四方向映射、单通道／组合混色；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-02 | circuit、tutor：逐通道错误、共阻非唯一；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-03 | circuit：基极断开、有效驱动及负载手算；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-04 | circuit、tutor：缺限流、反接、不支持区；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-05 | circuit：RC 在 0/1τ/5τ，R/C 变化，误差与重复运行；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-06 | app、Chromium：停止、重启、编辑、撤销、刷新、后台逐场景；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-07 | circuit、app：DC、有效／越界频率、驱动移除；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-08 | useBuzzerSound、Chromium：许可、静音、清理、API 不可用；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-09 | editor、Chromium：四器件非拖动编辑、物理拒绝及合法错误；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-10 | storage、editor：新参数往返、旧格式迁移及失败保护；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-11 | ComponentGuide、Chromium：说明只读及四参考实验；教师／学生另验；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |
| EX2-12 | circuit、Chromium：批准规模边界、超限与运行预算；具体测试文件／名称待规格确定后建立 | `npm test`；涉及浏览器时 `npm run test:e2e -- --project=chromium` | 未执行，尚无实现；不是通过记录 |

回归映射：AC-01/03 网络端点；02/09 安装编辑与键盘；04/05 数值／诊断；06 证据提示；07/08 历史／存档；10/13 教学说明；11/15/16/19 控制与显示；12 音频；14 参数；17/18 停止与按钮释放。AC-11/17 对动态器件的差异仍须确定，不以新增 ID 隐式替换旧要求。

本轮纯文档检查：`git diff --check`、本地 Markdown 文件引用检查、EX2 定义唯一性与 12 项逐项映射检查、`git diff` 人工审阅；实际结果见 PR 及交付报告。应用类型／构建／模块／Chromium 测试未运行，因无业务代码变化；Firefox／WebKit 不运行。真实读屏、设备试听、教师审阅和教学有效性未执行。独立 Work 审查、新事件触发器和分支保护均未在本轮配置或验证；不预报远端 CI 结果。

实际执行：`python3 /tmp/ai-circuit-stage2/check_docs.py` 通过（6 份文档边界、本地文件引用、12 项 EX2 唯一定义与逐项映射、既有 AC／EX1 表行不变、HEAD 业务代码与功能基线一致）；`git diff --check` 通过；已审阅全部文档差异。校验脚本为本轮临时工具，不是仓库测试依赖。


## 阶段 2 只读技术影响分析：2026-11-03

报告见 [CR-STAGE-2-IMPACT](changes/CR-STAGE-2-IMPACT.md)，输入需求 head `27c39b523264e86defce2683648e71a1308a322b`，实际实现基线 `06ab7572452f8b078ec06f62c55ed54543f5c75c`。本轮将逐项拟测试位置、独立基准、时间／性能边界和 Q1–Q6 阻塞映射集中在报告第 9–11 节；不改写 AC-01–AC-19、暂缓 EX1 或 EX2-01–EX2-12 的权威验收行，不新增业务测试文件。

实际检查：本地分支／SHA／远端 refs 与 GitHub PR head 一致；从功能基线到输入 head 的业务源码、测试及依赖／入口配置无差异；`src`／`tests` 树相同；逐模块静态检查和独立 Python RC 解析值计算完成；交付执行 `git diff --check`、本地 Markdown 引用、验收唯一性与映射、只含文档及业务树不变检查。输入 head 的 GitHub PR Verify run #22 已读取为 success，仅为旧功能／现有工作流证据。

新 EX2 数值／模型／生命周期／迁移／性能测试仍全部未执行，产品待决选择未获批准。纯文档分析不运行本地类型、构建、Vitest 或浏览器测试，Firefox／WebKit 不运行；没有性能测量、设备试听、独立 Work 审查或学生试用。报告新提交的 CI 结果须另行核对，不预先写为通过。

实际执行：`python3 /tmp/ai-circuit-stage2-impact/check_impact.py` 通过（允许的三个文档、SHA／分支／upstream、功能基线业务树及配置不变、AC／EX1／EX2 不变、12 项影响及拟测试映射、Q1–Q6／R1–R8、Markdown 引用和固定 SHA 代码链接）；`git diff --check` 通过。校验脚本仅为本轮临时工具。


## 阶段2教学方向收敛后的具体规格检查：2026-11-04

本节为当前提案证据计划；上述2026-11-03的“Q项待决／文件待定”为历史输入记录，不能覆盖本轮已同意方向。实际产品仍未实现；完整参数／验收版本待用户审阅。输入head `537bc86ee6b737dc50ca7a76b3538d951331e10e`，功能基线`06ab7572452f8b078ec06f62c55ed54543f5c75c`。来源为当前PRD、模型、设计及 [四实验脚本](changes/CR-STAGE-2-EXPERIMENTS.md)。

差异：EX2-01–12相对功能基线全部新增、相对原草案全部细化；无删除。AC-06/11/17新增动态模式适用规则，旧八类DC回归不变；其他AC-01–19继续回归；EX1-01–05暂缓。固定信号源有限模式属于用户同意的教学方向，具体电压／频率／负载模型和保存字段仍是作者待审阅提案。

| ID | 拟测试文件／具体独立场景 | 未来执行命令 | 本轮产品结果 |
| --- | --- | --- | --- |
| EX2-01 | src/circuit/rgb.test.ts、appearance.test.tsx、tests/e2e/components.spec.ts：E2-RGB七组合、330Ω及1kΩ电流／颜色、四方向和预览 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-02 | rgb.test.ts、tutor/index.test.ts：R100Ω超流、通道反向／旁路／无限流、等Vf共阻非唯一与不同Vf区别、修复证据 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-03 | src/circuit/npn.test.ts：E2-NPN含C至P的100k参考：断开唯一VC4.5 V；10k饱和／100k受控的LED/参考/Ib/Ic/Ie/源电流及KCL与重合边界 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-04 | npn.test.ts、tutor/index.test.ts：直连基极、反接、悬空、未支持拓扑、移除C参考且断开的非唯一反例、5/50mA限值及提示 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-05 | src/circuit/transient.test.ts：E2-RC 0/1τ/5τ、充转放连续、同时闭合／断开、R/C变化、稳态／保持、零R／浮置／多C／混接限制、两脚交换等价 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-06 | src/app/Simulation.test.tsx、Chromium：设计事件表每一行、旧回调、后台／失焦、60s、提示快照，AC-06/11/17差异和旧DC原规则 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-07 | src/circuit/piezo.test.ts、app：E2-PIEZO三频率／稳态Vpp、串1MΩ、交换脚、断开／旁路／DC、互斥源及频率非法输入 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-08 | src/app/useBuzzerSound.test.tsx、Chromium：模型频率／幅度、许可、音量0、API不可用、100ms更新及停止／后台／退出清理，旧有源回归 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-09 | src/editor/components.test.ts、model.test.ts、Chromium：四封装全部方向占孔／重叠／取消及真实安装，四实验非拖动搭建、合法错误可保留 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-10 | src/storage/index.test.ts、editor/model.test.ts、Chromium：v4新字段往返及瞬态剥离、v1/v2/v3迁移、50步历史／撤销、未知／损坏／写失败、超预算配置可恢复 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-11 | src/app/ComponentGuide.test.tsx、tests/e2e/components.spec.ts：四脚本及错误修复，真实孔位／说明只读／文字输出状态；教师学生人工任务另记 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |
| EX2-12 | 模型预算测试及CR-STAGE-2-BENCHMARKS固定场景B-RGB/B-NPN/B-RC/B-PIEZO/B-MAX/B-OVER与P/T超限／128/129维合成预检；计时P95、M-RC/M-PIEZO真实墙钟及GC采样 | `npm test`；涉及浏览器用 `npm run test:e2e -- --project=chromium --workers=1`；12另采性能数据 | 未执行／无阶段2实现 |

上述新增文件名为确定的拟落地位置，当前不存在，不能声称已有覆盖。模块期望由脚本公式／独立计算器产生，不调用项目求解器自证；时间测试使用显式模拟时间，Chromium补真实事件命中和音频API。安装脚本是逻辑网表，后续必须补经物理校验的实际孔位与完整学生操作。性能基准必须报告硬件／浏览器版本、预热／样本数、原始耗时分布／P95及内存采样，不能只写测试数量。

回归逐项映射沿用本文件现有AC表；额外对AC-06快照、AC-11状态延续、AC-17暂停／停止逐事件验证，同时原DC断言不删。AC-01/03网络等价、02/09编辑、04/05数值诊断、07/08保存历史、10/13说明、12音频、14参数、15/16/19旧LED／电位器、18释放均需重跑。数学容差按模型，UI舍入允许显示精度但不得把小值说成物理零。

人工证据按四实验末节分别记录教师、至少3名学生任务、真实读屏／200%缩放和设备试听；未执行时报告交付边界。当前全未执行，不推断教学有效性。Firefox／WebKit不运行；不公开部署。本轮仅文档，不运行应用类型／构建／Vitest／Chromium，不预报CI。

本轮实际执行：`python3 /tmp/ai-circuit-stage2-decisions/check.py` 通过（8份纯文档、本地链接、12项EX2定义／映射、原AC及EX1表行保留、AC-06/11/17显式差异、方向批准引用、业务代码不变）；RGB／NPN／RC／压电公式独立重算与文档数值核对通过，包含连续放电初态、下拉电阻基极电流、压电幅度衰减及RGB颜色映射；`git diff --check` 通过，已审阅全部文档差异。临时脚本不入仓库、不构成应用测试或运行依赖。


## 完整规格复核问题修订验证：2026-11-04

来源 [完整复核意见](https://github.com/bjstevenyang/ai-circuit-tutor/pull/2#issuecomment-6624787668)，输入head `08266956fca5a9439fdddcc2dbd82d35ce835042`。EX2-03/04/11/12修订：NPN新增C–P参考电阻、三态及源电流重新计算、移除参考电阻的非唯一回归；性能固定输入与测量过程见 [规程](changes/CR-STAGE-2-BENCHMARKS.md)。其余EX2、AC和暂缓EX1不增删／改行为。

| 验收 | 未来文件／场景 | 执行命令／本轮实际状态 |
| --- | --- | --- |
| EX2-03 | npn.test.ts／E2-NPN：7件新网表三态、LED与R_ref电流、源电流及全部节点唯一性 | 未来npm test；本轮仅独立数学核对，未实现 |
| EX2-04 | npn.test.ts：去R_ref且断开，VC3/4.5两个合法解；恢复后唯一VC4.5 | 未来npm test；本轮独立约束反例核对，未跑业务测试 |
| EX2-11 | 四实验Chromium：NPN新增参考电阻的合法安装、控制与错误修复，其他三实验回归 | 未来npm run test:e2e -- --project=chromium；本轮未执行 |
| EX2-12 | 固定性能规程全部B场景、合成预算及M-RC/M-PIEZO采样 | 实现PR补实际runner命令／版本／fixtures与数据；本轮未测性能 |

上一版独立算例通过仅表明原接通数学正确，不表明断开唯一性已验证。当前已增加不依赖GMIN的唯一性正／反例检查，不能把数学核对当作求解器实现测试。真实安装、实际矩阵规模、Chromium、读屏／试听和学生试用仍未执行；原教学方向无需重复批准，完整新head仍待复核。

本次实际执行：`python3 /tmp/ai-circuit-stage2-review-fix/check.py`通过（9份纯文档、本地引用、12个EX2 ID、未受影响验收与业务代码不变、精确有理数NPN三态／KCL／源电流、原浮置反例与新增参考支路唯一性论证、24件／576候选基准及测量步骤字段）；`git diff --check`通过，已审阅差异。全部是文档／数学验证，没有性能或产品实测；临时脚本不入仓库。


## 阶段2实施证据（2026-11-05）

实施授权、主线上实际需求基线及逐项 EX2-01–12→文件／场景→命令／结果见 [实施确认与验收证据](changes/STAGE-2-IMPLEMENTATION.md)。新增映射不改写前文历史提案及批准验收。

当前模块／界面335项通过、严格类型／构建／静态检查通过；Chromium44/44场景通过；固定核心/UI/停止13个场景分别完成，RC鼠标/键盘2组共42.7分钟。两组真实长运行已执行，版本边界和原始采样交接见报告。指定M1/8GB、真实后台、读屏、200%缩放、试听、教师/学生任务仍未验证，不将本机补充性能或自动化通过表述为全部EX2完成。EX1继续暂缓；浏览器仅Chromium，不公开部署。


## 自动需求交接流程配置：2026-11-07

仅AGENTS、流程说明、自动交接规则、CR／PR模板、决策和本验证节变化；产品AC／EX验收无变化。独立审查与应用任务启用记录归本流程PR。检查本地Markdown引用、自动范围与人工默认路径、独立审查／同head门槛、最终实现人工合并、返修上限、去重／交付恢复及业务树不变，执行git diff --check。纯文档不运行应用／浏览器／性能测试；实际跨聊天派发及heartbeat创建结果另外记录，不能把规则文档当作调度器已执行。

实际执行：`python3 /tmp/ai-circuit-orchestration/check.py`通过（7份流程文档、本地链接、范围／独立head审查／SHA防护合并／返修去重及交付恢复／最终人工实现合并门槛，产品代码和权威需求未变）；`git diff --check`通过，已审阅差异。应用、浏览器及性能测试未运行，因纯流程文档变化；临时脚本不是运行依赖。

第一次独立复核针对`54c4e2c2b8cf47f4d33682ee479f3c646bbda52f`，Standards PASS、Spec NEEDS_CHANGES：一项P2要求将同head无发现PASS明确列为状态推进事件。已补审查完成事件与派发键＋来源turn／报告只消费一次，允许重新评估合并门槛、不重复派审。新head需再次定向复核；原结论不沿用为PASS。纯文档检查按本轮实际命令记录，未运行产品测试。


## 自激发声需求初稿检查：2026-11-08

以下保留初稿当时的执行事实；规格已在同日下方OSC冻结章节补齐，初稿“待分析/不能验收”不再描述最新规格状态，仍不表示业务实现。

拟新增OSC-01–06见 [CR](changes/CR-OSCILLATOR.md)，现有AC／EX2／暂缓EX1表行未改。当前只定义目标与待分析门槛；OSC-01目录安装、02容量混接、03起振波形、04扬声器音频、05故障修复、06等价布局／保存／预算均无业务实现、未执行。未来对应模型测试／编辑／storage／app／Chromium，具体数值、容差和文件场景须技术分析收敛后逐项补齐。当前不能宣布验收可执行或通过。

纯文档检查本地引用、源网表、六个唯一OSC ID、旧验收和业务代码未变及git diff --check；不运行应用／浏览器／性能测试。

实际执行：内联Python文档检查通过（6份文档、本地引用、6项唯一OSC ID、旧AC/EX表行及业务代码不变），`git diff --check`通过，已审阅差异。产品／浏览器／性能测试未执行。

## 主动回报协议文档验证：2026-11-08

仅AGENTS入口、AUTOMATED_HANDOFF协议、流程README、D55及本记录更新，无产品验收／代码变化。检查唯一双向目标和可访问人类授权、任务完成／阻塞触发、先PR后发送、完整SHA及消息字段、DELIVERED与实际接收区别、去重／RECEIVED中断恢复／CONSUMED、CONFIG_ACK不推进业务、无需回ACK防循环、漏报恢复以及最终实现人工合并边界。本次纯文档不运行应用／浏览器／性能测试，配置发出和真实回传成功必须单列实际工具证据。

实际执行：`python3 /tmp/ai-circuit-orchestration/check_callback_docs.py`通过（5份流程文档、本地引用、AGENTS明确入口、人类双向授权、消息字段、送达／消费恢复、防ACK循环与兜底、产品未变）；`git diff --check`通过，已审阅差异。回传CONFIG_ACK仍需真实发送／接收证据，不以文档校验代替。

## OSC规格冻结及实施验收计划（2026-11-08，v2数值修订）

新OSC-01–06的完整行为见PRD；方程/独立期望以CIRCUIT_MODEL为准；生命周期/v5以SYSTEM_DESIGN为准。旧AC/EX2定义表保留，适用差异见CR。本需求PR仅文档；下列应用测试位置/命令是后续实施的要求，尚未创建/执行，不将离线研究当应用通过。最终报告逐ID记录真实文件/场景/命令/结果/代码完整SHA和未执行项，不能只给总数。

### 固定输入与独立期望

OSC-REF固定使用oscillator-em-v2、每管Cbe2nF/Cbc1nF；为CR的七节点网表：V1=9V，R3=47Ω VP–P，Q1NPN(E=GND/B=A/C=B)，Q2PNP(E=P/B=B/C=D)，R1=120kΩ P–A，C=100nF A–D，speaker8Ω D–S，R2=10Ω S–GND。原图跨线桥不连接。冷态0/100μs单次线性上电；默认/严格积分档按模型。测试记录完整显式端点输入与编译后节点表及其SHA-256，不用截图或临时文件作为唯一fixture。

参考及独立变体：OSC-C47、OSC-C220、OSC-R100、OSC-R240、OSC-L26仅分别改C=47nF、220nF、R1=100kΩ、240kΩ、R2=18Ω；独立比较窗15/25/15/30/15ms，周期、次数及容差在模型表。正式产品每次仍算40ms并验证通用周期检测，独立测量1V阈值与UI检测规则分开。错误输入OSC-NOC（精确删C）、OSC-NOR（删R1）、OSC-NOSPK（删speaker）、OSC-BYPASS（并导线D–S）、OSC-PSHORT（P–GND）、OSC-VSHORT（VP–GND）、OSC-WRONGPIN（Q2的B/C外部连接交换）、OSC-WRONGKIND（Q2改NPN）和内部模型负对照BF_N=BF_P=100分别建fixture；不以1e30Ω伪开路替代删除。

v2独立参考/完整16命令和3份标准库脚本归档[新参考](changes/CR-OSCILLATOR-NUMERICS-REFERENCE.md)，对应四节点probe SHA-256 6a41266482cef3b0da4d7f2bfdbb609f074ba4b17cee95767985f219741c8cd1、五变量原求解器f637706ebeb5ee2f20d6141a612422be1a9d529f1749db620c1d09bafbffa191及适配器bb507630d1e0b3d8f04546c83bf6a061771a72a9db1ac0f9e3a2243fe7a3043c。方程/Jacobian/线性求解相互独立，统计后处理共享，不能夸大独立性。BDF2细步中心和BE-LTE全窗/严格档共同定参考，不能用项目求解器自产期望。原v1的10/5pF与旧数字只保留失败/历史归档，不作v2通过证据。研究已执行，不为报告再跑整套。

产品数值测试要求：REF默认/严格均按v2新观察量容差；五变体默认档周期/次数/40ms分类；C47/C220严格档额外验证边界（其余三变体严格档未执行/不新增要求）。精确删C/两BF100的40ms DC、删R1 window-no-period、删speaker无端口DC、speaker旁路零端压但其他节点仍变化均按模型新反例，不硬编码接线名称给结果。40ms域/计数必须覆盖所有接受半步，不只末半窗。


| 验收 | 未来文件/具体场景 | 实施命令/实际状态 |
| --- | --- | --- |
| OSC-01 | src/circuit/catalog.test.ts和editor/model.test.ts：PNP/speaker四方向稳定脚序/标记/物理拒绝/取消不入历史；Chromium从空板纯键盘/表单搭建OSC-REF，记录实际合法孔位全表，说明查阅只读 | npm test；npm run test:e2e -- --project=chromium --workers=1；均未执行 |
| OSC-02 | parameters/validation/transient测试：100nF=.1μF、47/220边界、非有限/空白/半输入/重复单位；profile参数不匹配保留；零态/一次上电/严格档/LTE拒步、KCL、Newton/域/步长失败；D64起原实验模型仅新增离散100nF、各profile新建默认100nF，原10–1000μF及间隙拒绝回归 | 本表为原OSC验证计划；本次D64只执行下方100nF定向验证，不重新运行整套 |
| OSC-03 | src/circuit/transient.test.ts独立fixture：OSC-REF两档的五上穿、周期、8相位四节点、D/speaker RMS及源流；五单参数变体周期/次数；固定参数不读音频/拓扑匹配；严格档同门槛 | npm test；固定有限数值runner命令由实现PR列明；未执行 |
| OSC-04 | src/app/useBuzzerSound.test.tsx或独立speaker音频hook：来自端口的f/RMS/增益，许可/音量0/端点交换/旁路/API不可用/20Hz与20kHz边界；Chromium真实手势/AudioContext调用及停止/后台清理 | npm test；npm run test:e2e -- --project=chromium --workers=1；实际设备试听另记，未执行 |
| OSC-05 | transient/tutor测试逐反例：DC/窗内无周期/限制分类、有限/理想短路差别、未知不当0；β100/100不变成持续音；Chromium删C→看结果/三层提示→恢复C→periodic，记录模拟时刻/对象 | npm test；npm run test:e2e -- --project=chromium --workers=1；未执行 |
| OSC-06 | network/storage/editor/session测试：3种布局和顺序等价、schema v1–v5/profile往返、已知oscillator-em-v1只恢复/显式转v2和撤销、未知版本保护、50步撤销、Worker过期响应/控制/后台事件表每行、12/13边界/预算注入/旧全部验收回归；固定性能下表 | npm test；npm run typecheck；npm run lint；npm run build；Chromium；未执行 |

三个等价布局必须分别使用不同物理安装位置及同网空孔连线，至少一个旋转PNP/speaker并交换speaker端点；另外改变线色/折点、导线和元件数组顺序。安装先用现有完整物理校验，物理违规不当电气错误。实际孔位表由实现后真实搭建验证，验收仍以七节点关系及安装规则为判据，不能靠目标图坐标识别。

错误/无周期fixture允许范围见模型：v2精确移除R1与speaker已有独立轨迹依据，分别window-no-period和无speaker端口的settled-DC，不沿用旧模糊期望；错脚未给独立数值，按方程/唯一性/域给可解释结果或具体unsupported，不造频率。移除C与β100/100有独立末值/次数，不能只断言“无声”。P短接须保留47Ω及有限源侧电流。speaker旁路验证其自身V=0，不把全电路必不振荡作为期望。

### 新profile固定性能规程（OSC-06，不替代EX2-12）

1. 环境：macOS Apple M1/8GB、仓库锁定Chromium、1440×900、无CPU降速、单Worker/串行；记录实际OS/CPU/内存/浏览器版本/commit和完整配置。其他硬件仅补充，未有M1不宣称该门槛已验证。
2. 固定运行输入：OSC-REF、五个单参数变体，以及OSC-NOC、OSC-MAX12、OSC-OVER13。MAX12仅把R1替换为8只15kΩ串联，加入X1…X7，总120kΩ；参考5未知节点+7=12、14个板上元件。OVER13把其中一只15kΩ拆成两只7.5kΩ，加入X8，共13未知、15件，预检拒绝。按模型化简前计数，记录节点合并/已知端消去前后，不能用优化绕过边界。MAX12观察量与REF同容差；OVER13不得进入数值积分。
3. 所有成功输入保持v2默认LTE/共享预算、9V/100μs冷态/40ms及完整统计遍数，不能为了计时替换小窗口、跳过编译或用缓存。每场景预热3次，正式20次，每次独立冷启动；保存20个原始样本，升序第19个为P95。不用跨Worker与主线程的绝对时钟相减。
4. 核心Worker内从收到该次配置、开始编译到完整窗口及分类完成为同一performance.now间隔；主线程另记点击运行至结果渲染端到端，包含消息/调度。完整编译+所有统计遍数+分类P95≤2s、每次墙钟5s硬截止，第二遍不重置计数/时钟；分别记每遍接受/拒绝和总数。预检拒绝独立报告，不混入成功场景P95；预算触发应为明确失败而非较快的成功。运行点击到“计算中”反馈≤200ms。
5. 停止两类场景分别测20次：计算中（第一遍/第二遍分别20次）按停止；获许可且已发声时按停止。从点击事件开始至UI停止且Worker取消/旧generation失效、音频节点清理均完成取较晚者，P95≤100ms；不能只量dispatch。参数运行中冷重算/后台取消及旧响应不恢复音频用事件测试验证；真实失焦/后台需Chromium实际事件证据，不以合成事件宣称OS验证。
6. 内存另开进程，不计入耗时采样：加载参考配置并预热3次/停止/终止Worker/清音频，受控GC后采主线程堆M0；串行20次冷运行→结果→停止，每次同样清理/GC并采M1…M20。报告完整序列，M20−M0≤10MB；停止后Worker残留应0，音频振荡器/连接节点应0，AudioContext关闭/释放按实现实际记录。无法采堆时标未验证，不用DOM数替代。每会话最多4096显示样本，不将几十万接受步存React/历史/localStorage；不反复跑旧10分钟RC长测来代替新有限窗。

故意注入Newton上限/hmin/LTE不接受/总步数/拒步/墙钟超限分别验证明确失败及清旧声；低预算注入只供测试，生产预算常量不可随参数放宽。严格数值档只对REF/必要边界验证误差，不无理由重复完整性能套件。若具体失败，修影响范围再复测；无法达到冻结门槛先回需求变更，不改期望掩盖。

### 实施待验证与PR #5时的历史检查

以下保留原PR #5文档检查事实；本次v2需新的完整head独立审查，原PASS不沿用。已消费技术分析的模型路线不等于最终独立审查。真实研究来源/输入head/命令/结果见影响报告；本轮做文档范围/本地引用/七节点/验收映射/原AC/EX表行/原业务树不变/归档脚本哈希与语法/合并冲突清理/差异检查，不跑应用或浏览器/性能。对应文档检查命令在提交前实际执行后记录；未执行项不得写通过。

后续交付必须分别列目标M1/8GB、真实后台/失焦、设备试听、读屏/200%缩放、教师及至少3名学生任务的已执行/未执行和原因；这些不能从CI或API推断。没有目标环境时先交用户可体验的实现及实际边界，不能声称全部教学/设备验收已通过。仅Chromium，不公开部署，最终实现用户验收合并。

本版本实际执行：`python3 /tmp/ai-circuit-orchestration/check_oscillator_docs.py`通过（7份纯文档、主线协议不变、冲突/围栏/引用、原AC/EX表行、6项OSC映射、七节点/8相位参考、归档独立脚本SHA-256和Python语法、业务/依赖树不变）；`git diff --check`通过，已审阅文档差异。未重新运行原数值研究，也未运行应用/Chromium/性能；新head仍待独立审查和CI，临时检查脚本不是运行依赖或唯一交接来源。

### OSC实施实际记录入口（2026-11-08）

需求已合并后的实际基线、逐OSC部分证据和未执行项见[实施记录](changes/OSCILLATOR-IMPLEMENTATION.md)，数值契约的明确失败及独立复现见[失败记录](changes/OSCILLATOR-INTEGRATION-BLOCKER.md)。配置/迁移切片和旧模块回归有通过证据，但不能覆盖冻结BE-LTE在10ps下限的数值失败；目前完整OSC-01–06均未完成，不将配置CI绿色当整体可验收。本节只登记实际实施进度，不改变上文批准需求/门槛；人工/目标设备/完整动态性能仍分别保留未验证边界。
## OSC数值修订输入与独立失败核验：2026-11-08

实现实际失败及其有限影响见 [数值修订CR](changes/CR-OSCILLATOR-NUMERICS.md)、[完整可复现来源](changes/CR-OSCILLATOR-NUMERICS-IMPACT.md)。本轮协调者已在干净主线需求工作区执行该归档标准库Python复现（临时提取脚本命令`python3 /tmp/ai-circuit-orchestration/reproduce_lte_blocker.py`），得到BLOCKED：t=0.0007880928149619716s、接受3381/拒25、下一步8e-12s；与技术报告一致。失败是结果，不能记为数值验收通过。

仅改变虚拟结C至1nF/0.5nF的默认LTE离线15ms初探完成（63617接受/146拒、最小14.514ps、5次上穿、末周期3.467946371ms），但严格档、参数边界/模型域全程、40ms分类/预算尚未全部核验，不能当新模型最终PASS。探索不是应用或目标机性能；不重跑旧整套研究/Chromium长测，不改旧AC/EX2表或已冻结验收。后续只有具体修订及新独立参考齐备后才更新正式模型/验收。

当前纯文档范围为新CR/来源归档/D58/本记录，本地引用/代码围栏/原AC-EX表行与业务依赖树不变、差异需在提交前检查；文档命令和真实结果在PR记录。新方案尚未审查/合并，未执行应用/Vitest/浏览器/目标硬件/试听/师生验证。


## v2数值修订新增验证（2026-11-08）

已知model oscillator-em-v1的v5作品：原样加载/合法编辑/保存且不启动Worker或声音；运行unsupported-model-version，非损坏数据。显式选v2一次历史/保存，保留100nF/全部ID/线/位置，停止并使旧回调无效；撤销回v1不能继续v2计算。新建默认legacy，新自激选项v2；schema v1–v4补legacy原迁移不变，未知profile/schema保护存档且无自动覆盖。将这些用例映射OSC-02/06及AC-08/17、EX2-10，旧fixture字节/哈希继续保留。

两遍统计回归：第一遍完整窗不能提前标periodic或播放；第二遍同配置/初态重放，接受半步逐段插值/积分。测试可受控采集离线轨迹核对阈值/迟滞/末4周期，与生产流式结果一致；不把全轨迹数组带入产品React/历史/localStorage。覆盖第二遍超出共享接受/拒绝/5s、停止/后台、旧generation返回；故意把测试总接受预算设为第一遍可完成但第二遍不足时，必须resource-limit、无periodic/旧声，不能第二遍清零。总数上限1m/10k、每个隐式调用80次不变。周期检测不足/无speaker可省第二遍，状态仍依据完整节点末窗。

有限数学实际来源：[新报告/脚本](changes/CR-OSCILLATOR-NUMERICS-REFERENCE.md)，14 BE-LTE/2 BDF2，默认/严格40ms及五变体、C边界、五精确负例均已记录；未执行的三变体严格档、实际图编译MAX12/OVER13、错脚数值、浏览器/性能不能冒称通过。两遍已测最严单遍343091接受，保守2×=686182<1m；拒绝上界2×659=1318<10k仅证明已测简化网表数学预算，不证明12节点产品/目标M1性能。P95≤2s、5s截止、停止100ms/反馈200ms/10MB目标不放宽，实际测量包括全部遍数；负载26Ω新周期4.542393184ms等新参考覆盖旧fixture。

本轮纯文档检查范围为9份需求/模型/设计/计划/决定/原CR/修订CR/历史影响/新参考。将验证本地引用/围栏/原AC-EX表行/无业务依赖改变、新脚本语法和三份SHA、旧失败记录保留、v2参数/数字/profile/全遍预算一致；真实命令/结果及新head在PR记录。应用/Chromium/性能及人工未执行，本需求完成不代表完整OSC已交付。


本轮v2实际文档验证：`python3 /tmp/ai-circuit-orchestration/check_num_v2_docs.py`通过（9份纯文档、原DC/RC/压电章节与AC/EX表行/流程/旧参考归档保留、本地引用/围栏/空白、6项OSC/八相位、3脚本语法和SHA-256、两遍预算算术、业务/依赖树不变）；最终`git diff --check`通过，差异已审阅。没有重跑原研究或应用/浏览器/性能；新head独立审查与CI另记，临时验证脚本不是运行依赖。

## OSC v2实施实际验证入口（2026-11-08）

本轮采用主线已合并需求974c737a0545f908e3612736bd02edc77618dc9f。逐OSC文件/场景/命令/实际结果及未验证边界见[实施记录](changes/OSCILLATOR-IMPLEMENTATION.md)最新v2节。首轮完整Vitest32文件448/448，typecheck/lint/build/diff检查通过；OSC Chromium4通过/1原生后台场景跳过。新数值已对照既有独立参考，不重新研究。固定性能、旧Chromium与独立代码审查继续回填，不由模块绿色推断目标设备或教学有效性；产品验收定义未修改。

## OSC v2当前实际结果（2026-11-09）

产品代码f108d7b8534bc7eb44fbbd21a26ad45db03df19f：本机32文件453模块通过，CI Verify42697686184/42697675137均成功（453模块、Chromium48通过/1原生事件环境跳过，typecheck/lint/build通过）。原CI资源失败已修，5s及精度不变；独立Standards/Spec代码覆盖PASS。完整逐ID证据、之前失败/返修和未验证边界见[实施记录](changes/OSCILLATOR-IMPLEMENTATION.md)最新节；旧构建实际原始性能样本见[性能记录](changes/OSCILLATOR-PERFORMANCE.md)。

按用户最新“只跑失败测试”，停止了进行中的本机全套，未再运行优化版整套性能/真实UI基准。目标M1/8GB、优化版正式P95/内存、发声停止20次、真实后台失焦、试听、读屏/200%及师生仍未验证。本次仅证据文档提交不改变需求/验收定义，以[skip ci]避免再触发全套；不将其写成该文档head测试通过。

## 原实验模型100nF定向验证（2026-11-09）

用户当前直接批准的范围、基线和master操作例外见[决定D64](DECISIONS.md#原实验模型100nf与新建默认值2026-11-09)。修改OSC-02、EX2-05、EX2-10，回归EX2-06/11、OSC-06及AC-07/08/14/17；没有新增或删除验收ID。原实验模型新增离散100nF，新建默认100nF；原连续10–1000μF、自激47–220nF、旧存档值、schema1–4容量限制及运行／时间规则保留。

遵循用户定向验证要求，未跑模块、Chromium或性能全套。本轮7个新增场景及8个受影响既有场景共15个不同场景最终通过，分次验证，不将跳过项算通过。

| 验收ID／变化 | 实际测试文件／场景 | 执行及实际结果 |
| --- | --- | --- |
| OSC-02：修改 | src/circuit/legacyCapacitance.test.ts：三个profile新建100nF、原模型放置与离散集合；catalog.test.ts：自激边界及已有100μF切profile保值 | 命令A中4个纯模型／存档用例通过；命令B中4个catalog定向项通过 |
| OSC-02、AC-07/14：修改／回归 | src/app/LegacyCapacitance.test.tsx：默认100nF/nF显示、0.1μF一次转换、预设、非法1μF草稿保留存档/运行态/aria-invalid、撤销、单位只读 | 命令A中默认／单位2项通过；剩余转换用例命令B通过。既有空白／半输入解析逻辑未改，本轮未重复运行无关用例 |
| EX2-05：修改 | legacyCapacitance.test.ts：100nF/10kΩ的0、1τ、5τ（τ=1ms）独立Vc/Ic；transient.test.ts：原100μF/1s及R/C×10解析回归 | 命令A新100nF数值通过；命令B旧EX2-05三项通过；rcExperiment已显式指定100μF，旧固定v4 fixture文件未改 |
| EX2-06、AC-17：回归 | LegacyCapacitance.test.tsx：无效草稿不停止、有效改C停止；OscillatorConfiguration.test.tsx：已有100μF切profile保值、停止及撤销 | 命令B两项通过；未更改RC连续／后台／重启实现，完整旧生命周期未重跑 |
| EX2-10、OSC-06、AC-08：修改／回归 | legacyCapacitance.test.ts：v4的100μF只读加载保值，v5原模型100nF保存恢复，撤销／重做容量；LegacyCapacitance.test.tsx默认作品刷新恢复配置 | 命令A通过；schema1–4容量拒绝代码未改，v1–3/未知/损坏保护未在本轮重复执行 |
| EX2-11：回归 | src/tutor/components.ts、catalog.ts与USER_GUIDE：默认100nF、支持集合、100μF慢速RC教学说明及1ms观察边界 | 定向ESLint、文档引用/围栏/差异检查通过；独立只读代码审阅PASS；真实教学/辅助技术未验证 |

命令A：`npm test -- src/circuit/legacyCapacitance.test.ts src/app/LegacyCapacitance.test.tsx`。修改前6失败/1通过，证明旧实现拒绝100nF/默认仍100μF；修改后4模型项及2界面项通过，1界面项因撤销后测试未重新选中元件而失败，补回真实重选操作后由命令B复验通过。未把中间失败写成整套通过。

命令B：`npm test -- src/app/LegacyCapacitance.test.tsx src/circuit/catalog.test.ts src/app/OscillatorConfiguration.test.tsx src/circuit/transient.test.ts -t 'converts 0.1|changes profile as one|accepts the oscillator boundary|explicitly switches profiles|EX2-05'`：4文件9通过/21未匹配跳过（1.81s），只覆盖失败项和本次直接受影响回归。

一次尝试的`--rerun-failures`不是当前Vitest支持的参数，CLI退出且未执行测试；随后采用上述`-t`精确选择，未借此运行全套。

`npm run typecheck`通过；`npm run build`通过（含类型检查）；对本次12个改动代码/测试文件的`npx eslint`通过，`git diff --check`及文档引用/围栏检查通过。没有运行全套lint、模块／Chromium／性能；本次提交使用`[skip ci]`遵从不再自动跑全套的要求，不声称远端CI通过。

现有1×／≤0.05s批次无法保证看清1ms瞬态，未新增时间缩放或曲线。真实学生观察、设备／辅助技术及既有未验证性能边界仍未验证。master直接修改／提交／推送只沿用本轮用户明确指示，不作为后续任务默认流程。

## 运行提示按实际控件显示：2026-11-10

用户报告自激电路没有黄色按钮，却仍出现“开关点击切换；黄色按钮按住接通”。根因是 `App.tsx` 在所有运行结果后使用同一固定文案。本次为 AC-17 状态清晰度的范围内缺陷修复，回归 AC-11/18；无验收 ID 增删，无电气模型、运行生命周期或存档行为变更。

本次实现基线为 `2c4d8730a648adc2809c186ec81c7d9ba2bcbc27`，master 工作区干净，沿用既有 Git 授权在 `codex/contextual-running-hint` 修复分支交付。既有完整验证记录是上述 `f108d7b` 的453项模块与48个Chromium场景，不视为最新型号扩展提交的通过证据。当前基线在 `validation.ts`／`PartControls.tsx` 有两处严格类型错误，已在未修改的 HEAD 临时快照执行 `tsc --noEmit` 独立复现；本次同时收窄已由运行时目录校验的元件类型与非空型号选择类型，未修改运行时校验或型号参数。

| 验收／场景 | 实际证据与结果 |
| --- | --- |
| AC-17：无控件、仅开关、仅按钮、两者都有 | `src/app/Simulation.test.tsx` 新增4个真实App场景；只描述实际存在的控件，无控件显示“运行中 · 点击‘停止运行’结束。”；开始／停止状态保留 |
| AC-17、OSC-06：无开关／按钮的自激电路 | `src/app/OscillatorLifecycle.test.tsx` 在现有Worker完成场景增加状态断言，计算中、完成、过期回调及停止原断言保留；该场景模拟Worker，不是重跑数值积分 |
| AC-17／AC-08：实际Chromium搭建与刷新 | `tests/e2e/lesson.spec.ts` 的 `build a valid circuit, inspect connections, and restore after reload` 增加状态栏断言；独立测试上下文，不读取用户作品 |
| AC-11/18、OSC-06：相邻生命周期 | 两个上述App测试文件共15项通过，覆盖开关、按钮释放、声音停止、自激取消／后台／故障与原有显示；不是全套应用测试 |

修复前命令 `npm test -- src/app/Simulation.test.tsx src/app/OscillatorLifecycle.test.tsx -t 'running instructions|publishes calculating'`：4失败／1通过／10未匹配跳过，失败文本均为错误固定提示。修复后 `npm test -- src/app/Simulation.test.tsx src/app/OscillatorLifecycle.test.tsx`：15/15通过。类型收窄后 `npm test -- src/circuit/transistorModels.test.ts`：4/4通过。

`CIRCUIT_E2E_PORT=5187 npx playwright test tests/e2e/lesson.spec.ts --project=chromium --workers=1 -g 'build a valid circuit'`：1/1通过；首次受沙箱端口限制未启动，经既有执行授权重试通过，不把首次记为场景失败。`npm run build`（含严格类型检查）通过；对本次6个代码／测试文件的 `npx eslint` 通过。提交前另执行差异和文档检查。

沿用最近的定向验证安排，本次未运行模块、Chromium或性能全套，提交标记 `[skip ci]`，不声称远端CI通过；Firefox／WebKit、目标硬件和人工验证未执行。自动协调继续暂停；修复PR不自动合并。

## 可选晶体管型号步长修复：2026-11-10

用户批准[决定D65](DECISIONS.md#可选晶体管型号时间分辨率2026-11-10)的当前分支需求／实现例外；基线`d22c93e5c5d6644c5a9bb6176ea5158129fdfda1`，开始时干净。修改OSC-02：只有2N3904／2N3906卡的默认hmin改为1e-13s；原全通用／未指定仍1e-11s。无验收ID新增／删除；回归OSC-03–06和AC-08/17。器件卡、默认/严格容差、BE-LTE、模型域、5s／1m接受／10k拒绝／4096显示点、音频门槛、存档及会话协议均未放宽。

实际失败：原实现双具名在0.757479962ms的10ps下LTE约1.040751。新增 `namedModels.test.ts` 修复前8项中5失败／3通过，覆盖错误默认下限和真实计算未完成；更细步长候选只在临时程序验证，未先改产品或器件参数。修复仅在分析初始化按已编译配置选择下限，显式precision测试覆盖仍被尊重。

| 验收 | 文件／场景 | 实际执行证据 |
| --- | --- | --- |
| OSC-02：修改 | `namedModels.test.ts` 五种卡组合的默认精度；只变hmin；0.1ps的上电／窗口余量不得批准更小推进 | A中五种选择通过；C中两个边界的单场景通过，原10ps边界由A回归 |
| OSC-02/05：具名参考 | 同文件双具名默认／严格40ms完成，保留原参数；近直流、不提供周期频率；两种混用也为DC | A中默认／严格通过；C中混用2项通过。末speaker端压约1.061754286V，双档相差约2.2e-12V；min约0.198159/0.137179ps、KCL≤1nA、传导域及原步数限制通过 |
| OSC-03：通用回归 | `analysis.test.ts` 的 `classifies REF` | A通过；通用参考仍periodic，RMS／源流及预算按原断言；未重复原独立参考研究或完整变体套件 |
| OSC-02/06：明确失败 | `namedModels.test.ts` 显式注入10ps重现原失败、零接受预算拒绝且无当前读数／声音；`contracts.test.ts` 原Newton／拒步／接受限制及10ps边界 | A通过；不会忽略调用方测试精度或绕过新／旧下限 |
| OSC-04/06、AC-08/17 | `oscillator.spec.ts` 的 `OSC model cards`：启用实际Chromium音频、选择NPN具名／再选PNP具名、40ms近直流、无旧频率／残音、型号保存、停止后切回通用重新起振和发声 | D的1个场景通过。不是实际扬声器试听或正式性能采样 |
| OSC-06：参数／生命周期 | `transistorModels.test.ts` 原参数、类型匹配／拒绝、v5保存；`oscillatorSession.test.ts` 旧generation、停止、共享5s和Worker不可用 | B的8项通过；数值方程、Worker消息、声音实现及保存格式均未修改 |

命令A：`npm test -- src/circuit/oscillator/namedModels.test.ts src/circuit/oscillator/analysis.test.ts src/circuit/oscillator/contracts.test.ts -t 'optional transistor card|classifies REF|fails Newton/hmin|never approves a sub-10ps'`。首轮修复后11通过／16未匹配跳过；随后只新增3项测试（未再改产品代码），由命令C单独验证，不重复通过项。

命令B：`npm test -- src/circuit/transistorModels.test.ts src/app/oscillatorSession.test.ts`：8/8通过。

命令C：`npm test -- src/circuit/oscillator/namedModels.test.ts -t 'mixed pair|0.1 ps floor'`：新增3通过／8未匹配跳过。A/B/C合计22个不同场景，不将跳过项计为通过。

命令D：`CIRCUIT_E2E_PORT=5187 npx playwright test tests/e2e/oscillator.spec.ts --project=chromium --workers=1 -g 'OSC model cards'`：1/1通过。隔离测试作品与本地端口，不读取或修改学生作品。

`npm run build`（含strict类型检查）通过；对 `analysis.ts`、`namedModels.test.ts`、`oscillator.spec.ts` 的定向 `npx eslint` 通过；提交前检查文档本地引用／围栏及差异。所有执行针对基线加本次工作树，最终完整提交SHA由交付报告固定。

未执行全套模块／浏览器／性能、目标M1/8GB的P95／内存、真实后台／辅助技术／试听／师生验证；不把本机定向通过当作任意具名组合可用或真实型号模型验证。两档一致只是同一实现的数值收敛核对，不冒充第二独立求解器。沿用定向验证安排使用 `[skip ci]`，不声称远端CI通过。自动协调及跨聊天回报继续暂停；不合并master。

## 自激v2容量扩容定向验证：2026-11-10

授权及实施基线见[决定D66](DECISIONS.md#自激v2电容上限1μf2026-11-10)。修改OSC-02和OSC-06／AC-08的v2容量范围，47–220nF扩为47–1000nF；无新增／删除验收ID。只核对本次范围及受影响回归，不扩大为整个OSC／EX2重新验收。

| 受影响验收 | 测试文件／场景及实际证据 |
| --- | --- |
| OSC-02：新上限、预设、单位、原子校验 | `capacitanceRange.test.ts`三组221／500／1000nF编辑与精确保值；`catalog.test.ts`覆盖47nF／1μF边界、超限与间隙；`CapacitanceEditor.test.tsx`输入1μF得到精确1e-6F及新预设；Chromium `nF/μF conversion`场景验证应用／错误草稿不覆盖 |
| OSC-06、AC-08：合法v5存档往返 | 新容量测试覆盖保存／加载；`storage/oscillator.test.ts`验证原迁移／未知版本保护；同一Chromium场景验证刷新后1000nF=1μF，配置值不变 |
| AC-07／14：历史和校验回归 | 新容量的撤销／重做；超限1.001μF、非有限／未完成／重复单位拒绝；Chromium撤销回200nF、重做到1μF并恢复 |
| OSC-03–05、AC-17：局部运行／音频回归 | 新容量测试：通用1μF完成40ms且KCL≤1nA、有限读数、计数预算内；具名1μF当前明确数值失败且无读数／频率。Chromium `OSC model cards`验证100nF具名近直流→1μF数值失败清旧读数／连续音→100nF通用重新周期及音频；未重跑独立数值金标准全表 |
| EX2-05／10、OSC-06：旧模型与格式保护 | `legacyCapacitance.test.ts`4项覆盖原实验100nF及间隙；新容量测试保持旧v1和legacy拒绝1μF、schema4拒绝1μF但保留100μF、默认仍100nF；存储测试覆盖旧schema迁移 |

实际命令及结果：

- 测试先行：新文件和1μF界面场景在旧实现6失败／1通过；失败由编辑拒绝或运行前结构拒绝引起，确认原限制。
- `npm test -- src/circuit/oscillator/capacitanceRange.test.ts src/editor/CapacitanceEditor.test.tsx src/circuit/catalog.test.ts src/circuit/legacyCapacitance.test.ts src/storage/oscillator.test.ts`：5文件53项通过。UI测试类型修正后单独重跑`npm test -- src/editor/CapacitanceEditor.test.tsx --reporter=dot`，15项通过；不重复计入53项。
- `CIRCUIT_E2E_PORT=5187 npx playwright test tests/e2e/oscillator.spec.ts --project=chromium --workers=1 -g 'nF/μF conversion|OSC model cards'`：转换／恢复场景通过；型号场景新增断言最初误以为失败时整个诊断读数容器消失，改为保留最后接受时刻、无元件读数／扬声器端口。最终以同命令的`-g 'OSC model cards'`定向重跑通过。两种场景均有通过证据，不声称同一批全套通过。
- `npm run build`：严格TypeScript及生产构建通过。对4个改动源码和4个测试文件执行`npx eslint`通过；另执行Markdown相对链接／代码围栏和`git diff --check`。

已知未闭合项：当前具名2N3904／2N3906配1μF在约7.103511872ms报告Newton阻尼未收敛；本次只扩输入／保存范围，未改变求解器或宣称该组合完成40ms。更大容量下可能不足以检测稳定周期；不保证发声或真实器件效果。未执行全套模块／浏览器／性能、远端CI、Firefox／WebKit、设备试听、目标硬件及人工教学／辅助技术验证。提交使用`[skip ci]`，未执行不得写通过；自动协调保持暂停。

## 标准SPICE晶体管动态模型：2026-11-10

授权与范围见[CR-BJT-DYNAMICS](changes/CR-BJT-DYNAMICS.md)。本轮新增标准卡路径，不把此前简化模型DC结果当作完整模型期望。实际独立执行为原生ngspice47与WASM45.2的同一卡比较，不是独立物理模型或实物测量。

| 验收 | 输入／测试及证据 | 当前边界 |
| --- | --- | --- |
| BJT-DYN-01 | `src/spice/cards.ts`固定OUP B.11全卡；`src/spice/netlist.test.ts`验证全卡传入、供电斜坡、端口传感器、禁止通用卡默替和源短路 | 参数由标准GP内核解释，非自行实现的逐参数导数单测；封装版本固定1.9.0，运行启动信息45.2 |
| BJT-DYN-02 | 原图末端工作点、两管开关测试覆盖截止／正向导通／饱和；Chromium逐采样点对照原生端压及源流 | 独立反向有源偏置扫描尚未执行，不宣称全工作区实测完成 |
| BJT-DYN-03 | `npn-switching.cir`／`pnp-switching.cir`，2μs阶跃、10μs脉宽、1kΩ基极／100Ω集电极；0–20μs含开通／饱和／关断尾部，9个时刻比较 | 初版1ns步在NPN边沿差2.24mV，未放宽1mV容差；两端改0.1ns且收紧参考数值精度后NPN／PNP通过。未声称独立提取每项寄生参数 |
| BJT-DYN-04 | `reference.cir`原图9V／100nF／8Ω，40ms；8个时间点跨原生/WASM电压误差<1mV、源流误差<10μA；实际App新版本计算与保存恢复 | 两端均近直流约1.037066799V，无连续音；不能用“必须响”判定程序正确，也不能推断实物不起振 |
| BJT-DYN-05、AC-17 | 父session原有过期／超时／取消测试，实际Chromium计算中停止无旧读数；结果新增检查全窗、有限数、采样≤1m及三脚总端流KCL≤1nA | 5s截止保留；≤100ms定量采样、最大网表／内存峰值／WASM堆硬上限尚未完成，不能称性能验收全通过 |
| OSC-02／06、AC-07／08／14 | 3项netlist／版本测试：显式切换、完整存档往返、撤销恢复、未知／不匹配版本拒绝；App刷新仍选新版本且停止 | 旧schema1–4不变；原通用模型不自动转换 |
| OSC-03–05、EX2-05／10、AC-13／17回归 | catalog、storage/oscillator、oscillatorSession、OscillatorLifecycle、ComponentGuide定向执行 | 未重跑所有金标准、全应用和全浏览器，不将局部覆盖写成全套通过 |

执行命令与实际结果：

- `python3 tests/spice/generate-reference.py`：原生3个固定网表完成；输出为提交的摘要／输入SHA256，raw／日志只在临时目录。切换基准reltol1e-6／vntol100nV／abstol10pA／hmax0.1ns；原图按生产标准卡精度。再生成是显式操作，不在测试中重写期望。
- `npm test -- src/spice/netlist.test.ts src/app/oscillatorSession.test.ts src/circuit/catalog.test.ts src/storage/oscillator.test.ts src/app/OscillatorLifecycle.test.tsx src/app/ComponentGuide.test.tsx --reporter=dot`：6文件53项通过。新增3项；本轮中更正了测试误用fixture布局参数和切profile未清字段，保留回归断言。
- `CIRCUIT_E2E_PORT=5187 npx playwright test tests/e2e/spice-engine.spec.ts --project=chromium --workers=1`：原图原生对照与应用路径通过；NPN初次边沿比较失败，后以更细基准复验。相同命令加`-g 'npn-switching|pnp-switching|SPICE mode'`：3项通过。最终端流守恒／电容传感器后只重跑`-g 'SPICE mode'`，1项通过；四个不同场景均有通过证据，不伪称同批4/4。
- `npm run build`：严格类型及生产构建通过；旧Worker约27.43kB，新Worker约20.20MB，主界面gzip约116.9kB。对全部本轮源文件／测试执行定向`npx eslint`通过。另检查文档本地引用、代码围栏、`git diff --check`。

生产构建另以临时预览配置执行`npx playwright test --config /private/tmp/circuit-spice-preview.config.mts --project=chromium -g 'SPICE mode'`：1项通过，确认打包后的独立Worker实际计算／保存／停止。配置只指向5188预览服务及已提交同一场景，不提交临时配置／构建物。

未执行：远端CI／全套测试、Firefox／WebKit、目标M1／8GB、完整反向工作区扫描、完整卡持续周期正例／交流强度对照、引擎峰值内存硬约束、定量停止延迟、设备试听和实物／教学验证。eecircuit-engine封装MIT已核对，随包还含ASU／FreePDK／SkyWater／GF180模型，其完整许可清单尚未闭合；本轮不公开部署，不称生产发布验收完成。标准器件动态路径可本地验证，资源及分发门槛仍须收尾。提交用`[skip ci]`，不声称CI通过。

## SPICE型号引导与240kΩ周期对照（2026-11-12）

基线与问题依据见D68；开始于`319459b6d2a078f03f2ed7ca2239d64300fbaaeb`、干净的`codex/contextual-running-hint`分支。界面把原有具名卡条件提前检查，不新增模型／器件／依赖，也不修改原图、默认电阻、完整卡或生产求解设置。原图120kΩ仍得到直流；240kΩ为另一个明确调整外部参数的实验，不替换原图验收。新增／删除验收ID均无，BJT-DYN-01／04及OSC-02／06补配置引导与周期正例；回归AC-07／08／14／17。

| 验收ID | 测试／场景与实际证据 | 当前边界 |
| --- | --- | --- |
| BJT-DYN-01、OSC-02／06、AC-07／08／14 | `OscillatorConfiguration.test.tsx`的`SPICE model selection`：通用卡禁用新勾选并给操作步骤，分别明确选两具名卡后才可勾选；改回通用卡不自动替换参数，暂禁运行，仍可取消SPICE | 定向模块A通过；既有保存／撤销机制不改，未重跑全部迁移测试 |
| BJT-DYN-01 | `netlist.test.ts`的`requires explicit cards`：底层仍独立拒绝未明确选择型号及电源短路；与界面共用型号条件 | 定向模块B通过，其他网表场景未执行 |
| BJT-DYN-04 | `reference-240k.cir`保持完整卡、9V、47Ω／10Ω、100nF／8Ω，仅将偏置改240kΩ；原生ngspice47默认157.890404554Hz、交流RMS0.343129708V，末4周期及各周期RMS偏差均小于1% | 默认摘要含网表SHA256；未由产品生成期望 |
| BJT-DYN-04数值核对 | 同一240kΩ输入的原生严格档，reltol1e-6／vntol100nV／abstol10pA，最大步由0.25μs减至0.125μs，仍用零初态／100μs上电／40ms；157.888072609Hz、0.343131258V，相对默认差约0.001477%／0.000452% | 严格摘要含修改后网表SHA256；这是同一内核精度核对，不冒充第二物理模型 |
| BJT-DYN-04、OSC-02／06、AC-14／17 | `spice-engine.spec.ts`的`SPICE model selection and 240k`：从通用卡经实际型号选择开启SPICE，实际Worker检测到稳定周期；UI频率及交流RMS分别与原生摘要比较，容差1%；运行中选回通用卡会停止／清读数／禁无效运行，可取消SPICE继续编辑 | Chromium定向C通过；补上旧记录中未做的完整卡周期正例和交流强度对照，不覆盖设备音频／实物 |

实际执行：

- A：`npm test -- src/app/OscillatorConfiguration.test.tsx -t 'SPICE model selection'`，新增回归先在未修复界面因允许勾选失败；修复后1项通过、5项过滤未执行。
- B：`npm test -- src/spice/netlist.test.ts -t 'requires explicit cards'`，1项通过、2项过滤未执行。
- 独立默认参考：`python3 tests/spice/generate-reference.py reference-240k`，仅生成新网表摘要，未重写已有3份参考；独立严格参考：同命令加`--strict`，仅生成该网表严格摘要。另在临时目录复算原图及少量单因素对照；PNP的BF人为降至50会起振，只增加2／1nF线性结C仍直流，说明不能单独归因于大结电容；人为卡不进入产品。
- C：`CIRCUIT_E2E_PORT=5187 npx playwright test tests/e2e/spice-engine.spec.ts --project=chromium --workers=1 -g 'SPICE model selection and 240k'`，1项通过。首次受本地端口启动权限限制而未启动场景，获准后执行；补充运行中改卡停止断言后仅重跑同一场景，最终1项通过（6.8秒）。未运行其余浏览器场景。
- `npm run typecheck`通过。最初新增模块测试误用了Playwright的`exact`选项，类型检查指出后删除，未修改应用类型约束。对本轮5个TypeScript文件执行定向`npx eslint`通过；文档相对引用／围栏、参考哈希／默认严格指标及`git diff --check`另核对。

没有运行全套模块／E2E、Firefox／WebKit、性能、生产构建或远端CI；不重写旧记录为本轮全部通过。仍未验证目标M1／8GB、WASM峰值内存硬上限、定量停止延迟、完整反向工作区、真实扬声器负载／实物频率、设备试听、辅助技术与教学效果、完整分发许可。生产器件卡没有人为减小BF或增加结电容，不强制起振；不自动改用户电路，原图120kΩ直流结论保留。使用`[skip ci]`避免完整CI；自动协调保持暂停，不部署／合并。

## CR-WIRING-UX需求验证计划（2026-11-12）

历史状态：以下为需求PR #10合并前的计划及文档验证记录，分析主线为`51c044a8820afc234369e541c2a11c991b8ac449`，当时应用尚未实施。需求现已批准并合并，方向及分支／PR授权见[CR-WIRING-UX](changes/CR-WIRING-UX.md)、[D69](DECISIONS.md#曲线连线选线与共孔需求提案2026-11-12)；实际实现证据见下一节，不把下方历史“未执行”当成当前结果，也不改写旧记录冒充应用通过。

拟修改AC-02／03／07／08／09／10／13／19、EX2-09及OSC-01；受影响回归AC-01／04／05／06／11／12／17／18、OSC-06、EX2-05／10及BJT-DYN-01／04。没有新增或删除验收ID；下表均为待执行计划，不是通过记录。需求批准合并后才实施及补实际证据。

| 验收ID | 拟测试文件／场景 | 拟定向执行方式 | 当前结果 |
| --- | --- | --- | --- |
| AC-03／07／09 | 拟新增`src/editor/wireGeometry.test.ts`与模型测试：默认曲线、退化直线、坐标／边界、颜色保形、端点改接保点、折线转换、拖动取消／一次提交及控制柄键盘 | 实现后按新增文件／场景名称执行Vitest；几何值从固定端点独立计算，不由待测输出生成期望 | 未实现／未执行 |
| AC-02／03、EX2-09／OSC-01 | `editor/model.test.ts`／`components.test.ts`：全封装／方向，一引脚＋一线双顺序、移动／旋转／改接到共享孔；二线／二引脚／本体／越界拒绝；移动或删除只释放各自占用 | 仅过滤上述占用／改接场景；替换旧“引脚孔不可接线”预期，保留原子失败反例 | 未实现／未执行 |
| AC-07／08、EX2-10／OSC-06 | storage及editor历史测试：v5曲线／共享往返，撤销重做、取消不保存、旧v1–4先按旧规则检查再迁移、旧v5折线保值；未知／缺字段／非有限／越界保护；固定旧读取器拒绝新文档且保留原文 | 按对应存档／历史场景过滤运行；不修改旧fixture来迁就新实现 | 未实现／未执行 |
| AC-01／04／05、EX2-05、BJT-DYN-01／04 | 网络／分析／SPICE网表：同孔接引脚与同组空孔的代表性LED／RC／振荡器输入等价；只改曲线／线色／顺序不改网络或结果 | 针对等价场景执行；沿用独立手算／原数值基准，不重复完整数值研究或整套金标准 | 未实现／未执行 |
| AC-03／09、EX2-09／OSC-01 | 拟新增`tests/e2e/wiring-improvements.spec.ts`：真实指针点在线身覆盖的孔位中心，查看模式选线、连线模式选孔／引脚；共孔点击／拖动双向创建，改接；控制柄曲线拖动、Esc／取消、缩放／滚动及刷新／键盘恢复 | `CIRCUIT_E2E_PORT=5187 npx playwright test tests/e2e/wiring-improvements.spec.ts --project=chromium --workers=1`，实现后按场景过滤 | 文件尚未创建／未执行 |
| AC-06／11／12／17／18、OSC-06 | 过滤后的既有lesson／组件／OSC场景及新UI场景：元件本体开关／按钮仍可操作，引脚连线不误移动／按压；实际改曲率清结果／提示／声音，纯选择不清；无过期Worker输出 | 仅运行受影响的命中、运行失效与按钮场景，不执行完整浏览器套件 | 未实现／未执行 |
| AC-10／13／19 | 元件说明／PartControls／PartShape与guide测试：实际引脚／孔位一致，共孔与实物同组孔方案并列，说明只读无过期内容 | 按元件接线说明相关场景过滤；Markdown说明与实际UI分别验证 | 未实现／未执行 |

实施时检查严格TypeScript及改动文件静态规则，按每项ID记录实际命令、通过／失败、过滤或未执行原因。浏览器仅Chromium，提交用`[skip ci]`避免自动全套；不恢复跨聊天自动任务，不公开部署或自行合并。

本需求PR实际文档验证：`git diff --check`通过；本地Python检查10份改动Markdown、163条本地引用、20个标题锚点、围栏／冲突标记／空白、既有验收ID集合、完整基线／Proposed状态及唯一D69，均通过。另对照固定源代码核实画布880×650与控制点边界；初稿尺寸不一致已在提交前纠正。只修改docs下Markdown，无业务代码／测试实现。密集电路人工可读性、触控板、目标设备、辅助技术及教学有效性未验证，不能由文档检查推断。

## CR-WIRING-UX实施定向验证（2026-11-12）

需求PR #10已由用户合并，已核实获批head `b48e20f3da6a4eb0778ffd91672525563ed25b03`进入实际主线需求SHA `c1a09c077184a047da7b5f53bd8d93123619374c`；从该干净基线创建`codex/wiring-improvements`。W1–W3及验收ID未再增删或改义。原功能与验证基线仍为`89e3886266addaf12e7ac34efb5ad988cfb9bd7f`，需求文档提交不冒充功能提交。完整逐ID → 文件／场景 → 命令／结果映射见[实施记录](changes/WIRING-IMPLEMENTATION.md#每项验收证据)。

| 受影响验收 | 实际执行与结果 |
| --- | --- |
| AC-02／03／07／08／09、EX2-09／10、OSC-01／06 | A：新`wiring.test.ts`及`wireGeometry.test.ts`，82项通过；覆盖14类四方向共孔、编辑／历史、严格曲线数据与旧格式只读保护、固定几何。原最小回归2失败经修复定向复跑通过。B：已有占用／编辑／存储／说明按名称过滤16项通过、71项未执行。C：固定旧版读取器4项通过，旧折线可读，新曲线／共享拒绝且零写入、原文不变。 |
| AC-03／07／08／09、EX2-09／OSC-01 | D：仅新Chromium文件初次6项通过（17.7秒）。E：补充取消和新增150%缩放／滚动／边界／端点改接后，按`new curves|curve preview cancels|scaled and scrolled`过滤3项通过（13.3秒）。F：SVG序列化模块分离及存储计数断言后，仅`new curves drag once`1项通过（4.6秒）；几何2项另定向复跑通过。 |
| AC-01／04／05、EX2-05、BJT-DYN-01／04 | A包含共享孔／同组孔的LED、RC和完整卡SPICE网表等价，以及显式源短接诊断。未重跑整套数值金标准，未改变求解器或独立参考输入。 |
| AC-06／11／12／17／18、OSC-06 | D包含实际Worker／AudioContext运行、只读选择保结果、曲率修改停算清输出／停音，及曲线穿过按钮／开关仍可操作。补充连线模式点击实际引脚不误操作后，仅G：`wires crossing a running`1项通过（4.4秒）。 |
| AC-10／13／19 | B包含电位器脚标／段阻／旋转、只读说明和提示历史的3个针对性场景，D含实际PNP说明不使结果失效。未进行辅助技术或教学效果验收。 |

命令A–G的完整可复用参数见[实施记录](changes/WIRING-IMPLEMENTATION.md#执行命令与结果)。合计102个不同模块／兼容检查通过（82＋16＋4），7个不同Chromium场景分批有通过证据；复跑不重复计数，不声称同批7／7或全套通过。临时旧读取器脚本与配置只在`/tmp`，没有加入产品或CI。

`npm run build`包含strict TypeScript及生产构建，通过；全部19个改动TS／TSX文件定向ESLint通过，补充按钮／开关测试后再只检查该文件及执行`npm run typecheck`，均通过。`python3 /tmp/check_wiring_docs.py`检查11份Markdown、178条本地引用、23个锚点／围栏，批准W1–W3及验收条款逐字一致、验收ID集合、基线引用、唯一D69、文件范围及未改数值输入均通过；`git diff --check`通过。主工作区master保持干净，未提交临时检查脚本或构建产物。

未执行全套模块／E2E、Firefox／WebKit、远端CI、完整数值／性能回归；未验证目标M1／8GB、密集电路P95、真实OS焦点／硬件取消、触控板人工可用性、读屏、设备试听、师生教学效果。取消／失焦的部分场景采用浏览器事件注入，音频为API计数；均不等于人工通过。既有SPICE资源与分发许可边界继续保留，不公开部署。使用`[skip ci]`，自动协调／定时任务／跨聊天回报继续暂停，实现PR由用户最终验收合并。
