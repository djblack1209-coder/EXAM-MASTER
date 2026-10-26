# 对话即数据入口：阶段 A 仓库现状与设计

日期：2026-10-22（施工单日期）。范围：当前工作树源码，只读审计与设计；未提交、未部署、未调用模型、未安装依赖。仓库存在大量既有未提交修改，本报告以读取时的工作树为准，不代表已安装 App 或线上版本。

## 1. 结论与边界

- **事实**：主流程已有一套共享学习 reducer、本地分用户 Repository、操作事件和单文档云同步。应继续使用这条链，不新建 Goal/Reminder/Idea/Memory 集合、第二套聊天、第二个 Store 或独立记忆服务。
- **事实**：Goal 已分布于会话目标、建档档案、写作教练与学习路线；Reminder 是三类重复学习提醒；proposal 只支持档案/计划建议；Memory 只有受限学习画像，没有通用对话记忆实现。
- **判断**：四类对象首先是现有事实的统一查询与呈现口径。增加的只是现有 reducer/工具/建议合同的必要扩展，不能把四个产品名当作四张新表。
- **建议**：首个页面复用 App 的现有「计划」页面；普通闲谈不提取。目标、提醒、长期记忆与想法采纳均明确确认后才改变有效事实。离线回扫只补待确认候选，不自动建目标、安排通知或认定进度。
- 以下第 2–3 节是已查证现状；第 4–8 节全部是**尚未实现的设计**。带「拟」的字段、事件和工具名不能当作现有接口调用。

## 2. 仓库现状摘要

### 2.1 数据、归属与同步

| 对象 | 真实存放、函数/事件 | 已有能力与限制 |
| --- | --- | --- |
| 逻辑根 | [learning-domain.js](../laf-backend/functions/_shared/learning-domain.js) 的 `emptyLearningState`、`applyLearningOperation`、`createLearningOperationBatch` | 逻辑版本 `1`；`owner/revision/timezone`；`conversations/questions/materials/attempts/plans/events/executions/profile/reviews`，以及 `strategy`。客户端 [learning-domain.js](../src/services/learning/learning-domain.js) 仅重导出同一实现。没有四类新对象集合。 |
| conversations | reducer 的 `conversation.start`、`intake.accept` | `id/goal/at/messages/activeQuestionKey/pendingHints/stopped`；可选 `task/studyProfile/journey/coach/reminders/reminderReceipts/trainingGroups/recaps`。`conversation.start` 的 goal 是文本，不证明已建档或有训练路线。 |
| messages | reducer 的 `message.add`，教学消息另走 `teaching.deliver` | `id/role/content/at/questionKey/attemptId/executionId`，可选 `proposal/contentBlocks`；角色 `user/assistant/tool/notice`。消息保存在会话内，并非独立 messages 云集合；普通消息不自动变成学习事实。 |
| profile | reducer 的 `profile.set` | 追加 `id/field/value/scope/source/evidenceIds/at`。字段仅 `goal/foundation/difficulty/minutes/preference/deadline`；source 仅 `self_report/observed/inferred`，后两类必须引用真实 `attempts`。`value` 为文本，deadline 严格日期校验。条目本身未保存 conversationId；scope 是文本，非可靠外键。 |
| plans | reducer 的 `plan.set/plan.merge/task.complete` | 追加版本 `id/day/timezone/version/replaces/reason/tasks/at`；task 有 `id/title/questionKey/condition/completedBy`。完成条件 `submitted/independent_correct/manual`；前两类依作答，manual 才可显式完成。**plan.set 按全账户同日找前版，结果不保存 conversationId**，不能声称已经按目标隔离。 |
| studyProfile / intake | [learning-intake.js](../laf-backend/functions/_shared/learning-intake.js) 的 `normalizeStudyProfile/normalizeIntakeReply/intakeSystemPrompt`；reducer 的 `intake.request/result/failed/accept` | 档案为 `goal/category/exam/subjects/minutes/deadline/foundation`；未知项用 null。首问固定六选项；后续 2–4 项含跳过，四轮起不继续追问。科目须来自用户回答原词。`intake.accept` 明确确认后创建会话，部分 exam 接 coach，不能把 intake 回复当已保存档案。 |
| coach | [learning-writing-coach.js](../laf-backend/functions/_shared/learning-writing-coach.js) 的 `applyWritingCoachOperation/normalizeCoachOutput/parseCoachModelOutput/coachWeaknesses` | 会话内 `coach` 含 `profile/materialIds/diagnostic/days/library/requests/survey`。`coach.begin/profile/material/request/closeRequest/result/answer/review/analysis/paragraph/adopt/finish/survey` 走共享 reducer；操作要求 explicit。profile 目前支持 english1/english2/cs408，不等于任意学科引擎已完成。days 保存作答、反馈、带写、小结；library 为个人句式/知识条目及复习证据。 |
| journey | [learning-journey.js](../laf-backend/functions/_shared/learning-journey.js) 的 `applyJourneyOperation/describeJourney/deriveJourneyInsights/conversationTimeline` | `journey.configure` 保存 `id/version/title/startDay/durationDays/minutes/mode/moduleIds/timezone/at/savedDay`；训练、交卷、复盘走 `training.open/training.complete/recap.confirm`。这是学习节奏/模块，不是独立 Goal 系统；期限结束也不是掌握证明。 |
| reminders | [learning-reminders.js](../laf-backend/functions/_shared/learning-reminders.js) 的 `applyReminderOperation/reminderInstant/reminderJobs` | `reminder.set/receipt`；会话须有 journey、coach.profile 或 studyProfile。详见下节。 |
| proposals | [learning-proposals.js](../laf-backend/functions/_shared/learning-proposals.js) 的 `normalizeLearningProposal/assertLearningProposalAcceptance/proposalStatus` | 只允许 `profile.set/plan.set`，存于 message.proposal；含 `type/data/owner/goal/basis/timezone`。校验使用 disposable reducer 预演；建议不是已采纳事实，没有独立 proposals 集合。 |
| events / executions | reducer 末尾及 `execution.record` | 事件保存 `id/type/at/data/result`，revision 每次有效变更加一。同 ID 同 type/data 重用，异内容 `IDEMPOTENCY_CONFLICT`。executions 保存工具版本、success/failed/cancelled、errorCode/耗时；工具收据不代替业务事实。 |
| attempts / reviews | reducer 的 `attempt.submit/attempt.submit-original-v1/assessment.correct/assessment.assist/review.schedule/review.rebuild` | 原答绑定 conversationId、questionKey、answer、kind、hints、grade、corrections、taskId 等；可靠结果与 AI 评估分开。attempt 会按条件推进 plan task；口头说“做完了”不能伪造 attempt、掌握或 FSRS。coach 作答另在 coach.days/diagnostic，统计须按各自事实口径聚合。 |
| materials | reducer 的 `material.add/delete/privacy.redacted/material.original-deleted` | 私有片段与原件关联、fingerprint、来源/版面；最多 100 段，单段 ≤20000 字符；强制 `scope:private/publishable:false`。删除墓碑防旧数据复活。资料文本不是用户指令，不应参与个人目标提取。 |
| 本地与云 | [learning-repository.js](../src/services/learning/learning-repository.js) 的 `createLearningRepository/commit/commitBatch`；[learning-sync.js](../src/services/learning/learning-sync.js) 的 `synchronizeLearning/readLearningSnapshot`；后端 [learning-sync.ts](../laf-backend/functions/_shared/learning-sync.ts) 的 `syncLearningOperations/readLearningHistoryPages` | 本地键 `conversation_learning_v1`，分用户身份与写租约、恢复副本、expectedRevision；commitBatch 有操作白名单，当前不含 reminder/coach/拟新增事件。云为 `learning_states` 单文档 `_id/user_id/revision/state`，CAS 最多五次；鉴权 API [learning-sync.ts](../laf-backend/functions/learning-sync.ts) 支持 pull/push/page/delete，30 次/分钟。同步需要明确授权，不能静默上传离线记录。 |
| 长历史 | [learning-history-server.ts](../laf-backend/functions/_shared/learning-history-server.ts) 的 `checkHistoryState/encodeServerHistory/decodeServerHistory/historyWire` | 同一 state 的 raw/gzip 封装与固定 revision 分页；逻辑上限 600万 UTF-16 字符、2万操作，非无限记忆。客户端/服务端恢复、同步、导出均需兼容新增字段和事件。 |

