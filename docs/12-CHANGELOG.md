# 变更日志

## 2026-05-26 — 公共课题库文件目录清理

- 删除未注册、无练习链路引用的泛化假题库 `english-2025.json` 和 `math-2025.json`，避免与六条公共课轨道的正式题库状态混淆。
- 题库发布门禁新增 `bankFileInventory`：检查 `src/config/flashcard-banks/*.json` 与 `bank-registry.js` 是否一一对应，未注册 JSON 和已注册但缺文件都会成为发布阻塞。
- 发布 backlog 新增 `bank_file_inventory` 工作流，优先提示题库文件/注册表不一致，防止维护者把目录里的草稿 JSON 误判为可发布题库。

## 2026-05-26 — 公共课题库可见状态收敛

- 公共课题库入口取消“自练草稿”作为用户可点击状态，只有 `quality=ready` 且正式发布的题库可进入整卷练习。
- 政治 2024/2025、英语一 2025 从可加载草稿降级为“整理中”，继续保留在年份地图和发布 backlog 中，避免用户误以为草稿题库已经可商用发布。
- 题库页统计从“正式/自练/待完善”改为“正式/整理中/待入库”，小程序用户只看到可信开放状态。
- 前端参考手册补充平台 UI 边界：微信小程序以 `src/pages.json` 注册路由为准，App/H5 完整产品 UI 需要单独构建和验证。

## 2026-05-14 — 小程序主链路、题库目录与音频反馈收敛

- 小程序前端链路收敛为“首页查看进度或进入题库 → 选择科目与年份 → 开始刷题”，首页和刷题中心不再展示后台整理流程。
- 题库目录按英语一、英语二、政治、数学一、数学二、数学三组织近年真题；未开放年份统一展示为“即将开放/资料完善中”，不进入训练流。
- 英语选择题继续要求篇章材料可见，缺少原文材料的试卷只展示开放状态，不伪装为可练整卷。
- 神经知识图谱相关前端入口继续下架，刷题中心和结果页聚焦整卷训练、错题复习与下一组练习。
- `quiz-sound.js` 收敛为统一音频反馈服务：点击、答对、答错、连击、翻卡、完成整卷、升级成就均有独立短音型，H5 使用 Web Audio，小程序降级为轻震动或静默，并尊重 `quiz_sound_enabled`。
- 新增前端文案守卫与音频反馈单元测试，防止工程流程词重新出现在用户可见页面。

## 2026-05-02 — 文档收敛与冗余清理

- 项目长期文档收敛为 `docs/` 下 17 个核心 Markdown，删除 2026 年 5 月前审计报告、历史归档、文档缓存、发布证据模板和分散设计报告。
- 根目录、`laf-backend/` 和历史归档目录不再保留项目说明文档；入口说明、文档规则、设计基线、部署证据口径合并进现有核心文档。
- 运行报告和发布外部证据改为写入 `data/reports/`、`data/release-evidence/` 等忽略目录，不再污染核心文档集。

## 2026-04-28 — 题库清洗、速度评分/ELO 与知识链路闭环

- 题库 Source Manifest 增加安全展示名、规范键和法务风险标记，机构/老师/广告相关内容默认进入审查队列。
- 题库质量报告增加清洗计划和发布就绪状态，明确公共课覆盖缺口、答案证据缺失和发布阻断项。
- 新增 `src/utils/quiz-elo.js`，落地速度评分、用户 ELO、题目 ELO、题目排序和本地状态持久化。
- 答题页在作答后同步速度分、ELO 和知识节点状态；分析记录不再重复增加已答题数，避免进度和正确率被污染。
- 答题结果卡新增知识点链路跳转，用户可从本题定位回刷题中心的焦点知识节点，并启动节点强化训练。
- 刷题中心焦点知识卡补齐轨道选择与玻璃卡片样式，支持英语一/英语二、数学一/二/三等公共课轨道的自动聚焦。
- 客户端配置停止读取 `VITE_OBFUSCATION_KEY` / `VITE_REQUEST_SIGN_SALT`，避免小程序包带出伪秘密；后端保留 `REQUEST_SIGN_SALT`。

