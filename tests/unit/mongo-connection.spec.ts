// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
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

describe('独立后端授权 HTTP 的明确限制', () => {
  it('禁止重定向时实际不访问目标；未限制的既有调用仍可以跳转', async () => {
    const shim = await import('../../laf-backend/standalone/cloud-shim');
    let destinationHits = 0;
    const server = createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/destination' });
        res.end('redirect');
      } else {
        destinationHits++;
        res.end(JSON.stringify({ success: true }));
      }
    });
    try {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      expect(
        (await shim.default.fetch({ url: origin + '/redirect', maxRedirects: 0, timeout: 1000, maxContentLength: 64 }))
          .status
      ).toBe(302);
      expect(destinationHits).toBe(0);
      expect((await shim.default.fetch.get(origin + '/redirect', { timeout: 1000 })).data).toEqual({ success: true });
      expect(destinationHits).toBe(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it('实际响应按解压后的字节有界读取，声明/分块超额及迟到正文均终止', async () => {
    const shim = await import('../../laf-backend/standalone/cloud-shim');
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const server = createServer((req, res) => {
      if (req.url === '/declared') {
        res.writeHead(200, { 'Content-Length': '100' });
        res.end('x'.repeat(100));
      } else if (req.url === '/chunks') {
        res.writeHead(200);
        res.write('x'.repeat(32));
        res.end('x'.repeat(33));
      } else if (req.url === '/gzip') {
        const zipped = gzipSync('x'.repeat(1000));
        res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Length': String(zipped.length) });
        res.end(zipped);
      } else if (req.url === '/unicode') {
        res.end('中'.repeat(32));
      } else if (req.url === '/slow') {
        res.writeHead(200);
        res.write('[');
        timers.add(setTimeout(() => res.end(']'), 500));
      } else {
        res.end(JSON.stringify({ message: '中文' }));
      }
    });
    try {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      for (const route of ['/declared', '/chunks', '/gzip', '/unicode']) {
        await expect(shim.default.fetch({ url: origin + route, maxContentLength: 64, timeout: 1000 })).rejects.toThrow(
          'size limit'
        );
      }
      await expect(shim.default.fetch({ url: origin + '/slow', maxContentLength: 64, timeout: 50 })).rejects.toThrow();
      expect((await shim.default.fetch({ url: origin + '/json', maxContentLength: 64, timeout: 1000 })).data).toEqual({
        message: '中文'
      });
      const binary = await shim.default.fetch({
        url: origin + '/json',
        responseType: 'arraybuffer',
        maxContentLength: 64,
        timeout: 1000
      });
      expect(Buffer.isBuffer(binary.data)).toBe(true);
      expect(JSON.parse(binary.data.toString())).toEqual({ message: '中文' });
    } finally {
      for (const timer of timers) clearTimeout(timer);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
