#!/usr/bin/env node

/**
 * VALIDATE-TASKS - 任务清单验证器
 * 验证JSON任务清单的完整性和正确性
 * @version 1.0.0
 */

const fs = require('fs');

const tasksPath = process.argv[2] || '/tmp/tasks.json';

if (!fs.existsSync(tasksPath)) {
    console.error(`❌ 错误: 任务清单文件不存在 ${tasksPath}`);
    process.exit(1);
}

console.log('🔍 验证任务清单...');

const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));

// 验证必需字段
const requiredFields = ['generatedAt', 'sourceReport', 'totalTasks', 'tasksByPriority', 'tasks'];
const missingFields = requiredFields.filter(field => !tasksData[field]);

if (missingFields.length > 0) {
    console.error(`❌ 缺少必需字段: ${missingFields.join(', ')}`);
    process.exit(1);
}

// 验证任务数量一致性
const actualTotal = tasksData.tasks.length;
if (actualTotal !== tasksData.totalTasks) {
    console.error(`❌ 任务数量不一致: 声明${tasksData.totalTasks}个，实际${actualTotal}个`);
    process.exit(1);
}

// 验证优先级统计
const p1Count = tasksData.tasks.filter(t => t.priority === 1).length;
const p2Count = tasksData.tasks.filter(t => t.priority === 2).length;
const p3Count = tasksData.tasks.filter(t => t.priority === 3).length;

if (p1Count !== tasksData.tasksByPriority.p1 ||
    p2Count !== tasksData.tasksByPriority.p2 ||
    p3Count !== tasksData.tasksByPriority.p3) {
    console.error('❌ 优先级统计不一致');
    console.error(`   声明: P1=${tasksData.tasksByPriority.p1}, P2=${tasksData.tasksByPriority.p2}, P3=${tasksData.tasksByPriority.p3}`);
    console.error(`   实际: P1=${p1Count}, P2=${p2Count}, P3=${p3Count}`);
    process.exit(1);
}

// 验证每个任务的必需字段
const taskRequiredFields = ['id', 'priority', 'title', 'module', 'description', 'solution', 'clineCommand'];
let hasErrors = false;

tasksData.tasks.forEach((task, index) => {
    const missing = taskRequiredFields.filter(field => !task[field] && task[field] !== 0);
    if (missing.length > 0) {
        console.error(`❌ 任务 #${index + 1} 缺少字段: ${missing.join(', ')}`);
        hasErrors = true;
    }

    // 验证优先级范围
    if (task.priority < 1 || task.priority > 3) {
        console.error(`❌ 任务 #${index + 1} 优先级无效: ${task.priority}`);
        hasErrors = true;
    }
});

if (hasErrors) {
    process.exit(1);
}

console.log('✅ 任务清单验证通过！');
console.log(`📊 统计:`);
console.log(`   - 总任务数: ${tasksData.totalTasks}`);
console.log(`   - P1 (阻塞级): ${p1Count}`);
console.log(`   - P2 (体验摩擦): ${p2Count}`);
console.log(`   - P3 (优化建议): ${p3Count}`);