## 2026-04-28 — 敏感信息泄露审计与仓库清理

- 完成当前工作树、已跟踪文件、Git 全历史、忽略文件、构建产物和本地 agent 工作树的敏感信息扫描。
- 曾新增敏感信息泄露审计报告，记录脱敏扫描结果、历史泄露风险、轮换清单和历史清洗方案；2026-05-02 文档收敛后不再保留独立审计报告。
- `.gitignore` 默认忽略 `.env*`，仅放行明确示例文件，并新增 `.claude/` 本地运行状态忽略。
- `scripts/build/audit-tracked-secrets.sh` 扩展高危密钥模式并改为脱敏输出，避免 CI 日志二次泄露。
- 清理 `dist/`、`unpackage/`、`.claude/worktrees/`、`asset-inbox/` 等本地冗余产物。
- 部署文档中的 curl 鉴权示例改为 `AUTH_HEADER` 变量，避免示例 token 触发或诱发泄露。
- 使用 `git filter-repo` 清洗 Git 历史并强推 `origin/main` 与历史标签；本地和远端镜像 `gitleaks` 复扫均为 0 条历史命中。

## 2026-04-28 — 首页知识图谱、引导页与多级题库导航

- 底部悬浮导航综合色调从大面积绿色调整为中性玻璃白底，绿色仅保留为品牌定位和行动强调。
- 首页首屏接入轻量知识神经图谱，展示掌握率、强弱节点和公共课知识节点状态。
- 恢复并重做 `pages/login/onboarding` 新手引导，支持选择公共课版本和每日训练强度，并写入后续导航配置。
- Splash 启动逻辑恢复首启引导：未完成引导进入 onboarding，完成后进入首页。
- 刷题中心升级为“科目 > 版本轨道 > 训练模式 > 题库”的多级导航，并展示未发布题库清洗队列。
- 学习轨迹 Store 增加本地持久化，答题后的知识节点状态可被首页继续读取。

## 2026-04-28 — 品牌首屏与增长体验优化

- 首页左上角品牌从“考研大师”改为 `EXAM-MASTER`，启动页和全局页面标题同步更新。
- 首页首屏升级为深绿品牌工作台，前置今日完成率、剩余题数、连续学习和继续刷题入口。
- 刷题中心新增训练中枢首屏，展示已加载题库、可训练题量、完成进度，并强化限时训练入口。
- 登录页清理旧吉祥物语义，品牌统一为 `EXAM-MASTER`，新增“公共课题库 / 限时刷题 / FSRS复习”可信标签。
- 个人页改为学习资产面板，承接错题、复习间隔和知识神经图谱的长期价值。
- 曾新增小程序视觉增长优化报告；2026-05-02 文档收敛后，长期设计结论并入 `docs/07-STYLING-SYSTEM.md`。

## 2026-04-27 — 关键流程 Bug 修复 (Phase 5)

### BUG1 [CRITICAL] useFlashcardBank.js 存储键不一致

- **根因**: useFlashcardBank.js 使用内联 storageService（直接 `uni.getStorageSync('v30_bank')`），而 useBankStatus.js / do-quiz.vue 使用真实 storageService（用户隔离键 `u_${userId}_v30_bank`）。题库写入位置与读取位置不同，导致"点加载进不去刷题页面"。
- **修复**: 重写 useFlashcardBank.js，import 真实 `storageService`，通过 adapter 传给 flashcard-adapter.js。

### BUG2 [HIGH] loadedBankIds 无响应式更新

- **根因**: `loadedBankIds` 是 computed 但内部无 ref 依赖，加载后按钮状态不会从"加载"变为"已加载"。
- **修复**: 引入 `_loadedSet = ref(new Set(...))` 作为 computed 数据源，加载成功后 `_loadedSet.value = new Set(loaded)` 触发响应式更新。

