# EXAM-MASTER

> AI 助力，一战成硕 — 考研备考小程序

## 30 秒速览

| Field         | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| **Product**   | 考研备考小程序 (Graduate Exam Prep App)                                     |
| **Stack**     | uni-app (Vue 3.4) + Express/PM2 (standalone) + Laf Cloud (Sealos) + MongoDB |
| **Platforms** | WeChat Mini Program (primary), QQ MP, H5 (PWA), App                         |
| **Language**  | JavaScript (frontend) / TypeScript (backend cloud functions)                |
| **Node**      | >= 20.17.0                                                                  |
| **Status**    | Production — dual-server (Tencent Cloud + Sealos Laf)                       |

## Must-Read Docs (按优先级)

| Priority | File                          | When to Read                                     |
| -------- | ----------------------------- | ------------------------------------------------ |
| **P0**   | `docs/PROJECT-INDEX.md`       | Every session — project nav map                  |
| **P1**   | `docs/status/HEALTH.md`       | Before any work — bugs, tech debt, deploy status |
| **P2**   | `docs/sop/AI-DEV-RULES.md`    | Before writing code — iron rules                 |
| **P3**   | `docs/AI-SOP/ARCHITECTURE.md` | When touching architecture                       |
| **P4**   | `docs/AI-SOP/MODULE-INDEX.md` | When locating files for a fix                    |
| **P5**   | `docs/AI-SOP/modules/*.md`    | Deep-dive into specific modules                  |

## Key Commands

```bash
# Frontend
npm run dev:h5                    # H5 dev server
npm run dev:mp-weixin             # WeChat MP dev
npm run build:h5                  # H5 production build
npm run build:mp-weixin           # WeChat MP build

# Backend (Tencent Cloud)
# 本地编译 → 上传 → PM2 重启
cd laf-backend && npx tsc --project tsconfig.standalone.json
ssh root@101.43.41.96 'pm2 restart exam-master'

# Backend (Sealos Laf)
cd laf-backend && laf func push   # Deploy all cloud functions

# Testing
npm test                          # Unit tests (Vitest)
npm run test:visual               # Visual regression (Playwright)
npm run test:e2e:regression       # E2E regression
npm run lint && npm run format    # Lint + format
```

## Architecture (30-Second Version)

```
Frontend (uni-app Vue 3)
    │
    ├─ Pages (36) → Components (50+) → Stores (Pinia)
    │
    └─ Services (lafService → api/domains/*.api.js → _request-core.js)
           │
           ├─ PRIMARY: https://api.245334.xyz (Tencent Cloud)
           │      Nginx → PM2/Express → MongoDB Docker
           │
           └─ FALLBACK: https://nf98ia8qnt.sealosbja.site (Sealos Laf)
                   47 TypeScript cloud functions

海外 API 代理: https://api-gw.245334.xyz (CF Worker, 14 providers)
```

## Iron Rules

### Directory Red Lines

- **NO** `.md` files at project root (except `README.md`, `CLAUDE.md`)
- **NO** docs inside `src/` — all docs live in `docs/`
- **NO** Chinese filenames — use kebab-case English
- **NO** API keys in frontend code — all keys in backend `.env`

### Architecture Constraints

- **Layer order**: Router/Page → Component → Store → Service → Backend. No skipping.
- **All AI requests** go through `proxy-ai.ts` (backend) or `ai.api.js` (frontend, via lafService aggregation)
- **FSRS scheduling**: server-side only via `fsrs-scheduler.ts`, never client-side
- **WeChat MP main package** must stay under 2MB

### Security Red Lines

- **NEVER** commit `.env` files with real keys
- **NEVER** expose `JWT_SECRET_PLACEHOLDER
- **NEVER** skip `requireAuth(ctx)` on authenticated endpoints
- `laf-backend/.env` is in `.gitignore` — verify before every push

## Completion Protocol (Every Task)

When finishing ANY task, you MUST follow these 4 steps:

### Step 1: Update Change Log

```markdown
## [YYYY-MM-DD] Brief Title

- **Scope**: [frontend|backend|ai-pool|deploy|auth|database|docs|infra]
- **Files Changed**: list
- **Summary**: what and why
- **Breaking Changes**: any API/behavior changes
```

Write to: `docs/sop/CHANGE-LOG.md`

### Step 2: Update Affected Module Docs

If code changed in `src/pages/` → update `docs/AI-SOP/modules/frontend-pages.md`
If code changed in `laf-backend/` → update `docs/AI-SOP/modules/backend-functions.md`

### Step 3: Update System Health

- New bug discovered → add to `docs/status/HEALTH.md` Active Issues
- Bug fixed → move to Resolved section with solution

### Step 4: Self-Check

- [ ] Code compiles without errors
- [ ] No hardcoded secrets in committed files
- [ ] Change log entry written
- [ ] Affected docs updated

## Known Pitfalls

1. **WeChat MP size limit** — `npm run build:mp-weixin` then check. ECharts custom build at `src/utils/echarts-custom.js` saves ~900KB
2. **`@lafjs/cloud` on standalone** — Tencent Cloud uses `cloud-shim.ts`. After TS compile, must run `perl` import rewrite for `.js` extensions
3. **SiliconFlow DS keys** — 10 pre-paid keys (`SILICONFLOW_DS_KEY_1~10`). NEVER call `Pro/` prefix models → triggers 30001 error → key permanently dead
4. **MongoDB on Laf** — No explicit connection string. Uses `cloud.database()` internally. Tencent Cloud uses standard `MONGODB_URI`
5. **canvas-confetti** — Broken on WeChat MP. Use `mp-confetti.js` (CSS animation) instead
6. **`_.or()` in MongoDB queries** — Must pass to `.where()` as top-level operator. `cloud-shim.ts` handles this correctly after audit fix

## Config File Locations

| Config           | Path                                                 |
| ---------------- | ---------------------------------------------------- |
| Frontend env     | `.env.development`, `.env.production`                |
| Backend env      | `laf-backend/.env`                                   |
| Vite build       | `vite.config.js`                                     |
| Page routes      | `pages.json`                                         |
| uni-app manifest | `manifest.json`                                      |
| Nginx (Tencent)  | `/opt/nginx/conf.d/exam-master.conf`                 |
| PM2              | `/opt/apps/exam-master/backend/ecosystem.config.cjs` |
| CF Worker        | `deploy/tencent/cf-worker/worker.js`                 |
| SSL cert         | `/etc/letsencrypt/live/api.245334.xyz/`              |
