// Public connection facts only. Account identifiers and credentials never belong here.
export const MODEL_ENDPOINTS = [
  [
    'gemini',
    'Google Gemini',
    'https://generativelanguage.googleapis.com/v1beta/openai',
    'https://ai.google.dev/gemini-api/docs/openai'
  ],
  ['groq', 'Groq', 'https://api.groq.com/openai/v1', 'https://console.groq.com/docs/api-reference'],
  [
    'openrouter',
    'OpenRouter',
    'https://openrouter.ai/api/v1',
    'https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request'
  ],
  ['aion', 'Aion Labs', 'https://api.aionlabs.ai/v1', 'https://www.aionlabs.ai/docs/'],
  ['llm7', 'LLM7', 'https://api.llm7.io/v1', 'https://docs.llm7.io/'],
  ['zai', 'Z.ai', 'https://api.z.ai/api/paas/v4', 'https://docs.z.ai/api-reference/llm/chat-completion'],
  ['ollama_cloud', 'Ollama Cloud', 'https://ollama.com/v1', 'https://docs.ollama.com/api/openai-compatibility'],
  ['mistral', 'Mistral', 'https://api.mistral.ai/v1', 'https://docs.mistral.ai/api/endpoint/chat'],
  ['nvidia', 'NVIDIA NIM', 'https://integrate.api.nvidia.com/v1', 'https://docs.api.nvidia.com/nim/reference/llm-apis'],
  [
    'ovh',
    'OVHcloud',
    'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
    'https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/'
  ],
  ['cohere', 'Cohere', 'https://api.cohere.ai/compatibility/v1', 'https://docs.cohere.com/docs/compatibility-api'],
  [
    'huggingface',
    'Hugging Face',
    'https://router.huggingface.co/v1',
    'https://huggingface.co/docs/inference-providers/tasks/chat-completion'
  ],
  [
    'siliconflow',
    'SiliconFlow',
    'https://api.siliconflow.cn/v1',
    'https://docs.siliconflow.cn/docs/api/chat-completions-post'
  ],
  [
    'cloudflare',
    'Cloudflare Workers AI',
    'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
    'https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/'
  ],
  ['kilo', 'Kilo Gateway', 'https://api.kilo.ai/api/gateway', 'https://kilo.ai/docs/gateway/models-and-providers'],
  [
    'modelscope',
    'ModelScope',
    'https://api-inference.modelscope.cn/v1',
    'https://modelscope.cn/docs/model-service/API-Inference/intro'
  ],
  ['zhipu', '智谱', 'https://open.bigmodel.cn/api/paas/v4', 'https://docs.bigmodel.cn/cn/api/introduction'],
  ['cerebras', 'Cerebras', 'https://api.cerebras.ai/v1', 'https://inference-docs.cerebras.ai/resources/openai'],
  ['sambanova', 'SambaNova', 'https://api.sambanova.ai/v1', 'https://docs.sambanova.ai/docs/en/integrations/vscode']
].map(([id, provider, baseURL, docs]) =>
  Object.freeze({ id, provider, baseURL, endpoint: `${baseURL}/chat/completions`, docs })
);

// Only exact documented base paths are completed. Unknown custom paths stay unchanged;
// HTTPS, the deployment allowlist, DNS/public-address checks and TLS still apply at the caller.
export function completeModelEndpoint(raw) {
  if (typeof raw !== 'string') return raw;
  const value = raw.trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== '443')
  )
    return value;
  const base = url.href.replace(/\/$/, '');
  const known = MODEL_ENDPOINTS.find((item) => item.id !== 'cloudflare' && item.baseURL === base);
  if (known) return known.endpoint;
  if (
    url.origin === 'https://api.cloudflare.com' &&
    /^\/client\/v4\/accounts\/[a-fA-F0-9]{32}\/ai\/v1\/?$/.test(url.pathname)
  )
    return `${base}/chat/completions`;
  return value;
}

