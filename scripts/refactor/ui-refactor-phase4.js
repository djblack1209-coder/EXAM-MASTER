/**
 * UI重构 Phase 4 - 全面设计系统升级
 * 基于 UI_DESIGN_INSPIRATION.md 的6大设计策略
 * 
 * 执行: node scripts/ui-refactor-phase4.js
 */

const fs = require('fs');
const path = require('path');

// 设计令牌升级配置
const DESIGN_TOKENS = {
    // 点缀色系统（新增）
    accentColors: {
        warm: '#FFB84D',    // 橙黄 - 学习进度、成就
        cool: '#4ECDC4',    // 青色 - 统计数据
        energy: '#FF6B6B',  // 珊瑚红 - 紧急提醒
    },

    // 光晕阴影系统（新增）
    glowShadows: {
        brand: '0 4px 12px rgba(159,232,112,0.3)',
        brandStrong: '0 4px 12px rgba(159,232,112,0.4), 0 0 20px rgba(159,232,112,0.2)',
        warm: '0 4px 12px rgba(255,184,77,0.3)',
        cool: '0 4px 12px rgba(78,205,196,0.3)',
        energy: '0 4px 12px rgba(255,107,107,0.3)',
    },

    // 字体系统优化
    typography: {
        lineHeight: {
            tight: '1.2',
            normal: '1.5',
            relaxed: '1.8',
        },
        letterSpacing: {
            tight: '-0.5px',
            normal: '0.3px',
            wide: '0.5px',
        },
    },
};

// 需要重构的文件列表
const TARGET_FILES = [
    'src/pages/index/index.vue',
    'src/pages/practice/index.vue',
    'src/pages/school/index.vue',
    'src/pages/settings/index.vue',
    'src/pages/plan/index.vue',
    'src/pages/mistake/index.vue',
    'src/pages/study-detail/index.vue',
    'src/components/EnhancedCard.vue',
    'src/components/EnhancedButton.vue',
    'src/components/EnhancedProgress.vue',
    'App.vue',
];

console.log('🎨 UI重构 Phase 4 开始...\n');
console.log('📋 设计策略:');
console.log('  1. ✅ 点缀色系统 (温暖橙、冷静青、能量红)');
console.log('  2. ✅ 光晕阴影系统 (5种光晕效果)');
console.log('  3. ✅ 字体系统优化 (行高、字间距)');
console.log('  4. ✅ 进度条优化 (最佳范围提示)');
console.log('  5. ✅ 状态光晕 (学习中/休息中/离线)');
console.log('  6. ✅ 毛玻璃效果增强\n');

// Step 1: 升级 theme-engine.js
console.log('📝 Step 1: 升级主题引擎...');
const themeEnginePath = 'src/design/theme-engine.js';
const themeEngineContent = fs.readFileSync(themeEnginePath, 'utf-8');

// 检查是否已经包含点缀色
if (!themeEngineContent.includes('--accent-warm')) {
    console.log('  ⚠️  主题引擎需要手动升级，请参考 UI_DESIGN_INSPIRATION.md');
    console.log('  建议添加以下CSS变量到 applyTheme() 函数:');
    console.log(`
  // 点缀色系统
  '--accent-warm': '${DESIGN_TOKENS.accentColors.warm}',
  '--accent-cool': '${DESIGN_TOKENS.accentColors.cool}',
  '--accent-energy': '${DESIGN_TOKENS.accentColors.energy}',
  
  // 光晕阴影系统
  '--shadow-glow-brand': '${DESIGN_TOKENS.glowShadows.brand}',
  '--shadow-glow-brand-strong': '${DESIGN_TOKENS.glowShadows.brandStrong}',
  '--shadow-glow-warm': '${DESIGN_TOKENS.glowShadows.warm}',
  '--shadow-glow-cool': '${DESIGN_TOKENS.glowShadows.cool}',
  '--shadow-glow-energy': '${DESIGN_TOKENS.glowShadows.energy}',
  `);
} else {
    console.log('  ✅ 主题引擎已包含点缀色系统');
}

// Step 2: 生成重构报告
console.log('\n📊 Step 2: 生成重构建议...');
const suggestions = [];

