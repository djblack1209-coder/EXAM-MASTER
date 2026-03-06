# EXAM-MASTER Single Source (V1.0.0)

Last updated: 2026-03-02
Purpose: Single reference for AI development, debugging, release, and ops.

## 1) Current release snapshot

- Release target: WeChat mini-program submission (`V1.0.0`).
- Git baseline commits:
  - `f73b065` runtime stabilization (mp error handler + Laf cold-start retry hardening)
  - `c8e4f05` security hardening and release readiness
  - `d7b842b` release baseline doc update
  - `519c1c8` final pre-submission verification evidence
  - `dbc2505` CI fix for `@lafjs/cloud` resolution in Vitest
- GitHub branch status should be `main...origin/main` (no ahead/behind).

## 2) Architecture and key directories

- Frontend: `uni-app + Vue3 + Pinia`
  - Core: `src/`
  - Services: `src/services/`
  - Stores: `src/stores/`
  - Utils: `src/utils/`
- Backend: Laf cloud functions (TS-only)
  - Functions: `laf-backend/functions/*.ts`
  - Shared modules: `laf-backend/functions/_shared/`
- Build output:
  - WeChat import dir: `dist/build/mp-weixin`
  - H5 output: `dist/build/h5`

## 3) Runtime/toolchain baseline

- Node: `20.17.0`
- npm: `10.8.2`
- `packageManager`: `npm@10.8.2`
- CI workflow: `.github/workflows/ci-cd.yml`

## 4) Mandatory quality gates

Run in repo root:

```bash
npm run audit:laf:function-sources -- --strict
npm run lint
npm test
npm run build:h5
npm run build:mp-weixin
npm run audit:mp-main-usage
node scripts/build/verify-wechat-artifacts.mjs
npm run test:cloud:smoke
```

Optional but recommended:

```bash
npm run audit:deep-scan
npm run audit:ui-quality
```

## 5) Cloud deployment and verification

Workdir: `laf-backend/`

```bash
/Users/blackdj/.npm-global/bin/laf func list
/Users/blackdj/.npm-global/bin/laf func push <function-name>
/Users/blackdj/.npm-global/bin/laf func push
```

Post-deploy minimum checks:

```bash
curl -sS "https://nf98ia8qnt.sealosbja.site/health-check"
npm run test:cloud:smoke
```

## 6) Critical fixes already in V1.0.0

- mp runtime crash fixed:
  - issue: `storageService.js.then is not a function`
  - file: `src/utils/error/global-error-handler.js`
  - fix: static import of `storageService` (no dynamic import/require.then path)
- Laf cold-start resilience improved:
  - file: `src/services/lafService.js`
  - `coldStartRetries` default `6`
  - retry on 404 signatures: `Function Not Found` / `Cannot POST` / `Not Found`
- Backend hardening deployed:
  - `laf-backend/functions/_shared/api-response.ts`
  - `laf-backend/functions/ai-friend-memory.ts`
  - `laf-backend/functions/proxy-ai.ts`
  - `laf-backend/functions/send-email-code.ts`
- CI failure fixed (latest):
  - issue: Vitest in GitHub Actions failed resolving `@lafjs/cloud`
  - fix files:
    - `vitest.config.js`
    - `tests/__mocks__/lafjs-cloud.js`

## 7) API/auth contract (debug essentials)

- Base URL: `https://nf98ia8qnt.sealosbja.site`
- Pattern: `POST` JSON + `action` dispatch
- Standard response:

```json
{
  "code": 0,
  "success": true,
  "message": "success",
  "data": {}
}
```

- Auth rules:
  - Protected endpoints require `Authorization: ${AUTH_HEADER}
  - Expected auth semantics:
    - no token -> `401`
    - forbidden/mismatch -> `403`

High-signal smoke endpoints:

- `POST /health-check`
- `POST /proxy-ai` with `{ "action": "health_check" }`
- `POST /question-bank` with `{ "action": "random", "data": { "count": 1 } }`
- `POST /ai-friend-memory` (auth behavior and field clamp checks)

## 8) Debug playbook (fast triage)

- If CI `Lint & Test` fails with `Failed to resolve import "@lafjs/cloud"`:
  - verify alias exists in `vitest.config.js`
  - verify `tests/__mocks__/lafjs-cloud.js` exists
- If WeChat startup crashes with `.then is not a function`:
  - ensure `global-error-handler.js` uses static import for storage service
- If cloud returns intermittent 404 (`Function Not Found`):
  - retry with backoff; treat as cold-start/gateway jitter first
  - verify with `npm run test:cloud:smoke`

## 9) Release backup (V1.0.0 official)

- Snapshot root: `backups/V1.0.0正式版-20260302-070316`
- Artifacts:
  - `artifacts/EXAM-MASTER-V1.0.0正式版-source.tar.gz`
  - `artifacts/EXAM-MASTER-V1.0.0正式版-laf-functions.tar.gz`
  - `artifacts/EXAM-MASTER-V1.0.0正式版-mp-weixin-dist.tar.gz`
- Integrity:
  - `meta/SHA256SUMS.txt`
- Final gate evidence:
  - `gates/final-*.log`

## 10) Security policy (must follow)

- Never store plaintext secrets in docs, code, or git history.
- Secrets only in platform env vars / GitHub Secrets / local untracked env files.
- If any key is exposed, rotate immediately and invalidate old credentials.

## 11) Documentation policy (from now)

- This file is the only active source for AI development/debugging.
- Other docs in `docs/` are treated as historical/reference only.
