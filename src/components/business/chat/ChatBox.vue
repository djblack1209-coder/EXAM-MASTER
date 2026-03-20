<template>
  <view class="chatbox" :class="[mode, { 'dark-mode': isDark }]">
    <!-- Welcome card (no messages) -->
    <view v-if="messages.length === 0 && persona" class="welcome-card apple-glass-card">
      <image v-if="persona.avatar" :src="persona.avatar" class="welcome-avatar" mode="aspectFill" />
      <text class="welcome-name">{{ persona.name }}</text>
      <text class="welcome-role">{{ persona.role }}</text>
      <text v-if="persona.intro" class="welcome-intro">{{ persona.intro }}</text>
      <text class="welcome-note">内容用于学习交流参考，请结合教材与官方资料自行判断。</text>
    </view>

    <!-- Message list -->
    <scroll-view class="message-list" scroll-y :scroll-into-view="scrollIntoView" scroll-with-animation>
      <view v-for="msg in messages" :id="'msg-' + msg.id" :key="msg.id" class="msg-row" :class="msg.role">
        <!-- Assistant bubble -->
        <template v-if="msg.role === 'assistant'">
          <image v-if="persona?.avatar" :src="persona.avatar" class="avatar" mode="aspectFill" />
          <view
            class="bubble left-bubble"
            :class="{ failed: msg.failed }"
            @tap="msg.failed ? $emit('retry', msg.id) : null"
          >
            <RichText
              v-if="isStreamingMsg(msg) ? streamingText : msg.content"
              :content="isStreamingMsg(msg) ? streamingText : msg.content"
            />
            <text v-if="msg.failed" class="retry-hint">点击重试</text>
            <text class="msg-time">{{ msg.time }}</text>
          </view>
        </template>

        <!-- User bubble -->
        <template v-else>
          <view
            class="bubble right-bubble"
            :class="{ sending: msg.status === 'sending', failed: msg.status === 'failed' }"
            @tap="msg.status === 'failed' ? $emit('retry', msg.id) : null"
          >
            <text>{{ msg.content }}</text>
            <view class="msg-footer">
              <text class="msg-time">{{ msg.time }}</text>
              <text v-if="msg.status === 'sending'" class="status-icon">⏳</text>
              <text v-else-if="msg.status === 'sent'" class="status-icon sent">✓</text>
              <text v-else-if="msg.status === 'failed'" class="status-icon failed">⚠️ 重试</text>
            </view>
          </view>
        </template>
      </view>

      <!-- Typing indicator -->
      <view v-if="isTyping && !hasStreamingMsg" class="msg-row assistant">
        <image v-if="persona?.avatar" :src="persona.avatar" class="avatar" mode="aspectFill" />
        <view class="bubble left-bubble typing-bubble">
          <view class="typing-dots">
            <view class="dot" />
            <view class="dot" />
            <view class="dot" />
          </view>
        </view>
      </view>

      <view id="chatbox-bottom" style="height: 20px" />
    </scroll-view>

    <!-- Stop generation button -->
    <view v-if="isStreaming" class="stop-btn" hover-class="item-hover" @tap="handleStop">
      <text class="stop-text">■ 停止生成</text>
    </view>

    <!-- Emotion tags bar (optional) -->
    <view v-if="showEmotions && emotionTags.length" class="emotion-bar apple-glass">
      <view
        v-for="tag in emotionTags"
        :key="tag.value"
        class="emotion-tag"
        :class="{ active: currentEmotion === tag.value }"
        hover-class="item-hover"
        @tap="selectEmotion(tag.value)"
      >
        <text>{{ tag.emoji }} {{ tag.label }}</text>
      </view>
    </view>

    <!-- Input area -->
    <view class="input-area apple-glass">
      <input
        v-model="inputText"
        type="text"
        class="msg-input apple-glass-pill"
        :placeholder="placeholder || '输入消息...'"
        confirm-type="send"
        maxlength="500"
        @confirm="handleSend"
        @focus="scrollToBottom"
      />
      <view class="send-btn apple-glass-pill" :class="{ active: canSend }" hover-class="item-hover" @tap="handleSend">
        <text class="send-icon">↑</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useChatBox } from '@/composables/useChatBox.js';
