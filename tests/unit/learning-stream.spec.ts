import { captureSession } from '@/services/auth-storage.js';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createEventStreamParser,
  createUtf8StreamDecoder,
  learningMessagePreview,
  redactModelValue
} from '../../laf-backend/functions/_shared/learning-stream-codec.js';
import {
  buildLearningRequest,
  createLearningProviderStream,
  type ModelConfig
} from '../../laf-backend/functions/_shared/ai-providers/learning-provider.js';
import { createLearningStreamConsumer, generateLearningTurnStream } from '@/services/learning/learning-stream.js';
const model: ModelConfig = {
  id: 'fixture',
  provider: 'isolated',
  model: 'explicit',
  endpoint: 'https://provider.example/chat',
  source: 'byok',
  apiKey: 'fixture-only-key',
  maxOutput: 100,
  capabilities: { structured: true, stream: true, vision: false, tools: false }
};
const upstream = (content: string, finish = 'stop', includeDone = true) =>
  `data: ${JSON.stringify({ model: 'explicit', choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ model: 'explicit', choices: [{ index: 0, delta: {}, finish_reason: finish }] })}\n\ndata: ${JSON.stringify({ model: 'explicit', choices: [], usage: { prompt_tokens: 3, completion_tokens: 4 } })}\n\n${includeDone ? 'data: [DONE]\n\n' : ''}`;
const body = {
  requestId: 'request',
  modelId: 'fixture',
  requestBinding: 'fixture_binding',
  learningContext: { owner: 'stream-owner' }
};
const event = (name: string, id: number, value: any) => `event: ${name}\nid: ${id}\ndata: ${JSON.stringify(value)}\n\n`;
const start = () =>
  event('start', 1, { version: 1, requestId: body.requestId, modelId: body.modelId, model: 'explicit' });
