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

function createTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  const signalFactory = (globalThis as any).AbortSignal?.timeout;
  if (typeof signalFactory === 'function') return signalFactory(timeoutMs);

  const Controller = (globalThis as any).AbortController;
  if (typeof Controller !== 'function') return undefined;

  const controller = new Controller();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  (timer as any).unref?.();
  return controller.signal;
}

function summarizeProviderResponseError(data: any): string {
  const parts: string[] = [];
  for (const key of ['status', 'code', 'msg', 'message']) {
    if (data?.[key]) parts.push(`${key}=${data[key]}`);
  }

  const error = data?.error;
  if (typeof error === 'string') {
    parts.push(`error=${error}`);
  } else if (error && typeof error === 'object') {
    const detail = error.message || error.msg || error.code;
    if (detail) parts.push(`error=${detail}`);
  }

  return parts.join(', ') || 'missing choices';
}

function extractChatContent(providerName: string, data: any): { content: string; choice: any } {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`${providerName} API invalid response: ${summarizeProviderResponseError(data)}`);
  }
  return { content: content.trim(), choice };
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
      signal: createTimeoutSignal(60000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`Zhipu API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const { content, choice } = extractChatContent('Zhipu', data);

    return {
      content,
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
      signal: createTimeoutSignal(120000)
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
  private extraHeaders: Record<string, string>;
  private maxTokensField: 'max_tokens' | 'max_completion_tokens';

  constructor(
    name: string,
    apiKey: string,
    baseUrl: string,
    defaultModel: string,
    extraHeaders: Record<string, string> = {},
    maxTokensField: 'max_tokens' | 'max_completion_tokens' = 'max_tokens'
  ) {
    this.name = name;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
    this.extraHeaders = extraHeaders;
    this.maxTokensField = maxTokensField;
  }

  async chat(messages: ChatMessage[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const maxTokensPayload = { [this.maxTokensField]: options.maxTokens ?? 4096 };
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        ...maxTokensPayload,
        stream: false
      }),
      signal: createTimeoutSignal(60000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`${this.name} API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const { content, choice } = extractChatContent(this.name, data);

    return {
      content,
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
    const maxTokensPayload = { [this.maxTokensField]: options.maxTokens ?? 4096 };
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        ...maxTokensPayload,
        stream: true
      }),
      signal: createTimeoutSignal(120000)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`${this.name} API stream error ${response.status}: ${errorText}`);
    }

    return response;
  }
}

// ==================== 供应商配置 ====================
export type ProviderTier = 'free' | 'free-credit' | 'paid' | 'unverified';

export interface ProviderConfig {
  name: string;
  url: string;
  model: string;
  keyEnvs: string[];
  tier: ProviderTier;
  priority: number;
  modelEnv?: string;
  urlEnv?: string;
  rpm?: number;
  rpd?: number;
  tpm?: number;
  tpd?: number;
  notes?: string;
  disabledByDefault?: boolean;
  headers?: Record<string, string>;
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
}

export interface ProviderPoolEntry {
  id: string;
  name: string;
  url: string;
  model: string;
  keyEnv: string;
  tier: ProviderTier;
  priority: number;
  rpm?: number;
  rpd?: number;
  tpm?: number;
  tpd?: number;
  notes?: string;
  headers?: Record<string, string>;
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
}

