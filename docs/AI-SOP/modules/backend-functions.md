# Backend Cloud Functions Inventory

> Auto-generated: 2026-03-22 | Last updated: 2026-03-26 (Round 51 TS零错误+group-service修复)
>
> All functions deployed to Laf Cloud (Sealos) + Tencent Cloud (Express/PM2). Each `.ts` file is an independent serverless endpoint.
> Location: `laf-backend/functions/`
>
> **Round 51 修复 (TS 0 错误 + Bug 修复)**:
>
> - **TS 编译 63→0 错误**：12个文件类型标注修复（断言/接口扩展，不改运行时逻辑）
> - `proxy-ai.ts`: `callAIWithFallback` 新增 `action`/`data` 参数，消除 `ctx` 引用错误
> - `group-service.ts`: `handleGetGroups`/`handleGetResources` 分页查询重构为条件对象 + `Promise.all` 并行
> - `ai-diagnosis.ts`: `max_tokens` → `maxTokens`
> - `smart-study-engine.ts`: `authResult.uid` → `authResult.userId`
>
> **Round 49 修复**:
>
> - TS 编译错误 261→63（-76%）：123处相对 import 补 `.js` 扩展名
> - 新增 `types/global.d.ts`：@lafjs/cloud + FunctionContext + nodemailer 类型声明
> - `invite-service.ts`: 新增 sign_link/verify_link action（HMAC-SHA256 签名，密钥不暴露前端）
> - `mistake-manager.ts`: 修复 40 处 `success` 重复属性名
> - `tsconfig.standalone.json`: include 范围添加 types/ 目录
>
> **Round 48 审计修复**:
>
> - `proxy-ai.ts`: 修复 `callAIWithFallback` 未定义 ctx 引用 + 补全提示注入防护 (question/userAnswer/correctAnswer 消毒)
> - `login.ts`: JWT 时间戳修正为标准秒级 (RFC 7519), `JWT_EXPIRES_IN` 改为秒
> - `getHomeData.ts`: 添加 IP 速率限制 (30/min)
> - `cloud-shim.ts`: SSE 并发竞态修复 (AsyncLocalStorage 隔离)
> - `server.ts`: trust proxy + JSON body limit 5MB (上传端点保留50MB) + 请求超时 120s
> - **PM2 配置纳入版本控制**: `deploy/tencent/pm2/ecosystem.config.cjs`

## Shared Modules (`_shared/`)

These modules are imported by cloud functions but are not endpoints themselves.

| Module              | File                                        | Purpose                                                                        |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| Auth (JWT)          | `_shared/auth.ts`                           | JWT sign/verify, password hashing, token extraction                            |
| Auth Middleware     | `_shared/auth-middleware.ts`                | `requireAuth(ctx)` — extracts userId from JWT, returns 401 on failure          |
| Admin Auth          | `_shared/admin-auth.ts`                     | Admin-level authentication for privileged operations                           |
| API Response        | `_shared/api-response.ts`                   | Standard response helpers: `ok()`, `error()`, `unauthorized()`, `badRequest()` |
| Validator           | `_shared/validator.ts`                      | Input validation and sanitization utilities                                    |
| Perf Monitor        | `_shared/perf-monitor.ts`                   | Request timing and performance logging                                         |
| FSRS Scheduler      | `_shared/fsrs-scheduler.ts`                 | Server-side FSRS scheduling (ts-fsrs)                                          |
| Embedding           | `_shared/embedding.ts`                      | Text embedding for RAG vector search                                           |
| Provider Factory    | `_shared/ai-providers/provider-factory.ts`  | Multi-provider AI API rotation (14 providers + 10 DS keys)                     |
| Generation Pipeline | `_shared/generation/generation-pipeline.ts` | AI question generation pipeline                                                |
| State Machine       | `_shared/orchestration/state-machine.ts`    | Multi-agent state machine (IDLE/TEACHING/EXAMINING/REVIEWING)                  |
| Teacher Agent       | `_shared/agents/teacher-agent.ts`           | Teacher agent: concept explanation behavior                                    |
| Student Agent       | `_shared/agents/student-agent.ts`           | Student agent: question-asking behavior                                        |
| Examiner Agent      | `_shared/agents/examiner-agent.ts`          | Examiner agent: testing/grading behavior                                       |
| Agent Types         | `_shared/agents/agent-types.ts`             | TypeScript type definitions for agent system                                   |
| Agent Service       | `_shared/services/agent.service.ts`         | Agent orchestration service layer                                              |
| FSRS Service        | `_shared/services/fsrs.service.ts`          | FSRS scheduling service layer                                                  |

