/**
 * 真实模块导入的单元测试
 * T006: 为关键工具函数编写单元测试
 *
 * 覆盖模块：
 * - src/utils/throttle.js (debounce, throttle, clickLock, useDebounceFn, useThrottleFn)
 * - src/utils/safe-navigate.js (safeNavigateTo)
 * - src/utils/config-validator.js (validateConfig, printConfigStatus, getConfigStatusForAnalytics)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// 1. throttle.js 测试
// ============================================================
// 1. throttle.js 测试
// ============================================================
import { debounce, throttle, clickLock, useDebounceFn, useThrottleFn } from '@/utils/throttle.js';

describe('throttle.js', () => {
  beforeEach(() => {
    // 只 fake 定时器核心函数和 Date，排除 requestAnimationFrame/performance，避免 happy-dom 冲突
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('延迟执行函数', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 300);

      debounced('a');
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('a');
    });

    it('多次调用只执行最后一次', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 300);

      debounced('a');
      debounced('b');
      debounced('c');

      vi.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('c');
    });

    it('immediate=true 立即执行第一次', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 300, true);

      debounced('first');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('first');

      // 在延迟期间再次调用不会立即执行
      debounced('second');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('cancel 取消待执行的调用', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 300);

      debounced('a');
      debounced.cancel();

      vi.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
    });

    it('默认延迟为 300ms', () => {
      const fn = vi.fn();
      const debounced = debounce(fn);

      debounced();
      vi.advanceTimersByTime(299);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('固定间隔内只执行一次', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 200);

      throttled(); // 立即执行 (leading)
      expect(fn).toHaveBeenCalledTimes(1);

      throttled(); // 被节流
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(200);
      // trailing 执行
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('leading=false 不立即执行', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 200, { leading: false });

      throttled();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('trailing=false 不执行尾部调用', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 200, { trailing: false });

      throttled(); // leading 执行
      expect(fn).toHaveBeenCalledTimes(1);

      throttled(); // 被节流，且 trailing=false 不会延迟执行
      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('cancel 重置节流状态', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 200);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      throttled.cancel();

      // cancel 后可以立即再次执行
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('默认间隔为 200ms', () => {
      const fn = vi.fn();
      const throttled = throttle(fn);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      throttled();
      vi.advanceTimersByTime(199);
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('clickLock', () => {
    it('防止重复调用', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const locked = clickLock(fn, { lockTime: 1000 });

      await locked(); // 第一次执行
      expect(fn).toHaveBeenCalledTimes(1);

      await locked(); // 被锁定，不执行
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('锁定时间过后可以再次调用', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const locked = clickLock(fn, { lockTime: 500 });

      await locked();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500);

      await locked();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('showToast=true 重复点击时显示提示', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const locked = clickLock(fn, { lockTime: 1000, showToast: true });

      await locked();
      await locked(); // 被锁定

      expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '操作太频繁，请稍后' }));
    });

    it('异步函数抛错后仍然解锁', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const locked = clickLock(fn, { lockTime: 500 });

      await expect(locked()).rejects.toThrow('fail');

      vi.advanceTimersByTime(500);

      fn.mockResolvedValue('ok');
      const result = await locked();
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('返回异步函数的结果', async () => {
      const fn = vi.fn().mockResolvedValue(42);
      const locked = clickLock(fn);

      const result = await locked();
      expect(result).toBe(42);
    });
  });

  describe('useDebounceFn', () => {
    it('返回 exec, isPending, cancel', () => {
      const { exec, isPending, cancel } = useDebounceFn(vi.fn(), 300);
      expect(typeof exec).toBe('function');
      expect(typeof cancel).toBe('function');
      expect(isPending).toBe(false);
    });

    it('exec 延迟执行并返回 Promise', async () => {
      const fn = vi.fn().mockReturnValue('result');
      const { exec } = useDebounceFn(fn, 100);

      const promise = exec('arg1');
      vi.advanceTimersByTime(100);

      const result = await promise;
      expect(fn).toHaveBeenCalledWith('arg1');
      expect(result).toBe('result');
    });

    it('cancel 取消待执行', () => {
      const fn = vi.fn();
      const { exec, cancel } = useDebounceFn(fn, 300);

      exec();
      cancel();

      vi.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('useThrottleFn', () => {
    it('返回 exec 和 cancel', () => {
      const { exec, cancel } = useThrottleFn(vi.fn(), 200);
      expect(typeof exec).toBe('function');
      expect(typeof cancel).toBe('function');
    });

    it('exec 按节流规则执行', () => {
      const fn = vi.fn();
      const { exec } = useThrottleFn(fn, 200);

      exec();
      expect(fn).toHaveBeenCalledTimes(1);

      exec();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================
// 3. safe-navigate.js 测试
// ============================================================
import { safeNavigateTo } from '@/utils/safe-navigate.js';

describe('safe-navigate.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('safeNavigateTo — tabBar 页面', () => {
    it('tabBar 页面使用 switchTab', () => {
      safeNavigateTo('/pages/index/index');
      expect(uni.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
      expect(uni.navigateTo).not.toHaveBeenCalled();
    });

    it('tabBar 页面带查询参数时去掉参数', () => {
      safeNavigateTo('/pages/profile/index?tab=settings');
      expect(uni.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/profile/index' }));
    });

    it('不带前导斜杠的 tabBar 路径也能识别', () => {
      safeNavigateTo('pages/practice/index');
      expect(uni.switchTab).toHaveBeenCalled();
    });

    it('switchTab 成功时调用 success 回调', () => {
      const success = vi.fn();
      safeNavigateTo('/pages/index/index', { success });
      expect(success).toHaveBeenCalled();
    });

    it('switchTab 失败时降级为 reLaunch', () => {
      // 让 switchTab 调用 fail 回调
      uni.switchTab.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'switchTab:fail' });
      });

      safeNavigateTo('/pages/index/index');
      expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
    });

    it('switchTab 失败且有自定义 fail 回调时不降级', () => {
      uni.switchTab.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'switchTab:fail' });
      });

      const customFail = vi.fn();
      safeNavigateTo('/pages/index/index', { fail: customFail });

      expect(customFail).toHaveBeenCalled();
      expect(uni.reLaunch).not.toHaveBeenCalled();
    });
  });

  describe('safeNavigateTo — 普通页面', () => {
    it('普通页面使用 navigateTo', () => {
      safeNavigateTo('/pages/login/index');
      expect(uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index' }));
      expect(uni.switchTab).not.toHaveBeenCalled();
    });

    it('navigateTo 失败时降级为 redirectTo', () => {
      uni.navigateTo.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'navigateTo:fail' });
      });

      safeNavigateTo('/pages/login/index');
      expect(uni.redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index' }));
    });

    it('redirectTo 也失败时显示 toast（非 silent）', () => {
      uni.navigateTo.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'navigateTo:fail' });
      });
      uni.redirectTo.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'redirectTo:fail' });
      });

      safeNavigateTo('/pages/login/index');
      expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '页面跳转失败' }));
    });

    it('silent=true 时不显示 toast', () => {
      uni.navigateTo.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'navigateTo:fail' });
      });
      uni.redirectTo.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'redirectTo:fail' });
      });

      safeNavigateTo('/pages/login/index', { silent: true });
      expect(uni.showToast).not.toHaveBeenCalled();
    });

    it('complete 回调被调用', () => {
      // setup.js 的 mock 默认不调用 complete，需要覆盖
      uni.navigateTo.mockImplementationOnce(({ success, complete }) => {
        success?.();
        complete?.();
      });
      const completeFn = vi.fn();
      safeNavigateTo('/pages/login/index', { complete: completeFn });
      expect(completeFn).toHaveBeenCalled();
    });
  });
});

// config-validator.js 测试已移除（源文件已在死代码清理中删除）
