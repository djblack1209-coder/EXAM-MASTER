#!/usr/bin/env node

/**
 * 更新组件导入路径
 * 将组件从旧的扁平结构迁移到新的分类结构
 */

const fs = require('fs');
const path = require('path');

// 组件路径映射
const componentMappings = {
  // Base components
  'base-skeleton/base-skeleton': 'base/base-skeleton/base-skeleton',
  'base-empty/base-empty': 'base/base-empty/base-empty',
  'base-loading/base-loading': 'base/base-loading/base-loading',

  // Layout components
  'custom-tabbar/custom-tabbar': 'layout/custom-tabbar/custom-tabbar',
  'HomeNavbar': 'layout/HomeNavbar',

  // Common components
  'TodoList': 'common/TodoList',
  'EnhancedAvatar': 'common/EnhancedAvatar',
  'EnhancedButton': 'common/EnhancedButton',
  'EnhancedCard': 'common/EnhancedCard',
  'EnhancedProgress': 'common/EnhancedProgress',
  'GlassModal': 'common/GlassModal',
  'FilePreviewModal': 'common/FilePreviewModal',
  'InviteModal': 'common/InviteModal',
  'PosterModal': 'common/PosterModal',
  'CountdownCard': 'common/CountdownCard',
  'PracticeBanner': 'common/PracticeBanner',
  'StudyBookshelf': 'common/StudyBookshelf',
  'StudyOverview': 'common/StudyOverview',
  'SubjectPieChart': 'common/SubjectPieChart',

  // Business components (保持不变，但需要更新路径前缀)
  'practice/': 'business/practice/',
  'profile/': 'business/profile/',
  'school/': 'business/school/',
  'ai-consult/': 'business/ai-consult/'
};

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  // 更新每个组件的导入路径
  for (const [oldPath, newPath] of Object.entries(componentMappings)) {
    const regex = new RegExp(`components/${oldPath}`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `components/${newPath}`);
      updated = true;
      console.log(`  ✓ Updated: ${oldPath} -> ${newPath}`);
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  let updatedCount = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 跳过 node_modules, unpackage, dist 等目录
      if (!['node_modules', 'unpackage', 'dist', '.git'].includes(file)) {
        updatedCount += scanDirectory(filePath);
      }
    } else if (file.endsWith('.vue') || file.endsWith('.js')) {
      console.log(`Checking: ${filePath}`);
      if (updateFile(filePath)) {
        updatedCount++;
      }
    }
  }

  return updatedCount;
}

// 主函数
function main() {
  console.log('🔄 开始更新组件导入路径...\n');

  const srcDir = path.join(__dirname, '../../src');
  const updatedCount = scanDirectory(srcDir);

  console.log(`\n✅ 完成！共更新了 ${updatedCount} 个文件`);
}

main();
