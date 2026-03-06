# Repository Cleanup Summary

Date: 2026-03-07

## Scope

- Full documentation tree scan (`docs/`, `docs/reports/`, `docs/archive/`)
- Redundant report cleanup and de-duplication
- Report naming and directory normalization
- Ignore-rule cleanup for generated artifacts

## Structural changes

- Introduced canonical latest reports directory: `docs/reports/current/`
- Introduced historical reports directory: `docs/reports/history/2026-03/`
- Introduced release notes directory: `docs/releases/`
- Moved historical baseline docs from `docs/` to `docs/archive/`

## Naming normalization

- Canonical report filenames switched to lowercase kebab-case:
  - `qa-regression-latest.md`
  - `qa-defects-latest.csv`
  - `release-readiness.md`
  - `wx-review-compliance-statement.md`

## Duplicate merge/removal

- Removed duplicate empty defect snapshots:
  - `QA-DEFECTS-2026-03-03-r7.csv`
  - `QA-DEFECTS-2026-03-03-r8.csv`
- Deduplicated runtime source implementation:
  - Extracted canonical `smart-question-picker` to `src/utils/learning/smart-question-picker.js`
  - Removed duplicate page-level utility copies (10 files)
  - Updated imports to shared canonical modules under `src/utils/`

## Config cleanup

- Expanded `.gitignore` generated-artifact coverage for:
  - e2e Playwright reports
  - Maestro runtime reports
  - Vitest JSON snapshots

## Documentation index updates

- Updated `docs/README.md` to reflect new active/archive/report structure
- Updated `docs/reports/README.md` with canonical vs history vs runtime artifact rules
- Added folder indices for:
  - `docs/reports/current/README.md`
  - `docs/reports/history/README.md`
  - `docs/reports/history/2026-03/README.md`
  - `docs/releases/README.md`
  - `docs/archive/2026-03-review/README.md`

## Verification

- `npm run lint`: passed
- `npm run build:h5`: passed
- `npm run test`: 79 passed, 0 failed
- `npm run test:visual`: 41 passed, 0 failed
- `npm run test:e2e:regression`: 32 passed, 0 failed
- `npm run test:e2e:compat`: 96 passed, 0 failed
- `npm run test:e2e:report`: 13 passed, 0 failed
- `npm run test:maestro`: passed（无设备场景自动降级）
- `npm run audit:secrets:tracked`: passed
- `npm run audit:mp-main-usage`: passed
- `node scripts/build/verify-wechat-artifacts.mjs`: passed

## Post-cleanup integrity checks

- No remaining references to deleted legacy doc paths under `docs/`.
- No remaining imports pointing to removed page-level duplicate util modules.
- Current working branch remains `test-fix/2026-03-07-r3` with cleanup changes preserved.

## Round metrics

- New issues found: 0
- Fixed issues: 0
- Remaining blockers: 0
