/**
 * 批量组件重构引擎
 * GEMINI-ARCHITECT v9
 * 自动将旧版组件迁移到新设计系统
 */

const fs = require('fs')
const path = require('path')

/**
 * 重构规则配置
 */
const REFACTOR_RULES = {
    // 样式类名映射
    classMapping: {
        'glass-card': 'glass-card', // 保持不变，已使用设计令牌
        'dark-mode': '', // 移除，由主题引擎自动处理
        'aurora-bg': 'aurora-bg' // 保持不变
    },

    // CSS变量映射（旧 -> 新）
    cssVarMapping: {
        '--bg-main': '--bg-body',
        '--text-main': '--text-primary',
        '--text-title': '--text-primary',
        '--text-body': '--text-secondary',
        '--text-light': '--text-tertiary',
        '--accent-green': '--brand-color',
        '--accent-green-light': '--brand-hover',
        '--accent-blue': '--action-blue',
        '--input-bg': '--bg-hover',
        '--input-border': '--border-light',
        '--tab-bg': '--bg-card',
        '--border-card': '--border-light'
    },

    // 需要移除的内联样式模式
    removeInlineStyles: [
        /style="[^"]*background:\s*#[0-9a-fA-F]{3,6}[^"]*"/g,
        /style="[^"]*color:\s*#[0-9a-fA-F]{3,6}[^"]*"/g
    ],

    // 需要替换的硬编码颜色
    hardcodedColors: {
        '#9FE870': 'var(--brand-color)',
        '#163300': 'var(--bg-body)',
        '#FFFFFF': 'var(--bg-card)',
        '#F8FAFC': 'var(--bg-body)',
        '#000000': 'var(--text-primary)'
    }
}

/**
 * 重构单个组件
 */
function refactorComponent(filePath) {
    let content = fs.readFileSync(filePath, 'utf8')
    let changes = []

    // 1. 替换CSS变量
    for (const [oldVar, newVar] of Object.entries(REFACTOR_RULES.cssVarMapping)) {
        const regex = new RegExp(oldVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        const matches = content.match(regex)
        if (matches) {
            content = content.replace(regex, newVar)
            changes.push(`替换CSS变量: ${oldVar} -> ${newVar} (${matches.length}处)`)
        }
    }

    // 2. 替换硬编码颜色
    for (const [oldColor, newVar] of Object.entries(REFACTOR_RULES.hardcodedColors)) {
        const regex = new RegExp(oldColor, 'gi')
        const matches = content.match(regex)
        if (matches) {
            content = content.replace(regex, newVar)
            changes.push(`替换硬编码颜色: ${oldColor} -> ${newVar} (${matches.length}处)`)
        }
    }

    // 3. 移除内联样式中的硬编码颜色
    for (const pattern of REFACTOR_RULES.removeInlineStyles) {
        const matches = content.match(pattern)
        if (matches) {
            content = content.replace(pattern, '')
            changes.push(`移除内联样式 (${matches.length}处)`)
        }
    }

    // 4. 移除 .dark-mode 类名（由主题引擎自动处理）
    const darkModePattern = /class="[^"]*dark-mode[^"]*"/g
    const darkModeMatches = content.match(darkModePattern)
    if (darkModeMatches) {
        content = content.replace(/\s*dark-mode\s*/g, ' ')
        changes.push(`移除dark-mode类名 (${darkModeMatches.length}处)`)
    }

    return { content, changes }
}

/**
 * 批量重构目录
 */
function batchRefactor(targetDir, dryRun = false) {
    console.log(`\n🔧 开始批量重构: ${targetDir}`)
    console.log(`模式: ${dryRun ? '预览模式（不写入文件）' : '执行模式'}`)

    const vueFiles = []

    // 递归查找所有.vue文件
    function findVueFiles(dir) {
        const files = fs.readdirSync(dir)
        for (const file of files) {
            const fullPath = path.join(dir, file)
            const stat = fs.statSync(fullPath)

            if (stat.isDirectory()) {
                findVueFiles(fullPath)
            } else if (file.endsWith('.vue')) {
                vueFiles.push(fullPath)
            }
        }
    }

    findVueFiles(targetDir)

    console.log(`\n📁 发现 ${vueFiles.length} 个Vue组件`)

    const results = []
    let totalChanges = 0

    // 重构每个文件
    for (const filePath of vueFiles) {
        const relativePath = path.relative(process.cwd(), filePath)
        const { content, changes } = refactorComponent(filePath)

        if (changes.length > 0) {
            results.push({
                file: relativePath,
                changes
            })
            totalChanges += changes.length

            // 写入文件（非预览模式）
            if (!dryRun) {
                fs.writeFileSync(filePath, content, 'utf8')
            }
        }
    }

    // 输出结果
    console.log(`\n📊 重构结果:`)
    console.log(`  - 处理文件: ${vueFiles.length}`)
    console.log(`  - 修改文件: ${results.length}`)
    console.log(`  - 总变更数: ${totalChanges}`)

    if (results.length > 0) {
        console.log(`\n📝 详细变更:`)
        results.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.file}`)
            result.changes.forEach(change => {
                console.log(`   - ${change}`)
            })
        })
    }

    // 保存重构日志
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
    }

    const logFile = path.join(logDir, `refactor-phase2-${Date.now()}.json`)
    fs.writeFileSync(logFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        targetDir,
        dryRun,
        totalFiles: vueFiles.length,
        modifiedFiles: results.length,
        totalChanges,
        results
    }, null, 2))

    console.log(`\n📝 重构日志已保存: ${logFile}`)

    if (dryRun) {
        console.log(`\n💡 这是预览模式，未实际修改文件`)
        console.log(`   移除 --dry-run 参数以执行实际重构`)
    } else {
        console.log(`\n✅ 批量重构完成！`)
    }
}

// 命令行参数解析
const args = process.argv.slice(2)
const targetArg = args.find(arg => arg.startsWith('--target='))
const dryRun = args.includes('--dry-run')

if (!targetArg) {
    console.error('用法: node batch-refactor-components.js --target=src/components [--dry-run]')
    process.exit(1)
}

const target = targetArg.split('=')[1]
const targetPath = path.join(process.cwd(), target)

if (!fs.existsSync(targetPath)) {
    console.error(`❌ 目标目录不存在: ${targetPath}`)
    process.exit(1)
}

batchRefactor(targetPath, dryRun)
