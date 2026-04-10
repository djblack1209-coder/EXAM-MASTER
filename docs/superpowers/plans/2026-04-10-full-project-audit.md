# Full Project Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a value-ranked full-project audit for EXAM-MASTER, fix the highest-value issues first, and leave the project in a locally verified, documented, release-ready state.

**Architecture:** The work proceeds in buckets: establish a baseline, scan for production blockers, repair core user journeys, run UI/UX screenshot and interaction verification, then finish with architecture/file governance and documentation alignment. Each bucket closes with evidence-producing verification before the next bucket begins.

**Tech Stack:** uni-app (Vue 3), Pinia, Vite, Vitest, Playwright, Electron, TypeScript cloud/backend functions, Node.js tooling, Markdown docs.

---

## File Map

### Planning and audit outputs

- Create: `docs/superpowers/plans/2026-04-10-full-project-audit.md`
- Modify: `docs/sop/CHANGE-LOG.md`
- Modify: `docs/status/HEALTH.md`
- Optional create: `docs/AI-SOP/modules/full-project-audit-2026-04-10.md`

### Likely frontend high-risk areas

- Modify: `src/App.vue`
- Modify: `src/pages.json`
- Modify: `src/pages/index/index.vue`
- Modify: `src/pages/login/index.vue`
- Modify: `src/pages/practice/index.vue`
- Modify: `src/pages/practice-sub/do-quiz.vue`
- Modify: `src/pages/practice-sub/question-bank.vue`
- Modify: `src/pages/chat/chat.vue`
- Modify: `src/pages/ai-classroom/index.vue`
- Modify: `src/pages/ai-classroom/classroom.vue`
- Modify: `src/pages/school/index.vue`
- Modify: `src/pages/school-sub/ai-consult.vue`
- Modify: `src/pages/profile/index.vue`
- Modify: `src/pages/settings/index.vue`
- Modify: `src/pages/settings/AIChatModal.vue`
- Modify: `src/pages/knowledge-graph/index.vue`
- Modify: `src/components/common/offline-indicator.vue`
- Modify: `src/services/api/domains/*.js`
- Modify: `src/stores/modules/*.js`

### Likely backend / infra high-risk areas

- Modify: `laf-backend/functions/_shared/auth-middleware.ts`
- Modify: `laf-backend/functions/_shared/auth.ts`
- Modify: `laf-backend/functions/proxy-ai.ts`
- Modify: `laf-backend/functions/proxy-ai-stream.ts`
- Modify: `laf-backend/functions/agent-orchestrator.ts`
- Modify: `laf-backend/functions/social-service.ts`
- Modify: `laf-backend/functions/user-profile.ts`
- Modify: `laf-backend/standalone/server.ts`
- Modify: `vite.config.js`
- Modify: `electron/main.cjs`
- Modify: `electron-builder.config.json`

### Verification entry points

- Test: `npm run lint`
- Test: `npm test`
- Test: `npm run build:h5`
- Test: `npm run build:mp-weixin`
- Test: `npm run test:e2e:regression`
- Test: `npm run test:visual`
- Test: `cd laf-backend && npx tsc --project tsconfig.standalone.json`
- Test: `npm run electron:dev`

### Audit discovery entry points

- Read: `docs/status/HEALTH.md`
- Read: `docs/sop/CHANGE-LOG.md`
- Read: `docs/AI-SOP/MODULE-INDEX.md`
- Read: `package.json`
- Read: `src/pages.json`
- Read: `vite.config.js`
- Read: `electron/main.cjs`

---

### Task 1: Establish Baseline And Audit Inventory

**Files:**

- Modify: `docs/AI-SOP/modules/full-project-audit-2026-04-10.md`
- Test: `package.json`
- Test: `src/pages.json`

- [ ] **Step 1: Create the audit inventory note**

Use this structure in `docs/AI-SOP/modules/full-project-audit-2026-04-10.md`:

```md
# Full Project Audit Inventory

## Baseline

- git status:
- lint:
- test:
- build:h5:
- build:mp-weixin:
- backend tsc:
- electron:

## Buckets

- S0:
- S1:
- S2:
- S3:

## Notes

-
```

- [ ] **Step 2: Record current repo and script surface**

Run:

```bash
git status --short && npm run | sed -n '1,220p'
```

Expected: working tree state and script list captured for later verification.

- [ ] **Step 3: Record the baseline quality gate**

Run:

```bash
npm run lint && npm test && npm run build:h5
```

Expected: either all pass, or each failure is recorded with the exact command and error summary in the audit inventory.

