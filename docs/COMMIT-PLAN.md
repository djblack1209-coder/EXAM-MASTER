# Commit Plan (v2.1.2)

> Updated: 2026-02-27

## Context

Current worktree contains large cross-module changes. To reduce review risk, split commits by concern and keep each commit independently verifiable.

## Recommended split order

1. `fix(backend): harden token and userId enforcement`
2. `fix(frontend): stabilize runtime config and storage logging`
3. `refactor(ui): normalize Vue template lint style`
4. `test(audit): migrate e2e-flow specs to audit/integration suites`
5. `docs: update project report and changelog for v2.1.2`

## Suggested staging scopes

### 1) Backend security hardening

- `laf-backend/functions/*`
- `laf-backend/utils/*`
- `laf-backend/triggers/*`
- `laf-backend/database-schema/*`
- `laf-backend/package.json`

Validation before commit:

- `npx vitest run tests/unit/audit-*.spec.js`

### 2) Frontend runtime fixes

- `main.js`
- `src/config/index.js`
- `src/utils/core/config-validator.js`
- `src/services/storageService.js`
- `src/pages/practice-sub/do-quiz.vue`
- `src/pages/practice/index.vue`

Validation before commit:

- `npx vitest run tests/unit/storage-service.spec.js tests/unit/integration-storage-nav.spec.js`

### 3) UI lint normalization

- `src/components/**`
- `src/pages/**`
- `src/mixins/**`
- `src/styles/**`

Validation before commit:

- `npm run lint`
- `npm run build:mp-weixin`

### 4) Test suite restructuring

- `tests/unit/e2e-*` deletions
- `tests/unit/audit-*` additions/updates
- `tests/unit/integration-*` additions/updates
- related updates: `tests/unit/real-utils.spec.js`, `tests/unit/storage-service.spec.js`

Validation before commit:

- `npx vitest run tests/unit`

### 5) Reports and project docs

- `docs/PROJECT-REPORT.md`
- `CHANGELOG.md`
- `PROJECT_DEEP_SCAN_REPORT.md`
- `.vscode/ui-quality-report.json`

Validation before commit:

- Ensure audit outputs match latest run timestamp.

## Suggested commit commands

```bash
git add laf-backend/functions laf-backend/utils laf-backend/triggers laf-backend/database-schema laf-backend/package.json
git commit -m "fix(backend): harden token validation and user ownership checks"

git add main.js src/config/index.js src/utils/core/config-validator.js src/services/storageService.js src/pages/practice-sub/do-quiz.vue src/pages/practice/index.vue
git commit -m "fix(frontend): reduce config noise and stabilize storage/runtime guards"

git add src/components src/pages src/mixins src/styles
git commit -m "refactor(ui): normalize vue template formatting and lint conventions"

git add tests/unit
git commit -m "test(audit): replace legacy e2e-flow specs with audit and integration suites"

git add docs/PROJECT-REPORT.md CHANGELOG.md PROJECT_DEEP_SCAN_REPORT.md .vscode/ui-quality-report.json
git commit -m "docs: record v2.1.2 audit closure and verification evidence"
```

## Notes

- Do not use `npm audit fix --force` in this branch without a dedicated upgrade task.
- Keep `.node-version`, `.nvmrc`, and CI workflow updates in a separate infra commit if they are not part of the release scope.
