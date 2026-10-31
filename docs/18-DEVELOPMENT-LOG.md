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

## 呈现第 1 批（模块 P，Codex）执行侧交付（2026-10-30）

- **模块／归属**：P／Codex；指定工作树与 `codex/yozi-progress-1-20261031`，基于 `d2ef4cf8`。已读主工作树第0／0.1／N3／#7及末两轮验收；未改G收据、后端批改链、S壳层或令牌。
- **读模型**：`learning-progress-read-model.js` 纯投影返回 `subjects[{accuracy,dimensions,questionTypes}]`、`nodes`、`weaknesses`、`evidence`、按来源／连接ID分开的 `sources`、`mindMap` 和 `platformReference`。分子／分母各有事件ID列表，节点另有样本、等级依据与错误事件ID；来源条目含时间、题目、结论、原记录ID，不返回学生原答或错误引文。
- **口径**：`MIN_PROGRESS_EVENTS = 5`；不足5个有效独立事件时 `status: insufficient`，百分比／等级为null。仅可靠、无提示、每题不重复的客观作答计正确率；写作显示既有「AI评估／达成本次要求」的量规达标占比，不把0／1档称为答错，不输出「已掌握」。混合摸底一张收据只算一个样本；失败、拒收、缺绑定、空证据、null档和已替换反馈不计。节点等级是最近支撑收据相关维度的最低档，不是预测性掌握；阈值与结论仍待N3校准。
- **映射表**：同文件 `PROGRESS_NODE_RULES` 按维度、精确能力标签和单任务题型映射到现有种子；语法→sentence、主谓一致→agreement、搭配→collocation、任务完成→task、中译英→translation。表达没有对应通用节点，只按明确标签／任务定位；不扫描原答关键词，不把混合摸底档位散发给每道题；未知标签留在四维汇总。BYOK沿已保存的 `byok_` 连接ID标源，未知历史ID保持待核对；收据没有型号版本，个人观察均不进入平台参考结论，`platformReference` 保持数据不足。
- **展示／范围外**：框架叠加等级与薄弱点、详情列支撑事件，点「查看原答」只读打开准确的原记录；思维导图同源，只选节点看详情，不提供拖拽、作答或写事实入口。复用现有按钮、弹窗、SVG布局和令牌，无新依赖。范围外仅 `src/services/learning/website-progress.js` 加投影字段、`src/components/business/website/website-workspace.vue` 导入并挂载组件，**各2行**；官网关闭原答入口，不显示误解原话；未改官网布局或路由，供总监与S线集成时核对。
- **全量事实**：隔离全量 **6366项：6151通过、178失败、37跳过**；使用主树原版比较脚本和第1轮清单的本地副本按精确测试ID／重复次数比对，**新增失败0**，178项既有失败全复现（[比对](../tmp/progress-1.noindex/comparison-final.json)、[JSON](../tmp/progress-1.noindex/full-tests-final.json)、[日志](../tmp/progress-1.noindex/full-tests-final.log)）。15项未处理错误按文件＋最近测试提示＋消息的多重集合与清单一致，无新增；提示不是因果归因。首轮4项新增经旧格式缺字段修复、补全后端依赖链接及串行复验消除；首轮证据保留，未放宽断言或超时。
- **局部验证**：读模型23项、展示／框架9项均通过；最后边线样式修正后展示／框架9项再验通过（[JSON](../tmp/progress-1.noindex/final-ui-tests.json)）。ESLint、Prettier、`git diff --check`通过；桌面467模块、官网261模块构建通过，桌面公开产物检查和原生候选严格签名通过。原生QA仅主crate为opt-level=0，不作发布性能结论。
- **桌面实操**：独立bundle ID `cn.wangshiliang.wenli.qa.progress1`、WebKit UUID、合成账户与离线传输；空数据四维／26节点均为数据不足，无百分比（[空态](../tmp/progress-1.noindex/app-empty.png)）；6条收据／6次客观作答出现67%／83%且可展开（[统计](../tmp/progress-1.noindex/app-metrics.png)、[来源](../tmp/progress-1.noindex/app-evidence.png)）；receipt-5打开准确的 `coach:writing-answer-5` 原答（[原记录](../tmp/progress-1.noindex/app-original.png)）；薄弱点在框架可见（[框架](../tmp/progress-1.noindex/app-framework.png)）；导图同等级、无作答编辑入口（[导图](../tmp/progress-1.noindex/app-mind-map.png)）。
- **官网实操**：390px独立浏览器上下文，模拟现有只读云端返回；空态无百分比，足量指标可展开6条写作／6条客观来源，不出现原答或「查看原答」，宽度始终390、无横向溢出（[空态](../tmp/progress-1.noindex/h5-390-empty.png)、[统计](../tmp/progress-1.noindex/h5-390-metrics.png)、[来源](../tmp/progress-1.noindex/h5-390-evidence.png)、[读回](../tmp/progress-1.noindex/h5-observed.json)）。未声称真实同步或N3预测性准确率通过。
- **未验／文案**：手机App未验，未找到本批可用的uni-app原生运行基座（未安装HBuilderX；已有ADB／Xcode组件不构成完整运行链）；未启动iPhone工具，小程序未构建未验。待批文案候选：**无**，复用既有文案及简报明确的「数据不足／正确率／思维导图」。
- **资源／边界**：复用主树前后端依赖链接，不重装；独立Cargo临时副本已回收 **2,558,490,097字节逻辑大小**，不等同于实时可用空间。旧候选正常移入废纸篓 `~/.Trash/before-node-style.noindex/`，未清空；当前候选、隔离原生源码、重跑脚本、截图和报告保留。App正常Cmd+Q退出并按完整路径注销，系统搜索仅保留日常入口；只停本批预览PID，测试页回空白、隔离上下文关闭、UI锁释放（[资源](../tmp/progress-1.noindex/resources.json)）。无下载、付费、真实模型调用、短信、推送、部署、合并或日常App替换，主树／S线进程及历史恢复材料未动。