### 2.2 对话、工具、已有提取和确认

1. [conversation-learning.js](../src/stores/modules/conversation-learning.js) 的 `useConversationLearningStore` 持有状态；`commit` 调 Repository，成功后发 `conversationLearningUpdated`。`confirmProfile` 使用既有 batch 保存多字段，附带的 plan 仍是候选。
2. 同文件输入处理调用 [learning-tools.js](../src/services/learning/learning-tools.js) 的 `userDirective`：精确匹配目标调整、学习分钟、基础、错题复习、停止/继续、教法/节奏。以“我的答案是/答案是/我认为”等开头先排除。profile/plan 指令变成 `message.add` proposal，其他受限指令按原合同执行。**没有任意自然语言的 Goal/Idea/Memory 全量抽取器，也没有“明天几点提醒”的通用解析器。**
3. Store 的 `send/applyModelResult` 经 [learning.api.js](../src/services/api/domains/learning.api.js) 的 `generateLearningTurn/learningRequest` 进入 [proxy-ai.ts](../laf-backend/functions/proxy-ai.ts) 的 `runLearningModelTask`；流式复用同一任务函数，经过鉴权/限流/预算与 [learning-provider.ts](../laf-backend/functions/_shared/ai-providers/learning-provider.ts) 的 `parseLearningOutput` 校验。可执行模型工具只有 `progress/visualize/method/hint/assess/plan`，最多三个。纯文本解析失败返回无工具文本；新增工具不能只改客户端。
4. Store 的模型结果执行段再次限制同一六种工具，调用 `executeLearningTool`。其注册表 `LEARNING_TOOLS` 另含宿主 `focus/submit/stop`，read/learn 权限、参数白名单、取消、预算、超时和业务前置条件独立检查；模型不能替用户 submit。`plan` 2.0 保存建议，旧 1.0 收据只兼容重放。成功写 `${call.id}:receipt`，失败写 `${call.id}:failure` 的 `execution.record`。
5. [learning/index.vue](../src/pages/learning/index.vue) 的 `resolveProposal` 验证当前账户/会话，只接 profile/plan；采用用 `${message.id}:accept` 执行原事件并带 proposalId/explicit；取消用 `${message.id}:dismiss` 的 notice 消息。`proposalStatus` 按这些 ID 的事件投影 pending/accepted/dismissed，没有通用 expiry 或 Idea 生命周期。
6. 建档有独立受限 intake 合同，但仍进入同一 reducer。`runModelIntake/acceptModelIntake`（Store）绑定 requestId/modelId，失败查询原请求，确认才 `intake.accept`。现有提示词不推算考试日期；具体 exam 自动衔接 coach 时会把未知 minutes 的执行默认值设为 15，不能反推为用户明确偏好。

