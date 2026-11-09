# OSC v2 数值参考及来源归档

来源：唯一技术聊天01a1902f-8a44-7f03-855b-115e272388c4；[正式有限分析](https://github.com/bjstevenyang/ai-circuit-tutor/pull/8#issuecomment-6729882880)和[完整可复现附录](https://github.com/bjstevenyang/ai-circuit-tutor/pull/8#issuecomment-6729881016)，输入head `a4c23bc4365f23922cfe5006bc1876a929e04608`，无业务/需求提交。以下原文归档；分析时“建议/待修改”是当时状态，当前选定参数/版本/计数以CIRCUIT_MODEL、SYSTEM_DESIGN、PRD、TEST_PLAN及CR-NUMERICS为准。分析作者不是最终独立审查者。14次BE-LTE和2次BDF2实际有限结果可作参考，不是应用/Chromium/M1性能/教学实测。原10/5pF失败和早期1nF/0.5nF探索仍保留于NUMERICS-IMPACT历史记录，不充当v2基准。

---

## PR #8 只读有限数值影响报告：ANALYSIS_COMPLETE

**结论：2 nF / 1 nF 候选在本轮限定离线算例中可行，建议据此收敛新规格；当前 Draft 仍需修改，不能当最终 PASS 或直接合并。** 没有更改业务代码、需求作者分支、生产 LTE 或步长下限，也没有新增依赖。参与候选分析的本执行者不充当最终独立审查人。

### 1. 固定输入、范围与实际基线

- 输入完整 head：`a4c23bc4365f23922cfe5006bc1876a929e04608`；报告前核对 PR 最新 head 相同。
- 派发键：`bjstevenyang/ai-circuit-tutor|8|numeric-impact|a4c23bc4365f23922cfe5006bc1876a929e04608|analysis-1`。
- 远端 master／原需求实际合并基线：`4a3340cc0263985c6d5b5bf810b794bcdb5c0454`。功能主线仍为已合并阶段2，实际实现提交 `40dd29ed6eafae43afc7d84bc02d3188daee1b22`。PR #7 配置切片另已提交 `ec9006c671866139b345a0b557e2560278cbe9f1`，Verify #62 成功，但未合并、未实现完整振荡功能。
- 读取 AGENTS、AUTOMATED_HANDOFF、CR-NUMERICS／影响稿，以及原已合并 PRD、电路模型、系统设计、测试计划和参考脚本。人类已批准自激教学方向与本轮自动流程；无需再批准相同方向。候选具体参数必须形成新的完整可审查版本。
- 本轮有界执行 **14 次四节点 BE-LTE 积分＋2 次独立五变量 BDF2 参考**。没有扫描更多候选或重复原失败／长期浏览器测试。全部脚本及命令另附可复现评论，不依赖本机临时路径作为唯一证据。

### 2. 候选、方程与独立性

只将每只 BJT 的虚拟 Cbe/Cbc 从 10/5 pF 改为 **2/1 nF**；其余 IS=1e-14 A、VT=0.02585 V、BF_N=100、BF_P=50、BR=1、外部 C=100 nF、R1=120 kΩ、R3=47 Ω、speaker=8 Ω、R2=10 Ω 和单次100 μs上电不变。它是新的虚拟动态模型，不能称等效优化或真实3904/3906参数拟合。

保持七节点：9V VP→47Ω→P；NPN(E=GND,B=A,C=B)；PNP(E=P,B=B,C=D)；R1(P,A)；外部C(A,D)；speaker(D,S)；R2(S,GND)。离线代数消去 S 后 `S=10D/18`、`Vspeaker=8D/18`、`Ispeaker=D/18`；总负载26Ω变体相应改为18/26、8/26、1/26，未遗漏R2。内部结C构成正定四节点电容矩阵，有限光滑域内初值问题局部唯一，不靠GMIN或伪泄漏。

- 四节点脚本：独立编写的 EM／解析 Jacobian／主元消元／阻尼 Newton；BE整步与两半步比较全部节点及电容端压，采用冻结默认／严格容差、10ps下限、80次Newton上限。接受两半步，并逐半步检查模型域、有限状态、电荷和导数。计数按一次LTE批准推进，符合原定义。
- 五变量参考：采用原归档 `f637706e…` 的另一份独立方程／Jacobian／MNA求解器，变量含代数负载电流；本次固定新结C，使用变步BDF2与步长收敛，**没有LTE**。统计后处理有意共用四节点脚本的 `measure`，不声称第三个独立实现或独立统计算法。
- 参考运行中的末尾约0.185ps小步是15ms窗口浮点对齐尾数，零拒绝；不是生产BE的退步，也不是10ps生产下限通过证据。下限可达证据来自完整40ms BE-LTE。

### 3. 40 ms 默认／严格参考与全窗检查

| 档位 | 接受／拒绝 | 最小推进步 | D=1V前15ms上穿 | 四周期均值 | 5–40ms通用分类 |
| --- | ---: | ---: | ---: | ---: | --- |
| 默认 | 168360 / 331 | 29.436655 ps | 5 | 3.466372709 ms | periodic，288.485999 Hz |
| 严格 | 330783 / 206 | 20.519923 ps | 5 | 3.466289582 ms | periodic，288.492920 Hz |

两档均到达40ms，已接受尝试的Newton最大迭代3（拒绝试探不据此声称3次），接受半步KCL残差＜1e-10 A。默认前五次上穿(s)：`0.0007540235162826591, 0.00422039616115163, 0.007686768905334063, 0.011153141624683982, 0.014619514351039718`；严格为 `0.0007540907140908448, 0.004220380337084373, 0.007686669938816744, 0.011152959507249188, 0.014619249040676135`。

全部14次BE-LTE运行中，接受态归一化BE范围约[-2.222173,0.803289]V、BC约[-10.589197,0.784954]V；全部EM传导端流绝对值最大0.174343A＜0.25A。电荷、状态、位移电流有限，最大绝对电荷7.963e-7C；最小推进步20.215387ps，最大接受343091／拒绝659。冷初态另为全零。**传导域与含结电容位移电流的总端口电流应分开记录，不能误用250mA检查总电流或宣称真实安全。**

### 4. 建议的新独立参考值及收敛

建议以独立BDF2 `hmax=0.03125μs` 的15ms结果作新参考中心值，再用默认／严格BE-LTE交叉校验。该参考480001步、零拒绝、KCL≤1nA；较粗0.0625μs参考240000步、零拒绝。

五次D=1V上穿(s)：

```text
0.0007541498020748211
0.004220366770616388
0.007686583925987580
0.011152801241322686
0.014619018687528108
```

前后四周期均值 **3.466217221363 ms**（288.498942Hz）；用于相位归一化的最后完整周期为[0.011152801241322686,0.014619018687528108]s，其长度3.466217446205ms。

| 末周期相位 | P/V | A/V | B/V | D/V |
| --- | ---: | ---: | ---: | ---: |
| 0.01 | 1.362087699 | 0.770330496 | 0.565630859 | 1.334503247 |
| 0.10 | 2.407465040 | 0.715828111 | 1.624062933 | 2.331650478 |
| 0.20 | 8.991157900 | -1.518808405 | 8.395987084 | 0.003357025 |
| 0.40 | 8.996119348 | -0.945393882 | 8.574209247 | 0.001457185 |
| 0.60 | 8.996336874 | -0.401933458 | 8.710241629 | 0.001375463 |
| 0.80 | 8.996537072 | 0.111831160 | 8.838764516 | 0.001300291 |
| 0.90 | 8.996632772 | 0.358086596 | 8.900271757 | 0.001264171 |
| 0.99 | 8.995832187 | 0.569706077 | 8.572145166 | 0.000897620 |

同一末完整周期：D均值 **0.379789505321V**、D交流RMS **0.821642813123V**；speaker交流RMS **0.365174583610V / 0.045646822951A**；源平均电流 **0.026083652922A**；全15ms源峰流 **0.174423106943A**。

默认BE-LTE相对上述参考：四周期均值差0.004486%，八相位四节点最大差0.368462mV，D交流RMS差0.009853%，平均源流差0.042021%。严格档相应为0.002088%、0.193374mV、0.004118%、0.022273%。BDF2减半hmax前后周期差0.002204%，最大相位差0.581983mV。现有有限观察量容差足够，不必为本轮放宽。BDF2的15ms统计只有三个5ms后上穿，不能套40ms通用检测称失败或提前播放。

原始BJT尖峰最大传导端流在两BDF2网格约0.200252/0.203285A，虽均在域内，但未证明尖峰全波形收敛；不得把这些值当精确器件峰流验收。验收限定的源峰流、周期、相位、RMS已交叉核对。

### 5. 五个单变量与精确负例

五变体均使用同一候选、默认BE-LTE完整40ms，并按真实接受步进行5–40ms检测；均为periodic、全窗域内和有限。

| 单项改动 | 独立计数窗 | D=1V上穿数 | 新周期均值/ms | 40ms接受／拒绝 |
| --- | ---: | ---: | ---: | ---: |
| C=47nF | 15ms | 10 | 1.614128583 | 177775 / 659 |
| C=220nF | 25ms | 4 | 7.627159631 | 163861 / 155 |
| R1=100kΩ | 15ms | 5 | 3.026331160 | 169537 / 368 |
| R1=240kΩ | 30ms | 5 | 6.210732274 | 164866 / 195 |
| R2=18Ω，总26Ω | 15ms | 4 | 4.542393184 | 166176 / 320 |

额外仅复核两个C边界的严格档40ms：47nF周期1.614032895ms、343091/425、min21.329481ps；220nF周期7.627086287ms、324975/99、min20.215387ps。220nF在通用窗内恰有5次上穿，可满足末4完整周期，最后一次约39.83939ms。R1两个变体和负载变体的严格档未执行，不冒称全部双档。

| 精确操作，其他同参考 | 本次默认40ms实际结果 | 教学／声音结论 |
| --- | --- | --- |
| 删除外部C，保留内部结C | 15ms仅1次D=1V上穿；末D=2.082358577V；settled-DC；160054/14 | 不连续发声，但不是没有电流 |
| 内部测试两BF均100 | 15ms仅1次上穿；末D=2.426166878V；settled-DC；160493/16 | 无稳定连续音；不新增UI增益参数 |
| 删除R1，不留伪电阻 | 无1V上穿；末D≈2.354084μV；window-no-period；160042/7 | 末5ms B范围约3.468mV、最大电容导数0.742325V/s，**不能标DC或绝对零信号** |
| 删除speaker，不留8Ω负载 | 末D=8.666383103V；settled-DC；160337/12；剩余R2使S=0 | 无speaker端口读数／连续音，不能当存在的0V扬声器 |
| 导线旁路speaker，保留10Ω | speaker电压/RMS精确0；其他D节点仍振荡约2.124ms；173808/384 | “speaker被旁路”，不能说整个网络静止；按端口window-no-period，无声音 |

解析核对：VP–GND理想短接应预检失败；P–GND保留47Ω时源流有限9/47≈0.191489A，其余冷零态是可行解；speaker端点反转仅反转端压符号，RMS／频率不变。这些是解析依据，未额外执行数值用例。错管型／交换BCE、任意混接和12节点实际编译器未在本只读试验实现或验证。

### 6. 需作者收敛的规格与接口事项（按严重度）

1. **P1：模型／参考必须同步后才可合并。** 建议新ID `oscillator-em-v2`，明确2/1nF是固定虚拟结C。同步 CR-NUMERICS、CR-OSCILLATOR、PRD、CIRCUIT_MODEL、SYSTEM_DESIGN、TEST_PLAN、决定和独立参考附录。新head必须重新独立审查。原v1的3.444414ms、相位／RMS及五变体期望不能继续使用；尤其总负载26Ω变化超过原1%容差。
2. **P1：旧profile恢复语义须明确。** 建议仍用schema v5区分profile：已知 `oscillator-em-v1` 仅恢复配置、显示旧模型说明并阻止运行，由用户显式选择v2后再算；保留全部值／ID／接线，一个可撤销编辑，停止旧会话，不缩放电容或静默当v2。v1–v4旧schema仍补legacy；未知model/schema继续保护原文本、不覆盖。v1范围47–220nF仍可恢复，不退成100μF。需将选定方案写入验收，而非只留讨论。
3. **P2：通用阈值与有界统计实现路径须写清。** 5–40ms全窗极值在末尾才确定；不能用4096显示点还原细脉冲／频率。建议两遍确定性重算：第一遍取极值，第二遍按接受步流式计算穿越与周期统计；或明确另一种等价有界算法。所有遍数共享总计数／墙钟／取消预算。脚本离线保存全轨迹仅为审计，**不是生产内存方案**。
4. **P2：预算“数学可达”与实测分开。** 两遍最严已跑输入为2×343091=686182次接受，保守拒绝上界2×659=1318，仍低于1m/10k。每个整步／半步单独检查80次Newton。原12节点计数必须在电阻化简前执行；MAX12可将R1分8×15k加7个节点，线性重建Xi=P+i(A−P)/8；OVER13再分一段为2×7.5k，必须预检拒绝。离线四节点消去不替代该产品测试。Worker/sessionId/documentRevision/generation/modelProfileId接口保持；扩展profile联合与旧版本失败状态，不新增服务。

### 7. 验收映射与边界

| 验收 | 本轮证据 | 尚需实现／验收 |
| --- | --- | --- |
| OSC-01 | 不改安装／引脚教学方向；PR7配置另已验证 | 完整七节点搭建与新流程Chromium |
| OSC-02 | 候选40ms两档、逐接受态模型域、LTE及步数 | 正式v2规格、通用图编译／Worker／失败和取消 |
| OSC-03 | 新五次上穿、四周期、八相位、RMS／源流，独立BDF2收敛；五变体／两C边界 | 产品求解器对照新参考及全部门槛 |
| OSC-04 | 端口频率／AC RMS数学输入及旁路／反向依据 | AudioContext许可、映射、停止、后台与设备试听 |
| OSC-05 | 五个精确负例、DC／无周期差异及对象证据 | 三级提示／修复流程和错误管脚边界 |
| OSC-06 | v2与v1恢复建议、数学预算／12节点代数构造 | 实际保存保护／undo、MAX12/OVER13、交互／性能／内存与旧回归 |

原5s硬墙钟、P95≤2s、停止≤100ms、交互≤200ms、≤10MB以及旧EX2门槛建议保持；**没有性能通过证据**。Python离线参考墙钟不是浏览器优化实现、指定M1/8GB的性能证明，也不能据此修改性能要求。未执行本轮应用/Vitest/Chromium性能、硬件、后台、读屏、200%缩放、试听或师生试用；本报告不是全OSC交付。

本次只读分析没有仓库提交，输出head为“无新提交”；PR7配置head不得冒充PR8输出。建议作者用上述有限结果更新完整规格，再由未参与候选／文档撰写的审查者对新完整head复核并核对CI，满足既有授权门槛后合并需求；随后将实际新master完整SHA通知原PR7继续实现。现在不另开实现PR、不暗改生产模型、不再扩大离线实验。


完整脚本、来源SHA256与16个实际命令：[可复现附录](https://github.com/bjstevenyang/ai-circuit-tutor/pull/8#issuecomment-6729881016)。

报告来源：技术thread `01a1902f-8a44-7f03-855b-115e272388c4`，本次派发的只读分析；`status=ANALYSIS_COMPLETE`，不是最终独立PASS。`outputHead=无新提交`。

---

## PR #8 有限分析：可复现脚本附录（不是批准规格／生产实现）

固定输入 `a4c23bc4365f23922cfe5006bc1876a929e04608`。下列三个完整文件仅用Python标准库，保存到同一scratch目录 `/tmp/ai-circuit-numerics-analysis`。创建目录后按文件名保存代码；程序仅写该目录的JSON／二进制离线轨迹，不写仓库或读取学生作品。全轨迹存储用于离线审计，不是生产内存实现。

四节点方程独立于原五变量参考；BDF2适配器与四节点脚本共享统计后处理，不声称独立统计器。五变量源码是已合并的[原参考附录](https://github.com/bjstevenyang/ai-circuit-tutor/blob/4a3340cc0263985c6d5b5bf810b794bcdb5c0454/docs/changes/CR-OSCILLATOR-IMPACT.md#12-可复现独立参考附录离线数学不是应用实现)中逐字提取的Python段；本附录完整保留，以免依赖临时文件。适配器将CP设2e-9（Cbc=CP/2），BF_P仍50，其余方程不变。运行输出的 `reference_period_s` 是末完整周期；报告表中的周期均值由该窗口第一／末上穿之差除以间隔数计算，不混用。

本次实际执行的16个命令如下，串行列出仅为复现清晰；无需为后续报告重复跑已完成研究。

```sh
mkdir -p /tmp/ai-circuit-numerics-analysis
python3 /tmp/ai-circuit-numerics-analysis/probe.py ref default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py ref strict 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py c47 default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py c220 default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py r100 default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py r240 default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py load26 default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py no_c default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py beta100 default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py no_bias default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py no_speaker default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py bypass_speaker default 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py c47 strict 0.04
python3 /tmp/ai-circuit-numerics-analysis/probe.py c220 strict 0.04
python3 /tmp/ai-circuit-numerics-analysis/archived_bdf.py 6.25e-8 0.015
python3 /tmp/ai-circuit-numerics-analysis/archived_bdf.py 3.125e-8 0.015
```

### `probe.py`

SHA-256：`6a41266482cef3b0da4d7f2bfdbb609f074ba4b17cee95767985f219741c8cd1`（包含末尾换行）。

```python
"""PR8 read-only mathematical probe; NOT a production model or approved specification.

Four-node implementation derived from the root's independently written em_probe.py,
not from the archived five-variable reference. Only stdlib; fixed 2nF/1nF candidate.
Writes scratch evidence only. The wall limit is an offline guard, NOT a browser result.
"""
import math, json, time, sys, bisect
from array import array
from pathlib import Path

OUT = Path('/tmp/ai-circuit-numerics-analysis')
CASES = {
    'ref': {}, 'c47': {'external_c':47e-9}, 'c220':{'external_c':220e-9},
    'r100':{'bias_r':100000.}, 'r240':{'bias_r':240000.}, 'load26':{'load_r':26.},
    'no_c':{'external_c':0.}, 'beta100':{'beta_p':100.},
    'no_bias':{'bias_r':None}, 'no_speaker':{'load_r':None,'speaker':'absent'},
    'bypass_speaker':{'load_r':10.,'speaker':'bypassed'},
}
def solve(matrix,rhs):
    n=len(rhs);a=[matrix[i][:]+[rhs[i]] for i in range(n)]
    for k in range(n):
        p=max(range(k,n),key=lambda i:abs(a[i][k]));a[k],a[p]=a[p],a[k]
        if abs(a[k][k])<1e-20:raise ArithmeticError('singular')
        d=a[k][k]
        for j in range(k,n+1):a[k][j]/=d
        for i in range(k+1,n):
            f=a[i][k]
            for j in range(k,n+1):a[i][j]-=f*a[k][j]
    x=[0.]*n
    for i in range(n-1,-1,-1):x[i]=a[i][n]-sum(a[i][j]*x[j] for j in range(i+1,n))
    return x

def run(case='ref',strict=False,stop=.04):
    cfg=dict(external_c=100e-9,bias_r=120000.,load_r=18.,beta_p=50.,speaker='present')
    cfg.update(CASES[case]);n=4;g=[[0.]*n for _ in range(n)];c=[[0.]*n for _ in range(n)]
    def stamp(m,a,b,value):
        if a>=0:m[a][a]+=value
        if b>=0:m[b][b]+=value
        if a>=0 and b>=0:m[a][b]-=value;m[b][a]-=value
    stamp(g,0,-1,1/47)
    if cfg['bias_r'] is not None:stamp(g,0,1,1/cfg['bias_r'])
    if cfg['load_r'] is not None:stamp(g,3,-1,1/cfg['load_r'])
    caps=[(1,-1,2e-9),(1,2,1e-9),(2,0,2e-9),(2,3,1e-9)]
    if cfg['external_c']:caps.append((1,3,cfg['external_c']))
    for a,b,cap in caps:stamp(c,a,b,cap)
    trans=[(-1,1,2,1,100.),(0,2,3,-1,cfg['beta_p'])]
    vt=.02585;isat=1e-14
    def currents(v):
        values=[]
        for e,b,col,sign,beta in trans:
            be=sign*(v[b]-(v[e] if e>=0 else 0));bc=sign*(v[b]-v[col])
            f=isat*math.expm1(be/vt);r=isat*math.expm1(bc/vt)
            ib=sign*(f/beta+r);ic=sign*(f-2*r)
            values.append((be,bc,ib,ic,-ib-ic))
        return values
    def evaluate(v,previous,h,t,jac=True):
        source=9*min(1,t/1e-4)
        f=[sum(g[i][j]*v[j]+c[i][j]*(v[j]-previous[j])/h for j in range(n)) for i in range(n)]
        f[0]-=source/47
        mat=[[g[i][j]+c[i][j]/h for j in range(n)] for i in range(n)] if jac else None
        for e,b,col,sign,beta in trans:
            be=sign*(v[b]-(v[e] if e>=0 else 0));bc=sign*(v[b]-v[col])
            # Trial-only overflow protection; accepted biases are checked below 0.9V.
            def exponential(z):
                if z>40:
                    y=math.exp(40);return isat*(y*(1+z-40)-1),isat*y/vt
                return isat*math.expm1(z),isat*math.exp(z)/vt
            ef,df=exponential(be/vt);er,dr=exponential(bc/vt)
            ib=sign*(ef/beta+er);ic=sign*(ef-2*er);ie=-ib-ic
            f[b]+=ib;f[col]+=ic
            if e>=0:f[e]+=ie
            if jac:
                for k,dc,db in [(b,df-2*dr,df/beta+dr),(col,2*dr,-dr),(e,-df,-df/beta)]:
                    if k<0:continue
                    mat[col][k]+=dc;mat[b][k]+=db
                    if e>=0:mat[e][k]-=dc+db
        return f,mat
    def implicit(previous,h,t):
        v=previous[:]
        for iteration in range(80):
            f,j=evaluate(v,previous,h,t);norm=max(map(abs,f))
            if norm<=1e-10:return v,norm,iteration
            dx=solve(j,[-x for x in f]);scale=min(1,.2/max(1e-30,max(map(abs,dx))))
            for _ in range(30):
                q=[x+scale*y for x,y in zip(v,dx)]
                nf,_=evaluate(q,previous,h,t,False)
                if max(map(abs,nf))<norm:v=q;break
                scale*=.5
            else:raise ArithmeticError('line-search')
        raise ArithmeticError('Newton-80')
    rtol=5e-5 if strict else 1e-4;atol=5e-6 if strict else 1e-5
    hmax=.125e-6 if strict else .25e-6;hmin=1e-11
    def error(full,half):
        values=list(zip(full,half))
        values += [(full[a]-(full[b] if b>=0 else 0),half[a]-(half[b] if b>=0 else 0)) for a,b,_ in caps]
        return max(abs(x-y)/(atol+rtol*max(abs(x),abs(y))) for x,y in values)
    t=0.;v=[0.]*n;h=hmax;accepted=rejected=0;low=hmax;maxres=maxit=0
    bias_min=[math.inf]*4;bias_max=[-math.inf]*4;peaks=[0.]*6;peak_source=0.
    max_charge=0.;status='complete';why='';started=time.perf_counter()
    # Eight doubles per accepted half-step: t,P,A,B,D,source current,max dVc/dt,KCL.
    rows=array('d',[0.,0.,0.,0.,0.,0.,0.,0.])
    while t<stop:
        boundary=min(stop,1e-4) if t<1e-4 else stop
        if boundary-t<1e-16:t=boundary;continue
        h=min(h,hmax,boundary-t)
        try:
            full,rf,itf=implicit(v,h,t+h);a,ra,ita=implicit(v,h/2,t+h/2);b,rb,itb=implicit(a,h/2,t+h)
            err=error(full,b)
        except ArithmeticError as exc:err=math.inf;why=str(exc)
        if err>1 or not math.isfinite(err):
            rejected+=1
            if h<=hmin*(1+1e-10):status='hmin-failure';break
            h=max(hmin,h*(max(.2,min(.8,.9/math.sqrt(err))) if math.isfinite(err) else .5))
            if rejected>=10000:status='rejected-budget';break
            continue
        low=min(low,h);maxres=max(maxres,ra,rb);maxit=max(maxit,itf,ita,itb)
        previous=v
        for at,x,residual in [(t+h/2,a,ra),(t+h,b,rb)]:
            domain=currents(x);biases=[domain[0][0],domain[0][1],domain[1][0],domain[1][1]]
            for i,z in enumerate(biases):bias_min[i]=min(bias_min[i],z);bias_max[i]=max(bias_max[i],z)
            for i,q in enumerate(domain):
                for j,z in enumerate(q[2:]):peaks[3*i+j]=max(peaks[3*i+j],abs(z))
                if not(-3<=q[0]<=.9 and -15<=q[1]<=.9 and max(map(abs,q[2:]))<=.25):status='model-domain';why=str((i,q))
            charges=[cap*(x[i]-(x[j] if j>=0 else 0)) for i,j,cap in caps]
            deriv=max(abs(((x[i]-(x[j] if j>=0 else 0))-(previous[i]-(previous[j] if j>=0 else 0)))/(h/2)) for i,j,_ in caps)
            if not all(math.isfinite(z) for z in x+charges+[deriv]):status='nonfinite';why='state/charge/derivative'
            max_charge=max(max_charge,*map(abs,charges));source=(9*min(1,at/1e-4)-x[0])/47;peak_source=max(peak_source,source)
            rows.extend([at,*x,source,deriv,residual]);previous=x
        t+=h;v=b;accepted+=1
        if status!='complete':break
        if accepted>=1000000:status='accepted-budget';break
        if time.perf_counter()-started>120:status='offline-120s-bound';break
        h=max(hmin,min(hmax,h*max(.5,min(2,.9/math.sqrt(max(err,1e-16))))))
    wall=time.perf_counter()-started
    result=dict(case=case,strict=strict,candidate_cbe_F=2e-9,cbc_F=1e-9,config=cfg,target_s=stop,time_s=t,status=status,why=why,
        accepted=accepted,rejected=rejected,min_step_s=low,max_newton=maxit,max_KCL_A=maxres,
        normalized_bias_min=bias_min,normalized_bias_max=bias_max,EM_peak_NbNcNe_PbPcPe_A=peaks,
        source_peak_A=peak_source,max_charge_C=max_charge,rows=len(rows)//8,wall_s=wall)
    result.update(measure(rows,stop,cfg))
    name=f'{case}-'+('strict' if strict else 'default')+f'-{stop:g}'
    (OUT/(name+'.json')).write_text(json.dumps(result,indent=2))
    with (OUT/(name+'.bin')).open('wb') as f:rows.tofile(f)
    print(json.dumps(result),flush=True)
    return result

def measure(rows,stop,cfg):
    count=len(rows)//8;times=array('d',(rows[8*i] for i in range(count)))
    def vector(i):return list(rows[8*i+1:8*i+6])
    def interpolate(at):
        k=bisect.bisect_left(times,at)
        if k==0:return vector(0)
        if k>=count:return vector(count-1)
        w=(at-times[k-1])/(times[k]-times[k-1]);a=vector(k-1);b=vector(k)
        return [x+w*(y-x) for x,y in zip(a,b)]
    def integrate(begin,end,field):
        first=bisect.bisect_right(times,begin);last=bisect.bisect_left(times,end)
        total=square=0.;pt=begin;pv=interpolate(begin)[field]
        for i in range(first,last+1):
            nt=times[i] if i<last else end;nv=rows[8*i+1+field] if i<last else interpolate(end)[field]
            dt=nt-pt;total+=dt*(pv+nv)/2;square+=dt*(pv*pv+nv*nv)/2;pt,pv=nt,nv
        mean=total/(end-begin);return mean,math.sqrt(max(0,square/(end-begin)-mean*mean))
    def crossings(begin,end,threshold,factor=1.,hysteresis=0.):
        found=[];armed=False;start=bisect.bisect_left(times,begin);previous_t=begin;previous_v=interpolate(begin)[3]*factor
        if previous_v<=threshold-hysteresis:armed=True
        for i in range(start,bisect.bisect_right(times,end)):
            t=times[i];value=rows[8*i+4]*factor
            if value<=threshold-hysteresis:armed=True
            if armed and previous_v<threshold<=value:
                found.append(previous_t+(t-previous_t)*(threshold-previous_v)/(value-previous_v));armed=False
            previous_t,previous_v=t,value
        return found
    ref_end=min(.015,stop);rises=crossings(0,ref_end,1.);out={'D_1V_upcrossings_15ms':rises}
    if len(rises)>=2:
        a,b=rises[-2:];period=b-a;dm,drms=integrate(a,b,3);sm,_=integrate(a,b,4)
        out.update(reference_period_s=period,D_mean_V=dm,D_AC_RMS_V=drms,source_mean_A=sm,
            reference_phase_PABD=[{'phase':phase,'PABD':interpolate(a+phase*period)[:4]} for phase in [.01,.10,.20,.40,.60,.80,.90,.99]])
        if cfg['load_r'] and cfg['speaker']=='present':out.update(speaker_AC_RMS_V=drms*8/cfg['load_r'],speaker_AC_RMS_A=drms/cfg['load_r'])
    window_start=.005;first=bisect.bisect_left(times,window_start)
    factor=8/cfg['load_r'] if cfg['load_r'] and cfg['speaker']=='present' else 0.
    values=[rows[8*i+4]*factor for i in range(first,count)]
    if not values:return out|{'classification':'incomplete-window'}
    lo,hi=min(values),max(values);periodic=False;periods=[];rms_values=[];up=[]
    if hi-lo>=.002:
        up=crossings(window_start,stop,(lo+hi)/2,factor,.1*(hi-lo))
        if len(up)>=5:
            tail=up[-5:];periods=[b-a for a,b in zip(tail,tail[1:])]
            rms_values=[integrate(a,b,3)[1]*abs(factor) for a,b in zip(tail,tail[1:])]
            pm=sum(periods)/4;rm=sum(rms_values)/4
            periodic=max(abs(p-pm)/pm for p in periods)<=.01 and rm>=.001 and max(abs(r-rm)/rm for r in rms_values)<=.01
    tail_start=max(0,stop-.005);tail=range(bisect.bisect_left(times,tail_start),count)
    ranges=[max(rows[8*i+1+k] for i in tail)-min(rows[8*i+1+k] for i in tail) for k in range(4)]
    derivative=max(rows[8*i+6] for i in tail);residual=max(rows[8*i+7] for i in tail)
    dc=max(ranges)<=.001 and derivative<=.01 and residual<=1e-9
    out.update(classification='periodic' if periodic else 'settled-DC' if dc else 'window-no-period',
        generic_threshold_V=(lo+hi)/2,generic_Vpp_V=hi-lo,generic_upcrossings=up,
        last4_periods_s=periods,last4_speaker_AC_RMS_V=rms_values,tail_node_ranges_V=ranges,tail_max_dVc_dt_Vs=derivative,
        final_PABD=vector(count-1)[:4])
    if periodic:out['generic_frequency_Hz']=4/sum(periods)
    if stop>=.025:
        for target in [.015,.025,.030]:
            if target<=stop:
                xs=crossings(0,target,1.);out[f'D_1V_upcrossings_{target:g}s']=xs
    return out

if __name__=='__main__':
    run(sys.argv[1] if len(sys.argv)>1 else 'ref',len(sys.argv)>2 and sys.argv[2]=='strict',float(sys.argv[3]) if len(sys.argv)>3 else .04)
```

### `archived_reference.py`

SHA-256：`f637706ebeb5ee2f20d6141a612422be1a9d529f1749db620c1d09bafbffa191`（包含末尾换行）。

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

### `archived_bdf.py`

SHA-256：`bb507630d1e0b3d8f04546c83bf6a061771a72a9db1ac0f9e3a2243fe7a3043c`（包含末尾换行）。

```python
"""Independent five-variable archived solver, fixed PR8 candidate; offline only.
Solver source SHA f637706e..., written independently of the root four-node probe.
Statistics are intentionally shared with probe.measure; not claimed independently authored.
"""
from pathlib import Path
from array import array
import sys,math,json,time
from probe import measure,OUT

def run(hmax=6.25e-8,stop=.015):
    source=(OUT/'archived_reference.py').read_text().replace("if __name__=='__main__':run()",'')
    saved=sys.argv;sys.argv=['reference',str(hmax),str(stop),'BDF2'];ns={}
    exec(compile(source,'archived-f637706e','exec'),ns);sys.argv=saved
    ns['CP']=2e-9
    v=[0.]*5;older=None;oldh=hmax;h=hmax;t=0.;accepted=rejected=0;low=hmax;maxres=maxit=0
    rows=array('d',[0.]*8);status='complete';why='';peak_source=0.;em_peak=0.;started=time.perf_counter()
    bias_min=[math.inf]*4;bias_max=[-math.inf]*4
    while t<stop:
        boundary=min(stop,1e-4) if t<1e-4 else stop
        if boundary-t<1e-16:t=boundary;continue
        hn=min(h,boundary-t);effective=v;heff=hn
        if older is not None:
            ratio=hn/oldh;a=(1+2*ratio)/(1+ratio)
            effective=[((1+ratio)*x-ratio*ratio/(1+ratio)*y)/a for x,y in zip(v,older)]
            heff=hn/a
        try:q,it,res=ns['step'](effective,heff,t+hn)
        except ArithmeticError as error:
            h=hn/2;rejected+=1;why=str(error)
            if h<1e-13:status='reference-Newton-floor';break
            if rejected>=10000:status='rejected-budget';break
            continue
        derivative=max(abs(((q[a]-(q[b] if b is not None else 0))-(v[a]-(v[b] if b is not None else 0)))/hn) for a,b in [(1,None),(1,2),(2,0),(2,3),(1,3)])
        t+=hn;oldh=hn;older=v;v=q;accepted+=1;low=min(low,hn);maxres=max(maxres,res);maxit=max(maxit,it)
        biases=[v[1],v[1]-v[2],v[0]-v[2],v[3]-v[2]]
        for i,z in enumerate(biases):bias_min[i]=min(bias_min[i],z);bias_max[i]=max(bias_max[i],z)
        for be,bc,beta in [(biases[0],biases[1],100),(biases[2],biases[3],50)]:
            f=1e-14*math.expm1(be/.02585);r=1e-14*math.expm1(bc/.02585)
            ib=f/beta+r;ic=f-2*r;ie=-ib-ic;em_peak=max(em_peak,abs(ib),abs(ic),abs(ie))
            if not(-3<=be<=.9 and -15<=bc<=.9 and max(abs(ib),abs(ic),abs(ie))<=.25):status='reference-model-domain'
        charges=[2e-9*biases[0],1e-9*biases[1],2e-9*biases[2],1e-9*biases[3],1e-7*(v[1]-v[3])]
        if not all(math.isfinite(x) for x in v+charges+[derivative]):status='nonfinite'
        current=(9*min(1,t/1e-4)-v[0])/47;peak_source=max(peak_source,current)
        rows.extend([t,*v[:4],current,derivative,res])
        if status!='complete':break
        if accepted>=2000000:status='reference-step-bound';break
        if time.perf_counter()-started>120:status='offline-120s-bound';break
        if it<7:h=min(hmax,hn*1.5)
    result=dict(method='archived-variable-BDF2-no-LTE',hmax_s=hmax,target_s=stop,time_s=t,status=status,why=why,
        accepted=accepted,rejected=rejected,min_step_s=low,max_newton=maxit,max_KCL_A=maxres,
        source_peak_A=peak_source,max_EM_terminal_A=em_peak,normalized_bias_min=bias_min,normalized_bias_max=bias_max,
        wall_s=time.perf_counter()-started)
    result.update(measure(rows,t,dict(load_r=18.,speaker='present')))
    name=f'bdf2-{hmax:g}-{stop:g}'
    (OUT/(name+'.json')).write_text(json.dumps(result,indent=2))
    with (OUT/(name+'.bin')).open('wb') as f:rows.tofile(f)
    print(json.dumps(result),flush=True)
    return result
if __name__=='__main__':run(float(sys.argv[1]) if len(sys.argv)>1 else 6.25e-8,float(sys.argv[2]) if len(sys.argv)>2 else .015)
```
