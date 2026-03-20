/**
 * AI供应商工厂 — 多LLM供应商抽象层
 * 搬运自 OpenMAIC lib/ai/ 的 provider 模式，适配智谱为主供应商
 *
 * 设计思路：
 * - 现有 proxy-ai.ts 直接调用智谱API，耦合严重
 * - 参考 OpenMAIC 的 provider 抽象，支持多供应商切换
 * - 保留智谱作为默认供应商，未来可扩展 OpenAI/Anthropic 等
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  topP?: number;
  stop?: string[];
}

export interface CompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface AIProvider {
  name: string;
  chat(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>;
  streamChat(messages: ChatMessage[], options?: CompletionOptions): Promise<Response>;
}

// ==================== 智谱适配器 ====================
class ZhipuProvider implements AIProvider {
  name = 'zhipu';
  private apiKey: string;
  private baseUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const model = options.model || process.env.DEFAULT_TEACHER_MODEL || 'glm-4-plus';
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        top_p: options.topP ?? 0.9,
        stream: false,
        ...(options.stop ? { stop: options.stop } : {})
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`Zhipu API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      model: data.model || model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      finishReason: choice?.finish_reason || 'stop'
    };
  }

  async streamChat(messages: ChatMessage[], options: CompletionOptions = {}): Promise<Response> {
    const model = options.model || process.env.DEFAULT_TEACHER_MODEL || 'glm-4-plus';
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        top_p: options.topP ?? 0.9,
        stream: true,
        ...(options.stop ? { stop: options.stop } : {})
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`Zhipu API stream error ${response.status}: ${errorText}`);
    }

    return response;
  }
}

// ==================== 通用 OpenAI 兼容适配器 ====================
class OpenAICompatProvider implements AIProvider {
  name: string;
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(name: string, apiKey: string, baseUrl: string, defaultModel: string) {
    this.name = name;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async chat(messages: ChatMessage[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: false
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`${this.name} API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      model: data.model || model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      finishReason: choice?.finish_reason || 'stop'
    };
  }

  async streamChat(messages: ChatMessage[], options: CompletionOptions = {}): Promise<Response> {
    const model = options.model || this.defaultModel;
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: true
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`${this.name} API stream error ${response.status}: ${errorText}`);
    }

    return response;
  }
}

// ==================== 供应商配置 ====================
const PROVIDER_CONFIGS: Record<string, { url: string; model: string }> = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash-exp'
  },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'google/gemini-2.0-flash-exp:free' },
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', model: 'llama-3.3-70b' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
  manus: { url: 'https://api.manus.im/v1/chat/completions', model: 'gpt-4o-mini' }
};

// 号池轮询索引
let _poolIndex = 0;
const _providerCache = new Map<string, AIProvider>();

// Agent角色 → 默认模型映射
const ROLE_MODEL_MAP: Record<string, string> = {
  teacher: process.env.DEFAULT_TEACHER_MODEL || 'glm-4-plus',
  student: process.env.DEFAULT_STUDENT_MODEL || 'glm-4-flash',
  examiner: process.env.DEFAULT_EXAMINER_MODEL || 'glm-4.5-air'
};

export function getProvider(providerName?: string): AIProvider {
  const name = providerName || 'auto';

  // 自动轮询模式：从号池中选择可用的provider
  if (name === 'auto') {
    const pool = [
      { name: 'groq', key: process.env.GROQ_API_KEY },
      { name: 'gemini', key: process.env.GEMINI_API_KEY },
      { name: 'openrouter', key: process.env.OPENROUTER_API_KEY },
      { name: 'cerebras', key: process.env.CEREBRAS_API_KEY },
      { name: 'mistral', key: process.env.MISTRAL_API_KEY },
      { name: 'manus', key: process.env.MANUS_API_KEY },
      { name: 'zhipu', key: process.env.AI_PROVIDER_KEY_PLACEHOLDER
    ].filter((p) => p.key);

    if (pool.length === 0) throw new Error('No API keys configured in pool');

    // 轮询选择
    const selected = pool[_poolIndex % pool.length];
    _poolIndex++;
    return getProvider(selected.name);
  }

  // 缓存复用
  if (_providerCache.has(name)) return _providerCache.get(name)!;

  let provider: AIProvider;

  if (name === 'zhipu') {
    const key = process.env.AI_PROVIDER_KEY_PLACEHOLDER
    if (!key) throw new Error('AI_PROVIDER_KEY_PLACEHOLDER
    provider = new ZhipuProvider(key);
  } else if (PROVIDER_CONFIGS[name]) {
    const envKey = `${name.toUpperCase()}_API_KEY`;
    const key = process.env[envKey] || '';
    if (!key) throw new Error(`${envKey} not configured`);
    const cfg = PROVIDER_CONFIGS[name];
    provider = new OpenAICompatProvider(name, key, cfg.url, cfg.model);
  } else {
    throw new Error(`Unknown provider: ${name}`);
  }

  _providerCache.set(name, provider);
  return provider;
}

export function getModelForRole(role: string): string {
  return ROLE_MODEL_MAP[role] || ROLE_MODEL_MAP.teacher;
}

export function resetProviderCache(): void {
  _providerCache.clear();
  _poolIndex = 0;
}
