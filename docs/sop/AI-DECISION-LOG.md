# AI 决策日志（黑匣子）

> **用途**：记录重大技术决策的原因和被否决方案，避免新AI会话重蹈覆辙
> **规则**：AI在做出下列类型决策时，必须在本文件追加一条记录
> **读取时机**：每个新AI会话开始任务前，必须先读本文件获取历史上下文

## 必须记录的决策类型

1. **架构选择** — 选了方案A不选方案B/C
2. **依赖选择** — 为什么用这个库不用那个库
3. **重构方案** — 为什么这样重构不那样重构
4. **Bug修复** — 根因分析和修复策略选择（尤其是修了2次以上的bug）
5. **性能权衡** — 为什么在性能和可读性之间这样取舍
6. **安全决策** — 为什么采取这种安全措施
7. **放弃决策** — 为什么决定不做某个功能/不修某个bug

## 记录格式

```
### DEC-XXX: [决策标题]
- **日期**：YYYY-MM-DD
- **决策者**：AI会话 / 用户指示
- **背景**：（用大白话说，为什么需要做这个决策）
- **选项分析**：
  - 方案A：[描述] — 优点/缺点
  - 方案B：[描述] — 优点/缺点
  - 方案C（如果有）：[描述] — 优点/缺点
- **最终选择**：方案X
- **选择理由**：（一句话总结为什么选这个）
- **注意事项**：（未来AI会话需要知道的陷阱或限制条件）
- **关联文件**：[受此决策影响的文件列表]
```

## 查询索引

| ID      | 日期       | 领域      | 标题                                                       | 关键词                          |
| ------- | ---------- | --------- | ---------------------------------------------------------- | ------------------------------- |
| DEC-001 | 2026-03-29 | 架构/重构 | lafService 彻底重构而非渐进包装                            | lafService, API分层, domain API |
| DEC-002 | 2026-03-29 | 架构/配置 | 游戏常量集中到 game-constants.js                           | 常量, 配置碎片化, XP, 成就      |
| DEC-003 | 2026-03-29 | 架构/重构 | offline-cache-service.js 重新实现而非删除                  | 离线缓存, 空文件, 运行时崩溃    |
| DEC-004 | 2026-03-29 | 性能      | H5 vendor 拆分用 manualChunks 而非 vite-plugin-compression | 首屏性能, bundle拆分, gzip      |
| DEC-005 | 2026-03-29 | 安全      | 全局路由守卫用 uni.addInterceptor 而非页面级 onLoad 检查   | 路由守卫, 鉴权, XSS             |
| DEC-006 | 2026-03-29 | 架构      | PK Battle API 重写为后端实际 action 而非修补前端调用       | PK对战, API断链, action名       |
| DEC-007 | 2026-03-29 | 放弃决策  | 放弃 vite-plugin-compression，Nginx 实时 gzip 够用         | gzip, 预压缩, D030              |

---

## 决策记录

（以下为历史决策，按时间倒序排列，新记录追加到最前面）

---

### DEC-005: 全局路由守卫用 uni.addInterceptor 而非页面级 onLoad 检查

- **日期**：2026-03-29
- **决策者**：AI会话（十四轮审计）
- **背景**：H5环境下用户可以直接在浏览器输入URL访问需要登录的页面（比如AI对话页），绕过登录白嫖Token。需要一个统一的登录拦截机制。
- **选项分析**：
  - 方案A：每个页面的 onLoad 里加登录检查 — 优点：简单直接 / 缺点：36个页面要改，漏一个就是安全漏洞，后续新增页面也容易忘
  - 方案B：App.vue 用 uni.addInterceptor 拦截 navigateTo/redirectTo — 优点：一处配置全局生效，维护白名单即可 / 缺点：需要维护白名单列表
- **最终选择**：方案B
- **选择理由**：一个地方管所有页面的权限，比在36个文件里各写一遍靠谱得多
- **注意事项**：白名单目前14个公开页面，新增公开页面（如活动页）必须加入白名单，否则未登录用户访问会被拦截
- **关联文件**：`src/App.vue`（initRouteGuard函数）