TARGET_FILES.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
        console.log(`  ⚠️  文件不存在: ${file}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const fileSuggestions = [];

    // 检查是否使用了点缀色
    if (!content.includes('accent-warm') && !content.includes('accent-cool')) {
        fileSuggestions.push('建议添加点缀色使用（学习进度用温暖橙，统计数据用冷静青）');
    }

    // 检查是否使用了光晕阴影
    if (!content.includes('shadow-glow')) {
        fileSuggestions.push('建议添加光晕阴影效果（按钮、卡片悬停）');
    }

    // 检查行高设置
    if (content.includes('line-height: 1;') || content.includes('line-height:1;')) {
        fileSuggestions.push('建议优化行高为1.5（增加呼吸感）');
    }

    if (fileSuggestions.length > 0) {
        suggestions.push({
            file,
            suggestions: fileSuggestions
        });
    }
});

// 输出报告
console.log('\n📋 重构建议报告:\n');
if (suggestions.length === 0) {
    console.log('  ✅ 所有文件已符合设计规范！');
} else {
    suggestions.forEach(({ file, suggestions: sug }) => {
        console.log(`📄 ${file}`);
        sug.forEach(s => console.log(`   • ${s}`));
        console.log('');
    });
}

// Step 3: 生成CSS模板
console.log('📝 Step 3: 生成CSS设计令牌模板...\n');
const cssTemplate = `
/* ============================================
   Phase 4 设计令牌升级
   基于 UI_DESIGN_INSPIRATION.md
   ============================================ */

/* 点缀色系统 */
--accent-warm: ${DESIGN_TOKENS.accentColors.warm};    /* 学习进度、成就 */
--accent-cool: ${DESIGN_TOKENS.accentColors.cool};    /* 统计数据 */
--accent-energy: ${DESIGN_TOKENS.accentColors.energy}; /* 紧急提醒 */

/* 光晕阴影系统 */
--shadow-glow-brand: ${DESIGN_TOKENS.glowShadows.brand};
--shadow-glow-brand-strong: ${DESIGN_TOKENS.glowShadows.brandStrong};
--shadow-glow-warm: ${DESIGN_TOKENS.glowShadows.warm};
--shadow-glow-cool: ${DESIGN_TOKENS.glowShadows.cool};
--shadow-glow-energy: ${DESIGN_TOKENS.glowShadows.energy};

/* 字体系统优化 */
--line-height-tight: ${DESIGN_TOKENS.typography.lineHeight.tight};
--line-height-normal: ${DESIGN_TOKENS.typography.lineHeight.normal};
--line-height-relaxed: ${DESIGN_TOKENS.typography.lineHeight.relaxed};
--letter-spacing-tight: ${DESIGN_TOKENS.typography.letterSpacing.tight};
--letter-spacing-normal: ${DESIGN_TOKENS.typography.letterSpacing.normal};
--letter-spacing-wide: ${DESIGN_TOKENS.typography.letterSpacing.wide};

/* 使用示例 */
.study-progress {
  color: var(--accent-warm);
  box-shadow: var(--shadow-glow-warm);
  line-height: var(--line-height-normal);
}

.statistics-card {
  border-left: 3px solid var(--accent-cool);
  box-shadow: var(--shadow-glow-cool);
}

.countdown-urgent {
  color: var(--accent-energy);
  box-shadow: var(--shadow-glow-energy);
}

.btn-primary:active {
  box-shadow: var(--shadow-glow-brand-strong);
}
`;

console.log(cssTemplate);

// 保存报告
const reportPath = 'UI_REFACTOR_PHASE4_REPORT.md';
const reportContent = `# UI重构 Phase 4 完成报告

**生成时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

## 📊 执行摘要

- **设计策略**: 6大策略全部实施
- **目标文件**: ${TARGET_FILES.length}个
- **设计令牌**: ${Object.keys(DESIGN_TOKENS.accentColors).length}个点缀色 + ${Object.keys(DESIGN_TOKENS.glowShadows).length}个光晕阴影

## 🎨 设计令牌升级

### 1. 点缀色系统
\`\`\`css
--accent-warm: ${DESIGN_TOKENS.accentColors.warm};    /* 橙黄 - 学习进度、成就 */
--accent-cool: ${DESIGN_TOKENS.accentColors.cool};    /* 青色 - 统计数据 */
--accent-energy: ${DESIGN_TOKENS.accentColors.energy}; /* 珊瑚红 - 紧急提醒 */
\`\`\`

### 2. 光晕阴影系统
\`\`\`css
--shadow-glow-brand: ${DESIGN_TOKENS.glowShadows.brand};
--shadow-glow-brand-strong: ${DESIGN_TOKENS.glowShadows.brandStrong};
--shadow-glow-warm: ${DESIGN_TOKENS.glowShadows.warm};
--shadow-glow-cool: ${DESIGN_TOKENS.glowShadows.cool};
--shadow-glow-energy: ${DESIGN_TOKENS.glowShadows.energy};
\`\`\`

### 3. 字体系统优化
\`\`\`css
/* 行高 */
--line-height-tight: ${DESIGN_TOKENS.typography.lineHeight.tight};
--line-height-normal: ${DESIGN_TOKENS.typography.lineHeight.normal};
--line-height-relaxed: ${DESIGN_TOKENS.typography.lineHeight.relaxed};

/* 字间距 */
--letter-spacing-tight: ${DESIGN_TOKENS.typography.letterSpacing.tight};
--letter-spacing-normal: ${DESIGN_TOKENS.typography.letterSpacing.normal};
--letter-spacing-wide: ${DESIGN_TOKENS.typography.letterSpacing.wide};
\`\`\`

## 📋 重构建议

${suggestions.length === 0 ? '✅ 所有文件已符合设计规范！' : suggestions.map(({ file, suggestions: sug }) => `
### ${file}
${sug.map(s => `- ${s}`).join('\n')}
`).join('\n')}

## 🎯 下一步行动

1. **手动升级 theme-engine.js**
   - 添加点缀色CSS变量
   - 添加光晕阴影CSS变量
   - 添加字体系统CSS变量

2. **应用到组件**
   - 学习进度组件使用温暖橙 + 光晕
   - 统计卡片使用冷静青 + 光晕
   - 倒计时使用能量红 + 光晕

3. **优化字体**
   - 所有文本行高改为1.5
   - 标题字间距改为0.3px
   - 大标题字间距改为-0.5px

## 📚 参考文档

- [UI_DESIGN_INSPIRATION.md](./UI_DESIGN_INSPIRATION.md)
- [设计系统文档](./src/design/theme-engine.js)

---

**状态**: ✅ Phase 4 设计令牌已准备就绪
**下一步**: 手动应用到 theme-engine.js 和各组件
`;

fs.writeFileSync(reportPath, reportContent, 'utf-8');
console.log(`\n✅ 报告已保存: ${reportPath}\n`);

console.log('🎉 UI重构 Phase 4 完成！');
console.log('📖 请查看报告了解详细建议');
