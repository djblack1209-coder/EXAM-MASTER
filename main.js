import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { globalErrorHandler } from '@/utils/error/global-error-handler.js';
import { logger } from '@/utils/logger.js';

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();

  app.use(pinia);

  // 初始化全局错误处理器
  globalErrorHandler.init({
    enableToast: true,
    enableModal: true,
    enableLog: true,
    enableReport: false, // 暂不启用远程上报
    ignorePatterns: [
      /ResizeObserver/,
      /Script error/,
      /switchTab:fail/,
      /reportRealtimeAction:fail/,
      /SharedArrayBuffer/
    ],
    onError: (error) => {
      logger.error('[GlobalError]', error.type, error.message);
    }
  });

  // 设置 Vue 错误处理器
  app.config.errorHandler = globalErrorHandler.createVueErrorHandler();

  // 设置 Vue 警告处理器（仅开发环境）
  if (process.env.NODE_ENV !== 'production') {
    app.config.warnHandler = (msg, vm, trace) => {
      logger.warn('[Vue Warning]', msg, trace);
    };
  }

  logger.log('[App] 应用初始化完成，全局错误处理已启用');

  return {
    app,
    pinia
  };
}

// H5 平台挂载
// #ifdef H5
const { app } = createApp();
app.mount('#app');
// #endif
