import { assert } from './learning-domain.js';

export const APP_CONNECTOR_CONTRACT = 'wenli-app-connector-v1';
export const APP_CONNECTOR_PLUGIN = 'Wenli-Connector';
export const APP_CONNECTOR_ORIGIN = 'https://wenli-app.invalid';
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
export function requestAppConnector(connection, url, { signal, method, body, timeout, limit }) {
  const bridge = getAppConnectorBridge();
  assert(!signal?.aborted, 'CANCELLED', '连接请求已取消');
  assert(
    Number.isSafeInteger(timeout) &&
      timeout > 0 &&
      timeout <= 35000 &&
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
            assert(!signal?.aborted, 'CANCELLED', '连接请求已取消');
            assert(response?.id === id, 'INVALID_RESPONSE', '原生响应不属于本次请求');
            if (response.code) {
              const codes = [
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
              assert(
                false,
                codes.includes(response.code) ? response.code : 'CONNECTION_FAILED',
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
