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
## 外壳第 1 批 执行侧交付（2026-10-30）

- 事实：仅在 `codex/yozi-shell-1-20261030`，起点 `3a45a55d`。主工作树、Muse 2 只读；未触碰批改链、消息流生命周期、日常 App 或小程序；无推送、合并、部署、新依赖或模型调用。
- 入口：已连接且未开始建档时显示已有问候及两个已有写作示例，点击只填共享草稿；未连接及进行中的建档保留。顶部改静态品牌＋当前目标；四个主导航按总监 A17，产物库保留历史、学习洞察、练习／复习与收藏入口。
- Muse 2 实现参数：输入 54／r27／深色 `#323232`，行高22、textarea上限154、桌面底距18，窄屏保留12；发送色面32＋触区44，只保留输入本体与按钮的键盘焦点。深色主字 `#ededee`、主按钮 `#3172e0`、用户气泡 `#3273e0`；rail首项距窗口顶部100（含原生标题栏）。对照见[样式系统](07-STYLING-SYSTEM.md)。
- 草稿：学生账号＋会话（带练含训练日）最近50份本机独立保存；白名单仅输入字段，不写学习事实／导出／云同步，不保存账户令牌；存储失败保留内存输入。新建会话、建档请求编号变化、切号、卸载后的迟到回调均有定向保护。
- 待批文案候选：无。复用「今天，想学会什么？」「英文邮件写作」「英文句子组织」及既有导航文案；语音代码保留、入口隐藏；空态无中央头像。
- 定向验证：相关44项中43通过，1项为原基线已有的复习评分旧断言；新增10项草稿／入口／输入增高位置与1项产物库导航均通过。IME组字事件、229、Shift+Enter与重复Enter均有定向覆盖；最后输入位置及草稿／导航15项通过。
- 全量测试与逐条基线比对：完整首轮6282项（6059通过／186失败／37跳过），4个套件因独立工作树缺后端依赖链接未收集；复用已有嵌套依赖、更新静态品牌旧断言后定向复验。并发期间的超时在原门槛下最终45项通过，未加超时、跳过或放宽业务断言。最终合并回执6337项：6124通过／176原有失败／37原有跳过；对主工作树178项逐条比对为176仍失败、2通过，遗漏0、新失败0；15个未处理错误与基线来源及消息多重集一致，新增0。保留[原始各轮与逐条来源](../tmp/shell-1.noindex/test-comparison.json)，同名用例按文件内出现顺序区分，不以定向过滤的跳过覆盖执行结果。
- 构建：桌面、官网H5、手机App共享前端通过；App前端产物、官网与桌面公开产物检查通过。手机原生安装包未验：虽有Xcode／adb，但缺HBuilderX／uni原生离线SDK；未启动iPhone工具。
- 实际界面：原生空态与示例通过，前后学习事实及请求数不变；单行54、r27、行高22、textarea封顶154、底距18、触区44与色面32读回一致。输入增高曾复现遮住末条消息4px，现仅在输入高度改变且阅读位于末尾时跟随，并移除会话容器重复预留；12条合成消息、十四行草稿正常退出重开恢复、A/B独立草稿均通过。减少动态以候选注入媒体偏好信号覆盖，rail动画由 `muse-rail-reveal` 变为 `none`，输入可用，未改系统偏好。官网390px只读空进度页宽390、无可编辑控件，零外部网络请求。[逐项结果及度量](../tmp/shell-1.noindex/native-result.json)；旧消息阅读位置由定向测试覆盖。
- 未验：中文IME原生复核未取得可靠组字事件，当前自动化产生普通拉丁字母，输入法菜单接口超时；按上限停止，保留 `native-ime-attempt-not-composing.png` 及事件记录，不将其或单测的composition事件冒充真实中文组字验收。手机原生包原因见上；未验证真实后端／模型或跨端同步。候选的合成503消息仅为本机拒收传输，恢复按钮未再次调用；QA控件及合成数据只在忽略目录的候选快照，不进入正式源码。Rust仅该功能验收候选采用包级 `opt-level=0`，不作性能结论，正式清单未修改。
- 复跑与证据：本工作树 `tmp/shell-1.noindex/` 保留[构建脚本](../tmp/shell-1.noindex/rebuild.sh)、隔离源码快照、候选、原始测试JSON／日志、逐条比对与截图。根目录执行 `zsh tmp/shell-1.noindex/rebuild.sh qa` 重建合成账户原生候选（离线Rust、独立target），`web` 重建正式桌面／官网前端，`app` 重建手机共享前端；脚本只新建带时间的 `.noindex` 输出。启动已验候选：`open -n "tmp/shell-1.noindex/Yozi AI.app"`。全量复跑：`YOZI_ISOLATED_BUILD=1 rtk bypass npm test -- --configLoader runner --reporter=default --reporter=json --outputFile=tmp/shell-1.noindex/review-tests.json`。无服务器；候选中QA A/B/New只切合成会话，QA Motion模拟媒体偏好，QA Evidence读回度量。
- 收尾：本轮候选进程均正常退出，当前候选完整路径注销退出0，Spotlight仅日常 `/Users/blackdj/Applications/Yozi AI.app`。按独立target执行Cargo原生清理，移除10178个可再生文件，清理前逻辑大小2,553,286,423 bytes；13项旧前端／重复候选共179,316,555 bytes已正常移入废纸篓（`.noindex`容器内，可恢复），不是实时磁盘可用空间或RAM的结论。最终候选、上一候选、原始失败与截图、复跑快照均保留，两份候选严格签名复核通过；复用依赖，无服务器，不停止其他执行线进程。
- 附录：无新增依赖、下载或GPL／AGPL组件；未读取私有模型目录。

