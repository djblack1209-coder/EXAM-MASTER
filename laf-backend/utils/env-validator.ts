/**
 * 环境变量验证工具 (B005/S004)
 * 
 * 集中校验所有必需/可选环境变量，启动时一次性报告缺失项。
 * 生产环境缺少关键变量时阻止启动。
 * 
 * 用法：在入口云函数或 health-check 中调用 validateEnv()
 * 
 * @version 1.0.0
 */

// ==================== 环境变量定义 ====================

interface EnvVarDef {
  /** 环境变量名 */
  key: string
  /** 用途说明 */
  description: string
  /** 是否为生产环境必需 */
  requiredInProd: boolean
  /** 使用该变量的模块 */
  usedBy: string[]
}

const ENV_VARS: EnvVarDef[] = [
  // 认证相关 — 生产必需
  { key: 'JWT_SECRET', description: 'JWT签名密钥', requiredInProd: true, usedBy: ['login', 'proxy-ai', 'user-profile'] },
  { key: 'WX_APPID', description: '微信小程序AppID', requiredInProd: true, usedBy: ['login'] },
  { key: 'WX_SECRET', description: '微信小程序密钥', requiredInProd: true, usedBy: ['login'] },

  // 微信公众号 — 可选（H5登录才需要）
  { key: 'WX_GZH_APPID', description: '微信公众号AppID(H5)', requiredInProd: false, usedBy: ['login'] },
  { key: 'WX_GZH_SECRET', description: '微信公众号密钥(H5)', requiredInProd: false, usedBy: ['login'] },

  // AI 服务 — 生产必需
  { key: 'ZHIPU_API_KEY', description: '智谱AI API密钥', requiredInProd: true, usedBy: ['proxy-ai', 'ai-photo-search', 'voice-service'] },

  // 第三方服务 — 按功能可选
  { key: 'CLOUDCONVERT_API_KEY', description: '文档转换服务密钥', requiredInProd: false, usedBy: ['doc-convert'] },
  { key: 'TENCENT_SECRET_ID', description: '腾讯云SecretId', requiredInProd: false, usedBy: ['id-photo-segment', 'photo-bg'] },
  { key: 'TENCENT_SECRET_KEY', description: '腾讯云SecretKey', requiredInProd: false, usedBy: ['id-photo-segment', 'photo-bg'] },

  // 管理 — 生产必需
  { key: 'ADMIN_SECRET', description: '管理员操作密钥', requiredInProd: true, usedBy: ['data-cleanup'] },
]

// ==================== 验证结果 ====================

export interface EnvValidationResult {
  valid: boolean
  missing: { key: string; description: string; required: boolean }[]
  present: string[]
  warnings: string[]
}

// ==================== 核心函数 ====================

/**
 * 验证所有环境变量配置
 * 
 * @param {Object} [options] - 配置项
 * @param {boolean} [options.throwOnMissing=true] - 生产环境缺少必需变量时是否抛异常
 * @returns {EnvValidationResult} 验证结果
 */
export function validateEnv(options: { throwOnMissing?: boolean } = {}): EnvValidationResult {
  const { throwOnMissing = true } = options
  const isProd = process.env.NODE_ENV === 'production'

  const result: EnvValidationResult = {
    valid: true,
    missing: [],
    present: [],
    warnings: [],
  }

  for (const def of ENV_VARS) {
    const value = process.env[def.key]
    if (value && value.trim() !== '') {
      result.present.push(def.key)

      // 检查弱密钥
      if (def.key === 'JWT_SECRET' && value.length < 32) {
        result.warnings.push(`${def.key}: 密钥长度不足32位，建议使用更强的密钥`)
      }
    } else {
      const required = isProd && def.requiredInProd
      result.missing.push({
        key: def.key,
        description: def.description,
        required,
      })

      if (required) {
        result.valid = false
        console.error(`[EnvCheck] ❌ 缺少必需环境变量: ${def.key} (${def.description}) — 影响模块: ${def.usedBy.join(', ')}`)
      } else {
        console.warn(`[EnvCheck] ⚠️ 可选环境变量未配置: ${def.key} (${def.description})`)
      }
    }
  }

  // 配对检查：成对出现的变量
  const pairs = [
    ['TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY'],
    ['WX_GZH_APPID', 'WX_GZH_SECRET'],
  ]
  for (const [a, b] of pairs) {
    const hasA = result.present.includes(a)
    const hasB = result.present.includes(b)
    if (hasA !== hasB) {
      result.warnings.push(`${a} 和 ${b} 应成对配置，当前只配置了其中一个`)
    }
  }

  // 汇总日志
  if (result.valid) {
    console.log(`[EnvCheck] ✅ 环境变量检查通过: ${result.present.length}/${ENV_VARS.length} 已配置`)
  } else {
    const requiredMissing = result.missing.filter(m => m.required)
    const msg = `[EnvCheck] ❌ 环境变量检查失败: 缺少 ${requiredMissing.length} 个必需变量 (${requiredMissing.map(m => m.key).join(', ')})`
    console.error(msg)
    if (isProd && throwOnMissing) {
      throw new Error(msg)
    }
  }

  if (result.warnings.length > 0) {
    result.warnings.forEach(w => console.warn(`[EnvCheck] ⚠️ ${w}`))
  }

  return result
}

/**
 * 快速检查单个环境变量是否可用
 * @param key - 环境变量名
 * @returns 是否已配置且非空
 */
export function hasEnv(key: string): boolean {
  const val = process.env[key]
  return !!(val && val.trim() !== '')
}

/**
 * 获取环境变量，缺失时返回默认值并记录警告
 * @param key - 环境变量名
 * @param defaultValue - 默认值
 * @returns 环境变量值或默认值
 */
export function getEnv(key: string, defaultValue: string = ''): string {
  const val = process.env[key]
  if (!val || val.trim() === '') {
    if (defaultValue === '') {
      console.warn(`[EnvCheck] 环境变量 ${key} 未配置，使用空默认值`)
    }
    return defaultValue
  }
  return val
}

export default { validateEnv, hasEnv, getEnv }
