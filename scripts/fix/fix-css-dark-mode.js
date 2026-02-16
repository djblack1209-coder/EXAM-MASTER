#!/usr/bin/env node

/**
 * 批量修复CSS深色模式语法错误
 * 问题：`.container.{` 缺少类名
 * 修复：`.container.` → `.container.dark-mode`
 */

const fs = require('fs');
const path = require('path');

// 需要扫描的目录
const SCAN_DIRS = [
    'src/pages',
    'src/components'
];

// 统计信息
let stats = {
    scanned: 0,
    fixed: 0,
    errors: []
};

/**
 * 递归扫描目录
 */
function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            scanDirectory(filePath);
        } else if (file.endsWith('.vue')) {
            stats.scanned++;
            fixVueFile(filePath);
        }
    });
}

/**
 * 修复Vue文件
 */
function fixVueFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf-8');
        let modified = false;

        // 修复1: Template中的类名绑定
        if (content.includes("{ ' ': isDark }")) {
            content = content.replace(/\{ ' ': isDark \}/g, "{ 'dark-mode': isDark }");
            modified = true;
            console.log(`✅ [Template] ${filePath}`);
        }

        // 修复2: CSS选择器 `.任意类名.{` 或 `.任意类名. {` (通用匹配)
        const classNameDotPattern = /\.([\w-]+)\.\s*\{/g;
        if (classNameDotPattern.test(content)) {
            content = content.replace(/\.([\w-]+)\.\s*\{/g, '.$1.dark-mode {');
            modified = true;
            console.log(`✅ [CSS] ${filePath} - .classname.{/.classname. {`);
        }

        // 修复3: CSS选择器 `.任意类名. .xxx` (通用嵌套选择器)
        const classNameSpacePattern = /\.([\w-]+)\. \./g;
        if (classNameSpacePattern.test(content)) {
            content = content.replace(/\.([\w-]+)\. \./g, '.$1.dark-mode .');
            modified = true;
            console.log(`✅ [CSS] ${filePath} - .classname. .xxx`);
        }

        // 修复4: SCSS嵌套选择器 `&.{` 或 `&. {`
        if (content.includes('&.{') || content.includes('&. {')) {
            content = content.replace(/&\.\{/g, '&.dark-mode {');
            content = content.replace(/&\. \{/g, '&.dark-mode {');
            modified = true;
            console.log(`✅ [SCSS] ${filePath} - &.{/&. {`);
        }

        // 修复5: CSS选择器 `. .xxx` (换行+点+空格+点)
        const darkModePattern = /\n\. \./g;
        if (darkModePattern.test(content)) {
            content = content.replace(/\n\. \./g, '\n.dark-mode .');
            modified = true;
            console.log(`✅ [CSS] ${filePath} - . .xxx (newline)`);
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf-8');
            stats.fixed++;
        }
    } catch (err) {
        stats.errors.push({ file: filePath, error: err.message });
        console.error(`❌ [Error] ${filePath}: ${err.message}`);
    }
}

/**
 * 主函数
 */
function main() {
    console.log('🔍 开始扫描并修复CSS深色模式语法错误...\n');

    SCAN_DIRS.forEach(dir => {
        const fullPath = path.join(process.cwd(), dir);
        if (fs.existsSync(fullPath)) {
            console.log(`📂 扫描目录: ${dir}`);
            scanDirectory(fullPath);
        } else {
            console.warn(`⚠️  目录不存在: ${dir}`);
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 修复统计:');
    console.log(`   扫描文件: ${stats.scanned} 个`);
    console.log(`   修复文件: ${stats.fixed} 个`);
    console.log(`   错误数量: ${stats.errors.length} 个`);

    if (stats.errors.length > 0) {
        console.log('\n❌ 错误列表:');
        stats.errors.forEach(({ file, error }) => {
            console.log(`   ${file}: ${error}`);
        });
    }

    console.log('='.repeat(60));

    if (stats.fixed > 0) {
        console.log('\n✅ 修复完成！请重新编译项目验证。');
    } else {
        console.log('\n✨ 未发现需要修复的文件。');
    }
}

// 执行
main();
