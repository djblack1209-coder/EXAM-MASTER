<template>
  <view v-if="visible" class="ai-consult-container" :class="{ 'dark-mode': isDark }">
    <!-- 遮罩层 -->
    <view class="consult-mask" @tap="closeConsult" />

    <!-- 咨询弹窗 -->
    <view class="consult-panel glass-card">
      <!-- 弹窗头部 -->
      <view class="panel-header ds-flex ds-flex-between">
        <view class="header-left ds-flex ds-flex-col">
          <text class="header-title ds-text-lg ds-font-bold">
            AI 咨询
          </text>
          <text class="header-subtitle ds-text-xs ds-text-secondary">
            {{ schoolName }}
          </text>
        </view>
        <view class="header-right ds-flex">
          <view class="close-btn ds-touchable ds-touch-target" @tap="closeConsult">
            ✕
          </view>
        </view>
      </view>

      <!-- 对话内容区域 -->
      <scroll-view
        scroll-y
        class="chat-content"
        :scroll-into-view="scrollToView"
        scroll-with-animation
      >
        <!-- 消息列表 -->
        <view class="message-list ds-flex ds-flex-col ds-gap-md">
          <!-- 欢迎消息 -->
          <view v-if="messages.length === 0" class="message-item assistant-message ds-flex ds-gap-sm">
            <view class="message-avatar ds-flex">
              🤖
            </view>
            <view class="message-bubble">
              <text class="message-text ds-text-sm">
                您好！我是AI咨询助手，很高兴为您解答关于{{ schoolName
                }}的考研问题。您可以咨询招生简章、历年分数线、专业设置等信息。
              </text>
            </view>
          </view>

          <!-- 消息记录 -->
          <view
            v-for="(message, index) in messages"
            :key="index"
            :class="[
              'message-item', 'ds-flex', 'ds-gap-sm',
              message.role === 'user' ? 'user-message' : 'assistant-message'
            ]"
          >
            <!-- 用户消息 -->
            <template v-if="message.role === 'user'">
              <view class="message-bubble user-bubble">
                <text class="message-text ds-text-sm">
                  {{ message.content }}
                </text>
              </view>
              <view class="message-avatar ds-flex">
                👤
              </view>
            </template>

            <!-- 助手消息 -->
            <template v-else>
              <view class="message-avatar ds-flex">
                🤖
              </view>
              <view
                class="message-bubble assistant-bubble"
                :class="{ 'failed-bubble': message.failed }"
                @tap="message.failed ? retryMessage(index) : null"
              >
                <text class="message-text ds-text-sm">
                  {{ message.content }}
                </text>
                <text v-if="message.failed" class="retry-hint ds-text-xs ds-text-secondary">
                  点击重试
                </text>
                <text class="message-time ds-text-xs ds-text-secondary">
                  {{ message.time }}
                </text>
              </view>
            </template>
          </view>

          <!-- 正在输入状态 -->
          <view v-if="isTyping" class="message-item assistant-message ds-flex ds-gap-sm">
            <view class="message-avatar ds-flex">
              🤖
            </view>
            <view class="message-bubble assistant-bubble">
              <view class="typing-indicator ds-flex ds-gap-xs">
                <view class="typing-dot" />
                <view class="typing-dot" />
                <view class="typing-dot" />
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 输入区域 -->
      <view class="input-area">
        <view class="input-container ds-flex">
          <textarea
            v-model="inputContent"
            class="message-input ds-text-sm"
            placeholder="请输入您的问题..."
            placeholder-class="placeholder-text"
            :maxlength="200"
            @input="onInputChange"
            @confirm="sendMessage"
          ></textarea>
          <view class="input-actions ds-flex ds-gap-xs">
            <text class="char-count ds-text-xs ds-text-secondary">
              {{ inputContent.length }}/200
            </text>
            <view
              class="send-btn ds-touchable ds-flex"
              :class="{ 'can-send': canSend }"
              :disabled="!canSend || isTyping"
              @tap="sendMessage"
            >
              <text class="send-icon">
                →
              </text>
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

