#!/usr/bin/env node

/**
 * 状态机测试脚本
 * 用途：验证 5 个角色的状态流转逻辑
 * 作者：EXAM-MASTER 自动化团队
 * 日期：2026-01-25
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 状态定义
const STATES = {
  A: { name: 'PM (价值规划)', emoji: '🧐', color: 'blue' },
  B: { name: 'Architect (设计)', emoji: '🏗️', color: 'green' },
  C: { name: 'Dev (构建)', emoji: '💻', color: 'yellow' },
  D: { name: 'QA (验收)', emoji: '🛡️', color: 'magenta' },
  E: { name: 'DevOps (决策)', emoji: '🚀', color: 'red' },
};

// 文件路径
const LOGS_DIR = path.join(process.cwd(), 'logs');
const FILES = {
  progress: path.join(LOGS_DIR, 'progress.log'),
  pmPlan: path.join(LOGS_DIR, 'pm-plan.json'),
  archDesign: path.join(LOGS_DIR, 'arch-design.json'),
  devLog: path.join(LOGS_DIR, 'dev-implementation.log'),
  testReport: path.join(LOGS_DIR, 'test-report.md'),
  errorLog: path.join(LOGS_DIR, 'error_log.txt'),
  criticalFailure: path.join(LOGS_DIR, 'CRITICAL_FAILURE.md'),
};

// 确保日志目录存在
function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    log('✅ 创建日志目录: logs/', 'green');
  }
}

// 清理测试文件
function cleanupTestFiles() {
  log('\n🧹 清理测试文件...', 'cyan');
  Object.values(FILES).forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      log(`  ✓ 删除: ${path.basename(file)}`, 'yellow');
    }
  });
}

// 模拟状态 A: PM
function simulateStateA() {
  log('\n' + '='.repeat(60), 'bright');
  log(`${STATES.A.emoji} 状态 A: ${STATES.A.name}`, STATES.A.color);
  log('='.repeat(60), 'bright');

  const pmPlan = {
    cycle_id: 'test-iter1',
    selected_feature: '测试功能',
    user_stories: [
      {
        id: 'US-001',
        as_a: '作为测试用户',
        i_want: '我想要验证状态机',
        so_that: '以便于确保自动化流程正常',
        acceptance_criteria: ['状态流转正确', '文件生成正确'],
      },
    ],
    priority: 'P0',
    estimated_hours: 1,
  };

  fs.writeFileSync(FILES.pmPlan, JSON.stringify(pmPlan, null, 2));
  log('✅ 生成文件: pm-plan.json', 'green');
  log(`📋 选定功能: ${pmPlan.selected_feature}`, 'cyan');
  log(`🎯 优先级: ${pmPlan.priority}`, 'cyan');

  return true;
}

// 模拟状态 B: Architect
function simulateStateB() {
  log('\n' + '='.repeat(60), 'bright');
  log(`${STATES.B.emoji} 状态 B: ${STATES.B.name}`, STATES.B.color);
  log('='.repeat(60), 'bright');

  if (!fs.existsSync(FILES.pmPlan)) {
    log('❌ 错误: pm-plan.json 不存在', 'red');
    return false;
  }

  const pmPlan = JSON.parse(fs.readFileSync(FILES.pmPlan, 'utf-8'));
  log(`📖 读取 PM 计划: ${pmPlan.selected_feature}`, 'cyan');

  const archDesign = {
    cycle_id: pmPlan.cycle_id,
    impact_analysis: {
      affected_files: ['src/pages/test.vue'],
      affected_components: ['TestComponent'],
      affected_services: ['testService'],
    },
    design_decisions: [
      {
        decision: '添加测试组件',
        rationale: '验证状态机流转',
        implementation: '创建新的 Vue 组件',
      },
    ],
    refactor_plan: {
      files_to_modify: ['src/pages/test.vue'],
      files_to_create: [],
      estimated_loc: 50,
    },
  };

  fs.writeFileSync(FILES.archDesign, JSON.stringify(archDesign, null, 2));
  log('✅ 生成文件: arch-design.json', 'green');
  log(`🔍 影响文件: ${archDesign.impact_analysis.affected_files.length} 个`, 'cyan');

  return true;
}

// 模拟状态 C: Dev
function simulateStateC() {
  log('\n' + '='.repeat(60), 'bright');
  log(`${STATES.C.emoji} 状态 C: ${STATES.C.name}`, STATES.C.color);
  log('='.repeat(60), 'bright');

  if (!fs.existsSync(FILES.archDesign)) {
    log('❌ 错误: arch-design.json 不存在', 'red');
    return false;
  }

  const archDesign = JSON.parse(fs.readFileSync(FILES.archDesign, 'utf-8'));
  log(`📖 读取架构设计: ${archDesign.design_decisions.length} 个决策`, 'cyan');

  const devLog = {
    cycle_id: archDesign.cycle_id,
    files_modified: [
      {
        path: 'src/pages/test.vue',
        lines_added: 50,
        lines_deleted: 0,
        changes: ['添加测试组件', '实现基础功能'],
      },
    ],
    self_check: {
      lint_passed: true,
      build_passed: true,
      manual_test: '已完成基础测试',
    },
  };

  fs.writeFileSync(FILES.devLog, JSON.stringify(devLog, null, 2));
  log('✅ 生成文件: dev-implementation.log', 'green');
  log(`📝 修改文件: ${devLog.files_modified.length} 个`, 'cyan');
  log(`✓ Lint 通过: ${devLog.self_check.lint_passed}`, 'green');

  return true;
}

// 模拟状态 D: QA
function simulateStateD(score = 95) {
  log('\n' + '='.repeat(60), 'bright');
  log(`${STATES.D.emoji} 状态 D: ${STATES.D.name}`, STATES.D.color);
  log('='.repeat(60), 'bright');

  if (!fs.existsSync(FILES.devLog)) {
    log('❌ 错误: dev-implementation.log 不存在', 'red');
    return false;
  }

  const devLog = JSON.parse(fs.readFileSync(FILES.devLog, 'utf-8'));
  log(`📖 读取开发日志: ${devLog.files_modified.length} 个文件`, 'cyan');

  const testReport = `# QA 测试报告 - ${devLog.cycle_id}

## 验收结果
- ✅ US-001: 状态流转测试 (通过)
- ✅ US-002: 文件生成测试 (通过)

## 性能指标
- 构建时间: 10s (正常)
- 包体积: 1.0MB (正常)
- 加载时间: 0.5s (优秀)

## 遗留风险
- 🟢 低风险: 无

## 价值评分
- 功能完整度: ${score}%
- 用户体验提升: +50%
- 技术债务: 无新增
- **总分**: ${score}/100
`;

  fs.writeFileSync(FILES.testReport, testReport);
  log('✅ 生成文件: test-report.md', 'green');
  log(`📊 总分: ${score}/100`, score >= 95 ? 'green' : score >= 80 ? 'yellow' : 'red');

  return score;
}

// 模拟状态 E: DevOps
function simulateStateE(score) {
  log('\n' + '='.repeat(60), 'bright');
  log(`${STATES.E.emoji} 状态 E: ${STATES.E.name}`, STATES.E.color);
  log('='.repeat(60), 'bright');

  if (!fs.existsSync(FILES.testReport)) {
    log('❌ 错误: test-report.md 不存在', 'red');
    return 'STOP';
  }

  log(`📖 读取测试报告: 评分 ${score}/100`, 'cyan');

  let decision;
  if (score >= 95) {
    decision = 'START_NEW_CYCLE';
    log('✅ 决策: 完美通过，启动新循环', 'green');
    log('  → Git 提交 (模拟)', 'cyan');
    log('  → 写入 progress.log: START_NEW_CYCLE', 'cyan');
  } else if (score >= 80) {
    decision = 'RETRY_CYCLE_1';
    log('⚠️  决策: 需要重试', 'yellow');
    log('  → 写入 progress.log: RETRY_CYCLE_1', 'cyan');
    log('  → 回到状态 C (Dev)', 'cyan');
  } else {
    decision = 'CRITICAL_FAILURE';
    log('❌ 决策: 致命错误，熔断', 'red');
    log('  → 写入 CRITICAL_FAILURE.md', 'cyan');
    log('  → 停止自动化循环', 'cyan');

    const failureReport = `# 熔断报告

## 熔断原因
- QA 评分过低: ${score}/100 (阈值: 80)

## 熔断时间
- ${new Date().toISOString()}

## 建议
- 人工介入检查代码质量
- 修复问题后重新启动自动化流程
`;
    fs.writeFileSync(FILES.criticalFailure, failureReport);
  }

  fs.writeFileSync(FILES.progress, decision);
  log('✅ 生成文件: progress.log', 'green');

  return decision;
}

// 运行完整测试
function runFullTest(score = 95) {
  log('\n' + '█'.repeat(60), 'bright');
  log('🚀 状态机完整测试', 'cyan');
  log('█'.repeat(60), 'bright');

  ensureLogsDir();
  cleanupTestFiles();

  // 执行状态流转
  const results = {
    A: simulateStateA(),
    B: simulateStateB(),
    C: simulateStateC(),
    D: simulateStateD(score),
    E: simulateStateE(score),
  };

  // 输出测试结果
  log('\n' + '='.repeat(60), 'bright');
  log('📊 测试结果汇总', 'cyan');
  log('='.repeat(60), 'bright');

  Object.entries(results).forEach(([state, result]) => {
    const stateInfo = STATES[state];
    const status = result === true || typeof result === 'number' ? '✅ 通过' : result === false ? '❌ 失败' : `✓ ${result}`;
    log(`${stateInfo.emoji} 状态 ${state}: ${status}`, stateInfo.color);
  });

  // 验证文件生成
  log('\n📁 文件生成验证:', 'cyan');
  const expectedFiles = [FILES.pmPlan, FILES.archDesign, FILES.devLog, FILES.testReport, FILES.progress];

  if (score < 80) {
    expectedFiles.push(FILES.criticalFailure);
  }

  expectedFiles.forEach((file) => {
    const exists = fs.existsSync(file);
    const status = exists ? '✅' : '❌';
    log(`  ${status} ${path.basename(file)}`, exists ? 'green' : 'red');
  });

  log('\n' + '█'.repeat(60), 'bright');
  log('✅ 测试完成！', 'green');
  log('█'.repeat(60), 'bright');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  switch (command) {
    case 'full':
      const score = parseInt(args[1]) || 95;
      runFullTest(score);
      break;

    case 'clean':
      ensureLogsDir();
      cleanupTestFiles();
      log('✅ 清理完成', 'green');
      break;

    case 'help':
      log('\n状态机测试脚本使用说明:', 'cyan');
      log('  node scripts/test-state-machine.js full [score]  # 运行完整测试（默认评分95）', 'yellow');
      log('  node scripts/test-state-machine.js clean         # 清理测试文件', 'yellow');
      log('  node scripts/test-state-machine.js help          # 显示帮助', 'yellow');
      log('\n示例:', 'cyan');
      log('  node scripts/test-state-machine.js full 95       # 测试完美通过场景', 'yellow');
      log('  node scripts/test-state-machine.js full 85       # 测试重试场景', 'yellow');
      log('  node scripts/test-state-machine.js full 70       # 测试熔断场景', 'yellow');
      break;

    default:
      log(`❌ 未知命令: ${command}`, 'red');
      log('使用 "help" 查看帮助', 'yellow');
  }
}

// 执行
main();