复跑（本分支工作树；输出文件须未存在，避免覆盖交付证据）：

```sh
cd '/Users/blackdj/Desktop/.worktrees.noindex/yozi-progress-1'
YOZI_ISOLATED_BUILD=1 rtk bypass npm test -- --reporter=default --reporter=json --outputFile=tmp/progress-1.noindex/retest.json
rtk bypass node '/Users/blackdj/Desktop/Yozi AI/scripts/eval/compare-test-failures.mjs' --baseline tmp/progress-1.noindex/round1-test-triage.json --report tmp/progress-1.noindex/retest.json --output tmp/progress-1.noindex/retest-comparison.json
YOZI_ISOLATED_BUILD=1 rtk bypass npm run build:desktop:web
YOZI_ISOLATED_BUILD=1 VITE_API_BASE_URL=https://progress-qa.invalid rtk bypass npm run build:h5
rtk bypass node tmp/progress-1.noindex/prepare-native.mjs
test -d tmp/progress-1.noindex/cargo-target || /bin/cp -cR '/Users/blackdj/Desktop/Yozi AI/src-tauri/target' tmp/progress-1.noindex/cargo-target
(cd tmp/progress-1.noindex/native && CARGO_TARGET_DIR="$PWD/../cargo-target" CARGO_NET_OFFLINE=true YOZI_ISOLATED_BUILD=1 rtk bypass node ../../../node_modules/@tauri-apps/cli/tauri.js build --ci --no-sign --bundles app)
/usr/bin/codesign --force --sign - --timestamp=none 'tmp/progress-1.noindex/cargo-target/release/bundle/macos/Yozi AI.app'
/usr/bin/codesign --verify --deep --strict 'tmp/progress-1.noindex/cargo-target/release/bundle/macos/Yozi AI.app'
open -n 'tmp/progress-1.noindex/cargo-target/release/bundle/macos/Yozi AI.app'
```

候选内Ctrl+Alt+E／F切换空态／足量样本；验完正常退出，对实际启动的完整`.app`路径执行`lsregister -u`。官网用 `python3 -m http.server 39137 --bind 127.0.0.1 --directory dist/build/h5` 本地静态预览；`tmp/progress-1.noindex/h5-acceptance.js`交给现有Playwright的`browser_run_code_unsafe(filename)`，脚本会建隔离上下文、模拟只读返回并自行关闭。候选与临时输出始终放在本工作树`.noindex`目录。

## 呈现线第 2 批 执行侧交付（2026-10-30）

