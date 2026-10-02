import { describe, expect, it } from 'vitest';
import {
  FREE_MODEL_PRESETS,
  freeModelPricing,
  modelConnectionState,
  modelConfigurationVersion
} from '../../laf-backend/functions/_shared/ai-providers/free-model-presets';
import {
  buildLearningRequest,
  parseLearningOutput
} from '../../laf-backend/functions/_shared/ai-providers/learning-provider';
import { readFreeApiCredential } from '../../scripts/build/free-api-catalog.mjs';
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('免费型号是可核验接入事实，不是任意零价格声明', () => {
  it('只有精确端点/型号且复核未过期时确认零价格，Gemini账户层和FlashX不冒充免费', () => {
    const p = FREE_MODEL_PRESETS[0];
    expect(freeModelPricing(p, Date.parse('2026-09-30'))).toMatchObject({ inputPerMillion: 0 });
    expect(freeModelPricing({ ...p, model: 'glm-4.7-flashx' })).toBeNull();
    expect(freeModelPricing({ ...p, endpoint: 'https://another.example/chat' })).toBeNull();
    expect(freeModelPricing(p, Date.parse('2026-10-30'))).toBeNull();
    expect(freeModelPricing(FREE_MODEL_PRESETS[2])).toBeNull();
  });
  it('思考参数只适配指定供应商型号，其他模型不静默变更', () => {
    const config: any = { ...FREE_MODEL_PRESETS[0], maxOutput: 1000, capabilities: { structured: true } };
    expect(buildLearningRequest(config, [])).toMatchObject({
      thinking: { type: 'disabled' },
      max_tokens: 1000,
      stream: false
    });
    expect(buildLearningRequest({ ...config, endpoint: 'https://other.example/chat' }, [])).not.toHaveProperty(
      'thinking'
    );
    expect(buildLearningRequest({ ...config, ...FREE_MODEL_PRESETS[2] }, [])).toHaveProperty(
      'reasoning_effort',
      'none'
    );
  });
  it('连接状态取同一配置的最近真实调用，失败及过期不会显示仍然连接', () => {
    const model = { id: 'selected', model: 'glm-4.7-flash' };
    const now = 100000000;
    expect(modelConnectionState(model, [], now).connectionStatus).toBe('untested');
    const calls = [
      {
        modelId: 'selected',
        model: model.model,
        status: 'completed',
        at: now,
        configurationVersion: modelConfigurationVersion(model)
      }
    ];
    expect(modelConnectionState(model, calls, now).connectionStatus).toBe('connected');
    expect(
      modelConnectionState(model, [...calls, { ...calls[0], status: 'failed', errorCode: 'RATE_LIMITED' }], now)
        .connectionStatus
    ).toBe('failed');
    expect(modelConnectionState(model, calls, now + 86400001).connectionStatus).toBe('stale');
    expect(modelConnectionState({ ...model, id: 'other-profile' }, calls, now).connectionStatus).toBe('untested');
  });
  it('换密钥、端点或能力后不冒用旧连接结果；流式与普通调用分别报告', () => {
    const model = {
      id: 'fixture',
      model: 'explicit',
      endpoint: 'https://fixture.example/chat',
      keyRef: 'fixture-ref-one',
      capabilities: { stream: true }
    };
    const now = Date.now(),
      call = {
        modelId: 'fixture',
        model: model.model,
        at: now,
        status: 'completed',
        configurationVersion: modelConfigurationVersion(model)
      };
    expect(modelConnectionState(model, [call], now)).toMatchObject({
      connectionStatus: 'connected',
      streamStatus: 'untested'
    });
    expect(modelConnectionState(model, [{ ...call, transport: 'sse-v1' }], now).streamStatus).toBe('connected');
    for (const changed of [
      { ...model, keyRef: 'fixture-ref-two' },
      { ...model, endpoint: 'https://other.example/chat' },
      { ...model, capabilities: { stream: true, structured: true } }
    ])
      expect(modelConnectionState(changed, [call], now)).toMatchObject({
        connectionStatus: 'untested',
        streamStatus: 'untested'
      });
    expect(modelConnectionState(model, [{ ...call, configurationVersion: undefined }], now).connectionStatus).toBe(
      'untested'
    );
  });
  it('单一JSON围栏适配仍校验工具权限，正文和代码不会当工具执行', () => {
    expect(parseLearningOutput('```json\n{"message":"练习","tools":[]}\n```').structured).toBe(true);
    expect(() =>
      parseLearningOutput('```json\n{"message":"run","tools":[{"name":"shell","arguments":{}}]}\n```')
    ).toThrow('未授权');
    expect(parseLearningOutput('正文```js\nprocess.exit()\n```').tools).toEqual([]);
  });
  it('私有HTML只读取批准的数据字面量，拒绝端点替换、公开权限和可执行密钥表达式', () => {
    const dir = mkdtempSync(join(tmpdir(), 'exam-free-catalog-'));
    const file = join(dir, 'private.html');
    const catalog = (key = '"test-only-private-key"', base = 'https://approved.example/v1') =>
      `<script>const rows=[{id:'approved',status:'verified',base:'${base}',keys:[${key}]}];throw new Error('must not execute');</script>`;
    try {
      writeFileSync(file, catalog(), { mode: 0o600 });
      expect(readFreeApiCredential(file, 'approved', 'https://approved.example/v1')).toBe('test-only-private-key');
      chmodSync(file, 0o644);
      expect(() => readFreeApiCredential(file, 'approved', 'https://approved.example/v1')).toThrow();
      chmodSync(file, 0o600);
      writeFileSync(file, catalog('(()=>"test-only-key")()'));
      expect(() => readFreeApiCredential(file, 'approved', 'https://approved.example/v1')).toThrow('usable');
      writeFileSync(file, catalog('"test-only-private-key"', 'https://attacker.example'));
      expect(() => readFreeApiCredential(file, 'approved', 'https://approved.example/v1')).toThrow('approved');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

it('普通文本连接不能冒充图片成功；图片状态按同配置/实际模式、过期与失败报告', () => {
  const model = {
    id: 'vision',
    model: 'explicit',
    capabilities: { vision: true },
    visionAdapter: 'openai-image-url-v1'
  };
  const at = 100000000,
    configurationVersion = modelConfigurationVersion(model);
  const call = { modelId: 'vision', model: 'explicit', status: 'completed', at, configurationVersion };
  expect(modelConnectionState(model, [call], at).visionStatus).toBe('untested');
  expect(modelConnectionState(model, [{ ...call, inputMode: 'image' }], at).visionStatus).toBe('connected');
  expect(modelConnectionState(model, [{ ...call, inputMode: 'image' }], at + 86400001).visionStatus).toBe('stale');
  expect(modelConnectionState(model, [{ ...call, inputMode: 'image', status: 'failed' }], at).visionStatus).toBe(
    'failed'
  );
  expect(modelConnectionState({ ...model, model: 'changed' }, [{ ...call, inputMode: 'image' }], at).visionStatus).toBe(
    'untested'
  );
  expect(
    modelConnectionState({ ...model, visionAdapter: undefined }, [{ ...call, inputMode: 'image' }], at).visionStatus
  ).toBe('undeclared');
});
