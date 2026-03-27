/**
 * 防抖与节流工具函数
 * 用于防止按钮狂点、重复提交等场景
 */

/**
 * 防抖函数 - 延迟执行，多次触发只执行最后一次
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @param {boolean} immediate - 是否立即执行第一次
 * @returns {Function} 防抖后的函数
 *
 * @example
 * const debouncedSearch = debounce((keyword) => {
 *   console.log('搜索:', keyword)
 * }, 300)
 */
import { toast } from '@/utils/toast.js';
export function debounce(fn, delay = 300, immediate = false) {
  let timer = null;
  let isInvoked = false;

  const debounced = function (...args) {
    const context = this;

    if (timer) {
      clearTimeout(timer);
    }

    if (immediate && !isInvoked) {
      fn.apply(context, args);
      isInvoked = true;
    }

    timer = setTimeout(() => {
      if (!immediate) {
        fn.apply(context, args);
      }
      isInvoked = false;
      timer = null;
    }, delay);
  };

  // 取消防抖
  debounced.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    isInvoked = false;
  };

  return debounced;
}

/**
 * 节流函数 - 固定时间间隔内只执行一次
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 时间间隔（毫秒）
 * @param {Object} options - 配置选项
 * @param {boolean} options.leading - 是否在开始时执行，默认 true
 * @param {boolean} options.trailing - 是否在结束时执行，默认 true
 * @returns {Function} 节流后的函数
 *
 * @example
 * const throttledScroll = throttle(() => {
 *   console.log('滚动处理')
 * }, 200)
 */
export function throttle(fn, interval = 200, options = {}) {
  const { leading = true, trailing = true } = options;
  let lastTime = 0;
  let timer = null;

  const throttled = function (...args) {
    const context = this;
    const now = Date.now();

    // 第一次调用且不需要立即执行
    if (!lastTime && !leading) {
      lastTime = now;
    }

    const remaining = interval - (now - lastTime);

    if (remaining <= 0 || remaining > interval) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      fn.apply(context, args);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        lastTime = leading ? Date.now() : 0;
        timer = null;
        fn.apply(context, args);
      }, remaining);
    }
  };

  // 取消节流
  throttled.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastTime = 0;
  };

  return throttled;
}

/**
 * 按钮防重复点击锁
 * 适用于提交按钮等需要防止重复点击的场景
 * @param {Function} fn - 要执行的异步函数
 * @param {Object} options - 配置选项
 * @param {number} options.lockTime - 锁定时间（毫秒），默认 1000
 * @param {boolean} options.showToast - 重复点击时是否显示提示，默认 false
 * @returns {Function} 带锁的函数
 *
 * @example
 * const handleSubmit = clickLock(async () => {
 *   await submitForm()
 * }, { lockTime: 2000 })
 */
export function clickLock(fn, options = {}) {
  const { lockTime = 1000, showToast = false } = options;
  let isLocked = false;
  let __lockTimer = null;

  return async function (...args) {
    if (isLocked) {
      if (showToast) {
        toast.info('操作太频繁，请稍后', 1500);
      }
      return;
    }

    isLocked = true;

    try {
      const result = await fn.apply(this, args);
      return result;
    } finally {
      // 使用定时器确保锁定时间
      __lockTimer = setTimeout(() => {
        isLocked = false;
        __lockTimer = null;
      }, lockTime);
    }
  };
}

/**
 * 创建带状态的防抖函数（适用于 Vue 组件）
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间
 * @returns {Object} { exec: Function, isPending: Ref<boolean>, cancel: Function }
 *
 * @example
 * // 在 setup 中使用
 * const { exec: debouncedSearch, isPending } = useDebounceFn(search, 300)
 */
export function useDebounceFn(fn, delay = 300) {
  let timer = null;
  let isPending = false;

  const exec = function (...args) {
    isPending = true;

    if (timer) {
      clearTimeout(timer);
    }

    return new Promise((resolve) => {
      timer = setTimeout(async () => {
        try {
          const result = await fn.apply(this, args);
          resolve(result);
        } finally {
          isPending = false;
          timer = null;
        }
      }, delay);
    });
  };

  const cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    isPending = false;
  };

  return { exec, isPending, cancel };
}

/**
 * 创建带状态的节流函数（适用于 Vue 组件）
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 时间间隔
 * @returns {Object} { exec: Function, cancel: Function }
 */
export function useThrottleFn(fn, interval = 200) {
  const throttled = throttle(fn, interval);

  return {
    exec: throttled,
    cancel: throttled.cancel
  };
}

export default {
  debounce,
  throttle,
  clickLock,
  useDebounceFn,
  useThrottleFn
};
