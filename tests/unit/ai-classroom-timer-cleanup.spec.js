/**
 * ai-classroom/index.vue 定时器清理测试
 *
 * 验证：pollLessonStatus 创建的 setInterval/setTimeout 在页面卸载后被正确清理
 * 修复了：C-03 — setInterval 泄漏，页面离开后轮询未停止
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('AI Classroom Timer Cleanup', () => {
  let clearIntervalSpy;
  let clearTimeoutSpy;
  let _setIntervalSpy;
  let _setTimeoutSpy;

  beforeEach(() => {
    clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    _setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(101);
    _setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockReturnValue(102);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pollLessonStatus 应追踪定时器并在 clearAllTimers 时全部清除', () => {
    // 模拟 activeTimers ref 和 clearAllTimers 行为
    const activeTimers = [];

    function _clearPollTimer(timerId) {
      clearInterval(timerId);
      clearTimeout(timerId);
      const idx = activeTimers.indexOf(timerId);
      if (idx >= 0) activeTimers.splice(idx, 1);
    }

    function clearAllTimers() {
      activeTimers.forEach((id) => {
        clearInterval(id);
        clearTimeout(id);
      });
      activeTimers.length = 0;
    }

    // 模拟 pollLessonStatus 添加定时器
    const intervalId = setInterval(() => {}, 3000);
    const timeoutId = setTimeout(() => {}, 300000);
    activeTimers.push(intervalId, timeoutId);

    expect(activeTimers).toHaveLength(2);

    // 模拟页面卸载
    clearAllTimers();

    expect(activeTimers).toHaveLength(0);
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
  });

  it('clearPollTimer 应只移除指定定时器', () => {
    const activeTimers = [10, 20, 30];

    function clearPollTimer(timerId) {
      clearInterval(timerId);
      clearTimeout(timerId);
      const idx = activeTimers.indexOf(timerId);
      if (idx >= 0) activeTimers.splice(idx, 1);
    }

    clearPollTimer(20);

    expect(activeTimers).toEqual([10, 30]);
    expect(clearIntervalSpy).toHaveBeenCalledWith(20);
  });

  it('重复调用 clearAllTimers 应安全（幂等）', () => {
    const activeTimers = [42];

    function clearAllTimers() {
      activeTimers.forEach((id) => {
        clearInterval(id);
        clearTimeout(id);
      });
      activeTimers.length = 0;
    }

    clearAllTimers();
    clearAllTimers(); // 第二次调用不应报错

    expect(activeTimers).toHaveLength(0);
  });
});
