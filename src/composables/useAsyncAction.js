/**
 * 异步操作组合式函数
 *
 * 消除页面中重复的 isLoading + try/catch + uni.showToast 模式。
 * 从 10+ 个页面组件中提取的公共逻辑。
 *
 * @module composables/useAsyncAction
 */

import { ref } from 'vue';

/**
 * 通用异步操作包装器
 * 自动管理 loading 状态和错误提示
 *
 * @param {Object} [options] - 配置项
 * @param {boolean} [options.showError=true] - 失败时是否自动 showToast
 * @param {string} [options.defaultErrorMsg] - 默认错误提示
 * @returns {{ loading: Ref<boolean>, error: Ref<Error|null>, execute: Function }}
 */
export function useAsyncAction(options = {}) {
  const { showError = true, defaultErrorMsg = '操作失败，请重试' } = options;

  const loading = ref(false);
  const error = ref(null);

  /**
   * 执行异步操作
   * @param {Function} fn - 异步函数
   * @param {Object} [opts] - 单次执行配置
   * @param {string} [opts.errorMsg] - 覆盖默认错误提示
   * @param {boolean} [opts.silent] - 静默模式，不显示 toast
   * @returns {Promise<*>} fn 的返回值，失败时返回 undefined
   */
  async function execute(fn, opts = {}) {
    loading.value = true;
    error.value = null;
    try {
      const result = await fn();
      return result;
    } catch (e) {
      error.value = e;
      if (showError && !opts.silent) {
        const msg = opts.errorMsg || e?.userMessage || e?.message || defaultErrorMsg;
        uni.showToast({ title: msg, icon: 'none' });
      }
      return undefined;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, execute };
}

/**
 * 分页列表组合式函数
 * 消除列表页中重复的 page/pageSize/hasMore/loadMore 逻辑
 *
 * @param {Function} fetchFn - (page, pageSize) => Promise<{ list, hasMore?, total? }>
 * @param {Object} [options] - 配置项
 * @param {number} [options.pageSize=20] - 每页条数
 * @param {boolean} [options.immediate=false] - 是否立即加载第一页
 * @returns {{ list: Ref<Array>, loading: Ref<boolean>, hasMore: Ref<boolean>, loadMore: Function, refresh: Function }}
 */
export function usePaginatedList(fetchFn, options = {}) {
  const { pageSize = 20, immediate = false } = options;

  const list = ref([]);
  const loading = ref(false);
  const hasMore = ref(true);
  const page = ref(1);

  async function loadMore() {
    if (loading.value || !hasMore.value) return;
    loading.value = true;
    try {
      const res = await fetchFn(page.value, pageSize);
      const items = res?.list || res?.data || [];
      if (page.value === 1) {
        list.value = items;
      } else {
        list.value = [...list.value, ...items];
      }
      // 判断是否还有更多
      if (res?.hasMore !== undefined) {
        hasMore.value = res.hasMore;
      } else if (res?.total !== undefined) {
        hasMore.value = list.value.length < res.total;
      } else {
        hasMore.value = items.length >= pageSize;
      }
      page.value++;
    } catch (e) {
      uni.showToast({
        title: e?.userMessage || '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      loading.value = false;
    }
  }

  async function refresh() {
    page.value = 1;
    hasMore.value = true;
    list.value = [];
    await loadMore();
  }

  if (immediate) {
    loadMore();
  }

  return { list, loading, hasMore, loadMore, refresh };
}

export default { useAsyncAction, usePaginatedList };