import RichText from '@/components/common/RichText.vue';

const props = defineProps({
  mode: { type: String, default: 'fullpage', validator: (v) => ['fullpage', 'modal', 'panel'].includes(v) },
  persona: { type: Object, default: () => ({ name: 'AI', avatar: '', role: '', intro: '' }) },
  systemPrompt: { type: String, default: '' },
  action: { type: String, default: 'friend_chat' },
  context: { type: Object, default: () => ({}) },
  maxHistory: { type: Number, default: 10 },
  showVoice: { type: Boolean, default: false },
  showEmotions: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  storageKey: { type: String, default: '' }
});

const emit = defineEmits(['send', 'retry', 'stop']);

// ---- Chat logic (composable) ----
const {
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
} = useChatBox({
  storageKey: props.storageKey,
  action: props.action,
  systemPrompt: props.systemPrompt,
  context: props.context,
  maxHistory: props.maxHistory
});

// ---- Input ----
const inputText = ref('');
const canSend = computed(() => inputText.value.trim().length > 0 && !isStreaming.value);

function handleSend() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;
  inputText.value = '';
  emit('send', text);
  sendMessage(text);
}

// ---- Streaming message detection ----
function isStreamingMsg(msg) {
  return msg.role === 'assistant' && msg.status === 'sending' && isStreaming.value;
}
const hasStreamingMsg = computed(() => messages.value.some((m) => isStreamingMsg(m)));

// ---- Retry ----
watch(
  () => emit,
  () => {}
); // keep emit reactive
function handleRetry(msgId) {
  emit('retry', msgId);
  retryMessage(msgId);
}

// ---- Stop ----
function handleStop() {
  emit('stop');
  stopGeneration();
}

// ---- Emotion tags ----
const emotionTags = ref([
  { value: 'frustrated', emoji: '😫', label: '沮丧' },
  { value: 'anxious', emoji: '😰', label: '焦虑' },
  { value: 'excited', emoji: '🎉', label: '开心' },
  { value: 'tired', emoji: '😴', label: '疲惫' },
  { value: 'confused', emoji: '🤔', label: '困惑' },
  { value: 'neutral', emoji: '😊', label: '平静' }
]);
const currentEmotion = ref('neutral');
function selectEmotion(val) {
  currentEmotion.value = val;
}

// Expose for parent components
defineExpose({ clearHistory, messages, scrollToBottom });
</script>

<style lang="scss" scoped>
.chatbox {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top, var(--bg-page)) 0%,
    var(--page-gradient-mid, var(--bg-page)) 56%,
    var(--page-gradient-bottom, var(--bg-page)) 100%
  );
}

// Mode variants
.chatbox.modal,
.chatbox.panel {
  border-radius: 38rpx 38rpx 0 0;
  max-height: 86vh;
}

// Welcome card
.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  text-align: center;
  max-width: 640rpx;
  margin: 12rpx auto 0;
  border-radius: 40rpx;
}
.welcome-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  margin-bottom: 32rpx;
}
.welcome-name {
  font-size: 40rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8rpx;
}
.welcome-role {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-bottom: 32rpx;
}
.welcome-intro {
  font-size: 28rpx;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 560rpx;
}
.welcome-note {
  margin-top: 18rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
  line-height: 1.5;
}

// Message list
.message-list {
  flex: 1;
  padding: 32rpx;
  box-sizing: border-box;
}

