#!/usr/bin/env node
/**
 * 图片转换为 WebP 格式脚本
 * 
 * 功能：
 * 1. 扫描 src/static 目录下的 PNG/JPG 图片
 * 2. 转换为 WebP 格式（保留原文件）
 * 3. 生成转换报告
 * 
 * 使用方式：
 * node scripts/convert-to-webp.js
 * 
 * 注意：
 * - 需要安装 sharp: npm install sharp --save-dev
 * - WebP 格式在现代浏览器和小程序中都有良好支持
 * - 转换后文件大小通常减少 25-35%
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 源目录
  sourceDir: path.join(__dirname, '../src/static'),
  // 支持的输入格式
  inputFormats: ['.png', '.jpg', '.jpeg'],
  // WebP 质量 (0-100)
  quality: 85,
  // 是否保留原文件
  keepOriginal: true,
  // 是否覆盖已存在的 WebP
  overwrite: false,
};

// 统计信息
const stats = {
  scanned: 0,
  converted: 0,
  skipped: 0,
  failed: 0,
  savedBytes: 0,
};

/**
 * 递归获取目录下所有图片文件
 */
function getImageFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      getImageFiles(fullPath, files);
    } else {
      const ext = path.extname(item).toLowerCase();
      if (CONFIG.inputFormats.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 主函数 - 使用原生方式（不依赖 sharp）
 */
async function main() {
  console.log('========================================');
  console.log('  图片 WebP 转换工具');
  console.log('========================================\n');
  
  // 检查源目录
  if (!fs.existsSync(CONFIG.sourceDir)) {
    console.error(`错误: 源目录不存在 ${CONFIG.sourceDir}`);
    process.exit(1);
  }
  
  // 获取所有图片文件
  const imageFiles = getImageFiles(CONFIG.sourceDir);
  stats.scanned = imageFiles.length;
  
  console.log(`扫描目录: ${CONFIG.sourceDir}`);
  console.log(`找到图片: ${imageFiles.length} 个\n`);
  
  if (imageFiles.length === 0) {
    console.log('没有找到需要转换的图片');
    return;
  }
  
  // 检查是否安装了 sharp
  let sharp;
  try {
    sharp = require('sharp');
    console.log('使用 sharp 进行转换...\n');
  } catch (e) {
    console.log('========================================');
    console.log('  提示: sharp 模块未安装');
    console.log('========================================\n');
    console.log('要启用 WebP 转换，请运行:');
    console.log('  npm install sharp --save-dev\n');
    console.log('然后重新运行此脚本。\n');
    
    // 输出图片列表供参考
    console.log('当前图片列表:');
    console.log('----------------------------------------');
    imageFiles.forEach((file, index) => {
      const relativePath = path.relative(CONFIG.sourceDir, file);
      const size = fs.statSync(file).size;
      console.log(`${index + 1}. ${relativePath} (${formatSize(size)})`);
    });
    
    // 计算总大小
    const totalSize = imageFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
    console.log('----------------------------------------');
    console.log(`总计: ${imageFiles.length} 个文件, ${formatSize(totalSize)}`);
    console.log('\n预计转换后可节省约 25-35% 空间');
    
    return;
  }
  
  // 使用 sharp 转换
  for (const inputPath of imageFiles) {
    const relativePath = path.relative(CONFIG.sourceDir, inputPath);
    const outputPath = inputPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    
    // 检查是否已存在
    if (!CONFIG.overwrite && fs.existsSync(outputPath)) {
      console.log(`跳过 (已存在): ${relativePath}`);
      stats.skipped++;
      continue;
    }
    
    try {
      const inputSize = fs.statSync(inputPath).size;
      
      await sharp(inputPath)
        .webp({ quality: CONFIG.quality })
        .toFile(outputPath);
      
      const outputSize = fs.statSync(outputPath).size;
      const saved = inputSize - outputSize;
      const savedPercent = ((saved / inputSize) * 100).toFixed(1);
      
      stats.converted++;
      stats.savedBytes += saved;
      
      console.log(`✓ ${relativePath}`);
      console.log(`  ${formatSize(inputSize)} → ${formatSize(outputSize)} (节省 ${savedPercent}%)`);
      
    } catch (err) {
      console.error(`✗ ${relativePath}: ${err.message}`);
      stats.failed++;
    }
  }
  
  // 输出统计
  console.log('\n========================================');
  console.log('  转换完成');
  console.log('========================================');
  console.log(`扫描文件: ${stats.scanned}`);
  console.log(`成功转换: ${stats.converted}`);
  console.log(`跳过文件: ${stats.skipped}`);
  console.log(`转换失败: ${stats.failed}`);
  console.log(`节省空间: ${formatSize(stats.savedBytes)}`);
  console.log('========================================\n');
  
  if (stats.converted > 0) {
    console.log('提示: WebP 文件已生成，原文件已保留。');
    console.log('在代码中使用 WebP 时，建议添加 PNG/JPG 作为降级方案。');
  }
}

// 运行
main().catch(console.error);
