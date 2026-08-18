# Lab Brief

**Period:** 2026-08-03 ~ 2026-08-17
**Generated:** 2026-08-17T14:02:39.833Z

---

## Summary

| Status | Count |
|--------|-------|
| Total | 13 |
| On Track | 9 |
| At Risk | 1 |
| Blocked | 1 |
| Need Discussion | 1 |

**Not Submitted (1):** 汤老师

## Risk Register

| Level | Student | Rule | Detail |
|-------|---------|------|--------|
| 🔴 critical | 阎吉瑜 | self_blocked | 学生自评状态为 blocked，需人工介入 |
| 🟡 warning | 汤老师 | not_submitted | 2026-08-03 ~ 2026-08-17 双周报未提交 |
| 🟡 warning | 冯志斌 | at_risk | 学生自评状态为 at_risk，需关注 |

## Individual Reports

### 宋禧 — SCI论文撰写与投稿

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成SCI论文第二版修改，重点修改了Methodology部分
2) 根据审稿人意见补充了对比实验
3) 更新了参考文献列表

#### 2. Comments and Concerns

1) 论文第二轮审稿意见已返回，主要问题集中在：
   - 实验对比方法不够充分（Reviewer #2）
   - 部分公式推导过程需要补充中间步骤
2) 已完成80%的修改工作，预计下周提交修改稿

#### 3. Activities

1) 阅读审稿意见并制定修改计划
2) 补充3组对比实验，结果符合预期
3) 与导师讨论修改方案

#### 4. Work Planned Next Two Weeks

1) 完成论文修改稿并提交
2) 准备Response to Reviewers
3) 开始构思下一篇论文

#### 5. Service Work Done

1) 协助实验室设备维护

#### 6. Attachments

- attachments/response_plan.pdf

---

### 常申奥 — 电力系统韧性/可靠性

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了IEEE 33节点系统的韧性评估仿真
2) 阅读了5篇关于电力系统韧性的最新文献
3) 搭建了基于OpenDSS的仿真平台

#### 2. Comments and Concerns

1) 仿真结果表明，在极端天气事件下，现有备用容量策略的韧性提升效果有限
2) 需要进一步研究移动储能的最优配置策略

![Voltage Profile](images/voltage_profile.png)
*Figure 1: IEEE 33节点电压分布*

| Parameter | Value | Unit |
|-----------|-------|------|
| Min voltage | 0.892 | p.u. |
| Max voltage | 1.035 | p.u. |
| Load shedding | 12.3 | % |

#### 3. Activities

1) 学习OpenDSS仿真工具
2) 复现了文献[1]中的韧性评估方法
3) 整理仿真数据并绘制结果图

#### 4. Work Planned Next Two Weeks

1) 完成移动储能配置的优化模型
2) 在IEEE 33节点系统上验证模型有效性
3) 撰写阶段性报告

#### 5. Service Work Done

1) 参与课题组安全培训

#### 6. Attachments

- images/voltage_profile.png
- images/restoration_time.png

---

### 陈光 — 电力系统韧性

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了电力系统韧性评估指标的文献综述
2) 建立了基于序贯蒙特卡洛的韧性评估模型
3) 初步实现了极端天气场景生成器

#### 2. Comments and Concerns

1) 模型收敛速度较慢，需要优化采样策略
2) 极端天气场景的生成参数需要进一步校准
3) 下一步考虑与IEEE 33节点系统结合进行仿真验证

#### 3. Activities

1) 阅读15篇关于韧性评估的文献
2) 编写Python仿真代码
3) 与师兄讨论模型框架

#### 4. Work Planned Next Two Weeks

1) 优化蒙特卡洛采样策略（考虑Latin Hypercube Sampling）
2) 完成算例分析
3) 准备组会汇报PPT

#### 5. Service Work Done

1) 无

#### 6. Attachments

- images/flowchart.png

---

### 冯志斌 — 电动汽车与电网互动

**Status:** at_risk
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了V2G模式的仿真模型搭建
2) 收集了南京市电动汽车充电站的实际运行数据
3) 初步分析了EV参与调频的市场潜力

#### 2. Comments and Concerns

1) 实际数据质量较差，部分充电站数据缺失严重
2) V2G参与电力市场的经济性分析需要更多数据支撑
3) 仿真模型与实际情况偏差较大，需要校准

#### 3. Activities

1) 数据清洗与预处理
2) 学习电力市场交易规则
3) 搭建V2G聚合商仿真模型

#### 4. Work Planned Next Two Weeks

1) 完成数据清洗工作
2) 校准V2G仿真模型参数
3) 进行初步的经济性分析

#### 5. Service Work Done

1) 协助整理实验室论文资料

#### 6. Attachments

- images/ev_charging_pattern.png

---

### 李吴磊 — EV充电网络韧性

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了EV充电网络的图论建模
2) 基于渗透理论分析了充电网络的韧性阈值
3) 搭建了交通-电力耦合仿真平台

#### 2. Comments and Concerns

1) 渗透阈值与网络拓扑结构的关系需要进一步分析
2) 交通流与充电负荷的耦合模型仍需完善
3) 初步结果表明：当EV渗透率超过35%时，充电网络韧性显著下降

#### 3. Activities

1) 阅读图论与渗透理论相关文献
2) 编写网络韧性分析代码
3) 整理实验数据

#### 4. Work Planned Next Two Weeks

