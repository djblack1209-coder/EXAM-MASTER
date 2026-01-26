/**
 * 配置健康检查工具
 * ✅ P0-2 新增：在应用启动时验证关键配置是否存在
 * 
 * 功能：
 * 1. 检查关键环境变量是否配置
 * 2. 在控制台输出友好的配置状态
 * 3. 提供配置缺失时的解决方案提示
 * 
 * 使用方式：
 * import { printConfigStatus } from '@/utils/config-validator'
 * printConfigStatus() // 在 App.vue onLaunch 中调用
 */

/**
 * 需要检查的配置项列表
 */
const REQUIRED_CONFIGS = [
  { 
    key: 'VITE_WX_APP_ID', 
    name: '微信AppID', 
    severity: 'warning',
    description: '用于微信小程序身份识别'
  },
  { 
    key: 'VITE_API_BASE_URL', 
    name: 'API服务地址', 
    severity: 'warning',
    description: '后端服务接口地址'
  }
]

/**
 * 安全获取环境变量
 * @param {string} key - 环境变量键名
 * @returns {string|null} 环境变量值或null
 */
function getEnvValue(key) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const value = import.meta.env[key]
      if (value !== undefined && value !== '') {
        return value
      }
    }
  } catch (e) {
    // 忽略错误
  }
  return null
}

/**
 * 验证配置完整性
 * @returns {{ valid: boolean, issues: Array, summary: string }}
 */
export function validateConfig() {
  const issues = []
  
  REQUIRED_CONFIGS.forEach(({ key, name, severity, description }) => {
    const value = getEnvValue(key)
    if (!value) {
      issues.push({
        key,
        name,
        severity,
        description,
        message: `未配置 ${name}，使用默认值`
      })
    }
  })
  
  const hasErrors = issues.filter(i => i.severity === 'error').length > 0
  const valid = !hasErrors
  
  let summary
  if (issues.length === 0) {
    summary = '✅ 所有配置已从环境变量加载'
  } else if (hasErrors) {
    summary = `❌ ${issues.filter(i => i.severity === 'error').length} 项必需配置缺失`
  } else {
    summary = `⚠️ ${issues.length} 项配置使用默认值`
  }
  
  return { valid, issues, summary }
}

/**
 * 在控制台输出配置状态（开发者友好）
 * @returns {{ valid: boolean, issues: Array }}
 */
export function printConfigStatus() {
  const { valid, issues, summary } = validateConfig()
  
  // 仅在开发环境或有问题时输出
  const isDev = getEnvValue('DEV') === 'true' || getEnvValue('MODE') === 'development'
  
  if (isDev || issues.length > 0) {
    console.log('\n' + '═'.repeat(55))
    console.log('📋 Exam-Master 配置健康检查')
    console.log('═'.repeat(55))
    console.log(summary)
    
    if (issues.length > 0) {
      console.log('\n📝 配置建议：')
      issues.forEach(({ key, name, description }, index) => {
        console.log(`\n  ${index + 1}. ${name}`)
        console.log(`     用途: ${description}`)
        console.log(`     设置: 在 .env.local 中添加 ${key}=your_value`)
      })
      
      console.log('\n💡 快速配置步骤：')
      console.log('   1. cp .env.example .env.local')
      console.log('   2. 编辑 .env.local 填写配置值')
      console.log('   3. 重启开发服务器')
    }
    
    console.log('═'.repeat(55) + '\n')
  }
  
  return { valid, issues }
}

/**
 * 获取配置状态摘要（用于埋点上报）
 * @returns {Object} 配置状态对象
 */
export function getConfigStatusForAnalytics() {
  const { valid, issues } = validateConfig()
  
  return {
    config_valid: valid,
    config_missing_count: issues.length,
    config_missing_keys: issues.map(i => i.key).join(','),
    config_env: getEnvValue('MODE') || 'unknown',
    config_timestamp: Date.now()
  }
}

export default {
  validateConfig,
  printConfigStatus,
  getConfigStatusForAnalytics
}