## 外壳第 2 批 执行侧交付（2026-10-30）

- 模块 **S**，归属 **Codex**；只在 `codex/yozi-shell-1-20261030`、基线 `24ae49b5` 落地。主工作树、Muse 2、G 的后端与流式合同、P 的呈现文件均未修改；未再次合并。
- 发送与呈现：`conversation-learning.js:493` 的临时回复立即进入准备；`base-bubble.vue:14` 复用小猫，`working → making → idle`，历史与学生不播动态。`index.vue:474,2288`、`writing-coach.vue:206`、`muse-model-intake.vue:21` 原地衔接；`learning-message.vue:1` 在完整收据前只给文本与占位，题卡／批改不逐段渲染。正式作答、建档、采用计划沿原有明确提交。
- 连续与取消：`message-follow.js:2` 在48px内跟随；完整收据下一绘制帧还原可见回复坐标，读历史不拉底，回底恢复；工具建议的显示顺序在下一次发送／重开后保持。`learning-shell.vue:868` 的Esc在浮层之后处理，普通建档卡不消费Esc；`learning-stream.js:147` 只取消／释放读取器一次；`conversation-learning.js:2878,3767,4185` 丢弃旧分片／结果，发送ID去重；三处页面动作只更新所属请求的界面，不让迟到错误覆盖新请求。
- 参照：Muse 2 `src/pages/ChatView.tsx` 的 `Accepted corrections`／`acc += delta`（交付时约500–530行：纠正队列、同消息增量和取消）、`artifactReading`／`returnToLatest`／`onScroll`（阅读位置与48px，约177–205、399–420、638–640行）；`src/App.tsx:362–376`（Esc）；`src/lib/api.ts` 的 `streamChat`（约216行）、`src/lib/chatStream.ts:4–65`（取消／终止）；`src/styles/app.css:102–108` 的 **r22、16／26px**。Muse 2并行开发时行号会移动，函数／注释名为稳定定位。这些是 **Muse 2 实现参数**；头像2.2s／最小驻留1000ms为Yozi现实现值，未冒充Muse原版数值，已写入 `docs/07`。
- 测试：新增 `learning-shell-stream.spec.js` **17/17**，覆盖准备、同节点／重开顺序、整题卡／整批改卡、阅读锚点、停止迟到、纠正去重、三类Esc优先级与明确提交。最终完整 **6377项：6164通过、176失败、37跳过**；`full-comparison-final-stable.json` 按文件＋fullName逐ID／重复出现次数比对，**新增0、既有176、基线中2项不再失败**。另15条未处理错误与基线的文件＋错误文本逐条匹配，新增0（`runtime-comparison.json`）；全量退出非零，不能记作全绿。ESLint 0错误／3条空回调警告；`git diff --check`通过。
- 界面：独立标识与WebKit资料域的桌面候选 `tmp/shell-2.noindex/Yozi AI.app`，合成传输、独立Cargo target；新增20张桌面截图。准备 `native-01`；流式／完成 `native-02,03,04`（同一回复纵坐标 **391→391px**）；整题／批改 `native-13b-exercise-whole.png`、`native-15b-feedback-whole.png`；历史 `native-05,06`（**2328→2328px**）；浮层／Esc `native-07,08`；停止／迟到 `native-09,10`及 `native-stop-button*.png`；纠正 `native-11`，读回只保存1条纠正句。首张题卡生成后0作答、计划仍0；批改的5份合成原答由QA按钮明确准备，收据前后原文保留。
- H5：`browser-qa.json`与15张 `h5-*.png`，390px气泡r22／16／26px、流式与整卡通过，无横向溢出、无浏览器运行时错误；同一DOM节点完成，纵坐标 **488→488px**。使用共享学习前端与Playwright路由填充，没有启动HTTP监听器；官网只读边界未扩展。手机共享前端构建与产物检查通过；**手机原生包／实机、原生中文IME、真实供应商、真实登录与跨端同步未验**，没有小程序构建。
- 费用与接口：真实模型调用 **0**；G配合需求 **无**，待批文案候选 **无**。无新依赖、下载或GPL／AGPL组件；没有部署、推送、收费、短信或替换日常App。所有QA控件、合成身份、传输和原生标识适配只在忽略目录的候选镜像，正式源码不含这些入口。
- 复跑：根目录执行 `YOZI_ISOLATED_BUILD=1 rtk bypass npm test -- --reporter=default --reporter=json --outputFile=tmp/shell-2.noindex/recheck-tests.json`；再执行 `node scripts/eval/compare-test-failures.mjs --baseline tmp/shell-2.noindex/round1-test-triage.json --report tmp/shell-2.noindex/recheck-tests.json --output tmp/shell-2.noindex/recheck-comparison-$(date +%s).json`。原比较脚本拒绝工作树外基线，已将总监指定基线逐字节复制到上述路径，G脚本未改；原命令拒绝日志保留。界面复跑先按0.1取锁，再执行 `node tmp/shell-2.noindex/browser-qa.mjs` 或 `open -n "tmp/shell-2.noindex/Yozi AI.app"`，结束后正常退出、注销候选并释放锁。
- 构建复跑：保留 `build-source/`、`release-source/`、`native-src/`、`build.mjs`、`native-config.json` 及构建日志。独立原生入口：在 `tmp/shell-2.noindex/native-src` 执行 `CARGO_TARGET_DIR="$PWD/../cargo-target" node ../../../node_modules/@tauri-apps/cli/tauri.js build --debug --bundles app --no-sign --ci --config ../native-config.json -- --offline --locked --jobs 2`；生成的候选须继续留在 `.noindex`，本机签名后核验。此候选只作功能验收，不作性能结论。
- 收尾：候选PID按启动时间核对并正常退出；注销调用与Launch Services读回已核验，最终候选无注册条目，Spotlight仅 `/Users/blackdj/Applications/Yozi AI.app`。Cargo清理报告 **5527文件、2.1GiB**；3份被替代候选＋4份旧前端共 **166,873,775 bytes逻辑大小**已移入可恢复废纸篓；不是实时可用空间或RAM的结论。保留当前已验候选、源码镜像、失败原始证据与20＋15张截图，第1批已验回退原位保留；UI锁已释放，明细沿 `resources.json`。