- **模块／归属**：P／Codex；仅本工作树 `codex/yozi-progress-1-20261031`。已先读主工作树计划0.1（含接口登记）及第1批总监验收，无冲突合入 `c61dfd8f`（合并提交 `800dc6f0`）；后续未改G或S文件、其他工作树或日常App。
- **门槛修复**：节点先检查5个有效收据样本，再计算等级；不足时等级为null、薄弱点为false、薄弱点事件编号为空。科目比例、节点、薄弱点列表、来源分组和导图高亮的4／5边界一致，原始支撑事件仍可只读追溯。
- **第3轮收据**：只按最终 `errors[].label` 和错误类 `weaknessEvidence` 定位；不从汇总标签、`errors[].rule` 文本、旧反馈或复核内部恢复已删错误。`scorePolicy` 与 `coachVerification` 不参与推断，后者用禁止读取属性的代理验证其不透明性；第1／2轮缺少新增字段仍可读取。既有null过滤保持，测试覆盖科目／来源维度、题型达标率及全null收据不入分母。合成收据每张含核对3／删除2计数，均未变成额外样本或薄弱点。
- **文案／N4**：未发现既有节点「已掌握」结论，但页面两处含「掌握标准」，已改用现有「节点详情」并删冗余空态说明；视图后备文字改用现有「待审核」。遍历所有26节点、详情、证据、导图及0／4／5／6样本的渲染测试不含「掌握／mastered」。只更正 `17` 第3行的页面／Store只读接入现状，未改其他计划文档。
- **测试事实**：定向 **39／39通过**；ESLint、Prettier、`git diff --check`通过。隔离全量 **6388项：6173通过、178失败、37跳过**，逐文件＋完整测试名＋重复次数比对 **新增0／既有178／消除0**；15个未处理错误按文件＋最近测试提示＋消息的多重集合也无新增，提示不作因果归因。[全量JSON](../tmp/progress-2.noindex/full-tests.json)、[日志](../tmp/progress-2.noindex/full-tests.log)、[逐ID比对](../tmp/progress-2.noindex/comparison.json)、[错误比对](../tmp/progress-2.noindex/unhandled-comparison.json)、[定向JSON](../tmp/progress-2.noindex/targeted-tests.json)。比较器拒绝跨工作树绝对基线路径（原始失败日志保留）；未改G脚本，改用与指定主树原件经 `cmp` 逐字一致的本树tmp副本。
- **构建事实**：隔离桌面467模块、官网261模块及离线锁定原生候选构建通过；桌面公开产物检查、候选严格签名通过。候选为 `tmp/progress-2.noindex/Yozi AI.app`，独立bundle ID／WebKit UUID、合成账户与离线传输；临时宿主仅主crate opt-level=0，不作发布性能结论。

| 桌面实际状态 | 观察结果 | 截图（同目录保留AX全文） |
| --- | --- | --- |
| 4次 | 比例与节点均数据不足；无薄弱点和导图高亮 | [指标](../tmp/progress-2.noindex/app-four-metrics.png)、[框架](../tmp/progress-2.noindex/app-four-framework.png)、[导图](../tmp/progress-2.noindex/app-four-mind.png) |
| 5次 | 语法0／5；主谓一致为「可改进 · 薄弱点」，框架与导图一致 | [指标](../tmp/progress-2.noindex/app-five-metrics.png)、[框架](../tmp/progress-2.noindex/app-five-framework.png)、[导图](../tmp/progress-2.noindex/app-five-mind.png) |
| 第3轮含复核删除 | 保留的主谓一致／冠词有高亮；已删时态节点无记录、无薄弱点；搭配5／5，表达因仅3条非null显示数据不足 | [指标](../tmp/progress-2.noindex/app-round3-metrics.png)、[框架与已删节点](../tmp/progress-2.noindex/app-round3-framework.png) |
| 旧收据 | 缺rule／scorePolicy／coachVerification仍正常显示5条来源与等级 | [指标](../tmp/progress-2.noindex/app-legacy-metrics.png)、[框架](../tmp/progress-2.noindex/app-legacy-framework.png) |

