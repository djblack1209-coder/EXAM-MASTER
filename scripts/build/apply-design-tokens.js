/**
 * 批量应用设计令牌到各页面
 * 基于 UI_REFACTOR_PHASE4_REPORT.md
 * 
 * 执行: node scripts/apply-design-tokens.js
 */

const fs = require('fs');
const path = require('path');

console.log('🎨 开始应用设计令牌...\n');

// CSS替换规则
const CSS_REPLACEMENTS = [
    // 1. 学习进度相关 → 温暖橙
    {
        pattern: /color:\s*#2ECC71;/g,
        replacement: 'color: var(--accent-warm);',
        context: 'study-progress',
        description: '学习进度文字 → 温暖橙'
    },

    // 2. 统计数据相关 → 冷静青
    {
        pattern: /border-left:\s*3px\s+solid\s+#2ECC71;/g,
        replacement: 'border-left: 3px solid var(--accent-cool);',
        context: 'statistics',
        description: '统计卡片边框 → 冷静青'
    },

    // 3. 行高优化 → 1.5
    {
        pattern: /line-height:\s*1;/g,
        replacement: 'line-height: var(--line-height-normal);',
        context: 'text',
        description: '文本行高 → 1.5（增加呼吸感）'
    },

    // 4. 按钮悬停 → 光晕阴影
    {
        pattern: /box-shadow:\s*0\s+4px\s+16px\s+rgba\(0,\s*0,\s*0,\s*0\.12\);/g,
        replacement: 'box-shadow: var(--shadow-glow-brand);',
        context: 'button-hover',
        description: '按钮悬停 → 品牌色光晕'
    },
];

// 目标文件
const TARGET_FILES = [
    'src/pages/index/index.vue',
    'src/pages/practice/index.vue',
    'src/pages/school/index.vue',
    'src/pages/settings/index.vue',
    'src/pages/plan/index.vue',
    'src/pages/mistake/index.vue',
    'src/pages/study-detail/index.vue',
];

let totalReplacements = 0;

TARGET_FILES.forEach(file => {
    const filePath = path.join(process.cwd(), file);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  文件不存在: ${file}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    let fileReplacements = 0;

    console.log(`📄 处理文件: ${file}`);

    CSS_REPLACEMENTS.forEach(({ pattern, replacement, description }) => {
        const matches = content.match(pattern);
        if (matches) {
            content = content.replace(pattern, replacement);
            fileReplacements += matches.length;
            console.log(`   ✅ ${description} (${matches.length}处)`);
        }
    });

    if (fileReplacements > 0) {
        fs.writeFileSync(filePath, content, 'utf-8');
        totalReplacements += fileReplacements;
        console.log(`   📝 已保存 ${fileReplacements} 处修改\n`);
    } else {
        console.log(`   ℹ️  无需修改\n`);
    }
});

console.log(`\n🎉 完成！共应用 ${totalReplacements} 处设计令牌`);
console.log('📖 请查看修改后的文件确认效果');
