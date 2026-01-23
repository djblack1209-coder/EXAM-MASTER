/**
 * 全局配置文件
 * 统一管理项目中的常量、API配置等
 * 
 * ⚠️ 安全提示：
 * 1. 生产环境请将 API Key 配置到 Sealos 后端环境变量中
 * 2. 不要将包含真实 API Key 的代码提交到公开仓库
 * 3. 建议使用环境变量或后端服务来管理敏感信息
 * 
 * 📝 迁移说明：
 * - 已从阿里云 uniCloud 迁移到 Sealos 后端服务
 * - 所有云函数调用已替换为 lafService
 */

// 智谱AI配置
// ⚠️ 安全升级：前端不再持有任何API Key
// 所有AI请求必须通过 Sealos 后端 /proxy-ai 接口转发
export const AI_CONFIG = {
  // ❌ 已移除：apiKey 和 getApiKey() 方法
  // ✅ 新方案：所有AI请求通过 lafService.proxyAI() 调用后端代理
  baseURL: 'https://open.bigmodel.cn/api/paas/v4', // 仅供参考，实际请求走后端
  model: 'glm-4-plus', // 默认使用的模型
  timeout: 60000 // 请求超时时间
}

/**
 * ⚠️ 已废弃：getApiKey() 方法
 * 请使用 lafService.proxyAI() 替代直接调用智谱AI
 * @deprecated 使用 lafService.proxyAI(messages, options) 替代
 */
export const getApiKey = () => {
  console.error('❌ getApiKey() 已废弃！请使用 lafService.proxyAI() 调用后端代理')
  return '' // 返回空字符串，强制开发者切换到后端代理
}

// API基础配置
export const API_CONFIG = {
  // Sealos 后端服务地址（已在 lafService.js 中配置）
  // 注意：前端环境不支持 process.env，使用编译时替换或直接写死
  baseURL: 'https://nf98ia8qnt.sealosbja.site', // Sealos 后端服务
  timeout: 30000
}

// 应用配置
export const APP_CONFIG = {
  appName: 'Exam-Master',
  version: '1.0.0',
  // 分页配置
  pageSize: 20,
  // 缓存键名
  cacheKeys: {
    token: 'EXAM_TOKEN',
    userInfo: 'EXAM_USER_INFO',
    studyProgress: 'EXAM_STUDY_PROGRESS'
  }
}

// 路由配置
export const ROUTE_CONFIG = {
  // 不需要登录的页面
  whiteList: [
    '/src/pages/index/index'
  ]
}

// 微信小程序配置
// ⚠️ 注意：这是前端配置文件，只能配置 AppID
// WX_SECRET_PLACEHOLDER
export const WX_CONFIG = {
  // AppID 直接硬编码（前端环境不支持 process.env）
  appId: 'wx5bee888cf32215df' // 你的小程序 AppID
  // ⚠️ 前端不包含 Secret，Secret 仅在 Sealos 后端通过环境变量读取
}

export default {
  AI_CONFIG,
  API_CONFIG,
  APP_CONFIG,
  ROUTE_CONFIG,
  WX_CONFIG
}