- **官网390px**：四态均无横溢，来源条数为4／5／5／5，未显示原答／「查看原答」入口或掌握字样；第3轮表达维度显示数据不足。[4次](../tmp/progress-2.noindex/h5-390-four.png)、[5次](../tmp/progress-2.noindex/h5-390-five.png)、[第3轮](../tmp/progress-2.noindex/h5-390-round3.png)、[旧收据](../tmp/progress-2.noindex/h5-390-legacy.png)、[读回](../tmp/progress-2.noindex/h5-observed.json)。Playwright隔离上下文拦截回环URL并直接返回构建文件和合成只读接口，无监听服务器、无真实账户或模型请求；上下文已关闭，原about:blank保留。
- **资源收尾**：复用已有npm依赖与主树Cargo缓存的APFS克隆；本轮App PID31812已Cmd+Q退出、完整路径注销成功，系统搜索只保留日常入口。界面锁已释放，`cargo clean`回收私有中间产物 **2,553,880,888逻辑字节**，不是实时磁盘释放量；主树缓存、既有依赖链接、第1批回滚候选、本批候选与证据保留。日常App可执行哈希仍为 `2e85d945…`。[归属记录](../tmp/progress-2.noindex/resources.json)。
- **未验／待批**：手机原生App未验（本机无HBuilderX／可运行的uni-app原生基座）；N3预测性准确率未验。待批文案候选：**无**；无新增依赖及许可证公开范围，无S接口改动申请。未写真实学习事实、读私有模型目录、启付费、开服务器、推送、部署、替换日常App或构建小程序。

复跑（本工作树根目录；沿用现有依赖，每次输出使用新编号，既有178失败导致全量命令退出1）：

```sh
P2_RUN_ID=$(date +%Y%m%d-%H%M%S)
YOZI_ISOLATED_BUILD=1 rtk bypass npm test -- --cache=false tests/unit/learning-progress-read-model.spec.js tests/unit/learning-progress-ui.spec.js
cp '/Users/blackdj/Desktop/Yozi AI/tmp/qa-run/round1-test-triage.json' "tmp/progress-2.noindex/baseline-$P2_RUN_ID.json"
cmp '/Users/blackdj/Desktop/Yozi AI/tmp/qa-run/round1-test-triage.json' "tmp/progress-2.noindex/baseline-$P2_RUN_ID.json"
YOZI_ISOLATED_BUILD=1 rtk bypass npm test -- --cache=false --reporter=default --reporter=json --outputFile="tmp/progress-2.noindex/retest-$P2_RUN_ID.json"
rtk bypass node scripts/eval/compare-test-failures.mjs --baseline "tmp/progress-2.noindex/baseline-$P2_RUN_ID.json" --report "tmp/progress-2.noindex/retest-$P2_RUN_ID.json" --output "tmp/progress-2.noindex/recompare-$P2_RUN_ID.json"
```

界面复验先按计划0.1重新取得并填写UI锁；用本批候选的Ctrl+Alt+1／2／3／4依次切换4次／5次／第3轮／旧收据，完成后Cmd+Q并按实际完整路径 `lsregister -u`。官网重跑将本树 `tmp/progress-2.noindex/h5-acceptance.js` 传给现有Playwright `browser_run_code_unsafe(filename)`；所有网络由隔离上下文拦截，不需要启动服务器。界面验完释放锁，不能与其他线并行操作。

## 呈现线第 3 批 执行侧交付（2026-10-30）

