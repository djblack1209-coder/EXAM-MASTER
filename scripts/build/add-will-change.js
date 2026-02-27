#!/usr/bin/env node

/**
 * 批量添加 will-change 属性
 * 自动为所有需要的组件添加 GPU 加速提示
 */

import fs from 'node:fs';
import path from 'node:path';

// 需要优化的组件及其优化规则
const optimizations = [
  {
    file: 'src/components/SubjectPieChart.vue',
    changes: [
      {
        search:
          '    animation: sliceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) backwards;\n    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);',
        replace:
          '    animation: sliceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) backwards;\n    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);\n    will-change: transform;'
      },
      {
        search:
          '.chart-scene {\n    position: relative;\n    width: 300rpx;\n    height: 300rpx;\n    transform-style: preserve-3d;\n    transform: rotateX(60deg) rotateZ(0deg);\n    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);',
        replace:
          '.chart-scene {\n    position: relative;\n    width: 300rpx;\n    height: 300rpx;\n    transform-style: preserve-3d;\n    transform: rotateX(60deg) rotateZ(0deg);\n    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);\n    will-change: transform;'
      }
    ]
  },
  {
    file: 'src/components/EnhancedAvatar.vue',
    changes: [
      {
        search: '    animation: statusPulse 2s ease-in-out infinite;',
        replace: '    animation: statusPulse 2s ease-in-out infinite;\n    will-change: transform, opacity;'
      },
      {
        search: '    transition: transform 0.3s ease;',
        replace: '    transition: transform 0.3s ease;\n    will-change: transform;'
      }
    ]
  },
  {
    file: 'src/components/GlassModal.vue',
    changes: [
      {
        search: '    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
        replace: '    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n    will-change: transform, opacity;'
      },
      {
        search: '    animation: slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
        replace: '    animation: slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n    will-change: transform, opacity;'
      }
    ]
  },
  {
    file: 'src/components/EnhancedButton.vue',
    changes: [
      {
        search: '    animation: spin 1s linear infinite;',
        replace: '    animation: spin 1s linear infinite;\n    will-change: transform;'
      }
    ]
  }
];

console.log('🚀 开始批量添加 will-change 属性...\n');

let totalChanges = 0;
let successCount = 0;
let failCount = 0;

optimizations.forEach(({ file, changes }) => {
  const filePath = path.join(process.cwd(), file);
  const fileName = path.basename(file);

  console.log(`📄 处理文件: ${fileName}`);

  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  文件不存在，跳过\n`);
    failCount++;
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let fileChanged = false;
  let changeCount = 0;

  changes.forEach(({ search, replace }, index) => {
    if (content.includes(search)) {
      content = content.replace(search, replace);
      fileChanged = true;
      changeCount++;
      console.log(`   ✅ 应用优化 ${index + 1}/${changes.length}`);
    } else {
      console.log(`   ⚠️  优化 ${index + 1}/${changes.length} 未找到匹配内容`);
    }
  });

  if (fileChanged) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`   💾 已保存 ${changeCount} 处优化\n`);
    totalChanges += changeCount;
    successCount++;
  } else {
    console.log(`   ℹ️  无需修改\n`);
  }
});

console.log('━'.repeat(60));
console.log('\n📊 优化完成统计:');
console.log(`   ✅ 成功: ${successCount} 个文件`);
console.log(`   ❌ 失败: ${failCount} 个文件`);
console.log(`   📝 总计: ${totalChanges} 处优化`);
console.log('\n✨ 批量优化完成！\n');
