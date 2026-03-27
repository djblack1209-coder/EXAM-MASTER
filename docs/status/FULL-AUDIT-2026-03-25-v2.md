# EXAM-MASTER 全维度深度审计报告 v2

> **审计日期**: 2026-03-25
> **审计方法**: 5 个并行审计代理全量扫描 + 人工复核
> **审计范围**: 安全·架构·后端·前端·数据库·运维·性能·UI/UX·测试·文档（10大维度）
> **项目规模**: 36 页面 · 50+ 组件 · 45 云函数 · 16 Store · 90+ 环境变量 · 19 数据库集合

---

## 综合健康度评分

| 维度   | 评分     | 说明                                    |
| ------ | -------- | --------------------------------------- |
| 安全   | ★★★☆☆ 60 | 密钥管理规范，但 Git 历史有泄露，需轮换 |
| 架构   | ★★★★☆ 75 | 分层清晰，双服务器容灾，但存在上帝对象  |
| 后端   | ★★★★☆ 78 | 功能完备，认证安全，但有重复代码        |
| 前端   | ★★★☆☆ 65 | 功能丰富，但超大文件、Mixin 残留严重    |
| 数据库 | ★★★★☆ 72 | Schema 定义齐全，但部分集合缺 Schema    |
| 运维   | ★★★★★ 88 | CI/CD 5条流水线，完备的监控告警体系     |
| 性能   | ★★★☆☆ 62 | 主包超限 50%，ECharts 已优化但仍需瘦身  |
| UI/UX  | ★★★★☆ 76 | 设计系统完备，暗黑模式支持，毛玻璃美学  |
| 测试   | ★★★★☆ 80 | 1205 单测全绿，E2E/视觉/Maestro 全覆盖  |
| 文档   | ★★★★★ 90 | 11 模块文档 + 40 轮变更日志 + 完整 SOP  |

---

## 第一维度：安全审计（Security Engineering）

### 🔴 Critical（必须立即处理）