## 外壳第 3 批 执行侧交付（2026-10-30）

- 模块 **S**，归属 **Codex**；仅本工作树／`codex/yozi-shell-1-20261030`，起点 `8f7dc18f`。以主工作树0.1登记、A17／A20与第2批总监验收为边界；未修改 `laf-backend/**`、P 文件、Muse 2、主工作树或日常 App。
- 落地位置与参照（下列 Muse 路径均相对 `/Users/blackdj/Desktop/Muse 2/Muse2/`；数值是 **Muse 2 实现参数**，不是原产品测量）：

| 项目 | Yozi 文件:行 | Muse 源码位置／数值及 Yozi 差异 |
| --- | --- | --- |
| A1 空取消隐藏／部分保留 | `src/services/learning/shell-navigation.js:112`；`src/pages/learning/index.vue:2313`；`src/pages/learning/components/writing-coach.vue:697`；`src/stores/modules/conversation-learning.js:529` | `src/pages/ChatView.tsx:544–546`：中止时保留 acc／标 stopped；Yozi 不加停止文案，空回复直接不渲染，部分文字仍为临时呈现、不冒充已保存收据。 |
| A2 提示完整置于输入上方 | `src/components/business/learning/learning-shell.vue:431`；`src/pages/learning/index.vue:2290,2408`；`src/pages/learning/components/writing-coach.vue:696`；`src/components/business/learning/learning-space.css:352` | Muse `src/styles/app.css:143` 的输入区前置附件结构作参考；8px间距、72px最大高、13／20字号、128px底部预留是 **Yozi 适配参数**，复用原取消文案。 |
| A3 静态顶部与历史避让 | `src/components/business/learning/learning-shell.vue:387`；`src/components/business/learning/learning-space.css:209,285,333` | `src/styles/app.css:91,338,343,346–347`：滚动容器外116px、头像56px、胶囊5／12／6px／r18／上移4px、名字14／18、目标11／14；静态品牌按A20。 |
| B1 设备侧栏 | `src/services/learning/shell-navigation.js:81`；`src/components/business/learning/learning-shell.vue:527,586,658,769,850` | `src/lib/sidebarPreferences.ts:5,8`、`src/components/Sidebar.tsx:18,53,77`：默认展开217、180–420钳制；`src/App.tsx:404` Cmd+B，Yozi另支持Ctrl+B；只在对话页展开会话栏，其他页不叠加。 |
| B2／B3 导航与快照 | `src/services/learning/shell-navigation.js:6,30,62`；`src/components/business/learning/learning-shell.vue:799,985`；`src/components/business/learning/muse-workspace-pages.vue:78,272` | `src/components/Rail.tsx:47`、`src/lib/navigation.ts:11–18,26–36`、`src/lib/useNavigation.ts:11–19`：校验完整配置后替换，失败保留旧快照；补齐ID字符串边界，拒绝会触发对象转换的坏配置；按A17四入口，Feed／Ideas隐藏，设置底部。目标页沿原文案保留今日安排与分批复习，只定位／导航、不改队列事实。 |
| B4 独立设置与焦点 | `src-tauri/src/workspace_windows.rs:71,76,92,107`；`src/services/desktop/windows.js:14,24,101`；`src/pages/profile/index.vue:6,384,972`；`src/components/business/learning/learning-space.css:1501` | `native/main.swift:1730,1759`：单窗、默认520×680；`src/pages/Settings.tsx`／`Settings.css:1,225`：窄桌面竖栏。Yozi最小尺寸也520×680、竖栏148px为中文适配；关闭聚焦主窗并恢复原输入元素。 |
| B5 多连接／切号／重开 | `src/stores/modules/conversation-learning.js:385,483,1421,1433,3923`；`src/pages/learning/index.vue:3091`；`src/components/business/learning/muse-model-control.vue:22,45,77`；`src/components/business/learning/muse-ai-connectors.vue:210,394` | 沿用Yozi账号分域和BYOK接口；修复切号清理覆盖已恢复草稿，保存会话位置、接续原连接，失效型号显示已有错误并可手动换选；无新增Muse数值或模型权限。 |
| 官网390px／B6语音 | `src/components/business/website/website-workspace.vue:26,116,316`；`tests/unit/muse-app-ui.spec.js:192` | 官网设置只放现有隐私／协议入口，仍为只读；语音实现保留，未验入口继续隐藏。无额外Muse数值。 |

