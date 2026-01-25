#!/usr/bin/env node

/**
 * CODE-EXECUTOR v3.0 - 自动化执行引擎
 * 读取UX审计报告并自动生成代码、测试、部署
 * @version 3.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    phase: (msg) => console.log(`\n${colors.magenta}[PHASE]${colors.reset} ${msg}\n`)
};

// 命令行参数
const args = process.argv.slice(2);
const reportPath = args.find(arg => arg.startsWith('--report='))?.split('=')[1];
const previewOnly = args.includes('--preview');

// 项目根目录
const PROJECT_ROOT = '/Users/blackdj/Desktop/EXAM-MASTER';

// 自动查找最新审计报告
function findLatestReport() {
    const today = new Date().toISOString().split('T')[0];
    const auditDir = path.join(PROJECT_ROOT, 'ux-audit', today);

    if (!fs.existsSync(auditDir)) {
        log.error(`未找到今日审计目录: ${auditDir}`);
        return null;
    }

    const reportFile = path.join(auditDir, 'ux-audit-report.md');
    if (fs.existsSync(reportFile)) {
        return reportFile;
    }

    log.error(`未找到审计报告: ${reportFile}`);
    return null;
}

// Phase 1: 紧急制动与快照
function createSnapshot() {
    log.phase('Phase 1: 紧急制动与快照 (30秒)');

    try {
        // 检查当前分支
        const currentBranch = execSync('git branch --show-current', { cwd: PROJECT_ROOT }).toString().trim();
        log.info(`当前分支: ${currentBranch}`);

        // 检查Git状态
        const gitStatus = execSync('git status --porcelain', { cwd: PROJECT_ROOT }).toString();
        if (gitStatus.trim()) {
            log.warning('检测到未提交的更改，将创建快照');
        }

        // 如果不在main分支，先切换
        if (currentBranch !== 'main') {
            log.info('切换到main分支...');
            // 使用stash保存当前更改
            if (gitStatus.trim()) {
                execSync('git stash', { cwd: PROJECT_ROOT, stdio: 'inherit' });
            }
            execSync('git checkout main', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        }

        // 拉取最新代码（如果有远程仓库）
        try {
            log.info('拉取最新代码...');
            execSync('git pull origin main', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        } catch (error) {
            log.warning('跳过git pull（无远程仓库或网络问题）');
        }

        // 创建快照分支
        const timestamp = Date.now();
        const snapshotBranch = `snapshot/pre-${timestamp}`;
        log.info(`创建快照分支: ${snapshotBranch}`);
        execSync(`git checkout -b ${snapshotBranch}`, { cwd: PROJECT_ROOT, stdio: 'inherit' });

        // 如果有stash的更改，恢复它们
        try {
            const stashList = execSync('git stash list', { cwd: PROJECT_ROOT }).toString();
            if (stashList.trim()) {
                execSync('git stash pop', { cwd: PROJECT_ROOT, stdio: 'inherit' });
            }
        } catch (error) {
            // 忽略stash pop错误
        }

        // 提交所有更改到快照分支
        const newGitStatus = execSync('git status --porcelain', { cwd: PROJECT_ROOT }).toString();
        if (newGitStatus.trim()) {
            execSync('git add .', { cwd: PROJECT_ROOT });
            execSync(`git commit -m "snapshot: CODE-EXECUTOR任务前自动快照"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
        }

        // 切回main分支（使用-f强制切换）
        log.info('切回main分支...');
        execSync('git checkout -f main', { cwd: PROJECT_ROOT, stdio: 'inherit' });

        log.success(`快照创建成功: ${snapshotBranch}`);
        return snapshotBranch;
    } catch (error) {
        log.error(`快照创建失败: ${error.message}`);
        process.exit(1);
    }
}

// Phase 2: 报告解析与任务生成
function parseReport(reportPath) {
    log.phase('Phase 2: 报告解析与任务生成 (1分钟)');

    const tasksPath = '/tmp/tasks.json';
    const parseScript = path.join(PROJECT_ROOT, 'scripts/ux-automation/parse-ux-report.js');

    try {
        log.info(`解析报告: ${reportPath}`);
        execSync(`node ${parseScript} --input=${reportPath} --output=${tasksPath}`, {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
        });

        // 验证任务清单
        const validateScript = path.join(PROJECT_ROOT, 'scripts/ux-automation/validate-tasks.js');
        log.info('验证任务清单...');
        execSync(`node ${validateScript} ${tasksPath}`, {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
        });

        // 读取任务数据
        const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
        log.success(`任务清单生成成功: ${tasksData.tasks.length} 个任务`);

        return tasksData;
    } catch (error) {
        log.error(`报告解析失败: ${error.message}`);
        process.exit(1);
    }
}

// Phase 3: 任务预览
function previewTasks(tasksData) {
    log.phase('任务预览');

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 CODE-EXECUTOR v3.0 - 任务清单`);
    console.log(`${'='.repeat(80)}\n`);

    console.log(`📊 总任务数: ${tasksData.tasks.length}`);
    console.log(`   - P1 (阻塞级): ${tasksData.tasks.filter(t => t.priority === 1).length}`);
    console.log(`   - P2 (体验摩擦): ${tasksData.tasks.filter(t => t.priority === 2).length}`);
    console.log(`   - P3 (优化建议): ${tasksData.tasks.filter(t => t.priority === 3).length}\n`);

    tasksData.tasks.forEach((task, index) => {
        const priorityLabel = task.priority === 1 ? '🔴 P1' : task.priority === 2 ? '🟡 P2' : '🟢 P3';
        console.log(`${index + 1}. ${priorityLabel} [${task.dimension}] ${task.module}`);
        console.log(`   问题: ${task.description}`);
        console.log(`   影响: ${task.impact}`);
        console.log(`   解决方案: ${task.solution}`);
        console.log(`   Cline指令: ${task.clineCommand}`);
        console.log(`   验收标准: ${task.acceptanceCriteria}\n`);
    });

    console.log(`${'='.repeat(80)}\n`);
}

// 主函数
async function main() {
    console.log(`\n${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}🤖 CODE-EXECUTOR v3.0 - 自动化执行引擎${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

    // 查找审计报告
    const finalReportPath = reportPath || findLatestReport();
    if (!finalReportPath) {
        log.error('无法找到审计报告，请使用 --report 参数指定路径');
        process.exit(1);
    }

    log.info(`审计报告: ${finalReportPath}`);

    // 创建快照
    const snapshotBranch = createSnapshot();

    // 解析报告
    const tasksData = parseReport(finalReportPath);

    // 预览任务
    previewTasks(tasksData);

    if (previewOnly) {
        log.info('预览模式，不执行任务');
        log.info(`快照分支: ${snapshotBranch}`);
        process.exit(0);
    }

    // Phase 3: 任务执行（待实现）
    log.phase('Phase 3: 任务执行');
    log.warning('任务执行功能正在开发中...');
    log.info('当前版本仅支持报告解析和任务预览');
    log.info('');
    log.info('下一步操作:');
    log.info('1. 查看任务清单: cat /tmp/tasks.json');
    log.info('2. 手动执行任务: 参考 ux-audit/2026-01-24/cline-tasks.sh');
    log.info(`3. 如需回滚: git checkout ${snapshotBranch}`);
    log.info('');

    log.success('CODE-EXECUTOR 预览完成！');
}

// 启动
main().catch(error => {
    log.error(`执行失败: ${error.message}`);
    process.exit(1);
});
