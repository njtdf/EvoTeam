 # 组会纪要 2026-W33
 
 日期: 2026-08-17
 地点: 电气楼 301
 主持: 汤老师
 记录: 听记硬件自动生成
 
 ## 议程
 
 1. 各项目双周进展汇报
 2. V2G 恢复 baseline 复现问题
 3. SCI 投稿时间节点
 
 ## 讨论
 
 - 宋禧汇报 SCI 论文 Introduction 初稿,导师认为问题陈述偏弱,需聚焦"热浪下 DSO 配额分配"单一机制。
 - 常申奥反馈 IEEE 33-bus baseline 脚本 OpenDSSDirect.py 环境跑不通,缺 feeder data。
 - 陈光提出 V2G 恢复目标函数中 SoC 约束未显式检查,可能隐藏电压越限。
 - 旷嘉庆本周考试,进度暂停。
 
 ## 决议
 
 1. SCI 论文 Chapter 4 收窄到 DSO 配额 + 导航机制,砍掉多目标堆叠。
 2. baseline 复现统一用 IEEE 33-bus 标准算例,环境配置文档化。
 
 ## Action Items
 
 - 宋禧:两周内重写 Introduction,聚焦热浪下 DSO 配额单一机制,截止 2026-08-31。
 - 常申奥:本周内跑通 IEEE 33-bus baseline,生成 voltage_profile.png,截止 2026-08-24。
 - 陈光:在恢复模型目标函数显式加入 SoC 约束,提交 PR,截止 2026-08-31。
 - 旷嘉庆:考试后补回进度,下周恢复双周报。
