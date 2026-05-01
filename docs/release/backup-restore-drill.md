# Backup Restore Drill Evidence

Status: passed

## Scope

- Environment: Tencent CVM remote release artifact drill (`101.43.41.96`, Ubuntu Server 22.04 LTS)
- Data stores: WeChat release artifact, preview QR, release audit reports, cloud smoke report, Source Manifest reports archived to the Tencent CVM release-ops directory; live user database is hosted outside this CVM and follows the managed backend provider path
- Object storage buckets: release artifact object set under `/opt/apps/exam-master/release-ops/backups/release-drill-20260430T200006Z/`
- Backup owner: release operator
- Rollback owner: release operator

## Backup Run

- Backup command or provider job: local `tar` archive of `dist/build/mp-weixin` plus release audit JSON files, then remote copy to Tencent CVM
- Local backup artifact location: `backups/release-drill-20260430T200006Z/artifacts/`
- Remote backup artifact location: `/opt/apps/exam-master/release-ops/backups/release-drill-20260430T200006Z/`
- Backup timestamp: `2026-04-30T20:00:06Z`
- Backup artifact size: `mp-weixin.tar.gz` is `1906480` bytes
- Backup artifact SHA-256:
  - `mp-weixin.tar.gz`: `16356a65579f2f93a941b8d9f67ee0104d3ca984ec1d3195e93170ae26dbfbfb`
  - `cloud-smoke-release.json`: `dae95967a02c58d0ca5e77552b4997937780b1c9aea0d373675919d8b7e672e5`
  - `preview-20260430T183159Z.png`: `a2fc33a708df708146cd6aa3f6e40d6614a3bfb15a2d1a5a877d74a67d82f2cb`
  - `preview-info-20260430T183159Z.json`: `f1cae165a858f3e34e53d9dde8a9d2bc2319194a8075bde1384c7ba9dc8c70f5`
  - `public-course-netdisk-candidate-coverage.json`: `e50c7d349af8113051eb3a8f279125af750d135876268d14bbf1caaf7617a7d7`
  - `question-bank-release-audit.json`: `521cdcad408f7439a03cc36d2da2fec4fa916c27ab0e0f9d8bb8c9c53c912bac`
  - `release-external-audit-with-smoke-token.json`: `a5ffd57ae43ac259fe81ad99939e311e0e0342977c290625da7a153cec369f69`
  - `release-external-audit.json`: `8ffd184e01486fc6920831f218953f9eff32821a74ed988e830e5ea52629cfc7`
  - `source-manifest-quality.json`: `eea4058f2a96a90706f9b5d244ec4d9f37b452bcb69468723e5875230bfdd784`
  - `source-manifest-report.json`: `5486f91c7a47185f0a473da7182e77b9eb4766ab782c1bbb69170bd617ce3681`
  - `source-manifest.json`: `2071b8b3d92c9699ab6d92e6e4c531100ed8e5ff5fa256849308fb32b3779611`
- Retention policy: keep the remote release-drill directory through WeChat review and first public release rollback window

## Restore Verification

- Restore target: `/opt/apps/exam-master/release-ops/restore-check/release-drill-20260430T200006Z/`
- Restore timestamp: `2026-04-30T20:00:06Z`
- Verification query or health check: remote `sha256sum -c SHA256SUMS.txt`, remote `tar -xzf mp-weixin.tar.gz`, and file existence checks for `mp-weixin/app.json`, `mp-weixin/project.config.json`, and `mp-weixin/sitemap.json`
- Verified record count or checksum:
  - `restore-check/mp-weixin/app.json`: `4147bad56012ffae7893bd7e5a9b102d75821618b29d3fed717e7859359286a7`
  - `restore-check/mp-weixin/project.config.json`: `b879c34422e06bc9cfbf0418b2371d1199d76c7b7afa7f7ea212804b1fd202c0`
  - `restore-check/mp-weixin/sitemap.json`: `e950e426ac0dc2df54003450f91d483bd0871acb1315268133e62aede66214a7`
  - `remote SHA256SUMS.txt`: all archived objects returned `OK`
- Result: remote release artifact backup and restore drill passed

## Rollback Notes

- Rollback trigger: failed WeChat artifact import, failed release gate, failed production smoke, or failed review build
- Estimated recovery time: remote artifact restore is under 5 minutes after SSH access is available
- Rollback source: `/opt/apps/exam-master/release-ops/backups/release-drill-20260430T200006Z/artifacts/mp-weixin.tar.gz`
- Live backend database recovery remains owned by the managed backend provider path; this drill covers the WeChat release package and release evidence set.

Do not paste database passwords, object storage credentials, or private user data here.
