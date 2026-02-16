/**
 * Pull Refresh Mixin
 * 下拉刷新混入
 *
 * 问题50修复：实现下拉刷新功能
 *
 * 使用方式：
 * 1. 在页面中引入: import { pullRefreshMixin } from '@/mixins/pullRefresh'
 * 2. 混入: mixins: [pullRefreshMixin]
 * 3. 实现 onRefresh 方法
 * 4. 在模板中使用 :refresher-enabled="refreshEnabled" 等属性
 */

// Vue Composition API 导入 - 必须放在文件顶部
import { ref, computed } from 'vue';

/**
 * 下拉刷新混入 - Options API
 */
export const pullRefreshMixin = {
  data() {
    return {
      // 刷新状态
      refreshing: false,
      // 是否启用刷新
      refreshEnabled: true,
      // 刷新触发阈值(px)
      refreshThreshold: 45,
      // 刷新提示文字
      refreshText: {
        pulling: '下拉刷新',
        loosing: '释放刷新',
        loading: '正在刷新...',
        success: '刷新成功',
        failed: '刷新失败'
      },
      // 当前刷新状态文字
      currentRefreshText: '下拉刷新',
      // 刷新结果
      refreshResult: null,
      // 上次刷新时间
      lastRefreshTime: null,
      // 最小刷新间隔(ms)
      minRefreshInterval: 1000,
      // 刷新超时时间(ms)
      refreshTimeout: 10000
    };
  },

  computed: {
    // 是否可以刷新（防止频繁刷新）
    canRefresh() {
      if (!this.lastRefreshTime) return true;
      return Date.now() - this.lastRefreshTime >= this.minRefreshInterval;
    },

    // 格式化的上次刷新时间
    lastRefreshTimeFormatted() {
      if (!this.lastRefreshTime) return '从未刷新';
      const now = Date.now();
      const diff = now - this.lastRefreshTime;

      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
      return new Date(this.lastRefreshTime).toLocaleDateString();
    }
  },

  methods: {
    /**
     * 触发刷新 - 由scroll-view的refresherrefresh事件调用
     */
    async onPullDownRefresh() {
      if (this.refreshing || !this.canRefresh) {
        return;
      }

      this.refreshing = true;
      this.currentRefreshText = this.refreshText.loading;
      this.refreshResult = null;

      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('refresh_timeout')), this.refreshTimeout);
      });

      try {
        // 调用实际的刷新方法
        const refreshPromise = this.onRefresh ? this.onRefresh() : Promise.resolve();
        await Promise.race([refreshPromise, timeoutPromise]);

        this.refreshResult = 'success';
        this.currentRefreshText = this.refreshText.success;
        this.lastRefreshTime = Date.now();

        // 触发成功回调
        this.$emit('refresh-success');

      } catch (error) {
        console.error('[PullRefresh] 刷新失败:', error);
        this.refreshResult = 'failed';
        this.currentRefreshText = this.refreshText.failed;

        // 触发失败回调
        this.$emit('refresh-failed', error);

        // 显示错误提示
        if (error.message === 'refresh_timeout') {
          uni.showToast({
            title: '刷新超时，请重试',
            icon: 'none'
          });
        }
      } finally {
        // 延迟关闭刷新状态，让用户看到结果
        setTimeout(() => {
          this.refreshing = false;
          this.currentRefreshText = this.refreshText.pulling;

          // 停止原生下拉刷新
          uni.stopPullDownRefresh();
        }, 500);
      }
    },

    /**
     * 下拉状态变化
     * @param {Object} e - 事件对象
     */
    onRefresherPulling(_e) {
      if (this.refreshing) return;
      this.currentRefreshText = this.refreshText.pulling;
    },

    /**
     * 释放刷新
     */
    onRefresherRefresh() {
      this.onPullDownRefresh();
    },

    /**
     * 刷新恢复
     */
    onRefresherRestore() {
      this.currentRefreshText = this.refreshText.pulling;
    },

    /**
     * 刷新中止
     */
    onRefresherAbort() {
      this.refreshing = false;
      this.currentRefreshText = this.refreshText.pulling;
    },

    /**
     * 手动触发刷新
     */
    triggerRefresh() {
      if (!this.refreshing && this.canRefresh) {
        this.onPullDownRefresh();
      }
    },

    /**
     * 重置刷新状态
     */
    resetRefresh() {
      this.refreshing = false;
      this.refreshResult = null;
      this.currentRefreshText = this.refreshText.pulling;
    }
  },

  // 页面生命周期 - 原生下拉刷新
  onPullDownRefresh() {
    this.onPullDownRefresh && this.onPullDownRefresh();
  }
};