### 2.3 提醒与定时任务

- 现有提醒 contract 为 `learning-reminder-v1`；kind 仅 `study/review/recap`，每目标最多三类。同 kind 未传 reminderId 会更新原项；`time=HH:mm`、`repeatDays=1–7 个不重复星期数(0–6)`、有效 timezone、enabled。保存 `id/generation/version/kind/time/repeatDays/timezone/enabled/at`。**没有一次性 dueAt、任意提醒标题、Idea 到期或通用事务提醒。**
- `reminderJobs` 生成 journey 未来 7 日、coach/studyProfile 未来 28 日；按开始/期限、暂停、已交卷、已复盘、真实到期复习资格过滤。DST 不存在时刻返回 null。每次修改换 generation；job ID `${reminder.id}:${version}:${day}`。
- `reminder.receipt` status 仅 `accepted/failed/unknown/opened`，channel 仅 `web/macos`，最多留 200 条；`normalizePrivateSyncOperation` 将同步回执设 historyOnly。终端接纳/点击不证明送达、更不证明学习完成。
- [learning-notifications.js](../src/services/learning/learning-notifications.js) 的 `learningNotificationsFor/createLearningNotifications` 复用控制器；网页打开且获许可才通知，tick 间隔 15 秒；macOS 经现有 native 接口安排与点击。许可绑定本机账户/epoch/lifecycle，不随备份同步。不能承诺微信或手机后台推送。
- [account-purge.ts](../laf-backend/functions/account-purge.ts) 注释给 `0 3 * * *`、Laf/Sealos 控制台配置；实际函数每批最多 50 个待注销用户，清除清单含 learning_states。HTTP 入口需 `ADMIN_PURGE_TOKEN`，内部触发上下文走另一分支；这只是清除函数，**不是已存在的对话扫描调度器**。
- [data-cleanup.ts](../laf-backend/functions/data-cleanup.ts) 为管理员清洗/备份函数，默认 dryRun、生产额外保护；不是抽取任务，也不能拿来自动清理 Idea。没有调用它。
- [on-user-create.js](../laf-backend/triggers/on-user-create.js) 是 users 新建触发器源码，会写旧 `study_plans/users.achievements/rankings`，并推算默认考试日期。它不写当前 learning_states；是否部署、是否仍触发未确认，不可借它新建 Goal 或沿用其推算默认值。
- [standalone/server.ts](../laf-backend/standalone/server.ts) 的 `INTERNAL_ONLY_FUNCTIONS` 阻止 account-purge/data-cleanup 等公开注册。在所查 standalone 源码中未发现对话回扫或 cron 注册；函数 yaml 只有方法描述，无已启用 schedule 证据。只能复用受控后台函数/有限批次的形式，不能声称已有可用 cron 平台接线。

### 2.4 页面数据来源与空壳

| 页面/投影 | 代码与函数 | 来源与缺口 |
| --- | --- | --- |
| 主对话 | [learning/index.vue](../src/pages/learning/index.vue)，`resolveProposal`、Store `locateConversation` | 同一 state，建议卡/原答/教学卡；locate 支持 conversationId/day/groupId/messageId，不产生学习事实。 |
| 资料库 | [muse-library.vue](../src/components/business/learning/muse-library.vue) → [muse-workspace-data.js](../src/services/learning/muse-workspace-data.js) `museLearningLibrary/museArtifacts` | materials、消息卡、attempts、coach 摸底/训练/带写/小结的只读投影，来源会话/学科/错题/AI 薄弱点等筛选；不是四类新对象存储。 |
| 学习洞察 | [muse-saved-library.vue](../src/components/business/learning/muse-saved-library.vue) → [muse-learning-insights.js](../src/services/learning/muse-learning-insights.js) `museLearningInsights` | coach 反馈弱项/优点、library 句式、作答/评估/小结，七日 events 趋势；明示 AI 评估。非通用长期 Memory。 |
| 目标/计划与历史 | [muse-workspace-pages.vue](../src/components/business/learning/muse-workspace-pages.vue) view=plan/all → `museGoals/museHistory/museActivity` | `museGoals` 当前只收有 coach 的会话，不能覆盖普通 studyProfile/journey/文本 goal；历史按保存记录投影。首个页面可在此扩展，不另起工作区。 |
| 统计/旧计划视图 | [learning-overview.vue](../src/components/business/learning/learning-overview.vue) → Store `scopedSummary` → `summarizeLearning` | attempts、plans、reviews、任务完成证据；[learning-insights.js](../src/services/learning/learning-insights.js) 的 `learningInsights` 另投影真实原答、scope 画像和日期，不是会话记忆库。 |
| 共享来源筛选 | [workspace-context.js](../src/services/learning/workspace-context.js) `workspaceConversationContext/scopeWorkspaceState` | 只读选择，保留 conversation ID。**该函数按 plan.conversationId 过滤，但当前 reducer 不写该字段**，存在归属合同缺口；本阶段未实操确认 UI 故障，不擅自修复。 |
| Memory 空壳 | [conversation-memory.yaml](../laf-backend/functions/_shared/conversation-memory.yaml) | 只有 name/desc/methods:[]/tags:[]；限定目录查找仅见该 yaml，无对应执行模块。account-purge 出现旧 ai_friend_memory 集合名，不证明其与主对话连通。未发现主流程通用记忆提取、回扫、读写工具或注入链路。 |

