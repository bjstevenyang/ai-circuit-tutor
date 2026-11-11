# 自动化测试清单

最新增补：2026-11-05，阶段2实现PR #3；下表及第2–16节保留v0.3历史清单，阶段2见第17节。原盘点日期：2026-11-01，v0.3。本文用于查找“项目有哪些测试、各自检查什么、后来增加了什么”。验收映射、历史执行结果和未完成的发布检查见 [测试计划](TEST_PLAN.md)。

## 1. 总览

| 类别 | 测试源码 | 用例数 |
| --- | --- | ---: |
| 电路连接与有限仿真 | [circuit.test.ts](../src/circuit/circuit.test.ts) | 29 |
| 放置、编辑与撤销历史 | [model.test.ts](../src/editor/model.test.ts) | 21 |
| 新元件、直流网络 | [components.test.ts](../src/circuit/components.test.ts) | 27 |
| 多引脚与吸附 | [components.test.ts](../src/editor/components.test.ts) | 14 |
| 本地保存与恢复 | [index.test.ts](../src/storage/index.test.ts) | 19 |
| 逐级教学提示 | [index.test.ts](../src/tutor/index.test.ts) | 20 |
| 应用界面交互 | [App.test.tsx](../src/app/App.test.tsx) | 13 |
| 新元件界面控制与声音 | [components.test.tsx](../src/app/components.test.tsx) | 10 |
| 元件用途与使用说明 | [ComponentGuide.test.tsx](../src/app/ComponentGuide.test.tsx) | 13 |
| 可调电源与自定义电阻 | [parameters.test.ts](../src/circuit/parameters.test.ts) | 26 |
| LED、电位器引脚显示与参数解析 | [appearance.test.tsx](../src/editor/appearance.test.tsx) | 32 |
| 参数应用与亮度交互 | [Parameters.test.tsx](../src/app/Parameters.test.tsx) | 8 |
| 蜂鸣器增益与音量控制 | [useBuzzerSound.test.tsx](../src/app/useBuzzerSound.test.tsx) | 2 |
| 运行／停止生命周期 | [Simulation.test.tsx](../src/app/Simulation.test.tsx) | 6 |
| **Vitest 合计** | **14 个测试文件** | **240** |
| 原有浏览器流程 | [lesson.spec.ts](../tests/e2e/lesson.spec.ts) | 7 |
| 元件、参数、改接与仿真控制 | [components.spec.ts](../tests/e2e/components.spec.ts) | 28 |
| **本次浏览器合计** | **仅 Chromium** | **35** |

参数化测试按实际展开数量计数；一项用例可能包含多个断言。例如全部 420² 个孔位对的核对属于一个测试用例。Playwright 保留三种引擎配置，按用户最新要求本次仅执行 Chromium；配置数量不是通过数量。

## 2. 电路连接与有限仿真：29 项