## Cloud Function Endpoints

### Authentication & User Management

| Function        | File                 | Auth  | Purpose                                             |
| --------------- | -------------------- | ----- | --------------------------------------------------- |
| Login           | `login.yaml`         | No    | Unified login (email+code, WeChat, QQ); returns JWT |
| Send Email Code | `send-email-code.ts` | No    | Send verification code to email                     |
| Upload Avatar   | `upload-avatar.ts`   | Yes   | Upload user avatar to object storage                |
| User Stats      | `user-stats.ts`      | Yes   | Get user profile statistics dashboard               |
| Account Delete  | `account-delete.ts`  | Yes   | Request account deletion                            |
| Account Purge   | `account-purge.ts`   | Admin | Permanently purge account data (GDPR)               |

### AI Services

| Function           | File                    | Auth | Purpose                                            |
| ------------------ | ----------------------- | ---- | -------------------------------------------------- |
| AI Proxy           | `proxy-ai.ts`           | Yes  | Multi-provider AI request proxy (core AI hub)      |
| AI Quiz Grade      | `ai-quiz-grade.ts`      | Yes  | AI-powered answer grading for subjective questions |
| AI Photo Search    | `ai-photo-search.yaml`  | Yes  | OCR + AI answer generation from photo              |
| AI Friend Memory   | `ai-friend-memory.yaml` | Yes  | AI friend chat with persistent memory              |
| Agent Orchestrator | `agent-orchestrator.ts` | Yes  | Multi-agent classroom session management           |
| Lesson Generator   | `lesson-generator.ts`   | Yes  | Generate AI lesson content                         |
| RAG Ingest         | `rag-ingest.ts`         | Yes  | Ingest documents into RAG vector store             |

### Practice & Quiz

| Function         | File                  | Auth | Purpose                                   |
| ---------------- | --------------------- | ---- | ----------------------------------------- |
| Question Bank    | `question-bank.yaml`  | Yes  | Question CRUD, search, filter             |
| Answer Submit    | `answer-submit.yaml`  | Yes  | Submit answer with idempotency protection |
| Mistake Manager  | `mistake-manager.ts`  | Yes  | Mistake book CRUD + tag management        |
| Favorite Manager | `favorite-manager.ts` | Yes  | Question favorites CRUD                   |
| FSRS Optimizer   | `fsrs-optimizer.ts`   | Yes  | Server-side FSRS parameter optimization   |
| Rank Center      | `rank-center.yaml`    | Yes  | Leaderboard rankings with rate limiting   |
| PK Battle        | `pk-battle.ts`        | Yes  | PK battle matchmaking, scoring, ELO       |

### Study & Learning

| Function               | File                    | Auth | Purpose                                                                               |
| ---------------------- | ----------------------- | ---- | ------------------------------------------------------------------------------------- |
| Study Stats            | `study-stats.ts`        | Yes  | Study statistics aggregation (daily/weekly/monthly)                                   |
| Learning Goal          | `learning-goal.ts`      | Yes  | Learning goal CRUD + progress tracking                                                |
| Learning Resource      | `learning-resource.ts`  | Yes  | Learning resource recommendations                                                     |
| Material Manager       | `material-manager.ts`   | Yes  | Study material upload/download management                                             |
| **Smart Study Engine** | `smart-study-engine.ts` | Yes  | **7合1智能引擎** (掌握度分析/错题归因/冲刺排序/自适应计划/深度矫正/矫正查询/矫正标记) |
| AI Diagnosis           | `ai-diagnosis.ts`       | Yes  | AI诊断报告生成 + 复习计划推荐                                                         |

#### Smart Study Engine Actions (Round 27)

