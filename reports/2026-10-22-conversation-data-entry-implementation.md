# 阶段 B：对话即数据入口 MVP 实现回执

结论：四类对象已沿原 events/reducer/Repository/proposal 链实现；源码与隔离验收完成，真实浏览器、App/微信真机和生产环境未验。不新增集合、Store、路由或依赖；未部署、未调用真实模型、未开启定时器/通知、未写客户数据。

## 已实现

- **Goal**：ID 仍是 conversation.id；注册字段/生命周期/规则版本；完整档案经确认才写原 studyProfile；已有 coach/journey 只原子修订其对应字段，不复制完整档案。暂停/继续/关闭/归档/重开有明确事件。用户声明完成不增加答题、掌握、复习或训练完成证据。
- **Reminder**：原 reminders 支持 v2 once/weekly、绝对日期/时间/时区、完成/取消及 ID 保留式更新；保留 v1 三类重复提醒和通知回执口径。不存在/重复的 DST 时间拒绝，不静默选时刻；修改 generation 后旧 job 回执失效。
- **Idea**：仍保存为 message.proposal；pending/kept/dismissed/expired/promoted 从原事件投影。待采纳候选默认14天过期，kept 不过期、不删除源消息。转计划先明确采用同会话计划，再确认关联；计划不存在或未确认时保持 kept，不隐式建任务。不同新消息明确“重新记”可以重提已过期/忽略的想法。
- **Memory**：仍是六字段 profile.set；新条目绑定 conversationId、替代前条目；profile.retract 留历史并阻止继续注入。旧无归属记录不猜归属。
- **四工具**：entry.query/aggregate/create/update；前后端共用严格 schema/参数白名单、当前会话权限、最多三个工具、取消与预算。create/update 只生成候选；read 工具不写学习事实。查询有界分页、scope/revision 游标；聚合只投影实际 attempts、coach 原答/反馈与提醒，AI 评估不等于官方或可靠评分。
- **确认与幂等**：模型完整结果通过 provider 与 Store 白名单后才执行原工具；不增加第二次模型请求。明确中文指令也可用同一候选路径，完全不调用模型。稳定候选 ID 使用双32位摘要压缩，但同时比较完整来源身份与规范化载荷，摘要不是唯一依据；原文只保留在原消息，不再复制进候选指纹。确认事件固定为 proposalId:accept，检查 owner/原文来源/会话/时区/basis/生命周期；取消、同来源重复、过期或前态变化不写有效事实。
- **离线执行器**：纯规则 stage + 内部 runConversationEntryScan；默认没有 extraction.enabled/consentVersion 即关闭，没有 HTTP/yaml/cron/模型接线。每用户最多50条/20000字符/3候选，按 message.add 事件顺序推进 cursor；单文档租约+revision+完整 extraction CAS 提交候选与 checkpoint；冲突最多五次，30秒上限，1/5/30分钟退避与三次失败门槛。同步既有 $set 保留 extraction，删除/撤回同意不会被旧执行器重建。
- **计划页**：原 /pages/archive/index?view=plan 增加四类切换、待确认、采用/忽略、历史与来源定位；来源消息缺失降为会话，缺失会话显示不可用。组件位于 archive 分包。为主包预算，把原账户页移入 pages/profile 分包，URL 与导航合同保留；没有新增路由。
- **plan.set**：新宿主写入绑定 conversationId，按会话+日期选替换版本；Store 建题/复测取同会话计划，batch 与隐私脱敏重放保留归属。plan.merge 不允许跨会话合并。旧无归属计划继续未归类。

## 验收与证据

- 冻结 2026-10-22T10:00:00+08:00、Asia/Shanghai，使用内存 Repository 和伪 Mongo CAS，不接真实数据库/模型/通知。
- 新增验收按设计8.2覆盖目标、明日20点提醒、闲谈不误提、Idea、Memory、原消息重投、跨消息同义去重、重复确认、21点更新原提醒、暂停/完成；另覆盖 sourceRefs 越权/伪角色/截断、否定/引用/作答、非法字段/低置信度、v1、旧 generation、过期 basis、Idea 过期/重提/转计划、Memory 替代/撤回、同日不同会话计划、原子失败、重放与历史编码。
- 回扫覆盖补漏、同批去重、实时争抢 CAS、迟到旧时间消息、失败保持 cursor/退避、租约占用/过期、撤回同意、删除及写后断线读取 checkpoint 重试。
- 命令/结果以本轮 [tests log](../tmp/conversation-entry-20261022/final-tests.log)、[focused log](../tmp/conversation-entry-20261022/acceptance-default.log)、[typecheck](../tmp/conversation-entry-20261022/typecheck.log)、[H5](../tmp/conversation-entry-20261022/h5.log)、[App布局H5](../tmp/conversation-entry-20261022/app-h5.log)、[微信构建](../tmp/conversation-entry-20261022/mp.log)、[主包](../tmp/conversation-entry-20261022/mp-budget.log) 为准；最终计数见下方收尾。
- 扩展回归默认模式曾出现12项失败：当前既有启动代码只选 coach 会话，旧测试预期普通会话也自动选中；本轮未改该分支。显式 VITE_ENABLE_WRITING_COACH=false 后相关测试通过，不能将此作为默认模式全量通过。
- 另一次资料删除扩展检查有1项 UI 断言失败：查找 #learning-composer 内的“导入资料”按钮，与当前菜单入口布局不符。本轮未修改该导入入口，未用任务前完整源码复现；记为未关闭问题，见 [extra log](../tmp/conversation-entry-20261022/entry-extra.log)。其他该批数据/恢复断言通过。
- 页面确认按钮和来源回跳通过组件+真实 Store 操作验证；未完成390/1090真实浏览器操作/截图。沙箱拒绝127.0.0.1监听（EPERM）；共享 Playwright 会话被占用；CUA建页失败，Google Chrome操作未获工具批准。没有停用共享浏览器或绕过限制。

