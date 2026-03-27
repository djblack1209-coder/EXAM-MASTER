/**
 * 真实模块导入的单元测试
 * T006: 为关键工具函数编写单元测试
 *
 * 覆盖模块：
 * - src/utils/core/date.js (getGreetingTime, formatDate, getRemainingTime, getMonthRange, isToday)
 * - src/utils/throttle.js (debounce, throttle, clickLock, useDebounceFn, useThrottleFn)
 * - src/utils/safe-navigate.js (safeNavigateTo)
 * - src/utils/config-validator.js (validateConfig, printConfigStatus, getConfigStatusForAnalytics)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// 1. date.js 测试
// ============================================================
import { getGreetingTime, formatDate, getRemainingTime, getMonthRange, isToday } from '@/utils/core/date.js';

describe('date.js', () => {
  beforeEach(() => {
    // 只 fake Date，不 fake setTimeout/setInterval，避免 happy-dom 内部定时器冲突导致 afterEach 超时
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getGreetingTime', () => {
    it('早上时段返回"早上好"', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 8, 30, 0)); // 8:30 AM
      const result = getGreetingTime();
      expect(result.greetingText).toBe('早上好');
      expect(result.timeDisplay).toBe('8:30 周二');
    });

    it('下午时段返回"下午好"', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 14, 5, 0)); // 2:05 PM
      const result = getGreetingTime();
      expect(result.greetingText).toBe('下午好');
      expect(result.timeDisplay).toBe('14:05 周二');
    });

    it('晚上时段返回"晚上好"', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 20, 0, 0)); // 8:00 PM
      const result = getGreetingTime();
      expect(result.greetingText).toBe('晚上好');
      expect(result.timeDisplay).toBe('20:00 周二');
    });

    it('午夜返回"早上好"', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 0, 0, 0)); // 0:00
      const result = getGreetingTime();
      expect(result.greetingText).toBe('早上好');
    });

    it('正午边界(12:00)返回"下午好"', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 12, 0, 0));
      const result = getGreetingTime();
      expect(result.greetingText).toBe('下午好');
    });

    it('傍晚边界(18:00)返回"晚上好"', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 18, 0, 0));
      const result = getGreetingTime();
      expect(result.greetingText).toBe('晚上好');
    });

    it('周日正确显示', () => {
      vi.setSystemTime(new Date(2026, 1, 8, 10, 0, 0)); // 2026-02-08 是周日
      const result = getGreetingTime();
      expect(result.timeDisplay).toContain('周日');
    });
  });

  describe('formatDate', () => {
    it('默认格式 YYYY-MM-DD HH:mm', () => {
      const date = new Date(2026, 0, 15, 9, 5, 30);
      expect(formatDate(date)).toBe('2026-01-15 09:05');
    });

    it('自定义格式包含秒', () => {
      const date = new Date(2026, 11, 25, 23, 59, 59);
      expect(formatDate(date, 'YYYY/MM/DD HH:mm:ss')).toBe('2026/12/25 23:59:59');
    });

    it('仅日期格式', () => {
      const date = new Date(2026, 5, 1, 0, 0, 0);
      expect(formatDate(date, 'YYYY-MM-DD')).toBe('2026-06-01');
    });

    it('仅时间格式', () => {
      const date = new Date(2026, 0, 1, 8, 3, 7);
      expect(formatDate(date, 'HH:mm:ss')).toBe('08:03:07');
    });

    it('月份和日期补零', () => {
      const date = new Date(2026, 0, 5, 1, 2, 3);
      expect(formatDate(date, 'MM-DD')).toBe('01-05');
    });
  });

  describe('getRemainingTime', () => {
    it('计算正确的剩余时间', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 0, 0, 0));
      // 目标: 2026-02-12 12:30:45 — 距离 2天12小时30分45秒
      const target = new Date(2026, 1, 12, 12, 30, 45);
      const result = getRemainingTime(target);
      expect(result.days).toBe(2);
      expect(result.hours).toBe(12);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBe(45);
    });

    it('目标已过期返回全零', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 12, 0, 0));
      const past = new Date(2026, 1, 9, 0, 0, 0);
      const result = getRemainingTime(past);
      expect(result).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    });

    it('接受字符串日期', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 0, 0, 0));
      const result = getRemainingTime('2026-02-11T00:00:00');
      expect(result.days).toBe(1);
      expect(result.hours).toBe(0);
    });
  });

  describe('getMonthRange', () => {
    it('返回当月第一天和最后一天', () => {
      vi.setSystemTime(new Date(2026, 1, 15)); // 2月
      const { firstDay, lastDay } = getMonthRange();
      expect(firstDay.getDate()).toBe(1);
      expect(firstDay.getMonth()).toBe(1);
      expect(lastDay.getDate()).toBe(28); // 2026年2月非闰年
      expect(lastDay.getMonth()).toBe(1);
    });

    it('闰年2月有29天', () => {
      vi.setSystemTime(new Date(2028, 1, 10)); // 2028是闰年
      const { lastDay } = getMonthRange();
      expect(lastDay.getDate()).toBe(29);
    });

    it('31天的月份', () => {
      vi.setSystemTime(new Date(2026, 0, 20)); // 1月
      const { lastDay } = getMonthRange();
      expect(lastDay.getDate()).toBe(31);
    });
  });

  describe('isToday', () => {
    it('今天的日期返回 true', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 15, 0, 0));
      expect(isToday(new Date(2026, 1, 10, 8, 0, 0))).toBe(true);
    });

    it('昨天的日期返回 false', () => {
      vi.setSystemTime(new Date(2026, 1, 10));
      expect(isToday(new Date(2026, 1, 9))).toBe(false);
    });

    it('接受字符串日期', () => {
      vi.setSystemTime(new Date(2026, 1, 10, 12, 0, 0));
      expect(isToday('2026-02-10')).toBe(true);
    });
  });
});

// ============================================================
// 2. throttle.js 测试
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