- [ ] **Step 4: Record platform baselines**

Run:

```bash
npm run build:mp-weixin && cd laf-backend && npx tsc --project tsconfig.standalone.json
```

Expected: build and backend compile status recorded.

- [ ] **Step 5: Record Electron baseline**

Run:

```bash
npm run electron:dev
```

Expected: Electron launches or fails with a concrete startup error that is recorded.

- [ ] **Step 6: Commit the inventory scaffold**

```bash
git add docs/AI-SOP/modules/full-project-audit-2026-04-10.md docs/superpowers/plans/2026-04-10-full-project-audit.md && git commit -m "[文档] 新增全项目审计实施计划与清单"
```

### Task 2: Run Security And Production-Blocker Scan

**Files:**

- Modify: `docs/AI-SOP/modules/full-project-audit-2026-04-10.md`
- Modify: `.gitignore`
- Modify: `laf-backend/functions/**/*.ts`
- Modify: `src/services/api/domains/*.js`

- [ ] **Step 1: Search for sensitive material and auth gaps**

Run:

```bash
rg -n "(BEGIN RSA PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|JWT_SECRET_PLACEHOLDER
```

Expected: either no tracked secrets are found, or each finding is classified as false positive / real risk in the audit inventory.

- [ ] **Step 2: Search for mock data and fake success paths**

Run:

```bash
rg -n "mock|demoData|fake|stub|TODO|return \{ code: 0|return \{ success: true" src laf-backend
```

Expected: suspicious paths listed for inspection.

- [ ] **Step 3: Search for layer violations and direct request usage**

Run:

```bash
rg -n "_request-core|uni\.request\(|uni\.uploadFile\(" src/pages src/stores src/components
```

Expected: every direct network call outside service/domain layer is flagged.

- [ ] **Step 4: Apply minimal fixes for real S0 findings**

Use this pattern for each fix:

```js
// Before
import { request } from '@/services/api/_request-core';

// After
import { someDomainCall } from '@/services/api/domains/some.api';
```

Expected: only verified S0 or S1 findings are fixed; false positives remain documented, not rewritten.

- [ ] **Step 5: Re-run focused verification for security fixes**

Run:

```bash
npm run lint && npm test
```

Expected: no regression from security or layering fixes.

- [ ] **Step 6: Commit the blocker scan fixes**

```bash
git add .gitignore src laf-backend docs/AI-SOP/modules/full-project-audit-2026-04-10.md && git commit -m "[修复] 清理生产阻断风险与分层违规"
```

### Task 3: Audit Core Navigation And Authentication Journeys

**Files:**

- Modify: `src/App.vue`
- Modify: `src/pages/login/index.vue`
- Modify: `src/pages/profile/index.vue`
- Modify: `src/pages/settings/index.vue`
- Modify: `src/utils/auth/loginGuard.js`
- Test: `tests/**/*auth*`

- [ ] **Step 1: Capture the current auth-related routes and guard logic**

Read and note:

```js
// Files to inspect
src / App.vue;
src / pages / login / index.vue;
src / utils / auth / loginGuard.js;
src / stores / modules / auth.js;
```

Expected: clear note of how unauthenticated users are redirected and how silent login is performed.

- [ ] **Step 2: Run auth-focused tests first**

Run:

```bash
npm test -- auth
```

Expected: either passing auth suite or precise failing tests to drive fixes.

- [ ] **Step 3: Repair the smallest failing auth path**

Use this implementation shape when fixing guard logic:

```js
if (!token) {
  return redirectToLogin({ redirect: currentRoute });
}
```

Expected: redirect, logout, and return-to-origin flows become deterministic.

- [ ] **Step 4: Verify visually with browser automation**

Run:

```bash
npm run test:e2e:regression -- --grep "login|auth|state"
```

Expected: login and guarded-route scenarios pass.

- [ ] **Step 5: Commit core auth fixes**

```bash
git add src/App.vue src/pages/login/index.vue src/pages/profile/index.vue src/pages/settings/index.vue src/utils/auth/loginGuard.js tests && git commit -m "[修复] 收口登录与鉴权核心链路"
```

### Task 4: Audit Practice, FSRS, And Result Flows

**Files:**

- Modify: `src/pages/practice/index.vue`
- Modify: `src/pages/practice-sub/do-quiz.vue`
- Modify: `src/pages/practice-sub/smart-review.vue`
- Modify: `src/pages/practice-sub/question-bank.vue`
- Modify: `src/services/fsrs-service.js`
- Modify: `laf-backend/functions/_shared/fsrs-scheduler.ts`