文档交叉依据：[架构](../docs/02-ARCHITECTURE.md)、[API](../docs/04-API-DOCUMENTATION.md) 的对话辅导/提醒合同、[数据库](../docs/05-DATABASE-SCHEMAS.md) 的连续学习状态、[当前计划](../docs/13-DEVELOPMENT-PLAN.md)。后者仍留有失败恢复、真实模型/各端真机与发布边界；本设计不把这些改记为通过。

## 3. 四类对象复用映射

| 产品对象 | 唯一事实与复用动作 | 缺口与不做的事 |
| --- | --- | --- |
| Goal | ID 直接使用 conversation.id；标题来自 conversation.goal，studyProfile 为建档事实，coach.profile 为特定教练执行配置，journey 为节奏与模块，plan 为某日执行任务。复用 `intake.accept/conversation.start/profile.set/coach.profile/journey.configure/plan.set/task.stop/task.resume`。 | 无统一完成/归档与各档案一致修订合同；`profile.set(goal)` 只改会话文本，不同步其他配置。不得把 journey.id、plan.id 当另一个 Goal ID，不接旧 learning_goals/study_plans API。 |
| Reminder | 复用会话 reminders、`reminder.set/receipt`、`reminderJobs` 和原通知控制器/设置组件。 | v1 仅三类重复学习提醒。一次性带日期提醒须扩展原合同及各终端队列校验，不能伪装为周重复或只保存 profile.deadline。与学习无关的事务提醒不纳入首版。 |
| Idea | 复用 `message.proposal` 的候选、basis、绑定、预演和明确接受；采纳为计划时仍执行 plan.set。 | 现有 proposal 是“变更提案”，不是任意灵感笔记；需最小扩展 idea 类型/保留/到期/转计划状态。不能自动把随口“有空试试”落为计划，不能把 note 展示卡当已保存 Idea。 |
| Memory | 已支持的学习偏好/基础等仍用 state.profile 和 profile.set；带明确 scope/source/evidence，供当前对话上下文装配。 | 无通用记忆实现。首版限定已有六字段及学习用途；自由人物档案、敏感信息、任意 KV、向量库、第二套 conversation-memory 服务不纳入。观测或推断继续需真实作答，不用模型置信度替代。 |

## 4. 字段、生命周期与事件设计（拟议）

### 4.1 共用约束

- owner 只取当前受认证账户/Repository，不接受模型传值。访客仍仅本地；云端不读其他用户、不扫描未同步设备数据。
- 保留 operation `{id,type,at,data}` 和 events 收据。各对象 createdAt/updatedAt 由对应事件 at 投影，时间由宿主确定；due/deadline 的时间语义单独验证。state.revision 与云文档 revision 是不同层级，不能混用。
- 拟为候选与实际变更事件增加 `sourceRefs:[{conversationId,messageId,start,end}]`（1–3 项）及 `extractorVersion/confidence`；必须指向当前用户原始消息的有效范围。原文直接从 messages 取，避免再永久复制全文。intake 的用户回答按已保存建档消息定位。来源 role 必须 user，附件/答案引用/第三方转述不授予指令权。
- 拟保留 `basis`（目标字段/对象的最近修改事件 ID 及相关配置版本）、source 指纹、候选目标版本。确认时重查 owner、会话、生命周期、停止状态、时区和 basis；变更则废止旧候选并重新呈现。与事实无关的新消息可不使候选失效，恢复/删除/身份换代必须失效。
- 拟新增字段必须纳入 reducer 严格白名单、备份重放/同步/隐私删除。版本与容量保持现行边界；不创建泛型 entities 数组、独立候选集合或跨账户索引。若旧端不认识新事件则明确不可写/需升级，不能吞事件继续覆盖。

### 4.2 各对象最小定义

