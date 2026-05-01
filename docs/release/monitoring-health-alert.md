# Monitoring Health Alert Evidence

Status: passed

## Health Checks

- Production API base URL: `https://nf98ia8qnt.sealosbja.site`
- Health endpoint: `health-check`
- Latest public health status: passed on Tencent CVM through `exam-master-health.service`
- Latest strict health status: passed; strict cloud smoke report remains archived in `data/cloud-smoke-release.json`
- Check timestamp: `2026-04-30T21:31:06Z`
- Smoke base URL: `https://nf98ia8qnt.sealosbja.site`
- Tencent CVM monitor path: `/opt/apps/exam-master/release-ops/bin/health-check.sh`
- Tencent CVM systemd service: `exam-master-health.service`
- Tencent CVM systemd timer: `exam-master-health.timer`
- Latest health log: `/opt/apps/exam-master/release-ops/logs/health.log`
- Latest health response: `{"code":0,"status":"ok"}`
- Latest strict smoke result: `12 passed / 0 failed / 0 skipped` at `2026-04-30T21:31:06Z`; report written to `data/cloud-smoke-release.json`
- Remaining strict smoke failures: none
- Remaining strict smoke skipped check: none

## Alerts

- Alert provider: Tencent CVM systemd timer plus journald/local alert log
- Alert channel: `/opt/apps/exam-master/release-ops/logs/alerts.log` and `journalctl -t exam-master-health`
- Alert owner: release operator
- Synthetic check interval: 5 minutes
- Latest test alert timestamp: `2026-04-30T18:56:14Z`
- Alert delivery verified: passed; manual test alert was written to `/opt/apps/exam-master/release-ops/logs/alerts.log` and journald

## Release Dashboard

- Dashboard URL or internal path: `ssh root@101.43.41.96 'journalctl -u exam-master-health.service -n 50 --no-pager'`; raw logs at `/opt/apps/exam-master/release-ops/logs/health.log`
- Metrics covered: production health endpoint status, curl exit code, response body, systemd timer state, local test alert delivery, strict smoke report archive
- Error budget or escalation rule: any non-zero `exam-master-health.service` exit writes `ok=false` to `health.log`, appends the same event to `alerts.log`, and marks the systemd service invocation failed for operator inspection

Do not paste alert webhook secrets, credentials, or private user data here.
