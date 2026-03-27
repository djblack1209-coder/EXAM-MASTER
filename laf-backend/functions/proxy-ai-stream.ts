/**
 * AI 代理云函数 — SSE 流式响应
 *
 * 支持 friend_chat / consult / analyze 三种流式场景
 * 认证方式与 proxy-ai.ts 一致（JWT）
 *
 * SSE 格式: data: {"content":"token"}\n\n  →  data: [DONE]\n\n
 */

import cloud from '@lafjs/cloud';
// @ts-ignore — Laf runtime provides cloud.res but typings lag behind
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
// @ts-ignore
import { checkRateLimitDistributed, createLogger } from './_shared/api-response.js';

const logger = createLogger('[ProxyAI-Stream]');

const AI_PROVIDER_KEY_PLACEHOLDER
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 流式支持的 action 白名单
const STREAM_ACTIONS = new Set(['friend_chat', 'consult', 'analyze']);

// action → 模型映射（与 proxy-ai.ts 保持一致）
const TASK_MODEL_MAP: Record<string, string> = {
  friend_chat: 'glm-4-flash',
  consult: 'glm-4-flash',
  analyze: 'glm-4.5-air'
};

// 简易内存限流
const rateLimitLocal = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 20;

function checkRateLimitFallback(userId: string) {
  const now = Date.now();
  const entry = rateLimitLocal.get(userId);
  if (!entry || now > entry.resetTime) {
    rateLimitLocal.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: entry.resetTime };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetAt: entry.resetTime };
}

export default async function (ctx: FunctionContext) {
  const res = (cloud as any).res;

  // --- 快速校验 ---
  const authResult = requireAuth(ctx);
  if (isAuthError(authResult)) {
    return { code: 401, success: false, message: '未登录或登录已过期' };
  }
  const userId = authResult.userId;

  if (!AI_PROVIDER_KEY_PLACEHOLDER
    return { code: 503, success: false, message: 'AI 服务未配置' };
  }

  const { action, content, friendType, history, context: rawCtx } = ctx.body || {};

  if (!action || !STREAM_ACTIONS.has(action)) {
    return { code: 400, success: false, message: `不支持的流式 action: ${action}` };
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return { code: 400, success: false, message: 'content 不能为空' };
  }
  if (content.length > 10000) {
    return { code: 400, success: false, message: 'content 过长' };
  }

  // --- 限流 ---
  const rl = await checkRateLimitDistributed(`proxy_ai_stream:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, () =>
    checkRateLimitFallback(userId)
  );
  if (!rl.allowed) {
    return { code: 429, success: false, message: '请求过于频繁，请稍后重试' };
  }

  // --- 构建 messages ---
  const messages = buildMessages(action, content.trim(), friendType, history, rawCtx);
  const model = TASK_MODEL_MAP[action] || 'glm-4-flash';

  // --- SSE headers ---
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const upstream = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_PROVIDER_KEY_PLACEHOLDER
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: action === 'analyze' ? 0.6 : 0.85,
        max_tokens: 4096,
        top_p: 0.9,
        stream: true
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => 'unknown');
      logger.error(`Zhipu stream error ${upstream.status}: ${errText}`);
      res.write(`data: ${JSON.stringify({ error: 'AI 服务异常' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const payload = trimmed.slice(6);

          if (payload === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    }

    // Flush any remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const payload = buffer.trim().slice(6);
      if (payload === '[DONE]') {
        res.write('data: [DONE]\n\n');
      } else {
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch {
          /* skip */
        }
      }
    }

    // Ensure we always send DONE
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    logger.error('Stream error:', err);
    try {
      res.write(`data: ${JSON.stringify({ error: 'AI 服务异常，请重试' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch {
      /* response already closed */
    }
  }
}

// ==================== 消息构建 ====================

function buildMessages(
  action: string,
  content: string,
  friendType?: string,
  history?: any[],
  context?: any
): Array<{ role: string; content: string }> {
  let systemPrompt: string;

  switch (action) {
    case 'friend_chat':
      systemPrompt = buildFriendSystemPrompt(friendType, context);
      break;
    case 'consult':
      systemPrompt =
        '你是一位资深的考研择校顾问，拥有丰富的院校信息和招生经验。请根据学生情况给出客观、专业的建议。回答要简洁有条理。';
      break;
    case 'analyze':
      systemPrompt = '你是考研错题分析专家。请对学生的错题进行深度分析，找出错误原因，给出改进建议。回答要结构清晰。';
      break;
    default:
      systemPrompt = '你是一个专业的考研学习助手。';
  }

  const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemPrompt }];

  // Append multi-turn history (capped at 20 turns)
  if (Array.isArray(history)) {
    const safe = history.slice(-20);
    for (const msg of safe) {
      if ((msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  messages.push({ role: 'user', content });
  return messages;
}

function buildFriendSystemPrompt(friendType?: string, context?: any): string {
  const friends: Record<string, { name: string; role: string; style: string }> = {
    'yan-cong': { name: '研聪', role: '清华学霸学长', style: '严谨理性，数据驱动，喜欢用数据说话' },
    'yan-man': { name: '研漫', role: '心理学硕士研友', style: '温暖共情，先共情再建议' },
    'yan-shi': { name: '研师', role: '资深考研名师', style: '专业严谨，直击要点' },
    'yan-you': { name: '研友', role: '同届考研伙伴', style: '轻松幽默，互相鼓励' }
  };

  const friend = friends[friendType || ''] || friends['yan-cong'];
  const emotion = context?.emotion || 'neutral';

  return `你是"${friend.name}"，${friend.role}。性格：${friend.style}。
你不是AI助手，而是一个有血有肉的考研伙伴。

回复规范：
- 长度80-250字，自然不做作
- 先回应情感，再给实质建议
- 结尾可反问保持对话流动
- 禁止说"作为AI"等破坏人设的话
- 当前用户情绪：${emotion}`;
}