### BUG3 [MED] goSmartReview 路由参数不匹配

- **根因**: practice/index.vue `goSmartReview()` 传 `mode=review`，但 do-quiz.vue 期望 `mode=smart_review`。
- **修复**: `safeNavigateTo('/pages/practice-sub/do-quiz?mode=smart_review')`

### BUG4 [LOW] do-quiz.vue `this.mode` 未声明

- **根因**: `loadQuestions()` 检查 `this.mode === 'temp_bank'` 但 `data()` 中未声明 `mode`，onLoad 也未从 query 赋值。
- **修复**: `data()` 添加 `mode: ''`，onLoad 中 `this.mode = query.mode || ''`。

### 构建验证

- 四项修复后构建成功，总体积不变（1.5MB，主包 589KB）

## 2026-04-27 — 生产提审就绪 (Phase 4)

### 审核阻塞项修复 (6项)

- **B1** custom-tabbar 去掉「择校」Tab（4→3 tabs），与 pages.json 三页 MVP 规格对齐
- **B2** 删除 school.png/school-active.png 图标 + static-assets.js 移除 school 映射
- **B3** pages[0] 从 splash 改为 index/index —— 首屏即内容，不再空白转场（微信审核要求）
- **B4** splash 页移除 onboarding 死链接（页面不存在），直接跳首页
- **B5** manifest.json 移除 camera/writePhotosAlbum 权限声明（MVP 不使用）；postbuild 脚本同步清理
- **B6** manifest.json name 改为「考研大师」；版本号重置为 1.0.0（首次提审）

### 体验关键修复 (4项)

- **C1** globalStyle 全面切换为浅色主题（backgroundColor #F5F7FA，navigationBarTextStyle black）——消除页面切换暗色闪烁
- **C2** do-quiz + question-bank 加入公开路由白名单——未登录用户也能刷题（微信审核禁止强制登录才能使用）
- **C5** privacy.vue + terms.vue 导航栏/卡片样式从 em3d 暗色系切换为白底绿边框浅色主题
- 隐私政策内容移除相机/麦克风/剪贴板相关条款（MVP 不涉及）

### 健壮性与合规 (5项)

- **I2** postbuild inject-mp-weixin-privacy.mjs 不再注入 scope.camera/scope.writePhotosAlbum
- **I3+I4** practice 页题库加载：per-bank loading 状态（不再全局锁）+ 加载失败 showToast 提示
- **I7** 所有页面 navigationBarBackgroundColor 从 #1A1A1A 统一为 #F5F7FA；globalStyle title 中文化
- **I9** E2E 测试登录按钮已确认 release 环境不显示（isNonReleaseEnv 守卫）
- **N3** App.vue onLaunch 调用 FSRS restoreUserParams()——冷启动恢复间隔重复参数

### 构建验证

- 总体积 1.5MB（无变化），pages[0] = index/index
- app.json: permission 为空、requiredPrivateInfos 为空、**usePrivacyCheck** = true
- project.config.json: projectname = 考研大师, appid = wxd634d50ad63e14ed, libVersion = 2.32.3
- school 图标已从构建产物中移除

## 2026-04-27 — 经典闪卡模式 + FSRS 自评 (Phase 3)

- do-quiz.vue 新增经典闪卡交互模式：翻转查看答案 + FSRS 四级自评（忘了/模糊/记得/简单）
- 分析题(analysis)和闪卡(flashcard)类型自动进入闪卡模式，不再显示 ABCD 选项
- FSRS 真正发挥作用：四级评分直接驱动间隔重复调度，按钮显示下次复习时间预览
- flashcard-adapter.js 修复：分析题答案不再被截断为单字母，保留完整参考答案文本
- flashcard-adapter.js 修复：type 字段保留原始值(single_choice/multi_choice/analysis)，不再强制映射为"单选"
- do-quiz.vue 题型标签中文化：single_choice→单选题、multi_choice→多选题、analysis→分析题、flashcard→闪卡
- do-quiz.vue 两处题目加载逻辑补充 q.explanation 字段映射（之前只有 q.desc/q.description/q.analysis）
- 闪卡翻转动画：淡入+上移+缩放，答案卡片左侧绿色边框标识
- 评分 ≥ 3（记得/简单）触发正确音效和游戏化反馈
- 暗色模式完整适配
- 构建体积不变：1.5MB

