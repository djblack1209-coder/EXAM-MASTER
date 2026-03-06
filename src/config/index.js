import { logger } from '@/utils/logger.js';

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
  // Vite 在构建时会将 import.meta.env 替换为具体对象
  // 不要用 typeof import.meta !== 'undefined' 守卫，
  // 因为 CJS 编译后会生成 require("url") 调用，在微信小程序环境中不存在该模块
  const env = import.meta.env;
  if (env) {
    const value = env[key];
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  return defaultValue;
}

/**
 * 安全获取数字类型环境变量
 * @param {string} key - 环境变量键名
 * @param {number} defaultValue - 默认值
 * @returns {number} 数字值
 */
function getEnvNumber(key, defaultValue) {
  const value = getEnv(key, null);
  if (value === null) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * 安全获取布尔类型环境变量
 * @param {string} key - 环境变量键名
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean} 布尔值
 */
function getEnvBoolean(key, defaultValue) {
  const value = getEnv(key, null);
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return defaultValue;
}

/**
 * 统一配置对象
 */
const config = {
  // ==================== 应用版本 ====================

  /**
   * L6: 统一版本号（单一来源，profile/health-check 等引用此值）
   */
  appVersion: '1.0.0',

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
     * ⚠️ 必须通过环境变量配置，不再提供硬编码默认值
     */
    appId: getEnv('VITE_WX_APP_ID', ''),

    /**
     * 微信公众号 AppID（H5 微信登录用）
     * 配置方式：VITE_WX_GZH_APP_ID=your_gzh_app_id
     */
    gzhAppId: getEnv('VITE_WX_GZH_APP_ID', '')
  },

  // ==================== QQ登录配置 ====================

  /**
   * QQ互联配置
   */
  qq: {
    /**
     * QQ互联 AppID
     * 配置方式：VITE_QQ_APP_ID=your_qq_app_id
     * ⚠️ 必须通过环境变量配置，不再提供硬编码默认值
     */
    appId: getEnv('VITE_QQ_APP_ID', ''),

    /**
     * QQ OAuth 回调地址
     * 配置方式：VITE_QQ_REDIRECT_URI=https://your-domain.com/pages/login/qq-callback
     */
    redirectUri: getEnv('VITE_QQ_REDIRECT_URI', '')
  },

  // ==================== API 配置 ====================

  /**
   * API 服务配置
   */
  api: {
    /**
     * API 基础地址（Sealos 后端服务）
     * 配置方式：VITE_API_BASE_URL=https://your-api.com
     * ⚠️ 必须通过环境变量配置，不再提供硬编码默认值
     */
    baseUrl: getEnv('VITE_API_BASE_URL', ''),

    /**
     * API 请求超时时间（毫秒）
     * 配置方式：VITE_API_TIMEOUT=30000
     */
    timeout: getEnvNumber('VITE_API_TIMEOUT', 30000)
  },

  // ==================== 智能服务配置 ====================

  /**
   * 智能服务配置
   */
  ai: {
    /**
     * 智能模型名称
     * 配置方式：VITE_AI_MODEL=glm-4-plus
     */
    model: getEnv('VITE_AI_MODEL', 'glm-4-plus'),

    /**
     * 智能请求超时时间（毫秒）
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
    // 默认与 appVersion 保持一致，避免多处版本号漂移
    version: getEnv('VITE_APP_VERSION', '1.0.0'),

    /**
     * 分页大小
     */
    pageSize: getEnvNumber('VITE_PAGE_SIZE', 20)
  },

  // ==================== 安全配置 ====================

  /**
   * 安全相关配置
   */
  security: {
    /**
     * 本地存储混淆密钥（非密码学安全，防止直接读取 localStorage 明文）
     * ⚠️ 生产环境务必通过 VITE_OBFUSCATION_KEY 环境变量覆盖此默认值
     * 配置方式：VITE_OBFUSCATION_KEY=your_custom_key
     */
    // [v1.2.0 审核修复] 移除硬编码敏感 fallback，改为空字符串，生产环境必须通过环境变量配置
    obfuscationKey: getEnv('VITE_OBFUSCATION_KEY', ''),

    /**
     * 请求签名盐值（FNV-1a 防篡改）
     * 配置方式：VITE_REQUEST_SIGN_SALT=your_salt
     */
    // [v1.2.0 审核修复] 移除硬编码敏感 fallback，改为空字符串，生产环境必须通过环境变量配置
    requestSignSalt: getEnv('VITE_REQUEST_SIGN_SALT', '')
  },

  // ==================== 存储配置 ====================

  /**
   * 存储配置
   */
  storage: {
    /**
     * 本地存储前缀
     */
    prefix: getEnv('VITE_STORAGE_PREFIX', 'exam_master_'),

    /**
     * 缓存过期时间（秒）
     */
    cacheExpire: getEnvNumber('VITE_CACHE_EXPIRE', 86400),

    /**
     * 云端优先
     */
    cloudFirst: true,

    /**
     * 本地降级
     */
    localFallback: true
  },

  // ==================== 上传配置 ====================

  /**
   * 上传配置
   */
  upload: {
    /**
     * 头像最大大小（字节）
     */
    avatarMaxSize: getEnvNumber('VITE_AVATAR_MAX_SIZE', 2097152),

    /**
     * 文件最大大小（字节）
     */
    fileMaxSize: getEnvNumber('VITE_FILE_MAX_SIZE', 10485760),

    /**
     * 允许的图片类型
     */
    allowedImageTypes: getEnv('VITE_ALLOWED_IMAGE_TYPES', 'image/jpeg,image/png,image/gif,image/webp').split(',')
  },

  // ==================== 功能开关 ====================

  /**
   * 功能开关配置
   */
  features: {
    /**
     * 是否启用PK对战
     */
    enablePK: getEnvBoolean('VITE_ENABLE_PK', true),

    /**
     * 是否启用智能诊断
     */
    enableAIDiagnosis: getEnvBoolean('VITE_ENABLE_AI_DIAGNOSIS', true),

    /**
     * 是否启用离线模式
     */
    enableOffline: getEnvBoolean('VITE_ENABLE_OFFLINE', true),

    /**
     * 是否启用数据同步
     */
    enableSync: getEnvBoolean('VITE_ENABLE_SYNC', true)
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
    enableMock: getEnvBoolean('VITE_ENABLE_MOCK', false),

    /**
     * 是否启用性能监控
     */
    enablePerformanceMonitor: getEnvBoolean('VITE_ENABLE_PERFORMANCE_MONITOR', false)
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
    // [v1.2.0 审核修复] 默认关闭审核模式，送审时通过环境变量 VITE_AUDIT_MODE=true 开启
    isAuditMode: getEnvBoolean('VITE_AUDIT_MODE', false),

    /**
     * 审核期间隐藏的功能列表
     */
    hiddenFeatures: ['ai-photo-search', 'voice-input'],

    /**
     * 是否启用重型功能（Canvas动画、WebGL等）
     * 审核期间建议关闭
     */
    enableHeavyFeatures: getEnvBoolean('VITE_ENABLE_HEAVY_FEATURES', false)
  },

  // ==================== 监控配置 ====================

  /**
   * 监控配置
   */
  monitor: {
    /**
     * Sentry DSN
     */
    sentryDsn: getEnv('VITE_SENTRY_DSN', ''),

    /**
     * 统计分析ID
     */
    analyticsId: getEnv('VITE_ANALYTICS_ID', '')
  },

  // ==================== CDN配置 ====================

  /**
   * CDN配置
   */
  cdn: {
    /**
     * CDN地址
     */
    url: getEnv('VITE_CDN_URL', '')
  },

  // ==================== P006: WebSocket 配置 ====================

  /**
   * WebSocket 配置（排行榜实时推送等）
   */
  websocket: {
    /**
     * WebSocket 地址（开发环境）
     */
    devUrl: getEnv('VITE_WS_DEV_URL', 'ws://localhost:3000/ws/ranking'),

    /**
     * WebSocket 地址（生产环境）
     */
    prodUrl: getEnv('VITE_WS_PROD_URL', 'wss://api.exam-master.com/ws/ranking'),

    /**
     * 最大重连次数
     */
    maxReconnect: getEnvNumber('VITE_WS_MAX_RECONNECT', 5),

    /**
     * 重连基础延迟（毫秒）
     */
    reconnectDelay: 3000,

    /**
     * 心跳超时（毫秒）
     */
    heartbeatTimeout: 30000
  },

  // ==================== P006: 深度链接 / 邀请配置 ====================

  /**
   * 深度链接与邀请配置
   */
  deepLink: {
    /**
     * H5 基础地址
     */
    h5BaseUrl: getEnv('VITE_H5_BASE_URL', 'https://exam-master.com'),

    /**
     * App URL Scheme
     */
    appScheme: getEnv('VITE_APP_SCHEME', 'exammaster://'),

    /**
     * 小程序 PK 对战路径
     */
    miniProgramPkPath: '/pages/practice-sub/pk-battle',

    /**
     * 邀请码有效期（毫秒）
     */
    inviteExpiry: 24 * 60 * 60 * 1000,

    /**
     * 邀请码长度
     */
    inviteCodeLength: 8,

    /**
     * 邀请签名密钥
     * 配置方式：SECRET_PLACEHOLDER
     */
    inviteSecret: getEnv('VITE_INVITE_SECRET', '')
  },

  // ==================== P006: 网络检测配置 ====================

  /**
   * 网络检测配置
   */
  network: {
    /**
     * 网络连通性检测 URL
     */
    pingUrl: getEnv('VITE_PING_URL', '/static/images/logo.png')
  },

  // ==================== P006: HTTP 重试配置 ====================

  /**
   * HTTP 请求重试配置（统一 lafService 和 http.js）
   */
  retry: {
    maxRetries: 2,
    retryDelay: 1000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  },

  // ==================== 外部 CDN 配置 ====================

  /**
   * 外部 CDN 服务地址（集中管理，便于替换或自建）
   */
  externalCdn: {
    /**
     * DiceBear 头像生成服务
     */
    dicebearBaseUrl: getEnv('VITE_DICEBEAR_BASE_URL', 'https://api.dicebear.com/7.x'),

    /**
     * Icons8 图标服务
     */
    icons8BaseUrl: getEnv('VITE_ICONS8_BASE_URL', 'https://img.icons8.com'),

    /**
     * QR 码生成服务
     */
    qrServerBaseUrl: getEnv('VITE_QR_SERVER_BASE_URL', 'https://api.qrserver.com/v1')
  },

  // ==================== UI 常量 ====================

  /**
   * UI 交互常量
   */
  ui: {
    /**
     * 导航防抖延迟（毫秒）
     */
    navigationDebounceMs: 500,

    /**
     * Toast 默认显示时长（毫秒）
     */
    toastDuration: 2000
  },

  // ==================== 配置来源信息 ====================

  /**
   * 配置来源（用于调试）
   */
  _source: {
    wxAppId: getEnv('VITE_WX_APP_ID', null) ? 'env' : 'default',
    apiBaseUrl: getEnv('VITE_API_BASE_URL', null) ? 'env' : 'default'
  }
};

