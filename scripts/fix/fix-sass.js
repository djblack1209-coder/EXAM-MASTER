#!/usr/bin/env node

/**
 * Sass 警告自动修复脚本
 * 
 * 功能：
 * 1. 遍历 src 目录下所有 .scss 和 .vue 文件
 * 2. 将 darken($color, $amount) 替换为 color.scale($color, $lightness: -$amount)
 * 3. 将 lighten($color, $amount) 替换为 color.scale($color, $lightness: $amount)
 * 4. 自动在文件头部添加 @use "sass:color"; (如果发生了替换且缺少引用)
 */

const fs = require('fs')
const path = require('path')

// 统计信息
const stats = {
    totalFiles: 0,
    modifiedFiles: 0,
    darkenCount: 0,
    lightenCount: 0
}

/**
 * 递归遍历目录
 */
function walkDir(dir, callback) {
    const files = fs.readdirSync(dir)

    files.forEach(file => {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)

        if (stat.isDirectory()) {
            // 跳过 node_modules 等目录
            if (!['node_modules', '.git', 'dist', 'unpackage'].includes(file)) {
                walkDir(filePath, callback)
            }
        } else if (stat.isFile()) {
            callback(filePath)
        }
    })
}

/**
 * 检查文件是否需要处理
 */
function shouldProcess(filePath) {
    return filePath.endsWith('.scss') || filePath.endsWith('.vue')
}

/**
 * 检查文件是否已经引入了 sass:color
 */
function hasColorImport(content) {
    return /@use\s+['"]sass:color['"]/.test(content)
}

/**
 * 在文件开头添加 @use "sass:color"
 */
function addColorImport(content) {
    // 如果文件以 @use 或 @import 开头，在第一行之后添加
    const lines = content.split('\n')
    let insertIndex = 0

    // 查找第一个非空行和非注释行
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line && !line.startsWith('//') && !line.startsWith('/*')) {
            // 如果是 @use 或 @import，在其后插入
            if (line.startsWith('@use') || line.startsWith('@import')) {
                insertIndex = i + 1
            }
            break
        }
    }

    lines.splice(insertIndex, 0, '@use "sass:color";')
    return lines.join('\n')
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
    stats.totalFiles++

    let content = fs.readFileSync(filePath, 'utf-8')
    let modified = false
    let needsColorImport = false

    // 替换 darken() 函数
    const darkenRegex = /darken\(\s*(\$[\w-]+)\s*,\s*(\d+%?)\s*\)/g
    if (darkenRegex.test(content)) {
        content = content.replace(darkenRegex, (match, color, amount) => {
            stats.darkenCount++
            modified = true
            needsColorImport = true
            // 确保 amount 有百分号
            const amountValue = amount.includes('%') ? amount : `${amount}%`
            return `color.scale(${color}, $lightness: -${amountValue})`
        })
    }

    // 替换 lighten() 函数
    const lightenRegex = /lighten\(\s*(\$[\w-]+)\s*,\s*(\d+%?)\s*\)/g
    if (lightenRegex.test(content)) {
        content = content.replace(lightenRegex, (match, color, amount) => {
            stats.lightenCount++
            modified = true
            needsColorImport = true
            // 确保 amount 有百分号
            const amountValue = amount.includes('%') ? amount : `${amount}%`
            return `color.scale(${color}, $lightness: ${amountValue})`
        })
    }

    // 如果进行了替换且文件中没有 @use "sass:color"，则添加
    if (modified && needsColorImport && !hasColorImport(content)) {
        // 对于 .vue 文件，需要在 <style> 标签内添加
        if (filePath.endsWith('.vue')) {
            content = content.replace(
                /(<style[^>]*lang=["']scss["'][^>]*>)/,
                '$1\n@use "sass:color";'
            )
        } else {
            // 对于 .scss 文件，在文件开头添加
            content = addColorImport(content)
        }
    }

    // 如果文件被修改，写回文件
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8')
        stats.modifiedFiles++
        console.log(`✅ 已修复: ${path.relative(process.cwd(), filePath)}`)
    }
}

/**
 * 主函数
 */
function main() {
    console.log('🔧 开始修复 Sass 警告...\n')

    const srcDir = path.join(process.cwd(), 'src')

    if (!fs.existsSync(srcDir)) {
        console.error('❌ 错误: src 目录不存在')
        process.exit(1)
    }

    // 遍历 src 目录
    walkDir(srcDir, (filePath) => {
        if (shouldProcess(filePath)) {
            processFile(filePath)
        }
    })

    // 输出统计信息
    console.log('\n📊 修复统计:')
    console.log(`   总文件数: ${stats.totalFiles}`)
    console.log(`   修改文件数: ${stats.modifiedFiles}`)
    console.log(`   darken() 替换: ${stats.darkenCount}`)
    console.log(`   lighten() 替换: ${stats.lightenCount}`)

    if (stats.modifiedFiles > 0) {
        console.log('\n✅ Sass 警告修复完成！')
    } else {
        console.log('\n✨ 没有发现需要修复的文件')
    }
}

// 执行主函数
main()
