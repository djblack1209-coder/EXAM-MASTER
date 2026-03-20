/**
 * 学习数据统计 Composable（懒加载）
 * 从 learning-stats-mixin 迁移为 Composition API
 * 通过动态 import 加载分包模块，避免打入主包
 */

import { ref, shallowRef } from 'vue';
import { logger } from '@/utils/logger.js';

/**
 * @param {Object} deps - 外部响应式状态
 * @param {import('vue').Ref<number>} deps.todayQuestions
 * @param {import('vue').Ref<number>} deps.todayGoal
 * @param {import('vue').Ref<number>} deps.currentStreak
 * @param {import('vue').Ref<number>} deps.weeklyAccuracy
 * @param {import('vue').Ref<number>} deps.weakPointsCount
 * @param {import('vue').Ref<Array>} deps.unlockedAchievements
 * @param {import('vue').Ref<Array>} deps.allAchievements
 * @param {import('vue').Ref<boolean>} deps.showGoalSettingModal
 * @param {import('vue').Ref<number>} deps.favoriteCount
 * @param {import('vue').Ref<boolean>} deps.showPracticeModesModal
 * @param {import('vue').Ref<Array>} deps.practiceModes
 * @param {import('vue').Ref<boolean>} deps.hasBank
 * @param {import('vue').Ref<boolean>} deps.isNavigating
 */
export function useLearningStats(deps) {
  const loaded = ref(false);
  const loadingPromise = shallowRef(null);
  const methods = shallowRef(null);

  async function _loadModule() {
    // #ifdef APP-PLUS
    return import('../pages/practice-sub/composables/learning-stats-mixin.js');
    // #endif

    // #ifndef APP-PLUS
    return new Promise((resolve, reject) => {
      try {
        if (typeof require !== 'function') {
          reject(new Error('当前环境不支持 require'));
          return;
        }
        require('../practice-sub/composables/learning-stats-mixin.js', (mod) => {
          if (!mod) {
            reject(new Error('模块为空'));
            return;
          }
          resolve(mod);
        });
      } catch (e) {
        reject(e);
      }
    });
    // #endif
  }

  async function load(retryCount = 0) {
    const MAX_RETRIES = 2;
    try {
      const mod = await _loadModule();
      const resolveExport = (m, name) => m[name] || (m.default && m.default[name]) || m.default || m;
      const statsMixin = resolveExport(mod, 'learningStatsMixin');
      if (!statsMixin) throw new Error('learning-stats 模块导出为空');

      const raw = statsMixin.methods || statsMixin;
      if (!raw || typeof raw !== 'object') throw new Error('learning-stats 方法对象无效');

      methods.value = raw;
      loaded.value = true;
      logger.log('[useLearningStats] 分包模块加载完成');
    } catch (e) {
      logger.error('[useLearningStats] 加载失败 (尝试 ' + (retryCount + 1) + '):', e);
      if (retryCount < MAX_RETRIES) {
        const delay = 500 * Math.pow(2, retryCount);
        await new Promise((r) => setTimeout(r, delay));
        return load(retryCount + 1);
      }
      loaded.value = false;
    }
  }

  function _ctx() {
    return new Proxy(
      {},
      {
        get(_, prop) {
          if (deps[prop] !== undefined) {
            const v = deps[prop];
            if (v && typeof v === 'object' && 'value' in v) return v.value;
            if (typeof v === 'function') return v;
            return v;
          }
          if (methods.value && typeof methods.value[prop] === 'function') {
            return (...args) => methods.value[prop].apply(_ctx(), args);
          }
          return undefined;
        },
        set(_, prop, value) {
          if (deps[prop] !== undefined) {
            const v = deps[prop];
            if (v && typeof v === 'object' && 'value' in v) {
              v.value = value;
              return true;
            }
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

  // --- Public API ---
  function loadLearningStats() {
    return _invoke('loadLearningStats', [], { silent: true });
  }
  function loadTodayGoal() {
    return _invoke('loadTodayGoal', [], { silent: true });
  }
  function loadAchievements() {
    return _invoke('loadAchievements', [], { silent: true });
  }

  function openGoalSetting() {
    if (methods.value && typeof methods.value.openGoalSetting === 'function') {
      return methods.value.openGoalSetting.apply(_ctx());
    }
    deps.showGoalSettingModal.value = true;
  }

  function onGoalSaved(value) {
    deps.todayGoal.value = value;
    deps.showGoalSettingModal.value = false;
  }

  function loadFavoriteCount() {
    return _invoke('loadFavoriteCount', [], { silent: true });
  }

  function showPracticeModes() {
    return _invoke('showPracticeModes');
  }

  function selectPracticeMode(mode) {
    return _invoke('selectPracticeMode', [mode]);
  }

  // Kick off loading
  loadingPromise.value = load();

  return {
    statsLoaded: loaded,
    statsLoadingPromise: loadingPromise,
    loadLearningStats,
    loadTodayGoal,
    loadAchievements,
    openGoalSetting,
    onGoalSaved,
    loadFavoriteCount,
    showPracticeModes,
    selectPracticeMode
  };
}
