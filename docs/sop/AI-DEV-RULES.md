# AI Development Rules — Iron Laws

> Version: 2.0 | 迁移自 `docs/AI-SOP/SOP-RULES.md`
>
> These rules govern how AI assistants work with the EXAM-MASTER codebase.
> **Violation of any rule = immediate rollback.**

---

## Rule 1: Read Before Code

Before writing ANY code, read these files in order:

1. `CLAUDE.md` — 30-second project overview
2. `docs/status/HEALTH.md` — current bugs and deploy status
3. `docs/AI-SOP/MODULE-INDEX.md` — locate relevant files

## Rule 2: Locate Before Fix

Never guess file locations. Use `docs/AI-SOP/MODULE-INDEX.md` to find the exact file for your task.

## Rule 3: Layer Discipline

```
Router/Page → Component → Store → Service → Backend
```

- Pages call Components and Stores
- Stores call Services
- Services call `uni.request()` → Backend
- **NO skipping layers** (e.g., Page directly calling backend)

## Rule 4: Documentation Filing Law

| Document type    | Must go in                | Naming                                |
| ---------------- | ------------------------- | ------------------------------------- |
| Project overview | `docs/AI-SOP/`            | `PROJECT-BRIEF.md`, `ARCHITECTURE.md` |
| Module reports   | `docs/AI-SOP/modules/`    | `kebab-case.md`                       |
| Change log       | `docs/sop/CHANGE-LOG.md`  | Append only                           |
| Bug tracking     | `docs/status/HEALTH.md`   | Edit in place                         |
| Design specs     | `docs/superpowers/specs/` | `YYYY-MM-DD-name-design.md`           |
| Release notes    | `docs/releases/`          | `release-vX.Y.Z.md`                   |

### FORBIDDEN

- `.md` files at project root (except `README.md`, `CLAUDE.md`)
- Docs inside `src/`
- Chinese filenames (use kebab-case English, content can be Chinese)
- New doc directories outside `docs/`

## Rule 5: Security Checklist

Before every commit:

- [ ] No API keys in frontend code
- [ ] No `.env` files with real keys committed
- [ ] `requireAuth(ctx)` on all authenticated endpoints
- [ ] No `JWT_SECRET_PLACEHOLDER
- [ ] scrypt for passwords, never SHA256/MD5

## Rule 6: WeChat MP Size Budget

Main package MUST stay under **2MB**.

- Use `npm run build:mp-weixin` and check
- Heavy libs go in subPackages (ECharts custom build saves ~900KB)
- Composables/utils move to subpackage when needed

## Rule 7: Code Style

- `<script setup>` Composition API (no Options API for new code)
- Pinia stores: `defineStore` with setup syntax
- File names: `kebab-case.vue`, `kebab-case.js`
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Components: `PascalCase`
- Use `wot-design-uni` components before building custom
- UnoCSS atomic classes preferred, no inline styles

## Rule 8: Backend Rules

- Every cloud function: `export default async function(ctx) { ... }`
- Always call `requireAuth(ctx)` for authenticated endpoints
- Use `createLogger()` + `checkRateLimitDistributed()` from `api-response.ts`
- AI requests: only through `proxy-ai.ts` or `provider-factory.ts`
- FSRS scheduling: server-side only via `fsrs-scheduler.ts`
- SiliconFlow: **NEVER** call `Pro/` prefix models (key death)

## Rule 9: Completion Protocol

After finishing ANY task, execute all 4 steps from `CLAUDE.md` → Completion Protocol section. No exceptions.

## Rule 10: Verify Before Claim

- Run `npm run build:mp-weixin` for frontend changes
- Run `npx tsc --project tsconfig.standalone.json` for backend changes
- Test the specific endpoint you changed with `curl`
- Never say "done" without evidence