- 测试位置：新增 `tests/unit/shell-navigation.spec.js:1`、`tests/unit/desktop-settings-window.spec.js:1`、`tests/unit/profile-shell-settings.spec.js:1`、`tests/unit/shell-goal-navigation.spec.js:1`；扩展 `tests/unit/learning-shell-stream.spec.js:102,124,134,508,524`、`tests/unit/byok-store.spec.js:225,246,258`、`tests/unit/muse-app-ui.spec.js:192`、`tests/unit/website-workspace-ui.spec.js:135`。`tests/unit/learning-ui.spec.js:1024,2904,2997,3008,3040,3107`、`tests/unit/learning-journey-ui.spec.js:15`、`tests/unit/writing-coach-profile.spec.js:153` 按本批新默认展开、宽度和最后所选会话合同更新夹具／断言，未放宽超时或学习权限。
- 最终全量与逐ID结果：完整 **6405项：6192通过、176既有失败、37跳过**；[逐ID比对](../tmp/shell-3.noindex/full-comparison-final-guard.json) **新增0、既有176、基线中2项不再失败**，[最终完整JSON](../tmp/shell-3.noindex/full-tests-final-guard.json)保留。收集301文件，相对第2批新增4文件、遗漏0；15条未处理错误按报告文件＋错误首行消息多重集与原基线一致，新增0（`runtime-comparison-final-guard.json`）。全量仍退出1，不记全绿。指定基线已逐字节复制到本树 `tmp/shell-3.noindex/round1-test-triage.json`；比较器未修改。原始中间失败均保留；`full-tests-accepted.json` 实为6176通过／192失败／37跳过，逐ID新增16（历史11、先修2、能量1、报告器及工具链子进程各1），不因文件名含accepted而记作通过；一次并发构建期间的定向停止超时也保留。原门槛复验：202项189通过／13失败，其中2个原有失败、新11；11项新增失败原文均为原20s／10s门槛或子进程ETIMEDOUT，导航5／5通过。末次完整运行仅将自身核验进程恢复默认I/O／普通调度，未改断言、时限或其他任务；最终历史23／23、工具链43／43、报告器50／50通过。末次ID类型边界补修后的回执单独列出。
- Rust与构建：根 `src-tauri` 离线测试 **13／13**（`rust-tests-final.log`）；最终独立target原生构建、候选严格签名通过（`native-type-guard-build.log`、`type-guard-verify.log`）；桌面前端467模块、手机App共享前端构建通过（`desktop-type-guard-build.log`、`app-type-guard-build.log`）。产物检查：`app-artifacts-final-guard.json` 为ok／0阻断。ESLint／文档检查：改动文件ESLint 0错误／3条既有警告（2条空回调、1条原有属性顺序），`git diff --check`通过；本批新增链接与截图路径逐项存在。
- 桌面真实UI：独立标识 `cn.wangshiliang.wenli.qa.shell3.20261030`、独立WebKit域，仅合成账号与传输。A1／A2：`native-06-empty-stop-notice.png`、`native-07-partial-stop.png`，空泡消失／部分保留／迟到丢弃；逻辑700px高（物理1398px窗口）提示584–620、输入框628，未裁切遮挡。A3：`native-08-history-header.png`，正文不卷入116px标题区。
- 桌面侧栏与导航：`native-01-sidebar-default.png`、`native-02-sidebar-min.png`、`native-03-sidebar-max.png`、`native-04-sidebar-collapsed.png`、`native-05-sidebar-reopened.png`，217默认／180与420实际拖拽／Cmd+B收起／重开恢复；`native-09-bad-config.png`及最终`native-30-object-id-config.png`仍保留四入口与原对话；`native-guard-before.json`／`native-guard-after.json`的账号、会话、连接、草稿、侧栏、事实数量和路由逐项相同；搜索`native-10-search.png`、目标`native-25-goals-entries.png`、产物库`native-12-materials.png`、对话`native-13-chat.png`。今日与复习实到原对话／现有复习页：`native-26-today-resumes.png`、`native-27-review-entry.png`。
- 设置：`native-14-settings-compact.png`、`native-15-settings-reopened-once.png`、`native-16-settings-return-focus.png`；窗口菜单实读主窗＋设置各1个，重复打开复用；`native-settings-compact.json`为520×680／column，`native-return-from-settings.json`为原会话／原草稿／TEXTAREA焦点／选区10。
- 连接与隔离：`native-17-second-connection.png`、`native-18-first-connection.png` 两个已有连接切换；`native-19-retired-model.png`失效提示、`native-20-recovered-connection.png`手动换选；`native-21-account-a.png`、`native-28-account-b-ready.png`、`native-29-account-a-restored.png`显示A→B无外来记录／连接／草稿→A恢复。`native-24-cold-reopen.png`与`native-cold-reopen.json`读回原会话 `learn_mvvv7ga1_7asa56xv`、`shell3-second`、草稿「账号甲关闭重开继续」与420px展开。首次B夹具缺少页面onShow读回导致读记录等待，原图保留；仅QA镜像补调用原读取入口后正常空态，正式代码未绕过校验。
- 官网H5：`browser-qa.json`完成，无浏览器pageError；`h5-21-website-390.png`、`h5-22-website-account.png`、`h5-23-website-settings.png`为实际官网390px导航／账号／设置，无横向溢出。学习共享H5另验停止、侧栏、导航、切号与重开，旧`h5-11`库截图早于侧栏叠加修复，以最终原生`native-12`为准。Playwright静态路由填充，HTTP监听器0。
- 未验：手机原生包／实机（本批仅完成共享前端构建）、原生中文IME、真实供应商／真实登录后端／跨端同步；合成桌面与H5不冒充这些链路。没有小程序构建。真实模型调用 **0**；G配合的后端需求 **无**；待批文案候选 **无**。
- 复跑：完整可复制命令见 [`tmp/shell-3.noindex/commands.txt`](../tmp/shell-3.noindex/commands.txt)，含全量、逐ID、Rust、桌面／App构建与取锁后UI命令；保留QA镜像／原生源／最终签名候选与`before-guard.noindex/Yozi AI.app`回退副本；当前候选为功能验收debug包，不作性能结论。所有QA入口仅在忽略目录。`docs/07:11,15,80,139`同步现行外壳合同。
- 资源收尾：最终候选PID25704正常退出、完整路径注销退出0，UI锁释放；两份S3签名候选（当前＋`before-guard.noindex/Yozi AI.app`）和第1／2批正式基线保留。7项旧前端／诊断助手／被新副本覆盖的候选及重复构建包共 **104,950,446 bytes逻辑大小** 经FileManager移入可恢复`.noindex`废纸篓容器，未清空；末次Cargo原生清理 **4044文件／1.5GiB**（清理前逻辑大小1,594,353,595 bytes）。原始失败、30张桌面截图、官网与共享H5截图、源码镜像和复跑材料保留；明细沿`resources.json`，不将这些大小当作实时磁盘可用空间或RAM结论。无新增依赖／下载／GPL或AGPL公开范围；不推送、合并、部署、收费、短信、启用平台付费模型或替换日常入口。