| 对象 | 字段位置与最小字段（含新增） | 生命周期与写入 |
| --- | --- | --- |
| Goal | 既有 conversation.id/goal/at/stopped，既有 studyProfile/coach.profile/journey；拟可选 `goalLifecycle:{status,changedBy}`，status 只存 completed/archived，active/paused 由 stopped 与已有配置投影；旧数据缺字段不能推断已确认建档。配置内容仍各归原结构，不再存一份 Goal.profile。 | 候选 → 用户确认 → active ↔ paused → completed → archived。pause/resume 复用 task.stop/resume；拟 `goal.close` 记录用户声明 completed/archived，关闭待执行提醒且保留训练历史。completed 表示用户结束目标，不表示掌握/考试通过。重开需显式事件，归档默认只读。 |
| Goal 修订 | 拟 `goal.revise` 的 data 为 conversationId、目标/档案白名单补丁、basis、sourceRefs；更新 goal 与确实存在的相关 studyProfile/coach.profile/journey 字段，逐项沿用各自校验。完整且经确认的档案可在原会话首次写 studyProfile，缺必要科目时仍不写。 | 在同一 reducer 操作内验证并原子应用，不串行调用产生半份档案。不自动创建 coach/journey 或补科目。新目标优先复用 intake.accept；若来自已有对话的明确新目标，则经批准的 batch 使用 conversation.start + 必要 profile.set/goal.revise，来源会话仍可回跳。此 batch 需显式扩展白名单。 |
| Reminder | 同一 conversation.reminders，保留 v1；拟 `learning-reminder-v2` 继续 kind=study/review/recap，新增 `schedule:{mode:'once',date:'YYYY-MM-DD',time:'HH:mm',timezone}` 或 mode='weekly' 的重复日形式。保留 id/generation/version/enabled/at；拟一次性状态由事件投影 active/completed/cancelled，文案由 kind+目标生成。 | 候选 → 确认 → active → 用户完成/取消；到点未确认完成显示“已到时间”，不自动完成目标。拟 `reminder.complete/cancel` 留历史。重用 reminder.set 但按 contract 验互斥 schema；旧 v1 三类上限保持，拟 v2 每目标最多 20 条、按 ID 更新，一次性不挤掉旧学习提醒。通知回执保持原语义，不能代替完成。 |
| Idea | 同一消息 proposal，拟新增 type=`idea.keep`，data=`{text,conversationId,expiresAt}`；text≤500。id=该候选消息 ID，owner/basis/timezone/sourceRefs 仍属 proposal；拟 `proposal.resolve` 事件存 keep/dismiss/promote 及 targetEventId，状态从事件投影，不另建 ideas 数组。 | pending → kept / dismissed / expired；kept 可经新的计划建议确认 → promoted。pending 默认 14 日过期，过期只隐藏待办、不删源消息；kept 不自动过期。promote 必须与 plan.set 原子提交并保存关联，失败仍 kept。旧 profile/plan proposal 的 :accept/:dismiss 机制继续兼容，不强制改写历史。 |
| Memory | 沿 profile 条目 `{id,field,value,scope,source,evidenceIds,at}`；拟对新条目补 conversationId，来源和 supersedes 放变更事件。仅六字段，preference 承接如“先给例子”，不扩成任意正文仓库。 | pending → 确认 profile.set → active；同一 conversationId/field 新值 supersedes 旧条目，投影只取当前值，原记录留历史。拟 `profile.retract` 撤销继续使用，不等于抹除历史。真正隐私删除须覆盖事件/收据/候选/备份引用，另经现有隐私流程，不能只删当前投影。 |

Goal 修订与日期提醒需要在现有 reducer 中新增明确事件分支，这属于旧系统扩展，不是本阶段已实现能力。plan 的日期与目标归属须先收口：新 plan.set 保存 conversationId，并按 `(conversationId,day)` 选替换版本；旧 plan 不自动猜归属，保留“未归类”、原完成证据与原统计。Goal 的每日进度仍读 attempts/coach.days/recaps；没有总量证据不显示百分比。

## 5. 工具 schema 与确认门槛（拟议）

在现有 LEARNING_TOOLS/executeLearningTool 及 provider/Store 白名单中扩展以下四个工具；仍用原工具收据、取消与预算，不注册第二套 MCP 或工具引擎。以下为**精简 JSON Schema 约定**：每个参数对象及嵌套对象均 `type:object, additionalProperties:false`，required 如表；所有 string/array 有界。实际施工须生成完整 schema 并做前后端一致验证，本阶段不声称已有可运行定义。

| 工具 | 必填字段与参数约束 | 权限、返回与副作用 |
| --- | --- | --- |
| `entry.query` | required=[kind]；kind enum Goal/Reminder/Idea/Memory；可选 conversationId/id/status（各≤160）、limit 整数 1–50 默认20、cursor≤256、text≤200。status 按 kind 二次枚举；cursor 绑定 owner/scope/revision，失效即重读。 | read；本账户且限当前授权会话/明确的全部对话视图。仅返回有界对象、来源与状态；默认不返回原始答案/资料全文。访客仅本地。查询零事实事件；工具执行收据仍可存在。 |
| `entry.aggregate` | required=[kind,metric]；metric enum count/completed/due/submitted/assessed；可选 conversationId、from/to（有效 YYYY-MM-DD）、groupBy enum status/day/kind。metric 与 kind 做交叉允许表：count 可四类，completed 只 Goal/Reminder，due 只 Reminder，submitted/assessed 只 Goal。 | read；沿现有 summarizeLearning/museLearningInsights/reminderJobs 投影，输出分母/未知/证据范围；不同完成口径不混计。最多90日/100组，不支持自由 SQL、表达式或任意字段聚合。 |
| `entry.create` | required=[kind,fields,sourceRefs]；fields 为下表按 kind 的 oneOf；sourceRefs 1–3、confidence 0–1 可选。目标 conversationId 由宿主绑定，Goal 的新会话目标也须绑定原来源会话。 | learn，只创建待确认 message.proposal，返回 proposalId/status=pending，绝不返回“事实已建”。离线后台使用受控的候选写权限，只能写同结构候选。 |
| `entry.update` | required=[kind,id,patch,sourceRefs,basis]；patch 按 kind 的 oneOf，至少一项；basis≤160 或受限版本对象，禁止 owner/grade/completedBy 等补丁。 | learn；只创建带前态的修改/关闭/撤销建议。停止/归档状态不自动解除。模型不能传 explicit 或确认令牌来接受自己的建议。 |

`fields/patch` 的具体白名单（拟议）：

