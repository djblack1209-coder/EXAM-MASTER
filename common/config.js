/**
 * 全局配置文件（根目录版本 - 兼容旧代码）
 *
 * ⚠️ 注意：这是根目录下的配置文件，用于兼容旧的导入路径
 * 新代码请使用 src/common/config.js 或 src/config/index.js
 *
 * 📝 迁移说明：
 * - 已从阿里云 uniCloud 迁移到 Sealos 后端服务
 * - 所有云函数调用已替换为 lafService
 */

// 智谱AI配置
// ⚠️ 安全升级：前端不再持有任何API Key
// 所有AI请求必须通过 Sealos 后端 /proxy-ai 接口转发
export const AI_CONFIG = {
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-4-plus',
  timeout: 60000
};

// API基础配置
export const API_CONFIG = {
  baseURL: import.meta.env?.VITE_API_BASE_URL || '',
  timeout: Number(import.meta.env?.VITE_API_TIMEOUT) || 30000
};

// 应用配置
export const APP_CONFIG = {
  appName: 'Exam-Master',
  version: '1.0.0',
  pageSize: 20,
  cacheKeys: {
    token: 'EXAM_TOKEN',
    userInfo: 'EXAM_USER_INFO',
    studyProgress: 'EXAM_STUDY_PROGRESS'
  }
};

// 路由配置
export const ROUTE_CONFIG = {
  whiteList: ['/src/pages/index/index']
};

// 微信小程序配置
export const WX_CONFIG = {
  appId: import.meta.env?.VITE_WX_APP_ID || ''
};

export default {
  AI_CONFIG,
  API_CONFIG,
  APP_CONFIG,
  ROUTE_CONFIG,
  WX_CONFIG
};
