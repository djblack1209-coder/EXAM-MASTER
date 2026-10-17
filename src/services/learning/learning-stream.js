import config from '../../config/index.js';
import { getUserId, assertSession, sessionForRequest } from '../auth-storage.js';
import { appLearningStreamSupported, streamAppConnector } from './app-connector.js';
import {
  createEventStreamParser,
  createUtf8StreamDecoder,
  StreamError,
  safeLearningMessage
} from '../../../laf-backend/functions/_shared/learning-stream-codec.js';

const check = (condition, code, message) => {
  if (!condition) throw new StreamError(code, message);
};
export function learningStreamPlatform() {
  let platform = 'unsupported';
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof fetch === 'function' && typeof ReadableStream === 'function')
    platform = 'h5';
  // #endif
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && typeof wx.request === 'function' && wx.canIUse?.('request.enableChunked'))
    platform = 'weixin';
  // #endif
  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && ['Android', 'iOS'].includes(plus.os?.name))
    platform = appLearningStreamSupported() ? 'app' : 'unsupported';
  // #endif
  return platform;
}
export function createLearningStreamConsumer(
  body,
  {
    expectedModel,
    onPreview,
    assertCurrent = () => {
      /* 默认无外部上下文校验 */
    }
  } = {}
) {
  let metadata = null,
    result = null,
    sequence = 0;
  const parser = createEventStreamParser(
    ({ event, id, data }) => {
      assertCurrent();
      check(!result && id === String(++sequence), 'INVALID_STREAM', '教学流事件重复、失序或在结束后继续');
      let value;
      try {
        value = JSON.parse(data);
      } catch {
        throw new StreamError('INVALID_STREAM', '教学流事件不是合法JSON');
      }
      check(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_STREAM', '教学流事件结构不合法');
      if (event === 'start') {
        check(
          !metadata &&
            sequence === 1 &&
            value.version === 1 &&
            value.requestId === body.requestId &&
            value.modelId === body.modelId &&
            typeof value.model === 'string' &&
            (!expectedModel || value.model === expectedModel),
          'CONTEXT_CHANGED',
          '教学流未绑定当前请求或明确模型'
        );
        metadata = value;
      } else if (event === 'preview') {
        check(
          metadata &&
            value.provisional === true &&
            typeof value.text === 'string' &&
            value.text.length <= 8000 &&
            Object.keys(value).every((k) => ['text', 'provisional'].includes(k)),
          'INVALID_STREAM',
          '教学预览结构不合法'
        );
        onPreview?.(safeLearningMessage(value.text));
      } else if (event === 'result' || event === 'error') {
        check(
          metadata && typeof value.success === 'boolean' && value.success === (event === 'result'),
          'INVALID_STREAM',
          '教学完成收据不合法'
        );
        if (value.success)
          check(
            value.data?.requestId === body.requestId &&
              (!body.requestBinding ||
                (value.data.requestBinding === body.requestBinding && value.data.modelId === body.modelId)) &&
              value.data.model === metadata.model &&
              typeof value.data.message === 'string' &&
              value.data.message.length <= 8000 &&
              Array.isArray(value.data.tools) &&
              value.data.tools.length <= 3,
            'CONTEXT_CHANGED',
            '教学结果与当前请求不一致'
          );
        result = value;
      } else check(false, 'INVALID_STREAM', '教学流事件未获授权');
    },
    { maxCharacters: 100000, maxEvents: 34 }
  );
  return {
    feed: parser.feed,
    end() {
      parser.end();
      assertCurrent();
      check(result, 'INCOMPLETE_STREAM', '教学流已中断，未确认完成；可查询本次用量或读取已完成结果');
      return result;
    }
  };
}
export async function generateLearningTurnStream(body, options = {}) {
  const owner = options.expectedOwner || body.learningContext?.owner || getUserId();
  const session = options.session;
  let token;
  const assertCurrent = () => {
    options.assertCurrent?.();
    check(!options.signal?.aborted, 'CANCELLED', '请求已取消');
    assertSession(session);
    check(getUserId() === owner, 'OWNER_MISMATCH', '账户已切换，拒绝旧模型流');
  };
  let controller,
    task,
    reader,
    timer,
    timedOut = false;
  const abort = () => {
    controller?.abort();
    task?.abort();
  };
  const releaseReader = async () => {
    const activeReader = reader;
    reader = null;
    try {
      await activeReader.cancel();
    } catch {
      /* 断开的流已释放 */
    } finally {
      activeReader.releaseLock();
    }
  };
  try {
    check(!options.signal?.aborted, 'CANCELLED', '请求已取消');
    token = sessionForRequest(session).token;
    assertCurrent();
    check(token, 'AUTH_REQUIRED', '登录后可连接云模型，本地学习无需登录');
    const platform = options.platform || learningStreamPlatform();
    check(['h5', 'weixin', 'app'].includes(platform), 'PLATFORM_UNSUPPORTED', '此端尚无可靠流式传输；可主动选择非流式');
    const consumer = createLearningStreamConsumer(body, { ...options, assertCurrent });
    const decoder = createUtf8StreamDecoder();
    options.signal?.addEventListener('abort', abort, { once: true });
    const url = `${config.api.baseUrl}/proxy-ai-stream`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    };
    if (platform === 'app') {
      let streaming = false,
        json = '';
      let origin;
      try {
        origin = new URL(url).origin;
      } catch {
        throw new StreamError('ENDPOINT_INVALID', '教学流目标尚未配置');
      }
      await streamAppConnector({ token, allowedOrigins: [origin], consent: body.shareConsent === true }, url, {
        session,
        signal: options.signal,
        body: JSON.stringify(body),
        onHeaders(value) {
          assertCurrent();
          streaming =
            value.status >= 200 && value.status < 300 && /^text\/event-stream(?:;|$)/i.test(value.contentType);
        },
        onChunk(bytes) {
          assertCurrent();
          const text = decoder.feed(bytes);
          if (streaming) consumer.feed(text);
          else {
            json += text;
            check(json.length <= 100000, 'RESPONSE_LIMIT', '模型错误响应过大');
          }
        }
      });
      assertCurrent();
      decoder.end();
      if (streaming) return consumer.end();
      let rejected;
      try {
        rejected = JSON.parse(json);
      } catch {
        throw new StreamError('INVALID_STREAM', '模型服务没有返回教学流');
      }
      check(rejected?.success === false, 'STREAM_TRANSPORT_UNAVAILABLE', '模型服务未提供所选教学流，不自动回退');
      return rejected;
    }
    if (platform === 'h5') {
      controller = new AbortController();
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 45000);
      assertCurrent();
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers,
        redirect: 'error',
        signal: controller.signal
      });
      assertCurrent();
      check(response.body?.getReader, 'STREAM_TRANSPORT_UNAVAILABLE', '此浏览器没有分块读取能力，未确认模型任务完成');
      reader = response.body.getReader();
      const streaming = /^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type') || '');
      let json = '';
      while (true) {
        const part = await reader.read();
        assertCurrent();
        if (part.done) break;
        const text = decoder.feed(part.value);
        if (streaming) consumer.feed(text);
        else {
          json += text;
          check(json.length <= 100000, 'RESPONSE_LIMIT', '模型错误响应过大');
        }
      }
      decoder.end();
      if (streaming) {
        const result = consumer.end();
        await releaseReader();
        assertCurrent();
        return result;
      }
      let rejected;
      try {
        rejected = JSON.parse(json);
      } catch {
        throw new StreamError('INVALID_STREAM', '模型服务没有返回教学流');
      }
      check(rejected?.success === false, 'STREAM_TRANSPORT_UNAVAILABLE', '模型服务未提供所选流式传输，不自动回退');
      return rejected;
    }
    // 微信使用原生wx RequestTask；uni.request包装不被假定具有onChunkReceived。
    return await new Promise((resolve, reject) => {
      let chunks = 0,
        ended = false,
        streaming = true,
        json = '';
      const finish = (value, error = null) => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', cancelled);
        if (error) {
          task?.abort();
          reject(error);
        } else resolve(value);
      };
      const cancelled = () => finish(null, new StreamError('CANCELLED', '请求已取消'));
      options.signal?.addEventListener('abort', cancelled, { once: true });
      timer = setTimeout(() => finish(null, new StreamError('TIMEOUT', '教学流超时，实际用量仍须查询')), 45000);
      assertCurrent();
      task = wx.request({
        url,
        method: 'POST',
        data: body,
        header: headers,
        timeout: 45000,
        enableChunked: true,
        responseType: 'arraybuffer',
        dataType: 'text',
        success(res) {
          try {
            assertCurrent();
            if (!chunks || !streaming) {
              const value = JSON.parse(chunks ? json : decoder.feed(res.data));
              decoder.end();
              check(value?.success === false, 'INCOMPLETE_STREAM', '未收到完整教学流，不自动回退');
              finish(value);
            } else {
              decoder.end();
              finish(consumer.end());
            }
          } catch (error) {
            finish(null, error);
          }
        },
        fail() {
          finish(
            null,
            new StreamError(
              options.signal?.aborted ? 'CANCELLED' : 'INCOMPLETE_STREAM',
              '教学流中断，实际用量可能仍待结算'
            )
          );
        }
      });
      if (typeof task.onChunkReceived !== 'function' || typeof task.onHeadersReceived !== 'function') {
        finish(null, new StreamError('STREAM_TRANSPORT_UNAVAILABLE', '当前微信基础库缺少可靠分块或响应头接口'));
        return;
      }
      task.onHeadersReceived(({ header }) => {
        const contentType = Object.entries(header || {}).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
        streaming = /^text\/event-stream(?:;|$)/i.test(String(contentType || ''));
      });
      task.onChunkReceived(({ data }) => {
        if (ended) return;
        try {
          assertCurrent();
          chunks++;
          const text = decoder.feed(data);
          if (streaming) consumer.feed(text);
          else {
            json += text;
            check(json.length <= 100000, 'RESPONSE_LIMIT', '模型错误响应过大');
          }
        } catch (error) {
          finish(null, error);
        }
      });
    });
  } catch (error) {
    abort();
    const cancelled = options.signal?.aborted || error.code === 'CANCELLED';
    return {
      success: false,
      code: cancelled ? 499 : 503,
      errorCode: cancelled ? 'CANCELLED' : timedOut ? 'TIMEOUT' : error.code || 'INCOMPLETE_STREAM',
      error: cancelled
        ? 'CANCELLED'
        : timedOut
          ? 'TIMEOUT'
          : typeof error.code === 'string'
            ? error.code
            : 'INCOMPLETE_STREAM',
      message:
        timedOut && !cancelled
          ? '教学流超时，未确认完成；请查看实际用量，不自动重试'
          : cancelled
            ? '请求已取消，实际模型用量可能仍待结算'
            : error.message || '教学流未完成，记录保留；不会自动重试或切换模型'
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    if (reader) await releaseReader();
  }
}
