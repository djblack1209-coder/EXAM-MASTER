import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadFactory() {
  const mod = await import('../../laf-backend/functions/_shared/ai-providers/provider-factory.ts');
  mod.resetProviderCache();
  mod.resetCircuitBreaker();
  return mod;
}

describe('Free LLM API provider pool', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.IFLOW_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.GITHUB_MODELS_TOKEN;
    delete process.env.HF_TOKEN;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.GPT_API_FREE_KEY;
    delete process.env.SILICONFLOW_API_KEY_1;
    delete process.env.SILICONFLOW_OFFICIAL_API_KEY;
    delete process.env.SILICONFLOW_DS_KEY_1;
    delete process.env.SILICONFLOW_DS_KEY_2;
    delete process.env.VERCEL_AI_GATEWAY_API_KEY;
    delete process.env.VOLCENGINE_API_KEY;
    delete process.env.ZHIPU_API_KEY;
    delete process.env.AI_PROVIDER_DISABLED_LIST;
    delete process.env.AI_PROVIDER_DISABLED_KEYS;
    delete process.env.AI_PROVIDER_ALLOW_PAID_FALLBACKS;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('builds an auto pool that prefers iFlow and skips disabled providers', async () => {
    process.env.IFLOW_API_KEY = 'iflow-test-key';
    process.env.NVIDIA_API_KEY = 'nvidia-test-key';
    process.env.GROQ_API_KEY = 'groq-test-key';
    process.env.AI_PROVIDER_DISABLED_LIST = 'iflow';

    const { getConfiguredProviderPool } = await loadFactory();
    const pool = getConfiguredProviderPool();

    expect(pool.map((item) => item.name)).toEqual(['nvidia', 'groq']);
    expect(pool[0]).toMatchObject({
      name: 'nvidia',
      keyEnv: 'NVIDIA_API_KEY',
      tier: 'free'
    });
  });

  it('expands SiliconFlow DeepSeek key pool without using Pro models by default', async () => {
    process.env.SILICONFLOW_DS_KEY_1 = 'sf-ds-1';
    process.env.SILICONFLOW_DS_KEY_2 = 'sf-ds-2';

    const { getConfiguredProviderPool } = await loadFactory();
    const pool = getConfiguredProviderPool();

    expect(pool.map((item) => item.keyEnv)).toEqual(['SILICONFLOW_DS_KEY_1', 'SILICONFLOW_DS_KEY_2']);
    for (const item of pool) {
      expect(item.name).toBe('siliconflow_ds');
      expect(item.model).not.toMatch(/^Pro\//);
    }
  });

  it('registers GPT_API_free, GitHub Models, and HuggingFace env aliases', async () => {
    process.env.GPT_API_FREE_KEY = 'gpt-free-test-key';
    process.env.GITHUB_MODELS_TOKEN = 'github-models-test-token';
    process.env.HF_TOKEN = 'hf-test-token';

    const { getConfiguredProviderPool } = await loadFactory();
    const pool = getConfiguredProviderPool();

    expect(pool.map((item) => item.name)).toEqual(['github_models', 'huggingface', 'gpt_api_free']);
    expect(pool.map((item) => item.keyEnv)).toEqual(['GITHUB_MODELS_TOKEN', 'HF_TOKEN', 'GPT_API_FREE_KEY']);
  });

  it('creates providers from explicit configured env aliases', async () => {
    process.env.GPT_API_FREE_KEY = 'gpt-free-test-key';

    const { getProvider } = await loadFactory();
    const provider = getProvider('gpt_api_free');

    expect(provider.name).toBe('gpt_api_free');
  });

  it('calls OpenAI-compatible providers when AbortSignal.timeout is unavailable', async () => {
    process.env.IFLOW_API_KEY = 'iflow-test-key';
    process.env.IFLOW_BASE_URL = 'https://example.test/v1/chat/completions';
    const originalFetch = globalThis.fetch;
    const originalTimeout = globalThis.AbortSignal.timeout;
    globalThis.AbortSignal.timeout = undefined;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        model: 'test-model'
      })
    }));

    try {
      const { getProvider } = await loadFactory();
      const provider = getProvider('iflow');
      const result = await provider.chat([{ role: 'user', content: 'ping' }]);

      expect(result.content).toBe('ok');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.test/v1/chat/completions',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.AbortSignal.timeout = originalTimeout;
    }
  });

  it('throws OpenAI-compatible provider errors when choices are missing', async () => {
    process.env.IFLOW_API_KEY = 'iflow-test-key';
    process.env.IFLOW_BASE_URL = 'https://example.test/v1/chat/completions';
    const originalFetch = globalThis.fetch;
    const originalTimeout = globalThis.AbortSignal.timeout;
    globalThis.AbortSignal.timeout = undefined;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: null,
        status: '435',
        msg: 'Model not support'
      })
    }));

    try {
      const { getProvider } = await loadFactory();
      const provider = getProvider('iflow');

      await expect(provider.chat([{ role: 'user', content: 'ping' }])).rejects.toThrow('Model not support');
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.AbortSignal.timeout = originalTimeout;
    }
  });

  it('derives fallback providers from the configured pool without disabled or duplicate names', async () => {
    process.env.ZHIPU_API_KEY = 'zhipu-test-key';
    process.env.IFLOW_API_KEY = 'iflow-test-key';
    process.env.GROQ_API_KEY = 'groq-test-key';
    process.env.AI_PROVIDER_DISABLED_LIST = 'groq';

    const { getFallbackProviderNames } = await loadFactory();

    expect(getFallbackProviderNames('zhipu')).toEqual(['iflow']);
  });

  it('skips SiliconFlow balance checks when official balance keys are disabled', async () => {
    process.env.SILICONFLOW_OFFICIAL_API_KEY = 'siliconflow-empty-balance-key';
    process.env.AI_PROVIDER_DISABLED_KEYS = 'SILICONFLOW_OFFICIAL_API_KEY';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error('balance endpoint should not be called');
    });

    try {
      const { checkSiliconFlowBalance } = await loadFactory();
      const result = await checkSiliconFlowBalance();

      expect(result.status).toBe('ok');
      expect(result.message).toMatch(/跳过|未配置/);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
