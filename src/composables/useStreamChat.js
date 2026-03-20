/**
 * 流式聊天 Composable
 *
 * 封装 streamService，提供 Vue 响应式接口。
 * H5 平台真流式输出，小程序平台自动降级为 useTypewriter 模拟效果。
 *
 * 用法：
 *   const { streamingText, isStreaming, startStream, stopStream, error } = useStreamChat();
 *   await startStream({ prompt: '你好', friendType: 'yan-cong' });
 *
 * @module composables/useStreamChat
 */

import { ref } from 'vue';
import { streamChat } from '@/services/streamService.js';
import { useTypewriter } from './useTypewriter.js';

/**
 * @param {Object} [options]
 * @param {boolean} [options.useTypewriterFallback=true] - 非流式平台是否用打字机效果
 * @param {number} [options.typewriterSpeed=30] - 打字机速度（毫秒/字符）
 */
export function useStreamChat(options = {}) {
  const { useTypewriterFallback = true, typewriterSpeed = 30 } = options;

  const streamingText = ref('');
  const isStreaming = ref(false);
  const error = ref(null);

  let _controller = null;
  let _platform = null;

  // 检测平台（缓存结果）
  function getPlatform() {
    if (_platform) return _platform;
    try {
      const info = uni.getSystemInfoSync();
      _platform = info.uniPlatform?.startsWith('mp-') ? 'mp' : 'h5';
    } catch (_e) {
      _platform = 'h5';
    }
    return _platform;
  }

  // 打字机实例（仅非流式平台使用）
  const typewriter = useTypewriterFallback ? useTypewriter({ speed: typewriterSpeed }) : null;

  /**
   * 开始流式请求
   * @param {Object} params
   * @param {string} params.prompt - 用户消息
   * @param {string} [params.action='friend_chat'] - 后端 action
   * @param {string} [params.friendType] - 好友类型
   * @param {Array} [params.history] - 对话历史
   * @param {string} [params.emotion] - 情绪状态
   * @returns {Promise<string>} resolve 时返回完整文本
   */
  function startStream(params) {
    // 先停掉上一次
    stopStream();

    streamingText.value = '';
    isStreaming.value = true;
    error.value = null;

    const platform = getPlatform();
    const isH5 = platform === 'h5';

    return new Promise((resolve) => {
      _controller = streamChat({
        action: params.action,
        prompt: params.prompt,
        friendType: params.friendType,
        history: params.history,
        emotion: params.emotion,

        onChunk(chunk) {
          if (isH5) {
            // H5 真流式：逐 token 追加
            streamingText.value += chunk;
          } else if (useTypewriterFallback && typewriter) {
            // 小程序降级：收到完整文本后用打字机模拟
            // onChunk 在 fallback 模式下只调用一次（整段文本）
            typewriter.startTyping(chunk);
            // 同步 typewriter 的 displayText 到 streamingText
            _syncTypewriter();
          } else {
            streamingText.value += chunk;
          }
        },

        onDone() {
          isStreaming.value = false;
          resolve(streamingText.value);
        },

        onError(err) {
          error.value = err?.message || '流式请求失败';
          isStreaming.value = false;
          resolve(streamingText.value);
        }
      });
    });
  }

  /**
   * 将 typewriter.displayText 同步到 streamingText（轮询直到打字完成）
   */
  function _syncTypewriter() {
    if (!typewriter) return;
    const interval = setInterval(() => {
      streamingText.value = typewriter.displayText.value;
      if (!typewriter.isTyping.value) {
        clearInterval(interval);
        isStreaming.value = false;
      }
    }, 50);
  }

  /**
   * 停止流式生成
   */
  function stopStream() {
    if (_controller) {
      _controller.abort();
      _controller = null;
    }
    if (typewriter?.isTyping.value) {
      typewriter.stopTyping(streamingText.value);
    }
    isStreaming.value = false;
  }

  return {
    /** 当前已接收的文本（响应式） */
    streamingText,
    /** 是否正在流式接收中（响应式） */
    isStreaming,
    /** 错误信息（响应式），null 表示无错误 */
    error,
    /** 开始流式请求 */
    startStream,
    /** 停止流式生成 */
    stopStream
  };
}
