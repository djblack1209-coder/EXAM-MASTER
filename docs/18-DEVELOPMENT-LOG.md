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