## 2026-04-27 — 多科目题库扩充 (Phase 2.5)

- 题库从 1 个扩充到 4 个，闪卡总量从 38 张增至 153 张（+303%）
- 新增英语-2025题库（40张）：阅读理解10 + 完形填空8 + 词汇12 + 新题型2 + 翻译5 + 写作2 + 习语1
- 新增数学-2025题库（40张）：高等数学12 + 线性代数8 + 概率统计8 + 解答题12
- 新增政治-2024题库（35张）：马原6 + 毛中特10 + 史纲4 + 思修4 + 多选题6 + 分析题5
- bank-registry.js 注册全部4个题库，均使用动态 import 懒加载
- 构建验证通过：总体积 1.5MB（+100KB 纯题库数据），主包仍在微信限制内
- 题目覆盖考研核心三大公共课：政治/英语/数学，支持 single_choice/multi_choice/analysis 三种题型

## 2026-04-27 — 微信小程序极简版重构 (Phase 1)

- 3页面UI全部重写（首页/刷题/我的），代码量 6,213行 → 830行（-87%）
- 构建产物总体积 3.4MB → 1.4MB（-59%），主包 1,644KB → 824KB（-50%）
- pages.json 路由精简：22个子包页面 → 4个（do-quiz, question-bank, privacy, terms）
- 移除4个重依赖：markdown-it / katex / @traptitech/markdown-it-katex / canvas-confetti
- 清理16张未使用图片（icons 11张 + practice-sub 5张）+ 4张 onboarding 插画（712KB）
- 删除 onboarding.vue / qq-callback.vue 等6个孤立页面文件
- 为6个已删除 store 和3个已删除 service 创建 MVP stub（保持构建兼容）
- useMarkdownRenderer 替换为纯文本 passthrough stub
- canvas-confetti 引用从 do-quiz.vue / quiz-animation.js / useGamificationEffects.js 移除
- 首页：问候语 + 今日进度 + 累计统计 + 最近学习，纯本地数据源
- 刷题页：题库列表 + 加载 + 开始刷题/智能复习，复用 useFlashcardBank/useBankStatus
- 我的页：头像统计 + 菜单 + APP引流横幅 + 退出登录
- 统一绿色主题 #00B86B，纯CSS无图片依赖，符合 14-MP-UI-REDESIGN-SPEC.md 设计规范

## 2026-04-27 — 百度网盘 API 技术验证 (Phase 0A)

- 完成百度网盘开放平台 API 全面技术验证（详见 `15-BAIDU-API-VALIDATION.md`）
- 确认 API 可用：文件列表、搜索、dlink 下载（有效期 8h）、上传
- 确认目录沙箱：第三方应用只能访问 `/apps/考研大师/`（符合隐私隔离需求）
- 关键结论：百度网盘不能直接当用户端 CDN（需独立 OAuth），只作为管理员存储后端
- 用户端数据源确认为 Laf 云数据库或 APP 内置 JSON（加工后闪卡每科仅几十 KB）
- 测试阶段配额：10 用户 / 10 次/小时（管理员自用足够）
- 识别阻塞项：需手动注册百度开放平台应用获取 AppKey

## 2026-04-27 — 百度网盘工具链搭建 (Phase 2)

