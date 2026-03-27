# AI-SOP Standard Operating Rules

> **DEPRECATED** — This file has been superseded by the new three-layer doc system.
>
> New locations:
>
> - Iron Rules → `docs/sop/AI-DEV-RULES.md`
> - Update Protocol → `docs/sop/UPDATE-PROTOCOL.md`
> - Change Log → `docs/sop/CHANGE-LOG.md`
> - Health/Bugs → `docs/status/HEALTH.md`
>
> This file is kept for reference only. Do not edit.

---

> Version: 1.1 | Last updated: 2026-03-22 (DEPRECATED 2026-03-23)

## Rule 0: Documentation Filing Law (ABSOLUTE — No Override)

**所有文档必须在 AI-SOP 资料库框架下管理。这是最底层规则，优先级高于所有其他规则。**

### 0.1 文档归类规则

| 文档类型         | 必须放入的位置                   | 命名规则                                 |
| ---------------- | -------------------------------- | ---------------------------------------- |
| 项目概览/架构    | `docs/AI-SOP/`                   | `PROJECT-BRIEF.md`, `ARCHITECTURE.md`    |
| 模块详情报告     | `docs/AI-SOP/modules/`           | `kebab-case.md` (如 `frontend-pages.md`) |
| 功能设计规格书   | `docs/superpowers/specs/`        | `YYYY-MM-DD-feature-name-design.md`      |
| 执行计划         | `docs/superpowers/plans/`        | `YYYY-MM-DD-feature-name-plan.md`        |
| 发布说明         | `docs/releases/`                 | `release-vX.Y.Z.md`                      |
| 当前活跃报告     | `docs/reports/current/`          | `kebab-case.md`                          |
| 历史报告(不可变) | `docs/reports/history/YYYY-MM/`  | 保留原始文件名                           |
| 归档记录         | `docs/archive/`                  | 按时间段分目录                           |
| 运维文档         | `deploy/docs/` 或 `laf-backend/` | 就近放置，不移入 AI-SOP                  |
| AI工具配置       | `.claude/`                       | 工具自管理，不移动                       |

### 0.2 禁止行为

- **禁止**在项目根目录放置任何 `.md` 文档（`README.md` 除外）
- **禁止**在 `src/` 内放置文档文件
- **禁止**创建 `docs/` 体系之外的新文档目录
- **禁止**使用中文文件名（用 kebab-case 英文，内容可以是中文）
- **禁止**修改 `docs/reports/history/` 中的历史文件

### 0.3 命名规范

- 全部使用 `kebab-case` 小写命名：`api-documentation.md`
- 日期前缀格式：`YYYY-MM-DD`
- 版本号格式：`vX.Y.Z`
- 中文内容文件也用英文命名：`wx-submission-checklist.md`（内容可以是中文）

### 0.4 更新链

任何代码修改完成后，必须按顺序执行：

```
1. 更新 docs/AI-SOP/modules/ 中涉及的模块报告
2. 写入 docs/AI-SOP/CHANGE-LOG.md
3. 如果新增了页面/服务/组件：更新 PROJECT-BRIEF.md 的关键路径表
4. 如果架构变化：更新 ARCHITECTURE.md
5. 如果新增了模块类型：更新 MODULE-INDEX.md
```

**不执行更新链 = 工作未完成。**

---

## Rule 1: Read Before Code

Before ANY code change:

1. Read `docs/AI-SOP/PROJECT-BRIEF.md` first to understand the project
2. Read the relevant module report in `docs/AI-SOP/modules/` for the area you're modifying
3. Check `docs/AI-SOP/CHANGE-LOG.md` for recent changes that may affect your work

**Why**: Prevents redundant work, avoids breaking recent fixes, and ensures awareness of project conventions.

---

## Rule 2: Locate Before Fix

When a bug is reported:

1. Use `docs/AI-SOP/MODULE-INDEX.md` to find relevant files
2. Do NOT scan the entire project directory tree
3. Read the specific files identified in the module index
4. If the module index doesn't cover the area, update it after you've located the files

**Why**: Saves context window tokens and reduces the chance of modifying the wrong file.

---

## Rule 3: Update After Change

After completing any change:

1. Update the relevant module report in `docs/AI-SOP/modules/`
2. Add an entry to `docs/AI-SOP/CHANGE-LOG.md` with:
   - Date
   - Scope (frontend/backend/fullstack/docs)
   - Files changed
   - Summary of what and why
   - Any breaking changes
3. If architecture changed (new service, new store, new page), update `docs/AI-SOP/ARCHITECTURE.md`
4. If new key files were created, update the "Key File Paths" table in `docs/AI-SOP/PROJECT-BRIEF.md`

**Why**: Keeps documentation accurate for the next AI session.

---

## Rule 4: Verify Before Claim

Before claiming any fix is complete:

1. Run the appropriate build command:
   - H5: `npm run build:h5`
   - WeChat MP: `npm run build:mp-weixin`
2. Run relevant tests:
   - Unit: `npm test`
   - E2E: `npm run test:e2e:regression`
3. Check for lint errors: `npm run lint`

**Why**: Prevents shipping broken code and saves a round-trip debugging session.

---

## Rule 5: No Dead Code