export default {
  name: 'AiConsult',
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
      this.scrollToView = `message-${this.messages.length - 1}`;
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
        // 调用智谱AI API获取回复
        const response = await this.callAIApi(content);

        // 添加助手消息
        this.messages.push({
          role: 'assistant',
          content: response,
          time: this.getCurrentTime()
        });
      } catch (error) {
        logger.error('AI回复失败:', error);

        // 添加可重试的错误消息
        this.messages.push({
          role: 'assistant',
          content: '抱歉，AI回复失败，请点击重试。',
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
        logger.error('AI重试失败:', error);
        this.messages.push({
          role: 'assistant',
          content: '抱歉，AI回复仍然失败，请稍后再试。',
          time: this.getCurrentTime(),
          failed: true,
          _retryContent: content
        });
      } finally {
        this.isTyping = false;
      }
    },

    // 调用智谱AI API
    async callAIApi(content) {
      logger.log('[ai-consult] 🤖 调用后端代理进行 AI 咨询...');

      // ✅ 使用后端代理调用（安全）- action: 'consult'
      const response = await lafService.proxyAI('consult', {
        schoolName: this.schoolName,
        question: content
      });

      logger.log('[ai-consult] 📥 后端代理响应:', {
        code: response?.code,
        hasData: !!response?.data
      });

      // 处理API响应
      if (response && response.code === 0 && response.data) {
        logger.log('[ai-consult] ✅ AI 咨询成功');
        return response.data.trim();
      } else {
        logger.warn('[ai-consult] ⚠️ AI 咨询响应异常');
        throw new Error('AI响应失败');
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
/* 基础样式 */
.ai-consult-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* 遮罩层 */
.consult-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
}

/* 咨询弹窗 */
.consult-panel {
  width: 100%;
  max-height: 80vh;
  background: var(--ds-bg-primary);
  border-radius: 40rpx 40rpx 0 0;
  backdrop-filter: blur(20px);
  border: 1px solid var(--ds-border-color);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10000;
  transition: all 150ms ease-out;
}

/* 弹窗头部 */
.panel-header {
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1px solid var(--ds-border-color);
}

.header-left {
  /* ds-flex ds-flex-col 已应用 */
}

.header-title {
  color: var(--ds-text-primary);
}

.header-subtitle {
  color: var(--ds-text-secondary);
  margin-top: 4rpx;
}

.header-right {
  align-items: center;
}

.close-btn {
  font-size: 32rpx;
  color: var(--ds-text-secondary);
  width: 44rpx;
  height: 44rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 150ms ease-out;
}

.close-btn:active {
  background: var(--ds-bg-secondary);
  color: var(--ds-text-primary);
}

/* 对话内容区域 */
.chat-content {
  flex: 1;
  padding: 24rpx 32rpx;
  overflow-y: auto;
}

/* 消息列表 */
.message-list {
  /* ds-flex ds-flex-col ds-gap-md 已应用 */
}

/* 消息项 */
.message-item {
  align-items: flex-end;
}

/* 用户消息 */
.user-message {
  flex-direction: row-reverse;
}

/* 助手消息 */
.assistant-message {
  flex-direction: row;
}

/* 消息头像 */
.message-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: var(--ds-bg-secondary);
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
}

/* 消息气泡 */
.message-bubble {
  max-width: 70%;
  padding: 16rpx 24rpx;
  border-radius: 24rpx;
  position: relative;
}

/* 用户气泡 */
.user-bubble {
  background: linear-gradient(180deg, var(--ds-primary) 0%, #279eff 100%);
  color: white;
  border-bottom-right-radius: 8rpx;
}

/* 助手气泡 */
.assistant-bubble {
  background: var(--ds-bg-secondary);
  color: var(--ds-text-primary);
  border-bottom-left-radius: 8rpx;
}

/* 消息文本 */
.message-text {
  line-height: 1.5;
  word-break: break-word;
}

/* 消息时间 */
.message-time {
  color: var(--ds-text-secondary);
  margin-top: 8rpx;
  display: block;
  text-align: right;
}

/* 正在输入指示器 */
.typing-indicator {
  align-items: center;
  padding: 16rpx 0;
}

.typing-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--ds-text-secondary);
  animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {

  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }

  30% {
    transform: translateY(-10rpx);
    opacity: 1;
  }
}

/* 输入区域 */
.input-area {
  padding: 24rpx 32rpx;
  border-top: 1px solid var(--ds-border-color);
  background: var(--ds-bg-primary);
  border-radius: 0 0 40rpx 40rpx;
}

/* 输入容器 */
.input-container {
  align-items: flex-end;
  gap: 16rpx;
  background: var(--ds-bg-primary);
  border: 1px solid var(--ds-border-color);
  border-radius: 36rpx;
  padding: 12rpx 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  transition: all 150ms ease-out;
}

/* 消息输入框 */
.message-input {
  flex: 1;
  min-height: 40rpx;
  max-height: 120rpx;
  color: var(--ds-text-primary);
  line-height: 1.5;
  padding: 8rpx 0;
  resize: none;
}

/* 占位符样式 */
.placeholder-text {
  color: var(--ds-text-tertiary);
}

/* 输入操作区 */
.input-actions {
  align-items: center;
}

/* 字符计数 */
.char-count {
  color: var(--ds-text-secondary);
}

/* 发送按钮 */
.send-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: var(--ds-border-color);
  align-items: center;
  justify-content: center;
  transition: all 150ms ease-out;
  opacity: 0.5;
}

.send-btn.can-send {
  background: var(--ds-primary);
  opacity: 1;
}

.send-btn:active {
  transform: scale(0.95);
}

/* 发送图标 */
.send-icon {
  font-size: 28rpx;
  color: white;
  font-weight: bold;
}

/* 深色模式 */
.dark-mode .consult-mask {
  background: rgba(0, 0, 0, 0.7);
}

.dark-mode .consult-panel {
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
}

.dark-mode .input-container {
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
}

.dark-mode .user-bubble {
  color: #1c1c1e;
}
</style>
