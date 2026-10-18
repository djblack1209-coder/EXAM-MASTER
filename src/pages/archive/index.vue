<template>
  <LearningShell active="archive" :title="t('tutor.archive.title')">
    <view class="archive-content">
      <BaseSegmented v-model="view" :label="t('tutor.archive.title')" :options="tabs" />
      <LearningInsights v-if="view === 'all'" />
      <LearningOverview :key="view" :view="view" :initial-expanded="true" :show-navigation="false" />
      <view class="archive-legacy">
        <BaseButton variant="quiet" @tap="safeNavigateTo('/pages/mistake/index?legacy=1')">{{
          t('tutor.archive.legacy')
        }}</BaseButton>
        <BaseButton variant="quiet" @tap="safeNavigateTo('/pages/favorite/index')">{{
          t('tutor.archive.favorites')
        }}</BaseButton>
      </view>
    </view>
  </LearningShell>
</template>
<script setup>
import '@/i18n/tutor.js';
import { computed, ref } from 'vue';
import { t } from '@/i18n/index.js';
import LearningShell from '@/components/business/learning/learning-shell.vue';
import LearningInsights from '@/components/business/learning/learning-insights.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
const view = ref('all');
const tabs = computed(() => [
  { value: 'all', label: t('tutor.archive.overview') },
  { value: 'plan', label: t('tutor.archive.plan') },
  { value: 'mistake', label: t('tutor.archive.mistakes') }
]);
</script>
<style scoped>
.archive-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--s-5);
  display: grid;
  gap: var(--s-5);
}
.archive-legacy {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
}
</style>