- **模块／归属**：P，Codex；仅修改约定的呈现页面、读模型、框架元数据／视图、progress组件及其测试，另按简报追加本日志与变更记录。G／S、主工作树及日常App不改；无接口改动申请。
- **根因与落地**：旧截图的「数学」实际是最后一个汇总标题，页主标题仍为通用「知识框架」，汇总与框架缺少科目标识边界；现在页标题及框架标题都取当前框架的显式科目标签，缺失时返回通用标题。证据模板直接输出收据ID且通过DOM属性带出原答ID，现均移除，原始编号仍留读模型供精确追溯。
- **框架／列表**：此前SVG画全部36条边并绕到整页两侧；现默认只画组内关系，仅补选中节点相关的跨组边，完整36条关系仍用于详情。实屏发现非相邻同排直线穿过中间卡片，已改绕卡片的折线，358／680px几何断言通过。右栏此前以360px高度裁切证据；现先显示2条完整记录，沿用「查看更多」整条展开，不设列表裁切高度。
- **各科汇总／守门**：原有维度及题型汇总保留，补每科整体量规达成汇总，与客观题正确率分列；分子／分母均保留对应事件ID。4次不显示百分比，5次解锁；四种状态、复核删除、null维度、旧收据及不读取复核内部结构的合同保持。
- **定向／全量**：定向135项通过，连线增量9项通过（其中新增2个宽度断言）；ESLint、Prettier、diff检查通过。首次全量6401项有178既有失败及3个历史容量超时；原代码／原超时门槛独立复跑历史23项全过，再完整复跑为6186通过／178既有失败／37跳过，15项既有未处理错误未增加。[最终逐ID比较](../tmp/progress-3.noindex/comparison-retry.json)新增失败**0**，完整包含最终连线的两个几何断言；[首轮比较](../tmp/progress-3.noindex/comparison.json)、[历史复跑](../tmp/progress-3.noindex/history-retest.json)、两份全量原报告保留。主树基线复制后及最终比较前均逐字一致，比较器不改。
- **桌面实际界面**：隔离账户、合成事件、独立bundle ID／WebKit UUID；[4次汇总](../tmp/progress-3.noindex/app-four-overview.png)、[4次完整证据](../tmp/progress-3.noindex/app-four-evidence.png)、[5次汇总](../tmp/progress-3.noindex/app-five-overview.png)、[5次完整证据](../tmp/progress-3.noindex/app-five-evidence.png)、[导图](../tmp/progress-3.noindex/app-five-mind.png)、[原答](../tmp/progress-3.noindex/app-original.png)、[复核删除](../tmp/progress-3.noindex/app-round3-deleted.png)、[旧收据](../tmp/progress-3.noindex/app-legacy-overview.png)，同目录保留AX。写作及数学汇总分别展开5条相应来源；节点先2条、点击更多后4条；查看第5题打开原答 `Synthetic answer 4`。框架去除跨组背景已实屏核对，[绕卡片修正前的诊断图](../tmp/progress-3.noindex/app-framework-before-route.png)保留；最后一次绕卡片改动仅定向／全量通过，**最终连线原生实屏未验**：S3自03:12 UTC持有共享UI锁，截至04:09 UTC仍未释放，协调问题尚无答复。已验的标题、汇总、证据及状态代码此后未改；不越锁、不把修正前截图当最终截图。
- **官网390px**：4次／5次／第3轮／旧收据均通过，无横溢、内部ID、原答／原答入口或掌握文案；[4次](../tmp/progress-3.noindex/h5-390-four.png)、[5次](../tmp/progress-3.noindex/h5-390-five.png)、[读回](../tmp/progress-3.noindex/h5-observed.json)。共享Playwright配置被占用、缓存浏览器缺失，改用已有系统Chrome独立临时上下文；路由直接提供静态产物和合成接口，无监听服务器，上下文及浏览器已关闭。
- **资源／边界**：复用现有依赖，私有Cargo APFS克隆已按无消费者及候选独立签名核对后用cargo clean清理2,554,613,323逻辑字节，不是实时磁盘释放量；自建构建／测试／浏览器均已取得终态，第一候选已正常退出并按完整路径注销。最终候选保留在 `tmp/progress-3.noindex/Yozi AI.app`，尚未启动终验，`first.noindex/`暂留作回退；S3锁不改。系统应用搜索仅返回日常入口，主程序可执行哈希保持；[归属与收尾记录](../tmp/progress-3.noindex/resources.json)。手机原生App未验（无HBuilderX／可运行的uni-app原生基座），小程序未构建，N3预测性准确率未验；真实模型调用0。待批文案候选：**无**；新增依赖／许可公开范围：**无**；不推送、不部署、不启付费、不替换日常App。

复跑：在本工作树执行 `sh tmp/progress-3.noindex/rerun-tests.sh`，使用新时间编号保存定向／全量结果，逐字核对复制的基线后按测试ID比较，新增失败会非零退出。界面复验仍须先取得并填写UI锁；桌面候选用Ctrl+Alt+1／2／3／4切换四态，完成后Cmd+Q并按完整路径注销；官网命令为 `PROGRESS_QA_OUTPUT="tmp/progress-3.noindex/h5-retest-$(date +%Y%m%d-%H%M%S)" rtk bypass node tmp/progress-3.noindex/h5-acceptance.mjs`，只读复用本批官网产物，不启动服务器。

## 呈现线第 4 批 执行侧交付（2026-10-30）

