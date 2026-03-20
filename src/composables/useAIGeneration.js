/**
 * 智能题目生成 Composable（懒加载）
 * 从 ai-generation-mixin 迁移为 Composition API
 * 通过动态 import 加载分包模块，避免打入主包
 */

import { ref, shallowRef } from 'vue';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';

/**
 * @param {Object} deps - 外部响应式状态（由 index.vue 提供）
 * @param {import('vue').Ref<string>} deps.fileName
 * @param {import('vue').Ref<string>} deps.fullFileContent
 * @param {import('vue').Ref<number>} deps.readOffset
 * @param {import('vue').Ref<number>} deps.chunkSize
 * @param {import('vue').Ref<number>} deps.generatedCount
 * @param {import('vue').Ref<number>} deps.totalQuestionsLimit
 * @param {import('vue').Ref<boolean>} deps.isLooping
 * @param {import('vue').Ref<boolean>} deps.isPaused
 * @param {import('vue').Ref<boolean>} deps.showMask
 * @param {import('vue').Ref<boolean>} deps.showSpeedModal
 * @param {import('vue').Ref<boolean>} deps.isRequestInFlight
 * @param {import('vue').Ref<number>} deps.batchQuestionCount
 * @param {import('vue').Ref<string>} deps.uploadHistoryKey
 * @param {import('vue').Ref<string>} deps.currentUploadSource
 * @param {import('vue').Ref<string>} deps.currentUploadId
 * @param {import('vue').Ref<number>} deps.bankSizeAtGenStart
 * @param {import('vue').Ref<boolean>} deps.isUploadingFile
 * @param {import('vue').Ref<boolean>} deps.isGeneratingQuestions
 * @param {import('vue').Ref<number>} deps.generationProgress
 * @param {import('vue').Ref<boolean>} deps.showQuizManageModal
 * @param {import('vue').Ref<boolean>} deps.hasBank
 * @param {import('vue').Ref<number>} deps.totalQuestions
 * @param {import('vue').Ref<string>} deps.currentSoup
 * @param {import('vue').Ref<string[]>} deps.soupList
 * @param {Function} deps.refreshBankStatus
 * @param {Function} deps.goPractice
 */
