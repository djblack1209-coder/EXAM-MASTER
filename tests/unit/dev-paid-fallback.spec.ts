import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../laf-backend/functions/_shared/build-channel', () => ({ DEV_TEST: true }));

const KEY = 'synthetic-paid-key-secret';
const { callWithDevPaidFallback, DEV_PAID_FALLBACK_FILE } =
  await import('../../laf-backend/functions/_shared/ai-providers/dev-paid-fallback');
const { ProviderError, buildLearningRequest, readCoachFunctionResponse } =
  await import('../../laf-backend/functions/_shared/ai-providers/learning-provider');
const { newAccount, reserveCall, settleCall, latestRepair } =
  await import('../../laf-backend/functions/_shared/learning-account');

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
      id: 'dev-paid-fallback-deepseek',
      devPaidFallback: true,
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

  it('keeps native coach tools as tools and the capability evidence that gates calibration', async () => {
    const capabilityCheck = { version: 1, tools: true, structured: true, checkedAt: 1 };
    const coach = {
      ...free,
      capabilityCheck,
      writingOutput: { ...free.writingOutput, inferencePolicy: 'native-coach-tools-v1' }
    };
    const call = vi.fn().mockImplementationOnce(limited).mockResolvedValueOnce('paid answer');
    await callWithDevPaidFallback(call, coach, messages, [], { enabled: true, stream: false });
    const [target, targetMessages] = call.mock.calls[1];
    expect(target.capabilityCheck).toEqual(capabilityCheck);
    expect(target.writingOutput.format).toBeUndefined();
    expect(targetMessages).toEqual(messages);
    const wire = buildLearningRequest(target, targetMessages, false) as any;
    expect(wire).toMatchObject({
      tools: [{ function: { name: 'yozi_coach_response', parameters: coach.writingOutput.schema } }],
      tool_choice: { type: 'function', function: { name: 'yozi_coach_response' } },
      thinking: { type: 'disabled' }
    });
    expect(wire.tools[0].function.strict).toBeUndefined();
  });

  it('uses DeepSeek thinking-compatible tools without changing the endpoint or host validation', () => {
    const coach = {
      ...free,
      model: 'deepseek-v4-pro',
      endpoint: 'https://api.deepseek.com/chat/completions',
      writingOutput: { ...free.writingOutput, inferencePolicy: 'native-coach-tools-v1' }
    } as any;
    const wire = buildLearningRequest(coach, messages, false) as any;
    expect(wire.tool_choice).toBe('auto');
    expect(wire.thinking).toBeUndefined();
    expect(wire.tools[0].function.strict).toBeUndefined();
    expect(wire.tools[0].function.parameters).toEqual(coach.writingOutput.schema);
    expect(coach.endpoint).toBe('https://api.deepseek.com/chat/completions');
    expect(() =>
      readCoachFunctionResponse(coach, {
        choices: [{ finish_reason: 'stop', message: { content: '{"reply":"unverified prose"}' } }]
      })
    ).toThrow(expect.objectContaining({ code: 'COACH_INVALID' }));
    const response = {
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            content: null,
            tool_calls: [
              {
                type: 'function',
                function: { name: 'yozi_coach_response', arguments: '{"reply":"checked next"}' }
              }
            ]
          }
        }
      ]
    };
    expect(readCoachFunctionResponse(coach, response)).toBe('{"reply":"checked next"}');
    response.choices[0].message.tool_calls.push(response.choices[0].message.tool_calls[0]);
    expect(() => readCoachFunctionResponse(coach, response)).toThrow(
      expect.objectContaining({ code: 'COACH_INVALID' })
    );
    const beta = buildLearningRequest(
      { ...coach, endpoint: 'https://api.deepseek.com/beta/chat/completions' },
      messages
    ) as any;
    expect(beta.tool_choice).toBe('auto');
    expect(beta.tools[0].function.strict).toBe(true);
    const probe = buildLearningRequest(
      { ...coach, capabilityProbe: { stage: 'tool', nonce: 'nonce' } },
      messages
    ) as any;
    expect(probe.tool_choice).toBe('auto');
    const jsonProbe = buildLearningRequest(
      { ...coach, capabilityProbe: { stage: 'json', nonce: 'nonce' } },
      messages
    ) as any;
    expect(jsonProbe.response_format).toEqual({ type: 'json_object' });
    const other = buildLearningRequest({ ...coach, endpoint: free.endpoint }, messages) as any;
    expect(other.tool_choice).toEqual({ type: 'function', function: { name: 'yozi_coach_response' } });
    expect(other.tools[0].function.strict).toBe(true);
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
    ['caller that does not arm it', { armed: false }, messages],
    ['image input', {}, [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:,' } }] }]],
    ['other failure', { code: 'KEY_REJECTED' }, messages]
  ])('keeps the original error for %s', async (_name, change: any, input: any) => {
    const call = vi.fn(() => Promise.reject(new ProviderError(change.code || 'RATE_LIMITED', '原错误')));
    await expect(
      callWithDevPaidFallback(call, free, input, [], {
        enabled: change.enabled ?? true,
        armed: change.armed,
        stream: false
      })
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

  it('sends a quality retry straight to the DeepSeek quality model', async () => {
    const call = vi.fn(async () => 'paid answer');
    const result = await callWithDevPaidFallback(call, free, messages, ['https://apihub.agnes-ai.com'], {
      enabled: true,
      stream: false,
      quality: true
    });
    expect(result.paidFallback).toEqual({
      trigger: 'QUALITY_REJECTED',
      freeModel: 'agnes-3.0-flash',
      model: 'deepseek-v4-pro'
    });
    expect(call).toHaveBeenCalledOnce();
    const [target, targetMessages] = call.mock.calls[0] as any;
    expect(target).toMatchObject({ devPaidFallback: true, model: 'deepseek-v4-pro', apiKey: KEY });
    expect(targetMessages[0].content).toContain('"required":["reply"]');
    expect(buildLearningRequest(target, targetMessages, false)).toMatchObject({ thinking: { type: 'disabled' } });
  });

  it.each([
    ['caller that does not arm it', { armed: false }, messages],
    ['stream', { stream: true }, messages],
    ['image input', {}, [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:,' } }] }]]
  ])('asks the free model as usual on a quality retry for %s', async (_name, change: any, input: any) => {
    const call = vi.fn(async () => 'free answer');
    const result = await callWithDevPaidFallback(call, free, input, [], {
      enabled: true,
      armed: change.armed,
      stream: change.stream ?? false,
      quality: true
    });
    expect(result).toEqual({ response: 'free answer', model: free, paidFallback: null });
    expect(call).toHaveBeenCalledWith(free, input, []);
  });

  it('allows one more repair only after the free repair was rejected', () => {
    const parent = {
      id: 'quality-parent',
      fingerprint: 'parent',
      source: 'byok',
      maxCost: 0,
      units: 0,
      model: 'agnes-3.0-flash',
      provider: 'Agnes',
      modelId: 'free',
      configurationVersion: 'same'
    };
    const repair = (n: number) => ({
      ...parent,
      id: `${parent.id}:repair${n}`,
      fingerprint: `r${n}`,
      repairOf: parent.id
    });
    let account = reserveCall(newAccount('u1'), parent).account;
    account = settleCall(account, parent.id, { success: false, actualCost: 0, errorCode: 'COACH_INVALID' }).account;
    expect(() => reserveCall(account, repair(2))).toThrow();
    account = reserveCall(account, repair(1)).account;
    expect(() => reserveCall(account, repair(2))).toThrow();
    account = settleCall(account, repair(1).id, { success: false, actualCost: 0, errorCode: 'COACH_INVALID' }).account;
    account = reserveCall(account, repair(2)).account;
    expect(latestRepair(account.calls, parent.id)).toMatchObject({ id: 'quality-parent:repair2', status: 'reserved' });
    account = settleCall(account, repair(2).id, { success: true, actualCost: 0, result: { message: 'valid' } }).account;
    expect(latestRepair(account.calls, parent.id)).toMatchObject({ status: 'completed' });
    expect(() => reserveCall(account, { ...repair(3), id: `${parent.id}:repair3` })).toThrow();
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
