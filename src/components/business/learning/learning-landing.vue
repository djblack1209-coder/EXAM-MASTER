<template>
  <view v-if="!showGoal">
    <FutureLanding v-if="theme.visualStyle === 'future'" @open="open" />
    <PlayfulLanding v-else @open="open" />
    <slot></slot>
  </view>
  <LearningShell v-else active="learning" :title="t('learning.kms')" @materials="openMaterials">
    <template #controls
      ><BaseButton class="quiet-button" variant="quiet" @tap="showGoal = false">{{
        t('learning.kh0')
      }}</BaseButton></template
    >
    <view class="landing-welcome"
      ><text class="landing-title">{{ t('learning.kht') }}</text></view
    >
    <BaseCard class="landing-start" surface="glass" padding="none">
      <BaseInput
        :model-value="goal"
        class="field"
        :placeholder="t('learning.kbo')"
        maxlength="1000"
        :label="t('learning.kfl')"
        multiline
        @input="goal = $event.detail?.value ?? $event.target?.value ?? ''"
      />
      <view class="button-row" :aria-label="t('learning.kqm')">
        <BaseChip
          v-for="topic in topics"
          :key="topic"
          :class="{ chosen: goal === topic }"
          :model-value="goal === topic"
          @update:model-value="goal = topic"
        >
          {{ learningText(topic) }}
        </BaseChip>
      </view>
      <view class="landing-actions">
        <BaseButton
          class="primary"
          :disabled="learning.busy || !goal.trim()"
          :aria-disabled="learning.busy || !goal.trim()"
          variant="primary"
          @tap="start"
          >{{ t('learning.kms') }}<BaseIcon name="arrow-right" tone="ink-3" />
        </BaseButton>
      </view>
    </BaseCard>
    <view class="landing-below" :class="{ 'landing-below-single': !latest }">
      <BaseCard v-if="latest" class="continue-panel" padding="none">
        <text class="section-title">{{ t('learning.k40') }}</text>
        <BaseButton class="continue-session" variant="quiet" @tap="resume">
          <view class="continue-copy">
            <text class="continue-title">{{ latest.goal }}</text>
          </view>
          <BaseIcon name="arrow-right" tone="ink-3" />
        </BaseButton>
      </BaseCard>
      <LearningOverview :show-navigation="false" />
    </view>
    <view class="landing-footer">
      <BaseButton class="quiet-button" variant="quiet" @tap="emit('legacy')"
        >{{ t('learning.k1j') }}<BaseIcon name="arrow-right" tone="ink-3" />
      </BaseButton>
    </view>
    <BaseEmpty v-if="error" state="error" :title="learningText(error)" mascot-size="small" />

    <slot></slot>
  </LearningShell>
</template>
<script setup>
import { learningText } from '@/i18n/learning.js';
import { t } from '@/i18n/index.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';

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
  padding: var(--s-4) 0 var(--s-8);
}
.landing-title {
  white-space: pre-line;
  display: block;
  font-size: var(--size-number);
  letter-spacing: -0.03em;
  line-height: 1.3;
  font-weight: var(--weight-regular);
}
.landing-start {
  padding: var(--s-6);
}
.landing-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--s-4);
  margin-top: var(--s-3);
  margin-bottom: var(--s-4);
}
.landing-start .button-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.landing-below {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-4);
  margin-top: var(--s-5);
}
.landing-below-single {
  grid-template-columns: 1fr;
}
.continue-panel {
  padding: var(--s-5);
}
.continue-panel .section-title {
  font-size: var(--size-body);
}
.learning-space .continue-session {
  width: 100%;
  justify-content: space-between;
  text-align: left;
  padding: var(--s-5) 0;
}
.continue-session .continue-copy {
  flex: 1;
  min-width: 0;
}
.continue-title {
  display: block;
  font-size: var(--size-title-3);
  overflow-wrap: anywhere;
  margin-bottom: var(--s-2);
}
.landing-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--s-4);
  margin-top: var(--s-6);
  font-size: var(--size-caption);
  color: var(--ink-3);
}
.learning-space .account-link {
  font-size: var(--size-caption);
}
@media (max-width: 1100px) {
  .landing-below {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .landing-title {
    white-space: pre-line;
    font-size: var(--size-number);
  }
  .landing-start {
    padding: var(--s-5);
  }
  .landing-actions {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--s-3);
  }
  .landing-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--s-2);
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
}
</style>
