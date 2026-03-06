# Security Hygiene Audit (r10)

## Scope

- Tracked source files (`git grep` based)
- Local environment/backups presence check

## Checks

1. Tracked secret pattern audit

```bash
npm run audit:secrets:tracked
```

Result: passed (`no tracked secret patterns found`).

2. Local sensitive file presence (non-tracked)

- `.env`
- `.env.local`
- `laf-backend/.env`
- `backups/backup-20260228-074221/.env.backup`
- `backups/backup-20260228-074221/.env.backend.backup`

Result: sensitive values exist in local-only files/backups (not tracked by Git).

## Risk & Action

- Git leak risk: low (tracked scan clean).
- Local host risk: medium (plaintext secrets in local backups/env files).
- Required action:
  1. Rotate exposed external tokens/keys immediately.
  2. Prune or encrypt local backup env files.
  3. Keep `npm run audit:secrets:tracked` in pre-release checklist.
