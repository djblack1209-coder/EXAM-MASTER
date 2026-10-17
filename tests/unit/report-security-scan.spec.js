import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const script = join(root, 'scripts/build/report-security-scan.mjs');
const privateMarker = 'synthetic-private-scan-content';
let fixtures;

beforeAll(() => {
  mkdirSync(join(root, 'tmp'), { recursive: true });
  fixtures = mkdtempSync(join(root, 'tmp/report-security-scan-'));
});

afterAll(() => {
  if (fixtures) rmSync(fixtures, { recursive: true, force: true });
});

// Invoke only the reporter with inline fixtures, never a scanner or an npm command.
function runReport(scanner, report, { outcome = 'success', exitCode = '0', raw } = {}) {
  const fixture = mkdtempSync(join(fixtures, 'case-'));
  try {
    const file = join(fixture, 'report.json');
    const summary = join(fixture, 'summary.md');
    if (report !== undefined || raw !== undefined) writeFileSync(file, raw ?? JSON.stringify(report));
    const result = spawnSync(process.execPath, [script, scanner, file, outcome, exitCode], {
      cwd: fixture,
      encoding: 'utf8',
      env: { GITHUB_STEP_SUMMARY: summary },
      timeout: 2000
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0); // Findings and incomplete scans remain nonblocking.
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    return { stdout: result.stdout, summary: readFileSync(summary, 'utf8') };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

function expectReport(result, scanner, level, message) {
  const title = scanner === 'trivy' ? 'Trivy 安全扫描' : 'npm audit';
  expect(result.stdout.split('\n')[0]).toBe(`::${level} title=${title}::${message}`);
  expect(result.summary).toBe(`### ${title}\n\n${message}\n\n`);
  expect(result.stdout).not.toContain(privateMarker);
  expect(result.summary).not.toContain(privateMarker);
}

function expectIncomplete(result, scanner, reason) {
  expectReport(result, scanner, 'error', `扫描未完成：${reason}。`);
  expect(result.stdout.trim().split('\n')).toHaveLength(1);
}

const trivy = (Results = [{ Target: 'package-lock.json' }]) => ({ SchemaVersion: 2, Results });
const vulnerability = (Severity, VulnerabilityID = 'CVE-TEST-1') => ({
  Severity,
  VulnerabilityID,
  PkgName: 'fixture-package',
  InstalledVersion: '1.0.0',
  FixedVersion: '1.0.1'
});

function npmAudit(severities = []) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: severities.length };
  const vulnerabilities = {};
  severities.forEach((severity, index) => {
    counts[severity]++;
    vulnerabilities[`fixture-${index}`] = {
      severity,
      via: [{ url: 'https://github.com/advisories/GHSA-test-test-test' }],
      nodes: [`node_modules/fixture-${index}`],
      range: '<1.0.1',
      fixAvailable: { name: `fixture-${index}`, version: '1.0.1' }
    };
  });
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
}

describe('Trivy scan reporter', () => {
  it('counts CRITICAL/HIGH vulnerabilities across targets and lists only qualifying findings', () => {
    const result = runReport(
      'trivy',
      trivy([
        {
          Target: 'package-lock.json',
          Vulnerabilities: [vulnerability('CRITICAL'), vulnerability('HIGH'), vulnerability('MEDIUM', privateMarker)]
        },
        {
          Target: 'laf-backend/standalone/package-lock.json',
          Vulnerabilities: [{ ...vulnerability('CRITICAL', 'CVE-TEST-2'), FixedVersion: undefined }]
        }
      ])
    );
    expectReport(result, 'trivy', 'warning', '发现问题；目标=2；漏洞 CRITICAL=2 HIGH=1；密钥 CRITICAL=0 HIGH=0。');
    expect(result.stdout).toContain(
      '漏洞 | 文件="package-lock.json" | 包="fixture-package" | 已装="1.0.0" | 修复="1.0.1" | ID="CVE-TEST-1" | HIGH'
    );
    expect(result.stdout).toContain('修复="未提供" | ID="CVE-TEST-2" | CRITICAL');
    expect(result.stdout.match(/^漏洞 \|/gm)).toHaveLength(3);
  });

  it('counts secrets but emits only rule, file, line and severity, never matches, titles or code', () => {
    const secrets = ['CRITICAL', 'HIGH'].map((Severity, index) => ({
      Severity,
      RuleID: `fixture-rule-${index}`,
      StartLine: 10 + index,
      EndLine: 20 + index,
      Match: `${privateMarker}-match`,
      Title: `${privateMarker}-title`,
      Code: { Lines: [{ Content: `${privateMarker}-code-line` }] }
    }));
    const result = runReport('trivy', trivy([{ Target: 'src/fixture.js', Secrets: secrets }]));
    const message = '发现问题；目标=1；漏洞 CRITICAL=0 HIGH=0；密钥 CRITICAL=1 HIGH=1。';
    expectReport(result, 'trivy', 'warning', message);
    expect(result.stdout).toBe(
      `::warning title=Trivy 安全扫描::${message}\n` +
        '目标 "src/fixture.js"\n' +
        '密钥 | 规则="fixture-rule-0" | 文件="src/fixture.js" | 行=10 | CRITICAL\n' +
        '密钥 | 规则="fixture-rule-1" | 文件="src/fixture.js" | 行=11 | HIGH\n'
    );
  });

  it.each([
    ['omitted findings', { Target: 'package-lock.json' }],
    ['empty findings', { Target: 'package-lock.json', Vulnerabilities: [], Secrets: [] }]
  ])('reports notice for a completed target with %s', (_name, target) => {
    expectReport(
      runReport('trivy', trivy([target])),
      'trivy',
      'notice',
      '没有 CRITICAL/HIGH；目标=1；漏洞 CRITICAL=0 HIGH=0；密钥 CRITICAL=0 HIGH=0。'
    );
  });

  it.each([
    ['zero targets', trivy([]), {}, '结果未列出扫描目标，不能判为无发现'],
    ['omitted targets', { SchemaVersion: 2 }, {}, '结果未列出扫描目标，不能判为无发现'],
    ['missing file', undefined, {}, '结果文件缺失、不可读或无法解析'],
    ['invalid JSON', undefined, { raw: privateMarker }, '结果文件缺失、不可读或无法解析'],
    ['failed step', trivy(), { outcome: 'failure' }, '扫描器未成功完成'],
    ['skipped step', trivy(), { outcome: 'skipped' }, '扫描器未成功完成'],
    ['unsupported schema', { SchemaVersion: 1, Results: trivy().Results }, {}, '结果结构无法识别'],
    ['invalid targets', { SchemaVersion: 2, Results: {} }, {}, '结果结构无法识别'],
    ['empty target', trivy([{ Target: '' }]), {}, '结果结构无法识别'],
    [
      'missing vulnerability fields',
      trivy([{ Target: 'package-lock.json', Vulnerabilities: [{ Severity: 'HIGH' }] }]),
      {},
      '结果结构无法识别'
    ],
    [
      'invalid secret line',
      trivy([{ Target: 'src/fixture.js', Secrets: [{ Severity: 'HIGH', RuleID: 'fixture-rule', StartLine: 0 }] }]),
      {},
      '结果结构无法识别'
    ]
  ])('reports incomplete for %s in both outputs', (_name, report, options, reason) => {
    expectIncomplete(runReport('trivy', report, options), 'trivy', reason);
  });
});

describe('npm audit reporter', () => {
  it('warns with critical and high counts when a valid audit exits 1', () => {
    const result = runReport('npm', npmAudit(['critical', 'critical', 'high']), { outcome: 'failure', exitCode: '1' });
    expectReport(
      result,
      'npm',
      'warning',
      '发现 CRITICAL 依赖漏洞；CRITICAL=2 HIGH=1（HIGH 供分诊，告警阈值仍为 CRITICAL）。'
    );
    expect(result.stdout).toContain('包="fixture-0" | CRITICAL');
    expect(result.stdout).toContain('ID="GHSA-test-test-test"');
    expect(result.stdout.match(/^依赖 \|/gm)).toHaveLength(3);
  });

  it.each([
    ['no findings', [], 0],
    ['high without critical', ['high'], 1]
  ])('reports notice for %s', (_name, severities, highCount) => {
    expectReport(
      runReport('npm', npmAudit(severities)),
      'npm',
      'notice',
      `没有 CRITICAL；CRITICAL=0 HIGH=${highCount}（HIGH 供分诊，告警阈值仍为 CRITICAL）。`
    );
  });

  it.each([
    [
      'network error JSON even with a report-shaped body',
      { ...npmAudit(), error: { code: 'ENETUNREACH', summary: privateMarker, detail: privateMarker } },
      { outcome: 'failure', exitCode: '1' },
      'npm audit 未返回有效审计结果'
    ],
    ['missing file', undefined, {}, '结果文件缺失、不可读或无法解析'],
    ['invalid JSON', undefined, { raw: privateMarker }, '结果文件缺失、不可读或无法解析'],
    ['abnormal exit code', npmAudit(), { outcome: 'failure', exitCode: '2' }, 'npm audit 退出状态与结果不一致'],
    ['missing exit code', npmAudit(), { exitCode: '' }, 'npm audit 退出状态与结果不一致'],
    ['critical with exit 0', npmAudit(['critical']), {}, 'npm audit 退出状态与结果不一致'],
    [
      'noncritical with exit 1',
      npmAudit(['high']),
      { outcome: 'failure', exitCode: '1' },
      'npm audit 退出状态与结果不一致'
    ],
    ['failure outcome with exit 0', npmAudit(), { outcome: 'failure' }, 'npm audit 退出状态与结果不一致'],
    ['success outcome with exit 1', npmAudit(['critical']), { exitCode: '1' }, 'npm audit 退出状态与结果不一致'],
    ['skipped step', npmAudit(), { outcome: 'skipped' }, 'npm audit 未执行完成'],
    ['unsupported schema', { ...npmAudit(), auditReportVersion: 1 }, {}, 'npm audit 未返回有效审计结果'],
    ['missing counts', { ...npmAudit(), metadata: {} }, {}, '结果结构无法识别'],
    [
      'counts inconsistent with findings',
      { ...npmAudit(), vulnerabilities: npmAudit(['high']).vulnerabilities },
      {},
      'npm audit 漏洞计数与清单不一致'
    ]
  ])('reports incomplete for %s in both outputs', (_name, report, options, reason) => {
    expectIncomplete(runReport('npm', report, options), 'npm', reason);
  });
});
