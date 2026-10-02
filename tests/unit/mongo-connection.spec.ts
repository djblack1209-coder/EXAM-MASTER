import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const { MongoClient } = createRequire(resolve('laf-backend/standalone/package.json'))('mongodb');

// 与standalone解析同一份驱动，拦截原型；不让默认单测实际连接任何Mongo。
let connect: ReturnType<typeof vi.spyOn>;
let close: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetModules();
  connect = vi.spyOn(MongoClient.prototype, 'connect').mockImplementation(async function () {
    return this;
  });
  close = vi.spyOn(MongoClient.prototype, 'close').mockResolvedValue(undefined);
  vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27189/exam_learning_isolated');
  vi.stubEnv('DB_NAME', 'exam_learning_isolated');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('独立后端首次Mongo连接生命周期', () => {
  it('并发首次访问共用一个连接，关闭等待初始化并释放全部连接', async () => {
    let connected!: () => void;
    connect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          connected = resolve;
        })
    );
    const shim = await import('../../laf-backend/standalone/cloud-shim');
    const first = shim.getDb();
    const second = shim.getDb();
    const closed = shim.closeDb();
    expect(connect).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    connected();
    const [a, b] = await Promise.all([first, second, closed]);
    expect(a).toBe(b);
    expect(close).toHaveBeenCalledOnce();
    expect(await shim.getDb()).not.toBe(a);
    expect(connect).toHaveBeenCalledTimes(2);
    await shim.closeDb();
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('连接失败清理临时客户端，后续请求可以重连而不是复用永久拒绝的Promise', async () => {
    connect.mockRejectedValueOnce(new Error('TEST_ONLY_connection_failed'));
    const shim = await import('../../laf-backend/standalone/cloud-shim');
    await expect(shim.getDb()).rejects.toThrow('TEST_ONLY_connection_failed');
    expect(close).toHaveBeenCalledOnce();
    await shim.getDb();
    expect(connect).toHaveBeenCalledTimes(2);
    await shim.closeDb();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
