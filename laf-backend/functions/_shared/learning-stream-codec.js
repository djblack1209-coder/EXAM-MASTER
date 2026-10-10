// SSE仅传输临时预览和最终校验结果，不把半条JSON当学习事实。
export class StreamError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const check = (condition, code, message) => {
  if (!condition) throw new StreamError(code, message);
};
export function createUtf8StreamDecoder(maxBytes = 2 * 1024 * 1024) {
  let bytes = 0,
    remaining = 0,
    point = 0,
    minimum = 0;
  return {
    feed(input) {
      check(input instanceof Uint8Array || input instanceof ArrayBuffer, 'INVALID_ENCODING', '流式数据不是字节序列');
      const values = input instanceof Uint8Array ? input : new Uint8Array(input);
      bytes += values.byteLength;
      check(bytes <= maxBytes, 'RESPONSE_LIMIT', '流式响应超过容量限制');
      const out = [];
      for (const b of values) {
        if (remaining) {
          check((b & 0xc0) === 0x80, 'INVALID_ENCODING', '流式UTF-8不合法');
          point = point * 64 + (b & 63);
          if (--remaining === 0) {
            check(
              point >= minimum && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff),
              'INVALID_ENCODING',
              '流式UTF-8不合法'
            );
            out.push(String.fromCodePoint(point));
          }
        } else if (b < 0x80) out.push(String.fromCharCode(b));
        else if (b >= 0xc2 && b <= 0xdf) {
          remaining = 1;
          point = b & 31;
          minimum = 0x80;
        } else if (b >= 0xe0 && b <= 0xef) {
          remaining = 2;
          point = b & 15;
          minimum = 0x800;
        } else if (b >= 0xf0 && b <= 0xf4) {
          remaining = 3;
          point = b & 7;
          minimum = 0x10000;
        } else check(false, 'INVALID_ENCODING', '流式UTF-8不合法');
      }
      return out.join('');
    },
    end() {
      check(!remaining, 'INCOMPLETE_STREAM', '流式UTF-8未完整结束');
    }
  };
}
export function createEventStreamParser(onEvent, { maxCharacters = 65536, maxEvents = 4096 } = {}) {
  let line = '',
    data = [],
    type = '',
    id = '',
    first = true,
    afterCR = false,
    count = 0,
    size = 0;
  function consume() {
    if (!line) {
      if (data.length) {
        check(++count <= maxEvents, 'RESPONSE_LIMIT', '流式事件过多');
        onEvent({ event: type || 'message', id, data: data.join('\n') });
      }
      data = [];
      type = '';
      size = 0;
      return;
    }
    if (line[0] === ':') return;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value[0] === ' ') value = value.slice(1);
    if (field === 'data') {
      data.push(value);
      size += value.length + 1;
    } else if (field === 'event') type = value;
    else if (field === 'id' && !value.includes('\0')) id = value;
    check(size <= maxCharacters && type.length <= 120 && id.length <= 180, 'RESPONSE_LIMIT', '流式事件超过限制');
  }
  return {
    feed(text) {
      check(typeof text === 'string', 'INVALID_STREAM', '流式数据不是文本');
      for (const c of text) {
        if (first) {
          first = false;
          if (c === '\uFEFF') continue;
        }
        if (afterCR) {
          afterCR = false;
          if (c === '\n') continue;
        }
        if (c === '\r' || c === '\n') {
          consume();
          line = '';
          afterCR = c === '\r';
        } else {
          line += c;
          check(line.length + size <= maxCharacters, 'RESPONSE_LIMIT', '流式事件超过限制');
        }
      }
    },
    end() {
      // EOF不能把未由空行结束的半个事件升级为完成。
      check(!line && !data.length, 'INCOMPLETE_STREAM', '流式事件未完整结束');
    }
  };
}
export function safeLearningMessage(text) {
  const safe = text.replace(
    /已经(?:加入错题|调整计划|安排提醒)|已(?:加入错题|调整计划|安排提醒)/g,
    '提出了相关建议（以实际记录为准）'
  );
  check(safe.length <= 8000, 'RESPONSE_LIMIT', '教学文本超过容量限制，未执行工具');
  return safe;
}
export function redactModelValue(value, key, depth = 0) {
  check(depth <= 32, 'INVALID_STRUCTURE', '模型响应嵌套过深');
  if (!key) return value;
  if (typeof value === 'string') {
    // 同时处理JSON中的Unicode转义回显，不把编码变体留在普通导出。
    const decoded = value.replace(/\\u([a-f0-9]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded.includes(key) && !value.includes(key)) return '[REDACTED_MODEL_KEY]';
    return value.split(key).join('[REDACTED_MODEL_KEY]');
  }
  if (Array.isArray(value)) return value.map((v) => redactModelValue(v, key, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([name, v]) => [
        redactModelValue(name, key, depth + 1),
        redactModelValue(v, key, depth + 1)
      ])
    );
  return value;
}
export function learningMessagePreview(raw, key = '') {
  // JSON字段顺序不同仍可最终校验；预览只提取首个message字符串，不展示工具/答案/内部推理。
  const start = raw.match(/^\s*(?:```(?:json)?\s*)?\{\s*"message"\s*:\s*"/i);
  if (!start) return '';
  let text = '',
    complete = false;
  const escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  for (let i = start[0].length; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      complete = true;
      break;
    }
    if (c === '\\') {
      if (++i >= raw.length) break;
      if (raw[i] === 'u') {
        const hex = raw.slice(i + 1, i + 5);
        if (hex.length < 4) break;
        if (!/^[a-f0-9]{4}$/i.test(hex)) return '';
        text += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else {
        if (!(raw[i] in escapes)) return '';
        text += escapes[raw[i]];
      }
    } else {
      if (c.charCodeAt(0) < 32) return '';
      text += c;
    }
    if (text.length > 8000) return '';
  }
  if (key) {
    text = redactModelValue(text, key);
    if (!complete)
      for (let n = Math.min(key.length - 1, text.length); n > 0; n--)
        if (text.endsWith(key.slice(0, n))) {
          text = text.slice(0, -n);
          break;
        }
  }
  if (!complete) text = text.slice(0, Math.max(0, text.length - 8));
  if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
  return safeLearningMessage(text);
}