/**
 * 下拉刷新组合式API - Composition API
 * @param {Object} options - 配置选项
 * @returns {Object} 刷新相关的响应式数据和方法
 */
export function usePullRefresh(options = {}) {
  const {
    onRefresh,
    minInterval = 1000,
    timeout = 10000,
    enabled = true
  } = options;

  // 响应式状态
  const refreshing = ref(false);
  const refreshEnabled = ref(enabled);
  const refreshResult = ref(null);
  const lastRefreshTime = ref(null);
  const currentText = ref('下拉刷新');

  // 刷新文字配置
  const refreshText = {
    pulling: '下拉刷新',
    loosing: '释放刷新',
    loading: '正在刷新...',
    success: '刷新成功',
    failed: '刷新失败'
  };

  // 是否可以刷新
  const canRefresh = computed(() => {
    if (!lastRefreshTime.value) return true;
    return Date.now() - lastRefreshTime.value >= minInterval;
  });

  // 格式化的上次刷新时间
  const lastRefreshTimeFormatted = computed(() => {
    if (!lastRefreshTime.value) return '从未刷新';
    const now = Date.now();
    const diff = now - lastRefreshTime.value;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(lastRefreshTime.value).toLocaleDateString();
  });

  /**
   * 执行刷新
   */
  async function doRefresh() {
    if (refreshing.value || !canRefresh.value || !refreshEnabled.value) {
      return false;
    }

    refreshing.value = true;
    currentText.value = refreshText.loading;
    refreshResult.value = null;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('refresh_timeout')), timeout);
    });

    try {
      const refreshPromise = onRefresh ? onRefresh() : Promise.resolve();
      await Promise.race([refreshPromise, timeoutPromise]);

      refreshResult.value = 'success';
      currentText.value = refreshText.success;
      lastRefreshTime.value = Date.now();

      return true;
    } catch (error) {
      console.error('[usePullRefresh] 刷新失败:', error);
      refreshResult.value = 'failed';
      currentText.value = refreshText.failed;

      if (error.message === 'refresh_timeout') {
        uni.showToast({
          title: '刷新超时，请重试',
          icon: 'none'
        });
      }

      return false;
    } finally {
      setTimeout(() => {
        refreshing.value = false;
        currentText.value = refreshText.pulling;
        uni.stopPullDownRefresh();
      }, 500);
    }
  }

  /**
   * 刷新事件处理器
   */
  function onRefresherRefresh() {
    doRefresh();
  }

  function onRefresherPulling() {
    if (!refreshing.value) {
      currentText.value = refreshText.pulling;
    }
  }

  function onRefresherRestore() {
    currentText.value = refreshText.pulling;
  }

  function onRefresherAbort() {
    refreshing.value = false;
    currentText.value = refreshText.pulling;
  }

  /**
   * 重置状态
   */
  function reset() {
    refreshing.value = false;
    refreshResult.value = null;
    currentText.value = refreshText.pulling;
  }

  /**
   * 设置启用状态
   */
  function setEnabled(value) {
    refreshEnabled.value = value;
  }

  return {
    // 状态
    refreshing,
    refreshEnabled,
    refreshResult,
    lastRefreshTime,
    currentText,
    canRefresh,
    lastRefreshTimeFormatted,

    // 方法
    doRefresh,
    reset,
    setEnabled,

    // 事件处理器
    onRefresherRefresh,
    onRefresherPulling,
    onRefresherRestore,
    onRefresherAbort
  };
}

/**
 * 加载更多混入 - Options API
 */
export const loadMoreMixin = {
  data() {
    return {
      // 加载状态
      loading: false,
      // 是否还有更多数据
      hasMore: true,
      // 当前页码
      currentPage: 1,
      // 每页数量
      pageSize: 20,
      // 加载提示文字
      loadMoreText: {
        loading: '加载中...',
        noMore: '没有更多了',
        error: '加载失败，点击重试'
      },
      // 当前加载状态文字
      currentLoadMoreText: '',
      // 加载错误
      loadError: false
    };
  },

  computed: {
    // 加载状态
    loadStatus() {
      if (this.loading) return 'loading';
      if (this.loadError) return 'error';
      if (!this.hasMore) return 'noMore';
      return 'more';
    }
  },

  methods: {
    /**
     * 触发加载更多
     */
    async onLoadMore() {
      if (this.loading || !this.hasMore) return;

      this.loading = true;
      this.loadError = false;
      this.currentLoadMoreText = this.loadMoreText.loading;

      try {
        // 调用实际的加载方法
        const result = await (this.loadMore
          ? this.loadMore(this.currentPage, this.pageSize)
          : Promise.resolve({ hasMore: false }));

        if (result && typeof result.hasMore !== 'undefined') {
          this.hasMore = result.hasMore;
        }

        if (this.hasMore) {
          this.currentPage++;
        } else {
          this.currentLoadMoreText = this.loadMoreText.noMore;
        }

      } catch (error) {
        console.error('[LoadMore] 加载失败:', error);
        this.loadError = true;
        this.currentLoadMoreText = this.loadMoreText.error;
      } finally {
        this.loading = false;
      }
    },

    /**
     * 重置加载状态
     */
    resetLoadMore() {
      this.loading = false;
      this.hasMore = true;
      this.currentPage = 1;
      this.loadError = false;
      this.currentLoadMoreText = '';
    },

    /**
     * 重试加载
     */
    retryLoad() {
      if (this.loadError) {
        this.loadError = false;
        this.onLoadMore();
      }
    }
  }
};

