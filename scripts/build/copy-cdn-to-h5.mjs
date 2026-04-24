#!/usr/bin/env node

/**
 * 将 cdn-assets/ 目录下的静态资源复制到 H5 构建产物的 /static/ 目录
 *
 * 背景：
 *   GitHub Raw 在国内被墙，CDN 地址不可用。
 *   H5 端的解决方案是把图片直接打进产物——构建后把 cdn-assets/ 内容
 *   复制到 dist/build/h5/static/ 下，这样 getAssetUrl() 回退到 /static/ 就能正常加载。
 *
 * 用法：
 *   node scripts/build/copy-cdn-to-h5.mjs
 *   通常由 npm run build:h5 自动调用，无需手动执行。
 */

import { existsSync, cpSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 项目根目录
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

// 源目录：cdn-assets/
const SRC_DIR = resolve(ROOT, 'cdn-assets');
// 目标目录：dist/build/h5/static/
const DEST_DIR = resolve(ROOT, 'dist', 'build', 'h5', 'static');

/**
 * 递归统计目录中的文件数量
 */
function countFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

// ==================== 主流程 ====================

console.log('[copy-cdn-to-h5] 开始复制 CDN 静态资源到 H5 构建产物...');

// 检查源目录是否存在
if (!existsSync(SRC_DIR)) {
  console.error(`[copy-cdn-to-h5] ❌ 源目录不存在: ${SRC_DIR}`);
  process.exit(1);
}

// 检查目标目录是否存在（构建产物必须先生成）
if (!existsSync(DEST_DIR)) {
  console.error(`[copy-cdn-to-h5] ❌ 目标目录不存在: ${DEST_DIR}`);
  console.error('[copy-cdn-to-h5]    请确认 H5 构建已完成（uni build -p h5）');
  process.exit(1);
}

// 统计要复制的文件数量
const fileCount = countFiles(SRC_DIR);
console.log(`[copy-cdn-to-h5] 📦 源目录: ${SRC_DIR} (${fileCount} 个文件)`);
console.log(`[copy-cdn-to-h5] 📂 目标目录: ${DEST_DIR}`);

// 复制：递归覆盖已有文件
// cpSync 是 Node.js 16.7+ 内置方法，不需要额外依赖
try {
  cpSync(SRC_DIR, DEST_DIR, {
    recursive: true,
    // 覆盖已存在的文件
    force: true,
    // 只复制文件和目录，忽略符号链接等
    filter: (src) => {
      // 跳过 .DS_Store 等系统文件
      const name = src.split('/').pop();
      return !name.startsWith('.');
    }
  });

  console.log(`[copy-cdn-to-h5] ✅ 成功复制 ${fileCount} 个文件到 H5 构建产物`);

  // 显示复制了哪些子目录
  const subDirs = readdirSync(SRC_DIR).filter(
    (entry) => statSync(join(SRC_DIR, entry)).isDirectory()
  );
  if (subDirs.length > 0) {
    console.log(`[copy-cdn-to-h5]    子目录: ${subDirs.join(', ')}`);
  }
} catch (err) {
  console.error(`[copy-cdn-to-h5] ❌ 复制失败:`, err.message);
  process.exit(1);
}
