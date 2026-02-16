#!/usr/bin/env node
/**
 * UI 质量门禁扫描工具
 * 
 * 功能：
 * 1. 检查 Vue 组件的加载状态实现
 * 2. 检查错误处理覆盖率
 * 3. 检查 CSS 性能优化（GPU 加速）
 * 4. 检查无障碍访问（a11y）
 * 5. 检查代码规范
 * 
 * 使用方法：
 * node scripts/ui-quality-gate.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  srcDir: path.join(__dirname, '../src'),
  pagesDir: path.join(__dirname, '../src/pages'),
  componentsDir: path.join(__dirname, '../src/components'),
  extensions: ['.vue', '.js'],
  ignorePatterns: ['node_modules', 'dist', 'unpackage', '.git']
};

// 检查结果
const results = {
  passed: [],
  warnings: [],
  errors: [],
  stats: {
    totalFiles: 0,
    vueFiles: 0,
    jsFiles: 0,
    loadingStates: 0,
    errorHandlers: 0,
    gpuAccelerated: 0
  }
};

/**
 * 递归获取所有文件
 */
function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // 跳过忽略的目录
    if (CONFIG.ignorePatterns.some(pattern => filePath.includes(pattern))) {
      return;
    }
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (CONFIG.extensions.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * 检查 Vue 组件的加载状态
 */
function checkLoadingStates(content, filePath) {
  const checks = [];
  const fileName = path.basename(filePath);
  
  // 检查是否有异步操作
  const hasAsyncOps = /async\s+\w+|\.then\(|await\s+|uni\.request|lafService\./g.test(content);
  
  if (hasAsyncOps) {
    // 检查是否有加载状态变量
    const hasLoadingState = /isLoading|loading|isAnalyzing|isTyping|isRecognizing|isGenerating|isInitLoading/i.test(content);
    
    // 检查是否有加载 UI
    const hasLoadingUI = /v-if=".*loading|v-show=".*loading|<base-loading|<loading|uni\.showLoading|骨架屏|skeleton/i.test(content);
    
    if (hasLoadingState && hasLoadingUI) {
      results.stats.loadingStates++;
      checks.push({
        type: 'pass',
        message: `${fileName}: 加载状态实现完整`
      });
    } else if (hasLoadingState) {
      checks.push({
        type: 'warning',
        message: `${fileName}: 有加载状态变量但缺少加载 UI`
      });
    } else {
      checks.push({
        type: 'warning',
        message: `${fileName}: 有异步操作但缺少加载状态`
      });
    }
  }
  
  return checks;
}

/**
 * 检查错误处理
 */
function checkErrorHandling(content, filePath) {
  const checks = [];
  const fileName = path.basename(filePath);
  
  // 检查是否有 try-catch
  const hasTryCatch = /try\s*{[\s\S]*?}\s*catch/g.test(content);
  
  // 检查是否有错误提示
  const hasErrorToast = /uni\.showToast.*icon:\s*['"]none['"]|uni\.showModal.*title.*失败|catch.*showToast/i.test(content);
  
  // 检查是否导入了全局错误处理器
  const hasGlobalErrorHandler = /globalErrorHandler|reportError|reportNetworkError/i.test(content);
  
  // 检查是否有 Promise 错误处理
  const hasPromiseErrorHandling = /\.catch\(|\.finally\(/g.test(content);
  
  if (hasTryCatch || hasPromiseErrorHandling) {
    results.stats.errorHandlers++;
    
    if (hasErrorToast || hasGlobalErrorHandler) {
      checks.push({
        type: 'pass',
        message: `${fileName}: 错误处理完整`
      });
    } else {
      checks.push({
        type: 'warning',
        message: `${fileName}: 有错误捕获但缺少用户提示`
      });
    }
  }
  
  return checks;
}

/**
 * 检查 CSS 性能优化
 */
function checkCSSPerformance(content, filePath) {
  const checks = [];
  const fileName = path.basename(filePath);
  
  // 检查是否使用 transform 代替 top/left 动画
  const hasTransform = /transform:\s*(translate|scale|rotate)/i.test(content);
  const hasPositionAnimation = /animation[\s\S]*?(top|left|right|bottom)[\s\S]*?;/i.test(content);
  
  // 检查是否有 GPU 加速
  const hasGPUAcceleration = /will-change|transform:\s*translateZ|backface-visibility/i.test(content);
  
  // 检查是否有 backdrop-filter（需要 GPU）
  const hasBackdropFilter = /backdrop-filter/i.test(content);
  
  if (hasGPUAcceleration || hasBackdropFilter) {
    results.stats.gpuAccelerated++;
    checks.push({
      type: 'pass',
      message: `${fileName}: 已启用 GPU 加速`
    });
  }
  
  if (hasPositionAnimation && !hasTransform) {
    checks.push({
      type: 'warning',
      message: `${fileName}: 建议使用 transform 代替 position 动画`
    });
  }
  
  return checks;
}

/**
 * 检查无障碍访问
 */
function checkAccessibility(content, filePath) {
  const checks = [];
  const fileName = path.basename(filePath);
  
  // 检查图片是否有 alt 或 mode
  const imgTags = content.match(/<image[^>]*>/g) || [];
  const imgsWithoutAlt = imgTags.filter(tag => !tag.includes('mode=') && !tag.includes('alt='));
  
  if (imgsWithoutAlt.length > 0) {
    checks.push({
      type: 'warning',
      message: `${fileName}: ${imgsWithoutAlt.length} 个 image 标签缺少 mode 属性`
    });
  }
  
  // 检查按钮是否有文字或 aria-label
  const buttonTags = content.match(/<button[^>]*>[\s\S]*?<\/button>/g) || [];
  const emptyButtons = buttonTags.filter(tag => {
    const innerContent = tag.replace(/<button[^>]*>/, '').replace(/<\/button>/, '').trim();
    return innerContent.length === 0 && !tag.includes('aria-label');
  });
  
  if (emptyButtons.length > 0) {
    checks.push({
      type: 'warning',
      message: `${fileName}: ${emptyButtons.length} 个空按钮缺少 aria-label`
    });
  }
  
  return checks;
}

/**
 * 检查代码规范
 */
function checkCodeStyle(content, filePath) {
  const checks = [];
  const fileName = path.basename(filePath);
  
  // 检查是否使用 console.log（应使用 logger）
  const hasConsoleLog = /console\.(log|warn|error)\(/g.test(content);
  const hasLogger = /logger\.(log|warn|error|debug)\(/g.test(content);
  
  if (hasConsoleLog && !hasLogger) {
    checks.push({
      type: 'warning',
      message: `${fileName}: 建议使用 logger 代替 console`
    });
  }
  
  // 检查是否有硬编码的颜色值（应使用 CSS 变量）
  const hardcodedColors = content.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)/g) || [];
  const cssVarColors = content.match(/var\(--[^)]+\)/g) || [];
  
  if (hardcodedColors.length > 10 && cssVarColors.length < hardcodedColors.length / 2) {
    checks.push({
      type: 'info',
      message: `${fileName}: 发现 ${hardcodedColors.length} 个硬编码颜色，建议使用 CSS 变量`
    });
  }
  
  return checks;
}

/**
 * 扫描单个文件
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath);
  
  results.stats.totalFiles++;
  
  if (ext === '.vue') {
    results.stats.vueFiles++;
    
    // 执行所有检查
    const loadingChecks = checkLoadingStates(content, filePath);
    const errorChecks = checkErrorHandling(content, filePath);
    const cssChecks = checkCSSPerformance(content, filePath);
    const a11yChecks = checkAccessibility(content, filePath);
    const styleChecks = checkCodeStyle(content, filePath);
    
    // 汇总结果
    [...loadingChecks, ...errorChecks, ...cssChecks, ...a11yChecks, ...styleChecks].forEach(check => {
      if (check.type === 'pass') {
        results.passed.push(check.message);
      } else if (check.type === 'warning') {
        results.warnings.push(check.message);
      } else if (check.type === 'error') {
        results.errors.push(check.message);
      }
    });
  } else if (ext === '.js') {
    results.stats.jsFiles++;
    
    // JS 文件只检查错误处理和代码规范
    const errorChecks = checkErrorHandling(content, filePath);
    const styleChecks = checkCodeStyle(content, filePath);
    
    [...errorChecks, ...styleChecks].forEach(check => {
      if (check.type === 'pass') {
        results.passed.push(check.message);
      } else if (check.type === 'warning') {
        results.warnings.push(check.message);
      } else if (check.type === 'error') {
        results.errors.push(check.message);
      }
    });
  }
}

/**
 * 生成报告
 */
function generateReport() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              UI 质量门禁扫描报告                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // 统计信息
  console.log('📊 扫描统计:');
  console.log(`   总文件数: ${results.stats.totalFiles}`);
  console.log(`   Vue 组件: ${results.stats.vueFiles}`);
  console.log(`   JS 文件: ${results.stats.jsFiles}`);
  console.log(`   加载状态实现: ${results.stats.loadingStates}`);
  console.log(`   错误处理覆盖: ${results.stats.errorHandlers}`);
  console.log(`   GPU 加速组件: ${results.stats.gpuAccelerated}`);
  console.log('');
  
  // 通过项
  if (results.passed.length > 0) {
    console.log('✅ 通过项 (' + results.passed.length + '):');
    results.passed.slice(0, 10).forEach(msg => console.log('   ' + msg));
    if (results.passed.length > 10) {
      console.log(`   ... 还有 ${results.passed.length - 10} 项`);
    }
    console.log('');
  }
  
  // 警告项
  if (results.warnings.length > 0) {
    console.log('⚠️  警告项 (' + results.warnings.length + '):');
    results.warnings.slice(0, 15).forEach(msg => console.log('   ' + msg));
    if (results.warnings.length > 15) {
      console.log(`   ... 还有 ${results.warnings.length - 15} 项`);
    }
    console.log('');
  }
  
  // 错误项
  if (results.errors.length > 0) {
    console.log('❌ 错误项 (' + results.errors.length + '):');
    results.errors.forEach(msg => console.log('   ' + msg));
    console.log('');
  }
  
  // 质量评分
  const totalChecks = results.passed.length + results.warnings.length + results.errors.length;
  const score = totalChecks > 0 
    ? Math.round((results.passed.length / totalChecks) * 100) 
    : 100;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📈 质量评分: ${score}/100`);
  
  if (score >= 80) {
    console.log('🎉 优秀！代码质量良好');
  } else if (score >= 60) {
    console.log('👍 良好，但仍有改进空间');
  } else {
    console.log('⚠️  需要改进，请关注警告和错误项');
  }
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // 返回是否通过门禁
  return results.errors.length === 0;
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始 UI 质量门禁扫描...');
  console.log(`   扫描目录: ${CONFIG.srcDir}`);
  
  // 获取所有文件
  const files = getAllFiles(CONFIG.srcDir);
  console.log(`   发现 ${files.length} 个文件`);
  
  // 扫描每个文件
  files.forEach(file => {
    try {
      scanFile(file);
    } catch (error) {
      results.errors.push(`扫描失败: ${path.basename(file)} - ${error.message}`);
    }
  });
  
  // 生成报告
  const passed = generateReport();
  
  // 退出码
  process.exit(passed ? 0 : 1);
}

// 运行
main();