---

### DEC-004: H5 vendor 拆分用 manualChunks 而非 vite-plugin-compression

- **日期**：2026-03-29
- **决策者**：AI会话（十五轮审计）
- **背景**：H5首屏加载的JS文件有443KB（gzip后149KB），太大了。需要优化首屏加载速度。
- **选项分析**：
  - 方案A：安装 vite-plugin-compression 做构建时gzip预压缩 — 优点：文件更小 / 缺点：Nginx已经有实时gzip，效果有限；多一个依赖
  - 方案B：vite.config.js 配置 manualChunks 把 Vue/Pinia/uni-app 运行时拆成独立vendor包 — 优点：vendor包独立缓存，用户二次访问只需加载业务代码 / 缺点：首次加载请求数增加
- **最终选择**：方案B
- **选择理由**：入口JS从443KB降到135KB（减69.5%），vendor包可以长期缓存，对回访用户提升巨大
- **注意事项**：manualChunks 仅在H5平台生效（通过 `process.env.UNI_PLATFORM === 'h5'` 判断），微信小程序有自己的分包机制不能混用
- **关联文件**：`vite.config.js`（manualChunks配置）

---

### DEC-003: offline-cache-service.js 重新实现而非删除

- **日期**：2026-03-29
- **决策者**：AI会话（架构清爽化重构 Task 5）
- **背景**：`offline-cache-service.js` 是一个0字节的空文件，但有2个composable在import它。空文件 = 运行时崩溃。要么删掉（然后修改2个消费者），要么补上实现。
- **选项分析**：
  - 方案A：删除空文件 + 修改2个消费者移除依赖 — 优点：少一个文件 / 缺点：离线缓存能力直接没了，以后要加还得重写
  - 方案B：实现完整的离线缓存服务（isOnline/getCachedQuestions/cacheQuestions/addToSyncQueue） — 优点：功能完整，PWA离线可用 / 缺点：需要写新代码
- **最终选择**：方案B
- **选择理由**：离线缓存对PWA和弱网环境（地铁里刷题）是核心功能，补上比删掉有价值
- **注意事项**：旧的 `offline-cache.js` 返回boolean，新的 `checkOfflineAvailability()` 返回 `{ available, isOnline }` 对象。`do-quiz.vue` 有一层重定向适配
- **关联文件**：`src/services/offline-cache-service.js`, `src/pages/practice-sub/do-quiz.vue`

---

### DEC-002: 游戏常量集中到 game-constants.js 而非继续分散

- **日期**：2026-03-29
- **决策者**：AI会话（架构清爽化重构 Task 1）
- **背景**：XP奖励值、等级经验公式、连续签到倍率、成就定义这些游戏化常量分散在4个不同文件里（gamification.js、useXPSystem.js、learning-analytics.js、checkin-streak.js）。改一个值要改4个地方，而且容易改漏导致数据不一致。
- **选项分析**：
  - 方案A：在 config/index.js 里加一个 game 配置块 — 优点：复用现有配置体系 / 缺点：config/index.js 已经很大了（18个配置键），游戏常量和系统配置混在一起不清晰
  - 方案B：新建 config/game-constants.js 专门管游戏常量 — 优点：职责分离，游戏策划改数值只看这一个文件 / 缺点：多一个配置文件
- **最终选择**：方案B
- **选择理由**：游戏常量变动频率高（调平衡），和系统配置（超时/重试）性质不同，分开更好维护
- **注意事项**：所有游戏化数值（XP奖励、等级公式、签到倍率、成就解锁条件）必须从 game-constants.js 读取，禁止在消费者文件里写魔法数字
- **关联文件**：`src/config/game-constants.js`, `src/stores/modules/gamification.js`, `src/composables/useXPSystem.js`, `src/utils/learning-analytics.js`, `src/composables/checkin-streak.js`

---

### DEC-001: lafService 迁移采用方案B（彻底重构）而非方案A（渐进包装）

