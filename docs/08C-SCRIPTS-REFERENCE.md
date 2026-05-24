# Scripts Reference

Last updated: 2026-05-23

## Core quality gates

- `npm run lint`: frontend ESLint checks (不再用 `|| true`，错误会正确终止).
- `npm test`: full Vitest suite.
- `npm run build:h5`: H5 build validation.
- `npm run build:mp-weixin`: WeChat mini-program build validation.
- `npm run test:qa:full-regression`: delivery-grade chain gate (lint/format/laf strict/build/tests/e2e/maestro/secrets/prod-audit/mp-usage).
- `npm run test:qa:full-regression:clean`: wrapper gate, auto-runs under Node 20.17.0 and ensures Playwright Chromium.

## App 构建

- `npm run app:build:android`: 构建 Android APK
- `npm run app:build:ios`: 构建 iOS IPA

## Laf backend safety gates

- `npm run audit:laf:function-sources`: checks TS/JS drift and tracked-source status for `laf-backend/functions`.
- `npm run audit:laf:function-sources -- --strict`: strict mode, fails on drift/untracked source/legacy JS entries.
- `npm run test:cloud:smoke`: live cloud smoke checks (public endpoints + optional auth chain).

Optional auth smoke inputs:

- `SMOKE_EMAIL`
- `SMOKE_PASSWORD`
- `SMOKE_TOKEN` (or `SMOKE_JWT`) to run protected checks without login credentials
- `SMOKE_USER_ID` when the token payload does not already contain `userId`, `uid`, or `sub`

Notes:

- `SMOKE_EMAIL` must be a real deliverable mailbox; reserved test domains like `example.com` are rejected by `send-email-code`.
- `npm run smoke:jwt -- --user-id <existing-smoke-user-id> --output data/smoke-token.env` signs a short-lived smoke token from `JWT_SECRET`. It does not create the user, so the id must already exist in the target cloud environment.

## Project audit scripts

- `npm run audit:deep-scan`: deep project scan report.
- `npm run audit:ui-quality`: UI quality gate report.
- `npm run audit:mp-main-usage`: mini-program main-package usage audit.
- `npm run deps:audit`: npm dependency audit (full tree, non-blocking). If the npm registry is unreachable, treat the result as not verified rather than as zero vulnerabilities.
- `npm run deps:audit:prod`: npm dependency audit for production dependencies only (non-blocking). If the npm registry is unreachable, treat the result as not verified rather than as zero vulnerabilities.
- `npm run audit:question-bank:report`: writes `data/question-bank-release-audit.json` with public-course missing/pending coverage gaps, publishable source-manifest coverage, per-slot source candidate diagnostics, and published-card answer-evidence blockers. Public-course coverage counts only formal release banks; `usageScope=self_study_draft` remains practice-visible but is reported as pending, not published, and `pendingCoverageBlockerCount` keeps those slots release-blocking until they are verified.
- `npm run audit:question-bank:release`: same audit in release mode; exits non-zero while missing coverage, pending coverage, publishable source evidence, or answer-evidence blockers remain.
- `npm run audit:release:external:report`: writes `data/release-external-audit.json` for production env, auth smoke credentials, Baidu sync inputs, WeChat device evidence, and ops evidence. Long-running release evidence defaults to `data/release-evidence/` and stays outside the core docs set.
- `npm run audit:release:external`: same external audit in release mode; exits non-zero while external blockers remain.
- `npm run audit:release:backlog`: merges the question-bank, flashcard-quality, external, WeChat DevTools, professional-index, and optional local source-audit reports into `data/release-blocker-backlog.json` plus `data/reports/release-blocker-backlog.md`; public-course missing/pending slots record whether they first need publishable official source evidence and why existing raw candidates are still blocked. The machine-readable report now includes `publicCourseSlotBacklog`, which aggregates coverage and source-evidence blockers by track-year before producing `nextBalancedPublicCourseSlots`, so operators can treat one public-course slot as one unit of work. Slot rows carry `sourceCandidateSamples` from Source Manifest and, when `data/raw-inbox/public-course-2025/source-audit.json` exists or `--local-source-audit <path>` is passed, `localSourceAuditSummary`/`localSourceAuditSamples` for local PDF path, SHA-256, text-layer state, OCR need, and blockers; the Markdown table lists multiple local samples when both paper and answer files are available, so operators do not need to open JSON just to find the companion answer SHA. Local source-audit rows are diagnostic only: they identify the next local file to verify, but they do not count as publishable official source evidence and cannot change release readiness. The next action now distinguishes readable local paper/answer files that need human verification and Source Manifest registration from local files that still require OCR or blocker repair. Candidate samples are ranked toward official papers, unblocked sources, verified/published status, matched answer evidence, and fewer blocker reasons, while local source-audit samples are ranked toward paper/paper+answer files with usable text layers and fewer blockers. The next-slot recommendation keeps pending public-course slots ahead of untouched missing slots, then round-robins across tracks inside each priority bucket so the queue does not collapse onto one subject when several tracks are equally actionable. The summary separates pending coverage blockers, raw `blockerItemCount`, and deduplicated `publicCourseBlockedSlotCount` because coverage and source-evidence rows can describe the same track-year slot. Non-course blockers use a separate operator table with workstream, target file, count, and next action.
- `npm run audit:release:backlog:release`: same backlog audit in blocking mode; exits non-zero while any publish blocker remains.
- `npm run audit:wechat:artifacts`: verifies the generated `dist/build/mp-weixin` artifact has required app files and no server-only secret names.
- `npm run smoke:wechat:devtools`: drives the built `dist/build/mp-weixin` artifact through local WeChat DevTools with `miniprogram-automator`; this is DevTools evidence only and does not replace real-device evidence.
- `npm run test:cloud:smoke:release`: cloud smoke in release mode; skipped checks fail the command, so auth coverage cannot be accidentally treated as passing.
- `npm run release:gate:report`: non-blocking release report chain; rebuilds H5/mp-weixin, then runs prod audit, question-bank audit, flashcard-quality audit, external audit, release backlog, and WeChat artifact audit.
- `npm run release:gate`: blocking public-release chain; rebuilds H5/mp-weixin and fails while question-bank, flashcard-quality, external, artifact, or cloud-smoke release blockers remain.

