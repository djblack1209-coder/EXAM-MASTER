# Dependency Audit Baseline (2026-02-28)

## Scope

- Command: `npm audit --omit=dev --json`
- Runtime focus: production dependency tree only
- Goal: establish a risk baseline and staged remediation path without forcing breaking upgrades

## Current Result

- Total vulnerabilities: 11
- High: 10
- Moderate: 1
- Critical: 0

## Primary Risk Cluster

Most findings are concentrated in the uni-app toolchain chain:

- `@dcloudio/uni-cli-shared` (direct dependency)
- `@dcloudio/uni-components` (direct dependency)
- transitive packages under `@intlify/*`
- transitive `esbuild` advisory in current chain

Current `npm audit` fix suggestion points to a major-version migration (`@dcloudio/uni-cli-shared@0.2.994`), which is not safe for blind auto-apply.

## Risk Assessment

- This project is a front-end app; most vulnerable packages are build/runtime framework dependencies, not isolated utilities.
- Forced upgrade (`npm audit fix --force`) has high probability of introducing build/runtime regressions.
- Immediate strategy is **risk containment + monitored upgrade**, not emergency force upgrade.

## Mitigation Strategy

1. **Environment hardening (done)**
   - Node/npm baseline aligned to `node >=20.17.0`, `npm >=10.8.2`.
   - CI includes runtime capability verification.

2. **Operational containment (ongoing)**
   - Keep `npm run deps:audit:prod` in regular maintenance checks.
   - Block accidental unsafe remediations by avoiding `--force` in automated flows.

3. **Staged upgrade plan (next)**
   - Create an isolated branch for uni-app ecosystem upgrades.
   - Upgrade in small batches (`@dcloudio/*` first, then related `@intlify/*` impacts).
   - For each batch run: `npm run lint`, `npm test`, `npm run build:h5`, `npm run build:mp-weixin`, key cloud smoke checks.

4. **Acceptance gate**
   - Only merge upgrade batch when full quality gates pass and smoke checks remain stable.

## Traceability

- Baseline command output timestamp: 2026-02-28
- Related scripts doc: `docs/SCRIPTS.md`
