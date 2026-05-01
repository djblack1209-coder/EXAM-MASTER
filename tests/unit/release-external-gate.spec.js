import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'scripts/build/release-external-gate.mjs');

function passedWechatEvidence() {
  return [
    '# WeChat Smoke',
    '',
    'Status: passed',
    '',
    '- Preview QR archive location: release-artifacts/wechat/preview-20260430.png',
    '- Real device model and WeChat version: iPhone 15 / WeChat 8.0.58',
    '- App launch succeeded: passed',
    '- Login succeeded: passed',
    '- Practice center opened: passed',
    '- Knowledge map opened: passed',
    '- Quiz flow completed: passed',
    '- Result page opened: passed',
    ''
  ].join('\n');
}

function passedBackupEvidence() {
  return [
    '# Backup Drill',
    '',
    'Status: passed',
    '',
    '- Environment: production',
    '- Data stores: production database backup restored to isolated drill target',
    '- Object storage buckets: production object storage manifest restored to isolated drill target',
    '- Restore target: release-drill-production-restore',
    '- Verified record count or checksum: 128 records / SHA256SUMS verified',
    '- Result: production restore drill passed',
    ''
  ].join('\n');
}

function passedMonitoringEvidence() {
  return [
    '# Monitoring',
    '',
    'Status: passed',
    '',
    '- Alert provider: Sealos monitor',
    '- Alert channel: release-oncall',
    '- Alert owner: release operator',
    '- Synthetic check interval: 5 minutes',
    '- Latest test alert timestamp: 2026-04-30T00:00:00Z',
    '- Alert delivery verified: passed',
    '- Dashboard URL or internal path: https://monitor.example.com/exam-master',
    ''
  ].join('\n');
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'exam-master-release-gate-'));
}

function runGate(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      ...env
    },
    encoding: 'utf8'
  });
}

