<template>
  <view v-if="visible" class="ai-consult-container" :class="{ 'dark-mode': isDark }">
    <view class="consult-mask" @tap="closeConsult" />

    <view class="consult-panel" @tap.stop>
      <view class="panel-handle" />

      <view class="panel-header">
        <view class="header-copy">
          <text class="header-eyebrow"> AI Consult </text>
          <text class="header-title"> 智能咨询 </text>
          <text class="header-subtitle"> {{ schoolName }} </text>
        </view>
        <view class="close-btn" @tap="closeConsult">
          <BaseIcon name="close" :size="28" />
        </view>
      </view>

      <view class="intro-card">
        <text class="intro-title"> 你可以直接问我这些问题 </text>
        <text class="intro-text"> 招生情况、专业推荐、院校优势、报考建议，都会结合 {{ schoolName }} 给你回答。 </text>
      </view>

      <scroll-view scroll-y class="chat-content" :scroll-into-view="scrollToView" scroll-with-animation>
        <view class="message-list">
          <view v-if="messages.length === 0" id="message-empty" class="welcome-card">
            <view class="welcome-avatar">
              <!-- AI助手欢迎插画（替换原 robot 图标） -->
              <image
                class="welcome-illustration"
                src="/static/illustrations/ai-welcome.png"
                mode="aspectFit"
                lazy-load
              />
            </view>
            <view class="welcome-bubble">
              <text class="message-text"> 你好！我是智能升学顾问，有关于 {{ schoolName }} 的任何问题都可以问我。 </text>
            </view>
          </view>

          <view
            v-for="(message, index) in messages"
            :id="'message-' + index"
            :key="index"
            :class="['message-row', message.role === 'user' ? 'user-row' : 'assistant-row']"
          >
            <template v-if="message.role === 'user'">
              <view class="message-bubble user-bubble">
                <text class="message-text"> {{ message.content }} </text>
              </view>
              <view class="message-avatar user-avatar">
                <BaseIcon name="heart" :size="28" />
              </view>
            </template>

            <template v-else>
              <view class="message-avatar assistant-avatar">
                <BaseIcon name="robot" :size="28" />
              </view>
              <view
                class="message-bubble assistant-bubble"
                :class="{ failed: message.failed }"
                @tap="message.failed ? retryMessage(index) : null"
              >
                <text class="message-text"> {{ message.content }} </text>
                <text v-if="message.failed" class="retry-text"> 点按重试 </text>
              </view>
            </template>
          </view>

          <view v-if="isTyping" id="message-typing" class="message-row assistant-row">
            <view class="message-avatar assistant-avatar">
              <BaseIcon name="robot" :size="28" />
            </view>
            <view class="message-bubble typing-bubble">
              <view class="typing-dots">
                <view class="typing-dot" />
                <view class="typing-dot" />
                <view class="typing-dot" />
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="input-area">
        <view class="input-shell">
          <textarea
            id="e2e-school-consult-input"
            v-model="inputContent"
            class="message-input"
            placeholder="请输入您的问题..."
            placeholder-class="placeholder-text"
            :maxlength="200"
            @input="onInputChange"
            @confirm="sendMessage"
          ></textarea>
          <view class="input-footer">
            <text class="char-count"> {{ inputContent.length }}/200 </text>
            <view
              id="e2e-school-consult-send"
              class="send-btn"
              :class="{ 'can-send': canSend }"
              :disabled="!canSend || isTyping"
              @tap="sendMessage"
            >
              <text class="send-text"> 发送 </text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useSchoolStore } from '@/stores/modules/school.js';
// 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { sanitizeAIChatInput } from '@/utils/security/sanitize.js';

// ==================== Props & Emits ====================
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  schoolName: {
    type: String,
    default: '该院校'
  },
  schoolInfo: {
    type: Object,
    default: () => ({})
  },
  initialQuery: {
    type: String,
    default: ''
  },
  isDark: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

// ==================== 响应式数据 ====================
const messages = ref([]);
const inputContent = ref('');
const scrollToView = ref('');
const isTyping = ref(false);
const canSend = ref(false);

