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
  manus: { url: 'https://api.manus.im/v1/chat/completions', model: 'gpt-4o-mini' },
  siliconflow: {
    url: process.env.SILICONFLOW_API_URL || 'https://apis.iflow.cn/v1/chat/completions',
    model: 'Qwen/Qwen2.5-7B-Instruct'
  },
  // NVIDIA NIM — 免费 1000 credits/月，支持 OpenAI 兼容接口
  nvidia: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-3.3-70b-instruct'
  },
  // 火山引擎 豆包 — 按量计费，价格极低
  volcengine: {
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-1-5-lite-32k-250115'
  },
  // Cohere — 免费 1000 req/月 trial
  cohere: {
    url: 'https://api.cohere.com/v2/chat',
    model: 'command-r-plus-08-2024'
  },
  // 硅基流动官方 API（与 iflow 互备）
  siliconflow_official: {
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    model: 'Qwen/Qwen2.5-7B-Instruct'
  },
  // GPT_API_free — 免费 GPT-3.5 访问（chatanywhere 项目）
  gpt_api_free: {
    url: 'https://api.chatanywhere.tech/v1/chat/completions',
    model: 'gpt-3.5-turbo'
  }
};

// 号池轮询索引
let _poolIndex = 0;
const _providerCache = new Map<string, AIProvider>();

// ==================== 熔断器（Circuit Breaker） ====================
// 从 proxy-ai.ts 搬运并泛化：按 provider 名称（而非模型名）追踪健康状态

interface CircuitState {
  failures: number;
  lastFailure: number;
  circuitOpen: boolean;
}

const _circuitStates = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 3; // 连续失败 N 次后熔断
const CIRCUIT_RESET_MS = 120_000; // 熔断恢复时间：2分钟
const RETRY_BASE_DELAY_MS = 1000; // 重试基础延迟（指数退避）
const MAX_RETRIES = 2; // 最大重试次数

/** 检查 provider 是否健康（未熔断或已过恢复期） */
function isProviderHealthy(providerName: string): boolean {
  const state = _circuitStates.get(providerName);
  if (!state) return true;
  if (state.circuitOpen) {
    // 半开状态：恢复期已过，允许尝试
    if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
      state.circuitOpen = false;
      state.failures = 0;
      return true;
    }
    return false;
  }
  return true;
}

/** 记录 provider 调用失败 */
function recordProviderFailure(providerName: string): void {
  const state = _circuitStates.get(providerName) || { failures: 0, lastFailure: 0, circuitOpen: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.circuitOpen = true;
    console.warn(`[CircuitBreaker] Provider ${providerName} 熔断，${CIRCUIT_RESET_MS / 1000}秒后尝试恢复`);
  }
  _circuitStates.set(providerName, state);
}

/** 记录 provider 调用成功（重置熔断状态） */
function recordProviderSuccess(providerName: string): void {
  _circuitStates.delete(providerName);
}

/** 获取所有 provider 的熔断状态（用于健康检查接口） */
export function getCircuitBreakerStates(): Record<string, CircuitState> {
  const result: Record<string, CircuitState> = {};
  _circuitStates.forEach((state, name) => {
    result[name] = { ...state };
  });
  return result;
}

/** 手动重置指定 provider 的熔断状态 */
export function resetCircuitBreaker(providerName?: string): void {
  if (providerName) {
    _circuitStates.delete(providerName);
  } else {
    _circuitStates.clear();
  }
}

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
      { name: 'siliconflow', key: process.env.SILICONFLOW_API_KEY_1 }, // 无限额度
      { name: 'nvidia', key: process.env.NVIDIA_API_KEY }, // 1000 credits/月
      { name: 'groq', key: process.env.GROQ_API_KEY }, // 30 req/min free
      { name: 'gemini', key: process.env.GEMINI_API_KEY }, // 15 req/min free
      { name: 'cerebras', key: process.env.CEREBRAS_API_KEY }, // 60 req/min free
      { name: 'openrouter', key: process.env.OPENROUTER_API_KEY }, // $5 free credits
      { name: 'mistral', key: process.env.MISTRAL_API_KEY }, // 1 req/sec free
      { name: 'volcengine', key: process.env.VOLCENGINE_API_KEY }, // 按量极低价
      { name: 'siliconflow_official', key: process.env.SILICONFLOW_OFFICIAL_API_KEY }, // 官方备用
      { name: 'gpt_api_free', key: process.env.GPT_API_FREE_KEY }, // GPT-3.5 200req/天
      { name: 'manus', key: process.env.MANUS_API_KEY }, // 付费
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

// ==================== 带重试和降级的高级调用 ====================

export interface ChatWithRetryOptions extends CompletionOptions {
  /** 首选 provider 名称，默认 'zhipu' */
  preferredProvider?: string;
  /** 降级 provider 列表（按优先级排列），默认使用号池 */
  fallbackProviders?: string[];
  /** 最大重试次数，默认 MAX_RETRIES */
  maxRetries?: number;
  /** 调用标识（用于日志追踪） */
  requestId?: string;
}