1) 完成韧性阈值的参数敏感性分析
2) 撰写论文Methodology部分
3) 制作对比图表

#### 5. Service Work Done

1) 无

#### 6. Attachments

- images/percolation_threshold.png
- images/network_topology.png

---

### 张明潇 — 微电网实验

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了微电网实验平台的硬件搭建
2) 完成了第一组和第二组实验
3) 验证了下垂控制策略的有效性

#### 2. Comments and Concerns

1) 实验数据波动较大，可能是测量误差导致
2) 需要补充更多工况下的实验数据
3) 下垂控制参数整定需要进一步优化

#### 3. Activities

1) 搭建实验平台
2) 进行实验测试
3) 记录实验数据

#### 4. Work Planned Next Two Weeks

1) 完成剩余实验（第三组和第四组）
2) 分析实验数据并绘制图表
3) 撰写实验报告

#### 5. Service Work Done

1) 实验室仪器维护与校准

#### 6. Attachments

- images/experiment_setup.jpg
- images/droop_control_results.png

---

### 薛隆奇 — 电力系统韧性

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 阅读了10篇关于电力系统韧性的文献
2) 完成了韧性评估指标的综述
3) 初步确定了研究方向：极端天气下的配电网韧性评估

#### 2. Comments and Concerns

1) 研究方向还不够聚焦，需要进一步明确
2) 与现有文献的差异化和创新点需要提炼
3) 建议下周与导师讨论具体研究框架

#### 3. Activities

1) 文献阅读与笔记整理
2) 与导师讨论研究方向
3) 学习Python数据分析工具

#### 4. Work Planned Next Two Weeks

1) 确定具体研究问题
2) 搭建初步仿真模型
3) 撰写开题报告框架

#### 5. Service Work Done

1) 无

#### 6. Attachments

- images/literature_map.png

---

### 阎吉瑜 — 电力系统韧性

**Status:** blocked
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了一部分仿真代码编写
2) 阅读了3篇相关文献

#### 2. Comments and Concerns

1) 仿真代码运行报错（Gurobi license问题），尚未解决
2) 对优化算法的理解不够深入
3) 近期课程压力大，科研时间不足
4) 需要导师帮助解决Gurobi license问题

#### 3. Activities

1) 调试仿真代码
2) 学习优化算法

#### 4. Work Planned Next Two Weeks

1) 解决代码调试问题
2) 完成初步仿真结果
3) 与导师讨论下一步计划

#### 5. Service Work Done

1) 无

#### 6. Attachments

- 无

---

### 李骏鹏 — 电力系统可靠性/韧性

**Status:** need_discussion
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了电力系统可靠性评估的理论学习
2) 阅读了5篇关于电力系统可靠性的文献
3) 初步搭建了可靠性评估模型

#### 2. Comments and Concerns

1) 可靠性评估与韧性评估的区别需要进一步明确
2) 建议调整研究方向，从传统可靠性转向韧性评估
3) 需要与导师深入讨论研究框架

#### 3. Activities

1) 文献阅读与笔记整理
2) 搭建可靠性评估模型
3) 编写Python代码

#### 4. Work Planned Next Two Weeks

1) 整理研究框架，明确研究方向
2) 完成初步仿真结果
3) 准备组会汇报

#### 5. Service Work Done

1) 协助实验室设备采购

#### 6. Attachments

- images/reliability_curve.png

---

### 旷嘉庆 — 电力系统韧性

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 阅读了文献，了解了电力系统韧性的基本概念
2) 完成了文献综述初稿

#### 2. Comments and Concerns

1) 初入课题组，对研究方向还在熟悉中
2) 需要更多指导
3) 对Python和仿真工具掌握不够熟练

#### 3. Activities

1) 阅读文献
2) 学习Python

#### 4. Work Planned Next Two Weeks

1) 继续阅读文献
2) 学习仿真工具
3) 确定研究问题

#### 5. Service Work Done

1) 无

#### 6. Attachments

- 无

---

### 王晗 — 电力系统韧性

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了电力系统韧性相关文献的阅读
2) 建立了初步的理论框架
3) 编写了数据预处理代码

#### 2. Comments and Concerns

1) 理论框架的数学表述需要进一步完善
2) 数据来源需要确认
3) 目前对极端天气场景的建模还不够完善

#### 3. Activities

1) 文献阅读与整理
2) 代码编写
3) 参加课题组讨论会

#### 4. Work Planned Next Two Weeks

1) 完善理论框架
2) 开始仿真工作
3) 准备开题报告

#### 5. Service Work Done

1) 无

#### 6. Attachments

- images/framework_diagram.png

---

### 杨凯杰 — 电力系统韧性

**Status:** on_track
**Period:** 2026-08-01 ~ 2026-08-14

#### 1. Progress

1) 完成了电力系统韧性基础理论学习
2) 阅读了5篇文献
3) 学习OpenDSS仿真工具

#### 2. Comments and Concerns

1) 对OpenDSS的使用还不够熟练
2) 需要更多时间投入
3) 建议导师推荐一些OpenDSS的学习资源

#### 3. Activities

1) 学习OpenDSS
2) 阅读文献
3) 参加课题组讨论

#### 4. Work Planned Next Two Weeks

1) 完成OpenDSS入门案例（IEEE 13节点系统）
2) 确定研究切入点
3) 撰写文献综述

#### 5. Service Work Done

1) 无

#### 6. Attachments

- 无

---
