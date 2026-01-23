export const APP_CONFIG = {
  // 应用ID - 生产环境通过环境变量注入
  appId: import.meta.env.VITE_APP_ID || 'wx_default_app_id',
  
  // 后端API地址
  apiUrl: import.meta.env.VITE_API_URL || 'https://api.exam-master.com',
  
  // 智谱AI配置
  zhipuApiKey: import.meta.env.VITE_AI_PROVIDER_KEY_PLACEHOLDER
  
  // 存储配置
  storage: {
    cloudFirst: true,
    localFallback: true
  }
}
