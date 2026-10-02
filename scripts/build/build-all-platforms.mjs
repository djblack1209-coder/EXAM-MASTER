#!/usr/bin/env node
/** 构建已有平台入口；未实现的安装包明确失败，不安装依赖。 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const PLATFORMS = [
  { flag: '--h5', name: '网页', script: 'build:h5' },
  { flag: '--mac', name: 'macOS 安装包', script: 'electron:build:mac' },
  { flag: '--win', name: 'Windows 安装包', script: 'electron:build:win' },
  { flag: '--mp', name: '微信小程序', script: 'build:mp-weixin' },
  { flag: '--android', name: 'Android 安装包', script: 'app:build:android' },
  { flag: '--ios', name: 'iOS 安装包', script: 'app:build:ios' }
];

export function buildPlatforms(args, { root = ROOT, run = execFileSync } = {}) {
  const { scripts } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (args.some((arg) => !PLATFORMS.some((platform) => platform.flag === arg))) {
    console.error('未知平台；可用参数：' + PLATFORMS.map((platform) => platform.flag).join(' '));
    return 1;
  }
  const selected = PLATFORMS.filter((platform) =>
    args.length ? args.includes(platform.flag) : Boolean(scripts[platform.script])
  );
  // 完整预检后再构建，避免选择了尚未实现的平台却生成部分产物。
  if (!selected.length || selected.some((platform) => !scripts[platform.script])) {
    console.error('所选平台尚未提供安装包构建入口。');
    return 1;
  }
  if (!existsSync(path.join(root, 'node_modules'))) {
    console.error('依赖未就绪；请按项目约定准备后再构建。');
    return 1;
  }
  let failed = false;
  for (const platform of selected) {
    console.log(`构建 ${platform.name}`);
    try {
      run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', platform.script], {
        cwd: root,
        stdio: 'inherit'
      });
      console.log(`${platform.name}：构建通过，设备或安装验收另行进行。`);
    } catch {
      failed = true;
      console.error(`${platform.name}：构建失败。`);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = buildPlatforms(process.argv.slice(2));
}