.msg-row {
  display: flex;
  margin-bottom: 32rpx;
  align-items: flex-end;
  &.user {
    flex-direction: row-reverse;
  }
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.bubble {
  max-width: 70%;
  padding: 20rpx 28rpx;
  border-radius: 32rpx;
  font-size: 30rpx;
  line-height: 1.5;
  position: relative;
}

.left-bubble {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  color: var(--text-primary);
  margin-left: 16rpx;
  border: 1rpx solid var(--glass-border);
  border-bottom-left-radius: 10rpx;
  box-shadow: var(--apple-shadow-card);
  &.failed {
    border-color: rgba(255, 59, 48, 0.35);
    background: rgba(255, 99, 90, 0.1);
  }
}

.right-bubble {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, transparent 46%),
    linear-gradient(160deg, rgba(27, 130, 74, 0.98) 0%, rgba(15, 95, 52, 0.92) 100%);
  color: #fff;
  margin-right: 16rpx;
  border-bottom-right-radius: 10rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 12rpx 28rpx rgba(15, 95, 52, 0.24);
  &.sending {
    opacity: 0.7;
  }
  &.failed {
    background: linear-gradient(135deg, var(--ds-color-error, #ff3b30), #ff6b6b);
    box-shadow: 0 4rpx 16rpx rgba(255, 59, 48, 0.3);
  }
}

.retry-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--ds-color-error, #ff3b30);
}

.msg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
  & > text + text {
    margin-left: 16rpx;
  }
}
.msg-time {
  display: block;
  font-size: 22rpx;
  opacity: 0.6;
}
.status-icon {
  font-size: 24rpx;
  &.sent {
    color: rgba(255, 255, 255, 0.8);
  }
  &.failed {
    color: #ffd60a;
    font-size: 22rpx;
  }
}

// Typing indicator
.typing-bubble {
  padding: 28rpx 36rpx;
}
.typing-dots {
  display: flex;
  & > view + view {
    margin-left: 8rpx;
  }
}
.dot {
  width: 16rpx;
  height: 16rpx;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}
@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-8rpx);
    opacity: 1;
  }
}

// Stop button
.stop-btn {
  align-self: center;
  padding: 12rpx 32rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.06);
  border: 1rpx solid var(--glass-border);
  margin-bottom: 12rpx;
}
.stop-text {
  font-size: 26rpx;
  color: var(--text-secondary);
}

// Emotion bar
.emotion-bar {
  display: flex;
  flex-wrap: wrap;
  padding: 24rpx 32rpx;
  border-top: 1rpx solid transparent;
  & > view + view {
    margin-left: 16rpx;
  }
}
.emotion-tag {
  padding: 12rpx 22rpx;
  background: rgba(120, 120, 128, 0.12);
  border-radius: 999rpx;
  font-size: 26rpx;
  color: var(--text-secondary);
  &:active {
    opacity: 0.7;
  }
  &.active {
    background: var(--cta-primary-bg);
    color: var(--cta-primary-text);
    box-shadow: var(--cta-primary-shadow);
  }
}

// Input area
.input-area {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid transparent;
  & > view + view,
  & > input + view {
    margin-left: 16rpx;
  }
}
.msg-input {
  flex: 1;
  height: 72rpx;
  border-radius: 36rpx;
  border: 1rpx solid transparent;
  padding: 0 28rpx;
  font-size: 30rpx;
  color: var(--text-primary);
}
.send-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  &.active {
    background: var(--cta-primary-bg);
    box-shadow: var(--cta-primary-shadow);
    transform: scale(1.05);
  }
}
.send-icon {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-secondary);
  .send-btn.active & {
    color: var(--cta-primary-text);
  }
}

// Dark mode
.chatbox.dark-mode {
  .left-bubble {
    background-color: transparent;
    color: var(--text-main);
    box-shadow: var(--apple-shadow-card);
  }
  .welcome-name {
    color: var(--text-main);
  }
  .welcome-role,
  .welcome-intro {
    color: var(--text-tertiary);
  }
  .input-area {
    border-color: rgba(255, 255, 255, 0.12);
  }
  .msg-input {
    color: var(--text-main);
  }
  .send-btn {
    background: rgba(255, 255, 255, 0.08);
    &.active {
      background: var(--cta-primary-bg);
    }
  }
  .send-icon {
    color: var(--text-tertiary);
    .send-btn.active & {
      color: var(--primary-foreground);
    }
  }
  .emotion-tag {
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-secondary);
  }
  .stop-btn {
    background: rgba(255, 255, 255, 0.08);
  }
}

.item-hover {
  opacity: 0.7;
}
</style>
