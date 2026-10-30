#!/usr/bin/env node
// Compare exact test IDs, including duplicate occurrences; never infer by counts.
import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    baseline: { type: 'string' },
    report: { type: 'string' },
    output: { type: 'string' }
  }
});
const root = process.cwd();
function local(value) {
  const path = resolve(root, value || '');
  if (!path.startsWith(resolve(root, 'tmp') + '/') || realpathSync(dirname(path)) !== dirname(path))
    throw new Error('Use a non-symlink path inside project tmp');
  return path;
}
const baseline = JSON.parse(readFileSync(local(values.baseline), 'utf8'));
const report = JSON.parse(readFileSync(local(values.report), 'utf8'));
const output = local(values.output);
if (existsSync(output)) throw new Error('Preserve the prior comparison; choose a new output filename');
if (!Array.isArray(baseline.remainingFailures) || !Array.isArray(report.testResults))
  throw new Error('Expected round1 triage and a complete Vitest JSON report');
const before = baseline.remainingFailures;
const after = report.testResults.flatMap((suite) =>
  suite.assertionResults
    .filter((test) => test.status === 'failed')
    .map((test) => ({ file: relative(root, suite.name), test: test.fullName, failureMessages: test.failureMessages }))
);
if (after.length !== report.numFailedTests) throw new Error('Failed-test count does not match the report');
const id = (test) => `${test.file}\0${test.test}`;
const remaining = new Map();
for (const test of before) {
  const key = id(test);
  remaining.set(key, [...(remaining.get(key) || []), test]);
}
const newFailures = [],
  existingFailures = [];
for (const test of after) {
  const prior = remaining.get(id(test));
  if (prior?.length) {
    existingFailures.push({ ...test, baseline: prior.shift() });
  } else newFailures.push(test);
}
const resolved = [...remaining.values()].flat();
const result = {
  comparedAt: new Date().toISOString(),
  baseline: values.baseline,
  report: values.report,
  method:
    'Exact repository-relative file + Vitest fullName; multiset occurrence matching. No fuzzy matching or count-only inference.',
  summary: {
    baselineFailures: before.length,
    currentFailures: after.length,
    newFailures: newFailures.length,
    existingFailures: existingFailures.length,
    resolved: resolved.length,
    total: report.numTotalTests,
    passed: report.numPassedTests,
    skipped: report.numPendingTests
  },
  newFailures,
  existingFailures,
  resolved
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output: values.output, ...result.summary }));
if (newFailures.length) process.exitCode = 2;
