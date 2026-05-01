import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const buildRoot = path.join(projectRoot, 'dist', 'build', 'mp-weixin');
const appJsonPath = path.join(buildRoot, 'app.json');

function getMainPageFiles() {
  if (!fs.existsSync(appJsonPath)) {
    throw new Error('[main-usage-check] 缺少构建文件: app.json');
  }

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  return ['app.js', ...(appJson.pages || [])
    .map((pagePath) => `${pagePath}.js`)
    .filter((relativePath) => fs.existsSync(path.join(buildRoot, relativePath)))];
}

const requiredModules = [
  'services/fsrs-service.js',
  'stores/modules/review.js',
  'stores/modules/study-engine.js',
  'utils/learning/adaptive-learning-engine.js',
  'utils/security/sanitize.js'
].filter((modulePath) => fs.existsSync(path.join(buildRoot, modulePath)));

function readBuildFile(relativePath) {
  const filePath = path.join(buildRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[main-usage-check] 缺少构建文件: ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertModuleUsedByMainPackage(modulePath) {
  const foundIn = [];
  const mainPageFiles = getMainPageFiles();

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

  if (requiredModules.length === 0) {
    console.log('[main-usage-check] 未发现需要检查的主包共享模块，跳过');
    return;
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