- [ ] **Step 1: Run practice-related tests to locate failures**

Run:

```bash
npm test -- quiz && npm test -- fsrs
```

Expected: failing test list points to quiz rendering, scoring, or scheduling defects.

- [ ] **Step 2: Walk the core practice UI flows**

Run:

```bash
npm run test:e2e:regression -- --grep "quiz|practice|review|question-bank"
```

Expected: evidence for list loading, question answering, and result page behavior.

- [ ] **Step 3: Fix one concrete failure at a time**

Use this shape for response safety fixes:

```js
const list = res?.data?.list ?? [];
const stats = res?.data?.stats ?? null;
```

Use this shape for scheduler handoff fixes:

```ts
if (!card || !rating) {
  return createErrorResponse('INVALID_FSRS_INPUT');
}
```

Expected: result, review, and scheduling data become null-safe and deterministic.

- [ ] **Step 4: Re-run targeted tests and one build**

Run:

```bash
npm test -- quiz && npm test -- fsrs && npm run build:h5
```

Expected: focused regressions cleared without breaking H5 build.

- [ ] **Step 5: Commit practice fixes**

```bash
git add src/pages/practice/index.vue src/pages/practice-sub/do-quiz.vue src/pages/practice-sub/smart-review.vue src/pages/practice-sub/question-bank.vue src/services/fsrs-service.js laf-backend/functions/_shared/fsrs-scheduler.ts tests && git commit -m "[修复] 打通刷题与FSRS核心链路"
```

### Task 5: Audit AI Chat, AI Classroom, And AI Rendering

**Files:**

- Modify: `src/pages/chat/chat.vue`
- Modify: `src/pages/ai-classroom/index.vue`
- Modify: `src/pages/ai-classroom/classroom.vue`
- Modify: `src/pages/settings/AIChatModal.vue`
- Modify: `src/services/streamService.js`
- Modify: `laf-backend/functions/proxy-ai.ts`
- Modify: `laf-backend/functions/proxy-ai-stream.ts`
- Modify: `laf-backend/functions/agent-orchestrator.ts`

- [ ] **Step 1: Run AI-focused tests or grep for AI coverage**

Run:

```bash
rg -n "chat|markdown|classroom|stream|thinking" tests src/pages src/components
```

Expected: identify existing automated coverage and likely weak spots.

- [ ] **Step 2: Exercise AI UI flows and rendering states**

Run:

```bash
npm run test:e2e:regression -- --grep "chat|classroom|ai"
```

Expected: send/reply/thinking/render flows either pass or produce concrete failures.

- [ ] **Step 3: Apply minimal fixes for rendering and request safety**

Use this pattern for stream state cleanup:

```js
try {
  await streamService.send(payload);
} finally {
  isThinking.value = false;
}
```

Use this pattern for markdown fallback safety:

```js
const content = typeof message?.content === 'string' ? message.content : '';
```

Expected: AI loading state never hangs, and malformed payloads do not break rendering.

- [ ] **Step 4: Re-run focused UI and unit verification**

Run:

```bash
npm test -- chat && npm run test:e2e:regression -- --grep "chat|classroom|ai"
```

Expected: AI chain regressions are closed.

- [ ] **Step 5: Commit AI flow fixes**

```bash
git add src/pages/chat/chat.vue src/pages/ai-classroom/index.vue src/pages/ai-classroom/classroom.vue src/pages/settings/AIChatModal.vue src/services/streamService.js laf-backend/functions/proxy-ai.ts laf-backend/functions/proxy-ai-stream.ts laf-backend/functions/agent-orchestrator.ts tests && git commit -m "[修复] 收口AI对话与课堂交互链路"
```

### Task 6: Audit School, Social, Data Management, And Tools

**Files:**

- Modify: `src/pages/school/index.vue`
- Modify: `src/pages/school-sub/ai-consult.vue`
- Modify: `src/pages/social/friend-list.vue`
- Modify: `src/pages/social/friend-profile.vue`
- Modify: `src/pages/favorite/index.vue`
- Modify: `src/pages/mistake/index.vue`
- Modify: `src/pages/plan/index.vue`
- Modify: `src/pages/plan/create.vue`
- Modify: `src/pages/tools/photo-search.vue`
- Modify: `src/pages/tools/doc-convert.vue`
- Modify: `src/pages/tools/id-photo.vue`
- Modify: `src/pages/tools/focus-timer.vue`