describe('release external gate', () => {
  it('reports missing production external blockers without requiring secrets in git', () => {
    const dir = tempDir();
    const output = path.join(dir, 'external.json');
    const result = runGate(['--output', output, '--no-env-files']);

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(report.releaseReadiness.canPublish).toBe(false);
    expect(report.summary.blockerCount).toBeGreaterThan(0);
    expect(report.sections.authSmoke.status).toBe('blocked');
    expect(report.sections.baiduSync.status).toBe('blocked');
    expect(report.sections.wechatDevice.status).toBe('blocked');
  });

  it('fails release mode while external blockers remain', () => {
    const dir = tempDir();
    const output = path.join(dir, 'external.json');
    const result = runGate(['--output', output, '--no-env-files', '--fail-on-blockers']);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('canPublish=false');
  });

  it('passes when all required external release evidence is present', () => {
    const dir = tempDir();
    const mpDir = path.join(dir, 'mp-weixin');
    const evidenceDir = path.join(dir, 'evidence');
    fs.mkdirSync(mpDir, { recursive: true });
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(mpDir, 'app.json'), '{}');
    fs.writeFileSync(path.join(mpDir, 'project.config.json'), '{}');
    fs.writeFileSync(path.join(evidenceDir, 'wechat-device.md'), passedWechatEvidence());
    fs.writeFileSync(path.join(evidenceDir, 'backup-restore.md'), passedBackupEvidence());
    fs.writeFileSync(path.join(evidenceDir, 'monitoring.md'), passedMonitoringEvidence());
    const output = path.join(dir, 'external.json');

    const result = runGate(
      [
        '--output',
        output,
        '--mp-dir',
        mpDir,
        '--wechat-evidence',
        path.join(evidenceDir, 'wechat-device.md'),
        '--backup-evidence',
        path.join(evidenceDir, 'backup-restore.md'),
        '--monitoring-evidence',
        path.join(evidenceDir, 'monitoring.md'),
        '--no-env-files',
        '--fail-on-blockers'
      ],
      {
        VITE_WX_APP_ID: 'wx1234567890abcdef',
        VITE_API_BASE_URL: 'https://api.exam-master.app',
        JWT_SECRET: 'x'.repeat(64),
        PASSWORD_SALT: 'y'.repeat(32),
        SMTP_HOST: 'smtp.exammaster.app',
        SMTP_PORT: '465',
        SMTP_USER: 'noreply@exammaster.app',
        SMTP_PASS: 'smtp-pass',
        SMOKE_BASE_URL: 'https://api.exam-master.app',
        SMOKE_EMAIL: 'release@exammaster.app',
        SMOKE_PASSWORD: 'password',
        ZHIPU_API_KEY: 'zhipu-key',
        BAIDU_ACCESS_TOKEN: 'token',
        BAIDU_LINK_REGISTRY_JSON:
          '{"version":1,"links":[{"id":"lnk_release_001","url":"https://pan.baidu.com/s/1AbCdEfGhIjK","pwd":"abcd"}]}',
        ADMIN_SECRET: 'admin-secret',
        REQUEST_SIGN_SALT: 'z'.repeat(32)
      }
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(report.releaseReadiness.canPublish).toBe(true);
    expect(report.summary.blockerCount).toBe(0);
  });

  it('accepts an app-directory source manifest instead of requiring share links', () => {
    const dir = tempDir();
    const mpDir = path.join(dir, 'mp-weixin');
    const evidenceDir = path.join(dir, 'evidence');
    const sourceManifest = path.join(dir, 'source-manifest.json');
    fs.mkdirSync(mpDir, { recursive: true });
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(mpDir, 'app.json'), '{}');
    fs.writeFileSync(path.join(mpDir, 'project.config.json'), '{}');
    fs.writeFileSync(path.join(evidenceDir, 'wechat-device.md'), passedWechatEvidence());
    fs.writeFileSync(path.join(evidenceDir, 'backup-restore.md'), passedBackupEvidence());
    fs.writeFileSync(path.join(evidenceDir, 'monitoring.md'), passedMonitoringEvidence());
    fs.writeFileSync(
      sourceManifest,
      JSON.stringify({
        version: 1,
        items: [
          {
            provider: 'baidu_pan',
            sourceChannel: 'app_dir',
            remotePath: '/apps/考研大师/raw-pdf/英语/2018.pdf',
            fileName: '2018.pdf',
            eligible: true,
            status: 'discovered'
          }
        ]
      })
    );
    const output = path.join(dir, 'external.json');

    const result = runGate(
      [
        '--output',
        output,
        '--source-manifest',
        sourceManifest,
        '--mp-dir',
        mpDir,
        '--wechat-evidence',
        path.join(evidenceDir, 'wechat-device.md'),
        '--backup-evidence',
        path.join(evidenceDir, 'backup-restore.md'),
        '--monitoring-evidence',
        path.join(evidenceDir, 'monitoring.md'),
        '--no-env-files',
        '--fail-on-blockers'
      ],
      {
        VITE_WX_APP_ID: 'wx1234567890abcdef',
        VITE_API_BASE_URL: 'https://api.exam-master.app',
        JWT_SECRET: 'x'.repeat(64),
        PASSWORD_SALT: 'y'.repeat(32),
        SMTP_HOST: 'smtp.exammaster.app',
        SMTP_PORT: '465',
        SMTP_USER: 'noreply@exammaster.app',
        SMTP_PASS: 'smtp-pass',
        SMOKE_BASE_URL: 'https://api.exam-master.app',
        SMOKE_TOKEN: 'token',
        ZHIPU_API_KEY: 'zhipu-key',
        BAIDU_ACCESS_TOKEN: 'token',
        ADMIN_SECRET: 'admin-secret',
        REQUEST_SIGN_SALT: 'z'.repeat(32)
      }
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(report.sections.baiduSync.status).toBe('passed');
    expect(report.sections.baiduSync.registrySource).toBe('source_manifest');
    expect(report.sections.baiduSync.sourceManifestValidSourceCount).toBe(1);
  });

  it('can load release configuration from dotenv files without writing secret values to the report', () => {
    const dir = tempDir();
    const mpDir = path.join(dir, 'mp-weixin');
    const evidenceDir = path.join(dir, 'evidence');
    const envFile = path.join(dir, '.release.env');
    fs.mkdirSync(mpDir, { recursive: true });
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(mpDir, 'app.json'), '{}');
    fs.writeFileSync(path.join(mpDir, 'project.config.json'), '{}');
    fs.writeFileSync(path.join(evidenceDir, 'wechat-device.md'), passedWechatEvidence());
    fs.writeFileSync(path.join(evidenceDir, 'backup-restore.md'), passedBackupEvidence());
    fs.writeFileSync(path.join(evidenceDir, 'monitoring.md'), passedMonitoringEvidence());
    fs.writeFileSync(
      envFile,
      [
        'VITE_WX_APP_ID=wx1234567890abcdef',
        'VITE_API_BASE_URL=https://api.exam-master.app',
        `JWT_SECRET=${'x'.repeat(64)}`,
        `PASSWORD_SALT=${'y'.repeat(32)}`,
        `REQUEST_SIGN_SALT=${'z'.repeat(32)}`,
        'ADMIN_SECRET=admin-secret',
        'SMTP_HOST=smtp.exammaster.app',
        'SMTP_PORT=465',
        'SMTP_USER=noreply@exammaster.app',
        'SMTP_PASS=secret-smtp-pass',
        'SMOKE_BASE_URL=https://api.exam-master.app',
        'SMOKE_TOKEN=secret-smoke-token',
        'ZHIPU_API_KEY=secret-zhipu-key',
        'BAIDU_ACCESS_TOKEN=secret-baidu-token',
        'BAIDU_LINK_REGISTRY_JSON={"version":1,"links":[{"id":"lnk_release_001","url":"https://pan.baidu.com/s/1AbCdEfGhIjK","pwd":"abcd"}]}'
      ].join('\n')
    );
    const output = path.join(dir, 'external.json');

    const result = runGate([
      '--output',
      output,
      '--no-env-files',
      '--env-file',
      envFile,
      '--mp-dir',
      mpDir,
      '--wechat-evidence',
      path.join(evidenceDir, 'wechat-device.md'),
      '--backup-evidence',
      path.join(evidenceDir, 'backup-restore.md'),
      '--monitoring-evidence',
      path.join(evidenceDir, 'monitoring.md'),
      '--fail-on-blockers'
    ]);

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const reportText = fs.readFileSync(output, 'utf8');
    expect(reportText).not.toContain('secret-smoke-token');
    expect(reportText).not.toContain('secret-zhipu-key');
    expect(reportText).not.toContain('secret-baidu-token');

    const report = JSON.parse(reportText);
    expect(report.releaseReadiness.canPublish).toBe(true);
  });

  it('rejects empty or example Baidu registries as release evidence', () => {
    const dir = tempDir();
    const output = path.join(dir, 'external.json');

    const result = runGate(['--output', output, '--no-env-files'], {
      BAIDU_ACCESS_TOKEN: 'token',
      BAIDU_LINK_REGISTRY_JSON: '{"version":1,"links":[{"id":"example","url":"https://pan.baidu.com/s/1example"}]}'
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(report.sections.baiduSync.blockers.map((item) => item.code)).toContain('empty_baidu_link_registry');
    expect(report.sections.baiduSync.registryLinkCount).toBe(1);
    expect(report.sections.baiduSync.registryValidLinkCount).toBe(0);
  });

  it('does not accept pending evidence templates as release proof', () => {
    const dir = tempDir();
    const mpDir = path.join(dir, 'mp-weixin');
    const evidenceDir = path.join(dir, 'evidence');
    fs.mkdirSync(mpDir, { recursive: true });
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(mpDir, 'app.json'), '{}');
    fs.writeFileSync(path.join(mpDir, 'project.config.json'), '{}');
    fs.writeFileSync(path.join(evidenceDir, 'wechat-device.md'), '# WeChat Smoke\n\nStatus: pending\n');
    fs.writeFileSync(path.join(evidenceDir, 'backup-restore.md'), '# Backup Drill\n\nStatus: pending\n');
    fs.writeFileSync(path.join(evidenceDir, 'monitoring.md'), '# Monitoring\n\nStatus: pending\n');
    const output = path.join(dir, 'external.json');

    const result = runGate(
      [
        '--output',
        output,
        '--mp-dir',
        mpDir,
        '--wechat-evidence',
        path.join(evidenceDir, 'wechat-device.md'),
        '--backup-evidence',
        path.join(evidenceDir, 'backup-restore.md'),
        '--monitoring-evidence',
        path.join(evidenceDir, 'monitoring.md'),
        '--no-env-files',
        '--fail-on-blockers'
      ],
      {
        VITE_WX_APP_ID: 'wx1234567890abcdef',
        VITE_API_BASE_URL: 'https://api.exam-master.app',
        JWT_SECRET: 'x'.repeat(64),
        PASSWORD_SALT: 'y'.repeat(32),
        SMTP_HOST: 'smtp.exammaster.app',
        SMTP_PORT: '465',
        SMTP_USER: 'noreply@exammaster.app',
        SMTP_PASS: 'smtp-pass',
        SMOKE_BASE_URL: 'https://api.exam-master.app',
        SMOKE_EMAIL: 'release@exammaster.app',
        SMOKE_PASSWORD: 'password',
        ZHIPU_API_KEY: 'zhipu-key',
        BAIDU_ACCESS_TOKEN: 'token',
        BAIDU_LINK_REGISTRY_JSON:
          '{"version":1,"links":[{"id":"lnk_release_001","url":"https://pan.baidu.com/s/1AbCdEfGhIjK","pwd":"abcd"}]}',
        ADMIN_SECRET: 'admin-secret',
        REQUEST_SIGN_SALT: 'z'.repeat(32)
      }
    );

    expect(result.status).toBe(2);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(report.sections.wechatDevice.blockers[0].code).toBe('wechat_device_evidence_not_passed');
    expect(report.sections.opsEvidence.blockers.map((item) => item.code)).toEqual([
      'backup_restore_evidence_not_passed',
      'monitoring_evidence_not_passed'
    ]);
  });

  it('rejects shallow passed evidence files that leave required release fields blank', () => {
    const dir = tempDir();
    const mpDir = path.join(dir, 'mp-weixin');
    const evidenceDir = path.join(dir, 'evidence');
    fs.mkdirSync(mpDir, { recursive: true });
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(mpDir, 'app.json'), '{}');
    fs.writeFileSync(path.join(mpDir, 'project.config.json'), '{}');
    fs.writeFileSync(path.join(evidenceDir, 'wechat-device.md'), '# WeChat Smoke\n\nStatus: passed\n');
    fs.writeFileSync(path.join(evidenceDir, 'backup-restore.md'), '# Backup Drill\n\nStatus: passed\n');
    fs.writeFileSync(path.join(evidenceDir, 'monitoring.md'), '# Monitoring\n\nStatus: passed\n');
    const output = path.join(dir, 'external.json');

    const result = runGate(
      [
        '--output',
        output,
        '--mp-dir',
        mpDir,
        '--wechat-evidence',
        path.join(evidenceDir, 'wechat-device.md'),
        '--backup-evidence',
        path.join(evidenceDir, 'backup-restore.md'),
        '--monitoring-evidence',
        path.join(evidenceDir, 'monitoring.md'),
        '--no-env-files',
        '--fail-on-blockers'
      ],
      {
        VITE_WX_APP_ID: 'wx1234567890abcdef',
        VITE_API_BASE_URL: 'https://api.exam-master.app',
        JWT_SECRET: 'x'.repeat(64),
        PASSWORD_SALT: 'y'.repeat(32),
        SMTP_HOST: 'smtp.exammaster.app',
        SMTP_PORT: '465',
        SMTP_USER: 'noreply@exammaster.app',
        SMTP_PASS: 'smtp-pass',
        SMOKE_BASE_URL: 'https://api.exam-master.app',
        SMOKE_TOKEN: 'token',
        ZHIPU_API_KEY: 'zhipu-key',
        BAIDU_ACCESS_TOKEN: 'token',
        BAIDU_LINK_REGISTRY_JSON:
          '{"version":1,"links":[{"id":"lnk_release_001","url":"https://pan.baidu.com/s/1AbCdEfGhIjK","pwd":"abcd"}]}',
        ADMIN_SECRET: 'admin-secret',
        REQUEST_SIGN_SALT: 'z'.repeat(32)
      }
    );

    expect(result.status).toBe(2);

    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(report.sections.wechatDevice.blockers[0].code).toBe('wechat_device_evidence_incomplete');
    expect(report.sections.opsEvidence.blockers.map((item) => item.code)).toContain('backup_restore_evidence_incomplete');
    expect(report.sections.opsEvidence.blockers.map((item) => item.code)).toContain('monitoring_evidence_incomplete');
  });
});
