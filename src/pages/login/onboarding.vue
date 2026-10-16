<template>
  <view class="onboarding-page" :class="themeStore.isDark ? 'theme-dark' : 'theme-light'" :style="$yoziInsets">
    <BaseCard surface="glass">
      <view class="onboarding-stack">
        <YoziMascot pose="wave" play="once" size="medium" />
        <text class="onboarding-title">{{
          !legacyMode ? t('login.onboard') : t(`login.${['direction', 'subjects', 'daily', 'summary'][step]}`)
        }}</text>
        <BaseTag v-if="legacyMode">{{ step + 1 }} / 4</BaseTag>
        <BaseTag v-if="legacyMode && step === 0">{{ t('login.exam') }}</BaseTag>
        <view v-if="legacyMode && step === 1" class="onboarding-stack">
          <view v-for="group in trackGroups" :key="group.subject" class="onboarding-stack"
            ><text>{{ group.label }}</text
            ><view class="onboarding-chips"
              ><BaseChip
                v-for="option in group.options"
                :key="option.id"
                :model-value="isTrackSelected(option.id)"
                @update:model-value="selectTrack(group.subject, option.id)"
                >{{ option.label }}</BaseChip
              ></view
            ></view
          >
        </view>
        <BaseSegmented
          v-if="legacyMode && step === 2"
          v-model="dailyGoal"
          :label="t('login.daily')"
          :options="goalOptions"
        />
        <view v-if="legacyMode && step === 3" class="onboarding-stack"
          ><text>{{ selectedTrackLabels.join(' / ') }}</text
          ><text>{{ t('login.perDay', { count: dailyGoal }) }}</text
          ><view v-for="paper in previewPapers" :key="paper.label" class="onboarding-row"
            ><text>{{ paper.label }}</text
            ><BaseTag tone="apricot">{{ paper.stateText }}</BaseTag></view
          ></view
        >
        <BaseButton variant="primary" block @tap="nextOrComplete">{{
          !legacyMode ? t('login.onboard') : step === 3 ? t('login.save') : t('login.continue')
        }}</BaseButton>
        <BaseButton v-if="legacyMode && step > 0" variant="quiet" block @tap="prevStep">{{
          t('login.previous')
        }}</BaseButton>
        <BaseButton v-if="legacyMode" variant="quiet" block @tap="skipOnboarding">{{ t('login.skip') }}</BaseButton>
      </view>
    </BaseCard>
  </view>
</template>
<script setup>
import { useThemeStore } from '@/stores/modules/theme.js';
const themeStore = useThemeStore();
import './messages.js';
import { t } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import BaseTag from '@/components/base/base-tag/base-tag.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import { computed, ref, onBeforeUnmount } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { storageService } from '@/services/storageService.js';
import { openLearningEntry as openHomeTab } from '@/utils/home-navigation.js';

const step = ref(0);
const legacyMode = ref(false);
let active = true;
const navigationTimers = new Set();
onBeforeUnmount(() => {
  active = false;
  for (const timer of navigationTimers) clearTimeout(timer);
  navigationTimers.clear();
});
function returnHome() {
  if (!active) return;
  for (const timer of navigationTimers) clearTimeout(timer);
  navigationTimers.clear();
  openHomeTab({
    isCurrent: () => active,
    schedule(callback, delay) {
      if (!active) return;
      const timer = setTimeout(() => {
        navigationTimers.delete(timer);
        if (active) callback();
      }, delay);
      navigationTimers.add(timer);
    }
  });
}
onLoad((options) => {
  legacyMode.value = options?.source === 'home';
});
const dailyGoal = ref(25);
const selectedTracks = ref(['politics', 'english1', 'math1']);

const trackGroups = computed(() => [
  {
    subject: 'politics',
    label: t('login.politics'),
    options: [{ id: 'politics', label: t('login.politics') }]
  },
  {
    subject: 'english',
    label: t('login.english1'),
    options: [
      { id: 'english1', label: t('login.english1') },
      { id: 'english2', label: t('login.english2') }
    ]
  },
  {
    subject: 'math',
    label: t('login.math1'),
    options: [
      { id: 'math1', label: t('login.math1') },
      { id: 'math2', label: t('login.math2') },
      { id: 'math3', label: t('login.math3') }
    ]
  }
]);

const goalOptions = computed(() => [15, 25, 40, 60].map((count) => ({ value: count, label: String(count) })));

const previewPapers = computed(() => [
  { label: t('login.politics') + ' 2025', state: 'pending', stateText: t('login.sourcePending') },
  { label: t('login.politics') + ' 2024', state: 'pending', stateText: t('login.sourcePending') },
  { label: t('login.english1') + ' 2025', state: 'pending', stateText: t('login.passagePending') },
  { label: t('login.math1') + ' 2025', state: 'pending', stateText: t('login.improving') }
]);

const selectedTrackLabels = computed(() => {
  const labels = [];
  for (const group of trackGroups.value) {
    for (const option of group.options) {
      if (selectedTracks.value.includes(option.id)) labels.push(option.label.replace(/\s\d+$/, ''));
    }
  }
  return labels;
});

function isTrackSelected(id) {
  return selectedTracks.value.includes(id);
}

function selectTrack(subject, id) {
  if (subject === 'politics') {
    selectedTracks.value = Array.from(new Set([...selectedTracks.value, 'politics']));
    return;
  }

  const group = trackGroups.value.find((item) => item.subject === subject);
  const groupIds = new Set((group?.options || []).map((item) => item.id));
  selectedTracks.value = selectedTracks.value.filter((trackId) => !groupIds.has(trackId));
  selectedTracks.value.push(id);
}

function prevStep() {
  if (step.value > 0) step.value -= 1;
}

function nextOrComplete() {
  if (legacyMode.value && step.value < 3) {
    step.value += 1;
    return;
  }
  completeOnboarding();
}

function saveOnboardingData(completed = true) {
  storageService.save('onboarding_completed', completed);
  if (!legacyMode.value) return;
  const profile = {
    exam: 'kaoyan',
    targetYear: 2027,
    tracks: selectedTracks.value
  };
  storageService.save('exam_type', 'kaoyan');
  storageService.save('exam_profile', profile);
  storageService.save('daily_goal', dailyGoal.value);
}

function completeOnboarding() {
  saveOnboardingData(true);
  returnHome();
}

function skipOnboarding() {
  storageService.save('onboarding_completed', true);
  returnHome();
}
</script>
<style scoped>
.onboarding-page {
  width: 100%;
  box-sizing: border-box;
  min-height: 100vh;
  padding: var(--s-8) var(--s-5);
  margin: 0 auto;
  color: var(--ink);
  background: var(--canvas);
  font-family: var(--font-ui);
}
.onboarding-page > .base-card {
  max-width: calc(var(--dialog-width) + var(--s-14) * 3);
  margin-inline: auto;
}
.onboarding-stack {
  display: grid;
  gap: var(--s-5);
}
.onboarding-title {
  font: var(--weight-ui-emphasis) var(--size-title-2)/var(--leading-title-2) var(--font-ui);
}
.onboarding-chips,
.onboarding-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  justify-content: space-between;
}
</style>

<style scoped>
/* #ifdef MP-WEIXIN */
.onboarding-page {
  padding-top: calc(var(--yozi-nav-top, 0px) + var(--s-8));
}
/* #endif */
</style>