- **模块／归属**：P，Codex；本树 `codex/yozi-progress-1-20261031`，起点 `cdf64fef`。先以绝对路径读取主树计划0.1（含接口登记）和第3批总监验收；只改约定页面、框架视图及其测试，另追加本日志和变更记录。G／S、汇总读取模型及官网壳层未改，无接口变化。
- **跨科根因／落地**：`knowledge.vue:11,143` 原来直接把全科读模型传给总览；现只在页面投影中按框架显式 `subject` 精确筛选科目、证据、来源及其科目汇总，缺少科目编号或标题标签就隐藏总览，不从当前对话推测。原读模型、指标分子分母及官网全科展示保持；同一份写作＋数学事件分别挂载真实框架页和官网工作区，断言本科目／两科以及输入事实不变，并检查来源切换和缺科目四种边界。
- **标题根因／落地**：原h1与h2均输出 `graph.title`；`knowledge.vue:8` 保留唯一一级标题，删重复h2及其专属样式，不留空占位。`learning-progress-ui.spec.js:147` 断言完整框架名仅作为标题出现一次。
- **绕线根因／落地**：第3批组内绕线保留；选中态的跨组曲线仍从卡片侧边引出，会扫过同排无关卡片，旧版采样复现保存在 [诊断JSON](../tmp/progress-4.noindex/previous-cross-group-collisions.json)。`knowledge-graph-view.js:118,131` 统一先经过行间空隙再走外侧通道；完整36条关系及详情不减。`knowledge-graph-ui.spec.js:80` 覆盖358／680px、未选中及全部26个节点选中态，逐段检查无关卡片内部无相交。
- **定向／全量**：定向 **194／194通过**，ESLint、Prettier、链接及diff检查通过。首次全量6458项：6241通过、180失败、37跳过，逐ID为178既有＋2条历史容量超时；原代码／原10秒与20秒时限单独复跑历史23项全部通过。构建结束后全量复跑 **6458项：6243通过、178失败、37跳过**，逐文件＋完整测试名＋重复次数比对 **新增0／既有178／消除0**；Vitest退出1；日志15个未处理错误按文件＋最近测试提示＋首条消息与上批作多重集合比较，新增0，不据提示作因果归因；原始报告均保留。[定向](../tmp/progress-4.noindex/targeted-tests.json)、[首次全量](../tmp/progress-4.noindex/full-tests.json)、[首次比对](../tmp/progress-4.noindex/comparison.json)、[历史复跑](../tmp/progress-4.noindex/history-retest.json)、[最终全量JSON](../tmp/progress-4.noindex/full-tests-retry.json)、[最终日志](../tmp/progress-4.noindex/full-tests-retry.log)、[最终逐ID比对](../tmp/progress-4.noindex/comparison-retry.json)。比较器使用与指定主树原件经 `cmp` 逐字一致的本树tmp基线副本。
- **构建／实际界面**：隔离桌面与官网构建、桌面公开产物检查、离线锁定原生编译及候选严格签名均通过。候选 `tmp/progress-4.noindex/Yozi AI.app`，复用第3批宿主但使用独立bundle ID／WebKit UUID、合成账户及离线传输；宿主主crate沿用上批 `opt-level=0`，只用于界面验收。官网通过Playwright路由直接提供静态文件和同份合成事件，无监听服务器、真实账户或模型调用。共享浏览器配置占用时使用已安装Chrome的独立上下文，结束后已关闭。

| 本批实际界面 | 事实／证据 |
| --- | --- |
| 知识框架页总览 | 只有考研英语写作区块，AX中完整框架名只作一级标题一次：[截图](../tmp/progress-4.noindex/app-writing-overview.png)、[AX](../tmp/progress-4.noindex/app-writing-overview.ax.txt) |
| 官网工作区390px | 保留写作、数学两科，页面宽度及滚动宽度均390，无原答或内部ID泄露：[截图](../tmp/progress-4.noindex/h5-390-five.png)、[读回](../tmp/progress-4.noindex/h5-observed.json) |
| 框架未选节点 | 可见组内关系绕开无关卡片：[截图](../tmp/progress-4.noindex/app-framework-unselected.png)、[AX](../tmp/progress-4.noindex/app-framework-unselected.ax.txt) |
| 选中跨组节点 | 选择「明确交际目的」，指向结构组「组织写作提纲」的关系经外侧通道，可见连线不穿过无关卡片：[截图](../tmp/progress-4.noindex/app-framework-purpose.png)、[AX](../tmp/progress-4.noindex/app-framework-purpose.ax.txt) |

