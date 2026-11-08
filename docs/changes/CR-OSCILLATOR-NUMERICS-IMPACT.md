# 数值契约失败来源归档

原作者：唯一技术聊天01a1902f-8a44-7f03-855b-115e272388c4，正式报告[PR #7评论6726404637](https://github.com/bjstevenyang/ai-circuit-tutor/pull/7#issuecomment-6726404637)，固定文档commit9755c7dbb5d1f5edf88a04613d7b21cfebd20600。以下原始失败文档逐字归档；不是最终修订方案或PASS，未修改业务需求。其相对路径提及的原参考脚本已在同目录CR-OSCILLATOR-IMPACT.md永久归档。

协调者已在干净需求分支独立执行下方复现命令，结果完全匹配时间0.0007880928149619716s、3381接受/25拒绝、下一步8e-12s。后续新候选必须以新的实测证据补充，不从旧无LTE研究推断达标。

---

# OSC数值切片：冻结最小步长/LTE失败证据

输入需求基线：`4a3340cc0263985c6d5b5bf810b794bcdb5c0454`；需求PR #5，实现PR #7。本文记录实际失败，不修改需求参数、容差或验收。尚无实现完成/PASS结论。

## 实际失败与影响

生产数值切片按冻结EM、10/5pF、零态/100μs上电、BE整步与两半步、rtol=1e-4、atol=10μV、hmax=.25μs、hmin=10ps实现。最小反馈环测试命令：

`npm test -- src/circuit/oscillator/numeric.test.ts`

实际失败：0.0007880928145152545s，尚无D=1V上穿，不能达到15ms/5次的OSC-03。3381次接受推进、25次拒绝，已接受最小步10ps，下一次10ps的LTE>1，需要8ps；按冻结规则返回numerical-failure。节点P/A/B/D为[4.992342113246835,0.7650549398691209,4.223335486662086,0.22859310019577728]V。没有将失败当成起振、生成声音或继续放宽精度。

已修正本地控制器“成功后建议步可能低于hmin”的实现问题，再次复现上述10ps失败；不是靠先前错误控制器违规接受的亚皮秒步证明。当前业务改动仍在隔离工作区未提交，已发布分支只有实施确认/本失败文档。原stage2工作区不动。

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

## 作者有限候选探索（未冻结）

补充实际结果：2nF/1nF更严格档（rtol5e-5、atol5μV、hmax0.125μs）15ms已完成，124257接受/79拒、min20.519932136ps、KCL最大约1e-11A，五上穿为0.000754090726796221、0.00422038032538567、0.007686669903594548、0.011152959445856144、0.014619248967582056s；末周期3.466289522ms、D交流RMS0.821676676V、平均源流0.026089465A、峰源流0.174340814A、全窗最大EM传导端流0.174340779A。该档与同候选默认档观察量接近，但仍未完成40ms、其他积分方法、全部变体/负例及性能证明，不能据此冻结或恢复实现。

以下是标准库离线数学，用合并归档的参考方程，增加相同LTE/下限和全时窗模型域检查；不调用项目实现，不是新规格或应用性能。虚拟结C只作候选参数，未装依赖、未修改业务。参考程序为独立研究来源，本包装由需求作者编写，最终必须由未参与作者的审查者复核。脚本SHA-256：`62f1b30f92429418102e248cb99de6a82f92bb32e3b1f071a1edc527f66876da`。保存下文为candidate.py，在仓库根目录执行：

```sh
python3 candidate.py 1e-9 0.015
python3 candidate.py 2e-9 0.015
python3 candidate.py 2e-9 0.015 5e-5
```

已实际完成：1nF/0.5nF默认档15ms，63617接受/146拒、min14.514ps、末周期3.467946371ms；2nF/1nF默认档15ms，63279接受/125拒、min29.436652645ps、5次D=1V上穿、末周期3.466372677ms、D交流RMS0.821723816V、平均源流0.026094619A、峰源流0.174340810A、最大EM传导端流0.174340779A、KCL最大约1e-11A。严格档及完整参考/变体/40ms判据尚在核验，不把上述探索称完整方案通过。

```python
"""Bounded offline candidate exploration; never app implementation or approved spec."""
from pathlib import Path
import re, sys, math, json, time

text=Path('docs/changes/CR-OSCILLATOR-IMPACT.md').read_text()
code=re.search(r'```python\n([\s\S]*?)\n```',text).group(1)
code=code.replace("if __name__=='__main__':run()",'')
code=code.replace('if norm<1e-9','if norm<1e-11')
cap=float(sys.argv[1]);stop=float(sys.argv[2]) if len(sys.argv)>2 else .015
rtol=float(sys.argv[3]) if len(sys.argv)>3 else 1e-4
hmax=2.5e-7 if rtol==1e-4 else 1.25e-7
atol=1e-5 if rtol==1e-4 else 5e-6
sys.argv=['reference',str(hmax),str(stop),'BE'];ns={}
exec(compile(code,'archived-reference','exec'),ns);ns['CP']=cap
pairs=[(1,3),(1,None),(1,2),(2,0),(2,3)]
def error(a,b):
    values=list(zip(a[:4],b[:4]))
    values += [(a[i]-(a[j] if j is not None else 0),
                b[i]-(b[j] if j is not None else 0)) for i,j in pairs]
    return max(abs(x-y)/(atol+rtol*max(abs(x),abs(y))) for x,y in values)
t=0.;v=[0.]*5;h=hmax;accepted=rejected=0;hmin=1e-11;low=hmax
rises=[];samples=[(0.,v[:])];normmax=0.;peak=0.;currmax=0.;start=time.monotonic();reason='complete'
while t<stop:
    h=min(h,stop-t)
    if t<1e-4:h=min(h,1e-4-t)
    if h<1e-16:t=1e-4;continue
    try:
        f,_,rf=ns['step'](v,h,t+h)
        a,_,ra=ns['step'](v,h/2,t+h/2)
        b,_,rb=ns['step'](a,h/2,t+h)
        e=error(f,b)
    except ArithmeticError:e=math.inf
    if e>1:
        rejected+=1
        if h<=hmin*(1+1e-10):reason='hmin-LTE/Newton';break
        h=max(hmin,h*(max(.2,min(.8,.9/e**.5)) if math.isfinite(e) else .5))
        if rejected>10000:reason='reject-budget';break
        continue
    normmax=max(normmax,ra,rb);low=min(low,h)
    if v[3]<1<=b[3]:rises.append(t+h*(1-v[3])/(b[3]-v[3]))
    v=b;t+=h;accepted+=1;samples.append((t,v[:]))
    peak=max(peak,(9*min(1,t/1e-4)-v[0])/47)
    for bi,ci,ei,s,beta in [(1,2,None,1,100),(2,3,0,-1,50)]:
        ve=v[ei] if ei is not None else 0
        vb=s*(v[bi]-ve);vc=s*(v[bi]-v[ci])
        f=ns['IS']*math.expm1(vb/ns['VT']);r=ns['IS']*math.expm1(vc/ns['VT'])
        ib=f/beta+r;ic=f-2*r;ie=-ib-ic
        currmax=max(currmax,abs(ib),abs(ic),abs(ie))
        if not (-3<=vb<=.9 and -15<=vc<=.9 and max(abs(ib),abs(ic),abs(ie))<=.25):reason='model-domain';break
    if reason!='complete':break
    if accepted>1000000:reason='step-budget';break
    if time.monotonic()-start>30:reason='offline-30s-bound';break
    h=max(hmin,min(hmax,h*max(.5,min(2,.9/max(e,1e-16)**.5))))
out=dict(candidate_CBE_F=cap,CBC_F=cap/2,rtol=rtol,stop=stop,time=t,status=reason,accepted=accepted,rejected=rejected,min_h=low,max_KCL=normmax,source_peak_A=peak,max_EM_terminal_A=currmax,rises=rises,wall_s=time.monotonic()-start)
if len(rises)>=2:
    begin,end=rises[-2:];total=0.;square=0.;src=0.
    def interp(t0,x0,t1,x1,t):return [a+(b-a)*(t-t0)/(t1-t0) for a,b in zip(x0,x1)]
    for (t0,x0),(t1,x1) in zip(samples,samples[1:]):
        lo=max(t0,begin);hi=min(t1,end)
        if hi<=lo:continue
        a=interp(t0,x0,t1,x1,lo);b=interp(t0,x0,t1,x1,hi);dt=hi-lo
        total+=dt*(a[3]+b[3])/2;square+=dt*(a[3]**2+b[3]**2)/2;src+=dt*((9-a[0])+(9-b[0]))/(2*47)
    mean=total/(end-begin);out.update(period_s=end-begin,D_mean=mean,D_ac_rms=math.sqrt(max(0,square/(end-begin)-mean**2)),source_mean=src/(end-begin))
print(json.dumps(out,indent=2))
```
