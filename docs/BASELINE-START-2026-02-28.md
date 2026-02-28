# Baseline Start (2026-02-28)

This document marks the new clean operational baseline for EXAM-MASTER.

## Baseline goals

- Use the current code state as the new starting point.
- Keep delivery docs concise, current, and action-oriented.
- Archive historical failure/problem narratives instead of mixing them into active runbooks.
- Enforce repeatable quality gates before every release.

## Current operational baseline

- Laf backend function entries are TS-only (`laf-backend/functions/*.ts`).
- Source drift checks are automated via `npm run audit:laf:function-sources`.
- CI uses strict source-audit gating before dependency install.
- Live cloud smoke is scriptable via `npm run test:cloud:smoke`.

## Required release gates

- `npm run audit:laf:function-sources -- --strict`
- `npm test`
- `npm run lint`
- `npm run test:cloud:smoke` (auth checks enabled when `SMOKE_EMAIL` and `SMOKE_PASSWORD` are available)

## Documentation policy from now on

- Active docs: `docs/README.md` listed files only.
- Historical records: keep in `docs/archive/` and do not use as release baseline references.
- Generated scan/quality artifacts are not tracked in git.

## Remote repo cleanup target

- Next remote baseline sync should include this local cleanup commit set.
- Historical failed CI run records can be cleaned only after GitHub auth is available.
