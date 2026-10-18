import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatForbiddenClientSecretFindings, scanForbiddenClientSecrets } from './wechat-artifact-secret-scan.mjs';

const outputRoot = resolve(process.env.UNI_OUTPUT_DIR || resolve(process.cwd(), 'dist/build/mp-weixin'));

function fail(message) {
  console.error(`[wx:verify] FAIL: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    fail(`invalid JSON: ${filePath}\n${error.message}`);
  }
}

if (!existsSync(outputRoot)) {
  fail('dist/build/mp-weixin not found. Run npm run build:mp-weixin first.');
}

const requiredFiles = [
  'app.json',
  'project.config.json',
  'pages/index/index.json',
  'pages/learning/index.json',
  'pages/archive/index.json',
  'components/business/learning/learning-shell.json'
];

for (const file of requiredFiles) {
  const fullPath = resolve(outputRoot, file);
  if (!existsSync(fullPath)) {
    fail(`missing required artifact: ${file}`);
  }
}

const appJsonPath = resolve(outputRoot, 'app.json');

const appJson = readJson(appJsonPath);
if (!Array.isArray(appJson.pages) || appJson.pages.length === 0) {
  fail('app.json pages is empty or invalid.');
}
const previewRoute = 'platforms/h5/components';
const routes = [
  ...appJson.pages,
  ...(appJson.subPackages || []).flatMap((pkg) => (pkg.pages || []).map((page) => `${pkg.root}/${page}`))
];
if (routes.includes(previewRoute) || existsSync(resolve(outputRoot, `${previewRoute}.js`))) {
  fail('H5 component review page is reachable in the WeChat artifact.');
}

if (appJson.tabBar) fail('The conversation workspace must use its drawer, not the retired tab bar.');
if (routes.includes('pages/practice-sub/question-bank')) fail('Retired question-bank route is reachable.');
const learningJson = readJson(resolve(outputRoot, 'pages/learning/index.json'));
if (!learningJson.usingComponents?.['learning-shell']) fail('Conversation workspace shell is missing.');

const secretFindings = scanForbiddenClientSecrets(outputRoot);
if (secretFindings.length > 0) {
  fail(`server-only env names found in client artifacts:\n${formatForbiddenClientSecretFindings(secretFindings)}`);
}

console.log('[wx:verify] OK: WeChat mini-program artifacts are valid.');
console.log(`[wx:verify] Import directory: ${outputRoot}`);
console.log('[wx:verify] If DevTools still errors, remove project cache and re-import this directory.');