## Question-bank resource pipeline

- `npm run baidu:manifest:self-test`: runs the pure Source Manifest classifier self-test.
- `npm run baidu:manifest:quality:self-test`: runs the manifest coverage/queue analyzer self-test.
- `npm run baidu:manifest:quality`: reads `data/source-manifest.json` and writes `data/source-manifest-quality.json` with public-course coverage gaps, risk counts, and the processing queue.
- `npm run baidu:netdisk:candidate-coverage`: reads `data/source-manifest.json` and writes `data/public-course-netdisk-candidate-coverage.json` to prove raw `/EXAM-MASTER` candidate coverage separately from publishable question-bank evidence.
- `npm run baidu:cleaning:queue:self-test`: runs the incremental cleaning queue self-test.
- `npm run baidu:cleaning:queue`: reads `data/source-manifest.json`, preserves previous task state from `data/cleaning-queue.json`, and writes the next incremental cleaning queue.
- `npm run baidu:cleaning:run:self-test`: runs the small-batch cleaning runner self-test.
- `npm run baidu:cleaning:run:dry`: previews the next 3 pending `download_and_extract` tasks without downloading or calling AI.
- `npm run baidu:cleaning:run`: processes 1 pending `download_and_extract` task; requires at least one configured LLM provider key. The runner auto-reexecs with `.venv-baidu/bin/python` when the shell `python3` lacks Baidu dependencies such as `requests`.
- `npm run baidu:flashcards:repair:answers -- --target <target.json> --companion <answer.json> --output data/answer-evidence-repair-report.json --write --mark-companions-supporting`: fills missing answers from cleaned companion answer/analysis cards or compact answer-key ranges such as `21-25 BADAB`, adds candidate source/hash evidence, marks companion files as `supportingEvidenceOnly`, and keeps `answerEvidenceStatus=candidate_matched` until verified.
- `npm run baidu:flashcards:quality`: audits `data/flashcards/*.json` and writes `data/flashcard-quality-report.json` so cleaned-but-unverified cards cannot be promoted silently.
- `npm run baidu:flashcards:quality:release`: same audit in blocking mode; exits non-zero while answers, choice options, or matched source-evidence hashes are missing.
- `npm run baidu:sources:verified`: reads local `data/verified-source-registry.json`, computes SHA-256 for manually verified official sources, and writes `data/verified-source-export.json`.
- `npm run baidu:sources:merge`: merges `data/verified-source-export.json` into Source Manifest and refreshes the manifest quality report.
- `npm run baidu:sync:dry-run`: scans `/apps/考研大师/raw-pdf/` and prints the incremental manifest plan without writing runtime files. Requires local `BAIDU_ACCESS_TOKEN`.
- `npm run baidu:sync`: scans the Baidu app directory, writes `data/source-manifest.json`, and downloads eligible app-directory documents into `data/raw-inbox/`.
- `npm run baidu:sync:netdisk:dry`: scans the three public-course full netdisk directories in dry-run mode without writing runtime files.
- `npm run baidu:sync:netdisk:queue`: scans the three public-course full netdisk directories, refreshes manifest quality, refreshes candidate coverage, and writes `data/cleaning-queue.json`.
- `npm run baidu:group-file:index:self-test`: validates the read-only group-file index parser and transfer-approval queue builder.
- `npm run baidu:group-file:index:dry`: reads `data/group-file-export.json` and prints the group-file index plan without writing outputs; exits with an operator-friendly blocker if the export is missing.
- `npm run baidu:group-file:index`: reads `data/group-file-export.json`, writes `data/group-file-index.json`, `data/group-transfer-queue.json`, and `data/group-file-source-export.json`; it does not transfer, download, or upload files.
- `npm run baidu:group:registry:check`: validates local `data/link-registry.json` before a scheduled sync.
- `npm run baidu:group:sync:dry`: reads local `data/link-registry.json`, resolves registered Baidu share links, filters eligible documents, and prints the transfer plan without writing state.
- `npm run baidu:group:sync`: transfers eligible files from registered share links into `/apps/考研大师/raw-pdf/<subject>/<year>/`, writes `data/group-export-latest.json`, and merges it through `incremental_sync.py`.
- `python3 scripts/baidu/incremental_sync.py --scan-dir /EXAM-MASTER/考研历年真题/01.考研政治 --scan-dir /EXAM-MASTER/考研历年真题/02.考研英语 --scan-dir /EXAM-MASTER/考研历年真题/03.考研数学`: scans multiple full netdisk paths in one Source Manifest run.
- `python3 scripts/baidu/incremental_sync.py --group-export <file.json>`: merges an official group-service or browser-export JSON list into the same Source Manifest.
- `python3 scripts/pipeline/pdf2flashcard-v2.py <pdf> <科目> <年份>`: extracts PDF text/OCR, cleans ads/brands, uses cached budgeted AI parsing, and outputs flashcards.