- [ ] **Step 1: Run route-cluster smoke checks**

Run:

```bash
npm run test:e2e:regression -- --grep "school|friend|favorite|mistake|plan|photo|doc|focus"
```

Expected: cluster-specific failures are surfaced without guessing.

- [ ] **Step 2: Capture empty, loading, and failure states**

Use Playwright or page-level checks to verify these UI states exist:

```js
// Examples to confirm in each target page
const items = res?.data?.list ?? [];
const hasItems = items.length > 0;
```

Expected: every list-like page has a safe empty state and a visible error path.

- [ ] **Step 3: Fix missing UX feedback and null-safe access**

Use this pattern:

```js
catch (error) {
  toast.info('加载失败，请稍后重试')
}
```

Expected: failures reach the user instead of disappearing into logs.

- [ ] **Step 4: Re-run cluster verification**

Run:

```bash
npm run lint && npm run test:e2e:regression -- --grep "school|friend|favorite|mistake|plan|photo|doc|focus"
```

Expected: no broken pages remain in these route groups.

- [ ] **Step 5: Commit cluster fixes**

```bash
git add src/pages/school src/pages/school-sub src/pages/social src/pages/favorite src/pages/mistake src/pages/plan src/pages/tools tests && git commit -m "[修复] 补齐择校社交数据与工具页面可用性"
```

### Task 7: Run Full UI/UX Screenshot And Theme Audit

**Files:**

- Modify: `src/styles/_design-tokens.scss`
- Modify: `src/styles/_dark-mode-vars.scss`
- Modify: `src/design/theme-engine.js`
- Modify: `src/components/**/*.vue`
- Modify: `src/pages/**/*.vue`

- [ ] **Step 1: Generate baseline screenshots for visible surfaces**

Run:

```bash
npm run test:visual
```

Expected: screenshot diffs or current baselines reveal visual regressions.

- [ ] **Step 2: Verify dark and light theme behavior on high-risk pages**

Run:

```bash
npm run test:visual -- --grep "theme|index|login|practice|chat|settings|knowledge"
```

Expected: theme-related failures are isolated to concrete pages.

- [ ] **Step 3: Fix visual regressions with token-first changes**

Use this pattern:

```scss
color: var(--text-primary);
background: var(--bg-card);
border-color: var(--border);
```

Avoid this pattern:

```scss
color: #3c3c3c;
background: #ffffff;
```

Expected: visual fixes improve both themes at once and do not introduce new hard-coded colors.

- [ ] **Step 4: Re-run visual verification and only update intended baselines**

Run:

```bash
npm run test:visual
```

Expected: only intentional UI changes remain.

- [ ] **Step 5: Commit UI/UX audit fixes**

```bash
git add src/styles src/design src/components src/pages tests && git commit -m "[优化] 完成全量界面截图与主题一致性修复"
```

### Task 8: Audit Architecture, File Governance, And Redundancy

**Files:**

- Modify: `src/pages/**/*.vue`
- Modify: `src/stores/modules/*.js`
- Modify: `src/services/api/domains/*.js`
- Modify: `.gitignore`
- Modify: `docs/AI-SOP/MODULE-INDEX.md`

- [ ] **Step 1: Search for dead files, temporary assets, and broken paths**

Run:

```bash
rg -n "visual-|dark-|gemini-|h5-" . && rg -n "from '.*common.*'|from \".*common.*\"" src && rg -n "TODO|FIXME|XXX" src laf-backend
```

Expected: temporary artifacts, stale imports, and deferred cleanup markers are classified.

- [ ] **Step 2: Search for oversized high-risk files that still need containment notes**

Run:

```bash
python - <<'PY'
from pathlib import Path
for p in Path('src').rglob('*.*'):
    if p.suffix in {'.vue','.js','.ts'}:
        lines = sum(1 for _ in p.open('r', encoding='utf-8', errors='ignore'))
        if lines >= 1500:
            print(f"{lines:5d} {p}")
PY
```

Expected: a short list of very large files is documented for future decomposition.

- [ ] **Step 3: Apply small governance fixes, not broad speculative refactors**

Use this pattern for removing accidental tracked artifacts:

```gitignore
visual-*.png
dark-*.png
h5-*.png
```

Expected: file governance improves without unrelated restructuring.

- [ ] **Step 4: Update module index or governance notes when reality changed**

Use this shape:

```md
- **Audit note**: `src/pages/practice-sub/do-quiz.vue` remains oversized and should be decomposed during feature work, not in this audit bucket.
```

