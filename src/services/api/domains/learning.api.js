import config from '../../../config/index.js';
import { getToken, getUserId, getLoginSessionEpoch } from '../../auth-storage.js';
import { generateLearningTurnStream } from '../../learning/learning-stream.js';
import poetryCache from '../../learning/poetry-cache.json';

// 学习模型请求固定到用户选择的后端，不使用跨服务自动故障切换，不记录消息和密钥。
export function learningRequest(path, body, options = {}) {
  options.assertCurrent?.();
  if (options.signal?.aborted) return Promise.resolve({ success: false, code: 499, message: '请求已取消，未再次发送' });
  if (options.expectedOwner && getUserId() !== options.expectedOwner)
    return Promise.resolve({ success: false, code: 409, message: '用户已切换，未发送旧账户记录' });
  const token = getToken();
  const session = getLoginSessionEpoch();
  if (!token) return Promise.resolve({ success: false, code: 401, message: '登录后可连接云模型；本地学习无需登录' });
  return new Promise((resolve) => {
    let abort;
    const finish = (value) => {
      if (abort) options.signal?.removeEventListener('abort', abort);
      try {
        options.assertCurrent?.();
      } catch {
        resolve({ success: false, code: 409, message: '登录会话已变化，旧响应未采用' });
        return;
      }
      resolve(
        getLoginSessionEpoch() !== session || (options.expectedOwner && getUserId() !== options.expectedOwner)
          ? { success: false, code: 409, message: '账户已切换，未读取旧账户响应' }
          : options.signal?.aborted
            ? { success: false, code: 499, message: '请求已取消，未读取旧响应' }
            : value
      );
    };
    const task = uni.request({
      url: `${config.api.baseUrl}${path}`,
      method: 'POST',
      data: body,
      timeout: 35000,
      header: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      success: (res) =>
        finish(
          res.data && typeof res.data === 'object'
            ? res.data
            : { success: false, code: 502, message: '模型服务响应无效' }
        ),
      fail: () =>
        finish({
          success: false,
          code: options.signal?.aborted ? 499 : 503,
          message: options.signal?.aborted
            ? ['/learning-compute', '/learning-grammar'].includes(path)
              ? '检查已取消，原答保持'
              : path === '/learning-sync'
                ? '同步已取消，本机记录保留；已发送批次可能已保存云端'
                : '请求已取消，实际模型用量可能仍待结算'
            : '服务连接不可用，学习记录已保存'
        })
    });
    if (options.signal) {
      abort = () => task.abort();
      if (options.signal.aborted) abort();
      else options.signal.addEventListener('abort', abort, { once: true });
    }
  });
}
export const fetchLearningModels = (options) => learningRequest('/learning-models', { action: 'list' }, options);
export const requestLearningComputation = (body, options) => learningRequest('/learning-compute', body, options);
export const requestLearningGrammar = (body, options) => learningRequest('/learning-grammar', body, options);
export const requestLearningPoetryReference = (options) =>
  learningRequest('/learning-models', { action: 'poetry', context: poetryCache.context }, options);
export const fetchLearningUsage = (options) => learningRequest('/learning-models', { action: 'usage' }, options);
export const testLearningModel = (modelId, requestId, options) =>
  learningRequest('/learning-models', { action: 'test', modelId, requestId, shareConsent: true }, options);
export const cancelLearningTurn = (requestId, options) =>
  learningRequest('/learning-models', { action: 'cancel', requestId }, options);
export const fetchLearningResult = (requestId, options) =>
  learningRequest('/learning-models', { action: 'result', requestId }, options);
export const saveLearningModel = (profile, shareConsent, options) =>
  learningRequest('/learning-models', { action: 'save', profile, shareConsent }, options);
export const deleteLearningModel = (profileId, options) =>
  learningRequest('/learning-models', { action: 'delete', profileId }, options);
export const generateLearningTurn = (body, options) =>
  options?.stream ? generateLearningTurnStream(body, options) : learningRequest('/proxy-ai', body, options);