| Action             | Purpose                                           | Key Algorithm                                               |
| ------------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| `analyze_mastery`  | 各知识点掌握度分析，识别薄弱点                    | M = 0.4×R(FSRS) + 0.6×accuracy (搬运自 knowledge-engine.js) |
| `error_clustering` | 错题按 error_type×category 聚类，计算趋势与严重度 | 聚类 + 30天/60天趋势对比                                    |
| `sprint_priority`  | 冲刺模式 ROI 排序，指导"该放弃什么、重点抓什么"   | ROI = gap×weight / time (搬运自 Leetcode-Mastery-Scheduler) |
| `generate_plan`    | 生成7天自适应学习计划 + 阶段划分                  | 拓扑排序 (搬运自 teable) + FSRS + 时间预算                  |

**搬运来源 (站在前人肩膀上)：**

- FSRS 遗忘曲线 R(t) = (1 + t/(9×S))^(-0.5) → `open-spaced-repetition/ts-fsrs` (MIT, 2.5k+ Stars)
- 余弦相似度 → `vercel/ai` (MIT, 10k+ Stars)
- 拓扑排序 → `teableio/teable` topologicalSort.ts
- 掌握度等级阈值 → `RunMaestro/Maestro` keyboardMastery.ts
- ROI 优先级排序 → `xiaohajiayou/Leetcode-Mastery-Scheduler` (MIT)

### Data Import/Export

| Function    | File             | Auth | Purpose                                   |
| ----------- | ---------------- | ---- | ----------------------------------------- |
| Anki Import | `anki-import.ts` | Yes  | Import .apkg files (SQLite + ZIP parsing) |
| Anki Export | `anki-export.ts` | Yes  | Export questions to .apkg format          |

### School Data

| Function           | File                    | Auth  | Purpose                                       |
| ------------------ | ----------------------- | ----- | --------------------------------------------- |
| School Query       | `school-query.ts`       | No    | School search, detail, provinces, hot schools |
| School Crawler API | `school-crawler-api.ts` | Admin | School data crawling and ingestion            |

### Social Features

| Function            | File                     | Auth | Purpose                                 |
| ------------------- | ------------------------ | ---- | --------------------------------------- |
| Social Service      | `social-service.ts`      | Yes  | Friend requests, accept/reject, status  |
| Group Service       | `group-service.ts`       | Yes  | Study group CRUD, join/leave            |
| Invite Service      | `invite-service.ts`      | Yes  | Invite code generation, reward tracking |
| Achievement Manager | `achievement-manager.ts` | Yes  | Achievement unlocking and tracking      |

### Tool Services (Traffic Acquisition)

| Function         | File                         | Auth | Purpose                              |
| ---------------- | ---------------------------- | ---- | ------------------------------------ |
| Photo BG         | `photo-bg.ts`                | Yes  | Photo background removal/replacement |
| ID Photo Segment | `id-photo-segment-base64.ts` | Yes  | ID photo segmentation and resize     |
| Doc Convert      | `doc-convert.yaml`           | Yes  | Document format conversion           |

### Infrastructure

| Function              | File                         | Auth  | Purpose                               |
| --------------------- | ---------------------------- | ----- | ------------------------------------- |
| Health Check          | `health-check.ts`            | No    | Service health monitoring endpoint    |
| Data Cleanup          | `data-cleanup.ts`            | Admin | Database cleanup and maintenance jobs |
| DB Migrate Timestamps | `db-migrate-timestamps.yaml` | Admin | Database timestamp migration utility  |

## Backend Dependencies

| Package         | Version | Used By                                      |
| --------------- | ------- | -------------------------------------------- |
| `ts-fsrs`       | ^5.2.3  | fsrs-scheduler.ts, fsrs-optimizer.ts         |
| `ai-agent-team` | ^2.0.1  | agent-orchestrator.ts, agent services        |
| `jszip`         | ^3.10.1 | anki-import.ts, anki-export.ts (.apkg = ZIP) |
| `sql.js`        | ^1.14.1 | anki-import.ts (Anki uses SQLite internally) |

## Static Data

| File                                                | Purpose                         |
| --------------------------------------------------- | ------------------------------- |
| `laf-backend/data/schools/schools.json`             | Full school dataset             |
| `laf-backend/data/schools/schools-fixed.json`       | Cleaned school data             |
| `laf-backend/data/schools/schools-by-province.json` | School data grouped by province |
| `laf-backend/data/schools/stats.json`               | School statistics summary       |

## Summary

