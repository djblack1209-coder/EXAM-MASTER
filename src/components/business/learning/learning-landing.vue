<template>
  <LearningShell active="learning" title="学习空间" @materials="openMaterials">
    <template #controls>
      <button role="button" tabindex="0" class="account-link" @tap="openAccount">
        <BaseIcon name="user" :size="32" color="#f8f5ee" />
        <text>我的</text>
      </button>
    </template>
    <view class="landing-welcome">
      <text class="landing-title">{{ '给学习，一点\n安静的空间。' }}</text>
      <text class="landing-description">从你在意的问题开始。讲解、练习与复习，在同一段对话里自然接续。</text>
    </view>
    <view class="landing-start">
      <text class="section-title">今天，想把什么学明白？</text>
      <textarea
        v-model="goal"
        class="field"
        aria-label="学习目标"
        placeholder="写下一个概念、一道难题，或今天的目标…"
        placeholder-class="space-placeholder"
        maxlength="1000"
      ></textarea>
      <view class="landing-actions">
        <text class="subtle">核心学习工具免费 · 无需先上传资料</text>
        <button class="primary" role="button" tabindex="0" :disabled="!goal.trim()" @tap="start">
          开始学习
          <BaseIcon name="arrow-right" :size="32" color="#3f4234" />
        </button>
      </view>
      <text class="subtle">本地支持有限计算练习；其他主题可先保存目标，再连接模型。</text>
    </view>
    <view class="landing-below">
      <view class="continue-panel">
        <text class="section-title">接着上次的思路</text>
        <button v-if="latest" class="continue-session" role="button" tabindex="0" @tap="resume">
          <view class="continue-copy">
            <text class="continue-title">{{ latest.goal }}</text>
            <text class="subtle">{{ latest.messages.length }} 条交流 · 回到原来的对话</text>
          </view>
          <BaseIcon name="arrow-right" :size="40" color="#f8f5ee" />
        </button>
        <view v-else class="continue-empty">
          <BaseIcon name="book-open" :size="60" color="#d9dfbe" />
          <text>你的第一段学习，还在等你。</text>
          <text class="subtle">问题、作答和思考会自动保留，随时回来继续。</text>
        </view>
        <button class="quiet-button" role="button" tabindex="0" @tap="openLearning">打开对话学习</button>
      </view>
      <LearningOverview :show-navigation="false" />
    </view>
    <view class="landing-footer">
      <text>学习记录由你掌握，节奏也由你决定。</text>
      <button class="quiet-button" role="button" tabindex="0" @tap="$emit('legacy')">
        历史题库与训练视图
        <BaseIcon name="arrow-right" :size="26" color="#f8f5ee" />
      </button>
    </view>
    <text v-if="error" class="warning feedback" role="alert">{{ error }}</text>
    <slot></slot>
  </LearningShell>
</template>
<script setup>
import { computed, ref } from 'vue';
import LearningShell from './learning-shell.vue';
import LearningOverview from './learning-overview.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
defineEmits(['legacy']);
const learning = useConversationLearningStore();
const goal = ref('');
const error = ref('');
const latest = computed(() => learning.state.conversations.at(-1));
function openLearning() {
  safeNavigateTo('/pages/learning/index');
}
function openMaterials() {
  safeNavigateTo('/pages/learning/index?panel=materials');
}
function openAccount() {
  safeNavigateTo('/pages/profile/index');
}
function start() {
  try {
    learning.start(goal.value);
    openLearning();
  } catch (e) {
    error.value = e.message;
  }
}
function resume() {
  learning.selectedConversationId = latest.value.id;
  openLearning();
}
</script>
<style scoped>
.landing-welcome {
  padding: 14px 0 28px;
}
.landing-title {
  white-space: pre-line;
  display: block;
  font-size: 42px;
  letter-spacing: -0.03em;
  line-height: 1.3;
  font-weight: 300;
}
.landing-description {
  display: block;
  margin-top: 18px;
  color: var(--space-muted);
  line-height: 1.9;
  font-size: 14px;
}
.landing-start {
  padding: 24px;
  background: var(--space-glass);
  border-radius: 24px;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.landing-start .field {
  margin: 12px 0;
  background: transparent;
  border: 0;
  padding: 0;
  height: 70px;
}
.landing-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}
.landing-actions .subtle {
  font-size: 11px;
}
.landing-below {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}
.continue-panel {
  padding: 20px;
  border-radius: 24px;
  background: var(--space-glass);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.continue-panel .section-title {
  font-size: 16px;
}
.learning-space .continue-session {
  width: 100%;
  background: transparent;
  justify-content: space-between;
  text-align: left;
  padding: 20px 0;
}
.continue-session .continue-copy {
  flex: 1;
  min-width: 0;
}
.continue-title {
  display: block;
  font-size: 18px;
  overflow-wrap: anywhere;
  margin-bottom: 8px;
}
.continue-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 20px;
}
.continue-empty > text:not(.subtle) {
  font-size: 15px;
}
.landing-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  font-size: 11px;
  color: var(--space-muted);
}
.learning-space .account-link {
  border-radius: 24px;
  font-size: 12px;
}
@media (max-width: 1100px) {
  .landing-below {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .landing-title {
    white-space: pre-line;
    font-size: 34px;
  }
  .landing-start {
    padding: 20px;
  }
  .landing-actions {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .landing-actions button {
    align-self: flex-end;
  }
  .landing-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .landing-start,
  .continue-panel {
    background: #454739;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
