import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { validateVisualReading, visualReadingText } from '../learning-vision.js';
import { visualRecipe } from '../learning-visual.js';
import {
  createEventStreamParser,
  createUtf8StreamDecoder,
  redactModelValue,
  StreamError
} from '../learning-stream-codec.js';

export class ProviderError extends Error {
  upstreamStatus?: number;
  upstreamCode?: string;
  observed?: any;
  executionStage?: 'not_called';
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}
export function isPublicAddress(address: string): boolean {
  let ip = address.toLowerCase();
  if (isIP(ip) === 6) {
    ip = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    // 保守允许全球单播；拒绝 mapped IPv4、环回、链路、本地、NAT64 等转换地址。
    return (
      /^[23][0-9a-f]{3}:/.test(ip) &&
      !ip.startsWith('2001:db8:') &&
      !ip.startsWith('2002:') &&
      !ip.startsWith('2001:0:') &&
      !ip.startsWith('2001:0000:') &&
      !ip.startsWith('2001::') &&
      !/^2001:(?:0?2|0?1[0-9a-f]|0?20):/.test(ip)
    );
  }
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}
export function validateCloudEndpoint(raw: string, allowedOrigins: string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProviderError('ENDPOINT_INVALID', '模型地址不合法');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !allowedOrigins.includes(url.origin) ||
    (url.port && url.port !== '443')
  ) {
    throw new ProviderError('ENDPOINT_FORBIDDEN', '模型地址未获服务端授权');
  }
  if (isIP(url.hostname.replace(/^\[|\]$/g, '')) || url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    throw new ProviderError('SSRF_BLOCKED', '云端代理不允许本机或内网目标');
  }
  return url;
}
export async function resolveCloudEndpoint(raw: string, origins: string[], resolver = lookup) {
  const url = validateCloudEndpoint(raw, origins);
  let timer: ReturnType<typeof setTimeout>;
  const addresses = await Promise.race([
    resolver(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ProviderError('DNS_TIMEOUT', '模型域名解析超时')), 5000);
    })
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
    throw new ProviderError('SSRF_BLOCKED', '模型域名解析到禁止的网络地址');
  }
  return { url, address: addresses[0] };
}
export type ModelConfig = {
  id: string;
  provider: string;
  model: string;
  endpoint: string;
  apiKey?: string;
  source: 'platform' | 'byok';
  capabilities: { structured: boolean; tools: boolean; vision: boolean; stream: boolean };
  visionAdapter?: 'openai-image-url-v1';
  inputPerMillion?: number;
  outputPerMillion?: number;
  priceVersion?: string;
  maxOutput: number;
};
export type LearningMessage = {
  role: string;
  content: string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
};
export function buildLearningRequest(config: ModelConfig, messages: LearningMessage[], stream = false) {
  const endpoint = new URL(config.endpoint);
  // 适配只用于核对过的供应商和明确型号；不把任意文本模型当作具有同样能力。
  const thinking =
    ['https://api.z.ai', 'https://open.bigmodel.cn'].includes(endpoint.origin) && config.model === 'glm-4.7-flash'
      ? { thinking: { type: 'disabled' } }
      : endpoint.origin === 'https://generativelanguage.googleapis.com' && config.model === 'gemini-2.5-flash-lite'
        ? { reasoning_effort: 'none' }
        : {};
  return {
    model: config.model,
    messages,
    max_tokens: config.maxOutput,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...thinking,
    ...(config.capabilities.structured ? { response_format: { type: 'json_object' } } : {})
  };
}
export function createLearningProviderStream(config: ModelConfig, onPreview?: (raw: string) => void) {
  let content = '',
    actualModel: string | null = null,
    usage: any = null,
    finished: string | null = null,
    done = false;
  const parser = createEventStreamParser(({ data }) => {
    if (done) throw new ProviderError('INVALID_STREAM', '模型在结束后继续发送事件');
    if (data === '[DONE]') {
      done = true;
      return;
    }
    let chunk: any;
    try {
      chunk = JSON.parse(data);
    } catch {
      throw new ProviderError('INVALID_STREAM', '模型流式事件不是合法JSON');
    }
    if (!chunk || Array.isArray(chunk) || chunk.error) throw new ProviderError('UPSTREAM_FAILED', '模型流式任务失败');
    if (chunk.model !== undefined) {
      if (chunk.model !== config.model) throw new ProviderError('MODEL_MISMATCH', '上游真实模型与明确选择不一致');
      actualModel = chunk.model;
    }
    if (chunk.usage != null) {
      if (typeof chunk.usage !== 'object' || Array.isArray(chunk.usage) || JSON.stringify(chunk.usage).length > 8192)
        throw new ProviderError('INVALID_USAGE', '模型用量结构不合法');
      if (usage && JSON.stringify(usage) !== JSON.stringify(chunk.usage))
        throw new ProviderError('INVALID_USAGE', '模型返回了不一致的总用量');
      usage = chunk.usage;
    }
    if (!Array.isArray(chunk.choices) || chunk.choices.length > 1)
      throw new ProviderError('INVALID_STREAM', '仅支持一份模型输出');
    const choice = chunk.choices[0];
    if (!choice) return;
    if (choice.index !== 0 || !choice.delta || typeof choice.delta !== 'object' || Array.isArray(choice.delta))
      throw new ProviderError('INVALID_STREAM', '模型流式选择结构不合法');
    if (choice.delta.tool_calls?.length || choice.delta.function_call)
      throw new ProviderError('TOOL_FORBIDDEN', '原生工具片段未获执行授权');
    if (choice.delta.content != null) {
      if (finished || typeof choice.delta.content !== 'string')
        throw new ProviderError('INVALID_STREAM', '模型内容未完整绑定');
      content += choice.delta.content;
      if (content.length > 30000) throw new ProviderError('RESPONSE_LIMIT', '模型内容超过限制');
      if (actualModel) onPreview?.(content);
    }
    if (choice.finish_reason != null) {
      if (finished || !['stop', 'length', 'content_filter'].includes(choice.finish_reason))
        throw new ProviderError('INVALID_STREAM', '模型结束类型不受支持');
      finished = choice.finish_reason;
    }
  });
  return {
    feed: parser.feed,
    observed: () => ({ usage, actualModel, usageComplete: Boolean(done && finished) }),
    end() {
      parser.end();
      if (!done || !finished || !actualModel || !content.trim())
        throw new ProviderError('INCOMPLETE_STREAM', '模型流未完整结束');
      if (finished !== 'stop') throw new ProviderError('INCOMPLETE_OUTPUT', '模型输出被截断或过滤，未执行教学工具');
      return { content, usage, actualModel, usageComplete: true };
    }
  };
}
export function callStreamingLearningProvider(
  config: ModelConfig,
  messages: LearningMessage[],
  origins: string[],
  options: { signal?: AbortSignal; onPreview?: (raw: string) => void } = {}
) {
  if (config.capabilities.stream !== true) throw new ProviderError('STREAM_UNSUPPORTED', '指定型号未开放流式能力');
  return callLearningProvider(config, messages, origins, options.signal, { onPreview: options.onPreview });
}
export async function callLearningProvider(
  config: ModelConfig,
  messages: LearningMessage[],
  origins: string[],
  signal?: AbortSignal,
  streamOptions?: { onPreview?: (raw: string) => void }
) {
  if (signal?.aborted)
    throw signal.reason instanceof ProviderError ? signal.reason : new ProviderError('CANCELLED', '请求已取消');
  let resolved: Awaited<ReturnType<typeof resolveCloudEndpoint>>;
  try {
    resolved = await resolveCloudEndpoint(config.endpoint, origins);
  } catch (error) {
    if (error instanceof ProviderError) error.executionStage = 'not_called';
    throw error;
  }
  if (signal?.aborted) {
    const error = signal.reason instanceof ProviderError ? signal.reason : new ProviderError('CANCELLED', '请求已取消');
    error.executionStage = 'not_called';
    throw error;
  }
  const { url, address } = resolved;
  const body = JSON.stringify(buildLearningRequest(config, messages, Boolean(streamOptions)));
  const started = Date.now();
  const stream = streamOptions ? createLearningProviderStream(config, streamOptions.onPreview) : null;
  const raw = await new Promise<any>((resolve, reject) => {
    // DNS 校验后的地址固定给 socket；TLS 仍检查原始 hostname，禁止任何重定向。
    const req = https.request(
      url,
      {
        method: 'POST',
        agent: false,
        signal,
        lookup: (_host, options: any, callback: any) =>
          options?.all ? callback(null, [address]) : callback(null, address.address, address.family),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          const code =
            res.statusCode === 429
              ? 'RATE_LIMITED'
              : res.statusCode === 401
                ? 'KEY_REJECTED'
                : res.statusCode === 402
                  ? 'UPSTREAM_QUOTA'
                  : 'UPSTREAM_FAILED';
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size <= 65536) chunks.push(chunk);
          });
          res.on('end', () => {
            const error = new ProviderError(code, '模型服务未成功返回；不会替换供应商或启用付费路由');
            error.upstreamStatus = res.statusCode;
            try {
              const rawCode = String(JSON.parse(Buffer.concat(chunks).toString('utf8'))?.error?.code || '');
              if (/^[a-zA-Z0-9_-]{1,40}$/.test(rawCode)) error.upstreamCode = rawCode;
            } catch {
              /* 不保存上游原始错误内容，避免回显密钥或私人消息 */
            }
            reject(error);
          });
          res.on('error', () => reject(new ProviderError('UPSTREAM_FAILED', '模型响应中断')));
          return;
        }
        if (stream && !/^text\/event-stream(?:;|$)/i.test(String(res.headers['content-type'] || ''))) {
          req.destroy(new ProviderError('STREAM_UNSUPPORTED', '指定模型没有返回SSE流，不自动改走其他消费路径'));
          return;
        }
        const decoder = stream ? createUtf8StreamDecoder(1024 * 1024) : null;
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1024 * 1024) req.destroy(new ProviderError('RESPONSE_LIMIT', '模型输出超过限制'));
          else if (stream) {
            try {
              stream.feed(decoder!.feed(chunk));
            } catch (error) {
              req.destroy(error as Error);
            }
          } else chunks.push(chunk);
        });
        res.on('error', () => reject(new ProviderError('UPSTREAM_FAILED', '模型响应中断')));
        res.on('end', () => {
          try {
            if (stream) {
              decoder!.end();
              resolve(stream.end());
            } else resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(stream ? error : new ProviderError('INVALID_RESPONSE', '模型响应不是合法 JSON'));
          }
        });
      }
    );
    const timer = setTimeout(() => req.destroy(new ProviderError('TIMEOUT', '模型请求超时')), 30000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', (err: any) =>
      reject(
        signal?.aborted && signal.reason instanceof ProviderError
          ? signal.reason
          : err instanceof ProviderError
            ? err
            : err instanceof StreamError
              ? new ProviderError(err.code, err.message)
              : new ProviderError(signal?.aborted ? 'CANCELLED' : 'UPSTREAM_FAILED', '模型连接失败')
      )
    );
    req.end(body);
  }).catch((error) => {
    if (stream)
      error.observed = redactModelValue({ ...stream.observed(), durationMs: Date.now() - started }, config.apiKey);
    throw error;
  });
  const content = stream ? raw.content : raw?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim() || content.length > 30000)
    throw new ProviderError('INVALID_RESPONSE', '模型没有返回有效内容');
  // 原始 usage 保存全部账单字段；无法确认用量时保持 pending，不按零成本结算。
  const usage = raw.usage && typeof raw.usage === 'object' ? raw.usage : null;
  return {
    content,
    usage,
    actualModel: stream ? raw.actualModel : typeof raw.model === 'string' ? raw.model : config.model,
    durationMs: Date.now() - started,
    ...(stream ? { usageComplete: raw.usageComplete } : {})
  };
}
export function parseVisualOutput(raw: string, source: any) {
  try {
    const json = raw.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)?.[1] || raw;
    const value = JSON.parse(json);
    if (
      !value ||
      Array.isArray(value) ||
      Object.keys(value).some((k) => !['message', 'visualReading', 'tools', 'question'].includes(k)) ||
      value.question != null ||
      (value.tools !== undefined && (!Array.isArray(value.tools) || value.tools.length))
    )
      throw new Error('图片解读不能执行教学写入或生成已核验题目');
    const visualReading = validateVisualReading(value.visualReading, source);
    return { message: visualReadingText(visualReading), visualReading, question: null, tools: [], structured: true };
  } catch {
    throw new ProviderError('VISUAL_OUTPUT_INVALID', '图片解读未通过角色、疑义或权限校验；未记作答、错题或计划');
  }
}
export function parseLearningOutput(raw: string) {
  let output: any;
  try {
    // 文本协议的单一JSON围栏可适配；仍走同一结构/权限校验，绝不执行围栏内容。
    const json = raw.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)?.[1] || raw;
    output = JSON.parse(json);
  } catch {
    return { message: raw.slice(0, 8000), tools: [], question: null, structured: false };
  }
  if (
    !output ||
    Array.isArray(output) ||
    typeof output.message !== 'string' ||
    !output.message.trim() ||
    output.message.length > 8000 ||
    (output.tools && (!Array.isArray(output.tools) || output.tools.length > 3))
  ) {
    throw new ProviderError('INVALID_STRUCTURE', '模型输出结构不合法');
  }
  const tools = output.tools || [];
  if (
    tools.some(
      (call: any) =>
        !call ||
        !['progress', 'visualize', 'method', 'hint', 'assess', 'plan'].includes(call.name) ||
        !call.arguments ||
        typeof call.arguments !== 'object' ||
        Array.isArray(call.arguments)
    )
  ) {
    throw new ProviderError('TOOL_FORBIDDEN', '模型请求了未授权的工具');
  }
  for (const call of tools) {
    if (call.name !== 'visualize') continue;
    try {
      visualRecipe(call.arguments);
    } catch {
      throw new ProviderError('VISUAL_OUTPUT_INVALID', '动态演示只接受已校验模板和有界物理参数');
    }
  }
  // 模型生成题只能待复核；模型不能指定 verified、答案权威或私人题发布状态。
  let question = null;
  if (output.question) {
    const q = output.question;
    if (
      typeof q.prompt !== 'string' ||
      !q.prompt.trim() ||
      q.prompt.length > 5000 ||
      (q.options &&
        (!Array.isArray(q.options) ||
          q.options.length > 8 ||
          q.options.some((s: any) => typeof s !== 'string' || s.length > 1000)))
    ) {
      throw new ProviderError('INVALID_STRUCTURE', '模型题目结构不合法');
    }
    question = {
      prompt: q.prompt,
      options: q.options || [],
      subject: String(q.subject || '综合').slice(0, 100),
      knowledgePoint: String(q.knowledgePoint || '当前任务').slice(0, 100),
      scope: 'generated',
      validation: null,
      source: { kind: 'model_generated', verified: false },
      uncertainties: []
    };
  }
  return { message: output.message, tools, question, structured: true };
}

// 旧诊断调用缺少任务预算和用户模型选择，保持禁用，等待迁移到 proxy-ai。
export function getBudgetedLegacyProvider(): { chat: (...args: any[]) => Promise<any> } {
  throw new ProviderError('LEGACY_BUDGET_REQUIRED', '旧 AI 诊断尚未接入授权和成本账，请使用对话学习入口');
}
