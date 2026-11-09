# OSC数值切片：冻结最小步长/LTE失败证据

输入需求基线：`4a3340cc0263985c6d5b5bf810b794bcdb5c0454`；需求PR #5，实现PR #7。本文记录实际失败，不修改需求参数、容差或验收。尚无实现完成/PASS结论。

## 实际失败与影响

生产数值切片按冻结EM、10/5pF、零态/100μs上电、BE整步与两半步、rtol=1e-4、atol=10μV、hmax=.25μs、hmin=10ps实现。最小反馈环测试命令：

`npm test -- src/circuit/oscillator/numeric.test.ts`

实际失败：0.0007880928145152545s，尚无D=1V上穿，不能达到15ms/5次的OSC-03。3381次接受推进、25次拒绝，已接受最小步10ps，下一次10ps的LTE>1，需要8ps；按冻结规则返回numerical-failure。节点P/A/B/D为[4.992342113246835,0.7650549398691209,4.223335486662086,0.22859310019577728]V。没有将失败当成起振、生成声音或继续放宽精度。

已修正本地控制器“成功后建议步可能低于hmin”的实现问题，再次复现上述10ps失败；不是靠先前错误控制器违规接受的亚皮秒步证明。报告此失败时业务改动仍未提交，分支仅有实施确认/本失败文档；后续独立配置切片及其实际证据见[实施记录](OSCILLATOR-IMPLEMENTATION.md)，失败数值尝试仍未纳入配置交付。原stage2工作区不动。

## 独立交叉检查

直接提取已合并影响报告第12节的独立Python参考（SHA-256 f637706ebeb5ee2f20d6141a612422be1a9d529f1749db620c1d09bafbffa191），不调用新TS实现；为其加上同一LTE控制/10ps下限，Newton残差从1nA收紧到10pA（仍在冻结≤1nA内）。从零态独立推进得到：

```text
time_s = 0.0007880928149619716
P/A/B/D = [4.992409549766289, .7650544353990225, 4.223403360386273, .2285925918777799]
accepted = 3381; rejected = 25; min accepted = 1e-11 s
next step = 8e-12 s; crossings = []
stop = LTE/Newton required a step below frozen minimum
```

与TS失败时间相差约0.447ps，推进/拒绝数相同。再从TS失败前状态独立求一整步/两半步，对归一化最大误差作对照：

| 诊断步长 | Newton残差1nA下LTE | 收紧至10pA下LTE |
| --- | --- | --- |
| 10ps（冻结下限） | 1.020690835 | 1.020691740 |
| 5ps（仅离线诊断） | .248097497 | .248097526 |
| 1ps（仅离线诊断） | .009771841 | .009771841 |

10ps完整步的P/A/B/D=[4.9226657359,.7655704388,4.1532117251,.2291122519]V，两半步为[4.9230179954,.7655684896,4.1535657926,.2291102844]V。收紧Newton不能消除LTE拒绝，独立方程重现该结果，不是仅TS矩阵/导数结论。

较小hmin的离线试探还在更快跳变处遇到收敛/数值精度限制，**不能据此直接建议把生产下限改5ps/1ps便宣称解决**。需要结合数值状态表示、隐式求解的数值稳定性、模型域、两档/参考观察量和步数/性能再给经过验证的修订。尚未证明所有可能实现都不可能；已证明当前实现及独立复现都无法满足冻结组合，不能跳过拒步或放宽期望继续。

## 可复现独立失败（标准库，无安装）

在包含已合并需求的仓库根目录执行以下命令。只读取已归档方程/脚本，打印失败，不修改仓库；电压和所有电容端压都按冻结误差检查，代数负载电流不冒当电压。

```sh
python3 - <<'PY'
from pathlib import Path
import re,sys,math
text=Path('docs/changes/CR-OSCILLATOR-IMPACT.md').read_text()
code=re.search(r'```python\n([\s\S]*?)\n```',text).group(1)
code=code.replace("if __name__=='__main__':run()",'')
code=code.replace('if norm<1e-9','if norm<1e-11')
sys.argv=['reference','2.5e-7','.015','BE'];ns={}
exec(compile(code,'archived-reference','exec'),ns)
pairs=[(1,3),(1,None),(1,2),(2,0),(2,3)]
def error(a,b):
    values=list(zip(a[:4],b[:4]))
    values += [(a[i]-(a[j] if j is not None else 0),
                b[i]-(b[j] if j is not None else 0)) for i,j in pairs]
    return max(abs(x-y)/(1e-5+1e-4*max(abs(x),abs(y))) for x,y in values)
t=0.;v=[0.]*5;h=2.5e-7;accepted=rejected=0
while t<.015:
    h=min(h,.015-t)
    if t<1e-4:h=min(h,1e-4-t)
    if h<1e-15:t=1e-4;continue
    try:
        f,_,_=ns['step'](v,h,t+h)
        a,_,_=ns['step'](v,h/2,t+h/2)
        b,_,_=ns['step'](a,h/2,t+h)
        e=error(f,b)
    except ArithmeticError:e=math.inf
    if e>1:
        rejected+=1
        h*=max(.2,min(.8,.9/e**.5)) if math.isfinite(e) else .5
        if h<1e-11:
            print('BLOCKED',dict(time_s=t,PABD=v[:4],accepted=accepted,
                  rejected=rejected,next_step_s=h));break
        continue
    v=b;t+=h;accepted+=1
    h=max(1e-11,min(2.5e-7,h*max(.5,min(2,.9/max(e,1e-16)**.5))))
else:raise AssertionError('expected failure did not reproduce')
PY
```

## 交接及继续边界

暂停依赖该契约的数值通过结论、speaker周期声音、动态生命周期验收和完整性能；继续独立的安装/profile/容量/v5迁移工作。请需求作者核验并在需要改变模型/积分/预算时另走需求变更PR，保留既有虚拟教学目标及用户授权，不让用户重批同一方向。不能在实现PR改hmin/LTE/期望、换成隐藏方波/预置波形或把numerical-failure称完成。

最终完整实现和OSC-01–06仍未完成。修订需求合并后须核对新主线SHA及差异，再恢复依赖工作；本任务键/实现PR保持唯一，不重新创建实现任务或自动合并实现PR。
