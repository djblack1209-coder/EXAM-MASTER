import { captureSession, assertSession } from '../auth-storage.js';
import { assert } from './learning-domain.js';

export const APP_CONNECTOR_CONTRACT = 'wenli-app-connector-v1';
export const APP_CONNECTOR_PLUGIN = 'Wenli-Connector';
export const APP_CONNECTOR_ORIGIN = 'https://wenli-app.invalid';
export const APP_STREAM_CONTRACT = 'wenli-app-stream-v1';
export const APP_STREAM_MAX_BYTES = 2 * 1024 * 1024;
export const APP_MATERIAL_PARSE_CONTRACT = 'yozi-material-parse-v1';
export const MATERIAL_PARSE_TIMEOUT = 100000;
const nativeErrors = [
  'CANCELLED',
  'TIMEOUT',
  'REDIRECT_FORBIDDEN',
  'RESPONSE_LIMIT',
  'INVALID_ENCODING',
  'INVALID_RESPONSE',
  'RATE_LIMIT',
  'REQUEST_CONFLICT',
  'INVALID_REQUEST',
  'CONNECTION_FAILED'
];
export function getAppConnectorBridge() {
  assert(
    typeof plus !== 'undefined' &&
      ['Android', 'iOS'].includes(plus.os?.name) &&
      typeof uni.requireNativePlugin === 'function',
    'PLATFORM_UNSUPPORTED',
    '此App尚未装配受保护原生连接器，未发送令牌或资料'
  );
  let bridge, caps;
  try {
    bridge = uni.requireNativePlugin(APP_CONNECTOR_PLUGIN);
    caps = bridge?.getCapabilities?.();
  } catch {
    assert(false, 'PLATFORM_UNSUPPORTED', '原生模块无法确认保护合同，未发送请求');
  }
  assert(
    typeof bridge?.getCapabilities === 'function' &&
      typeof bridge.request === 'function' &&
      typeof bridge.cancel === 'function',
    'PLATFORM_UNSUPPORTED',
    'App缺少原生连接器模块，未发送请求'
  );
  assert(
    caps?.contract === APP_CONNECTOR_CONTRACT &&
      caps.redirect === 'reject' &&
      caps.responseLimit === 'bytes' &&
      caps.utf8 === 'strict' &&
      caps.tls === 'system' &&
      caps.cancel === true,
    'PLATFORM_UNSUPPORTED',
    '原生连接器保护合同不匹配，未发送请求'
  );
  return bridge;
}
export function appConnectorSupported() {
  try {
    getAppConnectorBridge();
    return true;
  } catch {
    return false;
  }
}
export function appMaterialParseSupported() {
  try {
    const capability = getAppConnectorBridge().getCapabilities().materialParse;
    return capability?.contract === APP_MATERIAL_PARSE_CONTRACT && capability.timeoutMs === MATERIAL_PARSE_TIMEOUT;
  } catch {
    return false;
  }
}
export function getAppLearningStreamBridge() {
  const bridge = getAppConnectorBridge();
  let stream;
  try {
    stream = bridge.getCapabilities().stream;
  } catch {
    assert(false, 'PLATFORM_UNSUPPORTED', '原生模块无法确认流式保护合同，未发送请求');
  }
  assert(
    typeof bridge.stream === 'function' &&
      stream?.contract === APP_STREAM_CONTRACT &&
      stream.chunks === 'base64' &&
      stream.sequence === true &&
      stream.maxBytes === APP_STREAM_MAX_BYTES &&
      stream.maxChunks === 256 &&
      stream.timeoutMs === 45000,
    'PLATFORM_UNSUPPORTED',
    '此App尚无受保护的分块传输，未发送令牌或学习内容'
  );
  return bridge;
}
export function appLearningStreamSupported() {
  try {
    getAppLearningStreamBridge();
    return true;
  } catch {
    return false;
  }
}
function utf8Length(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const n = text.charCodeAt(i);
    if (n >= 0xd800 && n <= 0xdbff) {
      const next = text.charCodeAt(++i);
      assert(next >= 0xdc00 && next <= 0xdfff, 'INVALID_ENCODING', '连接器返回不完整字符');
      bytes += 4;
    } else {
      assert(n < 0xdc00 || n > 0xdfff, 'INVALID_ENCODING', '连接器返回不完整字符');
      bytes += n < 128 ? 1 : n < 2048 ? 2 : 3;
    }
  }
  return bytes;
}
export function requestAppConnector(
  connection,
  url,
  { signal, method, body, timeout, limit, session = captureSession() }
) {
  assertSession(session);
  const bridge = getAppConnectorBridge();
  assert(!signal?.aborted, 'CANCELLED', '连接请求已取消');
  const longMaterialRequest = timeout > 35000 && method === 'POST' && new URL(url).pathname === '/parse';
  if (longMaterialRequest)
    assert(appMaterialParseSupported(), 'PLATFORM_UNSUPPORTED', '此App尚不支持逐页版面处理，未发送资料');
  assert(
    Number.isSafeInteger(timeout) &&
      timeout > 0 &&
      timeout <= (longMaterialRequest ? MATERIAL_PARSE_TIMEOUT : 35000) &&
      Number.isSafeInteger(limit) &&
      limit > 0 &&
      limit <= 2000000,
    'INVALID_INPUT',
    '连接器时间或输出预算不合法'
  );
  const id = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    let ended = false;
    const finish = (value, error) => {
      if (ended) return;
      if (!error) {
        try {
          assertSession(session);
        } catch (failure) {
          error = failure;
        }
      }
      ended = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (error) {
        try {
          bridge.cancel(id);
        } catch {
          /* 无法取消时仍拒绝迟到结果，不重试或回退。 */
        }
        reject(error);
      } else resolve(value);
    };
    const failure = (code, message) => {
      try {
        assert(false, code, message);
      } catch (error) {
        finish(null, error);
      }
    };
    const cancel = () => failure('CANCELLED', '连接请求已取消，未确认完成');
    const timer = setTimeout(() => failure('TIMEOUT', '连接请求超时，未确认完成'), timeout);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      assert(!signal?.aborted, 'CANCELLED', '连接请求已取消');
      assertSession(session);
      bridge.request(
        {
          id,
          url,
          method,
          ...(body !== undefined ? { body } : {}),
          token: connection.token,
          allowedOrigins: [...connection.allowedOrigins],
          consent: connection.consent,
          timeout,
          limit
        },
        (response) => {
          if (ended) return;
          try {
            assertSession(session);
          } catch (error) {
            finish(null, error);
            return;
          }
          try {
            assert(!signal?.aborted, 'CANCELLED', '连接请求已取消');
            assert(response?.id === id, 'INVALID_RESPONSE', '原生响应不属于本次请求');
            if (response.code) {
              assert(
                false,
                nativeErrors.includes(response.code) ? response.code : 'CONNECTION_FAILED',
                '原生连接未完成，不自动重试或回退云端'
              );
            }
            assert(
              Number.isInteger(response.status) && response.status >= 100 && response.status < 600,
              'INVALID_RESPONSE',
              '连接器状态码不合法'
            );
            assert(response.status < 300 || response.status >= 400, 'REDIRECT_FORBIDDEN', '连接器重定向被拒绝');
            assert(
              typeof response.body === 'string' &&
                response.body.length <= limit &&
                Number.isSafeInteger(response.receivedBytes) &&
                response.receivedBytes >= 0 &&
                response.receivedBytes <= limit,
              'RESPONSE_LIMIT',
              '原生连接器输出超过上限'
            );
            assert(
              utf8Length(response.body) === response.receivedBytes,
              'INVALID_RESPONSE',
              '原生响应字节数与正文不一致'
            );
            let parsed;
            try {
              parsed = JSON.parse(response.body);
            } catch {
              assert(false, 'INVALID_RESPONSE', '原生响应不是有效JSON');
            }
            finish({ ok: response.status >= 200 && response.status < 300, status: response.status, body: parsed });
          } catch (error) {
            finish(null, error);
          }
        }
      );
    } catch {
      failure('CONNECTION_FAILED', '原生模块请求未完成，不自动重试或回退');
    }
  });
}