// ==================== 侦听器 ====================
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      // 弹窗显示时，滚动到底部
      nextTick(() => {
        scrollToBottom();
        // 如果有初始问题，自动发送
        if (props.initialQuery && messages.value.length === 0) {
          inputContent.value = props.initialQuery;
          canSend.value = true;
          sendMessage();
        }
      });
    }
  }
);

watch(
  messages,
  () => {
    // 消息更新时，滚动到底部
    nextTick(() => {
      scrollToBottom();
    });
  },
  { deep: true }
);

// ==================== 方法 ====================

// 滚动到底部
function scrollToBottom() {
  if (isTyping.value) {
    scrollToView.value = 'message-typing';
    return;
  }
  scrollToView.value = messages.value.length > 0 ? `message-${messages.value.length - 1}` : 'message-empty';
}

// 输入内容变化
function onInputChange(e) {
  inputContent.value = e.detail.value;
  canSend.value = inputContent.value.trim().length > 0;
}

// 发送消息
async function sendMessage() {
  if (!canSend.value || isTyping.value) return;

  const content = sanitizeAIChatInput(inputContent.value.trim());
  if (content.length === 0) return;

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: content,
    time: getCurrentTime()
  });

  // 清空输入框
  inputContent.value = '';
  canSend.value = false;

  // 显示正在输入状态
  isTyping.value = true;

  try {
    // 调用智谱智能 API获取回复
    const response = await callAIApi(content);

    // 添加助手消息
    messages.value.push({
      role: 'assistant',
      content: response,
      time: getCurrentTime()
    });
  } catch (error) {
    logger.error('智能回复失败:', error);

    // 添加可重试的错误消息
    messages.value.push({
      role: 'assistant',
      content: '抱歉，智能回复失败，请点击重试。',
      time: getCurrentTime(),
      failed: true,
      _retryContent: content
    });
  } finally {
    // 隐藏正在输入状态
    isTyping.value = false;
  }
}

// 重试失败的消息
async function retryMessage(index) {
  const failedMsg = messages.value[index];
  if (!failedMsg || !failedMsg.failed || isTyping.value) return;

  const content = failedMsg._retryContent;
  if (!content) return;

  // 移除失败消息
  messages.value.splice(index, 1);

  // 显示正在输入状态
  isTyping.value = true;

  try {
    const response = await callAIApi(content);
    messages.value.push({
      role: 'assistant',
      content: response,
      time: getCurrentTime()
    });
  } catch (error) {
    logger.error('智能重试失败:', error);
    messages.value.push({
      role: 'assistant',
      content: '抱歉，智能回复仍然失败，请稍后再试。',
      time: getCurrentTime(),
      failed: true,
      _retryContent: content
    });
  } finally {
    isTyping.value = false;
  }
}

// 调用智谱智能 API
async function callAIApi(content) {
  logger.log('[ai-consult] 调用后端代理进行智能咨询...');

  // [F3-FIX] 构建多轮对话历史（最近 5 轮）
  const recentHistory = messages.value
    .filter((m) => !m.failed)
    .slice(-10) // 最近 10 条消息（5 轮对话）
    .map((m) => ({ role: m.role, content: m.content }));

  // 通过 school store 调用 AI 咨询（遵循分层纪律）
  const schoolStore = useSchoolStore();
  const response = await schoolStore.aiRecommend('consult', {
    content: content,
    schoolName: props.schoolName,
    question: content,
    // [F3-FIX] 传递学校详情和对话历史
    schoolInfo: props.schoolInfo || {},
    history: recentHistory
  });

  logger.log('[ai-consult] 后端代理响应:', {
    code: response?.code,
    hasData: !!response?.data
  });

  // 处理API响应
  if (response && response.code === 0 && response.data) {
    logger.log('[ai-consult] 智能咨询成功');
    return response.data.trim();
  } else {
    logger.warn('[ai-consult] 智能咨询响应异常');
    throw new Error('智能响应失败');
  }
}

// 获取当前时间
function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 关闭咨询弹窗
function closeConsult() {
  emit('close');
}
</script>

<style lang="scss" scoped>
.ai-consult-container {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
}

.consult-mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.3);
}