- Goal create：goal≤300、category 为 intake 既有 enum、exam 为既有 enum、subjects≤12×40、minutes/deadline/foundation 按 normalizeStudyProfile；未知为 null，必要科目未知不提交。update 允许 goal/minutes/deadline/foundation 及 action=pause/resume/complete/archive/reopen；exam/subjects 变化须重新确认教学配置，不自动迁移原训练。
- Reminder create：kind 为现有 enum、schedule 为 once/weekly 的互斥对象；once 要有效日期/时间/时区且解析成唯一合法时刻，weekly 沿原重复日校验。update 允许 schedule/enabled/action=complete/cancel。ID、generation、version 由宿主生成，不由模型决定。
- Idea create：text≤500；expiresAt 由宿主按默认14日设置。update 只允许 text 或 action=keep/dismiss/promote；promote 需另一个明确计划提案及有效 plan basis，不能隐式建任务。
- Memory create/update：field 为原六字段、value≤1000、scope 固定会话归属，source 由宿主判定；模型不可声明 observed/inferred 或伪造 attempt 证据。retract 走 action，不用空文本覆盖。

**确认入口**：复用 proposal 卡及 Store/Service 的明确采用动作；所有有效 Goal/Reminder/Memory 的创建、变更、完成/撤销，以及 Idea keep/promote 都须用户确认。模型提出的候选落盘只代表建议，不能参与有效事实统计。用户“帮我记住”“明天提醒我”先显示一张可编辑确认卡；取消只留取消历史，不安排通知。Reminder 确认保存与系统通知授权仍是两个独立步骤。离线候选不弹通知。

**幂等和并发**：宿主按 `owner + source conversation/message + kind + canonical field/slot` 产生稳定候选键；实时与回扫共用，不使用请求轮次/模型随机 ID。原文、目标归属与规范化字段的完整指纹必须同时比较，短 hash 不能作唯一证明；操作 ID 压缩到≤160字符的具体跨端算法待施工确定。再次出现同义表达先查有效对象及 pending/dismissed/expired 记录：无变化不生成事件，变更生成同对象 update 候选，歧义不合并。确认事件用稳定候选 ID 派生，保持同 ID 异内容冲突拒绝。语义近似不同来源导致的并发候选须在同一提交前态中二次查重，再经 CAS 重试。

## 6. 提取规则（拟议）

| 情形 | 规则与例子 |
| --- | --- |
| Goal | 第一人称、持续学习意图和可辨方向，如“我要准备考研英语一，重点写作”。只填明说字段；“考研”不足以推定英语/期限。不同目标不靠标题相似强合并。 |
| Reminder | 明确“提醒我/到时叫我”且有关学习；“明天20点提醒我练写作”依据源消息 at 与已保存时区解析，卡片展示绝对日期/时区。“晚上/考前”不明确则最多问一个必要问题。DST 重复时刻或不存在时刻须消歧，不能静默选一个。 |
| Idea | “先记一个想法：以后把错句做成卡片”可生成 Idea 候选；“有空也许试试”不自动提取，除非有明确保存意图。Idea 不等于承诺或任务，不抢占每日计划。 |
| Memory | “以后先给一个例子，再讲规则”可形成 preference 候选；“这道题先讲例子”是本轮教法，沿 userDirective，不升级长期偏好。“今天累”是临时状态，不写 foundation。 |
| 防过度提取 | 用户答案、资料/题干引用、转述他人、假设、否定、玩笑、模型自己的建议、跳过项不提取。最多每条用户消息3个候选；相同事实不同时创建 Goal 和一份内容相同的 Memory。 |
| 置信度 | 置信度只是候选优先级，不是授权。建议 ≥0.90 且证据与规则一致可展示候选；0.70–0.89 仅缺必要项才轻问一次；<0.70 不保存候选。纯规则路径也保留来源；模型自报高分不能绕过校验。阈值待离线标注集校准，未验证有效性。 |
| 同义合并 | NFKC、空白/标点规范化后比较；保留日期、否定、频率与考试一/二区别。只在同 owner/目标/type/field 比较，来源优先、语义相似仅提示关联。“改为21点”更新原提醒而非另建。 |
| 进度 | 实际 attempts/coach.answer/paragraph/review/finish/recap 收据驱动统计。用户说“我已经练完”只可提出用户自报的目标关闭或 manual task 完成，不创造评估、正确率、已复习或完成学习日。 |
| 保留历史 | 完成对象移到历史，原答、计划版本、旧提醒事件保留。Idea 到期不删除消息；dismiss/expired 同来源不被回扫复活，用户明确重新提出才新建。更正以替代/撤回事件实现，不改写历史计数。 |

## 7. 双路执行设计（拟议）

### 7.1 实时路径

用户明确发送 → 保存原 user message → 现有 userDirective/模型完整结果校验 → 四工具共同校验/去重 → `message.add` 保存候选 → 用户确认 → 原 reducer 原子写事实与业务收据 → Repository 落盘 → 明确同步时进原 learning_states。

沿用一次最多三个模型工具预算；不为每条闲谈另发第二次模型抽取请求。流式预览只展示文本，完整结果通过后才候选落盘。卡片按钮只调用宿主受限动作；失败或部分成功按事件收据呈现，不能引用模型“已记住”的文案作成功证据。没有必要参数时不强建对象。

### 7.2 离线回扫

