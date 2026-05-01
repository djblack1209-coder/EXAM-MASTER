import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const buildRoot = path.join(projectRoot, 'dist', 'build', 'mp-weixin');
const appJsonPath = path.join(buildRoot, 'app.json');
const mediaExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.mp3',
  '.wav',
  '.aac',
  '.m4a'
]);
const wechatMediaBudgetBytes = 200 * 1024;

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
  'config/game-constants.js',
  'services/fsrs-service.js',
  'stores/modules/favorite.js',
  'stores/modules/gamification.js',
  'stores/modules/review.js',
  'stores/modules/study-engine.js',
  'stores/modules/tools.js',
  'utils/helpers/haptic.js',
  'utils/learning/adaptive-learning-engine.js',
  'utils/modal.js',
  'utils/practice/demo-bank.js',
  'utils/quiz-elo.js',
  'utils/security/sanitize.js'
].filter((modulePath) => fs.existsSync(path.join(buildRoot, modulePath)));

function readBuildFile(relativePath) {
  const filePath = path.join(buildRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[main-usage-check] 缺少构建文件: ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const result = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

function assertWechatMediaBudget() {
  const mediaFiles = walkFiles(buildRoot).filter((filePath) =>
    mediaExtensions.has(path.extname(filePath).toLowerCase())
  );
  const totalBytes = mediaFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
  const oversizedFiles = mediaFiles
    .map((filePath) => ({
      relativePath: path.relative(buildRoot, filePath).split(path.sep).join('/'),
      size: fs.statSync(filePath).size
    }))
    .filter((item) => item.size > wechatMediaBudgetBytes);

  if (oversizedFiles.length > 0) {
    throw new Error(`[main-usage-check] 发现超过 200K 的图片/音频资源: ${oversizedFiles.map((item) => `${item.relativePath} (${item.size} bytes)`).join(', ')}`);
  }

  if (totalBytes > wechatMediaBudgetBytes) {
    throw new Error(`[main-usage-check] 图片/音频资源总量 ${totalBytes} bytes，超过微信代码质量阈值 ${wechatMediaBudgetBytes} bytes`);
  }

  console.log(`[main-usage-check] 图片/音频资源预算通过: ${mediaFiles.length} files / ${totalBytes} bytes`);
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

  assertWechatMediaBudget();
  console.log('[main-usage-check] 主包关键模块引用检查通过');
}

run();
