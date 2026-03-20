/**
 * ChatBox 逻辑 Composable
 *
 * 统一封装聊天消息管理、流式/打字机输出、历史持久化、滚动控制。
 * 供 ChatBox.vue 使用，保持模板层精简。
 *
 * @module composables/useChatBox
 */

import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { storageService } from '@/services/storageService.js';
import { useStreamChat } from './useStreamChat.js';
import { logger } from '@/utils/logger.js';

/**
 * @param {Object} opts
 * @param {string} opts.storageKey - localStorage 键名前缀
 * @param {string} opts.action - API action 类型
 * @param {string} opts.systemPrompt - 系统提示词
 * @param {Object} opts.context - 额外上下文
 * @param {number} [opts.maxHistory=10] - 发送给 API 的最大历史条数
 */
export function useChatBox(opts) {
  const messages = ref([]);
  const isTyping = ref(false);
  const scrollIntoView = ref('');

  const { streamingText, isStreaming, startStream, stopStream, error: streamError } = useStreamChat();

  // 暗黑模式
  const isDark = ref(false);
  const _onThemeUpdate = (mode) => {
    isDark.value = mode === 'dark';
  };

  onMounted(() => {
    isDark.value = storageService.get('theme_mode', 'light') === 'dark';
    uni.$on('themeUpdate', _onThemeUpdate);
    loadHistory();
  });

  onUnmounted(() => {
    uni.$off('themeUpdate', _onThemeUpdate);
    stopStream();
  });

  // ---- 历史持久化 ----

  function loadHistory() {
    if (!opts.storageKey) return;
    try {
      const saved = storageService.get(opts.storageKey, []);
      if (saved.length) messages.value = saved.slice(-50);
      nextTick(scrollToBottom);
    } catch (e) {
      logger.warn('[ChatBox] loadHistory failed:', e);
    }
  }

  function saveHistory() {
    if (!opts.storageKey) return;
    try {
      storageService.save(opts.storageKey, messages.value.slice(-50));
    } catch (e) {
      logger.warn('[ChatBox] saveHistory failed:', e);
    }
  }

  function clearHistory() {
    messages.value = [];
    saveHistory();
  }

  // ---- 滚动 ----

  function scrollToBottom() {
    nextTick(() => {
      scrollIntoView.value = 'chatbox-bottom';
      setTimeout(() => {
        scrollIntoView.value = '';
      }, 100);
    });
  }

  // ---- 时间格式化 ----

  function formatTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ---- 构建历史上下文 ----

  function buildHistory() {
    const max = opts.maxHistory || 10;
    return messages.value
      .filter((m) => !m.failed && m.content)
      .slice(-max)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  // ---- 发送消息 ----

  async function sendMessage(content) {
    if (!content?.trim() || isStreaming.value || isTyping.value) return;

    const text = content.trim();

    // 用户消息
    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      time: formatTime(),
      status: 'sending'
    };
    messages.value.push(userMsg);
    scrollToBottom();

    // 开始流式请求
    isTyping.value = true;

    // 占位 assistant 消息
    const aiMsg = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      time: formatTime(),
      status: 'sending'
    };
    messages.value.push(aiMsg);
    const aiIdx = messages.value.length - 1;

    try {
      const fullText = await startStream({
        action: opts.action || 'friend_chat',
        prompt: text,
        history: buildHistory().slice(0, -1), // 排除刚加的 user msg（已在 prompt 中）
        emotion: opts.context?.emotion,
        friendType: opts.context?.friendType,
        systemPrompt: opts.systemPrompt,
        ...opts.context
      });

      // 流式过程中 streamingText 已实时更新，这里做最终赋值
      userMsg.status = 'sent';
      if (messages.value[aiIdx]) {
        messages.value[aiIdx].content = fullText || streamingText.value || '抱歉，暂时无法回复，请稍后再试~';
        messages.value[aiIdx].status = 'sent';
      }

      saveHistory();
    } catch (e) {
      logger.error('[ChatBox] sendMessage failed:', e);
      userMsg.status = 'failed';
      if (messages.value[aiIdx]) {
        messages.value[aiIdx].content = streamError.value || '网络错误，请稍后重试';
        messages.value[aiIdx].status = 'failed';
        messages.value[aiIdx].failed = true;
        messages.value[aiIdx]._retryContent = text;
      }
    } finally {
      isTyping.value = false;
      scrollToBottom();
    }
  }

  // ---- 重试 ----

  async function retryMessage(msgId) {
    const idx = messages.value.findIndex((m) => m.id === msgId);
    if (idx === -1) return;
    const msg = messages.value[idx];

    // 如果是失败的 assistant 消息，找到对应的用户消息重发
    if (msg.role === 'assistant' && msg.failed) {
      const retryContent = msg._retryContent;
      messages.value.splice(idx, 1); // 移除失败的 assistant 消息
      if (retryContent) await sendMessage(retryContent);
      return;
    }

    // 如果是失败的 user 消息，重发
    if (msg.role === 'user' && msg.status === 'failed') {
      messages.value.splice(idx, 1);
      await sendMessage(msg.content);
    }
  }

  // ---- 停止生成 ----

  function stopGeneration() {
    stopStream();
    isTyping.value = false;
    // 将最后一条 assistant 消息标记为已完成
    const last = messages.value[messages.value.length - 1];
    if (last?.role === 'assistant' && last.status === 'sending') {
      last.content = streamingText.value || last.content;
      last.status = 'sent';
    }
    saveHistory();
  }

  return {
    messages,
    isTyping,
    isStreaming,
    streamingText,
    isDark,
    scrollIntoView,
    sendMessage,
    retryMessage,
    stopGeneration,
    clearHistory,
    scrollToBottom
  };
}