/**
 * 加载更多组合式API - Composition API
 * @param {Object} options - 配置选项
 * @returns {Object} 加载相关的响应式数据和方法
 */
export function useLoadMore(options = {}) {
  const {
    loadMore,
    pageSize = 20,
    initialPage = 1
  } = options;

  const loading = ref(false);
  const hasMore = ref(true);
  const currentPage = ref(initialPage);
  const loadError = ref(false);
  const currentText = ref('');

  const loadMoreText = {
    loading: '加载中...',
    noMore: '没有更多了',
    error: '加载失败，点击重试'
  };

  const loadStatus = computed(() => {
    if (loading.value) return 'loading';
    if (loadError.value) return 'error';
    if (!hasMore.value) return 'noMore';
    return 'more';
  });

  async function doLoadMore() {
    if (loading.value || !hasMore.value) return false;

    loading.value = true;
    loadError.value = false;
    currentText.value = loadMoreText.loading;

    try {
      const result = await (loadMore ? loadMore(currentPage.value, pageSize) : Promise.resolve({ hasMore: false }));

      if (result && typeof result.hasMore !== 'undefined') {
        hasMore.value = result.hasMore;
      }

      if (hasMore.value) {
        currentPage.value++;
      } else {
        currentText.value = loadMoreText.noMore;
      }

      return true;
    } catch (error) {
      console.error('[useLoadMore] 加载失败:', error);
      loadError.value = true;
      currentText.value = loadMoreText.error;
      return false;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    loading.value = false;
    hasMore.value = true;
    currentPage.value = initialPage;
    loadError.value = false;
    currentText.value = '';
  }

  function retry() {
    if (loadError.value) {
      loadError.value = false;
      doLoadMore();
    }
  }

  return {
    loading,
    hasMore,
    currentPage,
    loadError,
    currentText,
    loadStatus,
    doLoadMore,
    reset,
    retry
  };
}

/**
 * 组合下拉刷新和加载更多
 * @param {Object} options - 配置选项
 * @returns {Object} 组合后的响应式数据和方法
 */
export function useRefreshAndLoadMore(options = {}) {
  const {
    onRefresh,
    onLoadMore,
    pageSize = 20
  } = options;

  const refresh = usePullRefresh({
    onRefresh: async () => {
      // 刷新时重置加载更多状态
      loadMore.reset();
      await onRefresh?.();
    }
  });

  const loadMore = useLoadMore({
    loadMore: onLoadMore,
    pageSize
  });

  return {
    // 刷新相关
    refreshing: refresh.refreshing,
    refreshEnabled: refresh.refreshEnabled,
    refreshResult: refresh.refreshResult,
    lastRefreshTime: refresh.lastRefreshTime,
    refreshText: refresh.currentText,
    canRefresh: refresh.canRefresh,
    doRefresh: refresh.doRefresh,
    resetRefresh: refresh.reset,
    onRefresherRefresh: refresh.onRefresherRefresh,
    onRefresherPulling: refresh.onRefresherPulling,
    onRefresherRestore: refresh.onRefresherRestore,
    onRefresherAbort: refresh.onRefresherAbort,

    // 加载更多相关
    loading: loadMore.loading,
    hasMore: loadMore.hasMore,
    currentPage: loadMore.currentPage,
    loadError: loadMore.loadError,
    loadMoreText: loadMore.currentText,
    loadStatus: loadMore.loadStatus,
    doLoadMore: loadMore.doLoadMore,
    resetLoadMore: loadMore.reset,
    retryLoad: loadMore.retry,

    // 组合方法
    resetAll() {
      refresh.reset();
      loadMore.reset();
    }
  };
}

export default {
  pullRefreshMixin,
  loadMoreMixin,
  usePullRefresh,
  useLoadMore,
  useRefreshAndLoadMore
};
