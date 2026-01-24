/**
 * 统一配置管理
 * ⚠️ 修复：移除 import.meta.env 依赖，改用硬编码配置
 * 
 * 📝 使用说明：
 * 1. 所有环境变量通过此文件统一导出
 * 2. 提供默认值确保配置健壮性
 * 3. 支持开发/生产环境自动切换
 * 
 * 💡 使用示例：
 * import config from '@/config'
 * console.log(config.api.baseUrl)
 * console.log(config.wx.appId)
 * console.log(config.isDev)
 */

/**
 * 统一配置对象
 * ⚠️ 修复：直接使用硬编码值，不依赖 import.meta.env
 */
const config = {
    // ==================== 环境信息 ====================

    /**
     * 当前环境：development | production
     */
    env: 'production',

    /**
     * 是否为开发环境
     */
    isDev: false,

    /**
     * 是否为生产环境
     */
    isProd: true,

    // ==================== 微信小程序配置 ====================

    /**
     * 微信小程序配置
     */
    wx: {
        /**
         * 微信小程序 AppID
         */
        appId: 'wx5bee888cf32215df'
    },

    // ==================== API 配置 ====================

    /**
     * API 服务配置
     */
    api: {
        /**
         * API 基础地址（Sealos 后端服务）
         */
        baseUrl: 'https://nf98ia8qnt.sealosbja.site',

        /**
         * API 请求超时时间（毫秒）
         */
        timeout: 100000
    },

    // ==================== AI 服务配置 ====================

    /**
     * AI 服务配置
     */
    ai: {
        /**
         * AI 模型名称
         */
        model: 'glm-4-plus',

        /**
         * AI 请求超时时间（毫秒）
         */
        timeout: 60000
    },

    // ==================== 应用配置 ====================

    /**
     * 应用基础配置
     */
    app: {
        /**
         * 应用名称
         */
        name: 'Exam-Master',

        /**
         * 应用版本
         */
        version: '1.0.0',

        /**
         * 分页大小
         */
        pageSize: 20
    },

    // ==================== 调试配置 ====================

    /**
     * 调试配置
     */
    debug: {
        /**
         * 是否启用调试模式
         */
        enabled: true,

        /**
         * 是否启用 Mock 数据
         */
        enableMock: false
    }
}

/**
 * 开发环境输出配置信息
 */
if (config.debug.enabled) {
    console.log('📦 当前配置：', {
        环境: config.env,
        微信AppID: config.wx.appId,
        API地址: config.api.baseUrl,
        调试模式: config.debug.enabled
    })
}

export default config