- **资源／边界**：先取得共享UI锁并写owner，验完核对本线owner后释放。App PID20442已Cmd+Q退出并按完整路径注销，系统应用搜索只保留日常入口，其可执行文件哈希保持；自有构建、浏览器和测试进程均已取终态。私有Cargo APFS克隆无消费者后用cargo clean清理 **2,553,884,593逻辑字节**，不等于实际磁盘释放量；第3批首个候选（原仅等待最终绕线实屏）经无消费者、无注册及本批候选核验后，以正常废纸篓方式回收 **27,886,435字节**，仍位于 `.noindex` 目录内，可恢复；第3批最终候选、第2批回滚基线、本批候选、截图、原始测试报告及既有依赖保留。[归属记录](../tmp/progress-4.noindex/resources.json)。
- **未验／待批**：本批指定四张界面已验；手机原生App和N3预测性准确率未验，小程序未构建。待批文案候选：**无**。新增依赖／许可公开范围：**无**；不写真实学习事实、不改G收据、不读私有模型目录、不启付费、不推送、不部署、不替换日常App。

复跑：本工作树执行 `sh tmp/progress-4.noindex/rerun-tests.sh`；定向及全量采用原时限，复制主树基线后 `cmp` 逐字核对，再按测试ID多重集合比较，新增失败会非零退出。界面复验先按计划0.1取得并填写UI锁；桌面打开本批候选检查未选中／选中「明确交际目的」两态，结束后Cmd+Q并按完整路径注销；官网命令为 `PROGRESS_QA_OUTPUT="tmp/progress-4.noindex/h5-retest-$(date +%Y%m%d-%H%M%S)" rtk bypass node tmp/progress-4.noindex/h5-acceptance.mjs`，完成后释放本线UI锁。

## 基线测试债第 1 批 执行侧交付（2026-10-31）

- 范围：`95d4db04` 上仅改分诊清单中的 37 份测试及 1 份测试夹具；冻结清单测试保持原样。未改产品、后端、Tauri 或脚本源码，未新增依赖、开服务器、真实模型调用、合并、推送或部署。
- 结果：178 项旧失败逐条闭合为 **168 改写通过／1 退役／9 保留失败并升级**；9 项是提示交付、停止入口与焦点、损坏记录恢复状态及冻结版本漂移，仍需总监裁定，不宣称全量通过。[逐条去向](../tmp/test-debt-1.noindex/disposition.json)、[疑似缺陷与待裁定](../tmp/test-debt-1.noindex/suspected-defects.json)。
- 全量：隔离初跑 6,504 项、178 失败，与基线逐 ID 完全一致；最终 6,503 项、6,457 通过、9 失败、37 既有跳过，**新增失败 ID 0、未处理错误 0**。[初跑](../tmp/test-debt-1.noindex/before.json)、[最终报告](../tmp/test-debt-1.noindex/final.json)、[逐 ID 对照](../tmp/test-debt-1.noindex/final-comparison.json)、[完整输出](../tmp/test-debt-1.noindex/final.log)。
- 退役仅默认访客离线建档：现行主流程是注册登录后 BYOK，离线扩展退出主流程；对应无模型外发、原事实保留和登录不自动同步的 3 条既有安全用例均在最终全量通过，完整名称列于去向表第 119 行。
- 15 条错误已逐来源归因：12 条分别隔离复现为未等待的会话变化拒绝；3 条用真实 Promise 调用标签追至续期测试的重试列表读取，固定下标误应答偏好后挂起，销毁才抛取消。改按路径/action 匹配、提前等待拒绝，不改超时、不吞异常。[错误去向与复现证据](../tmp/test-debt-1.noindex/unhandled-disposition.json)。
- 防误改：text-action／preferences／byok／receipts／model-authority 各 2 条，共 10 条均在临时破坏判断后失败，随后逐字恢复源码。[10 条记录](../tmp/test-debt-1.noindex/mutation-checks.json)、[复跑脚本](../tmp/test-debt-1.noindex/run-mutations.py)、[源码零改动证明](../tmp/test-debt-1.noindex/source-diff-proof.txt)。未新增 skip/todo/only/空断言或超时设置。
- 静态检查：`git diff --check`、受影响 JS 的 ESLint 通过；现有 ESLint 配置忽略 `model-discovery-contract.spec.ts`，其实际测试全量通过。资源复用依赖链接；测试进程均取终态，2 份隔离归因副本及 10 次临时源码备份已回收，清理 190,844 字节编辑索引；保留全部报告、去向表及历史验收/回滚材料，无 App 或手机实测。[统计与限制](../tmp/test-debt-1.noindex/summary.json)、[资源记录](../tmp/test-debt-1.noindex/initial-state.json)。
