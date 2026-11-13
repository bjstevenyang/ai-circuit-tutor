# 连线交互改进实施与定向验证（2026-11-12）

## 授权及固定基线

- 需求：[PR #10](https://github.com/bjstevenyang/ai-circuit-tutor/pull/10)、[CR-WIRING-UX](CR-WIRING-UX.md)，用户已合并并在当前会话要求“现在你可以实现这些improvement了”。
- 获批需求head：`b48e20f3da6a4eb0778ffd91672525563ed25b03`；GitHub实际合并及本地／远端master需求基线：`c1a09c077184a047da7b5f53bd8d93123619374c`。已核实需求head在该主线历史中，合并方式为merge commit。
- 原有功能与定向验证提交仍为`89e3886266addaf12e7ac34efb5ad988cfb9bd7f`；`b48e20f`／`c1a09c0`只合并需求文档，不冒充新增功能实现。
- 从干净的实际需求基线创建已授权分支`codex/wiring-improvements`，工作区`/tmp/ai-circuit-wiring-implementation`。主工作区保持master，不直接提交／推送master。
- 仅实施已批准W1–W3。电路求解方程、数值设置、参考输入、器件卡、存储键和schema版本不变；不加入新依赖或自动布线。
- 代码SHA与实现PR在提交／创建后以PR当前head记录；本文件不引用自身未来SHA。实现PR不自行合并，自动协调／定时任务／跨聊天回报继续暂停。

## 实现内容

1. `circuit/wires.ts`校验v5曲线普通字段并派生独立引脚／导线占用。`editor/model.ts`允许一引脚＋一线，仍拒绝同类重复占用；创建／放置／移动／旋转／改接及完整校验共用规则。移动／删除元件不带走导线。
2. `validation.ts`白名单复制曲线控制点；旧v1–4在规范化前保留原折线／单占用检查。新曲线缺点、点越界／非有限、折线带曲线字段均拒绝；加载仍只读。
3. `editor/wireGeometry.ts`处理纯数值默认点／边界；`wirePath.ts`单独序列化显示路径，避免完整文档校验间接引入SVG生成。实际线条、透明命中带、高亮、创建／改接预览共用同一显示路径。
4. 新线默认曲线，旧折线保形；属性区选择三种路径，曲线柄可拖动或键盘调整。临时预览不调用文档编辑；松手一次，取消／失焦／模式或文档变化不提交旧快照。颜色／改接保留控制点；切回折线移除控制点。
5. 查看模式将背景孔位置于线身命中之下；连线模式保留孔位优先，并将实际元件插入孔置于元件图形之上。元件本体控制保持可用；曲线／端点柄独立置顶。
6. 空闲／仅引脚／仅导线／共用有独立标记及可访问说明；更新元件说明和指南，明确虚拟共孔与实物同组孔方案。

## 每项验收证据

| 验收ID | 测试／实际场景 | 执行及证据 |
| --- | --- | --- |
| AC-02、EX2-09、OSC-01 | `editor/wiring.test.ts`覆盖14类封装×4方向的逐脚共孔、先线后件／先件后线、二线／二引脚拒绝和输入不变；旋转／改接／移动／删除分别释放；旧footprint相关场景保留边界／本体限制 | A的82项含上述场景；B的相关组件／PNP／speaker／编辑场景通过；D中真实引脚点击及拖动、反向放置／改接通过 |
| AC-03 | 几何测试按固定点独立检查二次路径／默认法向点／退化线／边界；模型检查颜色和端点改接保点；真实指针点击被线覆盖的孔位，在两模式得到不同正确对象 | A、D／E通过；移动SVG序列化模块后仅重跑几何2项和F的实际曲线场景 |
| AC-07 | 曲线预览零存储写入，松手一次写入；一次撤销恢复原曲线，重做、键盘步长／重复键、无移动点击无历史；Esc／取消／捕获丢失／失焦／模式／文档变化／删除取消不覆盖 | A、D／E／F通过；pointercancel、lostpointercapture及blur通过浏览器事件注入验证处理路径，不冒充真实OS／硬件事件 |
| AC-08、EX2-10、OSC-06 | v5曲线／共孔保存恢复；v1–4合法折线只读迁移、旧格式拒绝新曲线及共享；非法点保护原文；固定旧版读取器实测读取旧折线、拒绝新曲线／共享且零写入 | A、B、C及D／E的刷新恢复通过；未重跑全部存储故障／版本测试 |
| AC-09 | 控制柄方向键10单位、Shift细调1单位，重复键不连跳；150%画布、滚动后的真实曲线拖动／边界夹紧／端点拖到元件引脚；端点表单也可改接 | D／E／F通过；非拖动路径及实际坐标均有证据 |
| AC-01／04／05、EX2-05、BJT-DYN-01／04 | 曲线和同孔接法与同组孔接法的LED电流、RC时刻电压及完整卡SPICE生成网表等价；显式源短接仍诊断 | A通过；沿用已有独立基准，不重跑原生SPICE波形／整套数值金标准 |
| AC-06／12／17、OSC-06 | 实际虚拟振荡器Worker算出周期、Chromium AudioContext启动；选择元件／线、读说明保留结果与作品；真正移动控制点停止、清读数并停止已启动振荡器，撤销不复活运行 | D通过；B保留提示进度／历史的只读说明场景。声音是API计数证据，未做设备试听或停止延迟测量 |
| AC-11／18 | 一根曲线穿过运行中按钮／开关本体，仍可按压／松开或切换，元件不移动；连线模式点其真实引脚只设置连线起点，不按压／切换 | D初次本体场景通过；补充引脚操作后仅重跑G场景，1项通过 |
| AC-10／13／19 | 电位器实际脚位与段阻／方向同步、说明只读不改文档／提示；元件共孔说明保留实物同组孔；实际PNP说明浏览不使结果失效 | B的3个说明场景及D通过；不是读屏／教学效果验证 |

## 执行命令与结果

- A：`npm test -- src/editor/wiring.test.ts src/editor/wireGeometry.test.ts`：2文件82项通过。新增最小回归先在原实现上2失败、4通过；修复后只重跑失败的2项通过，再扩充本轮定向场景。不是全套模块。
- B：`npm test -- src/editor/model.test.ts src/editor/components.test.ts src/circuit/catalog.test.ts src/storage/index.test.ts src/app/ComponentGuide.test.tsx -t 'reserves all component|derives all pins|maps real PNP|rejects occupied, invalid|rejects dangling|explains actual potentiometer|preserves the run result|replaces old content'`：5文件16项通过、71项过滤未执行。
- C：`npx vitest run --config /tmp/ai-circuit-wiring-legacy-check.config.mts`：4项通过。临时只读检查同时调用新保存／读取器与主工作区固定旧读取器；先断言主工作区HEAD是`c1a09c077184a047da7b5f53bd8d93123619374c`、其src与`51c044a`无差异。新程序保存折线／曲线／共享折线／共享曲线；旧程序只读取第一种，其他保留原文并零写入；新程序随后仍可完整恢复。临时配置／脚本不进入产品或CI。
- D：`CIRCUIT_E2E_PORT=5189 npx playwright test tests/e2e/wiring-improvements.spec.ts --project=chromium --workers=1`：初次6项通过（17.7秒），范围仅此文件。
- E：同命令加`-g 'new curves|curve preview cancels|scaled and scrolled'`：3项通过（13.3秒）；包含新增的第7个缩放／滚动场景和补充取消断言。7个不同场景已有分批证据，不声称同批7／7。
- F：同命令加`-g 'new curves drag once'`：1项通过（4.6秒），加入Storage.setItem计数，确认预览零写、松手一次写；同时验证最终SVG模块分离后的实际渲染。几何2项定向复跑通过。
- G：同命令加`-g 'wires crossing a running'`，只补验开关／按钮引脚不误操作；1项通过（4.4秒）。
- `npm run build`通过，包含严格TypeScript；当前改动的19个TypeScript／TSX文件定向ESLint通过，最后补充开关／按钮断言后仅重跑该测试文件的ESLint及`npm run typecheck`，均通过。
- `python3 /tmp/check_wiring_docs.py`：11份Markdown、178条本地引用、23个锚点通过；W1–W3及验收条款与批准SHA逐字一致，验收ID集合、完整基线引用、唯一D69、文件范围及未改数值输入均核实。`git diff --check`通过；主工作区master保持干净。临时文档检查脚本不进入产品或CI。

## 交付边界

未运行全套模块／E2E、Firefox／WebKit、完整数值或性能回归、远端CI、实际辅助技术、目标设备／触控板人工可用性或教学试用。未测定密集电路P95、真实OS焦点／硬件取消、设备试听、WASM资源峰值；不把事件注入／API计数／截图当作这些门槛通过。

旧SPICE模型的实物／真实负载／资源／许可边界继续保留。本轮没有新增依赖、公开部署、自动合并、定时任务或跨聊天回报；使用`[skip ci]`避免触发完整CI。最终实现验收及合并由用户决定。
