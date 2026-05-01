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
    it('getEnv 返回白名单客户端环境变量值', async () => {
      const { getEnv } = await import('@/config/index.js');
      expect(getEnv('VITE_APP_NAME', 'default')).toBe('Exam-Master-Test');
    });

    it('getEnv 不暴露服务端专用 VITE 变量', async () => {
      const { getEnv } = await import('@/config/index.js');
      expect(getEnv('VITE_INVITE_SECRET', 'fallback')).toBe('fallback');
    });

    it('getEnv 不暴露客户端包内不应承载的安全种子', async () => {
      const { getEnv } = await import('@/config/index.js');

      expect(getEnv('VITE_OBFUSCATION_KEY', 'fallback')).toBe('fallback');
      expect(getEnv('VITE_REQUEST_SIGN_SALT', 'fallback')).toBe('fallback');
    });

    it('getEnv 缺失时返回默认值', async () => {
      const { getEnv } = await import('@/config/index.js');
      expect(getEnv('VITE_NONEXISTENT', 'fallback')).toBe('fallback');
    });

    it('getEnvNumber 解析数字', async () => {
      const { getEnvNumber } = await import('@/config/index.js');
      expect(getEnvNumber('VITE_PAGE_SIZE', 0)).toBe(20);
    });

    it('getEnvNumber 缺失时返回默认值', async () => {
      const { getEnvNumber } = await import('@/config/index.js');
      expect(getEnvNumber('VITE_NUM_MISSING', 99)).toBe(99);
    });

    it('getEnvBoolean 解析布尔值', async () => {
      const { getEnvBoolean } = await import('@/config/index.js');
      expect(getEnvBoolean('VITE_DEBUG_MODE', false)).toBe(true);
      expect(getEnvBoolean('VITE_ENABLE_MOCK', true)).toBe(false);
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

    it('客户端深链配置不暴露邀请签名密钥', async () => {
      const { default: config } = await import('@/config/index.js');
      expect(config.deepLink).not.toHaveProperty('inviteSecret');
    });

    it('upload 配置有合理的大小限制', async () => {
      const { default: config } = await import('@/config/index.js');
      expect(config.upload.avatarMaxSize).toBeGreaterThan(0);
      expect(config.upload.fileMaxSize).toBeGreaterThan(config.upload.avatarMaxSize);
      expect(Array.isArray(config.upload.allowedImageTypes)).toBe(true);
    });
  });
});
