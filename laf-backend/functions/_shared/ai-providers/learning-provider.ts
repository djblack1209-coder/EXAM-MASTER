import { MODEL_TOOL_NAMES } from '../learning-runtime-policy.js';
import { ENTRY_TOOL_NAMES, validateEntryCall, validateEntrySchema } from '../learning-entries.js';
import { normalizeContentBlocks } from '../learning-content-blocks.js';
import https from 'node:https';
import { lookup, Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import crypto from 'node:crypto';
import { modelInferenceParameters } from './free-model-presets.js';
import { DEV_TEST } from '../build-channel.js';
import { WRITING_METHOD, COACH_FEEDBACK_VERSION, COACH_FEEDBACK_CLASSES } from '../learning-writing-coach.js';
import {
  normalizeRubric,
  assessWithRubric,
  RUBRIC_EVIDENCE_CONTRACT,
  WRITING_FEEDBACK_OUTPUT_CONTRACT,
  writingBandExample
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
// Detection only; callers must never use the redacted value as business input.
export function modelValueHasKeyEcho(value: any, key?: string) {
  if (!key) return false;
  const filtered = redactModelValue(value, key);
  return typeof value === 'string' ? filtered !== value : JSON.stringify(filtered) !== JSON.stringify(value);
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
  timeoutMs?: number;
  capabilityProbe?: { stage: 'tool' | 'json'; nonce: string; toolCall?: any };
  capabilityCheck?: { version: number; tools: boolean; structured: boolean; checkedAt: number };
  plainCoachRequest?: string;
  writingOutput?: {
    contract: string;
    inferencePolicy:
      | 'groq-writing-strict-v1'
      | 'groq-writing-json-object-v1'
      | 'groq-writing-plain-batch-v1'
      | 'local-writing-plain-v1';
    format?: 'json_object';
    omitResponseFormatForRequest?: string;
    feedbackVersion?: number;
    reasoningEffort: 'low' | 'high';
    schemaDigest: string;
    schema: any;
  };
};
export type LearningMessage = {
  role: string;
  tool_calls?: any[];
  tool_call_id?: string;
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
const closed = (properties: Record<string, any>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false
});
function writingFeedbackSchema(feedback: NonNullable<ReturnType<typeof writingFeedbackContext>>) {
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
export function prepareCoachFeedbackModel(
  config: ModelConfig,
  request: any,
  stream = false,
  allowSummary = false,
  allowPlain = false
): ModelConfig {
  const plain =
    allowPlain &&
    config.endpoint === 'https://openrouter.ai/api/v1/chat/completions' &&
    config.model === 'nvidia/nemotron-3-ultra-550b-a55b:free';
  if (
    !DEV_TEST ||
    !request ||
    (!['feedback', 'essay'].includes(request.phase) && !(allowSummary && request.phase === 'summary')) ||
    !['english1', 'english2', 'general'].includes(request.exam) ||
    (config.source !== 'byok' && !plain) ||
    (!plain &&
      (config.endpoint !== 'https://api.groq.com/openai/v1/chat/completions' || config.model !== 'openai/gpt-oss-120b'))
  )
    return config;
  if (!config.capabilities.structured && !plain)
    throw new ProviderError('WRITING_FORMAT_UNSUPPORTED', '此点评路径需要结构化能力');
  if (stream) throw new ProviderError('WRITING_STREAM_UNSUPPORTED', '此严格格式不支持流式，请主动选择非流式');
  const string = { type: 'string' },
    strings = { type: 'array', items: string };
  const coach: Record<string, any> =
    request.phase === 'summary'
      ? {
          kind: { type: 'string', enum: ['summary'] },
          learned: { ...strings, items: { ...string, minLength: 1, maxLength: 400 }, minItems: 1, maxItems: 6 },
          tomorrow: { ...strings, items: { ...string, minLength: 1, maxLength: 400 }, minItems: 1, maxItems: 4 }
        }
      : {
          kind: { type: 'string', enum: [request.phase] },
          target: { type: 'string', enum: [request.target] },
          lines: {
            type: 'array',
            description: '1至6条，原文逐字引用，advice与rewrite必须非空。',
            items: closed({ original: string, advice: string, rewrite: string })
          },
          weaknesses: strings,
          strengths: strings,
          strengthEvidence: { type: 'array', items: closed({ label: string, quote: string }) },
          phrases: { ...strings, items: { ...string, minLength: 1, maxLength: 240 }, maxItems: 6 },
          dimensions: {
            type: 'array',
            items: closed({
              name: { type: 'string', enum: WRITING_METHOD.feedback },
              comment: string,
              ...(request.dimensionContract
                ? {
                    score: { type: ['integer', 'null'], enum: [0, 1, 2, null] },
                    evidence: { type: 'array', items: string, maxItems: 3 }
                  }
                : {})
            })
          }
        };
  if (request.feedbackVersion === COACH_FEEDBACK_VERSION)
    coach.weaknessEvidence = {
      type: 'array',
      items: closed({ label: string, quote: string, classification: { type: 'string', enum: COACH_FEEDBACK_CLASSES } })
    };
  if (request.writingBand) {
    const example = writingBandExample(request.writingBand, request.input);
    coach.bandResult = closed({
      contract: { type: 'string', enum: [example.contract] },
      binding: closed(
        Object.fromEntries(
          Object.entries(example.binding).map(([key, value]) => [
            key,
            typeof value === 'number'
              ? { type: 'integer', description: `固定为${value}，精确值由原宿主绑定校验。` }
              : { type: 'string', enum: [value] }
          ])
        )
      ),
      status: { type: 'string', enum: ['observation_only'] },
      nullReason: { type: 'null' },
      band: { type: 'null' },
      bandRange: { type: 'null' },
      scoreEstimate: { type: 'null' },
      maxScore: { type: 'null' },
      taskCoverage: { ...strings, description: '本次没有结构化任务点，必须为空数组。' },
      observations: {
        type: 'array',
        description: '最多两项，只观察语言和衔接。',
        items: closed({
          key: { type: 'string', enum: ['language', 'cohesion'] },
          evidenceSpans: {
            type: 'array',
            items: closed({ quote: string, start: { type: 'integer' }, end: { type: 'integer' } })
          },
          note: string
        })
      },
      integrityFlags: { ...strings, description: '本次必须为空数组。' }
    });
  }
  const schema = closed({
    message: string,
    question: { type: 'null' },
    tools: { ...strings, description: '必须为空数组，不使用工具。' },
    coach: closed(coach)
  });
  return {
    ...config,
    maxOutput: 8192,
    writingOutput: {
      contract: request.contract,
      inferencePolicy: plain ? 'local-writing-plain-v1' : 'groq-writing-strict-v1',
      ...(plain ? { format: 'json_object' as const } : {}),
      ...(request.feedbackVersion === COACH_FEEDBACK_VERSION ? { feedbackVersion: COACH_FEEDBACK_VERSION } : {}),
      reasoningEffort: 'high',
      schemaDigest: crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex'),
      schema
    }
  };
}
export function validateCoachSchema(schema: any, value: any) {
  try {
    validateEntrySchema(schema, value, { exact: true });
  } catch (error: any) {
    throw Object.assign(new ProviderError('COACH_INVALID', '模型响应未通过完整字段合同'), {
      path: error.path || 'root',
      schemaKeyword: error.keyword || 'schema'
    });
  }
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
function coachResponseFunction(config: ModelConfig) {
  return DEV_TEST &&
    config.plainCoachRequest &&
    config.writingOutput?.format === 'json_object' &&
    config.model === 'nvidia/nemotron-3-ultra-550b-a55b:free' &&
    config.endpoint === 'https://openrouter.ai/api/v1/chat/completions'
    ? {
        name: 'yozi_coach_response',
        description: 'Return the complete teaching response as arguments. No action is executed.',
        parameters: config.writingOutput.schema
      }
    : null;
}
export function readCoachFunctionResponse(config: ModelConfig, raw: any): string | null {
  const expected = coachResponseFunction(config);
  if (!expected) return null;
  const choice = raw?.choices?.[0],
    message = choice?.message,
    call = message?.tool_calls?.[0];
  if (
    !Array.isArray(raw?.choices) ||
    raw.choices.length !== 1 ||
    choice?.finish_reason !== 'tool_calls' ||
    (message?.content != null && message.content !== '') ||
    !Array.isArray(message?.tool_calls) ||
    message.tool_calls.length !== 1 ||
    call?.type !== 'function' ||
    call.function?.name !== expected.name ||
    typeof call.function.arguments !== 'string'
  )
    throw Object.assign(new ProviderError('COACH_INVALID', '模型未按本次教学格式返回，原答已保留'), { path: 'tools' });
  return call.function.arguments;
}
export function buildLearningRequest(config: ModelConfig, messages: LearningMessage[], stream = false) {
  if (config.capabilityProbe) {
    const probe = config.capabilityProbe;
    return {
      model: config.model,
      messages,
      max_tokens: 256,
      stream: false,
      ...(probe.stage === 'tool'
        ? {
            tools: [
              {
                type: 'function',
                function: {
                  name: 'yozi_capability_echo',
                  description: 'Echo the exact nonce; this only tests transport.',
                  parameters: closed({ nonce: { type: 'string', enum: [probe.nonce] } })
                }
              }
            ],
            tool_choice: { type: 'function', function: { name: 'yozi_capability_echo' } }
          }
        : {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'yozi_capability_result',
                strict: true,
                schema: closed({
                  nonce: { type: 'string', enum: [probe.nonce] },
                  accepted: { type: 'boolean', enum: [true] }
                })
              }
            }
          })
    };
  }
  const endpoint = new URL(config.endpoint);
  const responseFunction = coachResponseFunction(config);
  // 适配只用于核对过的供应商和明确型号；不把任意文本模型当作具有同样能力。
  const thinking =
    modelInferenceParameters(config) ||
    (endpoint.origin === 'https://api.z.ai' && config.model === 'glm-4.5-flash'
      ? { thinking: { type: 'disabled' } }
      : endpoint.origin === 'https://generativelanguage.googleapis.com' && config.model === 'gemini-2.5-flash-lite'
        ? { reasoning_effort: 'none' }
        : endpoint.origin === 'https://integrate.api.nvidia.com' && config.model === 'openai/gpt-oss-20b'
          ? { reasoning_effort: 'low' }
          : {});
  return {
    model: config.model,
    messages,
    ...(DEV_TEST && config.writingOutput && config.model === 'openai/gpt-oss-120b'
      ? { max_completion_tokens: config.maxOutput }
      : { max_tokens: config.maxOutput }),
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...thinking,
    ...(DEV_TEST && config.writingOutput?.inferencePolicy === 'local-writing-plain-v1' ? { temperature: 0 } : {}),
    ...(responseFunction
      ? {
          tools: [{ type: 'function', function: responseFunction }],
          tool_choice: { type: 'function', function: { name: responseFunction.name } }
        }
      : config.writingOutput
        ? {
            ...(config.writingOutput.inferencePolicy === 'local-writing-plain-v1'
              ? {}
              : { reasoning_effort: config.writingOutput.reasoningEffort }),
            response_format:
              config.writingOutput.format === 'json_object'
                ? { type: 'json_object' }
                : {
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
    if (choice.finish_reason != null && choice.finish_reason !== '') {
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
// Shape only: never retain reply text, reasoning text, headers or arbitrary upstream names.
export function learningResponseShape(raw: any) {
  const type = (value: any) =>
    value === undefined ? 'missing' : value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const choice = raw?.choices?.[0];
  const message = choice?.message;
  const shape: Record<string, any> = {
    envelopeType: type(raw),
    choicesType: type(raw?.choices),
    choiceType: type(choice),
    messageType: type(message),
    finishReasonType: type(choice?.finish_reason),
    finishReason: [
      'stop',
      'length',
      'content_filter',
      'tool_calls',
      'function_call',
      'end_turn',
      'max_tokens'
    ].includes(choice?.finish_reason)
      ? choice.finish_reason
      : 'other'
  };
  for (const field of ['content', 'reasoning_content', 'reasoning', 'thinking']) {
    shape[`${field}Type`] = type(message?.[field]);
    if (typeof message?.[field] === 'string') shape[`${field}Chars`] = message[field].length;
  }
  return shape;
}
export async function callLearningProvider(
  config: ModelConfig,
  messages: LearningMessage[],
  origins: string[],
  signal?: AbortSignal,
  streamOptions?: { onPreview?: (raw: string) => void },
  captureDiagnostics = false
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
  const wire: Record<string, unknown> = buildLearningRequest(config, messages, Boolean(streamOptions));
  if (
    DEV_TEST &&
    ((config.model === 'openai/gpt-oss-120b' &&
      config.endpoint === 'https://api.groq.com/openai/v1/chat/completions') ||
      (config.model === 'nvidia/nemotron-3-ultra-550b-a55b:free' &&
        config.endpoint === 'https://openrouter.ai/api/v1/chat/completions')) &&
    (config.writingOutput?.omitResponseFormatForRequest || config.plainCoachRequest)
  )
    delete wire.response_format;
  const body = JSON.stringify(wire);
  const timeoutMs = config.timeoutMs === 60000 ? 60000 : 30000;
  const traceSafeModel =
    DEV_TEST &&
    ((config.model === 'openai/gpt-oss-120b' && url.origin === 'https://api.groq.com') ||
      (config.model === 'glm-4.7-flash' && url.origin === 'https://api.z.ai') ||
      (config.plainCoachRequest &&
        config.model === 'nvidia/nemotron-3-ultra-550b-a55b:free' &&
        url.origin === 'https://openrouter.ai'));
  const started = Date.now();
  const stream = streamOptions ? createLearningProviderStream(config, streamOptions.onPreview) : null;
  let observed: any = null;
  const raw = await new Promise<any>((resolve, reject) => {
    // DNS 校验后的地址固定给 socket；TLS 仍检查原始 hostname，禁止任何重定向。
    if (traceSafeModel) {
      const outbound = JSON.parse(body);
      const schema = outbound.response_format?.json_schema?.schema;
      const promptSchema =
        config.writingOutput?.format === 'json_object' ? JSON.stringify(config.writingOutput.schema) : null;
      const schemaInPrompt =
        promptSchema &&
        outbound.messages.some(
          (message: any) => typeof message.content === 'string' && message.content.includes(promptSchema)
        );
      console.info(
        '[model-outbound]',
        JSON.stringify({
          model: outbound.model,
          messageChars: outbound.messages.reduce(
            (sum: number, item: LearningMessage) => sum + (typeof item.content === 'string' ? item.content.length : 0),
            0
          ),
          response_formatPresent: Object.hasOwn(outbound, 'response_format'),
          response_format: {
            type: outbound.response_format?.type || null,
            json_schema: { strict: outbound.response_format?.json_schema?.strict ?? null }
          },
          stream: outbound.stream === true,
          toolsPresent: Object.hasOwn(outbound, 'tools'),
          toolsCount: Array.isArray(outbound.tools) ? outbound.tools.length : 0,
          max_completion_tokens: Number.isInteger(outbound.max_completion_tokens)
            ? outbound.max_completion_tokens
            : null,
          max_tokens: Number.isInteger(outbound.max_tokens) ? outbound.max_tokens : null,
          reasoning_formatPresent: Object.hasOwn(outbound, 'reasoning_format'),
          reasoning_effort: outbound.reasoning_effort || null,
          reasoning: outbound.reasoning?.effort || null,
          thinkingType: outbound.thinking?.type || null,
          timeoutMs,
          include_reasoning: typeof outbound.include_reasoning === 'boolean' ? outbound.include_reasoning : null,
          schemaHash: schema ? crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex') : null,
          feedbackVersion: config.writingOutput?.feedbackVersion || null,
          promptSchemaHash: schemaInPrompt ? crypto.createHash('sha256').update(promptSchema!).digest('hex') : null
        })
      );
    }
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
        if (traceSafeModel) console.info('[model-http]', JSON.stringify({ httpStatus: res.statusCode || null }));
        const countDecodedBytes = !res.headers['content-encoding'] || res.headers['content-encoding'] === 'identity';
        if (captureDiagnostics && !stream) {
          const mime = String(res.headers['content-type'] || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
          observed = {
            usage: null,
            actualModel: config.model,
            responseDiagnostics: {
              httpStatus: res.statusCode || 0,
              networkStage: 'headers',
              mimeCategory:
                mime === 'application/json'
                  ? 'json'
                  : mime === 'text/event-stream'
                    ? 'sse'
                    : mime.startsWith('text/')
                      ? 'text'
                      : mime
                        ? 'other'
                        : 'missing'
            }
          };
        }
        if (res.statusCode !== 200) {
          const code =
            res.statusCode === 429
              ? 'RATE_LIMITED'
              : [401, 403].includes(res.statusCode || 0)
                ? 'KEY_REJECTED'
                : res.statusCode === 402
                  ? 'UPSTREAM_QUOTA'
                  : [404, 410].includes(res.statusCode || 0)
                    ? 'MODEL_NOT_FOUND'
                    : 'UPSTREAM_FAILED';
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (observed && countDecodedBytes) observed.responseDiagnostics.responseBytes = size;
            if (size <= 65536) chunks.push(chunk);
          });
          res.on('end', () => {
            if (observed) observed.responseDiagnostics.networkStage = 'received';
            const error = new ProviderError(code, '模型服务未成功返回；不会替换供应商或启用付费路由');
            error.upstreamStatus = res.statusCode;
            let rateLimit: Record<string, string | number> | null = null;
            try {
              const upstreamError = JSON.parse(Buffer.concat(chunks).toString('utf8'))?.error;
              const rawCode = String(upstreamError?.code || '');
              if (/^[a-zA-Z0-9_-]{1,40}$/.test(rawCode) && !modelValueHasKeyEcho(rawCode, config.apiKey))
                error.upstreamCode = rawCode;
              if (['insufficient_quota', 'billing_hard_limit_reached', 'quota_exceeded'].includes(rawCode))
                error.code = 'UPSTREAM_QUOTA';
              const message = typeof upstreamError?.message === 'string' ? upstreamError.message : '';
              const unit = message.match(/\b(TPM|TPD|RPM|RPD)\b/)?.[1];
              if (traceSafeModel && unit) {
                rateLimit = { unit };
                for (const field of ['Limit', 'Used', 'Requested']) {
                  const match = message.match(new RegExp(`\\b${field}\\s*:?\\s*([0-9][0-9,]*)\\b`, 'i'));
                  const value = match ? Number(match[1].replaceAll(',', '')) : NaN;
                  if (Number.isSafeInteger(value) && value >= 0) rateLimit[field.toLowerCase()] = value;
                }
              }
            } catch {
              /* 不保存上游原始错误内容，避免回显密钥或私人消息 */
            }
            if (traceSafeModel)
              console.info(
                '[model-result]',
                JSON.stringify({
                  httpStatus: res.statusCode || null,
                  errorCode: error.upstreamCode || code,
                  classification: code,
                  finish_reason: 'unknown',
                  ...(rateLimit ? { rateLimit } : {})
                })
              );
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
          if (observed && countDecodedBytes) observed.responseDiagnostics.responseBytes = size;
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
          if (observed) observed.responseDiagnostics.networkStage = 'received';
          try {
            if (stream) {
              decoder!.end();
              resolve(stream.end());
            } else {
              const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              if (traceSafeModel) {
                const finish = learningResponseShape(parsed).finishReason;
                console.info(
                  '[model-result]',
                  JSON.stringify({
                    httpStatus: res.statusCode || null,
                    errorCode: null,
                    finish_reason: finish === 'other' ? 'unknown' : finish,
                    completion_tokens: Number.isInteger(parsed.usage?.completion_tokens)
                      ? parsed.usage.completion_tokens
                      : null,
                    reasoning_tokens: Number.isInteger(parsed.usage?.completion_tokens_details?.reasoning_tokens)
                      ? parsed.usage.completion_tokens_details.reasoning_tokens
                      : Number.isInteger(parsed.usage?.reasoning_tokens)
                        ? parsed.usage.reasoning_tokens
                        : null,
                    contentLength:
                      typeof parsed?.choices?.[0]?.message?.content === 'string'
                        ? parsed.choices[0].message.content.length
                        : null
                  })
                );
              }
              if (observed) {
                observed.usage = parsed?.usage && typeof parsed.usage === 'object' ? parsed.usage : null;
                observed.actualModel = typeof parsed?.model === 'string' ? parsed.model : config.model;
                Object.assign(observed.responseDiagnostics, learningResponseShape(parsed), { envelopeJson: 'valid' });
              }
              resolve(parsed);
            }
          } catch (error) {
            if (observed) {
              observed.responseDiagnostics.envelopeJson = 'invalid';
              observed.responseDiagnostics.expectedType = 'json_object';
              observed.responseDiagnostics.actualType = 'invalid_json';
            }
            reject(stream ? error : new ProviderError('INVALID_RESPONSE', '模型响应不是合法 JSON'));
          }
        });
      }
    );
    const timer = setTimeout(() => req.destroy(new ProviderError('TIMEOUT', '模型请求超时')), timeoutMs);
    req.on('close', () => clearTimeout(timer));
    req.on('error', (err: any) => {
      const error =
        signal?.aborted && signal.reason instanceof ProviderError
          ? signal.reason
          : err instanceof ProviderError
            ? err
            : err instanceof StreamError
              ? new ProviderError(err.code, err.message)
              : new ProviderError(
                  signal?.aborted ? 'CANCELLED' : /CERT|TLS|SSL/.test(err.code || '') ? 'TLS_FAILED' : 'NETWORK_FAILED',
                  '模型连接失败'
                );
      if (traceSafeModel)
        console.info(
          '[model-local-error]',
          JSON.stringify({ errorCode: error.code, elapsedMs: Date.now() - started, timeoutMs })
        );
      reject(error);
    });
    req.end(body);
  }).catch((error) => {
    if (stream)
      error.observed = redactModelValue({ ...stream.observed(), durationMs: Date.now() - started }, config.apiKey);
    else if (observed)
      error.observed = redactModelValue({ ...observed, durationMs: Date.now() - started }, config.apiKey);
    throw error;
  });
  if (config.capabilityProbe?.stage === 'tool') {
    const calls = raw?.choices?.[0]?.message?.tool_calls;
    const call = calls?.[0];
    let argumentsValue;
    try {
      argumentsValue = JSON.parse(call?.function?.arguments);
    } catch {
      /* fail closed below */
    }
    if (
      !Array.isArray(calls) ||
      calls.length !== 1 ||
      call?.type !== 'function' ||
      call.function?.name !== 'yozi_capability_echo' ||
      typeof call.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,160}$/.test(call.id) ||
      argumentsValue?.nonce !== config.capabilityProbe.nonce ||
      Object.keys(argumentsValue).length !== 1
    )
      throw new ProviderError('TOOLS_UNSUPPORTED', '此型号未完成工具调用测试，不能进入教学');
    return {
      content: JSON.stringify(argumentsValue),
      capabilityToolCall: call,
      usage: raw.usage || null,
      actualModel: typeof raw.model === 'string' ? raw.model : config.model,
      finishReason: 'tool_calls',
      durationMs: Date.now() - started
    };
  }
  const functionContent = stream ? null : readCoachFunctionResponse(config, raw);
  const content = stream ? raw.content : (functionContent ?? raw?.choices?.[0]?.message?.content);
  if (typeof content !== 'string' || !content.trim() || content.length > 30000) {
    const error = new ProviderError('INVALID_RESPONSE', '模型没有返回有效内容');
    if (observed) {
      Object.assign(observed.responseDiagnostics, {
        expectedType: 'string',
        actualType: observed.responseDiagnostics.contentType
      });
      error.observed = redactModelValue({ ...observed, durationMs: Date.now() - started }, config.apiKey);
    }
    throw error;
  }
  // 原始 usage 保存全部账单字段；无法确认用量时保持 pending，不按零成本结算。
  const usage = raw.usage && typeof raw.usage === 'object' ? raw.usage : null;
  return {
    content,
    usage,
    actualModel: stream ? raw.actualModel : typeof raw.model === 'string' ? raw.model : config.model,
    finishReason: stream ? raw.finishReason || 'unknown' : learningResponseShape(raw).finishReason,
    ...(functionContent !== null ? { coachFunctionResult: true } : {}),
    durationMs: Date.now() - started,
    ...(observed ? { responseDiagnostics: observed.responseDiagnostics } : {}),
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
        !MODEL_TOOL_NAMES.includes(call.name) ||
        !call.arguments ||
        typeof call.arguments !== 'object' ||
        Array.isArray(call.arguments)
    )
  ) {
    throw new ProviderError('TOOL_FORBIDDEN', '模型请求了未授权的工具');
  }
  for (const call of tools) {
    if (ENTRY_TOOL_NAMES.includes(call.name)) {
      try {
        validateEntryCall(call.name, call.arguments);
      } catch {
        throw new ProviderError('INVALID_STRUCTURE', '对象工具参数不合法');
      }
    }
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

// Separate entry point lets capability probes use the same protected transport without teaching payloads.
export const callCapabilityProvider = callLearningProvider;