## 外壳第 4 批 执行侧交付（2026-10-31）

- 模块／归属：S，`codex/yozi-shell-1-20261030`，起点 `7eb2053c`；只在独立工作树改动。主树、Muse 2 只读，G／P／学习事实写入／今日队列／FSRS／批改收据逻辑未改；没有新依赖、推送、部署或日常 App 替换。
- A1：原 dock 离底 18px 且无全宽不透明衬底，消息可从下方露出。`learning-space.css:356` 改为贴底全宽底衬，内部保留桌面18px／窄屏12px、768px正文列；定向测试覆盖底衬与安全区。参考 Muse `ChatView.tsx:635`、`styles/app.css:116`、`tokens.css:42`，没有把新增底衬冒称上游已有实现。
- A2：`10 / 30` 是 `chapter.day` 的学习日期缩写，兼任跳日入口，并非分页／加载进度／调试。`learning-shell.vue:283` 去掉可见数字，多训练日用既有 Lucide 日历按钮跳日；更早记录分页保留。`learning-journey-ui.spec.js:238` 改验无数字按钮及加载后可定位历史日。

| 长成果盘点（原记录均在账号本地 `conversation_learning_v1`／历史页，经 learning-sync 存入 `learning_states.state`） | 来源字段 | 现有查看入口／本批处理 |
| --- | --- | --- |
| 学生作文原答 | `coach.days[].writingSubmissions[].text`；写作题 `attempts[].answer` | 对话原答卡／历史；本批以原答创建v1副本。旧无快照记录仅在已有全文评估且 rewrites 完整时接入 |
| 逐段稿／带写成稿 | `days[].drafts[].text`、`days[].rewrites[].text` | 带练卡／产物库写作聚合；半成品仍留对话，不进编辑面板 |
| 整篇改写任务稿 | `coach.rewriteTasks[].answer.text` | 带练改写任务／原稿回看；不接编辑副本 |
| 长批改／反馈 | `days[].essay`、`days[].feedback`、`attempts[].grade`／纠正收据 | 对话反馈卡／学习洞察／历史；只读不改 |
| 学习计划 | `state.plans[].tasks`、`coach.days[].pack` | 目标／今日训练／对话计划卡；不接编辑面板 |
| 学习小结 | `coach.days[].summary` | 小结卡／产物库；不接编辑面板 |
| 资料／长消息 | `materials[].segments[].content`、`messages[].content/contentBlocks` | 原始资料阅读器／对话／产物库；不接编辑面板 |

