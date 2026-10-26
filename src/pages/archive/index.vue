<template>
  <LearningShell
    :side-panel="view === 'materials'"
    :active="active"
    :title="title"
    :layout="workspace ? 'workspace' : 'default'"
  >
    <view class="archive-content" :class="{ 'archive-workspace': workspace }">
      <MuseSavedLibrary v-if="view === 'phrases'" />
      <MuseWorkspacePages
        v-else-if="['all', 'plan', 'materials', 'usage'].includes(view)"
        :view="view"
        @view="selectView"
      />
      <template v-else>
        <BaseSegmented v-model="view" :label="t('tutor.archive.title')" :options="tabs" />
        <MuseCoachRecords :view="view" />
        <LearningInsights v-if="view === 'all' && hasGeneralRecords" all />
        <LearningOverview
          v-if="(hasGeneralRecords && (view !== 'plan' || learning.state.plans.length)) || !hasCoachRecords"
          :key="view"
          :view="view"
          :initial-expanded="true"
          :show-navigation="false"
        />
      </template>
      <view v-if="!workspace && !['phrases', 'materials'].includes(view)" class="archive-legacy">
        <BaseButton v-if="hasGeneralRecords" variant="quiet" :aria-expanded="showLegacy" @tap="showLegacy = !showLegacy"
          >历史学习档案</BaseButton
        >
        <BaseButton variant="quiet" @tap="safeNavigateTo('/pages/mistake/index?legacy=1')">{{
          t('tutor.archive.legacy')
        }}</BaseButton>
        <BaseButton variant="quiet" @tap="safeNavigateTo('/pages/favorite/index')">{{
          t('tutor.archive.favorites')
        }}</BaseButton>
      </view>
      <LearningOverview
        v-if="showLegacy && !['phrases', 'materials', 'mistake'].includes(view)"
        :view="view"
        :initial-expanded="true"
        :show-navigation="false"
      />
    </view>
  </LearningShell>
</template>
<script setup>
import '@/i18n/tutor.js';
import { computed, ref, nextTick } from 'vue';
import { onLoad, onShow, onReady } from '@dcloudio/uni-app';
import '@/i18n/muse.js';
import MuseSavedLibrary from '@/components/business/learning/muse-saved-library.vue';
import MuseCoachRecords from '@/components/business/learning/muse-coach-records.vue';
import MuseWorkspacePages from '@/components/business/learning/muse-workspace-pages.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { t } from '@/i18n/index.js';
import { ARCHIVE_TITLE_KEYS } from '@/i18n/messages/shell.js';
import LearningShell from '@/components/business/learning/learning-shell.vue';
import LearningInsights from '@/components/business/learning/learning-insights.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
const view = ref('all');
const showLegacy = ref(false);
const workspace = computed(() => ['all', 'plan', 'materials', 'phrases', 'usage'].includes(view.value));
const learning = useConversationLearningStore();
const hasGeneralRecords = computed(() => learning.state.conversations.some((item) => !item.coach));
const hasCoachRecords = computed(() => learning.state.conversations.some((item) => item.coach));
const active = computed(() =>
  ['plan', 'phrases', 'materials', 'usage'].includes(view.value) ? view.value : 'archive'
);
const title = computed(() =>
  t(Object.hasOwn(ARCHIVE_TITLE_KEYS, view.value) ? ARCHIVE_TITLE_KEYS[view.value] : 'tutor.archive.title')
);
function selectView(value, navigate = true) {
  const next = ['all', 'plan', 'mistake', 'phrases', 'materials', 'usage'].includes(value) ? value : 'all';
  if (navigate && next !== view.value) {
    uni.redirectTo({ url: `/pages/archive/index?view=${next}` });
    return;
  }
  view.value = next;
  showLegacy.value = false;
}
onLoad((options) => selectView(options?.view, false));
const syncTitle = () => uni.setNavigationBarTitle({ title: title.value });
onReady(syncTitle);
onShow(() => nextTick(syncTitle));
const tabs = computed(() => [
  { value: 'all', label: t('tutor.archive.overview') },
  { value: 'plan', label: t('tutor.archive.plan') },
  { value: 'mistake', label: t('tutor.archive.mistakes') }
]);
</script>
<style scoped>
.archive-content {
  max-width: 1024px;
  margin: 0 auto;
  padding: 20px 24px;
  display: grid;
  gap: var(--s-5);
}
.archive-workspace {
  max-width: none;
  width: 100%;
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
}
.archive-legacy {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
}
@media (max-width: 600px) {
  .archive-content {
    padding: 12px 0;
  }
}
</style>
