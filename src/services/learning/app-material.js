import { assert } from './learning-domain.js';
import { MATERIAL_LIMITS } from './material-intake.js';
import { getAppConnectorBridge } from './app-connector.js';

export const APP_FILE_CONTRACT = 'wenli-app-file-v1';
const validHandle = (value) =>
  typeof value === 'string' && /^file_[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const codes = [
  'CANCELLED',
  'TIMEOUT',
  'BUSY',
  'REQUEST_CONFLICT',
  'INVALID_REQUEST',
  'CONSENT_REQUIRED',
  'FILE_TYPE',
  'FILE_LIMIT',
  'FILE_CHANGED',
  'FILE_EXPIRED',
  'FILE_READ_FAILED'
];
function bridge() {
  const module = getAppConnectorBridge();
  let caps;
  try {
    caps = module.getCapabilities()?.file;
  } catch {
    assert(false, 'PLATFORM_UNSUPPORTED', 'App无法确认文件保护能力，未选择或读取文件');
  }
  assert(
    caps?.contract === APP_FILE_CONTRACT &&
      caps.selection === 'system' &&
      caps.read === 'after_consent' &&
      caps.handles === 'ephemeral' &&
      caps.maxBytes === MATERIAL_LIMITS.maxBytes &&
      caps.boundedRead === true &&
      caps.cancel === true &&
      ['chooseMaterialFile', 'readMaterialFile', 'releaseMaterialFile', 'cancelFileOperation'].every(
        (name) => typeof module[name] === 'function'
      ),
    'PLATFORM_UNSUPPORTED',
    '此App尚未装配受保护文件选择模块，未读取资料'
  );
  return module;
}
export function appMaterialSupported() {
  try {
    bridge();
    return true;
  } catch {
    return false;
  }
}
function release(module, file) {
  if (validHandle(file?.handle))
    try {
      module.releaseMaterialFile({ handle: file.handle });
    } catch {
      /* 内存句柄过期/模块退出后不可再读取，不向其他传输回退。 */
    }
}
export function releaseAppMaterialFile(file) {
  if (!validHandle(file?.handle)) return;
  try {
    release(bridge(), file);
  } catch {
    /* 缺模块时不调用其他文件API，原生会话退出释放。 */
  }
}
function metadata(file) {
  assert(validHandle(file?.handle), 'INVALID_RESPONSE', '文件选择未返回本次临时句柄');
  assert(
    typeof file.name === 'string' &&
      file.name.length <= 200 &&
      /\.(?:pdf|png|jpe?g)$/i.test(file.name) &&
      !/[/\\\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069]/.test(file.name),
    'FILE_TYPE',
    '请选择PDF或PNG/JPEG图片'
  );
  assert(
    Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MATERIAL_LIMITS.maxBytes,
    'FILE_LIMIT',
    '文件超过10 MB或大小不合法'
  );
  return { handle: file.handle, name: file.name, size: file.size };
}
function operation(method, input, { signal, assertCurrent = () => undefined, timeout }) {
  const module = bridge();
  assert(!signal?.aborted, 'CANCELLED', '文件动作已取消');
  assertCurrent();
  const id = `app_file_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    let ended = false;
    const finish = (value, error) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (error) {
        try {
          module.cancelFileOperation({ id });
        } catch {
          /* 迟到结果仍拒绝。 */
        }
        reject(error);
      } else resolve(value);
    };
    const fail = (code, message) => {
      try {
        assert(false, code, message);
      } catch (error) {
        finish(null, error);
      }
    };
    const cancel = () => fail('CANCELLED', '文件动作已取消，未发送资料');
    const timer = setTimeout(() => fail('TIMEOUT', '文件选择或读取超时，请重新选择'), timeout);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      assert(!signal?.aborted, 'CANCELLED', '文件动作已取消');
      module[method]({ id, ...input }, (response) => {
        if (ended) {
          if (method === 'chooseMaterialFile' && response?.id === id) release(module, response.file);
          return;
        }
        try {
          assert(response?.id === id, 'INVALID_RESPONSE', '原生文件响应不属于本次动作');
          assertCurrent();
          assert(!signal?.aborted, 'CANCELLED', '文件动作已取消');
          if (response.code)
            assert(
              false,
              codes.includes(response.code) ? response.code : 'FILE_READ_FAILED',
              '文件动作未完成，未自动读取或发送资料'
            );
          if (method === 'chooseMaterialFile') {
            const file = metadata(response.file);
            finish(file);
            return;
          }
          assert(
            response.handle === input.handle && response.name === input.name && response.size === input.size,
            'FILE_CHANGED',
            '所选文件信息已变化，请重新选择'
          );
          const data = response.contentBase64,
            expected = 4 * Math.ceil(input.size / 3);
          assert(
            typeof data === 'string' &&
              data.length === expected &&
              /^[A-Za-z0-9+/]+={0,2}$/.test(data) &&
              (data.match(/=+$/)?.[0].length || 0) === (3 - (input.size % 3)) % 3,
            'FILE_CHANGED',
            '读取字节或编码与本次选择不一致'
          );
          // canonical尾位：不接受同长但有未使用非零位的Base64。
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          if (input.size % 3 === 1)
            assert((alphabet.indexOf(data.at(-3)) & 15) === 0, 'FILE_CHANGED', '文件编码不完整');
          if (input.size % 3 === 2) assert((alphabet.indexOf(data.at(-2)) & 3) === 0, 'FILE_CHANGED', '文件编码不完整');
          finish({ name: input.name, size: input.size, contentBase64: data });
        } catch (error) {
          if (method === 'chooseMaterialFile' && response?.id === id) release(module, response.file);
          finish(null, error);
        }
      });
    } catch {
      fail('FILE_READ_FAILED', '原生文件模块未完成本次动作');
    }
  });
}
export async function chooseAppMaterialFile({ signal, assertCurrent } = {}) {
  return operation('chooseMaterialFile', {}, { signal, assertCurrent, timeout: 120000 });
}
export async function readAppMaterialFile(file, { consent, signal, assertCurrent } = {}) {
  assert(consent === true, 'CONSENT_REQUIRED', '请先明确允许把本次文件交给当前解析器；未读取文件');
  const selected = metadata(file);
  try {
    return await operation(
      'readMaterialFile',
      { ...selected, consent: true },
      { signal, assertCurrent, timeout: 15000 }
    );
  } finally {
    releaseAppMaterialFile(selected);
  }
}
