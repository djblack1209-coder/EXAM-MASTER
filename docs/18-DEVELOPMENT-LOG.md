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
