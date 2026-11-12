# 晶体管型号选择（有限 SPICE 参数子集）

在 `oscillator-em-v2` 中，每只 NPN/PNP 可选择 **通用虚拟模型（默认、历史兼容）** 或型号参数子集：NPN 的 **2N3904**、PNP 的 **2N3906**。旧作品缺失 `transistorModel` 字段时仍按通用虚拟模型计算；选择随作品保存、恢复和撤销/重做一起保留。引脚身份仍为软件中的 B/C/E，**不是实体 TO-92 引脚物理排列**。

## 参数来源与边界

公开来源为 Oxford University Press《Microelectronic Circuits》8th edition, Appendix B, Table B.11 中的 Q2N3904、Q2N3906 SPICE 器件卡：
https://learninglink.oup.com/protected/files/content/file/1617108117122-Sedra8e_AppB.pdf

| 参数 | Generic NPN | Generic PNP | 2N3904 card | 2N3906 card |
|---|---:|---:|---:|---:|
| IS (A) | 1e-14 | 1e-14 | 6.734e-15 | 1.41e-15 |
| BF (dimensionless) | 100 | 50 | 416.4 | 180.7 |
| CJE (F) | 2e-9 | 2e-9 | 4.493e-12 | 8.063e-12 |
| CJC (F) | 1e-9 | 1e-9 | 3.638e-12 | 9.728e-12 |

当前求解器只取这四个公开参数：IS 进入指数传导电流，BF 进入前向基极电流，CJE/CJC 作为**固定线性结电容**使用。**不是完整的 SPICE 型号模型**：未实现 NE、BR、VAF、IKF、结电容的反向偏置电压依赖、RB/RC/RE、TF/TR、温度变化和击穿等，因此不能声称达到真实器件的精度、频率、波形、发热或安全级别。即使数值收敛也不等同于物理验证。

型号和参数仅为**已核对公开来源的模型子集**，尚未通过外部 SPICE 波形比对和实体测量验证。用户应明确区分『数据来源已核对』与『模拟结果已验证』。切换型号会重新求解；原 `legacy-stage2-v1` 的 NPN 低侧教学模型保持原行为。

## 验收与限制

新增定向测试为 `src/circuit/transistorModels.test.ts`（型号与类型约束、参数来源值、默认兼容、v5 存储恢复、不同 IS/BF 电流响应）。没有采用“切换型号后必须发声”的假验收；不同参数下可能出现无稳定振荡、数值失败或模型域不支持。对照 NGSPICE/PSpice 直流工作点、瞬态波形和真实元件实验仍是后续独立验收项。

## 新增完整标准GP卡路径（2026-11-10）

上述四参数子集继续描述旧v2模式。显式启用`oscillator-spice-gp-v1`后，使用固定完整GP卡，由浏览器ngspice-45.2执行，固定27°C；卡参数与默认、Worker、保存兼容和原生ngspice-47对照见[CR](changes/CR-BJT-DYNAMICS.md#本轮实际实现与验证)。全卡路径没有把BF当作所有电流下的固定hFE，也没有把CJE／CJC当作固定线性结电容。原图完整卡结果仍为近直流。标准模型不等同于实物校准、发热／击穿／声学仿真。