- 存储：**新增 `learning-artifacts.ts/.yaml` 负责版本链，复用 learning-sync 的账号、同一主记录与删除机制，不改旧函数**。只写主记录顶层 `essayArtifacts`／`essayArtifactRevision`，不另加同 owner 行（既有读者按 owner 取首行），不碰 `state`／`revision`。旧同步更新保留新字段，既有按账号删行覆盖全部副本／版本；本地确认删除另清自己的 draft／pin 键。
- 合同：v1只从已同步原答读取；未同步失败可重试。按文档 expectedVersion 拒绝旧版本，账号内独立计数器CAS避免并发覆盖；保存／恢复有持久化 requestId 及真实版本回执，重试不增版，恢复只追加。草稿／模式／双滚动位置／Pin按设备、账号和API保存并读回；限制单稿64k字符、每稿256版、账号副本字段2MiB、整行15MiB，超限拒绝写入、不裁历史。判断：已提交原答是稳定的第一类，没有更合适的替代类。

| 落地 | 本树文件与行号 | Muse 2只读对应 |
| --- | --- | --- |
| 面板、动作、草稿／历史恢复、手机返回 | `muse-artifact-panel.vue:222,243,287,303,364,412,555` | `ArtifactPanel.tsx:58,63–145,158–176`；`ArtifactPanel.css:6,16,19,23–28`：clamp(340px,44%,520px)、进入180ms／30px、退出160ms，均标「Muse 2 实现参数」；手机≤760px依本项目全屏／安全区合同 |
| 身份、设备状态、请求幂等、后端CAS | `learning-artifacts.js:20,85,171,203,227,275`；`learning.api.js:144`只追加；`learning-artifacts.ts:44,93,138,213,222` | `api.ts:490–554`：expectedVersion／requestId／versions／restore／既有冲突文案；`libraryPins.ts:8,33–56`：按账号/API及条目保存、写后读回 |
| Library同成果／Pin／几何 | `muse-workspace-data.js:228`；`muse-library.vue:179,246,259,379,434,590,800` | `Library.tsx:203–205,393–396`、`Library.css:1–14`、`styles/app.css:498–517`：分类栏217px、标题34/40、3列／19px；窄屏2/1列 |
| 对话／已保存作文入口 | `writing-coach.vue:246,496,758`；`learning/index.vue:547,719,2097,4340`；`muse-saved-library.vue:166,234` | `ArtifactPanel.tsx` 的同id工件入口；`ArtifactActions.tsx`已核对，仅发送／授权动作不在本批个人副本范围 |
| 外壳装配／Esc／底衬／规范 | `learning-shell.vue:439,999`；`learning-space.css:25,356,782`；`docs/07:101` | `ArtifactPanel.css:23–28` 旁栏让位；Esc沿本项目第2批浮层→面板→停止顺序 |

