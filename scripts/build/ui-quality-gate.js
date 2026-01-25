/**
 * UI质量门禁系统
 * GEMINI-ARCHITECT v9
 * 自动审查UI设计质量，未达标则阻止提交
 */

const fs = require('fs')
const path = require('path')

// 质量标准配置
const QUALITY_STANDARDS = {
    // 间距系统：必须是8的倍数
    spacing: {
        pattern: /(margin|padding):\s*(\d+)px/g,
        validator: (value) => parseInt(value) % 8 === 0,
        message: 'P1: 间距必须是8的倍数（8px网格系统）'
    },

    // 动画性能：禁止触发重排的属性
    animation: {
        pattern: /transition:\s*(top|left|width|height|margin|padding)/g,
        validator: () => false,
        message: 'P0: 动画触发重排，必须改用transform/opacity'
    },

    // 颜色对比度：检测硬编码颜色
    contrast: {
        pattern: /color:\s*#([0-9a-fA-F]{3,6})(?!.*var\()/g,
        validator: () => false,
        message: 'P1: 硬编码颜色，应使用CSS变量'
    },

    // 字体大小：小于12px的字体
    fontSize: {
        pattern: /font-size:\s*(\d+)px/g,
        validator: (value) => parseInt(value) >= 12,
        message: 'P2: 字体小于12px，影响可读性'
    },

    // !important使用
    important: {
        pattern: /!important/g,
        validator: () => false,
        message: 'P1: 使用!important，破坏样式优先级'
    }
}

/**
 * 审查单个文件
 */
function auditFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const issues = []

    // 执行所有质量检查
    for (const [name, standard] of Object.entries(QUALITY_STANDARDS)) {
        const matches = content.matchAll(standard.pattern)

        for (const match of matches) {
            const value = match[1] || match[2]
            if (!standard.validator(value)) {
                issues.push({
                    type: name,
                    message: standard.message,
                    line: getLineNumber(content, match.index),
                    code: match[0]
                })
            }
        }
    }

    return issues
}

/**
 * 获取行号
 */
function getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length
}

/**
 * 审查阶段
 */
function auditPhase(phase, targetFile) {
    console.log(`\n🔍 Phase ${phase} UI质量审查...`)
    console.log(`目标文件: ${targetFile}`)

    const filePath = path.join(process.cwd(), targetFile)

    if (!fs.existsSync(filePath)) {
        console.error(`❌ 文件不存在: ${filePath}`)
        process.exit(1)
    }

    const issues = auditFile(filePath)

    // 统计问题
    const p0Issues = issues.filter(i => i.message.startsWith('P0'))
    const p1Issues = issues.filter(i => i.message.startsWith('P1'))
    const p2Issues = issues.filter(i => i.message.startsWith('P2'))

    console.log(`\n📊 审查结果:`)
    console.log(`  - P0问题 (严重): ${p0Issues.length}`)
    console.log(`  - P1问题 (重要): ${p1Issues.length}`)
    console.log(`  - P2问题 (建议): ${p2Issues.length}`)

    // 输出详细问题
    if (issues.length > 0) {
        console.log(`\n⚠️  发现 ${issues.length} 个问题:\n`)
        issues.forEach((issue, index) => {
            console.log(`${index + 1}. [行${issue.line}] ${issue.message}`)
            console.log(`   代码: ${issue.code}`)
        })
    }

    // 保存审查日志
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
    }

    const logFile = path.join(logDir, `ui-audit-phase${phase}.json`)
    fs.writeFileSync(logFile, JSON.stringify({
        phase,
        targetFile,
        timestamp: new Date().toISOString(),
        issues,
        summary: {
            total: issues.length,
            p0: p0Issues.length,
            p1: p1Issues.length,
            p2: p2Issues.length
        }
    }, null, 2))

    console.log(`\n📝 审查日志已保存: ${logFile}`)

    // P0问题阻止提交
    if (p0Issues.length > 0) {
        console.error(`\n❌ Phase ${phase} UI质量未达标！`)
        console.error(`发现 ${p0Issues.length} 个P0严重问题，必须修复后才能继续。`)
        process.exit(1)
    }

    // P1问题警告但不阻止
    if (p1Issues.length > 0) {
        console.warn(`\n⚠️  发现 ${p1Issues.length} 个P1问题，建议修复。`)
    }

    console.log(`\n✅ Phase ${phase} UI质量审查通过！`)
    process.exit(0)
}

// 命令行参数解析
const args = process.argv.slice(2)
const phaseArg = args.find(arg => arg.startsWith('--phase='))
const targetArg = args.find(arg => arg.startsWith('--target='))

if (!phaseArg || !targetArg) {
    console.error('用法: node ui-quality-gate.js --phase=1 --target=App.vue')
    process.exit(1)
}

const phase = phaseArg.split('=')[1]
const target = targetArg.split('=')[1]

auditPhase(phase, target)
