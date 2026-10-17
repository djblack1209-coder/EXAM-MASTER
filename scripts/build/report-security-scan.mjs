import { appendFileSync, readFileSync } from 'node:fs';

// Render only whitelisted fields: Trivy Match/Code and raw scanner errors can contain secrets.
class IncompleteScan extends Error {}
const severities = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const cell = (value) => JSON.stringify(String(value ?? '—'));

function requireReport(condition, reason = '结果结构无法识别') {
  if (!condition) throw new IncompleteScan(reason);
}

function readReport(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new IncompleteScan('结果文件缺失、不可读或无法解析');
  }
}

function trivyReport(file, outcome) {
  requireReport(outcome === 'success', '扫描器未成功完成');
  const report = readReport(file);
  requireReport(isObject(report) && report.SchemaVersion === 2);
  requireReport(report.Results === undefined || Array.isArray(report.Results));
  const results = report.Results ?? [];
  requireReport(results.length > 0, '结果未列出扫描目标，不能判为无发现');
  const counts = { vulnerabilities: { CRITICAL: 0, HIGH: 0 }, secrets: { CRITICAL: 0, HIGH: 0 } };
  const lines = [];
  for (const result of results) {
    requireReport(isObject(result) && isText(result.Target));
    lines.push(`目标 ${cell(result.Target)}`);
    for (const [field, category] of [
      ['Vulnerabilities', 'vulnerabilities'],
      ['Secrets', 'secrets']
    ]) {
      requireReport(result[field] === undefined || Array.isArray(result[field]));
      for (const finding of result[field] ?? []) {
        requireReport(isObject(finding) && severities.includes(finding.Severity));
        if (!['CRITICAL', 'HIGH'].includes(finding.Severity)) continue;
        counts[category][finding.Severity]++;
        if (category === 'vulnerabilities') {
          requireReport([finding.VulnerabilityID, finding.PkgName, finding.InstalledVersion].every(isText));
          requireReport(finding.FixedVersion === undefined || typeof finding.FixedVersion === 'string');
          lines.push(
            `漏洞 | 文件=${cell(result.Target)} | 包=${cell(finding.PkgName)} | 已装=${cell(finding.InstalledVersion)} | 修复=${cell(finding.FixedVersion || '未提供')} | ID=${cell(finding.VulnerabilityID)} | ${finding.Severity}`
          );
        } else {
          requireReport(isText(finding.RuleID) && Number.isInteger(finding.StartLine) && finding.StartLine > 0);
          // Never serialize the finding object, matched value, title or surrounding code.
          lines.push(
            `密钥 | 规则=${cell(finding.RuleID)} | 文件=${cell(result.Target)} | 行=${finding.StartLine} | ${finding.Severity}`
          );
        }
      }
    }
  }
  const { vulnerabilities: v, secrets: s } = counts;
  const found = v.CRITICAL + v.HIGH + s.CRITICAL + s.HIGH > 0;
  return {
    level: found ? 'warning' : 'notice',
    message: `${found ? '发现问题' : '没有 CRITICAL/HIGH'}；目标=${results.length}；漏洞 CRITICAL=${v.CRITICAL} HIGH=${v.HIGH}；密钥 CRITICAL=${s.CRITICAL} HIGH=${s.HIGH}。`,
    lines
  };
}

function npmReport(file, outcome, exitCode) {
  requireReport(['success', 'failure'].includes(outcome), 'npm audit 未执行完成');
  const report = readReport(file);
  requireReport(isObject(report) && !report.error && report.auditReportVersion === 2, 'npm audit 未返回有效审计结果');
  const counts = report.metadata?.vulnerabilities;
  requireReport(isObject(counts) && isObject(report.vulnerabilities));
  requireReport(
    ['info', 'low', 'moderate', 'high', 'critical', 'total'].every(
      (key) => Number.isInteger(counts[key]) && counts[key] >= 0
    )
  );
  // npm uses exit 1 for findings AND network/registry errors. Only a complete report
  // with a consistent critical threshold makes that exit code a finding.
  const expectedExit = counts.critical > 0 ? '1' : '0';
  requireReport(
    exitCode === expectedExit && outcome === (exitCode === '0' ? 'success' : 'failure'),
    'npm audit 退出状态与结果不一致'
  );
  const lines = [];
  const observed = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const [name, finding] of Object.entries(report.vulnerabilities)) {
    requireReport(
      isObject(finding) && isText(name) && ['info', 'low', 'moderate', 'high', 'critical'].includes(finding.severity)
    );
    requireReport(Array.isArray(finding.via) && Array.isArray(finding.nodes) && finding.nodes.every(isText));
    observed[finding.severity]++;
    const ids = finding.via.filter(isObject).map((advisory) => {
      const ghsa = typeof advisory.url === 'string' && advisory.url.match(/GHSA-[\w-]+/);
      return ghsa ? ghsa[0] : '公告 ID 未提供';
    });
    const fix = isObject(finding.fixAvailable)
      ? `${finding.fixAvailable.name ?? '包名未提供'}@${finding.fixAvailable.version ?? '版本未提供'}`
      : finding.fixAvailable
        ? '有修复建议'
        : '未提供';
    lines.push(
      `依赖 | 包=${cell(name)} | ${finding.severity.toUpperCase()} | 范围=${cell(finding.range)} | ID=${cell(ids.join(', ') || '间接依赖传播')} | 修复建议=${cell(fix)} | 节点=${cell(finding.nodes.join(', '))}`
    );
  }
  requireReport(
    Object.keys(observed).every((key) => observed[key] === counts[key]) &&
      Object.values(observed).reduce((sum, count) => sum + count, 0) === counts.total,
    'npm audit 漏洞计数与清单不一致'
  );
  return {
    level: counts.critical > 0 ? 'warning' : 'notice',
    message: `${counts.critical > 0 ? '发现 CRITICAL 依赖漏洞' : '没有 CRITICAL'}；CRITICAL=${counts.critical} HIGH=${counts.high}（HIGH 供分诊，告警阈值仍为 CRITICAL）。`,
    lines
  };
}

const [scanner, file, outcome, exitCode] = process.argv.slice(2);
const title = scanner === 'trivy' ? 'Trivy 安全扫描' : 'npm audit';
let result;
try {
  requireReport(['trivy', 'npm'].includes(scanner), '未知扫描器');
  result = scanner === 'trivy' ? trivyReport(file, outcome) : npmReport(file, outcome, exitCode);
} catch (error) {
  const reason = error instanceof IncompleteScan ? error.message : '结果处理异常';
  result = { level: 'error', message: `扫描未完成：${reason}。`, lines: [] };
}

const escapeCommand = (value) => value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
console.log(`::${result.level} title=${title}::${escapeCommand(result.message)}`);
for (const line of result.lines) console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${title}\n\n${result.message}\n\n`);
}
// An annotation describes scan status; neither findings nor scanner failures block CI.