export interface ChatWithRetryResult extends CompletionResult {
  /** 实际使用的 provider 名称 */
  actualProvider: string;
  /** 是否发生了降级 */
  wasFallback: boolean;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 带重试、熔断和自动降级的 AI 调用
 *
 * 相当于给 AI 调用加了"保险丝"：
 * - 某个 AI 供应商连续失败 3 次就暂时拉黑（熔断），2 分钟后自动恢复
 * - 失败后自动切换到备用供应商（降级）
 * - 每次重试间隔递增（指数退避），避免雪崩
 */
export async function chatWithRetry(
  messages: ChatMessage[],
  options: ChatWithRetryOptions = {}
): Promise<ChatWithRetryResult> {
  const {
    preferredProvider = 'zhipu',
    fallbackProviders,
    maxRetries = MAX_RETRIES,
    requestId = '',
    ...completionOptions
  } = options;

  // 构建候选 provider 列表：首选 + 降级列表
  const candidates: string[] = [preferredProvider];
  if (fallbackProviders && fallbackProviders.length > 0) {
    candidates.push(...fallbackProviders.filter((p) => p !== preferredProvider));
  } else {
    // 没有指定降级列表时，使用默认降级链
    const defaultFallbacks = ['siliconflow', 'groq', 'gemini', 'cerebras'].filter((p) => p !== preferredProvider);
    candidates.push(...defaultFallbacks);
  }

  let lastError: Error | null = null;
  let retryCount = 0;

  for (const candidateName of candidates) {
    // 跳过已熔断的 provider
    if (!isProviderHealthy(candidateName)) {
      const prefix = requestId ? `[${requestId}] ` : '';
      console.warn(`${prefix}[ChatWithRetry] Provider ${candidateName} 已熔断，跳过`);
      continue;
    }

    let provider: AIProvider;
    try {
      provider = getProvider(candidateName);
    } catch (_e) {
      // provider 不可用（API Key 未配置等），跳过
      continue;
    }

    // 对当前 provider 进行最多 maxRetries 次重试
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await provider.chat(messages, completionOptions);

        // 成功：重置熔断状态
        recordProviderSuccess(candidateName);

        return {
          ...result,
          actualProvider: candidateName,
          wasFallback: candidateName !== preferredProvider,
          retryCount
        };
      } catch (err: any) {
        lastError = err;
        retryCount++;

        const prefix = requestId ? `[${requestId}] ` : '';
        console.warn(
          `${prefix}[ChatWithRetry] Provider ${candidateName} 失败` +
            ` (尝试 ${attempt}/${maxRetries + 1}): ${err.message}`
        );

        recordProviderFailure(candidateName);

        // 最后一次重试不需要等待
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt));
        }
      }
    }

    // 当前 provider 耗尽重试次数，尝试下一个
    const prefix = requestId ? `[${requestId}] ` : '';
    console.warn(`${prefix}[ChatWithRetry] Provider ${candidateName} 耗尽重试，尝试降级`);
  }

  // 所有候选 provider 都失败了
  throw new Error(
    `[ChatWithRetry] 所有 AI 供应商均不可用` +
      ` (尝试了 ${candidates.length} 个供应商, 共重试 ${retryCount} 次)` +
      (lastError ? `: ${lastError.message}` : '')
  );
}

// ==================== 余额监控 ====================

/** 余额警戒阈值（元） */
const BALANCE_ALERT_THRESHOLD = 30;

export interface ProviderBalanceInfo {
  provider: string;
  balance: number | null;
  currency: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

/**
 * 检查 SiliconFlow 官方账户余额
 * API: GET https://api.siliconflow.cn/v1/user/info
 * @returns 余额信息（元），余额 < 30 元时 status 为 warning
 */
export async function checkSiliconFlowBalance(): Promise<ProviderBalanceInfo> {
  const apiKey = process.env.SILICONFLOW_OFFICIAL_API_KEY || process.env.SILICONFLOW_API_KEY_1;
  if (!apiKey) {
    return { provider: 'siliconflow', balance: null, currency: 'CNY', status: 'error', message: 'API Key 未配置' };
  }

  try {
    const resp = await fetch('https://api.siliconflow.cn/v1/user/info', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000)
    });

    if (!resp.ok) {
      return {
        provider: 'siliconflow',
        balance: null,
        currency: 'CNY',
        status: 'error',
        message: `HTTP ${resp.status}`
      };
    }

    const data = (await resp.json()) as any;
    const balance = parseFloat(data?.data?.balance ?? data?.balance ?? '0');

    if (isNaN(balance)) {
      return { provider: 'siliconflow', balance: null, currency: 'CNY', status: 'error', message: '余额解析失败' };
    }

    const isLow = balance < BALANCE_ALERT_THRESHOLD;
    return {
      provider: 'siliconflow',
      balance,
      currency: 'CNY',
      status: isLow ? 'warning' : 'ok',
      message: isLow
        ? `⚠️ 余额不足！仅剩 ${balance} 元（警戒线 ${BALANCE_ALERT_THRESHOLD} 元）`
        : `余额充足：${balance} 元`
    };
  } catch (err: any) {
    return {
      provider: 'siliconflow',
      balance: null,
      currency: 'CNY',
      status: 'error',
      message: err?.message || '网络异常'
    };
  }
}

/**
 * 检查所有付费供应商的健康状态
 * 目前仅支持 SiliconFlow，后续可扩展其他供应商
 */
export async function checkAllProviderBalances(): Promise<ProviderBalanceInfo[]> {
  const results: ProviderBalanceInfo[] = [];
  results.push(await checkSiliconFlowBalance());
  return results;
}
