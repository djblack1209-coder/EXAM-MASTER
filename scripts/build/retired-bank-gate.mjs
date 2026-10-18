import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RETIRED = /(?:^|\/)(?:flashcard-banks|question-bank)(?:\/|\.(?:vue|js|json))|bank-data-(?:table|loader|codec)\./;

export function auditRetiredBank(root = ROOT, artifacts = []) {
  const findings = [];
  const visit = (directory, artifact = false) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const relative = path
        .relative(artifact ? directory : root, file)
        .split(path.sep)
        .join('/');
      if (entry.isSymbolicLink()) {
        findings.push({ path: file, reason: 'unscanned-symlink' });
        continue;
      }
      if (entry.isDirectory()) {
        visit(file, artifact);
        continue;
      }
      if (
        RETIRED.test(file.split(path.sep).join('/')) ||
        /professional-source-(?:index|manifest)\.json$/.test(relative)
      )
        findings.push({ path: file, reason: 'retired-public-bank' });
    }
  };
  for (const name of ['src/config', 'src/pages/practice-sub', 'cdn-assets', 'data']) visit(path.join(root, name));
  for (const artifact of artifacts) {
    if (!fs.existsSync(artifact)) findings.push({ path: artifact, reason: 'missing-artifact' });
    else visit(artifact, true);
  }
  return { contract: 'public-bank-retirement-v1', retired: true, ok: findings.length === 0, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditRetiredBank(
    ROOT,
    process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}
