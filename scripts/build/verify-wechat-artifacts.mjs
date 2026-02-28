import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outputRoot = resolve(process.cwd(), 'dist/build/mp-weixin');

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
  'custom-tab-bar/index.json',
  'components/layout/custom-tabbar/custom-tabbar.json',
  'components/layout/custom-tabbar/custom-tabbar.js',
  'components/layout/custom-tabbar/custom-tabbar.wxml',
  'components/layout/custom-tabbar/custom-tabbar.wxss'
];

for (const file of requiredFiles) {
  const fullPath = resolve(outputRoot, file);
  if (!existsSync(fullPath)) {
    fail(`missing required artifact: ${file}`);
  }
}

const appJsonPath = resolve(outputRoot, 'app.json');
const indexJsonPath = resolve(outputRoot, 'pages/index/index.json');

const appJson = readJson(appJsonPath);
if (!Array.isArray(appJson.pages) || appJson.pages.length === 0) {
  fail('app.json pages is empty or invalid.');
}

const pageIndexJson = readJson(indexJsonPath);
const usingComponents = pageIndexJson.usingComponents || {};
const customTabbarPath = usingComponents['custom-tabbar'];

if (!customTabbarPath) {
  fail('pages/index/index.json missing usingComponents.custom-tabbar');
}

const customTabbarJsonPath = resolve(outputRoot, 'pages/index', `${customTabbarPath}.json`);
if (!existsSync(customTabbarJsonPath)) {
  fail(`custom-tabbar component target not found: ${customTabbarPath}.json`);
}

console.log('[wx:verify] OK: WeChat mini-program artifacts are valid.');
console.log(`[wx:verify] Import directory: ${outputRoot}`);
console.log('[wx:verify] If DevTools still errors, remove project cache and re-import this directory.');
