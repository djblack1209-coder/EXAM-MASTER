/**
 * config/index.js 单元测试
 * T006: 配置模块测试覆盖
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

describe('config/index.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEnv / getEnvNumber / getEnvBoolean', () => {
    it('getEnv 返回环境变量值', async () => {
      import.meta.env.VITE_TEST_KEY = 'test_value';
      const { getEnv } = await import('@/config/index.js');
      expect(getEnv('VITE_TEST_KEY', 'default')).toBe('test_value');
      delete import.meta.env.VITE_TEST_KEY;
    });

    it('getEnv 缺失时返回默认值', async () => {
      delete import.meta.env.VITE_NONEXISTENT;
      const { getEnv } = await import('@/config/index.js');
      expect(getEnv('VITE_NONEXISTENT', 'fallback')).toBe('fallback');
    });

    it('getEnvNumber 解析数字', async () => {
      import.meta.env.VITE_NUM_TEST = '42';
      const { getEnvNumber } = await import('@/config/index.js');
      expect(getEnvNumber('VITE_NUM_TEST', 0)).toBe(42);
      delete import.meta.env.VITE_NUM_TEST;
    });

    it('getEnvNumber 非数字返回默认值', async () => {
      import.meta.env.VITE_NUM_BAD = 'abc';
      const { getEnvNumber } = await import('@/config/index.js');
      expect(getEnvNumber('VITE_NUM_BAD', 99)).toBe(99);
      delete import.meta.env.VITE_NUM_BAD;
    });

    it('getEnvBoolean 解析布尔值', async () => {
      import.meta.env.VITE_BOOL_TRUE = 'true';
      import.meta.env.VITE_BOOL_ONE = '1';
      import.meta.env.VITE_BOOL_FALSE = 'false';
      const { getEnvBoolean } = await import('@/config/index.js');
      expect(getEnvBoolean('VITE_BOOL_TRUE', false)).toBe(true);
      expect(getEnvBoolean('VITE_BOOL_ONE', false)).toBe(true);
      expect(getEnvBoolean('VITE_BOOL_FALSE', true)).toBe(false);
      delete import.meta.env.VITE_BOOL_TRUE;
      delete import.meta.env.VITE_BOOL_ONE;
      delete import.meta.env.VITE_BOOL_FALSE;
    });
  });

  describe('config 结构完整性', () => {
    it('包含所有必要的顶级配置节', async () => {
      const { default: config } = await import('@/config/index.js');
      const requiredKeys = [
        'env', 'isDev', 'isProd', 'wx', 'qq', 'api', 'ai',
        'app', 'storage', 'upload', 'features', 'debug',
        'audit', 'monitor', 'cdn', 'websocket', 'deepLink',
        'network', 'retry', '_source'
      ];
      requiredKeys.forEach((key) => {
        expect(config).toHaveProperty(key);
      });
    });

    it('api 配置有 baseUrl 和 timeout', async () => {
      const { default: config } = await import('@/config/index.js');
      expect(config.api).toHaveProperty('baseUrl');
      expect(config.api).toHaveProperty('timeout');
      expect(typeof config.api.timeout).toBe('number');
    });

    it('retry 配置有正确结构', async () => {
      const { default: config } = await import('@/config/index.js');
      expect(config.retry.maxRetries).toBeGreaterThanOrEqual(1);
      expect(config.retry.retryDelay).toBeGreaterThan(0);
      expect(Array.isArray(config.retry.retryableStatusCodes)).toBe(true);
    });

    it('websocket 配置有 devUrl 和 prodUrl', async () => {
      const { default: config } = await import('@/config/index.js');
      expect(config.websocket.devUrl).toContain('ws');
      expect(config.websocket.prodUrl).toContain('ws');
      expect(config.websocket.maxReconnect).toBeGreaterThan(0);
    });

    it('upload 配置有合理的大小限制', async () => {
      const { default: config } = await import('@/config/index.js');
      expect(config.upload.avatarMaxSize).toBeGreaterThan(0);
      expect(config.upload.fileMaxSize).toBeGreaterThan(config.upload.avatarMaxSize);
      expect(Array.isArray(config.upload.allowedImageTypes)).toBe(true);
    });
  });
});
