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

const chooseFileMock = vi.hoisted(() => vi.fn());

vi.mock('@/pages/practice-sub/file-handler.js', () => ({
  fileHandler: {
    chooseFile: chooseFileMock
  },
  FILE_CONFIG: {}
}));

vi.mock('@/services/storageService.js', () => ({
  default: {
    get: vi.fn(() => 'light'),
    save: vi.fn(),
    saveDebounced: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('@/config/home-data.js', () => ({
  QUOTE_LIBRARY: [{ text: 'test quote' }]
}));

import ImportDataPage from '@/pages/practice-sub/import-data.vue';

describe('import-data 文件选择反馈', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('文件选择失败时应给出可见提示且释放锁', async () => {
    chooseFileMock.mockResolvedValue({
      success: false,
      error: { message: '选择失败' }
    });

    const ctx = {
      isPickingFile: false,
      handleUpload: vi.fn()
    };

    await ImportDataPage.methods.chooseFile.call(ctx);

    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '选择失败',
        icon: 'none'
      })
    );
    expect(ctx.handleUpload).not.toHaveBeenCalled();
    expect(ctx.isPickingFile).toBe(false);
  });

  it('文件选择成功时应继续走上传处理', async () => {
    chooseFileMock.mockResolvedValue({
      success: true,
      file: {
        name: 'demo.pdf',
        path: '/tmp/demo.pdf',
        size: 1024,
        ext: 'pdf'
      }
    });

    const ctx = {
      isPickingFile: false,
      handleUpload: vi.fn()
    };

    await ImportDataPage.methods.chooseFile.call(ctx);

    expect(ctx.handleUpload).toHaveBeenCalledTimes(1);
    expect(ctx.handleUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'demo.pdf',
        ext: 'pdf'
      })
    );
    expect(ctx.isPickingFile).toBe(false);
  });
});
