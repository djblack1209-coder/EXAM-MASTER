# 产品定位与项目讲解

> 2026-09-13：面向 AI 应用开发岗位的公开作品展示。以下区分现有代码、已验证行为和后续目标；历史商业化设想不作为当前产品能力。

## 产品定位

EXAM-MASTER 面向考研公共课练习，将资料处理、题库加载、答题反馈与间隔复习组织为一个学习工作流。资料侧使用 Python 处理 PDF 与结构化输出；客户端使用 Vue 3 / uni-app、Pinia；TypeScript 后端模块负责身份、答题和 AI provider 等职责。

当前最适合展示的是可复现的本地学习路径，以及「AI 生成之后，如何确认内容可用」的工程设计。在线模型调用、完整内容发布和商业运营需要独立证据，不能从页面数量或测试数量推导。

## 三分钟项目讲解

以下是讲解顺序，请按自己实际承担的工作表述；不要把整个仓库的历史工作都说成个人独立完成。

| 时间 | 展示内容 | 可以展开的技术点 |
| --- | --- | --- |
| 0:00–0:30 | README 的用户问题和工作流 | 为什么选择资料 → 题目 → 反馈 → 复习这个范围 |
| 0:30–1:15 | 本地 H5 示例，故意答错一题再完成 | 判分、解析、本地记录，以及示例内容的明确标记 |
| 1:15–2:15 | PDF 管线与答案证据质量检查 | 分批处理、缓存、失败重试、候选状态、文本哈希和发布阻塞 |
| 2:15–2:45 | provider 工厂与隔离测试 | 配置化供应商、响应校验、故障切换；隔离测试无法证明真实供应商可用 |
| 2:45–3:00 | 当前限制和下一步验收标准 | AI 代理入口待补齐、固定评测集、真实后端与微信设备验收 |

建议演示环境先用独立浏览器配置，以免覆盖自己的学习数据。完整启动步骤与截图见 [README](../README.md)。

## 可以支撑的工程亮点

| 主题 | 证据 | 表述边界 |
| --- | --- | --- |
| AI 资料处理 | [pdf2flashcard-v2.py](../scripts/pipeline/pdf2flashcard-v2.py) | 具备生成缓存、批次与调用额度机制；没有实测费用数据时，不写节省百分比 |
| 输出质量控制 | [flashcard_quality.py](../scripts/baidu/flashcard_quality.py)、[answer_evidence_repair.py](../scripts/baidu/answer_evidence_repair.py) | 候选答案不能自动视为核验完成；哈希关联不等同于内容正确或使用授权 |
| 多供应商抽象 | [provider-factory.ts](../laf-backend/functions/_shared/ai-providers/provider-factory.ts) | 不宣称训练模型、原创 FSRS、完整 RAG 或已上线 Agent 系统 |
| 学习数据闭环 | [study-engine.js](../src/stores/modules/study-engine.js)、[fsrs-service.js](../src/services/fsrs-service.js) | 本地规则和统计建议有独立价值，但不包装成模型推理 |
| 服务端写入约束 | [answer-submit.ts](../laf-backend/functions/answer-submit.ts) | 鉴权、限流和幂等行为需结合测试；线上恢复还要真实数据验收 |

面试中可讨论的取舍：为什么复用 FSRS；为什么先离线加工再加载题库；为什么质量不足时应保持阻塞；为何共享客户端服务层；为什么 H5 构建不等于微信验收。

## 当前分析与完善顺序

| 优先级 | 问题与影响 | 验收标准 |
| --- | --- | --- |
| P0 | `proxy-ai` / `proxy-ai-stream` 仅有 YAML 元数据，缺少对应 TS/JS 入口；不能宣称在线 AI 完整可用 | 确认源码归属、恢复入口，验证真实请求、流式结束、超时、错误响应与鉴权 |
| P0 | 题库报告有 14 个覆盖缺口、7 个来源证据缺口；公开发布仍阻塞 | 每个缺口有可追溯题源及答案证据，并通过现有 release gate |
| P0 | 生产数据恢复与设备验收仍待复核 | 使用真实数据、受保护恢复事务和独立业务探针；完成微信隐私、登录与分包实机路径 |
| P1 | 缺少固定 AI 评测集与成本记录 | 按同一输入集记录结构化成功率、答案一致性、人工修正量、延迟和费用；保留模型与 prompt 版本 |
| P1 | 初次访问缺少示例入口，README 与许可表述冲突 | 本轮补 H5 本地演示、真实截图、源码导览，并按维护者决定标记为公开作品、暂不授予开源许可 |
| P2 | 历史文档存在旧模块清单、固定测试数和过时部署叙述 | 以当前路由、源码和本次验证为准，按实际维护范围逐步更新 |

该分析以本地代码、GitHub 元数据和本轮测试为依据。没有执行生产写入、真实供应商付费调用或真实微信设备操作。

## 成熟工具与自建价值

[Anki](https://github.com/ankitects/anki) 已经提供成熟的间隔复习产品；[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 提供可复用的调度库。项目应复用这些基础能力，把自建工作放在考研整卷与篇章交互、资料处理、证据状态、题目呈现和学习记录的衔接上。

如果使用者只需要通用闪卡，采用成熟工具通常足够。本项目值得继续投入的前提，是能通过实际体验与评测证明专门的资料工作流有价值。目前没有用户留存、学习效果或竞品性能对比数据，不宣称优于现有产品。

## GitHub 展示与传播

- 首页保持「产品问题 → 实际截图 → 启动方式 → 关键源码 → 已知边界」顺序，让访客能快速判断项目是否相关。
- About 建议使用：`AI-assisted study workflow · PDF → flashcards, answer evidence checks & FSRS review · Vue 3 / TypeScript / Python`。
- Topics：`ai-application`、`education`、`exam-preparation`、`flashcards`、`fsrs`、`spaced-repetition`、`vue3`、`uni-app`、`typescript`、`python`。
- 分享预览图为 [social-preview.png](assets/social-preview.png)，尺寸 1280 × 640；[cover.svg](assets/cover.svg) 为可编辑源。GitHub 支持在仓库 Settings 的 Social preview 上传图片，见 [GitHub 官方说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)。
- 分享时选择一个可验证的技术故事，例如「为什么 AI 输出有答案仍被门禁拦住」，附短演示和对应源码。不要以测试数量或未经测量的效率数字代替成果。
- 固定评测与后端验收完成后，再考虑独立公开 Demo；当前不将历史生产域名当作已验收体验入口。

README、标签和截图能改善项目可读性与被发现的机会，但 Star 增长需要持续的技术内容与实际使用反馈，不能承诺数量。

## 许可、内容与商业化边界

维护者本轮选择暂不授予开源许可，仓库用于公开作品展示，根包标记 `UNLICENSED`。第三方依赖保留原许可；不得将题库、PDF、图片或资料的公开可访问性当成使用授权。

商业化仍是待评估方向。先明确内容和代码授权、完成核心流程、建立人工核验与质量指标，再验证真实用户需求、留存、调用成本及服务维护负担。当前没有已验证的收入、定价实验、单位经济模型或付费客户证据。