- **Total cloud functions**: ~35 endpoints
- **Shared modules**: 17 files in `_shared/`
- **Auth-required endpoints**: ~28
- **Public endpoints**: ~4 (login, email-code, school-query, health-check)
- **Admin endpoints**: ~4 (account-purge, school-crawler, data-cleanup, db-migrate)

## Standalone Deployment (独立部署)

> Added: 2026-03-22

### 文件清单

| File                                         | Purpose                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| `laf-backend/standalone/cloud-shim.ts`       | @lafjs/cloud 兼容层 (MongoDB + fetch + storage + SSE) |
| `laf-backend/standalone/server.ts`           | Express 路由服务器 (自动映射云函数)                   |
| `laf-backend/standalone/package.json`        | 独立运行依赖 (express, mongodb, cors, multer)         |
| `laf-backend/standalone/tsconfig.build.json` | TypeScript 编译配置                                   |

### 多服务器部署架构

```
                 Frontend (WeChat MP / H5)
                         │
              ┌──────────▼──────────┐
              │ Nginx (101.43.41.96) │
              │ upstream 主备模式     │
              └──┬──────────────┬───┘
                 │ Primary      │ Backup
        ┌────────▼────┐  ┌─────▼──────────┐
        │ Express/Docker│  │  Sealos Laf     │
        │ Port 3001     │  │  (原生产环境)    │
        └────────┬──────┘  └────────────────┘
                 │
        ┌────────▼────────┐
        │  MongoDB Docker  │
        │  WiredTiger 256MB│
        └─────────────────┘

  CF Worker ← 海外 API 代理
```

### 多项目端口规划

| 项目                | 后端端口 | DB 端口  | Nginx 路径      |
| ------------------- | -------- | -------- | --------------- |
| EXAM-MASTER         | 3001     | 27017    | `/exam-master/` |
| AI Chain Discussion | 3002     | 27018    | `/ai-chain/`    |
| Edu Math            | 3003     | 27019    | `/edu-math/`    |
| Job Bot             | 3004     | (shared) | `/job-bot/`     |
| OpenClaw Bot        | 3005     | (shared) | `/openclaw/`    |

---

## LLM API 号池详情 (Provider Pool)

> Last updated: 2026-03-22
>
> 配置文件: `laf-backend/functions/_shared/ai-providers/provider-factory.ts`
> 环境变量: `laf-backend/.env`

### 架构概览

```
Frontend (ai-router.js)
  → lafService.proxyAI()
    → proxy-ai.ts → 智谱 GLM API (主路径)

Multi-Agent Classroom (agent-orchestrator.ts)
  → provider-factory.ts → getProvider('auto')
    → Round-robin 轮询 14 个 provider

DeepSearch 深搜
  → provider-factory.ts → getDeepSearchProvider()
    → 10 条 SiliconFlow DS Key 轮询 (DeepSeek-V3/R1)
```

### 主池 — Auto 轮询供应商 (14 providers)

