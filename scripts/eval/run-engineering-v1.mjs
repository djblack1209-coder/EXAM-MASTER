import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, MANIFEST_PATH, TEST_FILES, sha256, validateEngineeringManifest } from './engineering-v1-manifest.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || args.some((a) => a !== '--validate'))
  throw new Error('Usage: node scripts/eval/run-engineering-v1.mjs [--validate]');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_PATH), 'utf8'));
const validation = validateEngineeringManifest(manifest);
if (args.includes('--validate')) {
  console.log(JSON.stringify({ status: 'valid', ...validation }));
} else {
  if (process.env.YOZI_ISOLATED_BUILD !== '1') throw new Error('YOZI_ISOLATED_BUILD=1 is required');
  const output = path.join(ROOT, 'tmp/engineering-eval-v1');
  fs.mkdirSync(output, { recursive: true });
  if (fs.realpathSync(output) !== output) throw new Error('Evaluation output must not be a symlink');
  const stage = fs.mkdtempSync(path.join(output, '.run-'));
  const oldPath = path.join(ROOT, 'tmp/adaptive-learning/quality-report.json');
  const oldHash = () => (fs.existsSync(oldPath) ? sha256(fs.readFileSync(oldPath)) : null);
  const before = oldHash();
  const report = {
    contract: 'engineering-eval-report-v1',
    manifestSha256: sha256(fs.readFileSync(path.join(ROOT, MANIFEST_PATH))),
    at: new Date().toISOString(),
    node: process.version,
    kind: manifest.kind,
    real_effect: 'unavailable',
    realModelCalls: 0,
    validation,
    checks: [],
    legacyReportUnchanged: false,
    passed: false
  };
  // Do not pass credentials or private model configuration to deterministic subprocesses.
  const env = { PATH: process.env.PATH, NODE_ENV: 'test', TZ: 'UTC', YOZI_ISOLATED_BUILD: '1', AI_COLLAB_CHILD: '1' };
  const run = (name, argv, cwd) => {
    const startedAt = new Date().toISOString();
    const result = spawnSync(process.execPath, argv, {
      cwd,
      env,
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024
    });
    report.checks.push({
      name,
      pid: result.pid,
      startedAt,
      finishedAt: new Date().toISOString(),
      startedAndReaped: Number.isInteger(result.pid) && (result.status !== null || result.signal !== null),
      exitCode: result.status,
      signal: result.signal,
      passed: result.status === 0 && !result.error,
      error: result.error?.message || null,
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    });
    if (result.error || result.status !== 0) throw new Error(`${name} failed (${result.error?.code || result.status})`);
  };
  try {
    // Legacy writes relative to cwd; all fixture/module reads are relative to import.meta.url.
    try {
      run('deterministic_301', [path.join(ROOT, 'scripts/build/evaluate-learning.mjs')], stage);
    } finally {
      const generated = path.join(stage, 'tmp/adaptive-learning/quality-report.json');
      if (fs.existsSync(generated)) {
        const result = JSON.parse(fs.readFileSync(generated, 'utf8'));
        report.deterministic = {
          cases: result.total,
          passed: result.passed,
          real_effect: 'unavailable',
          results: result.results
        };
      }
    }
    const legacy = JSON.parse(fs.readFileSync(path.join(stage, 'tmp/adaptive-learning/quality-report.json'), 'utf8'));
    const expectedIds = manifest.cases
      .map((c) => c.legacyRunnerId)
      .filter(Boolean)
      .sort();
    if (JSON.stringify(legacy.results.map((r) => r.id).sort()) !== JSON.stringify(expectedIds) || legacy.passed !== 301)
      throw new Error('Legacy result coverage/pass count mismatch');
    run(
      'graph_material_writing_contract_tests',
      [
        path.join(ROOT, 'node_modules/vitest/vitest.mjs'),
        'run',
        ...TEST_FILES,
        '--maxWorkers=1',
        '--fileParallelism=false'
      ],
      ROOT
    );
    // Catch concurrent edits during the run, rather than certify a mixed worktree.
    validateEngineeringManifest(manifest);
    report.passed = true;
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    report.legacyReportUnchanged = oldHash() === before;
    if (!report.legacyReportUnchanged) {
      report.passed = false;
      process.exitCode = 1;
    }
    report.coverage = {
      jsonCases: '301 individually replayed; 7 material cases exercised by existing flow tests',
      graphQuestions:
        '52/18 hashes and authored expectations frozen; existing graph tests check engine contracts, not 70 student trajectories',
      semanticAntiLengthResistance: 'unverified',
      scoringCorrelation: null,
      diagnosisAccuracy: null
    };
    try {
      fs.writeFileSync(path.join(stage, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      fs.renameSync(path.join(stage, 'report.json'), path.join(output, 'report.json'));
    } finally {
      // stage belongs exclusively to this invocation; only its regenerated legacy output remains.
      fs.rmSync(stage, { recursive: true });
    }
    console.log(
      JSON.stringify({
        passed: report.passed,
        deterministic: report.deterministic && {
          cases: report.deterministic.cases,
          passed: report.deterministic.passed
        },
        real_effect: report.real_effect,
        legacyReportUnchanged: report.legacyReportUnchanged,
        output: 'tmp/engineering-eval-v1/report.json',
        error: report.error || null
      })
    );
  }
}
