<template>
  <view v-if="!showGoal">
    <FutureLanding v-if="theme.visualStyle === 'future'" @open="open" />
    <PlayfulLanding v-else @open="open" />
    <slot></slot>
  </view>
  <LearningShell v-else active="learning" title="开始学习" @materials="openMaterials">
    <template #controls
      ><button class="quiet-button" role="button" tabindex="0" @tap="showGoal = false">返回首页</button></template
    >
    <view class="landing-welcome"><text class="landing-title">今天，想学会什么？</text></view>
    <view class="landing-start">
      <textarea
        :value="goal"
        class="field"
        aria-label="学习目标"
        placeholder="输入问题，或选一个主题"
        placeholder-class="space-placeholder"
        maxlength="1000"
        @input="goal = $event.detail?.value ?? $event.target?.value ?? ''"
      ></textarea>
      <view class="button-row" aria-label="学习主题">
        <button
          v-for="topic in topics"
          :key="topic"
          role="button"
          tabindex="0"
          :aria-pressed="goal === topic"
          :class="{ chosen: goal === topic }"
          @tap="goal = topic"
        >
          {{ topic }}
        </button>
      </view>
      <view class="landing-actions">
        <button
          class="primary"
          role="button"
          tabindex="0"
          :disabled="learning.busy || !goal.trim()"
          :aria-disabled="learning.busy || !goal.trim()"
          @tap="start"
        >
          开始学习
          <BaseIcon name="arrow-right" :size="32" color="#ffffff" />
        </button>
      </view>
    </view>
    <view class="landing-below" :class="{ 'landing-below-single': !latest }">
      <view v-if="latest" class="continue-panel">
        <text class="section-title">最近学习</text>
        <button class="continue-session" role="button" tabindex="0" @tap="resume">
          <view class="continue-copy">
            <text class="continue-title">{{ latest.goal }}</text>
          </view>
          <BaseIcon name="arrow-right" :size="40" color="#7658ad" />
        </button>
      </view>
      <LearningOverview :show-navigation="false" />
    </view>
    <view class="landing-footer">
      <button class="quiet-button" role="button" tabindex="0" @tap="emit('legacy')">
        历史题库记录
        <BaseIcon name="arrow-right" :size="26" color="#7658ad" />
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
import PlayfulLanding from './playful-landing.vue';
import FutureLanding from './future-landing.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { LEARNING_START_TOPICS } from '@/services/learning/learning-domain.js';
const emit = defineEmits(['legacy']);
const learning = useConversationLearningStore();
const theme = useThemeStore();
const goal = ref('');
const topics = LEARNING_START_TOPICS;
const error = ref('');
const showGoal = ref(false);
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
function open(target) {
  if (target === 'start') {
    showGoal.value = true;
    return;
  }
  if (target === 'desktop' || target === 'web') {
    theme.setVisualStyle(target === 'desktop' ? 'future' : 'playful');
    return;
  }
  if (target === 'materials') {
    openMaterials();
    return;
  }
  if (target === 'connections') {
    safeNavigateTo('/pages/learning/index?panel=connections');
    return;
  }
  if (target === 'account') {
    openAccount();
    return;
  }
  safeNavigateTo('/pages/' + target + '/index');
}
function start() {
  if (learning.busy || !goal.value.trim()) return;
  try {
    learning.start(goal.value);
    openLearning();
  } catch (e) {
    error.value = e.message;
  }
}
function resume() {
  if (learning.busy || !latest.value) return;
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
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  margin-bottom: 14px;
}
.landing-start .button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.landing-start .button-row button {
  margin: 0;
  font-size: 12px;
}
.landing-start .button-row button.chosen {
  background: var(--space-user, var(--yozi-solid));
  border: 1px solid var(--primary);
}
.landing-below {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}
.landing-below-single {
  grid-template-columns: 1fr;
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
    background: var(--space-glass);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