Share-link group sync:

- Use `data/link-registry.example.json` as the template and create a local `data/link-registry.json`. The real file is git-ignored because it contains share links and extraction codes.
- Required runtime input: `BAIDU_ACCESS_TOKEN` in `.env` or the shell environment.
- The current production route is share-link sync. Cookie/BDUSS group direct APIs are intentionally not implemented as a main path; official group-service APIs can be added later as another collector feeding the same Source Manifest.
- Runtime files `data/transferred-links.json`, `data/group-export-latest.json`, and `data/group-sync-report.json` are git-ignored. The first prevents duplicate transfers; the second is the latest handoff into Source Manifest; the third records per-link success, skip, and error counts.
- GitHub Actions workflow `.github/workflows/baidu-group-sync.yml` runs the full `/EXAM-MASTER` daily scan whenever `BAIDU_ACCESS_TOKEN` is configured; share-link sync is additionally enabled when `BAIDU_LINK_REGISTRY_JSON` is configured. Missing optional share-link config skips only the share-link job.
- Transfer batches retry Baidu rate-limit responses (`errno=12`) before marking the batch failed. A bad or expired link is isolated to that link's report row and does not stop later links.

Read-only group-file index:

- Required input: `data/group-file-export.json`, exported from Baidu group files as JSON or a Computer Use/accessibility text snapshot. The script cannot invent the group file list when the desktop UI or official export is unavailable.
- Output `data/group-file-index.json` is a metadata index. Output `data/group-transfer-queue.json` is an approval-required queue; no item in that queue should be transferred without action-time confirmation.
- Output `data/group-file-source-export.json` is a Source Manifest handoff shape with `sourceChannel=group_file_index`; `incremental_sync.py`, `cleaning_queue.py`, and the external release gate recognize this channel, but queue items still route through approval-required transfer/direct-download handling before extraction or publication.

AI cost controls:

- `PDF_TEXT_LAYER_FIRST=true`: read native PDF text before Apple OCR.
- `LLM_DAILY_REQUEST_LIMIT=200`: daily request cap for batch parsing.
- `LLM_DAILY_CHAR_LIMIT=1200000`: daily character cap for batch parsing.
- `data/ai-cache/`: local AI parse cache and usage ledger, git-ignored.

## PNG asset generation

- `npm run assets:png:dry-run`: reads PNG prompt rows from `docs/07-STYLING-SYSTEM.md` when present; otherwise derives planned PNG jobs from the current tracked asset inventory.
- `npm run assets:png:generate`: generates all assets through the OpenAI-compatible image API using `IMAGE_API_KEY` from the environment.
- `npm run assets:png:validate`: validates generated PNG dimensions and alpha-channel requirements under `asset-inbox/png-redesign/`.

Notes:

- The image key must be supplied through `IMAGE_API_KEY`; never commit or paste it into scripts.
- Transparent assets use chroma-key fallback and local alpha removal when the model does not return a native alpha PNG.

## Visual regression scripts

- `npm run test:visual`: Playwright visual checks.
- `npm run test:visual:update`: update snapshots.
- `npm run test:visual:ui`: open Playwright UI.

## Generated report outputs

Runtime-generated reports are written to `data/reports/` and are git-ignored.

- Deep scan/UI: `PROJECT_DEEP_SCAN_REPORT.md`, `ui-quality-report.json`
- Visual: `visual-report/`, `visual-results.json`
- Playwright e2e: `e2e-regression-results.*`, `e2e-regression-html/`, `e2e-compat-results.*`, `e2e-compat-html/`
- Maestro: `maestro-preflight.md`, `maestro-results.xml`, `maestro-web-smoke*.xml`
- Vitest snapshots: `vitest-results*.json`
