# Release Evidence

This directory is for release evidence that cannot be generated purely from local code.

Required files before public launch:

- `wechat-device-smoke.md`: WeChat DevTools import result, real-device login/practice/result-page screenshots or notes, build version, and preview QR archive location.
- `backup-restore-drill.md`: backup run, restore verification, data scope, timestamp, and rollback owner.
- `monitoring-health-alert.md`: production health check URL, alert channel, latest alert test, and owner.

Each evidence file must contain `Status: passed` before `npm run audit:release:external` can pass. Template files with `Status: pending` are intentionally treated as release blockers. The gate also checks required evidence fields, so a shallow file with only `Status: passed` is not accepted.

`npm run audit:release:external:report` reads process environment variables and, by default, also reads `.env`, `.env.production`, and `laf-backend/.env` without writing any secret values into the report. Use `node scripts/build/release-external-gate.mjs --no-env-files` when a CI job should only trust injected secrets.

Baidu sync evidence can come from either route:

- Source Manifest route: eligible `baidu_pan` items from `/apps/考研大师/raw-pdf/`, `/EXAM-MASTER`, or a group export in `data/source-manifest.json`.
- Share-link route: at least one real non-example `pan.baidu.com` share link in `BAIDU_LINK_REGISTRY_JSON` or `data/link-registry.json`.

Share links are only needed when the resources are outside the accessible netdisk paths, such as in someone else's share. If the resources are already visible to the current Baidu access token under `/apps/考研大师/raw-pdf/` or `/EXAM-MASTER` and the manifest has eligible file items, share links are not required.

For the current release, `/EXAM-MASTER/考研历年真题` is visible to the configured Baidu OAuth token. Regenerate raw candidate coverage with `npm run baidu:netdisk:candidate-coverage`; this proves source availability only. Public question-bank release still requires verified/published Source Manifest records with content hashes and `answerEvidenceStatus: matched`.

Cloud smoke supports either `SMOKE_EMAIL + SMOKE_PASSWORD` or `SMOKE_TOKEN`. In token mode, provide `SMOKE_USER_ID` unless the JWT payload already contains `userId`, `uid`, or `sub`, so protected user endpoints can run without skipped checks.

Use `npm run smoke:jwt -- --user-id <existing-smoke-user-id> --output data/smoke-token.env` to generate a short-lived HS256 token from the configured `JWT_SECRET`. The user id must already exist in the production smoke environment; the helper only signs a token and does not create users.

Verified official source files can be registered through `data/verified-source-registry.json` using `data/verified-source-registry.example.json` as the shape. Run `npm run baidu:sources:verified` to compute file SHA-256 evidence, then `npm run baidu:sources:merge` to merge the verified export into `data/source-manifest.json`. Release coverage only counts sources that are `verified` or `published`, have provenance, have a content hash, and have `answerEvidenceStatus: matched`.

Do not paste secrets, tokens, QR code credentials, or private user data into these files.
