#!/usr/bin/env node

/**
 * PARSE-UX-REPORT - UX审计报告解析器
 * 将Markdown格式的UX审计报告转换为结构化的JSON任务清单
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// 命令行参数
const args = process.argv.slice(2);
const inputPath = args.find(arg => arg.startsWith('--input='))?.split('=')[1];
const outputPath = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || '/tmp/tasks.json';

if (!inputPath) {
    console.error('❌ 错误: 请指定输入文件路径 --input=<path>');
    process.exit(1);
}

if (!fs.existsSync(inputPath)) {
    console.error(`❌ 错误: 文件不存在 ${inputPath}`);
    process.exit(1);
}

console.log('📖 读取UX审计报告...');
const reportContent = fs.readFileSync(inputPath, 'utf-8');

console.log('🔍 解析报告内容...');

// 解析任务的正则表达式
const taskPattern = /###\s+(\d+)\.\s+\[([^\]]+)\]\s+([^\n]+)\n([\s\S]*?)(?=###\s+\d+\.|$)/g;

const tasks = [];
let match;

while ((match = taskPattern.exec(reportContent)) !== null) {
    const [, index, priority, title, content] = match;

    // 提取详细信息
    const moduleMatch = content.match(/\*\*模块\*\*:\s*`([^`]+)`/);
    const descMatch = content.match(/\*\*问题描述\*\*:\s*([^\n]+)/);
    const impactMatch = content.match(/\*\*影响\*\*:\s*([^\n]+)/);
    const solutionMatch = content.match(/\*\*解决方案\*\*:\s*([^\n]+)/);
    const clineMatch = content.match(/\*\*Cline指令\*\*:\s*`([^`]+)`/);
    const acceptanceMatch = content.match(/\*\*验收标准\*\*:\s*([^\n]+)/);
    const dimensionMatch = content.match(/\*\*维度\*\*:\s*([^\n]+)/);

    // 解析优先级
    let priorityNum = 3;
    if (priority.includes('P0') || priority.includes('阻塞')) {
        priorityNum = 1;
    } else if (priority.includes('P1') || priority.includes('摩擦')) {
        priorityNum = 2;
    }

    tasks.push({
        id: parseInt(index),
        priority: priorityNum,
        priorityLabel: priority,
        title: title.trim(),
        module: moduleMatch ? moduleMatch[1] : '',
        description: descMatch ? descMatch[1].trim() : '',
        impact: impactMatch ? impactMatch[1].trim() : '',
        solution: solutionMatch ? solutionMatch[1].trim() : '',
        clineCommand: clineMatch ? clineMatch[1].trim() : '',
        acceptanceCriteria: acceptanceMatch ? acceptanceMatch[1].trim() : '',
        dimension: dimensionMatch ? dimensionMatch[1].trim() : ''
    });
}

// 按优先级排序
tasks.sort((a, b) => a.priority - b.priority);

const output = {
    generatedAt: new Date().toISOString(),
    sourceReport: inputPath,
    totalTasks: tasks.length,
    tasksByPriority: {
        p1: tasks.filter(t => t.priority === 1).length,
        p2: tasks.filter(t => t.priority === 2).length,
        p3: tasks.filter(t => t.priority === 3).length
    },
    tasks
};

console.log('💾 保存任务清单...');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log('✅ 解析完成！');
console.log(`📊 统计:`);
console.log(`   - 总任务数: ${output.totalTasks}`);
console.log(`   - P1 (阻塞级): ${output.tasksByPriority.p1}`);
console.log(`   - P2 (体验摩擦): ${output.tasksByPriority.p2}`);
console.log(`   - P3 (优化建议): ${output.tasksByPriority.p3}`);
console.log(`📁 输出文件: ${outputPath}`);
