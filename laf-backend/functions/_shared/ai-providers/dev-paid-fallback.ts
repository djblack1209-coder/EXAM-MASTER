import fs from 'node:fs';
import { DEV_TEST } from '../build-channel.js';
import { ProviderError, type LearningMessage, type ModelConfig } from './learning-provider.js';

// 开发付费兜底：免费通道先答；只有它没有给出可用回答、且是限流、额度不足或空回答时，同一请求改由 DeepSeek 回答。
// 免费模型返修后仍未通过教学校验时，调用方传 quality，这次直接由 DeepSeek 质量型号作答（与 Lazy 一致）。
// 仅 dev/test 构建、且环境变量 YOZI_DEV_PAID_FALLBACK_FILE 指向本人所有、权限 600 的密钥文件时启用。
// 密钥每次调用时读取，不保存、不写日志、不返回；发布构建与未启用的开发运行保持原有不切换路径。
// 本地评测脚本不在 dev/test 构建里运行，由脚本显式传 armed；服务端调用一律按构建通道。
export const DEV_PAID_FALLBACK_FILE = 'YOZI_DEV_PAID_FALLBACK_FILE';
export const DEV_PAID_FALLBACK_ORIGIN = 'https://api.deepseek.com';
export const DEV_PAID_FALLBACK_ID = 'dev-paid-fallback-deepseek';
const SWITCH_CODES = new Set(['RATE_LIMITED', 'UPSTREAM_QUOTA']);

export function devPaidFallbackSettings(armed = DEV_TEST) {
  const path = process.env[DEV_PAID_FALLBACK_FILE];
  if (!armed || !path) return null;
  let text: string;
  try {
    const info = fs.lstatSync(path);
    if (!info.isFile() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) {
      console.warn('[dev-paid-fallback] 未就绪：密钥文件须为本人所有的普通文件且权限 600');
      return null;
    }
    text = fs.readFileSync(path, 'utf8');
  } catch {
    console.warn('[dev-paid-fallback] 未就绪：密钥文件不可读');
    return null;
  }
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line
      .trim()
      .replace(/^export\s+/, '')
      .match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  if (!values.DEEPSEEK_API_KEY) {
    console.warn('[dev-paid-fallback] 未就绪：密钥文件缺少 DEEPSEEK_API_KEY');
    return null;
  }
  return {
    apiKey: values.DEEPSEEK_API_KEY,
    model: values.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-flash',
    qualityModel: values.DEEPSEEK_QUALITY_MODEL || process.env.DEEPSEEK_QUALITY_MODEL || 'deepseek-v4-pro'
  };
}

// 兜底按原请求的合同回答：DeepSeek 教学使用 JSON Output；原始闭合 Schema 与能力往返凭据保留。
// 复核与两次盲填校准照常执行，JSON 格式不构成内容质量结论。
export function devPaidFallbackModel(config: ModelConfig, settings: { apiKey: string; model: string }): ModelConfig {
  const output = config.writingOutput;
  return {
    ...config,
    id: DEV_PAID_FALLBACK_ID,
    provider: 'DeepSeek（开发付费兜底）',
    model: settings.model,
    endpoint: `${DEV_PAID_FALLBACK_ORIGIN}/chat/completions`,
    apiKey: settings.apiKey,
    source: 'byok',
    devPaidFallback: true,
    inputPerMillion: undefined,
    outputPerMillion: undefined,
    priceVersion: undefined,
    ...(output
      ? {
          writingOutput: {
            ...output,
            reasoningEffort: undefined,
            omitResponseFormatForRequest: undefined,
            ...(['native-coach-tools-v1', 'native-coach-json-v1'].includes(output.inferencePolicy)
              ? { inferencePolicy: 'native-coach-json-v1' as const, format: 'json_object' as const }
              : {}),
            ...(output.inferencePolicy === 'native-coach-tools-v1' ? {} : { format: 'json_object' as const })
          }
        }
      : {})
  };
}

export function devPaidFallbackMessages(config: ModelConfig, messages: LearningMessage[]): LearningMessage[] {
  const output = config.writingOutput;
  const rules = [
    ...(output &&
    output.inferencePolicy !== 'native-coach-tools-v1' &&
    !messages.some(
      (message) => typeof message.content === 'string' && message.content.includes(JSON.stringify(output.schema))
    )
      ? [`只输出一个 JSON 对象，不写其他文字；它必须符合下面的 JSON Schema：\n${JSON.stringify(output.schema)}`]
      : []),
    // json_object 要求提示里出现 json 一词。
    ...((output ? output.inferencePolicy !== 'native-coach-tools-v1' : config.capabilities.structured) &&
    !messages.some((message) => typeof message.content === 'string' && /json/i.test(message.content))
      ? ['只输出 JSON 对象。']
      : [])
  ];
  if (!rules.length) return messages;
  const [first, ...rest] = messages;
  return first?.role === 'system' && typeof first.content === 'string'
    ? [{ ...first, content: [first.content, ...rules].join('\n\n') }, ...rest]
    : [{ role: 'system', content: rules.join('\n\n') }, ...messages];
}

export async function callWithDevPaidFallback<T>(
  call: (model: ModelConfig, messages: LearningMessage[], origins: string[]) => Promise<T>,
  model: ModelConfig,
  messages: LearningMessage[],
  origins: string[],
  options: { enabled: boolean; stream: boolean; signal?: AbortSignal; armed?: boolean; quality?: boolean }
): Promise<{
  response: T;
  model: ModelConfig;
  paidFallback: { trigger: string; freeModel: string; model: string } | null;
}> {
  const image = messages.some(
    (message) => Array.isArray(message.content) && message.content.some((part) => part.type === 'image_url')
  );
  const paid = async (trigger: string, settings: { apiKey: string; model: string }) => {
    const fallback = devPaidFallbackModel(model, settings);
    const paidFallback = { trigger, freeModel: model.model, model: fallback.model };
    console.info('[dev-paid-fallback]', JSON.stringify(paidFallback));
    try {
      const response = await call(fallback, devPaidFallbackMessages(fallback, messages), [
        ...new Set([...origins, DEV_PAID_FALLBACK_ORIGIN])
      ]);
      return { response, model: fallback, paidFallback };
    } catch (paidError: any) {
      if (paidError instanceof ProviderError) paidError.message = `DeepSeek 兜底未完成：${paidError.message}`;
      throw paidError;
    }
  };
  const quality =
    options.quality && options.enabled && !options.stream && !image ? devPaidFallbackSettings(options.armed) : null;
  if (quality) return paid('QUALITY_REJECTED', { apiKey: quality.apiKey, model: quality.qualityModel });
  try {
    return { response: await call(model, messages, origins), model, paidFallback: null };
  } catch (error: any) {
    // 流式只在拿到正文前切换：限流与额度不足都在响应头阶段返回。
    const trigger =
      !options.enabled || options.signal?.aborted || image || !(error instanceof ProviderError)
        ? null
        : SWITCH_CODES.has(error.code)
          ? error.code
          : !options.stream && error.code === 'INVALID_RESPONSE'
            ? 'EMPTY_RESPONSE'
            : null;
    const settings = trigger ? devPaidFallbackSettings(options.armed) : null;
    if (!trigger || !settings) throw error;
    return paid(trigger, settings);
  }
}
