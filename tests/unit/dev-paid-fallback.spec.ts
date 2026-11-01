import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../laf-backend/functions/_shared/build-channel', () => ({ DEV_TEST: true }));

const KEY = 'synthetic-paid-key-secret';
const { callWithDevPaidFallback, DEV_PAID_FALLBACK_FILE } =
  await import('../../laf-backend/functions/_shared/ai-providers/dev-paid-fallback');
const { ProviderError, buildLearningRequest } =
  await import('../../laf-backend/functions/_shared/ai-providers/learning-provider');

const free = {
  id: 'free',
  provider: 'Agnes',
  model: 'agnes-3.0-flash',
  endpoint: 'https://apihub.agnes-ai.com/v1/chat/completions',
  apiKey: 'synthetic-free-key',
  source: 'byok',
  capabilities: { structured: true, tools: true, vision: false, stream: true },
  maxOutput: 2000,
  writingOutput: {
    contract: 'writing-feedback-v1',
    inferencePolicy: 'groq-writing-strict-v1',
    reasoningEffort: 'high',
    schemaDigest: 'digest',
    schema: { type: 'object', required: ['reply'], properties: { reply: { type: 'string' } } }
  }
} as any;
const messages = [
  { role: 'system', content: '你是写作教练。' },
  { role: 'user', content: '请点评。' }
];

describe('development paid fallback', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yozi-paid-'));
    const file = path.join(dir, 'paid.env');
    fs.writeFileSync(file, `DEEPSEEK_API_KEY=${KEY}\n`, { mode: 0o600 });
    vi.stubEnv(DEV_PAID_FALLBACK_FILE, file);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const limited = () => Promise.reject(new ProviderError('RATE_LIMITED', '模型服务未成功返回'));

  it('answers with the free model when it succeeds', async () => {
    const call = vi.fn(async () => 'free answer');
    const result = await callWithDevPaidFallback(call, free, messages, ['https://apihub.agnes-ai.com'], {
      enabled: true,
      stream: false
    });
    expect(result).toEqual({ response: 'free answer', model: free, paidFallback: null });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('switches a rate-limited request to DeepSeek with the same contract', async () => {
    const call = vi.fn().mockImplementationOnce(limited).mockResolvedValueOnce('paid answer');
    const result = await callWithDevPaidFallback(call, free, messages, ['https://apihub.agnes-ai.com'], {
      enabled: true,
      stream: true
    });
    expect(result.paidFallback).toEqual({
      trigger: 'RATE_LIMITED',
      freeModel: 'agnes-3.0-flash',
      model: 'deepseek-flash'
    });
    const [target, targetMessages, origins] = call.mock.calls[1];
    expect(target).toMatchObject({
      model: 'deepseek-flash',
      endpoint: 'https://api.deepseek.com/chat/completions',
      apiKey: KEY,
      writingOutput: { format: 'json_object', inferencePolicy: 'groq-writing-strict-v1' }
    });
    expect(target.writingOutput.reasoningEffort).toBeUndefined();
    expect(targetMessages[0].content).toContain('"required":["reply"]');
    expect(targetMessages).toHaveLength(2);
    expect(origins).toEqual(['https://apihub.agnes-ai.com', 'https://api.deepseek.com']);
    const wire = buildLearningRequest(target, targetMessages, false) as any;
    expect(wire).toMatchObject({
      model: 'deepseek-flash',
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' }
    });
    expect(wire.reasoning_effort).toBeUndefined();
    expect(JSON.stringify(console.info.mock.calls)).not.toContain(KEY);
  });

  it('keeps native coach tools as tools', async () => {
    const coach = { ...free, writingOutput: { ...free.writingOutput, inferencePolicy: 'native-coach-tools-v1' } };
    const call = vi.fn().mockImplementationOnce(limited).mockResolvedValueOnce('paid answer');
    await callWithDevPaidFallback(call, coach, messages, [], { enabled: true, stream: false });
    const [target, targetMessages] = call.mock.calls[1];
    expect(target.writingOutput.format).toBeUndefined();
    expect(targetMessages).toEqual(messages);
    expect(buildLearningRequest(target, targetMessages, false)).toMatchObject({
      tools: [{ function: { name: 'yozi_coach_response', strict: true } }]
    });
  });

  it('switches an empty non-stream answer but never a stream that may have shown text', async () => {
    const empty = () => Promise.reject(new ProviderError('INVALID_RESPONSE', '模型没有返回有效内容'));
    const call = vi.fn().mockImplementationOnce(empty).mockResolvedValueOnce('paid answer');
    expect(
      (await callWithDevPaidFallback(call, free, messages, [], { enabled: true, stream: false })).paidFallback?.trigger
    ).toBe('EMPTY_RESPONSE');
    await expect(
      callWithDevPaidFallback(vi.fn(empty), free, messages, [], { enabled: true, stream: true })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([
    ['capability probe', { enabled: false }, messages],
    ['image input', {}, [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:,' } }] }]],
    ['other failure', { code: 'KEY_REJECTED' }, messages]
  ])('keeps the original error for %s', async (_name, change: any, input: any) => {
    const call = vi.fn(() => Promise.reject(new ProviderError(change.code || 'RATE_LIMITED', '原错误')));
    await expect(
      callWithDevPaidFallback(call, free, input, [], { enabled: change.enabled ?? true, stream: false })
    ).rejects.toThrow('原错误');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('stays off with a loose or missing key file', async () => {
    fs.chmodSync(process.env[DEV_PAID_FALLBACK_FILE]!, 0o644);
    const call = vi.fn(limited);
    await expect(
      callWithDevPaidFallback(call, free, messages, [], { enabled: true, stream: false })
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED'
    });
    vi.stubEnv(DEV_PAID_FALLBACK_FILE, '');
    await expect(
      callWithDevPaidFallback(call, free, messages, [], { enabled: true, stream: false })
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED'
    });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('labels a failed fallback without exposing the key', async () => {
    const call = vi
      .fn()
      .mockImplementationOnce(limited)
      .mockImplementationOnce(() => Promise.reject(new ProviderError('UPSTREAM_FAILED', '模型服务未成功返回')));
    const failure = await callWithDevPaidFallback(call, free, messages, [], { enabled: true, stream: false }).catch(
      (error) => error
    );
    expect(failure.message).toBe('DeepSeek 兜底未完成：模型服务未成功返回');
    expect(failure.message).not.toContain(KEY);
  });
});
