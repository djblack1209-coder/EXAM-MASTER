import { normalizeContentBlocks } from '../learning-content-blocks.js';
import https from 'node:https';
import { lookup, Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import crypto from 'node:crypto';
import {
  normalizeRubric,
  assessWithRubric,
  RUBRIC_EVIDENCE_CONTRACT,
  WRITING_FEEDBACK_OUTPUT_CONTRACT
} from '../learning-rubric.js';
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
// An explicit backend-only resolver is isolated from macOS/shared DNS settings.
// Every returned address still passes the same public-address guard and socket pinning.
export async function learningLookup(host: string, _options: any): Promise<{ address: string; family: number }[]> {
  const configured = process.env.LEARNING_DNS_SERVERS;
  if (!configured) return lookup(host, { all: true, verbatim: true });
  const servers = configured.split(',').map((s) => s.trim());
  if (!servers.length || servers.length > 3 || servers.some((s) => !isIP(s) || !isPublicAddress(s)))
    throw new ProviderError('DNS_CONFIG_INVALID', '模型解析器配置不合法');
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  resolver.setServers(servers);
  try {
    const families = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
    const addresses: { address: string; family: number }[] = [];
    for (const [index, result] of families.entries()) {
      if (result.status === 'fulfilled')
        addresses.push(...result.value.map((address) => ({ address, family: index === 0 ? 4 : 6 })));
      else if (!['ENODATA', 'ENOTFOUND'].includes(result.reason?.code)) throw result.reason;
    }
    return addresses;
  } finally {
    resolver.cancel();
  }
}
export async function resolveCloudEndpoint(raw: string, origins: string[], resolver = learningLookup) {
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
  writingOutput?: {
    contract: string;
    inferencePolicy: 'groq-writing-strict-v1';
    reasoningEffort: 'low';
    schemaDigest: string;
    schema: any;
  };
};
export type LearningMessage = {
  role: string;
  content: string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
};
export function writingFeedbackContext(body: any) {
  if (body.feedbackAttemptId === undefined && body.feedbackOutputContract === undefined) return null;
  const question = body.learningContext?.question,
    attempt = body.learningContext?.attempt;
  if (
    body.feedbackOutputContract !== WRITING_FEEDBACK_OUTPUT_CONTRACT ||
    typeof body.feedbackAttemptId !== 'string' ||
    !body.feedbackAttemptId.trim() ||
    body.feedbackAttemptId.length > 150 ||
    attempt?.id !== body.feedbackAttemptId ||
    typeof attempt?.answer !== 'string' ||
    !attempt.answer.trim() ||
    attempt.answer.length > 10000 ||
    typeof question?.questionKey !== 'string' ||
    question.questionKey.length > 500 ||
    !/^.+@[1-9][0-9]*$/.test(question.questionKey) ||
    body.images !== undefined
  )
    throw new ProviderError('WRITING_CONTEXT_INVALID', '写作反馈需绑定当前已保存原答、题目和输出版本');
  try {
    const rubric = normalizeRubric(question.rubric);
    const split = question.questionKey.lastIndexOf('@');
    const version = Number(question.questionKey.slice(split + 1));
    if (!Number.isSafeInteger(version)) throw new Error('题目版本不合法');
    return {
      question: { ...question, id: question.questionKey.slice(0, split), version, rubric },
      attempt,
      contract: WRITING_FEEDBACK_OUTPUT_CONTRACT
    };
  } catch {
    throw new ProviderError('WRITING_CONTEXT_INVALID', '写作反馈需要有效的当前评分维度和题目版本');
  }
}
function writingFeedbackSchema(feedback: NonNullable<ReturnType<typeof writingFeedbackContext>>) {
  const closed = (properties: Record<string, any>) => ({
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false
  });
  const evidence = {
    type: 'array',
    description: '最多3段原答；优先唯一原文字符串，重复原文可用完整UTF-16范围。给分必须引用。',
    items: {
      anyOf: [
        { type: 'string' },
        closed({ quote: { type: 'string' }, start: { type: 'integer' }, end: { type: 'integer' } })
      ]
    }
  };
  const dimensions = {
    type: 'array',
    description: '逐一覆盖所有评分维度，不重复。任何疑义未解决时全部score为null。',
    items: {
      anyOf: feedback.question.rubric.criteria.map((criterion: any) =>
        closed({
          criterionId: { type: 'string', enum: [criterion.id] },
          score: {
            // 数值枚举有供应商额外限制；这里只限定类型，半分和上限仍由原宿主规则拒绝校验。
            type: ['number', 'null'],
            description: `按0.5分递增，0至${criterion.maxScore}分；无法判断或有疑义时为null。`
          },
          feedback: { type: 'string' },
          evidence
        })
      )
    }
  };
  return closed({
    message: { type: 'string' },
    tools: {
      type: 'array',
      description: '仅一项assess，其他工具由宿主拒绝。',
      items: closed({
        name: { type: 'string', enum: ['assess'] },
        arguments: closed({
          attemptId: { type: 'string', enum: [feedback.attempt.id] },
          rubricId: { type: 'string', enum: [feedback.question.rubric.id] },
          outcome: {
            type: 'string',
            enum: ['correct', 'wrong', 'partial', 'uncertain'],
            description: '任一维度null为uncertain；满分correct、零分wrong、其余partial。'
          },
          feedback: { type: 'string' },
          dimensions
        })
      })
    }
  });
}
export function prepareWritingFeedbackModel(
  config: ModelConfig,
  feedback: ReturnType<typeof writingFeedbackContext>,
  stream = false
): ModelConfig {
  if (!feedback) return config;
  if (
    config.source !== 'byok' ||
    config.endpoint !== 'https://api.groq.com/openai/v1/chat/completions' ||
    config.model !== 'openai/gpt-oss-20b'
  )
    return config;
  if (!config.capabilities.structured)
    throw new ProviderError('WRITING_FORMAT_UNSUPPORTED', '此写作路径需要模型已声明结构化能力');
  if (stream) throw new ProviderError('WRITING_STREAM_UNSUPPORTED', '此写作格式不支持流式，请主动选择非流式');
  const schema = writingFeedbackSchema(feedback);
  return {
    ...config,
    maxOutput: 2000,
    writingOutput: {
      contract: feedback.contract,
      inferencePolicy: 'groq-writing-strict-v1',
      reasoningEffort: 'low',
      schemaDigest: crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex'),
      schema
    }
  };
}
export function validateWritingFeedbackOutput(
  raw: string,
  feedback: NonNullable<ReturnType<typeof writingFeedbackContext>>
) {
  try {
    const value = JSON.parse(raw.trim().match(/^\x60\x60\x60(?:json)?\s*\n?([\s\S]*?)\n?\x60\x60\x60$/i)?.[1] || raw);
    const keys = (item: any, allowed: string[]) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      Object.keys(item).every((key) => allowed.includes(key));
    const call = value?.tools?.[0],
      args = call?.arguments;
    if (
      !keys(value, ['message', 'tools']) ||
      typeof value.message !== 'string' ||
      !value.message.trim() ||
      value.message.length > 8000 ||
      !Array.isArray(value.tools) ||
      value.tools.length !== 1 ||
      !keys(call, ['name', 'arguments']) ||
      call.name !== 'assess' ||
      !keys(args, ['attemptId', 'rubricId', 'outcome', 'feedback', 'dimensions']) ||
      args.attemptId !== feedback.attempt.id ||
      args.rubricId !== feedback.question.rubric.id ||
      typeof args.feedback !== 'string' ||
      !args.feedback.trim() ||
      args.feedback.length > 2000
    )
      throw new Error('写作反馈只评阅当前原答，必须完整绑定评分维度');
    assessWithRubric(feedback.question, feedback.attempt, { ...args, rubricContract: RUBRIC_EVIDENCE_CONTRACT });
  } catch (error: any) {
    // 不补编号、不包裹错误数组、不修复范围；真正保存仍由客户端核对当前事实与停止状态。
    throw new ProviderError(
      'WRITING_OUTPUT_INVALID',
      error.message === '写作反馈只评阅当前原答，必须完整绑定评分维度'
        ? error.message
        : '写作反馈与当前评分维度或原答引用不符，未执行工具'
    );
  }
}
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
    ...(config.writingOutput
      ? {
          reasoning_effort: config.writingOutput.reasoningEffort,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'writing_feedback_v1',
              strict: true,
              schema: config.writingOutput.schema
            }
          }
        }
      : config.capabilities.structured
        ? { response_format: { type: 'json_object' } }
        : {})
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
  const contentBlocks = output.contentBlocks === undefined ? null : normalizeContentBlocks(output.contentBlocks);
  return { message: output.message, tools, question, structured: true, ...(contentBlocks ? { contentBlocks } : {}) };
}

// 旧诊断调用缺少任务预算和用户模型选择，保持禁用，等待迁移到 proxy-ai。
export function getBudgetedLegacyProvider(): { chat: (...args: any[]) => Promise<any> } {
  throw new ProviderError('LEGACY_BUDGET_REQUIRED', '旧 AI 诊断尚未接入授权和成本账，请使用对话学习入口');
}
