/**
 * 统一配置管理
 * ✅ 已启用环境变量支持，同时保留 fallback 值确保兼容性
 * 
 * 📝 使用说明：
 * 1. 优先读取 import.meta.env.VITE_* 环境变量
 * 2. 如果环境变量不存在，使用默认值（当前硬编码值）
 * 3. 支持开发/生产环境自动切换
 * 
 * 💡 使用示例：
 * import config from '@/config'
 * console.log(config.api.baseUrl)
 * console.log(config.wx.appId)
 * console.log(config.isDev)
 * 
 * 🔧 配置方式：
 * 1. 复制 .env.example 为 .env.local
 * 2. 填写真实配置值
 * 3. 重启开发服务器
 */

/**
 * 安全获取环境变量（兼容 SSR 和客户端）
 * @param {string} key - 环境变量键名
 * @param {any} defaultValue - 默认值
 * @returns {any} 环境变量值或默认值
 */
function getEnv(key, defaultValue) {
    try {
        // Vite 环境变量
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            const value = import.meta.env[key]
            if (value !== undefined && value !== '') {
                return value
            }
        }
    } catch (e) {
        // 忽略错误，使用默认值
    }
    return defaultValue
}

/**
 * 安全获取数字类型环境变量
 * @param {string} key - 环境变量键名
 * @param {number} defaultValue - 默认值
 * @returns {number} 数字值
 */
function getEnvNumber(key, defaultValue) {
    const value = getEnv(key, null)
    if (value === null) return defaultValue
    const num = parseInt(value, 10)
    return isNaN(num) ? defaultValue : num
}

/**
 * 安全获取布尔类型环境变量
 * @param {string} key - 环境变量键名
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean} 布尔值
 */
function getEnvBoolean(key, defaultValue) {
    const value = getEnv(key, null)
    if (value === null) return defaultValue
    return value === 'true' || value === '1'
}

/**
 * 统一配置对象
 */
const config = {
    // ==================== 环境信息 ====================

    /**
     * 当前环境：development | production
     */
    env: getEnv('MODE', 'production'),

    /**
     * 是否为开发环境
     */
    isDev: getEnvBoolean('DEV', false),

    /**
     * 是否为生产环境
     */
    isProd: getEnvBoolean('PROD', true),

    // ==================== 微信小程序配置 ====================

    /**
     * 微信小程序配置
     */
    wx: {
        /**
         * 微信小程序 AppID
         * 配置方式：VITE_WX_APP_ID=your_app_id
         */
        appId: getEnv('VITE_WX_APP_ID', 'wx5bee888cf32215df')
    },

    // ==================== API 配置 ====================

    /**
     * API 服务配置
     */
    api: {
        /**
         * API 基础地址（Sealos 后端服务）
         * 配置方式：VITE_API_BASE_URL=https://your-api.com
         */
        baseUrl: getEnv('VITE_API_BASE_URL', 'https://nf98ia8qnt.sealosbja.site'),

        /**
         * API 请求超时时间（毫秒）
         * 配置方式：VITE_API_TIMEOUT=30000
         */
        timeout: getEnvNumber('VITE_API_TIMEOUT', 100000)
    },

    // ==================== AI 服务配置 ====================

    /**
     * AI 服务配置
     */
    ai: {
        /**
         * AI 模型名称
         * 配置方式：VITE_AI_MODEL=glm-4-plus
         */
        model: getEnv('VITE_AI_MODEL', 'glm-4-plus'),

        /**
         * AI 请求超时时间（毫秒）
         * 配置方式：VITE_AI_TIMEOUT=60000
         */
        timeout: getEnvNumber('VITE_AI_TIMEOUT', 60000)
    },

    // ==================== 应用配置 ====================

    /**
     * 应用基础配置
     */
    app: {
        /**
         * 应用名称
         */
        name: getEnv('VITE_APP_NAME', 'Exam-Master'),

        /**
         * 应用版本
         */
        version: getEnv('VITE_APP_VERSION', '1.0.0'),

        /**
         * 分页大小
         */
        pageSize: getEnvNumber('VITE_PAGE_SIZE', 20)
    },

    // ==================== 调试配置 ====================

    /**
     * 调试配置
     */
    debug: {
        /**
         * 是否启用调试模式
         * 配置方式：VITE_DEBUG_MODE=true
         */
        enabled: getEnvBoolean('VITE_DEBUG_MODE', false) || getEnvBoolean('DEV', false),

        /**
         * 是否启用 Mock 数据
         * 配置方式：VITE_ENABLE_MOCK=true
         */
        enableMock: getEnvBoolean('VITE_ENABLE_MOCK', false)
    },

    // ==================== 审核模式配置 ====================

    /**
     * 审核模式配置
     * 用于微信小程序送审时隐藏高风险功能
     */
    audit: {
        /**
         * 是否为审核模式
         * 送审时设为 true，过审后改为 false
         * 配置方式：VITE_AUDIT_MODE=true
         */
        isAuditMode: getEnvBoolean('VITE_AUDIT_MODE', true),

        /**
         * 审核期间隐藏的功能列表
         */
        hiddenFeatures: ['universe', 'ai-photo-search', 'voice-input'],

        /**
         * 是否启用重型功能（Canvas动画、WebGL等）
         * 审核期间建议关闭
         */
        enableHeavyFeatures: getEnvBoolean('VITE_ENABLE_HEAVY_FEATURES', false)
    },

    // ==================== 配置来源信息 ====================

    /**
     * 配置来源（用于调试）
     */
    _source: {
        wxAppId: getEnv('VITE_WX_APP_ID', null) ? 'env' : 'default',
        apiBaseUrl: getEnv('VITE_API_BASE_URL', null) ? 'env' : 'default'
    }
}

/**
 * 开发环境输出配置信息
 */
if (config.debug.enabled) {
    console.log('\n' + '='.repeat(50))
    console.log('📦 Exam-Master 配置信息')
    console.log('='.repeat(50))
    console.log('环境:', config.env)
    console.log('微信AppID:', config.wx.appId, `(${config._source.wxAppId})`)
    console.log('API地址:', config.api.baseUrl, `(${config._source.apiBaseUrl})`)
    console.log('调试模式:', config.debug.enabled)
    console.log('='.repeat(50) + '\n')
}

export default config