- **日期**：2026-03-29
- **决策者**：AI会话（架构清爽化重构 Task 4）
- **背景**：项目早期所有API调用都通过一个叫 `lafService` 的中间层。后来我们建了按业务领域划分的API文件（ai.api.js、practice.api.js等），但40多个文件还在调旧的lafService。相当于新路修好了，但大家还在走老路。
- **选项分析**：
  - 方案A：渐进包装 — 保留lafService，让它内部调用新的domain API，对外接口不变 — 优点：不动现有代码，风险低 / 缺点：多了一层转发，lafService变成"翻译层"永远无法删除，新开发者更困惑
  - 方案B：彻底重构 — 所有Store/Page/Service直接调用domain API，lafService归零 — 优点：代码路径清晰，少一层调用 / 缺点：要改40+文件，风险较高
- **最终选择**：方案B
- **选择理由**：长痛不如短痛。包装层会让代码越来越难懂，新AI会话看到两套API调用方式会更混乱
- **注意事项**：lafService.js 文件保留但0生产导入（263个测试引用仍在用它做mock），禁止新代码再导入lafService。如果未来看到 `import { lafService }` 出现在非测试文件中，那是Bug
- **关联文件**：`src/services/lafService.js`（已废弃，仅测试用）、`src/services/api/domains/*.api.js`（正确路径）、7个Store + 8个Page + 17个Service文件（已迁移）

---

### DEC-006: PK Battle API 重写为后端实际 action 而非修补前端调用

- **日期**：2026-03-29
- **决策者**：AI会话（五轮审计）
- **背景**：social.api.js 里有4个PK对战函数（createPKRoom/joinPKRoom/getPKRoomStatus/submitPKResult），但它们用的action名后端根本不认识，调了也是白调——永远返回"不支持的操作"。
- **选项分析**：
  - 方案A：让后端加上前端期望的action名 — 优点：前端不用改 / 缺点：后端已有成熟的7个action，加重复功能是浪费
  - 方案B：重写前端API函数，对齐后端实际支持的7个action（find_match/poll_room/submit_result/room_answer/leave_room/get_records/calculate_elo） — 优点：和后端完全对齐，一次修好 / 缺点：前端调用方全部需要更新
- **最终选择**：方案B
- **选择理由**：后端的action设计更合理（比如用find_match而非createPKRoom），前端应该适配后端而非反过来
- **注意事项**：PK对战的完整流程是 find_match → poll_room（轮询等对手） → room_answer（提交答案） → submit_result（提交最终结果）。如果未来改PK逻辑，先看后端pk-battle.ts支持哪些action
- **关联文件**：`src/services/api/domains/social.api.js`, `laf-backend/functions/pk-battle.ts`

---

### DEC-007: 放弃 vite-plugin-compression，Nginx 实时 gzip 够用

- **日期**：2026-03-29
- **决策者**：AI会话（十六轮审计，D030评估）
- **背景**：有人建议安装 vite-plugin-compression 在构建时生成 .gz 文件，这样 Nginx 可以直接发送预压缩文件而不用实时压缩。听起来能提升性能。
- **选项分析**：
  - 方案A：安装 vite-plugin-compression — 优点：理论上省掉Nginx实时压缩的CPU开销 / 缺点：多一个构建依赖，构建产物翻倍（每个文件多一个.gz），Nginx已经配好了gzip且服务器CPU完全够用
  - 方案B：维持现状，Nginx实时gzip — 优点：零改动，已在线运行稳定 / 缺点：理论上多一点CPU开销（但实际可忽略）
- **最终选择**：方案B（维持现状）
- **选择理由**：服务器CPU利用率很低，Nginx实时gzip完全够用，引入新依赖的风险大于收益
- **注意事项**：如果未来服务器CPU吃紧或并发量大幅增长，可以重新考虑预压缩方案。当前记录为技术债D030但优先级低
- **关联文件**：`vite.config.js`, `/etc/nginx/conf.d/exam-master.conf`
