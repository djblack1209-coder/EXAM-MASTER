/**
 * 深度扫描脚本 - 分析项目所有文件
 * 生成详细的文档分类报告
 */

import fs from 'node:fs';
import path from 'node:path';

// 文件分类规则
const FILE_CATEGORIES = {
  // 核心配置
  CONFIG: {
    patterns: [/\.config\.js$/, /^vite\.config/, /^manifest\.json$/, /^pages\.json$/, /^package\.json$/],
    description: '项目配置文件'
  },

  // Vue 组件
  COMPONENT: {
    patterns: [/src\/components\/.*\.vue$/],
    description: 'Vue 组件'
  },

  // 页面
  PAGE: {
    patterns: [/src\/pages\/.*\.vue$/],
    description: '页面文件'
  },

  // 状态管理
  STORE: {
    patterns: [/src\/stores\/.*\.js$/],
    description: 'Pinia 状态管理'
  },

  // 服务层
  SERVICE: {
    patterns: [/src\/services\/.*\.js$/],
    description: '服务层'
  },

  // 工具函数
  UTIL: {
    patterns: [/src\/utils\/.*\.js$/],
    description: '工具函数'
  },

  // 样式文件
  STYLE: {
    patterns: [/\.scss$/, /\.css$/],
    description: '样式文件'
  },

  // 文档
  DOC: {
    patterns: [/\.md$/, /README/i],
    description: '文档文件'
  },

  // 测试
  TEST: {
    patterns: [/tests\//, /\.spec\.js$/, /\.test\.js$/],
    description: '测试文件'
  },

  // 脚本
  SCRIPT: {
    patterns: [/scripts\//, /^playwright/],
    description: '脚本文件'
  }
};

// 扫描目录
function scanDirectory(dir, baseDir = dir) {
  const results = {
    files: [],
    stats: {
      total: 0,
      byCategory: {},
      byExtension: {}
    }
  };

  // 忽略的目录
  const ignoreDirs = ['node_modules', '.git', 'unpackage', 'dist', 'backups'];

  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        // 跳过断裂的符号链接或不可访问的文件
        continue;
      }

      if (stat.isDirectory()) {
        if (!ignoreDirs.includes(item)) {
          scan(fullPath);
        }
      } else {
        const relativePath = path.relative(baseDir, fullPath);
        const ext = path.extname(item);

        // 只处理源代码和文档文件
        if (['.vue', '.js', '.json', '.md', '.scss', '.css'].includes(ext)) {
          const fileInfo = analyzeFile(fullPath, relativePath);
          results.files.push(fileInfo);
          results.stats.total++;

          // 统计分类
          if (!results.stats.byCategory[fileInfo.category]) {
            results.stats.byCategory[fileInfo.category] = 0;
          }
          results.stats.byCategory[fileInfo.category]++;

          // 统计扩展名
          if (!results.stats.byExtension[ext]) {
            results.stats.byExtension[ext] = 0;
          }
          results.stats.byExtension[ext]++;
        }
      }
    }
  }

  scan(dir);
  return results;
}

// 分析单个文件
function analyzeFile(fullPath, relativePath) {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const ext = path.extname(fullPath);

  // 确定文件分类
  let category = 'OTHER';
  for (const [cat, config] of Object.entries(FILE_CATEGORIES)) {
    if (config.patterns.some((pattern) => pattern.test(relativePath))) {
      category = cat;
      break;
    }
  }

  // 分析代码特征
  const analysis = {
    path: relativePath,
    category,
    extension: ext,
    size: content.length,
    lines: lines.length,
    features: extractFeatures(content, ext)
  };

  return analysis;
}

// 提取代码特征
function extractFeatures(content, _ext) {
  const features = {
    imports: [],
    exports: [],
    functions: [],
    components: [],
    apis: [],
    todos: [],
    comments: 0
  };

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // 导入语句
    if (trimmed.startsWith('import ')) {
      features.imports.push(trimmed);
    }

    // 导出语句
    if (trimmed.startsWith('export ')) {
      features.exports.push(trimmed);
    }

    // 函数定义
    if (/^(async\s+)?function\s+\w+/.test(trimmed) || /^const\s+\w+\s*=\s*(async\s+)?\(/.test(trimmed)) {
      features.functions.push(trimmed.substring(0, 50));
    }

    // API 调用
    if (/lafService\.|storageService\.|uni\.request|wx\./.test(trimmed)) {
      features.apis.push(trimmed.substring(0, 60));
    }

    // TODO 注释
    if (/TODO|FIXME|HACK|XXX/.test(trimmed)) {
      features.todos.push(trimmed);
    }

    // 注释行
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      features.comments++;
    }
  }

  return features;
}

// 生成报告
function generateReport(results) {
  let report = '# 项目深度扫描报告\n\n';
  report += `**扫描时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
  report += `**文件总数**: ${results.stats.total}\n\n`;

  // 按分类统计
  report += '## 文件分类统计\n\n';
  report += '| 分类 | 数量 | 描述 |\n';
  report += '|------|------|------|\n';
  for (const [category, count] of Object.entries(results.stats.byCategory)) {
    const desc = FILE_CATEGORIES[category]?.description || '其他';
    report += `| ${category} | ${count} | ${desc} |\n`;
  }
  report += '\n';

  // 按扩展名统计
  report += '## 文件类型统计\n\n';
  report += '| 扩展名 | 数量 |\n';
  report += '|--------|------|\n';
  for (const [ext, count] of Object.entries(results.stats.byExtension)) {
    report += `| ${ext} | ${count} |\n`;
  }
  report += '\n';

  // 详细文件列表
  report += '## 详细文件清单\n\n';

  // 按分类组织
  for (const category of Object.keys(FILE_CATEGORIES)) {
    const files = results.files.filter((f) => f.category === category);
    if (files.length > 0) {
      report += `### ${category} (${files.length}个文件)\n\n`;
      for (const file of files) {
        report += `#### ${file.path}\n`;
        report += `- **大小**: ${file.size} 字节\n`;
        report += `- **行数**: ${file.lines}\n`;

        if (file.features.imports.length > 0) {
          report += `- **导入**: ${file.features.imports.length} 个\n`;
        }
        if (file.features.functions.length > 0) {
          report += `- **函数**: ${file.features.functions.length} 个\n`;
        }
        if (file.features.apis.length > 0) {
          report += `- **API调用**: ${file.features.apis.length} 处\n`;
        }
        if (file.features.todos.length > 0) {
          report += `- **TODO**: ${file.features.todos.length} 个\n`;
        }
        report += '\n';
      }
    }
  }

  return report;
}

// 主函数
function main() {
  console.log('🔍 开始深度扫描项目...\n');

  const projectRoot = process.cwd();
  const results = scanDirectory(projectRoot);

  console.log(`✅ 扫描完成！共分析 ${results.stats.total} 个文件\n`);

  // 生成报告
  const report = generateReport(results);
  const reportDir = path.join(projectRoot, 'docs', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, 'PROJECT_DEEP_SCAN_REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');

  console.log(`📄 报告已生成: ${reportPath}\n`);

  // 输出摘要
  console.log('📊 文件分类统计:');
  for (const [category, count] of Object.entries(results.stats.byCategory)) {
    console.log(`   ${category}: ${count}`);
  }
}

main();
