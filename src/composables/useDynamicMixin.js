/**
 * useDynamicMixin — 分包模块动态加载
 * 从 practice/index.vue 提取的动态 mixin 加载、占位方法、分包预加载逻辑
 */
import { ref } from 'vue';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import config from '@/config/index.js';

export function useDynamicMixin() {
  // 分包加载状态
  const subPackageLoaded = ref(false);
  const mixinLoaded = ref(false);
  // 动态方法缓存
  const dynamicMethodsCache = {};

  /**
   * 确保分包已加载（微信小程序分包预加载）
   */
  async function ensurePracticeSubPackageLoaded() {
    if (subPackageLoaded.value) return;

    // #ifdef MP-WEIXIN
    if (typeof uni.loadSubPackage === 'function') {
      await new Promise((resolve, reject) => {
        uni.loadSubPackage({
          root: 'pages/practice-sub',
          success: () => resolve(true),
          fail: (err) => reject(err)
        });
      });
    }
    // #endif

    subPackageLoaded.value = true;
  }

  /**
   * 跨平台加载分包模块
   */
  function requirePracticeSubpackageModule(modulePath) {
    // #ifdef APP-PLUS
    // App 端所有模块已打包在一起，直接动态 import
    const moduleMap = {
      '../practice-sub/composables/ai-generation-mixin.js': () =>
        import('../pages/practice-sub/composables/ai-generation-mixin.js'),
      '../practice-sub/composables/learning-stats-mixin.js': () =>
        import('../pages/practice-sub/composables/learning-stats-mixin.js')
    };
    const loader = moduleMap[modulePath];
    if (loader) {
      return loader();
    }
    return Promise.reject(new Error(`未知的模块路径: ${modulePath}`));
    // #endif

    // #ifndef APP-PLUS
    // H5 环境也使用 import()，与 APP-PLUS 一致
    // 微信小程序环境下 require() 可用，但 import() 同样被 uni-app 支持
    const moduleMapNonApp = {
      '../practice-sub/composables/ai-generation-mixin.js': () =>
        import('../pages/practice-sub/composables/ai-generation-mixin.js'),
      '../practice-sub/composables/learning-stats-mixin.js': () =>
        import('../pages/practice-sub/composables/learning-stats-mixin.js')
    };
    const loaderNonApp = moduleMapNonApp[modulePath];
    if (loaderNonApp) {
      return loaderNonApp();
    }
    return Promise.reject(new Error(`未知的模块路径: ${modulePath}`));
    // #endif
  }

  /**
   * 调用已缓存的动态方法（有容错处理）
   */
  async function invokeDynamicMethod(methodName, args = [], options = {}) {
    const { silent = false } = options;

    const cached = dynamicMethodsCache[methodName];
    if (typeof cached === 'function') {
      return cached(...args);
    }

    if (!silent) {
      toast.info('功能初始化失败，请稍后重试');
    }
    return undefined;
  }

  /**
   * 加载 AI 生成与学习统计 mixin，注入到目标组件实例
   * @param {Object} componentInstance - Vue 组件实例（this）
   * @param {number} retryCount - 当前重试次数
   */
  async function loadAIGenerationMixin(componentInstance, retryCount = 0) {
    const MAX_RETRIES = config.retry.maxRetries;
    try {
      await ensurePracticeSubPackageLoaded();

      const [aiModule, statsModule] = await Promise.all([
        requirePracticeSubpackageModule('../practice-sub/composables/ai-generation-mixin.js'),
        requirePracticeSubpackageModule('../practice-sub/composables/learning-stats-mixin.js')
      ]);

      const resolveExport = (mod, name) => mod[name] || (mod.default && mod.default[name]) || mod.default || mod;
      const aiMixin = resolveExport(aiModule, 'aiGenerationMixin');
      const statsMixin = resolveExport(statsModule, 'learningStatsMixin');
      if (!aiMixin || !statsMixin) {
        throw new Error('分包模块导出为空');
      }

      // 将 mixin 的方法混入缓存和目标实例
      const mixins = [aiMixin, statsMixin];
      let injectedCount = 0;
      for (const mixin of mixins) {
        const methods = mixin.methods || mixin;
        if (!methods || typeof methods !== 'object') {
          continue;
        }
        for (const key of Object.keys(methods)) {
          if (typeof methods[key] === 'function') {
            const bound = methods[key].bind(componentInstance);
            dynamicMethodsCache[key] = bound;
            // 保留主包 chooseImportSource 的兜底行为
            if (key !== 'chooseImportSource') {
              componentInstance[key] = bound;
            }
            injectedCount++;
          }
        }
      }

      if (injectedCount === 0) {
        throw new Error('分包模块方法注入失败');
      }

      mixinLoaded.value = true;
      logger.log('[practice] 分包模块加载完成');
    } catch (e) {
      logger.error('[practice] 分包模块加载失败 (尝试 ' + (retryCount + 1) + '):', e);
      if (retryCount < MAX_RETRIES) {
        const delay = 500 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return loadAIGenerationMixin(componentInstance, retryCount + 1);
      } else {
        mixinLoaded.value = false;
        toast.info('部分功能加载失败，请检查网络后重新进入', 3000);
      }
    }
  }

  return {
    // 响应式状态
    subPackageLoaded,
    mixinLoaded,
    dynamicMethodsCache,
    // 方法
    ensurePracticeSubPackageLoaded,
    requirePracticeSubpackageModule,
    invokeDynamicMethod,
    loadAIGenerationMixin
  };
}
