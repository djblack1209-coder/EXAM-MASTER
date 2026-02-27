#!/usr/bin/env node

/**
 * GPU加速优化器
 * 检查并优化所有组件的动画性能
 *
 * 优化策略：
 * 1. 添加 will-change 提示
 * 2. 确保使用 transform 和 opacity
 * 3. 避免触发重排/重绘的属性
 * 4. 添加 transform: translateZ(0) 强制GPU加速
 */

import fs from 'node:fs';
import path from 'node:path';

// 需要检查的组件列表
const componentsToCheck = [
  'src/components/StudyBookshelf.vue',
  'src/components/SubjectPieChart.vue',
  'src/components/EnhancedAvatar.vue',
  'src/components/GlassModal.vue',
  'src/components/EnhancedProgress.vue',
  'src/components/EnhancedButton.vue',
  'src/components/EnhancedCard.vue'
];

// 性能问题检测规则
const performanceRules = {
  // P0: 严重性能问题（触发重排）
  critical: [
    {
      pattern: /animation:.*?(width|height|top|left|right|bottom|margin|padding)/g,
      message: '动画使用了触发重排的属性'
    },
    {
      pattern: /transition:.*?(width|height|top|left|right|bottom|margin|padding)/g,
      message: '过渡使用了触发重排的属性'
    }
  ],
  // P1: 重要优化（缺少GPU加速提示）
  important: [
    {
      pattern: /@keyframes\s+(\w+)\s*{[^}]*transform:[^}]*}/g,
      message: '动画缺少 will-change 提示',
      needsWillChange: true
    },
    { pattern: /transition:.*?transform/g, message: '过渡缺少 will-change 提示', needsWillChange: true }
  ],
  // P2: 建议优化
  suggestion: [
    { pattern: /animation:.*?(?!transform|opacity)/g, message: '建议使用 transform 或 opacity 实现动画' },
    { pattern: /transition:.*?(?!transform|opacity)/g, message: '建议使用 transform 或 opacity 实现过渡' }
  ]
};

// 优化建议
const _optimizationSuggestions = {
  willChange: {
    transform: 'will-change: transform;',
    opacity: 'will-change: opacity;',
    transformOpacity: 'will-change: transform, opacity;'
  },
  gpuHack: 'transform: translateZ(0);',
  backfaceVisibility: 'backface-visibility: hidden;'
};

// 分析结果
const analysisResults = {
  total: 0,
  critical: [],
  important: [],
  suggestion: [],
  optimized: []
};

console.log('🚀 GPU加速优化器启动...\n');

