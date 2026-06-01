import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = process.cwd();
const buildRoot = path.join(projectRoot, 'dist', 'build', 'mp-weixin');
const appJsonPath = path.join(buildRoot, 'app.json');
const mediaExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp3', '.wav', '.aac', '.m4a']);
const sourceExtensions = new Set(['.js', '.json', '.wxml', '.wxss', '.wxs']);
const wechatMediaBudgetBytes = 200 * 1024;
const wechatMainPackageSourceBudgetBytes = 4 * 1024 * 1024;

function getMainPageFiles(rootDir = buildRoot) {
  const currentAppJsonPath = path.join(rootDir, 'app.json');
  if (!fs.existsSync(currentAppJsonPath)) {
    throw new Error('[main-usage-check] 缺少构建文件: app.json');
  }

  const appJson = JSON.parse(fs.readFileSync(currentAppJsonPath, 'utf8'));
  return [
    'app.js',
    ...(appJson.pages || [])
      .map((pagePath) => `${pagePath}.js`)
      .filter((relativePath) => fs.existsSync(path.join(rootDir, relativePath)))
  ];
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

function getSubPackageRoots(rootDir = buildRoot) {
  const currentAppJsonPath = path.join(rootDir, 'app.json');
  if (!fs.existsSync(currentAppJsonPath)) {
    return [];
  }

  const appJson = JSON.parse(fs.readFileSync(currentAppJsonPath, 'utf8'));
  return (appJson.subPackages || appJson.subpackages || [])
    .map((item) => item?.root)
    .filter(Boolean)
    .map((root) => root.replace(/^\/+|\/+$/g, ''));
}

function isInsideSubPackage(relativePath, subPackageRoots) {
  return subPackageRoots.some((root) => relativePath === root || relativePath.startsWith(`${root}/`));
}

function getMainPackageSourceFiles(rootDir = buildRoot) {
  const subPackageRoots = getSubPackageRoots(rootDir);
  return walkFiles(rootDir)
    .map((filePath) => ({
      filePath,
      relativePath: path.relative(rootDir, filePath).split(path.sep).join('/')
    }))
    .filter((item) => sourceExtensions.has(path.extname(item.relativePath).toLowerCase()))
    .filter((item) => !isInsideSubPackage(item.relativePath, subPackageRoots));
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
    throw new Error(
      `[main-usage-check] 发现超过 200K 的图片/音频资源: ${oversizedFiles.map((item) => `${item.relativePath} (${item.size} bytes)`).join(', ')}`
    );
  }

  if (totalBytes > wechatMediaBudgetBytes) {
    throw new Error(
      `[main-usage-check] 图片/音频资源总量 ${totalBytes} bytes，超过微信代码质量阈值 ${wechatMediaBudgetBytes} bytes`
    );
  }

  console.log(`[main-usage-check] 图片/音频资源预算通过: ${mediaFiles.length} files / ${totalBytes} bytes`);
}

export function assertMainPackageSourceBudget(rootDir = buildRoot) {
  const mainFiles = getMainPackageSourceFiles(rootDir);
  const totalBytes = mainFiles.reduce((sum, item) => sum + fs.statSync(item.filePath).size, 0);

  if (totalBytes > wechatMainPackageSourceBudgetBytes) {
    throw new Error(
      `[main-usage-check] 主包源码体积 ${totalBytes} bytes，超过微信上传上限 ${wechatMainPackageSourceBudgetBytes} bytes`
    );
  }

  console.log(`[main-usage-check] 主包源码体积通过: ${mainFiles.length} files / ${totalBytes} bytes`);
}

export function assertNoFlashcardBanksInMainPackage(rootDir = buildRoot) {
  const bankDir = path.join(rootDir, 'config', 'flashcard-banks');
  const bankFiles = walkFiles(bankDir).filter((filePath) => /\.(js|json)$/.test(filePath));
  if (bankFiles.length > 0) {
    throw new Error(
      `[main-usage-check] flashcard-banks 题库数据进入主包: ${bankFiles
        .slice(0, 5)
        .map((filePath) => path.relative(rootDir, filePath).split(path.sep).join('/'))
        .join(', ')}`
    );
  }
  console.log('[main-usage-check] 主包未包含 flashcard-banks 题库数据');
}

export function assertPracticeSubpackageBankDataRuntime(rootDir = buildRoot) {
  const practiceRoot = path.join(rootDir, 'pages', 'practice-sub');
  const loaderPath = path.join(practiceRoot, 'bank-data-loader.js');
  if (!fs.existsSync(loaderPath)) {
    console.log('[main-usage-check] practice-sub 未包含题库加载器，跳过题库运行模块检查');
    return;
  }

  const loaderSource = fs.readFileSync(loaderPath, 'utf8');
  const missingModules = [];
  const requireMatches = loaderSource.matchAll(/require\(["']\.\/flashcard-banks\/([^"']+)["']\)/g);
  for (const match of requireMatches) {
    const relativePath = `pages/practice-sub/flashcard-banks/${match[1]}`;
    if (!fs.existsSync(path.join(rootDir, relativePath))) {
      missingModules.push(relativePath);
    }
  }

  const tablePath = path.join(practiceRoot, 'bank-data-table.js');
  const codecPath = path.join(practiceRoot, 'bank-data-codec.js');
  const hasGeneratedTable =
    fs.existsSync(tablePath) &&
    fs.readFileSync(tablePath, 'utf8').includes('COMPRESSED_BANK_DATA_BY_ID') &&
    fs.existsSync(codecPath);

  if (missingModules.length > 0 && !hasGeneratedTable) {
    throw new Error(
      `[main-usage-check] 题库运行模块缺失: ${missingModules
        .slice(0, 5)
        .join(', ')}；请确认压缩题库数据已进入 practice-sub 分包产物`
    );
  }

  if (!hasGeneratedTable && !fs.existsSync(path.join(practiceRoot, 'flashcard-banks'))) {
    throw new Error('[main-usage-check] 题库运行模块缺失: practice-sub 未包含压缩题库数据表或题库模块目录');
  }

  console.log('[main-usage-check] practice-sub 题库运行模块检查通过');
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

  assertMainPackageSourceBudget();
  assertNoFlashcardBanksInMainPackage();
  assertPracticeSubpackageBankDataRuntime();
  assertWechatMediaBudget();
  console.log('[main-usage-check] 主包关键模块引用检查通过');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