- **周期建议**：未来受控后台每小时一次，首版默认关闭。首次仅从明确启用时间起扫描已同步记录，不自动全历史回填；需要历史补录时另行选择范围。设备未同步的消息只可在本机空闲时使用同一候选逻辑补扫，不授权云端抓取。
- **范围**：每次每用户最多50条新 user message、正文总计≤20000字符、最多3个候选；结合有界邻近上下文，只扫描真实已存原文，排除附件、答案/第三方引用、已删除资料衍生内容和已关闭目标。每轮最多20账户、30秒；限额是设计建议，待容量验收。
- **复用方式**：增加一个内部后台函数执行器，继续 `decodeServerHistory → 同一候选校验/reducer batch → encodeServerHistory → revision CAS`。不调用带 JWT 的公开接口伪造用户，不借 account-purge 的无 HTTP 上下文当通用鉴权。调度凭据须专用受控入口，不能暴露在 standalone 动态路由。
- **最小运行元数据**：拟在原 learning_states 文档增加非业务 `extraction` 元数据，含 enabled/consentVersion/cursor(anchorMessageId)/retryAt/attempts/leaseToken/leaseUntil/generation。它只记录扫描调度，不保存第二份消息、候选或记忆；cursor 用稳定消息 ID 与事件遍历顺序，不只按 at（晚同步旧消息不能漏）。当前不存在这些字段。
- **并发**：持久租约通过条件更新认领；写候选时同时检查 user_id、state revision、租约 token/未过期和 generation，候选状态与 checkpoint 在单文档一次提交。实时同步、删除、注销、撤销许可优先；revision 冲突重新读取，最多五次，过期执行器不写。所有写 state 的入口须保留并尊重 extraction 元数据；删云记录同时移除元数据。
- **去重**：两路用相同 source key 和有效对象查重规则；回扫见实时 pending/accepted/dismissed/expired 即推进扫描但不复制候选。不同消息的相同内容也以当前事实/候选二次去重。模型版本更新不得换 key 重建旧候选；人工重扫仍尊重拒绝记录。
- **失败/重试**：仅在候选批次成功或确定“无候选”后推进 cursor。短暂错误建议 1/5/30 分钟退避，最多3次；保持当前待处理窗口，显示/记录无正文错误状态，后续显式重试，不跳过失败消息。超时、取消、费用未知查询原 requestId，不重发模型。规则/业务不支持则作为无可提交候选，不无限重试。
- **费用/隐私**：默认只做本地确定规则补扫；若未来允许模型回扫，须有独立明确同意和现有平台/用户预算预留、成本账与结果查询，不从 BYOK Keychain/用户客户端偷取授权。本阶段不启用任何模型/服务/定时器。没有可用已授权服务端模型时保持关闭，不能以“离线”掩盖云费用。
- **可复用程度**：可借用现有内部函数、有限批次、共享 reducer、CAS、历史压缩；现有 cron 仅注释部署方式，尚不能直接复用“已运行的抽取定时任务”。实现/启用调度与真实生产写入须另行授权。

## 8. 第一个页面与验收脚本（拟议，未执行）

### 8.1 页面

选择现有 App `muse-workspace-pages.vue` 的 view=plan（「计划」，宿主页为 [archive/index.vue](../src/pages/archive/index.vue)，现有路径 `/pages/archive/index?view=plan`），不新增路由。旧 `/pages/plan/index` 仍有 LearningOverview/legacy 兼容分支，不将两者误认为同一组件。沿现有 Muse 外壳、来源对话筛选、卡片与列表扩展：上方先呈现“待确认”，主体按 Goal/Reminder/Idea/Memory 切换，默认看当前学习目标及下一项安排。390px 为单列卡片；大屏可用相同卡片分列，不另造图谱或拖拽看板。

数据来自 learning.state 的统一只读投影，分别读 conversations/profile/plans/reminders/messages.proposal/events；复用 museGoals 但补上无 coach 的目标，兼容旧未归类计划。每卡显示状态、时间、来源；目标进度有真实分母才出进度条，Memory 标“用户确认”，AI 反馈继续标“AI 评估”。历史折叠显示完成/取消/过期，不把它们混在待办数字中。

“查看来源”复用 `locateConversation(conversationId,null,null,messageId)` 并回主对话；缺失消息时降为可用会话，缺失会话则显示来源不可用，不猜 ID。新建/修订沿底部单输入框产生候选，不在四类卡片内增第二个长文本输入。采用、取消、保存各为明确动作，选择项只改草稿。浏览与筛选零事实写入（不把筛选改为目标选择）。官网仍只读同步进度，不增加教学/资料编辑与提醒设置入口。

### 8.2 示例对话与预期事实

隔离合成账户；冻结 `2026-10-22T10:00:00+08:00`、时区 Asia/Shanghai，不连接模型/通知/数据库；先用 fixture 输出走真实 schema、工具、reducer 和内存 Repository。