const endpointFor = (id) => MODEL_ENDPOINTS.find((item) => item.id === id);
const privacyFor = (provider) => `当前学习上下文经本项目后端发送至${provider}；资料不默认整份上传。`;

// Templates do not create a connection or prove that a particular account has free quota.
export const MODEL_CONNECTION_PRESETS = [
  {
    id: 'zhipu-glm-flash',
    provider: '智谱',
    model: 'glm-4.7-flash',
    endpoint: endpointFor('zhipu').endpoint,
    structured: true,
    pricing: 'official_free_model',
    priceVersion: 'zhipu-glm-4.7-flash-free-2026-09-30',
    verifiedAt: '2026-09-30',
    expiresAt: '2026-10-30',
    terms: '官方免费型号，仍受账户限流；不调用搜索等收费工具，不切换FlashX。',
    privacy: '当前目标、最近消息与题目经本项目后端发送至智谱；资料不默认整份上传。',
    docs: 'https://open.bigmodel.cn/pricing'
  },
  {
    id: 'zai-glm-flash',
    provider: 'Z.ai',
    model: 'glm-4.7-flash',
    endpoint: endpointFor('zai').endpoint,
    structured: true,
    pricing: 'official_free_model',
    priceVersion: 'zai-glm-4.7-flash-free-2026-09-30',
    verifiedAt: '2026-09-30',
    expiresAt: '2026-10-30',
    terms: '官方免费型号，仍受账户限流；不调用搜索等收费工具，不切换FlashX。',
    privacy: '当前目标、最近消息与题目经本项目后端发送至Z.ai；资料不默认整份上传。',
    docs: 'https://docs.z.ai/guides/overview/pricing'
  },
  {
    id: 'gemini-flash-lite',
    provider: 'Google Gemini',
    model: 'gemini-2.5-flash-lite',
    endpoint: endpointFor('gemini').endpoint,
    structured: true,
    pricing: 'account_free_tier_required',
    terms: '仅账户Free tier时免费；未确认账户套餐时费用待结算。达到限额停止，不切换付费型号。',
    privacy: '免费层数据可能用于供应商改进产品；只共享已授权的当前学习上下文。',
    docs: 'https://ai.google.dev/gemini-api/docs/pricing'
  },
  ...[
    ['groq', 'openai/gpt-oss-20b', '仅账户免费层及剩余额度内使用；不能由目录推断账户套餐。'],
    ['openrouter', 'qwen/qwen3.8-27b:free', '固定选择:free型号，限额用尽停止，不切换同名付费路由。'],
    ['aion', 'aion-labs/aion-rp-llama-3.1-8b', '仅账户免费日额度；不充值，不启用付费回退。'],
    ['llm7', 'codestral-latest', '第三方聚合服务；先确认免费套餐、密钥有效期与模型资格。'],
    ['ollama_cloud', 'gpt-oss:20b', '使用云端模型ID，不添加本地:cloud后缀；先确认Free套餐与剩余额度。'],
    ['mistral', 'codestral-latest', '仅账户免费试用额度；其他型号可能无额度，不启用按量付费。'],
    ['nvidia', 'openai/gpt-oss-20b', '免费试用资格与限额由账户决定；资料使用条款须先确认。'],
    ['huggingface', 'meta-llama/Llama-3.1-8B-Instruct', '仅每月试用额度；具体推理服务商可能收费，额度不足即停止。'],
    ['modelscope', 'Qwen/Qwen3.8-27B', '目录型号与当前Magicube积分须在账户确认，不按旧每日次数推算。']
  ].map(([providerId, model, terms]) => {
    const source = endpointFor(providerId);
    return {
      id: `${providerId}-catalog`,
      provider: source.provider,
      model,
      endpoint: source.endpoint,
      structured: false,
      pricing: 'account_free_tier_required',
      terms,
      privacy: privacyFor(source.provider),
      docs: source.docs
    };
  })
];