// DCloud桥只传JSON字段；自行有界解码，不依赖App WebView的atob/TextDecoder。
function decodeStreamChunk(data) {
  assert(
    typeof data === 'string' &&
      data.length > 0 &&
      data.length <= 10924 &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data),
    'INVALID_RESPONSE',
    '原生分块不是规范Base64'
  );
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  const size = (data.length / 4) * 3 - padding;
  assert(size > 0 && size <= 8192, 'RESPONSE_LIMIT', '原生分块超过字节上限');
  const tail = alphabet.indexOf(data[data.length - padding - 1]);
  assert(!padding || (tail & (padding === 2 ? 15 : 3)) === 0, 'INVALID_RESPONSE', '原生分块填充不规范');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (let i = 0; i < data.length; i += 4) {
    const value =
      (alphabet.indexOf(data[i]) << 18) |
      (alphabet.indexOf(data[i + 1]) << 12) |
      (data[i + 2] === '=' ? 0 : alphabet.indexOf(data[i + 2]) << 6) |
      (data[i + 3] === '=' ? 0 : alphabet.indexOf(data[i + 3]));
    bytes[offset++] = value >>> 16;
    if (offset < size) bytes[offset++] = value >>> 8;
    if (offset < size) bytes[offset++] = value;
  }
  return bytes;
}