| #   | Provider                   | Env Variable                   | Model                              | Free Tier 限制             | 备注                       |
| --- | -------------------------- | ------------------------------ | ---------------------------------- | -------------------------- | -------------------------- |
| 1   | **SiliconFlow (iflow)**    | `SILICONFLOW_API_KEY_1`        | `Qwen/Qwen2.5-7B-Instruct`         | 无限使用                   | iflow.cn 代理端点          |
| 2   | **NVIDIA NIM**             | `NVIDIA_API_KEY`               | `meta/llama-3.3-70b-instruct`      | 1000 credits/月            | OpenAI 兼容                |
| 3   | **Groq**                   | `GROQ_API_KEY`                 | `llama-3.3-70b-versatile`          | 30 RPM, 1K RPD, 12K TPM    | 超快推理                   |
| 4   | **Google Gemini**          | `GEMINI_API_KEY`               | `gemini-2.0-flash-exp`             | 15 RPM free                | v1beta OpenAI 兼容         |
| 5   | **Cerebras**               | `CEREBRAS_API_KEY`             | `llama3.1-8b`                      | 30 RPM, 14.4K RPD, 60K TPM | 超快推理 ~2200 tok/s       |
| 6   | **OpenRouter**             | `OPENROUTER_API_KEY`           | `google/gemini-2.0-flash-exp:free` | $5 free credits            | 聚合网关                   |
| 7   | **Mistral**                | `MISTRAL_API_KEY`              | `mistral-small-latest`             | 1 req/sec free             | 欧洲供应商                 |
| 8   | **Volcengine 豆包**        | `VOLCENGINE_API_KEY`           | `doubao-1-5-lite-32k-250115`       | 按量极低价                 | 火山引擎                   |
| 9   | **Cohere**                 | `COHERE_API_KEY`               | `command-r-plus-08-2024`           | 1000 req/月, 20 RPM        | Trial tier                 |
| 10  | **SiliconFlow Official**   | `SILICONFLOW_OFFICIAL_API_KEY` | `Qwen/Qwen2.5-7B-Instruct`         | 官方端点备用               | api.siliconflow.cn         |
| 11  | **GPT_API_free**           | `GPT_API_FREE_KEY`             | `gpt-3.5-turbo`                    | 200 req/天/IP&Key          | chatanywhere, 仅个人非商用 |
| 12  | **Manus**                  | `MANUS_API_KEY`                | `gpt-4o-mini`                      | 付费                       | —                          |
| 13  | **Zhipu 智谱**             | `AI_PROVIDER_KEY_PLACEHOLDER
| 14  | **SiliconFlow DeepSearch** | `SILICONFLOW_DS_KEY_1~10`      | `deepseek-ai/DeepSeek-V3`          | 10条×14元余额              | 深搜专用,见下方            |

### 深搜专用池 — SiliconFlow DeepSearch Keys

| 配置项   | 值                                                       |
| -------- | -------------------------------------------------------- |
| Key 数量 | 10 条 (`SILICONFLOW_DS_KEY_1` ~ `SILICONFLOW_DS_KEY_10`) |
| 总余额   | 140 元（每条 14 元）                                     |
| 认证状态 | 未实名                                                   |
| 默认模型 | `deepseek-ai/DeepSeek-V3` (~1000 次/key)                 |
| 可选模型 | `deepseek-ai/DeepSeek-R1` (~175 次/key)                  |
| API 端点 | `https://api.siliconflow.cn/v1/chat/completions`         |
| 轮询方式 | `_dsPoolIndex` 独立轮询，不缓存 provider                 |
| **禁止** | 调用 `Pro/` 前缀模型 → 触发 30001 错误 → key 永久报废    |

### 辅助服务 API (非 LLM 轮询池)

| 服务                  | Env Variable                            | 用途              | 限制                |
| --------------------- | --------------------------------------- | ----------------- | ------------------- |
| **Vercel AI Gateway** | `VERCEL_AI_API_KEY`                     | AI 网关           | 付费                |
| **HuggingFace**       | `HUGGINGFACE_API_KEY`                   | 模型推理/部署     | 免费层有限          |
| **Fal.ai**            | `FAL_API_KEY`                           | 图像/视频 AI 生成 | 付费                |
| **Deepgram**          | `DEEPGRAM_API_KEY`                      | 语音识别 ASR      | 免费层有限          |
| **Mem0**              | `MEM0_API_KEY`                          | AI 记忆服务       | 免费层有限          |
| **Kling 快影**        | `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` | AI 视频生成       | 付费                |
| **SerpApi**           | `SERPAPI_KEY`                           | 搜索引擎结果      | 付费                |
| **Brave Search**      | `BRAVE_SEARCH_API_KEY`                  | 隐私搜索 API      | 免费 2000 查询/月   |
| **CloudConvert**      | `CLOUDCONVERT_API_KEY`                  | 文档格式转换      | 25 转换分钟/天 免费 |

### 主路径 — proxy-ai.ts 智谱模型

| 模型          | Max Tokens | Temp | 价格 (input/output per M) | 场景                                       |
| ------------- | ---------- | ---- | ------------------------- | ------------------------------------------ |
| `glm-4.5-air` | 8192       | 0.7  | 5/5 元                    | generate_questions, analyze, adaptive_pick |
| `glm-4-flash` | 4096       | 0.9  | 0.1/0.1 元                | chat, friend_chat, consult (最便宜)        |
| `glm-4-plus`  | 4096       | 0.7  | 50/50 元                  | generation, fallback                       |
| `glm-4v-plus` | 4096       | 0.5  | 50/50 元                  | vision, photo_search                       |

**故障链**: `glm-4.5-air` → `glm-4-plus` → `glm-4-flash` (熔断器: 3次连续失败 → 2分钟冷却)