源码：[src/circuit/circuit.test.ts](../src/circuit/circuit.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| C01 | 全部 420² 个孔位对符合独立定义的五孔组和四电源轨连接规则 |
| C02 | 中央沟槽、相邻编号、电源轨和电池端口保持正确隔离 |
| C03 | 导线链传递连接；删除桥接导线后网络分开 |
| C04 | 导线交叉、折线路径、颜色及端点顺序不改变连接 |
| C05 | 不通过电阻、LED 或电源把其两端合并为直接导通网络 |
| C06 | 按元件引脚间距和旋转推导孔位，保留 LED 引脚顺序 |
| C07 | 拒绝越界引脚、电源轨锚点和跨不过沟槽的 LED 安装 |
| C08 | 330 Ω 参考电路得到约 7.575757 mA 并完成课程 |
| C09–C11 | 分别核对 100、330、1,000 Ω 的电流和课程限流结果 |
| C12 | 电阻放在 LED 任一侧均可工作 |
| C13 | 电阻引脚互换、同组孔替换、ID／对象顺序及外观变化、冗余导线保持电气等价 |
| C14 | 完整回路中反向 LED 返回零电流且不完成课程 |
| C15 | 孤立 LED 不能仅凭绘制方向被误判为接反 |
| C16 | 优先报告电源短路，不猜测电流或 LED 状态 |
| C17 | 缺少或旁路电阻时正确诊断，不输出无效数值或 LED 状态 |
| C18 | 旁边存在未接入的电阻，不能冒充 LED 的串联限流电阻 |
| C19 | LED 被旁路和回路断开时提供对应诊断及证据 |
| C20 | 多个故障的优先级不随元件／导线顺序变化 |
| C21 | 超过单向器件数量限制或非法端点返回不支持 |
| C22 | 电阻直接跨电源按 4.5/R 求解，悬空 LED 不误亮，不套用 LED 串联公式 |
| C23–C28 | 分别处理 null、空对象、非法导线集合、空元件、空导线、错误旋转类型；返回不支持而非抛异常 |
| C29 | 重复对象 ID 不能被误判为成功电路 |

## 3. 放置、编辑与历史：原有 12 项

源码：[src/editor/model.test.ts](../src/editor/model.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| E01 | 按安装形态放置两个引脚，保留原文档不变 |
| E02 | 越界放置或旋转失败时原子拒绝修改 |
| E03 | 元件、导线和电池端口遵守单端占用规则 |
| E04 | 拒绝元件本体重叠，允许导线跨过元件本体 |
| E05 | 允许物理合法但电气错误的同组 LED 双引脚安装 |
| E06 | 允许同类多个实例，所有对象 ID 仍须唯一 |
| E07 | 删除元件释放引脚，保留连接到孔位的导线 |
| E08 | 导线编辑只改变选定属性，拒绝非法颜色／端点等输入 |
| E09 | 修改阻值不创建新元件，重置产生空文档 |
| E10 | 已完成操作及重置支持撤销／重做 |
| E11 | 新编辑清空重做历史；无变化操作不增加历史 |
| E12 | 历史最多保留 50 步 |

## 4. 本地保存与恢复：15 项

源码：[src/storage/index.test.ts](../src/storage/index.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| S01 | 空存储初始化及完整电路文档保存／恢复 |
| S02 | 损坏或未知版本存档读取失败时保留原始内容 |
| S03 | 拒绝悬空引用、非法安装、占用冲突、未知元件和非法参数 |
| S04 | 读写失败返回错误，保留之前成功保存的内容 |
| S05 | 无效内存文档不能覆盖有效存档 |
| S06 | 没有浏览器存储环境时返回可展示的错误 |

## 5. 逐级教学提示：19 项

源码：[src/tutor/index.test.ts](../src/tutor/index.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| T01–T09 | 对 source-short、missing-resistor、resistor-bypassed、led-bypassed、open-circuit、reversed-led、overcurrent、unsupported、missing-led 分别检查标题、描述和三条非空且不同的提示 |
| T10 | 每次请求只增加一层提示，反向 LED 示例前两层不直接给出交换操作，三层后封顶 |
| T11 | 短路、课程电流限制和不支持拓扑的解释符合模型限制 |
| T12–T14 | 分别将负数、NaN、负无穷的提示进度规范化 |

## 6. 应用界面交互：原有 11 项

源码：[src/app/App.test.tsx](../src/app/App.test.tsx)。使用模拟 DOM，真实浏览器中的点击命中和键盘行为由下一节验证。

| 编号 | 检查内容 |
| --- | --- |
| A01–A02 | Delete、Backspace 分别删除选中元件，保存结果，并支持撤销 |
| A03 | 上方工具栏提供删除按钮，无选择时禁用，选中后可删除 |
| A04–A05 | 在文本框内分别按 Delete、Backspace 不删除选中元件 |
| A06 | 同一快捷键路径也能删除选中导线 |
| A07 | 连接观察器显示正确网络、隔离及可访问的成员说明 |
| A08 | 无效放置保留输入，文档和历史不被修改 |
| A09 | 编辑过程中不自动覆盖损坏的原存档 |
| A10 | 无法计算 LED 状态时不误报为熄灭 |
| A11 | 撤销放置后退出移动模式并清理未完成布线 |

## 7. 浏览器流程：7 个场景

源码：[tests/e2e/lesson.spec.ts](../tests/e2e/lesson.spec.ts)。原有场景继续保留，本次仅执行 Chromium。

| 编号 | 操作与预期结果 |
| --- | --- |
| B01 | 两种删除按键、输入框保护、可见删除按钮、撤销及刷新后删除结果保持 |
| B02 | 搭建有效电路、运行成功、观察连接、刷新恢复，且无页面异常 |
| B03 | 反向 LED 请求三层提示，修改使旧结果失效，修复后运行成功 |
| B04 | 指针预览并放置，拒绝占用孔位，撤销／重做恢复元件 |
| B05 | 全程使用键盘搭建并运行成功，无需拖动 |
| B06 | 存储写入失败时展示未保存提示、保留内存元件并提供重试 |
| B07 | 导线经过空孔不会挡住选择，方向键能移动孔位焦点 |

## 8. 后来新增了哪些测试

首次 MVP 提交 `9f68639` 建立了 66 项 Vitest 测试和 6 个浏览器场景。

删除功能修复提交 `86a912f` 新增：

- **6 项 Vitest 回归：A01–A06。** 验证删除快捷键、工具栏入口、输入保护和导线删除。
- **1 个浏览器场景：B01。** 验证真实浏览器里的删除、撤销和持久保存。

删除修复后的基线为 72 项 Vitest 和 7 个浏览器场景。v0.2 新增 62 项 Vitest 与 9 个浏览器场景；原有用例按多实例与直流模型更新，测试源码仍与实现就近放置。

## 9. 配套文件与运行方法

- [src/test-setup.ts](../src/test-setup.ts)：DOM 断言初始化，不是独立用例。
- [tests/fixtures/circuits.ts](../tests/fixtures/circuits.ts)：参考电路和导线构造器，不是独立用例。
- [vite.config.ts](../vite.config.ts)：Vitest 的测试文件匹配与环境配置。
- [playwright.config.ts](../playwright.config.ts)：浏览器项目、本地服务器和 E2E 配置。
- [CI 工作流](../.github/workflows/ci.yml)：推送／PR 时执行项目检查。

```sh
# 执行全部模块／界面测试，并显示逐项名称
npm test -- --reporter=verbose

# 仅执行电路测试
npm test -- src/circuit/circuit.test.ts

# 只列出浏览器测试，不启动浏览器执行
npm run test:e2e -- --list

# 执行全部浏览器测试
npm run test:e2e -- --project=chromium

# 仅执行 Chromium 删除回归
npm run test:e2e -- --project=chromium --grep 'deletion works' --workers=1
```

当前实际执行结果见 [测试计划](TEST_PLAN.md)。新增或删除测试时同步更新本清单及对应验收映射。


## 10. v0.2 新增用例明细

下列编号延续原有类别编号；参数化用例按实际展开计数。

### 电路：C30–C56（27 项）

源码：[src/circuit/components.test.ts](../src/circuit/components.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| C30 | 串联电阻相加，反向安装无极性电阻仍保持数值 |
| C31 | 并联 LED 各有电阻，总电流可超过 20 mA；只有超限支路的 LED 获诊断 |
| C32 | 两颗串联 LED 的电压降相加 |
| C33 | 三颗串联 LED 供电不足，0 mA |
| C34 | 并联理想 LED 共用电阻时拒绝任意分配电流 |
| C35 | 二极管 0.7 V 与 LED 2 V 分别计入 |
| C36 | 反向二极管截止并引用正确器件 |
| C37 | LED 或二极管直接跨电源不获得伪造有限电流 |
| C38 | 普通并联电阻可求解，不要求输出器件 |
| C39 | 蜂鸣器正确供电、反向、欠压及负载电流 |
| C40–C42 | 光照 0／50／100% 对应独立手算阻值、电流和超限结果 |
| C43 | 对象顺序、导线方向、颜色和折线不改变结果 |
| C44 | 开关断开为控制状态，闭合后导通；不伪造触点电流 |
| C45 | 悬空接线不错误归因于不相关开关 |
| C46 | 闭合开关跨电池造成源短路 |
| C47 | 按钮两组内部连接、按下合并、释放隔离 |
| C48 | 按钮只在 controls 按住时导通，不修改文档 |
| C49 | 空载电位器中点及总电流，不把非零电阻端合并 |
| C50 | 带载分压得到 1.5 V，而非套用空载 2.25 V |
| C51–C52 | 旋钮 0／100% 无除零，正确合并零阻端 |
| C53 | 零阻滑臂跨电池导致短路 |
| C54 | 非对称桥式电阻节点电压与手算相符，满足基尔霍夫电流守恒 |
| C55 | 悬空 LED／二极管／蜂鸣器不能由数值偏置误报反向 |
| C56 | 多个截止器件的浮置点不虚构归因，无关开关不产生控制诊断 |

### 编辑：E13–E26（14 项）

源码：[src/editor/components.test.ts](../src/editor/components.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| E13–E18 | 六种新增元件逐一检查全部引脚与每个插孔占用 |
| E19–E22 | 四个角度的按钮封装，含沟槽导致的非法落孔 |
| E23 | 占用按钮引脚和越界移动拒绝，原锚点保留 |
| E24 | 合法配置成功，错误类型／范围原子拒绝 |
| E25 | 总元件、单向器件、导线三种独立限额 |
| E26 | 安装孔吸附不落电源轨／沟槽；导线吸附可选电源轨和电池 |

### 存储：S07–S15（9 项）

源码：[src/storage/index.test.ts](../src/storage/index.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| S07 | 旧版作品迁移保留实体／接线，加载不自动写回（现规范化为 v3） |
| S08 | 八类器件参数往返，过滤瞬态按压／分析字段 |
| S09–S15 | 负旋钮、非整数位置、光照越界、非布尔开关、零电阻、过大电阻、错误器件参数逐一拒绝 |

### 提示：T15–T19（5 项）

源码：[src/tutor/index.test.ts](../src/tutor/index.test.ts)。新增 control-open、insufficient-voltage、reversed-diode、buzzer-reversed、buzzer-undervoltage 的三层内容完整性检查。

### 应用：A12–A18（7 项）

源码：[src/app/components.test.tsx](../src/app/components.test.tsx)。

| 编号 | 检查内容 |
| --- | --- |
| A12 | 八种选项、同类多实例及四脚信息 |
| A13 | 开关即时重算、保存与撤销失效 |
| A14 | 键盘／指针按钮按住、松开、失焦／窗口失焦释放，不保存按压 |
| A15 | 光照改变电流及 LED 超限诊断 |
| A16 | 三端电位器即时分压，保存设置且不移动引脚 |
| A17 | 声音默认关闭，主动启用后启动，关闭及卸载清理音频 |
| A18 | 音频不可用时给出视觉兜底说明 |

### 浏览器：B08–B16（9 个场景）

源码：[tests/e2e/components.spec.ts](../tests/e2e/components.spec.ts)。本次仅执行 Chromium。

| 编号 | 检查内容 |
| --- | --- |
| B08 | 八类元件及重复实例放置、配置、刷新恢复 |
| B09 | 开关即时更新和刷新保持 |
| B10 | 按钮键盘／鼠标按住与释放、失焦和刷新不保留按压 |
| B11 | 带载电位器及光照变化的 LED 超限 |
| B12 | 二极管诊断／提示、蜂鸣器视觉状态和声音主动启用 |
| B13 | 缩放后拖动元件、单步历史、导线仍绑定原孔、刷新恢复 |
| B14 | 拖动占用／越界回退，Esc 取消不增加历史 |
| B15 | 电池／孔位拖动连线、预览、运行、单步撤销和刷新 |
| B16 | 拖动连线拒绝占用／同端点，Esc 取消，并保留原点击两端方式 |


## 11. 已有导线改接回归（2026-10-31）

在上一轮 134 项模块测试及 16 个浏览器场景上，本次新增 9 项模块／界面测试和 3 个 Chromium 场景；该轮结束时为 143 项 Vitest、19 个 Chromium 场景。

| 编号 | 文件 | 覆盖内容 |
| --- | --- | --- |
| E27–E28 | src/editor/model.test.ts | 分别改接起点／终点，保留 ID、样式、另一端、线数量和原文档 |
| E29 | src/editor/model.test.ts | 组件、导线、电池占用及无效／重合端点原子拒绝 |
| E30 | src/editor/model.test.ts | 原孔可保持，旧孔在改接后释放 |
| E31 | src/editor/model.test.ts | 允许物理合法的错误电路，交由分析处理 |
| E32 | src/editor/model.test.ts | 不存在的导线不能被改接或意外创建 |
| E33 | src/editor/model.test.ts | 单步撤销／重做，无变化不加历史 |
| A19 | src/app/App.test.tsx | 两端手柄、键盘聚焦、表单改接、规范化输入、保存及撤销 |
| A20 | src/app/App.test.tsx | 非法输入保留供修改，原存档不变 |
| B17 | tests/e2e/components.spec.ts | 缩放后拖动两端，样式与 ID 保持，结果失效、一步撤销、刷新恢复 |
| B18 | tests/e2e/components.spec.ts | 占用／重合／空白回退，Esc 和 pointercancel 取消，原地改接无历史且结果保留 |
| B19 | tests/e2e/components.spec.ts | 手柄键盘激活、表单选择起点、无效输入保留及正确改接 |


## 12. 元件说明回归（2026-10-31）

新增 12 项模块／界面测试及 2 个 Chromium 场景；该轮结束时合计 155 项 Vitest、21 个 Chromium 场景。实际执行结果见测试计划。

| 编号 | 文件 | 覆盖内容 |
| --- | --- | --- |
| A21–A28 | src/app/ComponentGuide.test.tsx | 八类器件逐一从元件盒展示用途、引脚与接法，无需放置，不写存储、不产生历史 |
| A29 | src/app/ComponentGuide.test.tsx | 已放置电位器的 A／W／B 对应旋转后的孔位，移动后同步更新 |
| A30 | src/app/ComponentGuide.test.tsx | 常开按钮两组永久连接及可展开的虚拟封装说明 |
| A31 | src/app/ComponentGuide.test.tsx | 查阅时保留运行诊断、已请求提示、文档和历史 |
| A32 | src/app/ComponentGuide.test.tsx | 元件盒／精确放置切换后替换内容，不沿用旧实例孔位；选择孔位／导线后清除旧说明 |
| B20 | tests/e2e/components.spec.ts | 键盘浏览八类元件说明、展开常见错误、查看示例，作品不改变；截图用于排版核对 |
| B21 | tests/e2e/components.spec.ts | 实例按钮四脚显示真实孔位，查阅保留诊断／提示；精确选择与导线选择切换正确 |


## 13. v0.3 参数、LED、音量及开关操作（2026-11-01）

在上一轮 155 项 Vitest／21 个 Chromium 场景上，新增 **70 项 Vitest 和 7 个浏览器场景**；该轮结束时合计 **225 项／28 个**。参数化用例按实际展开计数。既有 A13、B09 也改为操作开关本体，覆盖运行后直接切换。

### 电气参数：C57–C82（26 项）

源码：[src/circuit/parameters.test.ts](../src/circuit/parameters.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| C57–C62 | 电源 1.5／2／3／4.5／6／9 V 下的手算 LED 电流、截止与超限 |
| C63 | 三颗串联 LED 在 6 V 截止、9 V 导通，压降与电流正确 |
| C64–C67 | 自定义 10／470／470.5／1,000,000 Ω 的手算电流 |
| C68–C73 | 蜂鸣器 1.5／3／4.5／5／6／9 V 的负载电流、欠压／正常／过压状态 |
| C74–C81 | 非有限、负数、零、越界、缺失及字符串电压被拒绝 |
| C82 | 9 V 源短路不伪造有限电流 |

### 编辑与呈现：E34–E62（29 项）

源码：[model.test.ts](../src/editor/model.test.ts) 及 [appearance.test.tsx](../src/editor/appearance.test.tsx)。

| 编号 | 检查内容 |
| --- | --- |
| E34 | 电源修改原子提交、规范化为 v3、单步撤销／重做 |
| E35 | 非法电压不改变原文档 |
| E36–E41 | 六种电流／截止状态对应独立相对亮度期望，并在 20 mA 封顶 |
| E42 | 未计算与已计算截止区别，非有限／负数不绘制伪造亮度 |
| E43 | 光晕随电流连续单调，超流显示封顶 |
| E44–E47 | 四个旋转方向的 A＋／K− 实际孔位、平边、正向文字及可访问说明 |
| E48 | 放置预览有极性标记且不重复创建实例描述 ID |
| E49–E58 | 空白、非数字、无穷大、十六进制及越界等十种参数草稿拒绝 |
| E59–E62 | 四种完整十进制小数／科学计数法输入正确解析 |

### 应用与声音：A33–A42（10 项）

源码：[Parameters.test.tsx](../src/app/Parameters.test.tsx) 及 [useBuzzerSound.test.tsx](../src/app/useBuzzerSound.test.tsx)。

| 编号 | 检查内容 |
| --- | --- |
| A33 | 电阻草稿不提交；应用后电流／亮度更新，单步撤销／重做 |
| A34 | 非法阻值保留作品、结果与原存档 |
| A35 | 自定义电压同步全部标签、求解、保存和撤销 |
| A36 | 非法电压拒绝；9 V 合法但 LED 超流时显示诊断和亮度封顶 |
| A37 | 相同参数应用不保存、不增加历史、不清除结果 |
| A38 | 未运行时极性说明正确，旋转后孔位更新 |
| A39 | 电位器 A／W 变阻接法改变电流及 LED 相对亮度 |
| A40 | 两条独立限流支路的 LED 读取各自电流，不使用总电流 |
| A41 | 声音须主动启用，默认增益从 0.025 提高至 0.125，停止时清理 |
| A42 | 实时平滑调节、0% 静音、非法音量拒绝、不重启振荡器，停止／恢复正确 |

### 存储及提示：S16–S19、T20（5 项）

源码：[storage/index.test.ts](../src/storage/index.test.ts)、[tutor/index.test.ts](../src/tutor/index.test.ts)。

| 编号 | 检查内容 |
| --- | --- |
| S16–S17 | v1／v2 按原有 4.5 V 迁移，忽略旧格式未知电压字段；加载不写回，下次保存写 v3 |
| S18 | 自定义电压／小数阻值往返，派生亮度与音量不进入存档 |
| S19 | 非法 v3 及未来 v4 保留原存档并暂停覆盖 |
| T20 | 蜂鸣器过压诊断的三层提示内容完整 |

### Chromium：B22–B28（7 个场景）

源码：[tests/e2e/components.spec.ts](../tests/e2e/components.spec.ts)。

| 编号 | 检查内容 |
| --- | --- |
| B22 | 电阻草稿／验证、应用电流、单步历史、刷新恢复 |
| B23 | 电池电压验证、标签、运行、撤销、刷新、过流与欠压 |
| B24 | LED 四方向极性、预览、随阻值变化的亮度，截图核对 |
| B25 | 电位器作为变阻器连续调光 |
| B26 | 并联 LED 逐支路亮度，不由电池总电流控制 |
| B27 | 浏览器 AudioContext 增益 0.125→0.25→0 平滑调节、过压停声、刷新复位 |
| B28 | 运行前点击仅选择；运行后点击／Space／Enter 切换，重复按键及拖动不误切换，状态刷新恢复 |

音频 API 检查不等于设备实际响度验证；读屏、学生理解和真实设备试听仍见测试计划中的待办。


## 14. 运行／停止操作回归（2026-11-01）

新增 **6 项界面测试和 2 个 Chromium 场景**；该轮结束时合计 **231 项 Vitest、30 个 Chromium 场景**。验收来源为 AC-17，同时回归 AC-06／07／11／12。

源码：[Simulation.test.tsx](../src/app/Simulation.test.tsx) 和 [components.spec.ts](../tests/e2e/components.spec.ts)。

| 编号 | 检查内容 |
| --- | --- |
| A43 | 初始停止、运行／停止／恢复；停止清除 LED 光效与读数，不改变存档和历史 |
| A44 | 运行中开关本体点击／键盘控制，停止时只选择；保持开关位置，撤销退出运行 |
| A45–A46 | 故障、不支持结果均可停止，诊断和已请求提示清除 |
| A47 | 停止释放瞬时按钮；重新运行不会沿用按压，不改存档和历史 |
| A48 | 停止清理蜂鸣器振荡器；保留声音许可／音量，停止时修改电压不发声，恢复运行才播放 |
| B29 | 实际浏览器鼠标／键盘运行停止、开关控制、停止保留作品、恢复计算和刷新保持停止；截图核对状态栏 |
| B30 | 实际 AudioContext 启动／停止振荡器；停止不保存作品，参数修改不恢复声音，重新运行保留声音许可 |


## 15. 黄色按钮本体回归（2026-11-01）

用户明确指出是黄色四脚常开按钮。原先绿色开关本体已能操作，但黄色按钮仅选中／拖动，按压只存在于下方控件。新增复现测试直接按下板上圆钮，在修复前因 LED 未亮而失败；接入临时按压回调后通过。

新增 **3 项界面测试和 3 个 Chromium 场景**；该轮结束时合计 **234 项 Vitest、33 个 Chromium 场景**。对应 AC-18，并回归 AC-07／09／11／13／17。

| 编号 | 源码 | 检查内容 |
| --- | --- | --- |
| A49–A50 | [components.test.tsx](../src/app/components.test.tsx) | Space／Enter 逐一在板上按钮本体接通，正确释放；重复按键不翻转、其他按键释放不误断开；失焦释放，不保存／追加历史 |
| A51 | [components.test.tsx](../src/app/components.test.tsx) | 停止清除本体按压，停止中按键不接通，再次运行后可重新按下，Esc 释放 |
| B31 | [components.spec.ts](../tests/e2e/components.spec.ts) | 直接按黄色圆钮使 LED 亮；移出后松手仍释放，按压不拖动、不保存、不加入历史；截图核对按下反馈 |
| B32 | [components.spec.ts](../tests/e2e/components.spec.ts) | 本体键盘重复、释放、失焦、Esc、pointercancel、停止均不锁定；停止中点圆钮不运行 |
| B33 | [components.spec.ts](../tests/e2e/components.spec.ts) | 运行中拖动灰色外壳移动、不按下；单步撤销恢复 |

B21 的只读说明流程改为点击按钮灰色外壳；运行中本体 Enter／Space 已明确属于按压控制，不能继续把它当作纯阅读步骤。八类说明的键盘阅读仍由元件盒流程 B20 覆盖。


## 16. 电位器引脚与接法说明（2026-11-01）

新增 **6 项模块／界面测试和 2 个 Chromium 场景**；当前合计 **240 项 Vitest、35 个 Chromium 场景**。对应 AC-19。

| 编号 | 源码 | 检查内容 |
| --- | --- | --- |
| E63–E66 | [appearance.test.tsx](../src/editor/appearance.test.tsx) | 四个方向的独立 A／W／B 标签、预期实际孔位、正向文字和可访问说明 |
| E67 | [appearance.test.tsx](../src/editor/appearance.test.tsx) | 放置预览保留逐脚标记，不创建重复描述 ID |
| A52 | [ComponentGuide.test.tsx](../src/app/ComponentGuide.test.tsx) | 接线面板的孔位、无固定正负、滑臂及同组空孔说明；查阅不保存／追加历史，旋钮改变两段阻值，旋转和移动同步孔位 |
| B34 | [components.spec.ts](../tests/e2e/components.spec.ts) | 四方向标记、实际孔位、可访问描述及预览，截图核对 |
| B35 | [components.spec.ts](../tests/e2e/components.spec.ts) | 从空板通过表单搭建 A–W 调光电路，B 留空、导线接同组空孔；运行后旋钮端点改变亮度、内部电阻段同步，并检查接线指导截图 |


## 17. 阶段2新增测试（2026-11-05）

v0.3原有240项全部保留；本轮增加95项，共335项／21个Vitest文件。参数化用例按实际展开统计，实际执行与未验证项见[实施证据](changes/STAGE-2-IMPLEMENTATION.md)。

| 文件 | 数量／变化 | 检查内容 |
| --- | ---: | --- |
| [rgb.test.ts](../src/circuit/rgb.test.ts) | 新10 | 电流／颜色、8开关组合、改变R／25mA逐通道超流 |
| [npn.test.ts](../src/circuit/npn.test.ts) | 新8 | 三态独立算例、严格参考与恢复、重合边界、独立Ic超流及修复、B-MAX |
| [transient.test.ts](../src/circuit/transient.test.ts) | 新5 | 0/1τ/5τ、连续充放电／保持／带载、时间限制、R/C改变τ |
| [piezo.test.ts](../src/circuit/piezo.test.ts) | 新5 | 三频率/Vpp、衰减/DC/断开、KCL及独立C·dv/dt |
| [stage2-regression.test.ts](../src/circuit/stage2-regression.test.ts) | 新41 | 电气负例／等价性、四封装、v4与旧格式、静态fixture哈希、预算与128/129真实矩阵、120/121合法孔位边界、审查缺陷回归 |
| [Stage2.test.tsx](../src/app/Stage2.test.tsx) | 新19 | 运行／暂停／零初态、参数后解析轨迹、60s自动停止、四类说明与独立引脚映射、误删保护 |
| [ChoiceGroup.test.tsx](../src/editor/ChoiceGroup.test.tsx) | 新3 | 单一Tab停靠、方向／首尾与焦点、点击不提交外层表单 |
| [useBuzzerSound.test.tsx](../src/app/useBuzzerSound.test.tsx) | 原2→6（+4） | 保留有源蜂鸣器音量回归；新增API失败、三频率正弦与模型幅度参数 |
| [stage2.spec.ts](../tests/e2e/stage2.spec.ts) | 新9 | 四实验表单搭建、故障/修复/刷新；四实验纯键盘从空板；第25件原子拒绝且24件仍可运行 |

Chromium总场景为44（原35＋新9），实际执行结果以实施证据为准。`tests/fixtures/stage2.ts`／`stage2-reference.json` 是可审阅的受控样例，含真实孔位、导线及canonical SHA256，不是测试通过记录。

固定性能runner与功能测试分开：

- [core.perf.ts](../tests/performance/core.perf.ts)：六个固定B输入，分别10次预热＋100次完整编译／求解，B-MAX P/T/576候选及独立KCL。
- [ui.perf.ts](../tests/performance/ui.perf.ts)：RGB/NPN/压电/最大DC的指针／键盘响应和停止、压电持续受驱动时变幅、RC第5秒的两个操作与停止；每组分别100样本。真实后台十次检查需`RUN_REAL_FOCUS=1`与专用桌面，默认跳过，不能计通过。
- [memory.perf.ts](../tests/performance/memory.perf.ts)：M-RC/M-PIEZO各十次真实60s会话及规范GC堆采样／资源清理；不以加速时钟替代。
- [config.ts](../tests/performance/config.ts)、[vite.config.ts](../tests/performance/vite.config.ts)、[helpers.ts](../tests/performance/helpers.ts)：隔离生产构建、单worker Chromium及观测工具，不增加运行依赖，不进入正常生产入口。

命令：先`npx vite build --config tests/performance/vite.config.ts`，再`npm run test:performance`；长运行与其他测量不并跑。指定M1/8 GB和实际辅助技术／教学验证仍按人工清单执行。

## 18. OSC v2新增测试（2026-11-08）

配置/存档测试见catalog、CapacitanceEditor、storage/oscillator和OscillatorConfiguration；纯数值测试见src/circuit/oscillator下fixtures/numeric/contracts/analysis/verification，覆盖独立参考、变体、精确反例、等价、预算及失败。异步生命周期见oscillatorSession和OscillatorLifecycle；声音边界追加在useBuzzerSound；Chromium在tests/e2e/oscillator.spec.ts；有限生产性能在tests/oscillator-performance。实际通过数量及交付边界统一见TEST_PLAN和OSCILLATOR-IMPLEMENTATION最新记录，旧历史清单不改写成新通过。

## 19. 可选晶体管型号时间分辨率（2026-11-10）

- [namedModels.test.ts](../src/circuit/oscillator/namedModels.test.ts)：新增11项，覆盖未指定／通用／两种混用／双具名的步长选择、双具名默认与严格40ms近直流、参数不变、两种混用无假频率、0.1ps边界拒绝，以及显式精度／预算失败注入。
- [oscillator.spec.ts](../tests/e2e/oscillator.spec.ts)：新增1个Chromium场景，验证真实Worker完成双具名计算、型号选择保存、近直流清旧声，切回通用卡后重新获得稳定周期及音频。

仅定向执行，22个不同模块／会话场景分次通过、1个Chromium场景通过；命令、变更验收与未验证项见[测试计划](TEST_PLAN.md#可选晶体管型号步长修复2026-11-10)。不重写旧章节数量，不声称全套或设备试听通过。

## 20. 自激v2电容扩至1μF（2026-11-10）

- [capacitanceRange.test.ts](../src/circuit/oscillator/capacitanceRange.test.ts)：新增6项，包含221／500／1000nF精确应用／撤销／保存、旧模型与格式保护，以及1μF通用／具名参考的有限计算与诚实失败输出。
- [CapacitanceEditor.test.tsx](../src/editor/CapacitanceEditor.test.tsx)：新增1项，1μF单位换算与预设；原超限草稿由221nF改为1001nF。
- [catalog.test.ts](../src/circuit/catalog.test.ts)：合法范围表新增221／500／1000nF三项，更新超限边界，继续验证原实验模型拒绝其他容量。
- [oscillator.spec.ts](../tests/e2e/oscillator.spec.ts)：扩展现有2个Chromium场景，覆盖1μF应用／错误保护／撤销／刷新，以及具名卡数值失败不残留旧读数或声音、恢复100nF通用周期；无新增浏览器场景。

本轮5文件53项模块／界面测试通过，两个受影响Chromium场景分次通过，严格构建及定向静态检查通过。具体命令／逐ID证据及具名1μF尚未收敛的限制见[测试计划](TEST_PLAN.md#自激v2容量扩容定向验证2026-11-10)；历史全套计数不改写。

## 21. 标准SPICE晶体管动态模型（2026-11-10）

- [netlist.test.ts](../src/spice/netlist.test.ts)：3项，明确型号／源短路、全卡／引脚与零压传感器、显式模型版本／未知保护／撤销／存档。
- [spice-engine.spec.ts](../tests/e2e/spice-engine.spec.ts)：4个Chromium场景，原图与NPN／PNP开关动态分别对照原生SPICE，以及实际Worker完整模型／保存／刷新／计算中停止。
- [原生基准生成器](../tests/spice/generate-reference.py)、三个`.cir`网表及对应`*-summary.json`：离线原生参考，输入SHA256和固定容差，不调用生产求解器生成自身期望。

本轮6文件53项定向模块通过；四个浏览器场景分次通过，严格构建及定向静态检查通过。逐ID结果和未闭合的性能／工作区／分发许可／人工项见[测试计划](TEST_PLAN.md#标准spice晶体管动态模型2026-11-10)。