## 变更路径

新增：
- laf-backend/functions/_shared/learning-entries.js
- laf-backend/functions/_shared/learning-entry-extractor.js
- laf-backend/functions/_shared/learning-entry-scan.ts
- src/pages/archive/components/conversation-entries.vue
- tests/unit/conversation-data-entry.spec.js

修改：
- laf-backend/functions/_shared/{learning-domain.js,learning-proposals.js,learning-reminders.js}
- laf-backend/functions/_shared/ai-providers/learning-provider.ts；laf-backend/functions/proxy-ai.ts
- src/services/learning/{learning-tools.js,learning-repository.js,learning-insights.js}
- src/stores/modules/conversation-learning.js
- src/components/business/learning/{learning-proposal-card.vue,muse-workspace-pages.vue}
- src/pages/learning/index.vue；src/pages.json
- docs/13-DEVELOPMENT-PLAN.md；本报告

未改任务板/审查日志，由路由方记录。既有未提交修改保留，没有提交或暂存其他任务内容。

## 未实现 / 未确认

1. 真实390/1090、App/微信真机和通知送达待 Lead 补验；正式安装 App 未替换。
2. 源码不等于线上兼容：真实 Mongo/Laf 的 extraction 对象相等 CAS、网络长延迟下的租约到期、注销栅栏、账户发现与许可设置界面均未生产验收。执行器只提供内部调用，保持关闭；启用前仍须独立授权与全链路核对。
3. 自然语言规则只覆盖明确且无歧义的中文保存指令、明天整点与唯一提醒的改时；宽泛语义、多个提醒指代、夏令时消歧 UI、历史 intake 回填未做。卡内直接改字段未做，可回来源对话重新提出更正；模型路径只验 fixture，未验证真实模型提取质量。
4. Idea 转计划采用“两次明确确认”：先确认计划，再确认关联。没有把用户想法自动改成任务，也没有原子创建计划并同时推广想法的一键交互。
5. Memory 撤回是停止使用；历史事件/候选仍保留，不代表隐私彻底删除。旧端不识别新增事件时会拒绝重放，不提供静默丢弃式兼容。
6. 日期聚合当前按记录 at 的 UTC 日切片，Reminder 展示/排程按保存时区；需本地业务日统计时应进一步统一，未知分母始终 null。

## 拓展路线图（判断，成本为粗估）

| 优先级 | 路线与价值 | 依赖层 | 成本 |
| --- | --- | --- | --- |
| P0 | 真正390/1090与微信/App验收，修正遗留入口断言；确保可操作与来源回跳 | 现有分包UI、浏览器/真机环境 | 0.5–1天 |
| P0 | 主包进一步拆分，留出可持续迭代空间 | 页面/Store按需边界、三端构建 | 1–2天 |
| P1 | 候选字段编辑、唯一提醒选择与时间消歧；减少重新输入 | 原proposal草稿与schema、分包UI | 1–2天 |
| P1 | 受控本地空闲回扫与许可开关；捕获漏提而不上传 | 原Repository写租约、许可代际、恢复/删除测试 | 1–2天 |
| P2 | 服务端受控调度、真实Mongo竞争/注销验收与可观测性；跨设备补漏 | 原learning_states、CAS/专用调度权限、成本与同意合同 | 2–4天，另行授权 |
| P2 | 学科定义中的提取样本/独立标注集与幂等升级；提升召回质量 | 同一注册表与教学方法定义、离线评估 | 2–3天，不先开真实模型 |

新增依赖/许可附录：0；没有下载，downloads.json 无新增条目；无新增GPL/AGPL组件。

## 最终收尾

- 专项测试：`tests/unit/conversation-data-entry.spec.js` 20/20 通过。
- 相关回归：16 个文件 460/460 通过；H5、App 布局 H5、微信构建均通过；微信主包 2,095,531 / 2,097,152 bytes，媒体 127,725 / 204,800。
- 验收状态：代码/隔离数据层通过；真实 390/1090 浏览器、App/微信真机、通知送达、生产 Mongo/Laf 租约与提取开关未验，不能标为端到端发布通过。
- 未启用：生产 cron、真实模型提取、通知发送、账户数据写入；`extraction.enabled` 默认关闭。
- 外部阻塞：provider websocket 426 导致后续收尾模型中断；本轮以已保存代码、测试日志和报告为准，不补写模型未产出的结论。
