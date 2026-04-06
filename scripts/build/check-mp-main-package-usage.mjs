import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const buildRoot = path.join(projectRoot, 'dist', 'build', 'mp-weixin');

const mainPageFiles = [
  'pages/index/index.js',
  'pages/practice/index.js',
  'pages/school/index.js',
  'pages/profile/index.js'
];

const requiredModules = [
  'utils/favorite/question-favorite.js',
  'utils/learning/adaptive-learning-engine.js',
  'practice-sub/utils/learning-analytics.js'
];

function readBuildFile(relativePath) {
  const filePath = path.join(buildRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[main-usage-check] 缺少构建文件: ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertModuleUsedByMainPackage(modulePath) {
  const foundIn = [];
  for (const pageFile of mainPageFiles) {
    const content = readBuildFile(pageFile);
    if (content.includes(modulePath)) {
      foundIn.push(pageFile);
    }
  }

  if (foundIn.length === 0) {
    throw new Error(`[main-usage-check] 主包未检测到对 ${modulePath} 的引用`);
  }

  return foundIn;
}

function run() {
  if (!fs.existsSync(buildRoot)) {
    throw new Error('[main-usage-check] 未找到 dist/build/mp-weixin，请先执行 npm run build:mp-weixin');
  }

  const report = requiredModules.map((modulePath) => ({
    modulePath,
    usedBy: assertModuleUsedByMainPackage(modulePath)
  }));

  for (const item of report) {
    console.log(`[main-usage-check] ${item.modulePath} -> ${item.usedBy.join(', ')}`);
  }

  console.log('[main-usage-check] 主包关键模块引用检查通过');
}

run();
