/**
 * AI 流式聊天服务
 *
 * H5 平台：使用 fetch + ReadableStream 消费 SSE
 * 小程序平台：降级为 lafService 非流式调用
 *
 * @module services/streamService
 */

import config from '../config/index.js';
import { getToken, getUserId } from './auth-storage.js';
import { aiFriendChat } from './api/domains/ai.api.js';
import { logger } from '@/utils/logger.js';

const BASE_URL = config.api.baseUrl;

/**
 * 检测当前运行平台
 * @returns {'h5'|'mp'} h5 支持流式，mp 降级非流式
 */
function detectPlatform() {
  try {
    const info = uni.getSystemInfoSync();
    // mp-weixin, mp-alipay, mp-baidu 等均为小程序
    if (info.uniPlatform && info.uniPlatform.startsWith('mp-')) {
      return 'mp';
    }
  } catch (_e) {
    // getSystemInfoSync 失败时默认 h5
  }
  return 'h5';
}

/**
 * 构建请求头（复用 lafService 的认证模式）
 * @returns {Record<string, string>}
 */
function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const userId = getUserId();
    if (userId) {
      headers['X-User-Id'] = userId;
    }
  } catch (_e) {
    logger.warn('[StreamService] 获取认证信息失败');
  }

  return headers;
}

/**
 * 解析 SSE 行，提取 content 文本
 * @param {string} line - 单行 SSE 数据
 * @returns {{ done: boolean, content: string|null }}
 */
function parseSSELine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    // 空行或注释，忽略
    return { done: false, content: null };
  }

  if (!trimmed.startsWith('data: ')) {
    return { done: false, content: null };
  }

  const payload = trimmed.slice(6); // 去掉 "data: "

  if (payload === '[DONE]') {
    return { done: true, content: null };
  }

  try {
    const parsed = JSON.parse(payload);
    return { done: false, content: parsed.content ?? null };
  } catch (_e) {
    // 非 JSON 的 data 行，当作纯文本 token
    return { done: false, content: payload };
  }
}

/**
 * H5 流式请求（fetch + ReadableStream）
 */
async function streamH5({ action, prompt, friendType, history, emotion, onChunk, onDone, onError, signal }) {
  const url = `${BASE_URL}/proxy-ai-stream`;
  const headers = buildHeaders();

  const userId = getUserId() || 'anonymous';
  const body = JSON.stringify({
    action: action || 'friend_chat',
    content: prompt,
    friendType,
    history,
    userId,
    context: { emotion: emotion || 'neutral' }
  });

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    onError?.(err);
    return;
  }

  if (!response.ok) {
    onError?.(new Error(`HTTP ${response.status}: ${response.statusText}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError?.(new Error('ReadableStream not supported'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 以双换行分隔事件，但单行 data 也可能以 \n 结尾
      const lines = buffer.split('\n');
      // 最后一个元素可能是不完整的行，保留到下次
      buffer = lines.pop() || '';

      for (const line of lines) {
        const { done: isDone, content } = parseSSELine(line);
        if (isDone) {
          onDone?.();
          return;
        }
        if (content !== null) {
          onChunk?.(content);
        }
      }
    }

    // 处理 buffer 中残留的最后一行
    if (buffer.trim()) {
      const { done: isDone, content } = parseSSELine(buffer);
      if (!isDone && content !== null) {
        onChunk?.(content);
      }
    }

    onDone?.();
  } catch (err) {
    if (err.name === 'AbortError') return;
    onError?.(err);
  }
}

/**
 * 小程序降级：非流式调用 lafService
 */
async function streamFallback({ prompt, friendType, history, emotion, onChunk, onDone, onError, signal }) {
  try {
    // 检查是否已取消
    if (signal?.aborted) return;

    const result = await aiFriendChat(friendType, prompt, {
      emotion: emotion || 'neutral',
      recentConversations: Array.isArray(history) ? history.map((m) => `${m.role}: ${m.content}`).join('\n') : ''
    });

    if (signal?.aborted) return;

    if (result.success && result.data) {
      const text =
        typeof result.data === 'string'
          ? result.data
          : result.data.content || result.data.reply || JSON.stringify(result.data);
      // 一次性交付全部文本
      onChunk?.(text);
      onDone?.();
    } else {
      onError?.(new Error(result.message || '请求失败'));
    }
  } catch (err) {
    if (signal?.aborted) return;
    onError?.(err);
  }
}

/**
 * 流式聊天入口
 *
 * @param {Object} options
 * @param {string} [options.action='friend_chat'] - 后端 action
 * @param {string} options.prompt - 用户消息
 * @param {string} [options.friendType] - 好友类型
 * @param {Array} [options.history] - 对话历史
 * @param {string} [options.emotion] - 情绪状态
 * @param {(chunk: string) => void} options.onChunk - 收到 token 回调
 * @param {() => void} [options.onDone] - 流结束回调
 * @param {(error: Error) => void} [options.onError] - 错误回调
 * @returns {AbortController} 可用于取消请求
 */
export function streamChat({ action = 'friend_chat', prompt, friendType, history, emotion, onChunk, onDone, onError }) {
  const controller = new AbortController();
  const platform = detectPlatform();

  const params = {
    action,
    prompt,
    friendType,
    history,
    emotion,
    onChunk,
    onDone,
    onError,
    signal: controller.signal
  };

  if (platform === 'h5') {
    streamH5(params);
  } else {
    streamFallback(params);
  }

  return controller;
}