| ID        | 问题                                           | 位置                                           | 影响                       | 可否自动修复      |
| --------- | ---------------------------------------------- | ---------------------------------------------- | -------------------------- | ----------------- |
| **S-C01** | Git 历史中暴露了微信 AppSecret                 | `git log -S WX_SECRET_PLACEHOLDER
| **S-C02** | Git 历史中暴露了旧 JWT_SECRET_PLACEHOLDER
| **S-C03** | GitHub Token `ghp_Dj...` 存在于本地 .env.local | `.env.local` 第 20 行                          | 可操作 GitHub 仓库         | ❌ 需人工撤销     |
| **S-C04** | Sealos PAT 存在于本地 .env/.env.local          | 多个本地文件                                   | 可操作 Sealos 平台         | ❌ 需人工轮换     |

### 🟠 High

| ID        | 问题                                                            | 位置                             | 可否自动修复  |
| --------- | --------------------------------------------------------------- | -------------------------------- | ------------- |
| **S-H01** | MongoDB 默认连接无认证回退                                      | `standalone/cloud-shim.ts:21`    | ✅ 可修复     |
| **S-H02** | `VITE_INVITE_SECRET` 编译到前端 JS 可被逆向                     | `src/config/index.js:466`        | ⚠️ 需架构调整 |
| **S-H03** | `utils/validator.ts` 未同步 P0 安全修复（RegExp lastIndex bug） | `laf-backend/utils/validator.ts` | ✅ 可修复     |

### 🟢 Good（做得好的地方）

- 全部 `.env` 文件在 `.gitignore` 中
- 后端全部 API Key 通过 `process.env` 读取
- JWT 使用 `crypto.timingSafeEqual` 防时序攻击
- 管理员鉴权双模式（JWT role + x-admin-secret）
- `anomaly-detector.ts` 检测 NoSQL 注入/XSS/暴力破解
- 前端不持有 ADMIN_SECRET / JWT_SECRET_PLACEHOLDER
- Trivy + npm audit 定期安全扫描

---

## 第二维度：架构审计（Software Architecture）

### 🔴 Critical

| ID        | 问题                                                         | 影响                                  |
| --------- | ------------------------------------------------------------ | ------------------------------------- |
| **A-C01** | `ai.service.js` (2475 行, 91 个方法) 是"上帝对象"            | 所有 API 调用集中一处，改一个影响全部 |
| **A-C02** | `do-quiz.vue` (3193 行) / `pk-battle.vue` (3305 行) 超级组件 | 维护极难，影响编辑器性能和构建速度    |

### 🟠 High

| ID        | 问题                                                                      | 影响               | 可否自动修复 |
| --------- | ------------------------------------------------------------------------- | ------------------ | ------------ |
| **A-H01** | 后端 `validator.ts` 和 `perf-monitor.ts` 各有 2 份重复代码                | 改一处忘另一处     | ✅ 可合并    |
| **A-H02** | 3 个 Mixin 未迁移为 Composable（Vue 2 反模式残留）                        | 违反 Vue 3 规范    | ✅ 可迁移    |
| **A-H03** | 6 个页面文件（3326 行）有代码但未注册路由                                 | 死代码，导航会报错 | ✅ 可清理    |
| **A-H04** | 根目录 `App.vue`/`main.js` 与 `src/` 版本存在分歧（过时副本）             | 构建混乱           | ✅ 可清理    |
| **A-H05** | `common/config.js` 与 `src/common/config.js` 100% 重复                    | 混乱               | ✅ 可清理    |
| **A-H06** | 5 个空目录（services/api/core、services/modules、3 个 components 子目录） | 项目噪音           | ✅ 可清理    |

### 🟢 Good

- 前后端分层清晰：Router/Page → Component → Store → Service → Backend
- 双服务器架构（Tencent Cloud 主 + Sealos Laf 备）
- Cloudflare Worker 海外 API 代理解决"墙"的问题
- 多 Agent 系统设计（Teacher/Student/Examiner + 状态机编排）
- FSRS v6 间隔重复算法服务端实现

---

## 第三维度：后端审计（Backend Engineering）

### 🟠 High

| ID        | 问题                                                                 | 可否自动修复              |
| --------- | -------------------------------------------------------------------- | ------------------------- |
| **B-H01** | `cloud-shim.ts` (701 行) 实现了完整的 MongoDB QueryBuilder，复杂度高 | ⚠️ 已稳定运行，不建议大改 |
| **B-H02** | `storageService.js` (1631 行) 混合了存储基础设施和错题本业务         | ✅ 可拆分                 |
| **B-H03** | 部分 MongoDB 集合在代码中使用但无 Schema 定义（约 18 个）            | ✅ 可补充                 |

### 🟡 Medium

| ID        | 问题                                                                | 说明                             |
| --------- | ------------------------------------------------------------------- | -------------------------------- |
| **B-M01** | `voice-service.ts` / `material-manager.ts` 标注未启用但仍在路由注册 | 浪费启动时间                     |
| **B-M02** | standalone 入口文件 `server.ts` (347 行) 承担过多职责               | 路由注册 + 中间件 + 错误处理混杂 |

---

## 第四维度：前端审计（Frontend Engineering）

### 🔴 Critical

| ID        | 问题                                   | 影响               |
| --------- | -------------------------------------- | ------------------ |
| **F-C01** | 微信 MP 主包 ~3.0MB，超出 2MB 限制 50% | **无法发布到微信** |

### 🟠 High

| ID        | 问题                                                 | 可否自动修复            |
| --------- | ---------------------------------------------------- | ----------------------- |
| **F-H01** | 73 个文件仍用 Options API（HEALTH.md H003）          | ⚠️ 工作量大，需逐步迁移 |
| **F-H02** | `_deprecated/useF2Chart.js.bak` 残留                 | ✅ 可删除               |
| **F-H03** | `common/styles/common.scss` (311行) 未被 `src/` 引用 | ✅ 可清理               |

### 🟡 Medium

| ID        | 问题                                                                          | 说明                                          |
| --------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| **F-M01** | `checkin-streak.js` (567行) + `streak-recovery.js` (615行) 功能高度关联但分离 | 可考虑合并或保持                              |
| **F-M02** | 84 个 SVG 图标以独立文件存在                                                  | 转 icon font 可减约 250KB（对主包大小有帮助） |

---

## 第五维度：数据库审计（Data Engineering）

### 🟡 Medium

| ID        | 问题                                                    | 说明                               |
| --------- | ------------------------------------------------------- | ---------------------------------- |
| **D-M01** | 19 个有 Schema 定义的集合 vs 代码中实际使用约 37 个集合 | 约 18 个集合缺失 Schema 文档       |
| **D-M02** | 索引创建通过 `db-create-indexes.ts` 管理                | 设计合理，但需验证生产环境实际索引 |

### 🟢 Good

- 幂等性保护（`idempotency_records` 集合 + 24h TTL）
- 审计日志（`security_audit_logs`）
- 时间戳类型迁移工具（`db-migrate-timestamps.ts`）
- 数据清理工具支持 dry-run + 自动备份

---

## 第六维度：运维审计（DevOps / SRE）

### 🟡 Medium

| ID        | 问题                                 | 说明                       |
| --------- | ------------------------------------ | -------------------------- |
| **O-M01** | Nginx 无 HSTS 头（D038）             | HTTP 降级攻击风险          |
| **O-M02** | Nginx 直连路径缺安全头（D037）       | XSS/Clickjacking 风险      |
| **O-M03** | PM2 单实例部署                       | 2核2G 服务器限制，无法扩展 |
| **O-M04** | SSL 证书 Let's Encrypt 90 天自动续期 | 需确认 certbot timer 正常  |

### 🟢 Good（非常出色）

- 5 条 GitHub Actions 流水线（CI/CD + 安全扫描 + 备份 + 每夜回归 + 小程序 E2E）
- Prometheus + Grafana + AlertManager 完整监控栈
- 20+ 条告警规则（3 级路由：企业微信/钉钉/邮件）
- MongoDB 备份恢复脚本（全量/增量/时间点恢复）
- 服务器初始化脚本（UFW + Fail2Ban + Docker + Swap）
- 应急响应手册（P0-P3 分级 + 6 类故障 SOP + 复盘模板）

---

## 第七维度：性能审计（Performance Engineering）

### 🔴 Critical

| ID        | 问题          | 影响     |
| --------- | ------------- | -------- |
| **P-C01** | MP 主包 3.0MB | 见 F-C01 |

### 🟡 Medium

| ID        | 问题                                             | 说明                         |
| --------- | ------------------------------------------------ | ---------------------------- |
| **P-M01** | ECharts 已做按需构建（节省约 900KB）但仍是大依赖 | 可考虑轻量替代（如 uCharts） |
| **P-M02** | `ai.service.js` 2475 行全量加载                  | Tree-shaking 无法优化单文件  |
| **P-M03** | Tencent Cloud 内存 ~950MB / 1.9GB                | 余量不大                     |

---

## 第八维度：UI/UX 审计

### 🟡 Medium

| ID        | 问题                                                   | 说明         |
| --------- | ------------------------------------------------------ | ------------ |
| **U-M01** | 11 个页面视觉回归截图不匹配（H010）                    | 需更新基准图 |
| **U-M02** | ai-classroom/onboarding 缺基准截图（H011）             | 需首次截图   |
| **U-M03** | 设计系统存在 3 个版本 (`design-system.scss` / v2 / mp) | 应统一       |

### 🟢 Good

- 完整的 CSS 变量体系（`:root` 配色 + 语义化别名）
- 深色模式支持（@media + .dark 类双重机制）
- Apple Glass 毛玻璃效果系统
- 两套主题（Wise / Bitget）+ 主题引擎
- wot-design-uni 组件库统一 UI 风格
- 响应式布局 + 多端适配

---

## 第九维度：测试审计（QA Engineering）

### 🟡 Medium

| ID        | 问题                           | 说明           |
| --------- | ------------------------------ | -------------- |
| **T-M01** | E2E 聊天页降级交互超时（H012） | 需修复         |
| **T-M02** | E2E 测试稳定性差（D014）       | 需优化等待策略 |

### 🟢 Good

- 1205 单元测试全绿（Vitest 4）
- Playwright 视觉回归测试
- Playwright E2E 兼容性 + 回归测试
- Maestro 移动端冒烟测试
- miniprogram-automator 小程序 E2E
- 30+ 安全审计测试
- 每夜自动回归（QA Nightly）

---

## 第十维度：文档审计（Technical Writing）

### 🟢 Excellent

- PROJECT-INDEX.md — 全景导航
- HEALTH.md — 82 个已解决 + 12 个活跃问题追踪
- 11 个模块文档（前端页面/组件/服务/Store/后端函数/Schema/API/工具/脚本/样式/测试）
- 40+ 轮变更日志
- 完整部署手册 + 应急响应手册
- AI 开发铁律（SOP-RULES）
- CLAUDE.md 项目指令文件

---

## 可自动修复 vs 需人工处理 分类汇总

### ✅ 可自动修复（共 14 项）

| 编号  | 问题                                | 修复方案                                    |
| ----- | ----------------------------------- | ------------------------------------------- |
| S-H01 | MongoDB 无认证回退                  | `cloud-shim.ts` 中 MONGODB_URI 缺失时抛错   |
| S-H03 | validator.ts RegExp 安全修复未同步  | 合并到一份文件                              |
| A-H01 | validator.ts / perf-monitor.ts 重复 | 统一为一份，其他文件 import                 |
| A-H03 | 6 个未注册路由的页面                | 移入 `_unreleased/` 或删除                  |
| A-H04 | 根目录 App.vue/main.js 过时副本     | 删除根目录版本                              |
| A-H05 | common/config.js 重复               | 删除根目录版本                              |
| A-H06 | 5 个空目录                          | 删除                                        |
| F-H02 | \_deprecated/useF2Chart.js.bak      | 删除                                        |
| F-H03 | common/styles/common.scss 未引用    | 确认无引用后删除                            |
| O-M01 | Nginx 无 HSTS                       | 添加 `add_header Strict-Transport-Security` |
| O-M02 | Nginx 直连路径缺安全头              | 添加安全头到 location 块                    |

### ❌ 必须人工接管（共 11 项）

| 编号         | 问题                             | 需要什么                                    | 最省力方案                             |
| ------------ | -------------------------------- | ------------------------------------------- | -------------------------------------- |
| **S-C01**    | 微信 AppSecret 在 Git 历史中泄露 | 登录微信公众平台重置 AppSecret              | 5 分钟，微信后台 → 开发管理 → 重置     |
| **S-C02**    | 旧 JWT_SECRET_PLACEHOLDER
| **S-C03**    | GitHub Token 泄露                | GitHub Settings → Developer settings → 撤销 | 3 分钟                                 |
| **S-C04**    | Sealos PAT 泄露                  | Sealos 控制台重新生成 PAT                   | 3 分钟                                 |
| **F-C01**    | MP 主包 3MB 超限                 | 需要分析构建产物并优化分包策略              | 30-60 分钟，可在下轮对话处理           |
| **F-H01**    | 73 个文件 Options API 迁移       | 逐文件改为 `<script setup>`                 | 估计 3-5 小时，可分批                  |
| **A-C01**    | ai.service.js 上帝对象拆分       | 按领域拆分为 6-8 个 service 文件            | 2-3 小时                               |
| **A-C02**    | do-quiz/pk-battle 超大组件拆分   | 提取子组件和 composables                    | 3-4 小时                               |
| **O-M04**    | SSL 证书自动续期确认             | SSH 到服务器检查 certbot timer              | 5 分钟                                 |
| **U-M01**    | 视觉回归基准图更新               | 本地运行 Playwright 截图                    | 10 分钟                                |
| **Git 清理** | 从 Git 历史中彻底删除密钥        | 运行 BFG Repo-Cleaner + force push          | 需谨慎操作，可能影响协作者             |
