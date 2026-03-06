// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

import { fileHandler } from '@/pages/practice-sub/file-handler.js';

describe('fileHandler 微信隐私授权兜底', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uni.chooseFile = vi.fn();
    global.wx = undefined;
  });

  it('isPrivacyScopeUndeclaredError 可识别 errno=112', () => {
    expect(fileHandler.isPrivacyScopeUndeclaredError({ errno: 112 })).toBe(true);
    expect(
      fileHandler.isPrivacyScopeUndeclaredError({
        errMsg: 'chooseMessageFile:fail api scope is not declared in the privacy agreement'
      })
    ).toBe(true);
    expect(fileHandler.isPrivacyScopeUndeclaredError({ errno: 0, errMsg: 'chooseMessageFile:fail auth deny' })).toBe(
      false
    );
  });

  it('requirePrivacyAuthorize 返回 112 时应提示并返回 privacyScopeMissing', async () => {
    global.wx = {
      chooseMessageFile: vi.fn(),
      requirePrivacyAuthorize: vi.fn(({ fail }) => {
        fail?.({ errno: 112, errMsg: 'privacy agreement missing scope' });
      })
    };

    const result = await fileHandler.chooseFile({ allowedTypes: ['pdf'] });

    expect(result.success).toBe(false);
    expect(result.privacyScopeMissing).toBe(true);
    expect(uni.showModal).toHaveBeenCalledTimes(1);
    expect(global.wx.chooseMessageFile).not.toHaveBeenCalled();
  });

  it('chooseMessageFile 返回 112 时应提示并返回 privacyScopeMissing', async () => {
    global.wx = {
      chooseMessageFile: vi.fn(({ fail }) => {
        fail?.({ errno: 112, errMsg: 'chooseMessageFile:fail api scope is not declared in the privacy agreement' });
      })
    };

    const result = await fileHandler.chooseFile({ allowedTypes: ['pdf'] });

    expect(result.success).toBe(false);
    expect(result.privacyScopeMissing).toBe(true);
    expect(uni.showModal).toHaveBeenCalledTimes(1);
  });

  it('微信 API 不可用时应给出可见提示', async () => {
    global.wx = undefined;
    uni.chooseMessageFile = undefined;

    const result = await fileHandler.chooseFile({ allowedTypes: ['pdf'] });

    expect(result.success).toBe(false);
    expect(String(result.error?.message || '')).toContain('当前环境不支持选择文件');
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '当前环境不支持选择文件',
        icon: 'none'
      })
    );
  });

  it('chooseMessageFile 无回调时应超时返回', async () => {
    vi.useFakeTimers();
    try {
      global.wx = {
        chooseMessageFile: vi.fn(() => {
          // 模拟微信端无 success/fail 回调
        })
      };

      const pending = fileHandler.chooseFile({ allowedTypes: ['pdf'], timeout: 1 });
      await vi.advanceTimersByTimeAsync(3100);
      const result = await pending;

      expect(result.success).toBe(false);
      expect(result.timeout).toBe(true);
      expect(uni.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '文件选择超时，请重试',
          icon: 'none'
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
