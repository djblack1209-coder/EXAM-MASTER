import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './src/App.vue';
import { globalErrorHandler } from '@/utils/error/global-error-handler.js';
import { logger } from '@/utils/logger.js';
import { storageService } from '@/services/storageService.js';
import { useUserStore } from '@/stores/modules/user';

function shouldExposeE2EBridge() {
  try {
    if (typeof uni === 'undefined' || typeof uni.getAccountInfoSync !== 'function') {
      return false;
    }
    const info = uni.getAccountInfoSync();
    const envVersion = info?.miniProgram?.envVersion;
    return envVersion !== 'release';
  } catch {
    return false;
  }
}

function exposeE2EBridge(pinia) {
  if (!shouldExposeE2EBridge()) {
    return;
  }

  const userStore = useUserStore(pinia);

  globalThis.__E2E_BRIDGE__ = {
    clearAllStorage() {
      storageService.clear(true, { preserveGlobal: false });
      userStore.setToken?.('');
      userStore.setUserInfo?.(null);
      return true;
    },
    setStorage(key, value) {
      return storageService.save(key, value, true);
    },
    getStorage(key, defaultValue = null) {
      return storageService.get(key, defaultValue);
    },
    removeStorage(key) {
      return storageService.remove(key, true);
    },
    seedAuth(payload = {}) {
      const userId = payload.userId || 'e2e_user';
      const token = payload.token || `e2e-token-${Date.now()}`;
      const userInfo = {
        uid: userId,
        _id: userId,
        userId,
        nickName: payload.nickName || 'E2E Tester',
        avatarUrl: payload.avatarUrl || ''
      };

      storageService.save('userInfo', userInfo, true);
      storageService.save('EXAM_TOKEN', token, true);
      storageService.save('EXAM_USER_ID', userId, true);
      userStore.setUserInfo?.(userInfo);
      userStore.setToken?.(token);
      return { userId, token };
    },
    seedQuestionBank(questions = [], userId = 'e2e_user') {
      storageService.save('v30_bank', questions, true);
      storageService.save(`u_${userId}_v30_bank`, questions, true);
      return Array.isArray(questions) ? questions.length : 0;
    },
    getStorageInfo() {
      return storageService.getStorageInfo();
    }
  };
}

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();

  app.use(pinia);
  exposeE2EBridge(pinia);

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
