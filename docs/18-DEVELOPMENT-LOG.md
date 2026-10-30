# Yozi AI 开发日志（总监 × 执行侧）

目标与裁定见[当前计划第 0 节](13-DEVELOPMENT-PLAN.md)。本文件按轮记录：简报要点、执行侧交付、总监亲自验收结果、返工项。每轮只写事实；未亲自验证的标「未验」。

## 第 0 轮（2026-10-30）：定目标与通读

- 已通读：定版、外壳重构蓝图（Yozi 部分）、知识框架结构方案、当前计划、项目约定；Muse 2 的 README、项目状态、新会话交接提示词。
- Muse 2 现状（只读，不改其目录）：外壳主窗／聊天（U01、U04、U05）、右侧工件面板（M6）、设置窗结构（U02，部分）、导航下发（N1）、Feed／Ideas／Goals（M13–M16）、记忆基础（M2／M3）均为本地实现并验证；均未部署日常服务。语义记忆质量、静默内化、多端仍在推进。
- 沿用 10-27 基线：N1 写作主链未达标（混合摸底无据降档）；3 份基线测试 21 失败／18 未处理错误未重跑；知识框架 26 节点仅静态验证、无收据挂接。

## 第 1 轮 执行侧交付（2026-10-30）

- 事实：起点 `3f314e9f`；保留既有文档、`.collab/` 与客户材料。仅本地实现，未推送、部署、启动服务器或替换日常 App；平台模型、收费及短信保持关闭。
- 测试：隔离环境完整修前 **503 失败／472 未处理错误，5785 通过／37 跳过**；最终完整回执为 **178 失败／15 错误，6111 通过／37 跳过**（6326项，比修前新增1项空画布恢复回归）。修前 503 项逐条分类为真缺陷 195、合同落后 207、环境问题 101；其中 DOM 连带因果明确标为代码对照判断。原始 JSON／日志及每条失败、错误的来源与最近测试提示见[逐条清单](../tmp/qa-run/round1-test-triage.json)。不将 Vitest 的最近测试提示冒充已证实的因果归属。
- 修复：空 Canvas 上下文的头像异常；建档和本机错误被统一模型文案遮蔽；贴题写入中断后重试误记作答；过程／迁移题提前显示示范；设置重置跳转绕过导航守卫；Agnes 缺本地标志。测试夹具只按现行 BYOK、主题继承、分域存储及价格有效期修订，保留原业务断言、原超时和所有用例。
- 剩余判断：177项测试落后于现行合同、1项环境问题。旧文字动作／模型写事实权限、账户偏好请求、原子身份及旧界面夹具保留失败；冻结 engineering-v1 因已固定的源版本漂移仍失败，未静默重基线。15 个未处理错误均来自 crosswindow 旧夹具的会话撤销／读取取消，逐条列在清单；不宣称测试清零。
- 字数冲突：当前段落提示为「全文字数以题干为准」[`writing-coach.vue:431`](../src/pages/learning/components/writing-coach.vue#L431)。题干读自已保存每日包 `writing.prompt`；`WRITING_METHOD.words` 的小作文约100词常量仍保留但该提示不再读取。隔离 App 的 120–150 词题干与提示同屏，无第二套100词要求；本轮未把该合成题干当真题／大纲字数核验。
- 重开首次小结：正常退出并重开候选，首次点击即出现「正在整理反馈／正在生成…」，客户端发出 **1 次 `/proxy-ai`，phase=summary**，随后显示已收到结果／今日小结。入口 [`writing-coach.vue:482`](../src/pages/learning/components/writing-coach.vue#L482)，执行 [`conversation-learning.js:1684`](../src/stores/modules/conversation-learning.js#L1684) 的 `requestCoach`。本次为真实桌面 UI＋合成传输边界，未验证 App 经真实后端到模型的整链；现行客户端未复现旧问题，未为此另改源码。
- 混合摸底根因：旧题 q2 含无依据的 provide/give 优越性前提，模型把学生的有据否定当错；又把 q5 要点提纲追加为必须自拟时间地点。旧 prompt 虽有禁令，逐题缺作答形式，模型会先给低档再写评论。Agnes 修前首轮语法档1，却只有搭配错误，严格门禁在 `dimensions[0].score` 拒收；后两轮被接收但任务档1仍含语义误判。原样本为[旧五题](../tmp/writing-quality-20261027/legacy-teaching-cases.json)，未新增或挑选留出题。
- 最小修复：[`learning-writing-coach.js`](../laf-backend/functions/_shared/learning-writing-coach.js) 为逐题补 `answerFormat`，明确否定范围、提纲与成文边界、先登记真实错误再给档；[`learning-provider.ts`](../laf-backend/functions/_shared/ai-providers/learning-provider.ts) 保留同维同引用降档门禁，补 wire 字段路径、维度、封闭引用编号；[`proxy-ai.ts`](../laf-backend/functions/proxy-ai.ts) 仅透传白名单诊断元数据，不写学生正文或扩执行权限。

| 连续复跑 | 语法／搭配／表达／任务 | 各维引用（顺序同左） | 拒收 |
| --- | --- | --- | --- |
| 1 | 2／2／2／2 | q2,q3；q2,q3；q3,q4；q1,q2,q3 | 否 |
| 2 | 2／2／2／2 | q2,q3；q2,q3；q3,q4；q1,q2,q5 | 否 |
| 3 | 2／2／2／2 | q2,q3；q2,q3；q3,q4；q1,q2,q3 | 否 |

- 通道：**OpenRouter / `nvidia/nemotron-3-ultra-550b-a55b:free`**，实际型号回执一致；[官方精确免费路由](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free)。[三次原始回执](../tmp/round1-n1.noindex/mixed-after-nemotron-ultra.json)保留四维、逐字引用表、工具能力检查及本机零额预算记录，最终解码器[离线复验3次](../tmp/round1-n1.noindex/mixed-final-offline.json)均接收。仅运行现有提示／schema／解码／真实 BYOK 传输与内存预算，不宣称经过真实鉴权 HTTP handler／数据库。
- 同型号修前补跑1次为 **2／2／2／1，接收**，错误仍是要求认同词语优越性；[对照](../tmp/round1-n1.noindex/mixed-before-nemotron-ultra.json)保留，样本量不足以证明改动因果。Agnes 3.0 Flash 修后为 **2／2／2／1拒收、2／2／2／2接收、null／2／2／1拒收**；最终离线拒收分别定位语法/q1与任务完成/q1,q5，[失败回执](../tmp/round1-n1.noindex/mixed-final-agnes-offline.json)保留。GLM4.5/4.7严格JSON能力检查未过，Nemotron Super免费路由404，均停止；`.env` 的 iFlow 通道未调用。
- 未通过／未验：Agnes 仍语义不稳定；Ultra第3次表达评论出现「目的状语」，与原答的 aims 不定式补语分析不一致，不能把结构接收或满档等同讲解正确。留出样本由总监封存未碰；生成练习的答案独立校准、真实 App→后端→模型整链及最新大纲题干依据未在本轮完成；N1 总体验收仍未通过。
- 桌面自验：候选在 `tmp/round1-n1.noindex/Yozi AI.app`，独立测试账户／WebKit 域、合成传输。过程题提交前无示范、提交后出现；中断重试后实际存储 **1题／0作答**；已知本机错误准确可见。[App观察](../tmp/round1-n1.noindex/app-observed.json)。前端462模块、Tauri离线release及手工严格签名通过；重置的破坏性动作只跑隔离单测，未对 App 资料实际执行。

可原样重跑（仓库根目录，复用本机已有依赖；输出用新文件名以保留原证据）：

```sh
YOZI_ISOLATED_BUILD=1 rtk bypass npm test -- --reporter=default --reporter=json --outputFile=tmp/qa-run/round1-review.json
rtk bypass node laf-backend/standalone/node_modules/typescript/bin/tsc -p laf-backend/standalone/tsconfig.build.json --outDir tmp/round1-n1.noindex/backend-after
LEARNING_DNS_SERVERS=1.1.1.1 rtk bypass node scripts/eval/writing-mixed-replay.mjs --runtime tmp/round1-n1.noindex/backend-after --model nvidia/nemotron-3-ultra-550b-a55b:free --repeat 3 --output "tmp/round1-n1.noindex/mixed-review-$(date +%s).json"
rtk bypass node scripts/eval/writing-mixed-replay.mjs --runtime tmp/round1-n1.noindex/backend-after --model nvidia/nemotron-3-ultra-550b-a55b:free --replay tmp/round1-n1.noindex/mixed-after-nemotron-ultra.json --output "tmp/round1-n1.noindex/mixed-review-offline-$(date +%s).json"
open -n "tmp/round1-n1.noindex/Yozi AI.app"
```

- 输出事实：真实三轮均 `accepted`，最终离线重验 `calls:0`、3次accepted；Agnes离线重验退出2且带具体维度/引用。复跑脚本最多2次能力检查＋3次样本调用，只允许核验有效的精确零价型号，无回退；`LEARNING_DNS_SERVERS` 仅对该进程采用已有解析配置，SSRF/TLS/公网检查保持，未改系统DNS。官方零价依据另见[Z.ai](https://docs.z.ai/guides/overview/pricing)、[Agnes](https://wiki.agnes-ai.com/en/docs/pricing)；本机内存费用记录不冒充供应商账户账单核对。
- App复核：F8仅填已有合成带写步骤到小结前，正常退出重开后首次点生成；F9检查现有过程题示范；F10显示已有本机错误；F11准备一次中断，输入`题目：2x+3=9`后点发送两次。均仅存在隔离候选，不进入正式源码或日常入口。
- 收尾：本轮 App 进程正常退出、按完整路径注销成功（退出0），Spotlight仅返回 `/Users/blackdj/Applications/Yozi AI.app`；复用依赖与Cargo缓存，候选、旧样本、失败证据及必要修前运行时保留。未制造备份或删除用户资料；无已核验可丢弃的失败材料被清理。
- 附录：无新增运行依赖。Agnes静态SVG取自官方npm `@lobehub/icons-static-svg@1.95.1`，**MIT，996字节**，沿用现有许可文件，下载记入本机 `tmp/downloads.json`；未新增GPL/AGPL组件或需公开的程序范围。

## 第 2 轮 执行侧交付（2026-10-30）

**事实：通用作答形式、单维归因和一次有界返修已实现；桌面拒收恢复已实走。判断：混合摸底语义质量未达标，N1 未通过。**

- 裁定 1：`learning-writing-coach.js:35,350` 按题型取通用作答形式，填空是否需理由只看题干，不再含 provide/give 或自拟时间地点的旧题前提。测试「同类换题仍使用通用作答形式，不引入旧题词汇与理由要求」。
- 裁定 2：同文件 `33,62,669` 将一处错误只归一维写入量规与提示：固定搭配介词／动词归搭配，时态／一致／从句结构归语法，中文分析判断错归任务完成；独立规则分别登记。解码器 `learning-provider.ts:773` 新增同一错误片段重复登记拒收，原同维同引用降档门禁保留。测试「同一处搭配错误换维度登记仍被拒收，两个独立错误可分别登记」和四项「无登记错误的%s降档必须拒收」。
- 裁定 3 选择 **(a)**：复用现有独立费用收据／幂等框架，只为五项混合摸底开放一次返修；宿主原样返回拒收规则、路径、维度、引用及已检查的前次数据，第二次失败不保存半截结果。理由：现有框架可复用，同时保留模型按量规判断与严格门禁；宿主推档也不能纠正错误清单中的语义误判。入口 `proxy-ai.ts:275,820`，返修上下文 `learning-provider.ts:929,966`；收到 HTTP 却未返回教学工具时也保留用量收据（`1563`），不丢费用再重试。
- 定向验证：受影响 202 项通过；后续传输／核价 49 项通过、撤回试验参数后的价窗 1 项通过（有交叠，不累加）。`mixed diagnostic bounded repair` 覆盖成功、缺工具、再次拒收、返修限流及密钥回显；`byok-store.spec.js:180` 证明五份原答保留、失败意图关闭、无半截反馈并可明确重试。
- 全量护栏：最终冻结全量 [原始回执](../tmp/round2-n1.noindex/full-test-final.json)为 6,335 项、6,120 通过、178 失败、37 跳过；[逐 ID 比对](../tmp/round2-n1.noindex/full-test-final-comparison.json)为原有 178、**新增失败 ID 0**、消失 0。本轮改动的五份测试文件共 203 项全部通过。另有 16 个未处理错误，其中新增 `desktop-window-intake.spec.js` 工作进程启动超时，使该文件 5 项未执行；该文件[单独补跑](../tmp/round2-n1.noindex/worker-recheck.json)5／5 通过。**测试 ID 护栏零新增，但未取得一次覆盖全部 6,340 项的完整全量回执**，不把补跑合成为单次全量通过。首份 [全量](../tmp/round2-n1.noindex/full-test.json)190 失败／15 错误、[比对](../tmp/round2-n1.noindex/full-test-comparison.json)新增 12：运行中撤回试验参数，1 项出现缓存／预期不一致，另有 10 项长耗时失败及 1 项界面断言，未提前归因为环境；[第二份冻结全量](../tmp/round2-n1.noindex/full-test-frozen.json)185 失败、178 旧 ID 加 7 项新超时，这 7 项[按原断言／原时限定向复验](../tmp/round2-n1.noindex/regression-targeted7.json)全部通过。全部原始失败保留。
- 比对脚本 [compare-test-failures.mjs](../scripts/eval/compare-test-failures.mjs) 使用「仓库相对文件＋Vitest 完整测试名」及重复次数逐项匹配；同数不同 ID 自验能检出新增与消失各 1 项。不改第 1 轮清单，不改原断言／超时。

开发样本由执行侧原创，位于 [samples/](../tmp/round2-n1.noindex/samples/)：`library-correct.json`（全对及仅可选风格），`cycling-preposition.json`（介词错、仅填词），`robotics-modifier.json`（从句修饰对象错），`gardening-attribution-style.json`（介词归因及正确译文不降档）。[合并输入](../tmp/round2-n1.noindex/samples/development-and-legacy.json) 含四套新样本和原旧样本；开发预期只用于离线对照，不发给被测模型。封存题未读取、猜测或复原。

本轮统计参考暂用 **Agnes 3.0 Flash**，因为官方零价、能力往返可用且能返回评阅；**它未取得合格平台参考模型资格**。最终五套各尝试 3 次，4 次结构接收、1 次最终拒收、10 次限流；只有 1 次错误登记位置与开发预期一致，不能据此认定讲解正确。原文引用、每次登记错误、拒收规则和两个尝试分别保存在 [最终原始回执](../tmp/round2-n1.noindex/reference-agnes-final.json)；`—` 表示无完整可用反馈，拒收原值仍保留在 raw。下表的「接收」只指结构／证据门禁，不指教学质量。

| 开发样本／次序 | 四维（语法／搭配／表达／任务） | 登记错误的引用／维度 | 终态／返修 | 延迟秒 |
| --- | --- | --- | --- | --- |
| library-correct #1 | — | 见原始回执 | rejected/COACH_INVALID／是 | 27.83 |
| library-correct #2 | 2／2／2／2 | 无 | accepted／否 | 7.78 |
| library-correct #3 | 2／1／2／1 | q3/搭配；q5/任务完成 | accepted／是 | 19.47 |
| cycling-preposition #1 | — | 见原始回执 | failed/RATE_LIMITED／是 | 12.79 |
| cycling-preposition #2 | — | 见原始回执 | failed/RATE_LIMITED／否 | 0.65 |
| cycling-preposition #3 | — | 见原始回执 | failed/RATE_LIMITED／否 | 0.67 |
| robotics-modifier #1 | — | 见原始回执 | failed/RATE_LIMITED／否 | 0.75 |
| robotics-modifier #2 | — | 见原始回执 | failed/RATE_LIMITED／否 | 1.14 |
| robotics-modifier #3 | — | 见原始回执 | failed/RATE_LIMITED／否 | 0.72 |
| gardening-attribution-style #1 | — | 见原始回执 | failed/RATE_LIMITED／否 | 0.66 |
| gardening-attribution-style #2 | — | 见原始回执 | failed/RATE_LIMITED／否 | 0.82 |
| gardening-attribution-style #3 | — | 见原始回执 | failed/RATE_LIMITED／否 | 0.65 |
| legacy_provide_give_analysis #1 | — | 见原始回执 | failed/RATE_LIMITED／否 | 0.79 |
| legacy_provide_give_analysis #2 | null／1／2／2 | q1/任务完成；q2/搭配 | accepted／否 | 12.85 |
| legacy_provide_give_analysis #3 | 2／2／2／1 | q1/任务完成；q2/任务完成 | accepted／否 | 10.98 |

| 实测型号／价格依据 | 本轮尝试次数（含能力检查、失败与返修） | 单次调用耗时范围（含失败） | 结论 |
| --- | --- | --- | --- |
| [Agnes 3.0 Flash](https://wiki.agnes-ai.com/en/docs/pricing) | 43 | 0.60–22.33s | 误判正确分析／译文，且限流；不合格 |
| [Dots3-Note :free](https://openrouter.ai/dots-studio/dots-3-note-preview:free) | 19 | 2.93–60.79s | 默认推理超时；关闭可选推理的失败试验产生漏判及结构拒收，已撤回该参数，不带入产品 |
| [Gemma 4 26B :free](https://openrouter.ai/google/gemma-4-26b-a4b-it:free) | 1 | 0.51–0.51s | 能力检查限流，未进入教学评测 |
| [Nemotron 3 Ultra :free](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free) | 3 | 2.55–51.65s | 异族裁判确认早期 Agnes 全对样本的两处误判；其余裁判覆盖未完成 |

- 核价：OpenRouter 每次进程先核对[官方精确目录](https://openrouter.ai/api/v1/models)全零价格，不允许付费别名／切换；Agnes 以当日官方零价页及有效期配置为据。共 **66 次模型调用尝试**，不是供应商确认的实际接收次数；各进程结束保存调用账本及日计数。最后 OpenRouter 回执 **51／50，剩余 0**；后续裁判调用在发出前被拦，实际新增 0 次。[日限额与失败回执](../tmp/round2-n1.noindex/judge-ultra-cycling.json)保留。额度恢复前不再调用，不启用付费。
- 完整失败试验也保留：[Agnes 前一轮 15 次](../tmp/round2-n1.noindex/reference-agnes.json)、[Dots 有界试验](../tmp/round2-n1.noindex/reference-dots.json)、[Ultra 异族裁判](../tmp/round2-n1.noindex/judge-ultra-library.json)。Dots 16 次预算用完，后续轮次未完成；没有把预算耗尽／空结果算接收。
- 超时仍为上游 **60s**，由 `learning-runtime-policy.js:29 learningTimeout({coach})` 与 `proxy-ai.ts` 的教学 60000ms 决定；客户端教学 70s 是传输等待（`learning.api.js:61`），不是模型上游时间。能力检查按产品上游 30s；未放宽超时换通过。
- 桌面 App：`tmp/round2-n1.noindex/Yozi AI.app`，独立身份与 WebKit UUID、合成账户／传输；真实界面逐项输入并提交五题，注入两次生产解码器拒收后界面显示现有「回复校验未通过，原答已保留，可重新评估」，反馈为空、五答保留、失败请求关闭；点击既有「重新评估」后得到 **2／1／2／2** 与唯一搭配错误，计数 5 已评估／0 待评估，五答逐字保持。[拒收截图](../tmp/round2-n1.noindex/app-rejected.jpg)、[恢复反馈](../tmp/round2-n1.noindex/app-feedback.jpg)、[已评估计数](../tmp/round2-n1.noindex/app-assessed.jpg)、[状态与请求回执](../tmp/round2-n1.noindex/app-observed.json)保留。夹具先后修正登录保存未 await、相对 URL 解析；均只改忽略目录。临时原生 QA 主 crate 为 opt-level=0，不作发布性能结论。
- 资源：本轮 App PID 28209 已正常退出并注销；两份失败的中间 App 包经 FileManager 正常移入废纸篓，文件大小合计 **47,122,278 字节**，未清空；当前候选、源快照、样本和回执保留。复用既有 npm／Cargo／TS 依赖。日常入口哈希仍为 `2e85d945…`；系统应用清单中的外壳并行候选仍运行，按约定保留其入口，不操作该工作树。[归属与回收记录](../tmp/round2-n1.noindex/resources.json)。
- 边界：无新依赖或新增许可证公开范围；未启动独立服务器，无付费、短信、推送、部署、日常 App 替换或小程序构建或端侧验收；未修改外壳线文件、Muse 2、Lazy AI 或其他 worktree。既有用户未提交文档与材料保留。
- **未完成／未验证**：语义泛化和每套连续三次有效完整评阅未达标；合格平台参考模型未选定；最终样本的完整异族裁判覆盖未完成；单次全量仍有工作进程启动错误，未取得完整 6,340 项回执；封存题由总监验收；真实 App→鉴权 HTTP→数据库→真实模型整链未验证。本轮原生自验不替代该整链，也不作为手机端验收。

复跑（仓库根目录；沿用现有依赖，免费额度可用时才有有效模型结果；`--sample` 可换为 tmp 内任意同格式的单套或多套数组，`--case` 可选某套；遇限流停止后续轮次并登记未跑）：

```sh
R2_REVIEW_ID=$(date +%Y%m%d-%H%M%S)
rtk bypass node laf-backend/standalone/node_modules/typescript/bin/tsc -p laf-backend/standalone/tsconfig.build.json --outDir tmp/round2-n1.noindex/backend
YOZI_ISOLATED_BUILD=1 rtk bypass npm test -- --reporter=default --reporter=json --outputFile=tmp/round2-n1.noindex/review-tests-$R2_REVIEW_ID.json
rtk bypass node scripts/eval/compare-test-failures.mjs --baseline tmp/qa-run/round1-test-triage.json --report tmp/round2-n1.noindex/review-tests-$R2_REVIEW_ID.json --output tmp/round2-n1.noindex/review-compare-$R2_REVIEW_ID.json
LEARNING_DNS_SERVERS=1.1.1.1 rtk bypass node scripts/eval/writing-mixed-replay.mjs --runtime tmp/round2-n1.noindex/backend --sample tmp/round2-n1.noindex/samples/development-and-legacy.json --model agnes-3.0-flash --repeat 3 --output tmp/round2-n1.noindex/review-live-$R2_REVIEW_ID.json
rtk bypass node scripts/eval/writing-mixed-replay.mjs --runtime tmp/round2-n1.noindex/backend --sample tmp/round2-n1.noindex/samples/development-and-legacy.json --model agnes-3.0-flash --replay tmp/round2-n1.noindex/reference-agnes-final.json --output tmp/round2-n1.noindex/review-offline-$R2_REVIEW_ID.json
```

离线命令不读凭据、不联网，只重验保留输出的门禁；不能替代语义正确性或有效连续复跑。真实模型脚本不启动服务器／数据库，不写学习事实；返修最多一次，预算包括能力检查和返修，密钥只通过 `readFreeApiCredential` 在内存读取。