const result = () =>
  event('result', 3, {
    success: true,
    data: {
      requestId: 'request',
      requestBinding: 'fixture_binding',
      modelId: 'fixture',
      model: 'explicit',
      message: '最终教学',
      tools: []
    }
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  uni.clearStorageSync();
});
describe('有界 UTF8/SSE 与独立完成收据', () => {
  it('逐字节拆开中文、emoji、BOM、CRLF及多行事件仍按原文解码', () => {
    const bytes = new TextEncoder().encode('\uFEFF:心跳\r\nevent: preview\rid: 1\rdata: 中😀\rdata: 第二行\r\r');
    const decoder = createUtf8StreamDecoder(),
      events: any[] = [],
      parser = createEventStreamParser((e) => events.push(e));
    for (const byte of bytes) parser.feed(decoder.feed(Uint8Array.of(byte)));
    decoder.end();
    parser.end();
    expect(events).toEqual([{ event: 'preview', id: '1', data: '中😀\n第二行' }]);
  });
  it.each([
    [0xc0, 0xaf],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0xe4, 0x61]
  ])('非法 UTF8 %j 不得进入预览', (...bytes) => {
    expect(() => createUtf8StreamDecoder().feed(Uint8Array.from(bytes))).toThrow('UTF-8');
  });
  it('半个编码、无空行事件、字节容量和事件次数都不能伪装完成', () => {
    const decoder = createUtf8StreamDecoder();
    decoder.feed(Uint8Array.of(0xe4));
    expect(() => decoder.end()).toThrow('未完整');
    const parser = createEventStreamParser(() => {
      /* fixture */
    });
    parser.feed('data: unfinished\n');
    expect(() => parser.end()).toThrow('未完整');
    expect(() => createUtf8StreamDecoder(1).feed(Uint8Array.of(65, 66))).toThrow('容量');
    expect(() =>
      createEventStreamParser(
        () => {
          /* fixture */
        },
        { maxEvents: 1 }
      ).feed('data: a\n\ndata: b\n\n')
    ).toThrow('过多');
    expect(() => createUtf8StreamDecoder().feed('untrusted' as any)).toThrow('字节');
  });
  it('每个可能切分点都不回显跨段密钥或工具、内部推理，成功宣称被改写', () => {
    const raw = JSON.stringify({
      message: '讲解内容 fixture-only-key 已经调整计划，然后继续说明学习过程',
      tools: [{ name: 'hidden-secret-tool' }],
      reasoning: 'INTERNAL_REASONING'
    });
    for (let i = 0; i <= raw.length; i++) {
      const preview = learningMessagePreview(raw.slice(0, i), model.apiKey);
      expect(preview).not.toContain(model.apiKey);
      expect(preview).not.toContain('已经调整计划');
      expect(preview).not.toContain('hidden-secret-tool');
      expect(preview).not.toContain('INTERNAL_REASONING');
    }
    const encoded = [...model.apiKey!].map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
    expect(JSON.stringify(redactModelValue({ echo: encoded }, model.apiKey))).not.toContain(encoded);
    expect(learningMessagePreview('{"tools":[],"message":"no preview"}', model.apiKey)).toBe('');
    expect(() => learningMessagePreview(JSON.stringify({ message: '已经调整计划'.repeat(900) }))).toThrow('容量');
  });
  it('仅完整 stop+DONE 升级输出；截断仍保留真实用量且不执行工具', () => {
    const parser = createLearningProviderStream(model);
    const stream = upstream('{"message":"讲解","tools":[]}');
    for (const char of stream) parser.feed(char);
    expect(parser.end()).toMatchObject({
      actualModel: 'explicit',
      usageComplete: true,
      usage: { prompt_tokens: 3, completion_tokens: 4 }
    });
    const truncated = createLearningProviderStream(model);
    truncated.feed(upstream('{"message":"half', 'length'));
    expect(() => truncated.end()).toThrow('截断');
    expect(truncated.observed().usageComplete).toBe(true);
    const lost = createLearningProviderStream(model);
    lost.feed(upstream('lost', 'stop', false));
    expect(() => lost.end()).toThrow('完整');
    expect(lost.observed().usageComplete).toBe(false);
  });
  it('模型错配、原生工具、结束后追加和错误结构不能进入最终结果', () => {
    for (const value of [
      { model: 'other', choices: [] },
      { model: 'explicit', choices: [{ index: 0, delta: { tool_calls: [{ name: 'shell' }] } }] },
      { model: 'explicit', choices: 'invalid' }
    ])
      expect(() => createLearningProviderStream(model).feed(`data: ${JSON.stringify(value)}\n\n`)).toThrow();
    const parser = createLearningProviderStream(model);
    parser.feed(upstream('text'));
    expect(() => parser.feed('data: {}\n\n')).toThrow('结束后');
    expect(buildLearningRequest(model, [], true)).toMatchObject({
      stream: true,
      stream_options: { include_usage: true }
    });
    expect(buildLearningRequest(model, [])).not.toHaveProperty('stream_options');
  });
  it('客户端只在 EOF 后返回最终结果，拒绝失序、重复和绑定错误', () => {
    const preview = vi.fn(),
      consumer = createLearningStreamConsumer(body, { expectedModel: 'explicit', onPreview: preview });
    consumer.feed(start() + event('preview', 2, { text: '已经加入错题', provisional: true }));
    expect(preview).toHaveBeenCalledWith('提出了相关建议（以实际记录为准）');
    expect(() => consumer.end()).toThrow('中断');
    consumer.feed(result());
    expect(consumer.end().success).toBe(true);
    expect(() => consumer.feed(result())).toThrow('结束后');
    const other = createLearningStreamConsumer(body);
    expect(() => other.feed(start().replace('request', 'other'))).toThrow('绑定');
    const reordered = createLearningStreamConsumer(body);
    expect(() => reordered.feed(event('start', 2, { version: 1 }))).toThrow('失序');
  });
});
describe('实际客户端适配，不自动重试消费', () => {
  function auth() {
    uni.setStorageSync('EXAM_USER_ID', 'stream-owner');
    uni.setStorageSync('EXAM_TOKEN', 'test-only-token');
  }
  it('H5 逐字节读取最终教学，无效 EOF 不触发普通请求回退', async () => {
    auth();
    const content = start() + event('preview', 2, { text: '中文😀', provisional: true }) + result();
    const bytes = new TextEncoder().encode(content);
    let offset = 0;
    const fetch = vi.fn(async () => ({
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: {
        getReader: () => ({
          read: async () =>
            offset < bytes.length ? { value: bytes.slice(offset, ++offset), done: false } : { done: true },
          cancel: vi.fn(),
          releaseLock: vi.fn()
        })
      }
    }));
    vi.stubGlobal('fetch', fetch);
    const preview = vi.fn();
    expect(
      (
        await generateLearningTurnStream(body, {
          session: captureSession(),
          platform: 'h5',
          expectedModel: 'explicit',
          onPreview: preview
        })
      ).success
    ).toBe(true);
    expect(preview).toHaveBeenCalledWith('中文😀');
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][1].redirect).toBe('error');
    offset = 0;
    bytes.fill(32);
    const failed = await generateLearningTurnStream(body, { session: captureSession(), platform: 'h5' });
    expect(failed.success).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('预先取消或账户错配不发送 HTTP，期间切换账户拒绝后续片段', async () => {
    auth();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController();
    signal.abort();
    expect(
      (await generateLearningTurnStream(body, { session: captureSession(), platform: 'h5', signal: signal.signal }))
        .code
    ).toBe(499);
    uni.setStorageSync('EXAM_USER_ID', 'other-owner');
    expect((await generateLearningTurnStream(body, { session: captureSession(), platform: 'h5' })).error).toBe(
      'OWNER_MISMATCH'
    );
    expect(fetch).not.toHaveBeenCalled();
    auth();
    fetch.mockImplementation(async () => {
      uni.setStorageSync('EXAM_USER_ID', 'other-owner');
      return {};
    });
    expect((await generateLearningTurnStream(body, { session: captureSession(), platform: 'h5' })).error).toBe(
      'CONTEXT_CHANGED'
    );
  });
  it('微信原生分块和 JSON 拒绝均有收据；缺基础库接口停止接收', async () => {
    auth();
    let options: any, chunks: any, headers: any;
    const task = {
      abort: vi.fn(),
      onChunkReceived: (cb: any) => (chunks = cb),
      onHeadersReceived: (cb: any) => (headers = cb)
    };
    const request = vi.fn((o) => {
      options = o;
      return task;
    });
    vi.stubGlobal('wx', { request });
    const promise = generateLearningTurnStream(body, { session: captureSession(), platform: 'weixin' });
    headers({ header: { 'Content-Type': 'text/event-stream' } });
    const bytes = new TextEncoder().encode(
      start() + event('preview', 2, { text: '微信😀', provisional: true }) + result()
    );
    for (const byte of bytes) chunks({ data: Uint8Array.of(byte).buffer });
    options.success({ data: new ArrayBuffer(0) });
    expect((await promise).success).toBe(true);
    expect(options.enableChunked).toBe(true);
    const error = generateLearningTurnStream(body, { session: captureSession(), platform: 'weixin' });
    headers({ header: { 'content-type': 'application/json' } });
    chunks({ data: new TextEncoder().encode('{"success":false,"code":422,"message":"未开放"}').buffer });
    options.success({});
    expect(await error).toMatchObject({ success: false, code: 422 });
    request.mockReturnValue({ abort: task.abort } as any);
    expect((await generateLearningTurnStream(body, { session: captureSession(), platform: 'weixin' })).error).toBe(
      'STREAM_TRANSPORT_UNAVAILABLE'
    );
    expect(task.abort).toHaveBeenCalled();
  });
});