/**
 * 开发环境输出配置信息
 */
if (config.debug.enabled) {
  logger.log('\n' + '='.repeat(50));
  logger.log('Exam-Master config');
  logger.log('='.repeat(50));
  logger.log('env:', config.env);
  logger.log('wxAppId:', config.wx.appId, `(${config._source.wxAppId})`);
  logger.log('API:', config.api.baseUrl, `(${config._source.apiBaseUrl})`);
  logger.log('debug:', config.debug.enabled);
  logger.log('features:', JSON.stringify(config.features, null, 2));
  logger.log('='.repeat(50) + '\n');
}

/**
 * 配置安全检查：关键配置缺失时发出警告
 * 由于敏感默认值已移除，缺少环境变量时配置为空字符串
 */
{
  const requiredKeys = [
    { key: 'VITE_API_BASE_URL', label: 'API基础地址', value: config.api.baseUrl },
    { key: 'VITE_WX_APP_ID', label: '微信AppID', value: config.wx.appId }
  ];
  const inviteSecretKey = { key: 'VITE_INVITE_SECRET', label: '邀请签名密钥', value: config.deepLink.inviteSecret };
  // [v1.2.0 审核修复] 将安全密钥从 optional 提升为 required，防止空值运行
  const optionalKeys = [
    { key: 'VITE_QQ_APP_ID', label: 'QQ AppID', value: config.qq.appId },
    { key: 'VITE_OBFUSCATION_KEY', label: '存储混淆密钥', value: config.security.obfuscationKey },
    { key: 'VITE_REQUEST_SIGN_SALT', label: '请求签名盐值', value: config.security.requestSignSalt }
  ];
  const missing = requiredKeys.filter((k) => !k.value);
  const warnings = optionalKeys.filter((k) => {
    try {
      return !import.meta.env[k.key];
    } catch (_e) {
      return true;
    }
  });
  if (missing.length > 0) {
    logger.error(`[Config] ❌ 缺少必需的环境变量: ${missing.map((k) => `${k.key}(${k.label})`).join(', ')}`);
  }

  if (!inviteSecretKey.value) {
    if (config.isProd) {
      logger.error(
        `[Config] ❌ 缺少必需的环境变量: ${inviteSecretKey.key}(${inviteSecretKey.label})。邀请链接签名与验签功能将不可用`
      );
    } else {
      logger.warn(
        `[Config] ⚠️ 未配置 ${inviteSecretKey.key}(${inviteSecretKey.label})。邀请链接签名与验签功能将不可用（开发环境可临时忽略）`
      );
    }
  }
  if (config.isProd && warnings.length > 0) {
    logger.warn(`[Config] ⚠️ 生产环境建议配置: ${warnings.map((k) => `${k.key}(${k.label})`).join(', ')}。`);
  }
}

export default config;

// 导出工具函数供其他模块使用
export { getEnv, getEnvNumber, getEnvBoolean };
