#!/usr/bin/env node
/**
 * EXAM-MASTER 四端构建脚本
 *
 * 用法:
 *   node scripts/build/build-all-platforms.mjs          # 构建所有平台
 *   node scripts/build/build-all-platforms.mjs --mac     # 仅 macOS
 *   node scripts/build/build-all-platforms.mjs --win     # 仅 Windows
 *   node scripts/build/build-all-platforms.mjs --android # 仅 Android
 *   node scripts/build/build-all-platforms.mjs --h5      # 仅 H5/PWA
 *   node scripts/build/build-all-platforms.mjs --mp      # 仅微信小程序
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const args = process.argv.slice(2);
const buildAll = args.length === 0;

const PLATFORMS = {
  h5: { flag: '--h5', name: 'H5/PWA', cmd: 'npm run build:h5' },
  mp: { flag: '--mp', name: '微信小程序', cmd: 'npm run build:mp-weixin' },
  mac: { flag: '--mac', name: 'macOS (DMG)', cmd: 'npm run electron:build:mac' },
  win: { flag: '--win', name: 'Windows (EXE)', cmd: 'npm run electron:build:win' },
  android: { flag: '--android', name: 'Android (APK)', cmd: 'npm run app:build:android' },
  ios: { flag: '--ios', name: 'iOS (IPA)', cmd: 'npm run app:build:ios' }
};

function log(msg) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${msg}`);
  console.log('='.repeat(60));
}

function run(cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error(`\n❌ 构建失败: ${cmd}`);
    return false;
  }
}

// 检查环境
log('检查构建环境');
console.log(`  Node: ${process.version}`);
console.log(`  Platform: ${process.platform} ${process.arch}`);
console.log(`  Project: ${ROOT}`);

// 检查 node_modules
if (!existsSync(join(ROOT, 'node_modules'))) {
  log('安装依赖...');
  run('npm install');
}

const results = [];

for (const [key, platform] of Object.entries(PLATFORMS)) {
  if (!buildAll && !args.includes(platform.flag)) continue;

  // iOS 只能在 macOS 上构建
  if (key === 'ios' && process.platform !== 'darwin') {
    console.log(`\n⚠️  跳过 ${platform.name} — 需要 macOS + Xcode`);
    results.push({ name: platform.name, status: 'skipped' });
    continue;
  }

  // Electron 需要对应平台或交叉编译
  if (key === 'win' && process.platform === 'darwin') {
    console.log(`\n⚠️  在 macOS 上构建 Windows 版本需要 Wine（可能较慢）`);
  }

  log(`构建 ${platform.name}...`);
  const ok = run(platform.cmd);
  results.push({ name: platform.name, status: ok ? 'success' : 'failed' });
}

// 汇总
log('构建结果汇总');
for (const r of results) {
  const icon = r.status === 'success' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
  console.log(`  ${icon} ${r.name}: ${r.status}`);
}

if (existsSync(join(ROOT, 'release'))) {
  console.log(`\n📦 安装包位置: ${join(ROOT, 'release')}`);
}

console.log(`\n📱 H5 构建位置: ${join(ROOT, 'dist', 'build', 'h5')}`);
console.log(`📱 小程序构建位置: ${join(ROOT, 'dist', 'build', 'mp-weixin')}`);