.consult-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-height: 86vh;
  padding: 14rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 28rpx 28rpx 0 0;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 -8rpx 32rpx rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.panel-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 18rpx;
}

.panel-header {
  display: flex;
  align-items: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding: 0 8rpx 18rpx;
}

.header-copy {
  flex: 1;
}

.header-eyebrow,
.header-title,
.header-subtitle,
.intro-title,
.intro-text,
.message-text,
.retry-text,
.char-count,
.send-text {
  display: block;
}

.header-eyebrow {
  margin-bottom: 6rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--warning);
}

.header-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.header-subtitle {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.close-btn,
.message-avatar,
.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.close-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  color: var(--text-primary);
}

.intro-card {
  margin-bottom: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 150, 0, 0.08);
  border: 2rpx solid rgba(255, 150, 0, 0.12);
  box-shadow: none;
}

.intro-title {
  font-size: 26rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.intro-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--text-secondary);
}

.chat-content {
  flex: 1;
  min-height: 0;
  padding: 4rpx 8rpx;
}

.message-list {
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding-bottom: 12rpx;
}

.welcome-card,
.message-row {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  align-items: flex-end;
}

.user-row {
  justify-content: flex-end;
}

.welcome-card {
  align-items: flex-start;
}

.message-avatar,
.welcome-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(255, 150, 0, 0.12);
  border: none;
  box-shadow: none;
  color: var(--warning);
}

.welcome-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* AI助手欢迎插画 */
.welcome-illustration {
  width: 200rpx;
  height: 160rpx;
}

.message-bubble,
.welcome-bubble,
.typing-bubble {
  max-width: 72%;
  padding: 18rpx 22rpx;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.assistant-bubble,
.welcome-bubble,
.typing-bubble {
  background: var(--bg-secondary);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.user-bubble {
  background: var(--warning);
  border: none;
  box-shadow: 0 4rpx 0 var(--warning-dark, #cc7800);
}

.message-text {
  font-size: 26rpx;
  line-height: 1.6;
  word-break: break-word;
  color: var(--text-primary);
}

.user-bubble .message-text {
  color: var(--text-inverse);
}

.assistant-bubble.failed {
  border-color: color-mix(in srgb, var(--danger) 35%, transparent);
  background: rgba(255, 99, 90, 0.1);
}

.retry-text {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: var(--ds-color-error, var(--danger));
}

.typing-bubble {
  min-width: 112rpx;
}

.typing-dots {
  display: flex;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
}

.typing-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--text-secondary);
  animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

.input-area {
  padding-top: 18rpx;
}

.input-shell {
  padding: 14rpx 16rpx 16rpx;
  border-radius: 24rpx;
  background: var(--bg-secondary);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: none;
}

.message-input {
  width: 100%;
  min-height: 88rpx;
  max-height: 180rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--text-primary);
}

.placeholder-text {
  color: var(--text-secondary);
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  margin-top: 8rpx;
}

.char-count {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.send-btn {
  min-width: 128rpx;
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: var(--bg-secondary);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  opacity: 0.6;
}

.send-btn.can-send {
  background: var(--warning);
  border-color: var(--warning);
  box-shadow: 0 4rpx 0 var(--warning-dark, #cc7800);
  opacity: 1;
}

.send-text {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-secondary);
}

.send-btn.can-send .send-text {
  color: var(--text-inverse);
}

.close-btn:active,
.send-btn:active,
.assistant-bubble.failed:active {
  transform: scale(0.97);
}

.dark-mode .consult-mask {
  background: rgba(0, 0, 0, 0.56);
}

.dark-mode .consult-panel,
.dark-mode .intro-card,
.dark-mode .close-btn,
.dark-mode .message-avatar,
.dark-mode .welcome-avatar,
.dark-mode .assistant-bubble,
.dark-mode .welcome-bubble,
.dark-mode .typing-bubble,
.dark-mode .input-shell,
.dark-mode .send-btn {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.92) 0%, rgba(10, 12, 18, 0.88) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .send-btn.can-send,
.dark-mode .user-bubble {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }

  30% {
    transform: translateY(-8rpx);
    opacity: 1;
  }
}
</style>
