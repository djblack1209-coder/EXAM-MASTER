import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { globalErrorHandler } from '@/utils/error/global-error-handler.js';
import { logger } from '@/utils/logger.js';
import { applyTheme, getCurrentTheme } from '@/design/theme-runtime.js';
import { readNativeInsets } from '@/design/native-theme.js';
import { installI18n } from '@/i18n/index.js';
// #ifdef H5
import { bindAppBoot } from '@/design/app-boot.js';
// #endif

export function createApp() {
  const app = createSSRApp(App);
  // #ifdef H5
  bindAppBoot(app);
  // #endif
  const pinia = createPinia();

  app.use(pinia);
  installI18n(app);
  app.config.globalProperties.$yoziInsets = readNativeInsets();
  // #ifndef H5
  app.mixin({
    onShow() {
      applyTheme(getCurrentTheme());
    }
  });
  // #endif

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