1. Every file created must be imported somewhere
2. Every dependency added must be used
3. Every function exported must be called
4. Run cleanup check before finishing:
   - Verify new imports are connected
   - Verify no orphan files were created

**Why**: Dead code accumulates and confuses future AI sessions.

---

## Rule 6: Follow Project Conventions

### Naming

- Page files: `kebab-case.vue` (e.g., `do-quiz.vue`, `friend-list.vue`)
- Component files: `PascalCase.vue` (e.g., `ChatBox.vue`, `StatsGrid.vue`)
- Service files: `kebab-case.js` (e.g., `fsrs-service.js`)
- Store files: `kebab-case.js` (e.g., `learning-trajectory-store.js`)
- Utility files: `kebab-case.js` (e.g., `question-normalizer.js`)
- Composable files: `useXxx.js` (e.g., `useStreamChat.js`)

### Code Style

- Use `<script setup>` for new components (Composition API)
- Use Pinia `defineStore()` with setup function syntax for new stores
- Use JSDoc comments for public functions
- Use `logger` instead of `console.log` (from `@/utils/logger.js`)
- Use `storageService` instead of direct `uni.setStorageSync` calls
- Use `lafService` facade instead of direct API domain imports

### API Calls

- All API calls go through `lafService` or domain services
- Never hardcode API URLs in components
- Use request options for retry/cache behavior
- Handle errors with try/catch and user-facing toast messages

### Styling

- Use CSS custom properties (variables) for all colors
- Reference design tokens from `_design-tokens.scss`
- Support dark mode via `_dark-mode-vars.scss` mixin
- Use `rpx` for mini program sizing, `px` for absolute sizes
- Avoid inline styles; use scoped `<style lang="scss">` blocks

---

## Rule 7: Respect the Architecture

### Layer Boundaries

```
Pages → call → Composables / Stores / Services
Components → receive → props, emit events
Services → handle → API calls, business logic
Stores → manage → global state
```

- Pages should NOT directly call `uni.request()`
- Components should NOT import services directly (pass data via props)
- Stores should NOT contain UI logic (no `uni.showToast` in stores)
- Services should NOT access Vue reactivity (no `ref()` in services)

### Backend Boundaries

- Cloud functions are stateless
- All auth goes through `requireAuth()` middleware
- All responses use `api-response.ts` helpers
- Each function handles one endpoint; shared logic goes in `_shared/`

---

## Rule 8: Size Budget (WeChat MP)

WeChat Mini Program has a 2MB main package limit:

- Check main package size after changes: `npm run audit:mp-main-usage`
- Heavy dependencies should be in subPackages, not main package
- Use conditional imports (`#ifdef MP-WEIXIN`) for platform-specific code
- Large composables/utils should be moved to relevant subPackage folders

---

## Rule 9: Test Coverage

When adding new features:

1. Add unit tests in `tests/unit/` (Vitest)
2. Add E2E test scenarios in `tests/e2e-regression/` if page-level behavior changes
3. Update visual snapshots if UI changed: `npm run test:visual:update`
4. Run full regression before major releases: `npm run test:qa:full-regression`

---

## Rule 10: Security Checklist

Before any change involving auth, data, or API:

- [ ] No API keys in frontend code (use `lafService.proxyAI()`)
- [ ] All backend endpoints use `requireAuth()` for protected operations
- [ ] User input is validated (use `_shared/validator.ts`)
- [ ] No IDOR vulnerabilities (verify userId matches JWT)
- [ ] Sensitive data is not logged (no tokens in `logger.log()`)

---

## Rule 11: Project Cleanliness Law (ABSOLUTE — No Override)

**项目文件结构必须始终保持干净整洁。这是最底层规则。**

### 11.1 项目根目录规则

根目录只允许存在以下文件类型：

- 配置文件：`package.json`, `vite.config.js`, `pages.json`, `manifest.json`, `.env*`, `*.config.js`
- 入口文件：`main.js`, `App.vue`
- 标准文件：`README.md`, `.gitignore`, `.dockerignore`, `.editorconfig`, `.prettierrc`
- 锁文件：`package-lock.json`

**禁止**在根目录放置：临时脚本、测试输出、调试文件、一次性修复脚本

### 11.2 生成物管理

以下目录必须在 `.gitignore` 中，不得提交：

```
test-results/    test-screenshots/    coverage/
tmp/             logs/                backups/
dist/            unpackage/           node_modules/
```

### 11.3 归类检查

每次 AI 会话结束前，检查是否产生了需要归类的文件：

```
find . -maxdepth 1 -name "*.md" -not -name "README.md" | head
find . -maxdepth 1 -name "*.sh" -o -name "*.cjs" -o -name "*.mjs" | head
```

如有散落文件，立即归类到对应目录。

### 11.4 依赖卫生

- `package.json` 中的每个依赖必须有至少一处 import
- 每次安装新依赖后，必须在同一会话中使用它
- 会话结束前运行依赖审计：确认无死依赖

---

## Enforcement

**Rule 0 和 Rule 11 是绝对底层规则：**

- 任何 AI 助手在任何情况下都必须遵守
- 不可因时间压力、范围限制或其他理由跳过
- 违反这两条规则的工作视为**未完成**