export function useAIGeneration(deps) {
  const loaded = ref(false);
  const loadingPromise = shallowRef(null);
  const methods = shallowRef(null);

  // Internal state not exposed to template
  let _consecutiveFailures = 0;
  let _progressTimer = null;
  let _soupTimer = null;
  let _subPackageLoaded = false;

  async function _ensurePracticeSubPackageLoaded() {
    if (_subPackageLoaded) return;
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
    _subPackageLoaded = true;
  }

  function _requireModule(modulePath) {
    // #ifdef APP-PLUS
    const moduleMap = {
      '../practice-sub/composables/ai-generation-mixin.js': () =>
        import('../pages/practice-sub/composables/ai-generation-mixin.js'),
      '../practice-sub/composables/learning-stats-mixin.js': () =>
        import('../pages/practice-sub/composables/learning-stats-mixin.js')
    };
    const loader = moduleMap[modulePath];
    if (loader) return loader();
    return Promise.reject(new Error(`未知的模块路径: ${modulePath}`));
    // #endif

    // #ifndef APP-PLUS
    return new Promise((resolve, reject) => {
      try {
        if (typeof require !== 'function') {
          reject(new Error('当前环境不支持 require 加载分包模块'));
          return;
        }
        require(modulePath, (moduleExports) => {
          if (!moduleExports) {
            reject(new Error(`分包模块为空: ${modulePath}`));
            return;
          }
          resolve(moduleExports);
        });
      } catch (error) {
        reject(error);
      }
    });
    // #endif
  }

  /**
   * 加载分包模块并提取方法。返回 Promise 供外部 await。
   */
  async function load(retryCount = 0) {
    const MAX_RETRIES = 2;
    try {
      await _ensurePracticeSubPackageLoaded();
      const aiModule = await _requireModule('../practice-sub/composables/ai-generation-mixin.js');
      const resolveExport = (mod, name) => mod[name] || (mod.default && mod.default[name]) || mod.default || mod;
      const aiMixin = resolveExport(aiModule, 'aiGenerationMixin');
      if (!aiMixin) throw new Error('ai-generation 模块导出为空');

      const raw = aiMixin.methods || aiMixin;
      if (!raw || typeof raw !== 'object') throw new Error('ai-generation 方法对象无效');

      methods.value = raw;
      loaded.value = true;
      logger.log('[useAIGeneration] 分包模块加载完成');
    } catch (e) {
      logger.error('[useAIGeneration] 加载失败 (尝试 ' + (retryCount + 1) + '):', e);
      if (retryCount < MAX_RETRIES) {
        const delay = 500 * Math.pow(2, retryCount);
        await new Promise((r) => setTimeout(r, delay));
        return load(retryCount + 1);
      }
      loaded.value = false;
      uni.showToast({ title: '部分功能加载失败，请检查网络后重新进入', icon: 'none', duration: 3000 });
    }
  }

  // Create a context object that mimics `this` for the mixin methods
  function _ctx() {
    return new Proxy(
      {},
      {
        get(_, prop) {
          // Check deps refs first
          if (deps[prop] !== undefined) {
            const v = deps[prop];
            if (v && typeof v === 'object' && 'value' in v) return v.value;
            if (typeof v === 'function') return v;
            return v;
          }
          // Check loaded methods
          if (methods.value && typeof methods.value[prop] === 'function') {
            return (...args) => methods.value[prop].apply(_ctx(), args);
          }
          // Internal state
          if (prop === '_consecutiveFailures') return _consecutiveFailures;
          if (prop === 'progressTimer') return _progressTimer;
          if (prop === 'soupTimer') return _soupTimer;
          return undefined;
        },
        set(_, prop, value) {
          // Write to deps refs
          if (deps[prop] !== undefined) {
            const v = deps[prop];
            if (v && typeof v === 'object' && 'value' in v) {
              v.value = value;
              return true;
            }
          }
          // Internal state
          if (prop === '_consecutiveFailures') {
            _consecutiveFailures = value;
            return true;
          }
          if (prop === 'progressTimer') {
            _progressTimer = value;
            return true;
          }
          if (prop === 'soupTimer') {
            _soupTimer = value;
            return true;
          }
          return true;
        }
      }
    );
  }

  async function _invoke(name, args = [], options = {}) {
    const { silent = false } = options;
    if (methods.value && typeof methods.value[name] === 'function') {
      return methods.value[name].apply(_ctx(), args);
    }
    if (loadingPromise.value) {
      try {
        await loadingPromise.value;
      } catch (_) {
        /* ignore */
      }
    }
    if (methods.value && typeof methods.value[name] === 'function') {
      return methods.value[name].apply(_ctx(), args);
    }
    if (!silent) {
      uni.showToast({ title: '功能初始化失败，请稍后重试', icon: 'none' });
    }
    return undefined;
  }

  // --- Public API: thin wrappers that delegate to the dynamically loaded methods ---

  function chooseImportSource() {
    if (methods.value && typeof methods.value.chooseImportSource === 'function') {
      return methods.value.chooseImportSource.apply(_ctx());
    }
    // Fallback before module loads
    safeNavigateTo('/pages/practice-sub/import-data');
  }

  function chooseLocalFile() {
    return _invoke('chooseLocalFile');
  }
  function importFromChat() {
    return _invoke('importFromChat');
  }
  function importFromBaidu() {
    return _invoke('importFromBaidu');
  }
  function handleUpload(file) {
    return _invoke('handleUpload', [file]);
  }
  function startAI() {
    return _invoke('startAI');
  }
  function generateNextBatch() {
    return _invoke('generateNextBatch', [], { silent: true });
  }
  function pauseGeneration() {
    return _invoke('pauseGeneration');
  }
  function resumeGeneration() {
    return _invoke('resumeGeneration');
  }
  function finishGeneration() {
    return _invoke('finishGeneration');
  }
  function clearAll() {
    return _invoke('clearAll');
  }
  function clearQuizBank() {
    return _invoke('clearQuizBank');
  }
  function startProgressTimer() {
    return _invoke('startProgressTimer', [], { silent: true });
  }
  function updateGenerationProgress() {
    return _invoke('updateGenerationProgress', [], { silent: true });
  }
  function startSoupRotation() {
    return _invoke('startSoupRotation', [], { silent: true });
  }

  function showQuizManage() {
    if (methods.value && typeof methods.value.showQuizManage === 'function') {
      return methods.value.showQuizManage.apply(_ctx());
    }
    deps.showQuizManageModal.value = true;
  }

  function closeQuizManage() {
    deps.showQuizManageModal.value = false;
  }

  function closeSpeedModalAndPlay() {
    if (methods.value && typeof methods.value.closeSpeedModalAndPlay === 'function') {
      return methods.value.closeSpeedModalAndPlay.apply(_ctx());
    }
    deps.showSpeedModal.value = false;
    deps.goPractice();
  }

  function getGeneratedQuestionCount() {
    if (methods.value && typeof methods.value.getGeneratedQuestionCount === 'function') {
      return methods.value.getGeneratedQuestionCount.apply(_ctx());
    }
    return Math.max(0, (deps.totalQuestions?.value || 0) - (deps.bankSizeAtGenStart?.value || 0));
  }

  function cleanup() {
    if (_progressTimer) {
      clearInterval(_progressTimer);
      _progressTimer = null;
    }
    if (_soupTimer) {
      clearInterval(_soupTimer);
      _soupTimer = null;
    }
  }

  // Kick off loading and store the promise
  loadingPromise.value = load();

  return {
    aiLoaded: loaded,
    aiLoadingPromise: loadingPromise,
    chooseImportSource,
    chooseLocalFile,
    importFromChat,
    importFromBaidu,
    handleUpload,
    startAI,
    generateNextBatch,
    pauseGeneration,
    resumeGeneration,
    finishGeneration,
    clearAll,
    clearQuizBank,
    showQuizManage,
    closeQuizManage,
    closeSpeedModalAndPlay,
    getGeneratedQuestionCount,
    startProgressTimer,
    updateGenerationProgress,
    startSoupRotation,
    cleanup
  };
}
