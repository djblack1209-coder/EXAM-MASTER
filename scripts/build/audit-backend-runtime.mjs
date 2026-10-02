import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// No project .env, provider keys, production URI or inherited model permissions.
const code = `
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const entries = readdirSync('laf-backend/standalone/dist/functions').filter(x => x.endsWith('.js'));
const results = [];
for (const name of entries) {
  try {
    const value = await import(pathToFileURL(resolve('laf-backend/standalone/dist/functions', name)));
    results.push({ name, loaded: typeof value.default === 'function' });
  } catch (error) { results.push({ name, loaded: false, error: error.message }); }
}
await (await import('./laf-backend/standalone/dist/standalone/cloud-shim.js')).closeDb();
console.log(JSON.stringify({ total: results.length, passed: results.filter(x => x.loaded).length, results }));
`;
const raw = execFileSync(process.execPath, ['--input-type=module'], {
  cwd: root,
  input: code,
  encoding: 'utf8',
  timeout: 30000,
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27189/exam_learning_isolated',
    DB_NAME: 'exam_learning_isolated',
    JWT_SECRET: 'TEST_ONLY_native_import_validation_32chars',
    LEARNING_PLATFORM_CALLS_ENABLED: 'false',
    LEARNING_PAYMENT_SANDBOX_ENABLED: 'false'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});
const report = JSON.parse(raw.trim());
const output = path.join(root, 'tmp/maintenance/backend-native-imports.json');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, passed: report.passed, output }));
if (!report.total || report.passed !== report.total) process.exitCode = 1;