- 定向 **68/68通过**（新增服务11、后端8、面板9，加外壳／库／只读模型）；覆盖A1–A2、B1–B7，含丢回执后App重建继续保存／恢复、原答／收据／历史统计逐字读回不变。最终全量 **6436：6223通过／176既有失败／37跳过**；逐ID **新增0、既有176、基线2项通过**。15个未处理错误的来源＋消息多重集与基线完全一致，新增0。见[最终比对](../tmp/shell-4.noindex/full-comparison-final.json)及[原始全量](../tmp/shell-4.noindex/full-tests-retry-final.json)。首轮旧日期断言已按新入口调整；Onboarding计时器仅首轮失败，原断言未改，后续整文件及完整全量通过，原始轮次均保留。
- 构建／静态：后端类型检查、App共享前端与产物校验、隔离桌面debug构建／签名通过；`src-tauri`未改，隔离原生源仅换测试身份／WebKit UUID，Rust **13/13通过**。ESLint 0错误（2处既有空箭头警告、2个TS文件按现行配置忽略）；无小程序构建。H5不代替手机原生验收。

| 实际界面结果（隔离账号＋合成传输，真实模型0、HTTP服务器0） | 截图，均在 `tmp/shell-4.noindex/` |
| --- | --- |
| A1底部无漏消息；A2无多余日期数字 | `native-01-history-bottom.png`、`native-02-sidebar.png` |
| 作文卡与Library同id／同版 | `native-03-card-panel.png`、`native-09-library-same-copy.png` |
| 保存v2／旧v2拒绝覆盖远端v3／恢复v1追加v4／重试仅v5 | `native-04-saved-v2.png`、`native-05-stale-rejected.png`、`native-06-restored-v4.png`、`native-07-retry-v5.png` |
| 关开草稿；同包重启草稿／Pin／正文位置1131px仍在 | `native-08-reopened-draft.png`、`native-10c-restart-reading-draft-pin.png`；[只读读回与断言](../tmp/shell-4.noindex/native-qa.json) |
| Esc先关确认浮层，再面板，最后停止生成 | `native-11-escape-overlay.png`、`native-12-escape-panel.png`、`native-13-escape-generation.png` |
| 手机共享前端390×844全屏／返回原对话；官网390只读且产物库路由回落官网，无编辑入口 | `shared-14-mobile-fullscreen-final2.png`、`shared-15-mobile-return-final2.png`、`website-390-readonly-final2.png`；[浏览器完整回执](../tmp/shell-4.noindex/browser-qa-final2.json)，pageError 0 |
| 恢复已提交v6后丢回执，退出重开再重试仍v6，无v7、requestId相同 | `native-14-restore-reply-lost.png`、`native-15-restore-retry-after-restart.png`；共享前端另有 `shared-16-restore-retry-restart-final2.png` |