1. 用户：“我的目标是准备考研英语一写作，到2026年12月20日，每天20分钟。” → Goal 待确认卡，不先计入有效目标。确认后同一会话目标/档案可查询；deadline=2026-12-20、minutes=20，事件/状态保存且归属一致，不推算考试日期或官方分数。
2. 用户：“明天晚上8点提醒我练英语写作。” → 一次性 Reminder 候选明确展示 `2026-10-23 20:00 Asia/Shanghai`（对应 UTC 12:00）。确认后同一 reminders 中仅一条，mode=once；通知未授权时只标已保存，不声称已通知。
3. 用户：“今天天气真好，晚上想吃火锅。” → 无 Goal/Reminder/Idea/Memory 候选；允许普通 user/assistant message 事件，不要求总 events 数不变。
4. 用户：“先记一个想法：以后把我的错句做成卡片。” → Idea 候选；确认保留后为 kept，未生成 plan/task。另用冻结时钟推进15日验证未采纳候选 expired、已 kept 保留，源消息仍可回看。
5. 用户：“以后讲规则前先给我一个例子，请记住这个学习偏好。” → preference 候选；确认 profile.set，限定当前目标，不伪造 observed/inferred。
6. 重复投递第1/2条原消息、重复确认、实时处理后离线扫描同消息，再用另一条消息重复“明天20点提醒练写作” → 每个实际对象/候选只一份；同 ID 异内容返回 IDEMPOTENCY_CONFLICT。再说“改到21点”并确认 → 更新原 reminder ID、version/generation 变化，旧 job 点击无效。
7. 用户：“目标先暂停。”→ 明确确认暂停后无有效提醒任务；“我完成目标了”只记用户关闭状态且保留原答/小结，不增加可靠正确、已评估、复习完成数。

### 8.3 可执行验收脚本的施工清单

本阶段**不创建或执行未来脚本**。后续可在现有 tests/unit 中加入一份 `conversation-data-entry.spec.js`（拟名），使用已有测试栈/fixtures，不新增依赖；覆盖上述完整顺序，并增加以下断言：

- 确认前只新增 proposal；确认后检查原 state 路径和 `events.type/id/data/result`，从内存 Repository 重载相等；成功依据为业务事件与可读状态，execution.record 不足以验收。
- 使用现有 Mongo/mock 同步测试样式验证 push/pull、raw/gzip、分批恢复重放、相同 ID 重传、CAS 冲突、旧 v1 提醒兼容。Goal/Memory 原子修订中任一字段无效时全部不保存。
- sourceRefs 不属于当前用户/会话、伪造角色、引用题干/答案、否定/跳过、未授权工具/多余参数、低置信度、过期 basis 均不落有效事实。
- 回扫在提交前/提交后崩溃、租约过期、并行实时提取、注销/删除/撤回授权、迟到旧响应、断网/费用未知均不跨户、不复活、不跳过待处理失败消息、不重复调用模型。
- 查询/聚合与界面数字一致；不同会话同日 plan 不互相替换；旧未归类保留。Idea promote 失败不标 promoted，Memory retract 不继续注入。
- 后续页面改动需相关单测、H5/微信构建和主包2MB检查、390px实际操作；通知另做网页打开/无许可/macOS点击与旧 generation 验收。源码测试不能代替 App/微信真机，也不能替代生产部署检查。

未来命令示意：`YOZI_ISOLATED_BUILD=1 npm test -- tests/unit/conversation-data-entry.spec.js`。当前文件不存在，不能现在执行并声称测试通过。真实模型验证仅在后续授权与完整隔离条件下进行。

## 9. 未知 / 未确认与施工前置

1. 线上 learning_states 实际文档、索引、版本、字段分布、Laf trigger/cron 部署状态与运行时区：未接生产，未确认。旧 ai_friend_memory、learning_goals、study_plans 是否有当前用户数据或调用链，不作为本设计复用依据。
2. 当前已安装日常 App 与云端是否包含所读工作树的最新合同：未确认；没有更新 App、部署或发布。
3. plan.conversationId 缺口和多个 profile/studyProfile/coach/journey 表示之间的真实 UI 影响：源码已见不一致风险，未用真实账户重现。新写入必须统一归属与原子修订，旧记录不可猜测迁移。
4. Idea 是否要覆盖学习以外灵感、Memory 是否要跨目标共享：未获方向确认，建议首版只做学习范围/当前目标；任意通用记忆与个人助理提醒暂不扩展。
5. 四工具的最终命名、完整 machine schema、跨端稳定 ID 算法、对象查询 cursor 编码、扩展事件的旧端兼容门禁：尚未实现/验收，需下一阶段定稿，不可直接调用本报告中的拟名。
6. 回扫启用同意的存储位置/撤销交接、账户发现索引、持久租约、注销栅栏与 CAS 全写入口整合、平台模型成本合同：均未实现；无这些条件不启用后台模型任务。小时周期、50消息/20账户、阈值与14日过期均为可调设计值，未验证容量或准确率。
7. 一次性提醒的 macOS/网页适配、DST 重复时刻与权限拒绝/后台限制、移动/微信能力：未验收；保存提醒和真实送达分别报告。
8. 新的来源引用/Memory 撤回若涉及真正隐私删除，须覆盖当前状态、事件结果、候选与本机恢复副本；现有资料删除合同能提供模式，但不能宣称已有通用 Memory 隐私删除能力。
9. 本阶段仅文档验证：未执行模型、行为测试、构建、浏览器/真机或调度试跑。进程清单 `ps` 受当前工具权限限制；未启动服务、窗口、浏览器页或后台任务，未接管/停止共享资源，未删除历史材料。

## 10. 本阶段验证与交付

产出仅本报告及对应 job 的 RESULT.md；不修改源码、现有文档计划、任务板或审查日志，由路由方记录结果。已核对本报告相对路径和关键引用符号/事件，`git diff --check` 通过；新文档另外使用 no-index 检查，避免未跟踪文件被漏检。没有新增下载或依赖，downloads.json 无需变更。