// 分析单个组件
function analyzeComponent(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  console.log(`\n📄 分析组件: ${fileName}`);
  console.log('━'.repeat(60));

  analysisResults.total++;

  let hasIssues = false;
  const issues = {
    critical: [],
    important: [],
    suggestion: []
  };

  // 检查严重问题
  performanceRules.critical.forEach((rule) => {
    const matches = content.match(rule.pattern);
    if (matches) {
      hasIssues = true;
      matches.forEach((match) => {
        issues.critical.push({
          file: fileName,
          issue: rule.message,
          code: match.trim()
        });
      });
    }
  });

  // 检查重要问题
  performanceRules.important.forEach((rule) => {
    const matches = content.match(rule.pattern);
    if (matches && !content.includes('will-change')) {
      hasIssues = true;
      matches.forEach((match) => {
        issues.important.push({
          file: fileName,
          issue: rule.message,
          code: match.trim(),
          suggestion: rule.needsWillChange ? '添加 will-change 属性' : null
        });
      });
    }
  });

  // 检查建议优化
  performanceRules.suggestion.forEach((rule) => {
    const matches = content.match(rule.pattern);
    if (matches) {
      matches.forEach((match) => {
        // 排除已经使用 transform/opacity 的情况
        if (!match.includes('transform') && !match.includes('opacity')) {
          issues.suggestion.push({
            file: fileName,
            issue: rule.message,
            code: match.trim()
          });
        }
      });
    }
  });

  // 输出结果
  if (!hasIssues && issues.suggestion.length === 0) {
    console.log('✅ 性能优化良好，无需改进');
    analysisResults.optimized.push(fileName);
  } else {
    if (issues.critical.length > 0) {
      console.log(`\n❌ 严重问题 (${issues.critical.length}个):`);
      issues.critical.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.issue}`);
        console.log(`      代码: ${issue.code}`);
      });
      analysisResults.critical.push(...issues.critical);
    }

    if (issues.important.length > 0) {
      console.log(`\n⚠️  重要优化 (${issues.important.length}个):`);
      issues.important.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.issue}`);
        console.log(`      代码: ${issue.code}`);
        if (issue.suggestion) {
          console.log(`      建议: ${issue.suggestion}`);
        }
      });
      analysisResults.important.push(...issues.important);
    }

    if (issues.suggestion.length > 0) {
      console.log(`\n💡 建议优化 (${issues.suggestion.length}个):`);
      issues.suggestion.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.issue}`);
        console.log(`      代码: ${issue.code}`);
      });
      analysisResults.suggestion.push(...issues.suggestion);
    }
  }
}

// 生成优化建议
function generateOptimizationGuide() {
  console.log('\n\n📊 GPU加速优化总结');
  console.log('═'.repeat(60));
  console.log(`\n总计分析: ${analysisResults.total} 个组件`);
  console.log(`✅ 已优化: ${analysisResults.optimized.length} 个`);
  console.log(`❌ 严重问题: ${analysisResults.critical.length} 个`);
  console.log(`⚠️  重要优化: ${analysisResults.important.length} 个`);
  console.log(`💡 建议优化: ${analysisResults.suggestion.length} 个`);

  if (
    analysisResults.critical.length === 0 &&
    analysisResults.important.length === 0 &&
    analysisResults.suggestion.length === 0
  ) {
    console.log('\n🎉 所有组件性能优化良好！');
    return;
  }

  console.log('\n\n🔧 优化建议');
  console.log('━'.repeat(60));

  if (analysisResults.critical.length > 0) {
    console.log('\n❌ 严重问题（必须修复）:');
    console.log('   将动画/过渡属性改为 transform 或 opacity');
    console.log('   例如: width → transform: scaleX()');
    console.log('        left → transform: translateX()');
  }

  if (analysisResults.important.length > 0) {
    console.log('\n⚠️  重要优化（强烈建议）:');
    console.log('   为动画元素添加 will-change 属性:');
    console.log('   .animated-element {');
    console.log('     will-change: transform;');
    console.log('     /* 或 will-change: transform, opacity; */');
    console.log('   }');
  }

  if (analysisResults.suggestion.length > 0) {
    console.log('\n💡 建议优化（可选）:');
    console.log('   优先使用 transform 和 opacity 实现动画');
    console.log('   添加 GPU 加速提示:');
    console.log('   .element {');
    console.log('     transform: translateZ(0);');
    console.log('     backface-visibility: hidden;');
    console.log('   }');
  }

  // 生成详细报告
  const reportPath = 'GPU_OPTIMIZATION_REPORT.md';
  generateDetailedReport(reportPath);
  console.log(`\n📄 详细报告已生成: ${reportPath}`);
}

// 生成详细报告
function generateDetailedReport(reportPath) {
  let report = '# 🚀 GPU加速优化报告\n\n';
  report += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
  report += '---\n\n';

  report += '## 📊 总体概况\n\n';
  report += `| 指标 | 数量 | 状态 |\n`;
  report += `|------|------|------|\n`;
  report += `| 总计分析 | ${analysisResults.total}个 | - |\n`;
  report += `| 已优化 | ${analysisResults.optimized.length}个 | ✅ |\n`;
  report += `| 严重问题 | ${analysisResults.critical.length}个 | ${analysisResults.critical.length > 0 ? '❌' : '✅'} |\n`;
  report += `| 重要优化 | ${analysisResults.important.length}个 | ${analysisResults.important.length > 0 ? '⚠️' : '✅'} |\n`;
  report += `| 建议优化 | ${analysisResults.suggestion.length}个 | ${analysisResults.suggestion.length > 0 ? '💡' : '✅'} |\n\n`;

  if (analysisResults.optimized.length > 0) {
    report += '## ✅ 已优化组件\n\n';
    analysisResults.optimized.forEach((file) => {
      report += `- ${file}\n`;
    });
    report += '\n';
  }

  if (analysisResults.critical.length > 0) {
    report += '## ❌ 严重问题（必须修复）\n\n';
    analysisResults.critical.forEach((issue, index) => {
      report += `### ${index + 1}. ${issue.file}\n\n`;
      report += `**问题**: ${issue.issue}\n\n`;
      report += `**代码**:\n\`\`\`css\n${issue.code}\n\`\`\`\n\n`;
      report += `**修复建议**: 将属性改为 transform 或 opacity\n\n`;
    });
  }

  if (analysisResults.important.length > 0) {
    report += '## ⚠️ 重要优化（强烈建议）\n\n';
    analysisResults.important.forEach((issue, index) => {
      report += `### ${index + 1}. ${issue.file}\n\n`;
      report += `**问题**: ${issue.issue}\n\n`;
      report += `**代码**:\n\`\`\`css\n${issue.code}\n\`\`\`\n\n`;
      if (issue.suggestion) {
        report += `**优化建议**: ${issue.suggestion}\n\n`;
        report += `**示例代码**:\n\`\`\`css\n.animated-element {\n  will-change: transform;\n  /* 动画代码 */\n}\n\`\`\`\n\n`;
      }
    });
  }

  if (analysisResults.suggestion.length > 0) {
    report += '## 💡 建议优化（可选）\n\n';
    analysisResults.suggestion.forEach((issue, index) => {
      report += `### ${index + 1}. ${issue.file}\n\n`;
      report += `**建议**: ${issue.issue}\n\n`;
      report += `**代码**:\n\`\`\`css\n${issue.code}\n\`\`\`\n\n`;
    });
  }

  report += '## 🎓 GPU加速最佳实践\n\n';
  report += '### 1. 使用 transform 和 opacity\n\n';
  report += '这两个属性不会触发重排，性能最佳：\n\n';
  report += '```css\n';
  report += '/* ✅ 推荐 */\n';
  report += '.element {\n';
  report += '  transform: translateX(100px);\n';
  report += '  opacity: 0.5;\n';
  report += '}\n\n';
  report += '/* ❌ 避免 */\n';
  report += '.element {\n';
  report += '  left: 100px;  /* 触发重排 */\n';
  report += '  width: 200px; /* 触发重排 */\n';
  report += '}\n';
  report += '```\n\n';

  report += '### 2. 添加 will-change 提示\n\n';
  report += '告诉浏览器哪些属性将要变化，提前优化：\n\n';
  report += '```css\n';
  report += '.animated-element {\n';
  report += '  will-change: transform;\n';
  report += '  /* 或 will-change: transform, opacity; */\n';
  report += '}\n';
  report += '```\n\n';

  report += '### 3. 强制GPU加速\n\n';
  report += '使用 translateZ(0) 或 translate3d(0,0,0) 强制启用GPU加速：\n\n';
  report += '```css\n';
  report += '.element {\n';
  report += '  transform: translateZ(0);\n';
  report += '  backface-visibility: hidden;\n';
  report += '}\n';
  report += '```\n\n';

  report += '### 4. 避免触发重排的属性\n\n';
  report += '以下属性会触发重排，应避免在动画中使用：\n\n';
  report += '- width, height\n';
  report += '- top, left, right, bottom\n';
  report += '- margin, padding\n';
  report += '- border\n';
  report += '- font-size\n\n';

  report += '---\n\n';
  report += `**报告生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
  report += `**分析工具**: GPU加速优化器 v1.0\n`;

  fs.writeFileSync(reportPath, report, 'utf-8');
}

// 执行分析
componentsToCheck.forEach(analyzeComponent);

// 生成优化建议
generateOptimizationGuide();

console.log('\n✨ 分析完成！\n');