- G配合需求：**无需修改G**。总监后续发布时需部署新增 `learning-artifacts` 函数及yaml，并保留上述两个主记录顶层字段；本批不部署。未验：真实鉴权HTTP／云数据库／跨设备同步、手机原生包／实机（缺uni原生工具链），不冒充合成或H5已覆盖。真实学生数据未读取或写入。
- 待批文案候选：**无**；面板／确认／冲突文案逐项复用Muse 2现有文案，存储／会话错误复用Yozi现有文案；没有新增面向学生的说明段落、emoji图标、依赖或许可公开范围。
- 复跑：完整原样命令见[commands.txt](../tmp/shell-4.noindex/commands.txt)，含不覆盖证据的review标签、全量／逐ID／定向／后端类型／App／桌面／Rust以及原子UI锁。QA控制仅在忽略目录镜像；签名候选 `tmp/shell-4.noindex/Yozi AI.app`，前一可用回退 `before-retry.noindex/Yozi AI.app`；第3批已验基线与必要恢复材料保留。
- 资源：全部本轮进程终态已取回，原生App正常退出、按完整路径注销，UI锁释放；应用搜索仅日常入口，未操作共享客户端。3项已核验冗余／被两份新候选覆盖的输出 **89,993,311逻辑字节** 经FileManager移入可恢复`.noindex`废纸篓，未清空；Cargo原生清理 **7426文件／2.7GiB**，清前逻辑大小 **2,849,640,184字节**，明细沿[resources.json](../tmp/shell-4.noindex/resources.json)。这些数值不是实时磁盘可用空间或RAM结论；截图／原始失败／源镜像／复跑材料／两份可用候选保留。