const SILICONFLOW_DS_KEY_ENVS = Array.from({ length: 10 }, (_, index) => `SILICONFLOW_DS_KEY_${index + 1}`);

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  iflow: {
    name: 'iflow',
    url: 'https://apis.iflow.cn/v1/chat/completions',
    model: 'TBStars2-200B-A13B',
    keyEnvs: ['IFLOW_API_KEY'],
    tier: 'free',
    priority: 10,
    modelEnv: 'IFLOW_MODEL',
    urlEnv: 'IFLOW_BASE_URL',
    notes: '心流 OpenAI 兼容入口，作为增量清洗主力；真实限额以控制台为准。'
  },
  nvidia: {
    name: 'nvidia',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-3.3-70b-instruct',
    keyEnvs: ['NVIDIA_API_KEY'],
    tier: 'free',
    priority: 20,
    modelEnv: 'NVIDIA_MODEL',
    notes: 'NVIDIA NIM OpenAI 兼容入口，免费额度耗尽后自动降级。'
  },
  groq: {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.1-8b-instant',
    keyEnvs: ['GROQ_API_KEY'],
    tier: 'free',
    priority: 30,
    modelEnv: 'GROQ_MODEL',
    rpm: 30,
    rpd: 14400,
    tpm: 6000,
    tpd: 500000,
    notes: 'Groq 免费层按模型限流；8B 模型吞吐优先，质量任务可用 env 覆盖。'
  },
  gemini: {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash-lite',
    keyEnvs: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    tier: 'free',
    priority: 40,
    modelEnv: 'GEMINI_MODEL',
    notes: 'Google AI Studio OpenAI 兼容入口，免费层按模型/项目限额。'
  },
  cerebras: {
    name: 'cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'qwen-3-32b',
    keyEnvs: ['CEREBRAS_API_KEY'],
    tier: 'free',
    priority: 50,
    modelEnv: 'CEREBRAS_MODEL',
    maxTokensField: 'max_completion_tokens',
    notes: 'Cerebras Cloud 免费层，适合高速结构化清洗。'
  },
  openrouter: {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openrouter/free',
    keyEnvs: ['OPENROUTER_API_KEY'],
    tier: 'free-credit',
    priority: 60,
    modelEnv: 'OPENROUTER_MODEL',
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://exam-master.local',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Exam-Master'
    },
    notes: 'OpenRouter 免费模型会随平台变化，默认使用 free 路由，生产可固定模型。'
  },
  mistral: {
    name: 'mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    keyEnvs: ['MISTRAL_API_KEY'],
    tier: 'free-credit',
    priority: 70,
    modelEnv: 'MISTRAL_MODEL',
    notes: 'Mistral free/trial 项目限额较严，放在中后段。'
  },
  github_models: {
    name: 'github_models',
    url: 'https://models.github.ai/inference/chat/completions',
    model: 'openai/gpt-4.1-mini',
    keyEnvs: ['GITHUB_MODELS_TOKEN'],
    tier: 'free',
    priority: 80,
    modelEnv: 'GITHUB_MODELS_MODEL',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    notes: 'GitHub Models 有低速率限制，适合作为低频兜底。'
  },
  huggingface: {
    name: 'huggingface',
    url: 'https://router.huggingface.co/v1/chat/completions',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    keyEnvs: ['HF_TOKEN', 'HUGGINGFACE_API_KEY'],
    tier: 'free-credit',
    priority: 90,
    modelEnv: 'HF_MODEL',
    notes: 'Hugging Face Inference Providers 统一路由，免费额度随账号和 provider 变化。'
  },
  gpt_api_free: {
    name: 'gpt_api_free',
    url: 'https://api.chatanywhere.tech/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    keyEnvs: ['GPT_API_FREE_KEY'],
    tier: 'free',
    priority: 100,
    modelEnv: 'GPT_API_FREE_MODEL',
    rpd: 200,
    notes: '社区免费接口，低优先级兜底；避免承载批量清洗。'
  },
  siliconflow_ds: {
    name: 'siliconflow_ds',
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    model: 'deepseek-ai/DeepSeek-V3',
    keyEnvs: SILICONFLOW_DS_KEY_ENVS,
    tier: 'free-credit',
    priority: 110,
    modelEnv: 'SILICONFLOW_DS_MODEL',
    urlEnv: 'SILICONFLOW_API_URL',
    notes: '第三方余额 key 轮转池；默认禁用 Pro/ 前缀模型，避免触发官方限制。'
  },
  siliconflow_official: {
    name: 'siliconflow_official',
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    keyEnvs: ['SILICONFLOW_OFFICIAL_API_KEY', 'SILICONFLOW_API_KEY_1'],
    tier: 'free-credit',
    priority: 120,
    modelEnv: 'SILICONFLOW_MODEL',
    urlEnv: 'SILICONFLOW_API_URL',
    notes: '硅基流动官方账户备用，余额低时通过禁用名单摘除。'
  },
  vercel_ai_gateway: {
    name: 'vercel_ai_gateway',
    url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
    model: 'openai/gpt-4o-mini',
    keyEnvs: ['VERCEL_AI_GATEWAY_API_KEY'],
    tier: 'free-credit',
    priority: 130,
    modelEnv: 'VERCEL_AI_GATEWAY_MODEL',
    notes: 'Vercel AI Gateway 统一路由，按账号额度计费/限流。'
  },
  volcengine: {
    name: 'volcengine',
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-1-5-lite-32k-250115',
    keyEnvs: ['VOLCENGINE_API_KEY'],
    tier: 'paid',
    priority: 140,
    modelEnv: 'VOLCENGINE_MODEL',
    notes: '火山方舟按量付费，仅作低价兜底。'
  },
  zhipu: {
    name: 'zhipu',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    keyEnvs: ['ZHIPU_API_KEY'],
    tier: 'paid',
    priority: 150,
    modelEnv: 'ZHIPU_MODEL',
    notes: '智谱付费备用；不作为免费清洗主力。'
  },
  manus: {
    name: 'manus',
    url: 'https://api.manus.im/v1/chat/completions',
    model: 'gpt-4o-mini',
    keyEnvs: ['MANUS_API_KEY'],
    tier: 'unverified',
    priority: 900,
    modelEnv: 'MANUS_MODEL',
    disabledByDefault: true,
    notes: '未找到稳定公开 OpenAI 兼容与限额文档，默认不进自动池。'
  }
};

