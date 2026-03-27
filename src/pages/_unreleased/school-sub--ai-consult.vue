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
              <BaseIcon name="robot" :size="30" />
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

<script>
import { lafService } from '@/services/lafService.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'AiConsult',
  components: { BaseIcon },
  props: {
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
  },
  emits: ['close'],
  data() {
    return {
      messages: [],
      inputContent: '',
      scrollToView: '',
      isTyping: false,
      canSend: false
    };
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        // 弹窗显示时，滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
          // 如果有初始问题，自动发送
          if (this.initialQuery && this.messages.length === 0) {
            this.inputContent = this.initialQuery;
            this.canSend = true;
            this.sendMessage();
          }
        });
      }
    },
    messages() {
      // 消息更新时，滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom();
      });
    }
  },
  methods: {
    // 滚动到底部
    scrollToBottom() {
      if (this.isTyping) {
        this.scrollToView = 'message-typing';
        return;
      }
      this.scrollToView = this.messages.length > 0 ? `message-${this.messages.length - 1}` : 'message-empty';
    },

    // 输入内容变化
    onInputChange(e) {
      this.inputContent = e.detail.value;
      this.canSend = this.inputContent.trim().length > 0;
    },

    // 发送消息
    async sendMessage() {
      if (!this.canSend || this.isTyping) return;

      const content = this.inputContent.trim();
      if (content.length === 0) return;

      // 添加用户消息
      this.messages.push({
        role: 'user',
        content: content,
        time: this.getCurrentTime()
      });

      // 清空输入框
      this.inputContent = '';
      this.canSend = false;

      // 显示正在输入状态
      this.isTyping = true;

      try {
        // 调用智谱智能 API获取回复
        const response = await this.callAIApi(content);

        // 添加助手消息
        this.messages.push({
          role: 'assistant',
          content: response,
          time: this.getCurrentTime()
        });
      } catch (error) {
        logger.error('智能回复失败:', error);

        // 添加可重试的错误消息
        this.messages.push({
          role: 'assistant',
          content: '抱歉，智能回复失败，请点击重试。',
          time: this.getCurrentTime(),
          failed: true,
          _retryContent: content
        });
      } finally {
        // 隐藏正在输入状态
        this.isTyping = false;
      }
    },

    // 重试失败的消息
    async retryMessage(index) {
      const failedMsg = this.messages[index];
      if (!failedMsg || !failedMsg.failed || this.isTyping) return;

      const content = failedMsg._retryContent;
      if (!content) return;

      // 移除失败消息
      this.messages.splice(index, 1);

      // 显示正在输入状态
      this.isTyping = true;

      try {
        const response = await this.callAIApi(content);
        this.messages.push({
          role: 'assistant',
          content: response,
          time: this.getCurrentTime()
        });
      } catch (error) {
        logger.error('智能重试失败:', error);
        this.messages.push({
          role: 'assistant',
          content: '抱歉，智能回复仍然失败，请稍后再试。',
          time: this.getCurrentTime(),
          failed: true,
          _retryContent: content
        });
      } finally {
        this.isTyping = false;
      }
    },

    // 调用智谱智能 API
    async callAIApi(content) {
      logger.log('[ai-consult] 🤖 调用后端代理进行智能咨询...');

      // [F3-FIX] 构建多轮对话历史（最近 5 轮）
      const recentHistory = this.messages
        .filter((m) => !m.failed)
        .slice(-10) // 最近 10 条消息（5 轮对话）
        .map((m) => ({ role: m.role, content: m.content }));

      // ✅ 使用后端代理调用（安全）- action: 'consult'
      const response = await lafService.proxyAI('consult', {
        content: content,
        schoolName: this.schoolName,
        question: content,
        // [F3-FIX] 传递学校详情和对话历史
        schoolInfo: this.schoolInfo || {},
        history: recentHistory
      });

      logger.log('[ai-consult] 📥 后端代理响应:', {
        code: response?.code,
        hasData: !!response?.data
      });

      // 处理API响应
      if (response && response.code === 0 && response.data) {
        logger.log('[ai-consult] ✅ 智能咨询成功');
        return response.data.trim();
      } else {
        logger.warn('[ai-consult] ⚠️ 智能咨询响应异常');
        throw new Error('智能响应失败');
      }
    },

    // 获取当前时间
    getCurrentTime() {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    },

    // 关闭咨询弹窗
    closeConsult() {
      this.$emit('close');
    }
  }
};
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
  background: rgba(9, 18, 12, 0.26);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.consult-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-height: 86vh;
  padding: 14rpx 24rpx calc(24rpx + constant(safe-area-inset-bottom));
  padding: 14rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 38rpx 38rpx 0 0;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: 0 -20rpx 70rpx rgba(21, 49, 28, 0.18);
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
  color: var(--text-secondary);
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main);
}

.header-subtitle {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--text-sub);
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
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.44);
  box-shadow: var(--apple-shadow-surface);
  color: var(--text-main);
}

.intro-card {
  margin-bottom: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}

.intro-title {
  font-size: 26rpx;
  font-weight: 650;
  color: var(--text-main);
}

.intro-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--text-sub);
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
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
  color: var(--text-main);
}

.welcome-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-bubble,
.welcome-bubble,
.typing-bubble {
  max-width: 72%;
  padding: 18rpx 22rpx;
  border-radius: 26rpx;
  box-shadow: var(--apple-shadow-surface);
}

.assistant-bubble,
.welcome-bubble,
.typing-bubble {
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.42);
}

.user-bubble {
  background: var(--cta-primary-bg);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.message-text {
  font-size: 26rpx;
  line-height: 1.6;
  word-break: break-word;
  color: var(--text-main);
}

.user-bubble .message-text {
  color: var(--cta-primary-text);
}

.assistant-bubble.failed {
  border-color: rgba(255, 59, 48, 0.35);
  background: rgba(255, 99, 90, 0.1);
}

.retry-text {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: var(--ds-color-error, #ff3b30);
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
  background: var(--text-sub);
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
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}

.message-input {
  width: 100%;
  min-height: 88rpx;
  max-height: 180rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--text-main);
}

.placeholder-text {
  color: var(--text-sub);
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
  color: var(--text-sub);
}

.send-btn {
  min-width: 128rpx;
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.42);
  opacity: 0.6;
}

.send-btn.can-send {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
  opacity: 1;
}

.send-text {
  font-size: 24rpx;
  font-weight: 620;
  color: var(--text-main);
}

.send-btn.can-send .send-text {
  color: var(--cta-primary-text);
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