Expected: docs reflect the current state instead of stale assumptions.

- [ ] **Step 5: Commit governance cleanup**

```bash
git add .gitignore docs/AI-SOP/MODULE-INDEX.md src docs/AI-SOP/modules/full-project-audit-2026-04-10.md && git commit -m "[优化] 收口文件治理与架构审计记录"
```

### Task 9: Run Release-Level Verification

**Files:**

- Test: entire repo

- [ ] **Step 1: Run the required quality gate**

Run:

```bash
npm run lint && npm test && npm run build:h5
```

Expected: all three pass.

- [ ] **Step 2: Run cross-platform and backend verification**

Run:

```bash
npm run build:mp-weixin && cd laf-backend && npx tsc --project tsconfig.standalone.json
```

Expected: both pass.

- [ ] **Step 3: Run regression suites based on actual change scope**

If UI changed, run:

```bash
npm run test:visual
```

If page logic changed, run:

```bash
npm run test:e2e:regression
```

If changes became cross-cutting (5+ files, backend, config, or wide refactor), run:

```bash
npm run test:qa:full-regression
```

Expected: the highest required verification level for the actual change set passes.

- [ ] **Step 4: Re-check Electron startup if Electron-related files changed**

Run:

```bash
npm run electron:dev
```

Expected: no startup blocker remains.

- [ ] **Step 5: Commit final verification-only adjustments if needed**

```bash
git add . && git commit -m "[配置] 完成全项目审计后的发布级验证收口"
```

### Task 10: Update Health, Changelog, And Audit Summary

**Files:**

- Modify: `docs/sop/CHANGE-LOG.md`
- Modify: `docs/status/HEALTH.md`
- Modify: `docs/AI-SOP/modules/full-project-audit-2026-04-10.md`

- [ ] **Step 1: Append the change log entry with evidence**

Use this shape in `docs/sop/CHANGE-LOG.md`:

```md
## [2026-04-10] 全项目价值位阶审计与收口

- **Scope**: `frontend` `backend` `infra` `docs` `security`
- **Files Changed**: <actual files>
- **Summary**: 按价值位阶完成生产风险、核心链路、UI/UX、架构治理、构建验证的全量审计与修复。
- **Breaking Changes**: <if any>
- **Quality Gate**: <actual evidence>
```

- [ ] **Step 2: Update HEALTH.md with remaining issues only**

Use this shape:

```md
| H0XX | 🔴/🟠/🟡 | domain | title | since | owner |
```

Expected: resolved items move to “Recently Resolved”, remaining blockers are accurate and minimal.

- [ ] **Step 3: Finalize the audit inventory note**

Use this structure:

```md
## Final Outcome

- Fixed:
- Verified:
- Deferred:
- Next remote/server steps:
```

- [ ] **Step 4: Run a docs-only sanity check**

Run:

```bash
git diff -- docs/sop/CHANGE-LOG.md docs/status/HEALTH.md docs/AI-SOP/modules/full-project-audit-2026-04-10.md docs/superpowers/plans/2026-04-10-full-project-audit.md
```

Expected: docs reflect the work that actually happened.

- [ ] **Step 5: Commit audit documentation**

```bash
git add docs/sop/CHANGE-LOG.md docs/status/HEALTH.md docs/AI-SOP/modules/full-project-audit-2026-04-10.md docs/superpowers/plans/2026-04-10-full-project-audit.md && git commit -m "[文档] 更新全项目审计结果与系统健康状态"
```

---

## Self-Review

### Spec coverage

Covered:

- Production blockers and security scan
- Core user journeys and API correctness
- Full UI/UX screenshot and interaction verification
- Architecture and file governance cleanup
- H5 / MP / backend / Electron verification
- Health and change-log documentation

Potential gap intentionally called out:

- Remote push, CI/CD result observation, and server-side runtime checks are excluded from this plan because the confirmed boundary for this round is local-only. Those actions should be a follow-up execution phase after local verification is green.

### Placeholder scan

Removed generic placeholders such as “fix as needed” and replaced them with concrete commands, file groups, implementation shapes, and expected outcomes. Optional files remain explicitly marked optional instead of vague TODOs.

### Type consistency

Terminology is kept consistent across tasks:

- S0/S1/S2/S3 severity buckets
- `lint`, `test`, `build:h5`, `build:mp-weixin`, backend `tsc`, Electron startup
- `CHANGE-LOG.md`, `HEALTH.md`, and audit inventory note as the canonical outputs

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-10-full-project-audit.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