const LEGACY_PROVIDER_ALIASES: Record<string, string> = {
  siliconflow: 'iflow'
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

function parseCsvSet(value?: string): Set<string> {
  return new Set(
    (value || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function resolveProviderName(providerName: string): string {
  return LEGACY_PROVIDER_ALIASES[providerName] || providerName;
}

function normalizeChatCompletionsUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1') || trimmed.endsWith('/v3')) return `${trimmed}/chat/completions`;
  return trimmed;
}

function resolveProviderModel(config: ProviderConfig): string {
  const configuredModel = config.modelEnv ? process.env[config.modelEnv] : '';
  const model = configuredModel || config.model;

  if (config.name === 'siliconflow_ds' && /^Pro\//i.test(model)) {
    console.warn('[AIProviderPool] SILICONFLOW_DS_MODEL 不能使用 Pro/ 前缀，已回退到 deepseek-ai/DeepSeek-V3');
    return 'deepseek-ai/DeepSeek-V3';
  }

  return model;
}

function resolveProviderUrl(config: ProviderConfig): string {
  const configuredUrl = config.urlEnv ? process.env[config.urlEnv] : '';
  return normalizeChatCompletionsUrl(configuredUrl || config.url);
}

function isProviderPoolDisabled(config: ProviderConfig, keyEnv: string, id: string): boolean {
  const disabled = parseCsvSet(process.env.AI_PROVIDER_DISABLED_LIST);
  const disabledKeys = parseCsvSet(process.env.AI_PROVIDER_DISABLED_KEYS || process.env.AI_PROVIDER_DISABLED_KEY_ENVS);

  return (
    disabled.has(config.name.toLowerCase()) ||
    disabled.has(id.toLowerCase()) ||
    disabled.has(keyEnv.toLowerCase()) ||
    disabledKeys.has(keyEnv.toLowerCase())
  );
}

function isProviderPoolAllowed(config: ProviderConfig): boolean {
  const enabled = parseCsvSet(process.env.AI_PROVIDER_ENABLED_LIST);
  if (config.disabledByDefault && !enabled.has(config.name.toLowerCase())) return false;
  if (config.tier === 'paid' && process.env.AI_PROVIDER_ALLOW_PAID_FALLBACKS !== 'true') return false;
  return true;
}

function buildProviderPoolEntry(config: ProviderConfig, keyEnv: string): ProviderPoolEntry {
  return {
    id: config.keyEnvs.length > 1 ? `${config.name}:${keyEnv}` : config.name,
    name: config.name,
    url: resolveProviderUrl(config),
    model: resolveProviderModel(config),
    keyEnv,
    tier: config.tier,
    priority: config.priority,
    rpm: config.rpm,
    rpd: config.rpd,
    tpm: config.tpm,
    tpd: config.tpd,
    notes: config.notes,
    headers: config.headers,
    maxTokensField: config.maxTokensField
  };
}

export function getConfiguredProviderPool(): ProviderPoolEntry[] {
  const pool: ProviderPoolEntry[] = [];

  for (const config of Object.values(PROVIDER_CONFIGS).sort((a, b) => a.priority - b.priority)) {
    if (!isProviderPoolAllowed(config)) continue;

    for (const keyEnv of config.keyEnvs) {
      if (!process.env[keyEnv]) continue;

      const entry = buildProviderPoolEntry(config, keyEnv);
      if (isProviderPoolDisabled(config, keyEnv, entry.id)) continue;
      pool.push(entry);
    }
  }

  return pool;
}

export function getFallbackProviderNames(preferredProvider?: string): string[] {
  const preferred = preferredProvider ? resolveProviderName(preferredProvider) : '';
  const seen = new Set<string>();
  const names: string[] = [];

  for (const entry of getConfiguredProviderPool()) {
    if (entry.name === preferred) continue;
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    names.push(entry.name);
  }

  return names;
}

function getConfiguredProviderEntry(providerName: string, allowDisabledByDefault = true): ProviderPoolEntry | null {
  const name = resolveProviderName(providerName);
  const config = PROVIDER_CONFIGS[name];
  if (!config) return null;
  if (!allowDisabledByDefault && !isProviderPoolAllowed(config)) return null;

  for (const keyEnv of config.keyEnvs) {
    if (!process.env[keyEnv]) continue;
    const entry = buildProviderPoolEntry(config, keyEnv);
    if (!allowDisabledByDefault && isProviderPoolDisabled(config, keyEnv, entry.id)) continue;
    return entry;
  }

  return null;
}

function getConfiguredProviderEntryById(providerId: string): ProviderPoolEntry | null {
  return getConfiguredProviderPool().find((entry) => entry.id === providerId) || null;
}

function getFallbackProviderIds(preferredProvider?: string): string[] {
  const preferred = preferredProvider ? resolveProviderName(preferredProvider) : '';
  return getConfiguredProviderPool().filter((entry) => entry.name !== preferred).map((entry) => entry.id);
}

function createProviderFromEntry(entry: ProviderPoolEntry): AIProvider {
  const key = process.env[entry.keyEnv] || '';
  if (!key) throw new Error(`${entry.keyEnv} not configured`);
  return new OpenAICompatProvider(entry.name, key, entry.url, entry.model, entry.headers, entry.maxTokensField);
}

export function getProvider(providerName?: string): AIProvider {
  const name = providerName || 'auto';

  // 自动轮询模式：从号池中选择可用的provider
  if (name === 'auto') {
    const pool = getConfiguredProviderPool().filter((entry) => isProviderHealthy(entry.id) && isProviderHealthy(entry.name));
    if (pool.length === 0) throw new Error('No API keys configured in provider pool');

    // 轮询选择
    const selected = pool[_poolIndex % pool.length];
    _poolIndex++;
    const cacheKey = selected.id;
    if (_providerCache.has(cacheKey)) return _providerCache.get(cacheKey)!;
    const provider = createProviderFromEntry(selected);
    _providerCache.set(cacheKey, provider);
    return provider;
  }

  // 缓存复用
  const resolvedName = resolveProviderName(name);
  if (resolvedName.includes(':')) {
    if (_providerCache.has(resolvedName)) return _providerCache.get(resolvedName)!;
    const entry = getConfiguredProviderEntryById(resolvedName);
    if (!entry) throw new Error(`Provider pool entry not configured: ${resolvedName}`);
    const provider = createProviderFromEntry(entry);
    _providerCache.set(resolvedName, provider);
    return provider;
  }

  if (_providerCache.has(resolvedName)) return _providerCache.get(resolvedName)!;

  let provider: AIProvider;

  if (resolvedName === 'zhipu') {
    const key = process.env.ZHIPU_API_KEY || '';
    if (!key) throw new Error('ZHIPU_API_KEY not configured');
    provider = new ZhipuProvider(key);
  } else if (PROVIDER_CONFIGS[resolvedName]) {
    const entry = getConfiguredProviderEntry(resolvedName);
    if (!entry) {
      const envList = PROVIDER_CONFIGS[resolvedName].keyEnvs.join(' or ');
      throw new Error(`${envList} not configured`);
    }
    provider = createProviderFromEntry(entry);
  } else {
    throw new Error(`Unknown provider: ${name}`);
  }

  _providerCache.set(resolvedName, provider);
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
  /** 首选 provider 名称，默认 'auto' */
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
    preferredProvider = process.env.AI_PREFERRED_PROVIDER || 'auto',
    fallbackProviders,
    maxRetries = MAX_RETRIES,
    requestId = '',
    ...completionOptions
  } = options;

  // 构建候选 provider 列表：首选 + 降级列表
  let candidates: string[] = [];
  if (fallbackProviders && fallbackProviders.length > 0) {
    candidates = [preferredProvider];
    candidates.push(...fallbackProviders.filter((p) => p !== preferredProvider));
  } else if (preferredProvider === 'auto') {
    candidates = getFallbackProviderIds();
  } else {
    candidates = [preferredProvider, ...getFallbackProviderIds(preferredProvider)];
  }

  let lastError: Error | null = null;
  let retryCount = 0;

  for (const candidateName of candidates) {
    const resolvedCandidate = resolveProviderName(candidateName.split(':')[0]);

    // 跳过已熔断的 provider
    if (!isProviderHealthy(candidateName) || !isProviderHealthy(resolvedCandidate)) {
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
        if (candidateName !== resolvedCandidate) recordProviderSuccess(resolvedCandidate);

        return {
          ...result,
          actualProvider: provider.name,
          wasFallback: preferredProvider !== 'auto' && provider.name !== resolveProviderName(preferredProvider),
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
        if (candidateName !== resolvedCandidate) recordProviderFailure(resolvedCandidate);

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
  const config = PROVIDER_CONFIGS.siliconflow_official;
  const activeEntry = config.keyEnvs
    .map((keyEnv) => ({ keyEnv, apiKey: process.env[keyEnv] || '' }))
    .find(({ keyEnv, apiKey }) => {
      if (!apiKey) return false;
      const entry = buildProviderPoolEntry(config, keyEnv);
      return !isProviderPoolDisabled(config, keyEnv, entry.id);
    });

  if (!activeEntry) {
    return {
      provider: 'siliconflow',
      balance: null,
      currency: 'CNY',
      status: 'ok',
      message: 'SiliconFlow 官方余额 key 未配置或已禁用，跳过余额检查'
    };
  }

  try {
    const resp = await fetch('https://api.siliconflow.cn/v1/user/info', {
      method: 'GET',
      headers: { Authorization: `Bearer ${activeEntry.apiKey}` },
      signal: createTimeoutSignal(10000)
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