export async function streamAppConnector(
  connection,
  address,
  { signal, body, timeout = 45000, limit = APP_STREAM_MAX_BYTES, onHeaders, onChunk, session = captureSession() } = {}
) {
  assertSession(session);
  const bridge = getAppLearningStreamBridge();
  assert(!signal?.aborted, 'CANCELLED', '教学流请求已取消');
  let url;
  try {
    url = new URL(address);
  } catch {
    assert(false, 'ENDPOINT_INVALID', '教学流目标不合法');
  }
  assert(
    typeof address === 'string' &&
      address.length <= 4096 &&
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/proxy-ai-stream' &&
      Array.isArray(connection.allowedOrigins) &&
      connection.allowedOrigins.length <= 16 &&
      connection.allowedOrigins.includes(url.origin),
    'ENDPOINT_INVALID',
    '教学流目标未获明确授权'
  );
  assert(connection.consent === true, 'CONSENT_REQUIRED', '须确认本次学习内容共享');
  assert(
    typeof connection.token === 'string' && /^[!-~]{32,4096}$/.test(connection.token),
    'AUTH_REQUIRED',
    '教学流需要有效访问令牌'
  );
  assert(
    Number.isSafeInteger(timeout) &&
      timeout > 0 &&
      timeout <= 45000 &&
      Number.isSafeInteger(limit) &&
      limit > 0 &&
      limit <= APP_STREAM_MAX_BYTES,
    'INVALID_INPUT',
    '教学流时间或字节预算不合法'
  );
  assert(
    typeof body === 'string' && body.length <= 15 * 1024 * 1024 && utf8Length(body) <= 15 * 1024 * 1024,
    'INVALID_INPUT',
    '教学流正文超过上限或编码无效'
  );
  const id = `stream_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  return await new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    let ended = false,
      sequence = 0,
      chunks = 0,
      receivedBytes = 0,
      headers = null;
    const finish = (value, error) => {
      if (ended) return;
      if (!error) {
        try {
          assertSession(session);
        } catch (failure) {
          error = failure;
        }
      }
      ended = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (error) {
        try {
          bridge.cancel(id);
        } catch {
          /* 拒绝迟到结果，取消失败不触发替代请求。 */
        }
        reject(error);
      } else resolve(value);
    };
    const failure = (code, message) => {
      try {
        assert(false, code, message);
      } catch (error) {
        finish(null, error);
      }
    };
    const cancel = () => failure('CANCELLED', '教学流请求已取消，未确认完成');
    const timer = setTimeout(() => failure('TIMEOUT', '教学流超时，实际用量仍须查询'), timeout);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      assert(!signal?.aborted, 'CANCELLED', '教学流请求已取消');
      assertSession(session);
      bridge.stream(
        {
          id,
          url: address,
          method: 'POST',
          token: connection.token,
          allowedOrigins: [...connection.allowedOrigins],
          consent: true,
          body,
          timeout,
          limit
        },
        (value) => {
          if (ended) return;
          try {
            assertSession(session);
          } catch (error) {
            finish(null, error);
            return;
          }
          try {
            assert(!signal?.aborted, 'CANCELLED', '教学流请求已取消');
            assert(Date.now() <= deadline, 'TIMEOUT', '教学流超时，实际用量仍须查询');
            assert(value?.id === id, 'INVALID_RESPONSE', '原生分块不属于本次请求');
            if (value.code)
              assert(
                false,
                nativeErrors.includes(value.code) ? value.code : 'CONNECTION_FAILED',
                '原生教学流未完成，不自动重试或切换模型'
              );
            assert(value.sequence === sequence + 1, 'INVALID_RESPONSE', '原生分块重复或失序');
            sequence++;
            if (value.kind === 'headers') {
              assert(
                !headers &&
                  sequence === 1 &&
                  value.receivedBytes === 0 &&
                  Number.isInteger(value.status) &&
                  value.status >= 100 &&
                  value.status < 600 &&
                  typeof value.contentType === 'string' &&
                  value.contentType.length <= 200,
                'INVALID_RESPONSE',
                '原生教学流响应头不合法'
              );
              assert(value.status < 300 || value.status >= 400, 'REDIRECT_FORBIDDEN', '教学流重定向被拒绝');
              headers = { status: value.status, contentType: value.contentType };
              onHeaders?.(headers);
            } else if (value.kind === 'chunk') {
              assert(headers, 'INVALID_RESPONSE', '原生分块缺少响应头');
              assert(++chunks <= 256, 'RESPONSE_LIMIT', '原生教学流分块次数超过上限');
              const bytes = decodeStreamChunk(value.data);
              assert(receivedBytes + bytes.length <= limit, 'RESPONSE_LIMIT', '原生教学流超过字节预算');
              receivedBytes += bytes.length;
              assert(value.receivedBytes === receivedBytes, 'INVALID_RESPONSE', '原生分块累计字节不一致');
              onChunk?.(bytes);
            } else if (value.kind === 'complete') {
              assert(headers && value.receivedBytes === receivedBytes, 'INVALID_RESPONSE', '原生完成回执不完整');
              finish({ ...headers, receivedBytes });
            } else assert(false, 'INVALID_RESPONSE', '原生教学流回执类型不合法');
          } catch (error) {
            finish(null, error);
          }
        }
      );
    } catch {
      failure('CONNECTION_FAILED', '原生教学流无法启动，不自动回退');
    }
  });
}