- 百度开放平台应用已注册（AppID: 121923947），凭据安全存储于 .env（已 gitignore）
- `scripts/baidu/auth.py` — OAuth 授权工具，支持设备码/授权码/刷新三种模式
  - 设备码模式（推荐）：终端显示链接→浏览器扫码→自动轮询获取 token
  - 授权码模式：oob 回调→粘贴 code→换 token
  - Token 自动写入 .env 的 BAIDU_ACCESS_TOKEN/BAIDU_REFRESH_TOKEN
  - `--status` 查看用户信息 + 网盘容量 + token 状态
- `scripts/baidu/pan.py` — 网盘文件操作工具（ls/search/download/mkdir/info）
  - BaiduPan 类封装全部 API（文件列表/递归列表/搜索/文件详情/dlink 下载）
  - `download-pdfs` 批量下载：自动过滤广告文件 (<50KB / 文件名含广告词)
  - 断点续传 + 大小校验跳过已下载文件
- `scripts/baidu/pipeline.py` — 端到端管线编排（网盘 PDF → 闪卡 JSON）
  - 自动扫描 /apps/考研大师/raw-pdf/ 下新增 PDF
  - 文件名→科目/年份 智能推测（正则匹配）
  - 广告过滤 + 已处理记录（.processed-pdfs.json 避免重复）
  - 串联 pdf2flashcard-v2.py AI 加工 → data/flashcards/ 输出
  - `--dry-run` 预览 / `--reprocess` 重新处理 / `--dir` 指定子目录
- .env.example 新增百度网盘配置模板
- .gitignore 新增 data/raw-pdf/ / data/.processed-pdfs.json / data/pipeline-report.json

## 2026-04-27 — AI加工管线 v2

- 新增 `scripts/pipeline/pdf2flashcard-v2.py` — AI增强版PDF→闪卡管线
- 用 LLM (OpenAI-compatible API) 替代纯正则做题目结构化解析
- AI 自动分离题干/选项/答案/解析，自动区分单选/多选/分析题
- 支持多 LLM 后端：OpenAI / DeepSeek / 智谱 (通过环境变量配置)
- 分批处理 + 重试机制，避免超出上下文窗口和 rate limit
- 自动质量报告：检查答案完整性、选项数量、题型分布
- 保留 v1 脚本 `pdf2flashcard.py` 作为纯本地/离线备用方案

## 2026-04-27 — 政治闪卡数据修复 (Phase 0C)

- 修复 `data/flashcards/政治-2025.json` 全部数据质量问题
- 43张卡片 → 38张（合并5对分析题的题目+参考答案）
- 填充全部 answer 字段（之前全部为空）
- 分离混入选项中的解析文本到 explanation 字段
- 修正 explanation 字段（之前内容与题目不匹配）
- 删除6张卡片的多余/重复选项（5选项→4选项）
- 清除20+处 OCR 伪影（页码、水印标记等）
- 区分题型：single_choice(16) / multi_choice(17) / analysis(5)
- 修复脚本保存为 `scripts/fix-politics-2025.py`

## 2026-04-25 — 文档体系重构

- 将 90 个分散文档整理为 15 个编号文档
- 创建产品战略文档 `01-PRODUCT-VISION.md`
- 合并 SOP 8 文件 → `10-DEV-RULES.md`
- 合并部署文档 5 文件 → `09-DEPLOYMENT-GUIDE.md`
- 合并前端参考 4 文件 → `06-FRONTEND-REFERENCE.md`
- 合并发布记录 → `11-RELEASE-NOTES.md`
- 保留文档重命名编号（02-08）
- 清理旧目录结构
- 建立统一编号体系和总索引

## 2026-04-25 — 产品战略转型

- 从"什么都做的考研小程序"转型为"基于百度网盘的考研闪卡刷题工具"
- 确定三平台策略：iOS/Android(主力) + 微信小程序(轻量入口)
- 确定百度网盘作为免费存储/CDN的技术方案
- 确定baidu-autosave自动转存方案
- 明确版权保护策略：只展示加工后闪卡，不暴露原始PDF
