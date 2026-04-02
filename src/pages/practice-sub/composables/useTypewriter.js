/**
 * 打字机效果 Composable
 *
 * [分包隔离副本] 与 pages/chat/composables/useTypewriter.js 内容完全相同。
 * 因微信小程序分包不能跨包引用，需在各分包维护独立副本。
 * 修改时请同步更新对应副本。
 *
 * 将一段完整文本以逐字/逐词动画渲染，模拟 AI 流式输出体验。
 * 无需后端 SSE 支持，纯前端实现。
 *
 * 用法：
 *   const { displayText, isTyping, startTyping, stopTyping } = useTypewriter();
 *   await startTyping('这是一段 AI 回复的文本...');
 *
 * @module composables/useTypewriter
 */

import { ref, onBeforeUnmount, getCurrentInstance } from 'vue';

/**
 * @param {Object} options
 * @param {number} [options.speed=30] - 每个字符的间隔（毫秒）
 * @param {number} [options.initialDelay=200] - 开始前的延迟（毫秒）
 * @param {boolean} [options.byWord=false] - 按词输出（适合英文），false 则按字符
 * @param {Function} [options.onChar] - 每输出一个字符/词时的回调
 * @param {Function} [options.onComplete] - 打字完成时的回调
 */
export function useTypewriter(options = {}) {
  const { speed = 30, initialDelay = 200, byWord = false, onChar = null, onComplete = null } = options;

  const displayText = ref('');
  const isTyping = ref(false);
  let _timer = null;
  let _cancelled = false;

  /**
   * 开始打字机效果
   * @param {string} fullText - 完整文本
   * @returns {Promise<void>} - 打字完成时 resolve
   */
  function startTyping(fullText) {
    stopTyping();
    if (!fullText) return Promise.resolve();

    _cancelled = false;
    displayText.value = '';
    isTyping.value = true;

    const tokens = byWord ? fullText.split(/(\s+)/) : Array.from(fullText);
    let index = 0;

    return new Promise((resolve) => {
      // 初始延迟，模拟"思考"
      _timer = setTimeout(() => {
        _timer = setInterval(
          () => {
            if (_cancelled || index >= tokens.length) {
              _cleanup();
              displayText.value = fullText; // 确保完整显示
              isTyping.value = false;
              if (onComplete) onComplete();
              resolve();
              return;
            }

            displayText.value += tokens[index];
            index++;

            if (onChar) onChar(displayText.value, index, tokens.length);
          },
          _getSpeed(tokens, index)
        );
      }, initialDelay);
    });
  }

  /**
   * 立即停止打字，显示完整文本
   * @param {string} [fullText] - 可选，强制设置最终文本
   */
  function stopTyping(fullText) {
    _cancelled = true;
    _cleanup();
    if (fullText != null) {
      displayText.value = fullText;
    }
    isTyping.value = false;
  }

  /**
   * 跳过动画，立即显示全部
   * @param {string} fullText
   */
  function skipToEnd(fullText) {
    stopTyping(fullText);
  }

  function _cleanup() {
    if (_timer) {
      clearInterval(_timer);
      clearTimeout(_timer);
      _timer = null;
    }
  }

  /**
   * 动态速度：标点符号后稍作停顿，更自然
   */
  function _getSpeed(tokens, index) {
    if (index <= 0 || index >= tokens.length) return speed;
    const prev = tokens[index - 1];
    // 中文标点或英文标点后停顿更长
    if (/[。！？；：，、.!?;:,]$/.test(prev)) {
      return speed * 3;
    }
    if (/[\n]/.test(prev)) {
      return speed * 5;
    }
    return speed;
  }

  // R14: 如果在组件 setup 上下文中使用，自动注册清理钩子防止内存泄漏
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      _cleanup();
    });
  }

  return {
    /** 当前已显示的文本（响应式） */
    displayText,
    /** 是否正在打字中（响应式） */
    isTyping,
    /** 开始打字机效果 */
    startTyping,
    /** 停止打字 */
    stopTyping,
    /** 跳过动画直接显示全部 */
    skipToEnd
  };
}
