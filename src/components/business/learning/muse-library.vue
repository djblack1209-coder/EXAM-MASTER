<template>
  <view ref="root" class="muse-library">
    <view class="library-sidebar" role="navigation" aria-label="资料库分类">
      <view class="library-sidebar-search"
        ><view class="lib-search"
          ><BaseIcon name="search" size="16px" /><BaseInput
            v-model="query"
            label="搜索资料库"
            placeholder="搜索"
            hide-label
            maxlength="120" /></view
      ></view>
      <view class="library-sidebar-scroll">
        <view
          v-for="group in groups"
          :key="group.id"
          class="lib-section"
          :class="{ 'is-collapsed': collapsed[group.id] }"
        >
          <BaseButton
            class="lib-section-head"
            variant="quiet"
            align="start"
            :aria-expanded="!collapsed[group.id]"
            @tap="collapsed[group.id] = !collapsed[group.id]"
            ><text>{{ group.label }}</text
            ><BaseIcon name="chevron-down" size="16px"
          /></BaseButton>
          <view class="lib-section-body" :inert="collapsed[group.id] || undefined"
            ><view
              ><BaseButton
                v-for="item in group.items"
                :key="item.id"
                class="lib-nav"
                :class="{
                  'is-current':
                    (item.id === 'all' || item.id === 'unclassified' || item.id.startsWith('conversation:')
                      ? context.id.value
                      : section) === item.id
                }"
                variant="quiet"
                align="start"
                :aria-current="
                  (item.id === 'all' || item.id === 'unclassified' || item.id.startsWith('conversation:')
                    ? context.id.value
                    : section) === item.id
                    ? 'page'
                    : undefined
                "
                @tap="chooseSection(item.id)"
                ><BaseIcon :name="item.icon" size="24px" /><text
                  >{{ item.label }}{{ item.count !== undefined ? ` (${item.count})` : '' }}</text
                ></BaseButton
              ></view
            ></view
          >
        </view>
      </view>
      <view class="library-sidebar-footer"
        ><BaseButton
          class="lib-nav"
          :class="{ 'is-current': section === 'files' }"
          variant="quiet"
          icon="folder"
          align="start"
          :aria-current="section === 'files' ? 'page' : undefined"
          @tap="section = 'files'"
          >原始资料</BaseButton
        ></view
      >
    </view>
    <view class="library-main">
      <view class="library-head"
        ><text class="library-title" role="heading" aria-level="1">{{ sectionTitle }}</text
        ><view class="library-head-actions"
          ><BaseButton class="lib-action" variant="quiet" @tap="safeNavigateTo('/pages/learning/knowledge')"
            >知识框架</BaseButton
          ><BaseButton
            class="lib-action"
            variant="quiet"
            :selected="selecting"
            :aria-pressed="selecting"
            @tap="toggleSelection"
            >{{ selecting ? `完成 (${selected.length})` : '选择' }}</BaseButton
          ><BaseButton
            ref="filterButton"
            class="lib-action lib-action-icon"
            variant="quiet"
            icon="sort"
            icon-only
            label="筛选资料"
            :aria-expanded="filterOpen"
            @tap="filterOpen = !filterOpen"
          /><BaseButton
            class="lib-action lib-action-primary"
            variant="primary"
            icon="plus"
            :disabled="learning.busy"
            @tap="createArtifact"
            >开始学习</BaseButton
          ></view
        >
        <view v-if="filterOpen" class="library-filter" role="group" aria-label="资料筛选"
          ><text class="library-filter-label">显示</text
          ><BaseButton
            v-for="filter in kindFilters"
            :key="filter.value"
            variant="quiet"
            align="start"
            :selected="kind === filter.value"
            @tap="kind = filter.value"
            >{{ filter.label }}</BaseButton
          ><text class="library-filter-label">排序</text
          ><BaseButton variant="quiet" align="start" :selected="!oldest" @tap="oldest = false">最近优先</BaseButton
          ><BaseButton variant="quiet" align="start" :selected="oldest" @tap="oldest = true">最早优先</BaseButton
          ><BaseButton variant="quiet" @tap="closeFilter">完成</BaseButton></view
        >
      </view>
      <view class="library-context"><MuseConversationFilter /></view>
      <view class="library-mobile-filters" role="group" aria-label="资料库分类"
        ><BaseButton
          v-for="item in mobileFilterSections"
          :key="item.id"
          variant="quiet"
          :selected="
            (item.id === 'all' || item.id === 'unclassified' || item.id.startsWith('conversation:')
              ? context.id.value
              : section) === item.id
          "
          @tap="chooseSection(item.id)"
          >{{ item.label }}{{ item.count !== undefined ? ` (${item.count})` : '' }}</BaseButton
        ><BaseInput v-model="query" label="搜索资料库" placeholder="搜索资料库" hide-label maxlength="120"
      /></view>
      <view class="library-scroll">
        <text v-if="selecting" class="selection-count" role="status">已选择 {{ selected.length }} 项</text>
        <view v-if="items.length" class="library-grid"
          ><BaseButton
            v-for="item in items"
            :key="item.id"
            class="artifact"
            :class="{ 'is-selected': selected.includes(item.id) }"
            variant="quiet"
            align="start"
            :aria-pressed="selecting ? selected.includes(item.id) : undefined"
            :label="`${selecting ? '选择 ' : '打开 '}${item.title}`"
            @tap="openArtifact(item)"
            ><view class="artifact-cover" :class="`artifact-cover-${item.kind}`"
              ><BaseIcon :name="item.icon" size="30px" /><BaseIcon
                v-if="selecting"
                class="artifact-selection"
                :name="selected.includes(item.id) ? 'checkbox-on' : 'checkbox-off'"
                size="20px" /></view
            ><view class="artifact-meta"
              ><text class="artifact-title">{{ item.title }}</text
              ><text class="artifact-subject">{{
                item.sources.length
                  ? '来源对话：' + item.sources.map((source) => source.label).join('、')
                  : '未归类 · 暂无来源对话'
              }}</text
              ><text>{{ kindLabel(item.kind) }} · {{ dateLabel(item.at, item.day) }} · {{ item.detail }}</text></view
            ></BaseButton
          ></view
        >
        <view v-else class="library-empty" role="status"
          ><view class="library-empty-mark"><BaseIcon :name="sectionIcon" size="26px" /></view
          ><text>{{ emptyLabel }}</text></view
        >
        <view v-if="selectedMaterial" class="material-reader"
          ><view class="reader-head"
            ><text class="artifact-title">{{ selectedMaterial.name }}</text
            ><BaseButton variant="quiet" icon="close" icon-only label="关闭资料" @tap="selectedMaterialId = ''" /></view
          ><text v-for="segment in selectedMaterial.segments" :key="segment.id" class="material-segment" selectable>{{
            segment.content
          }}</text></view
        >
      </view>
    </view>
  </view>
</template>
<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { workspaceConversationContext } from '@/services/learning/workspace-context.js';
import MuseConversationFilter from './muse-conversation-filter.vue';
import { museLearningLibrary } from '@/services/learning/muse-workspace-data.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
defineEmits(['view']);
const learning = useConversationLearningStore();
const root = ref(null),
  filterButton = ref(null),
  query = ref(''),
  section = ref('all'),
  kind = ref('all'),
  collapsed = ref({}),
  oldest = ref(false),
  selecting = ref(false),
  selected = ref([]),
  filterOpen = ref(false),
  selectedMaterialId = ref('');
const context = workspaceConversationContext(learning);
const library = computed(() => museLearningLibrary(learning.state, learning.calendarTime));
const groups = computed(() => library.value.groups);
const mobileSections = computed(() => library.value.sections);
const mobileFilterSections = computed(() =>
  groups.value.filter((group) => group.id !== 'conversations').flatMap((group) => group.items)
);
const sectionTitle = computed(() =>
  section.value === 'files'
    ? '原始资料'
    : mobileSections.value.find((item) => item.id === (section.value === 'all' ? context.id.value : section.value))
        ?.label || '全部学习内容'
);
const kindFilters = [
  { value: 'all', label: '全部类型' },
  { value: 'note', label: '对话内容' },
  { value: 'material', label: '私人资料' },
  { value: 'practice', label: '答题卡' },
  { value: 'writing', label: '写作成果' },
  { value: 'summary', label: '小结' },
  { value: 'document', label: '文档' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'presentation', label: 'PPT' },
  { value: 'animation', label: '动画' },
  { value: 'web', label: '交互学习内容' }
];
const items = computed(() =>
  library.value.items
    .filter((item) => {
      if (context.id.value !== 'all' && !item.categoryIds.includes(context.id.value)) return false;
      if (section.value === 'files' && item.kind !== 'material') return false;
      const selectedSection = mobileSections.value.find((value) => value.id === section.value);
      if (section.value !== 'all' && section.value !== 'files' && !selectedSection?.itemIds?.includes(item.id))
        return false;
      return (
        (kind.value === 'all' || item.kind === kind.value) &&
        `${item.title} ${item.goal || ''}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())
      );
    })
    .sort((a, b) => (oldest.value ? a.at - b.at : b.at - a.at))
);
const sectionIcon = computed(() => mobileSections.value.find((s) => s.id === section.value)?.icon || 'folder');
const emptyLabel = computed(() =>
  query.value || kind.value !== 'all'
    ? '没有匹配的资料'
    : section.value === 'files'
      ? '还没有原始资料'
      : section.value.startsWith('subject:')
        ? '该学科暂无记录'
        : '还没有学习内容'
);
watch(mobileSections, (value) => {
  if (section.value !== 'files' && !value.some((item) => item.id === section.value)) section.value = 'all';
});
const selectedMaterial = computed(() => learning.state.materials.find((m) => m.id === selectedMaterialId.value));
watch(
  () => learning.recordContext(),
  () => {
    selectedMaterialId.value = '';
    section.value = 'all';
    kind.value = 'all';
    query.value = '';
    selected.value = [];
    selecting.value = false;
    filterOpen.value = false;
  }
);
watch([() => context.id.value, section], () => {
  selectedMaterialId.value = '';
});
watch(items, (value) => {
  const ids = new Set(value.map((item) => item.id));
  selected.value = selected.value.filter((id) => ids.has(id));
});
function kindLabel(value) {
  return (
    {
      note: '对话内容',
      material: '文档',
      practice: '练习',
      writing: '写作',
      summary: '小结',
      image: '图片',
      video: '视频',
      audio: '音频',
      presentation: 'PPT',
      animation: '动画',
      document: '文档',
      web: '交互学习内容'
    }[value] || value
  );
}
function dateLabel(at, day) {
  return day || (at ? new Date(at).toLocaleDateString('zh-CN', { timeZone: learning.state.timezone }) : '已保存');
}
function toggleSelection() {
  selecting.value = !selecting.value;
  if (!selecting.value) selected.value = [];
}
function createArtifact() {
  if (learning.busy) return;
  learning.selectedConversationId = null;
  safeNavigateTo('/pages/learning/index');
}
function openArtifact(item) {
  if (selecting.value) {
    selected.value = selected.value.includes(item.id)
      ? selected.value.filter((id) => id !== item.id)
      : [...selected.value, item.id];
    return;
  }
  const source =
    item.sources.find((source) => `conversation:${source.conversationId}` === context.id.value) || item.sources[0];
  if (source) {
    if (learning.busy) return;
    context.id.value = `conversation:${source.conversationId}`;
    if (item.questionKey) learning.focus(item.questionKey, source.conversationId);
    else learning.locateConversation(source.conversationId, item.day, null, item.messageId);
    safeNavigateTo('/pages/learning/index');
  } else if (item.materialId) selectedMaterialId.value = item.materialId;
}
function chooseSection(id) {
  if (id === 'all' || id === 'unclassified' || id.startsWith('conversation:')) {
    context.id.value = id;
    section.value = 'all';
  } else section.value = id;
}

async function closeFilter() {
  filterOpen.value = false;
  await nextTick();
  (filterButton.value?.$el || filterButton.value)?.focus?.();
}
function keydown(event) {
  if (event.key === 'Escape' && filterOpen.value) {
    event.preventDefault();
    closeFilter();
  }
}
onMounted(() => (root.value?.$el || root.value)?.addEventListener?.('keydown', keydown));
onUnmounted(() => (root.value?.$el || root.value)?.removeEventListener?.('keydown', keydown));
</script>
<style scoped>
.muse-library {
  display: flex;
  height: 100%;
  min-height: 0;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  animation: muse-page-in 320ms var(--muse-spring-pop) both;
}
.library-sidebar {
  background: var(--muse-panel);
  width: 240px;
  flex: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--line-strong);
}
.library-sidebar-search {
  height: 60px;
  flex: none;
  display: flex;
  align-items: center;
  padding: 0 12px;
}
.lib-search {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 36px;
  padding: 0 16px 0 10px;
  border-radius: 999px;
  background: var(--muse-composer);
  box-shadow: inset 0 0 0 1px var(--line-strong);
  color: var(--ink-3);
}
.lib-search:focus-within {
  box-shadow:
    inset 0 0 0 1px var(--line-strong),
    0 0 0 2px var(--focus);
}
.lib-search :deep(.base-field) {
  flex: 1;
  min-width: 0;
  gap: 0;
}
.lib-search :deep(.base-field__group) {
  min-height: 0;
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
}
/* The search wrapper owns the accessible focus ring; suppress the nested one. */
.lib-search :deep(.base-field__group:focus-within) {
  outline: none !important;
}
.lib-search :deep(input) {
  height: 32px;
  font-size: 14px;
}
.library-sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 12px;
  scrollbar-width: none;
}
.lib-section {
  margin-bottom: 6px;
}
.lib-section-head {
  height: 44px;
  min-height: 44px;
  width: 100%;
  padding: 0 10px;
  border-radius: 999px;
  color: var(--ink-3);
  font-size: 13px;
  font-weight: 500;
}
.lib-section-head :deep(.base-button__content) {
  width: 100%;
  justify-content: space-between;
}
.lib-section-head :deep(.base-icon) {
  margin-left: auto;
  opacity: 0;
  transition:
    opacity 120ms ease,
    transform 200ms ease;
}
.lib-section:hover .lib-section-head :deep(.base-icon),
.lib-section-head:focus-visible :deep(.base-icon) {
  opacity: 1;
}
.is-collapsed .lib-section-head :deep(.base-icon) {
  margin-left: auto;
  transform: rotate(-90deg);
}
.lib-section-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 200ms ease;
}
.is-collapsed .lib-section-body {
  grid-template-rows: 0fr;
}
.lib-section-body > view {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.lib-nav {
  width: 100%;
  min-height: 44px;
  height: auto;
  padding: 8px;
  border-radius: 12px;
  color: var(--ink-3);
  font-size: 13px;
  font-weight: 400;
}
.lib-nav :deep(.base-button__content) {
  gap: 6px;
}
.lib-nav.is-current,
.lib-nav:hover {
  background: var(--muse-rich-surface);
  color: var(--ink);
}
.library-sidebar-footer {
  padding: 18px 12px;
}
.library-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.library-head {
  position: relative;
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 28px 28px 16px;
  flex-wrap: wrap;
}
.library-context {
  display: none;
  padding: 0 28px 12px;
}
.lib-nav :deep(.base-button__content),
.lib-nav text {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}
.library-title {
  min-width: 0;
  overflow-wrap: anywhere;
  margin: 0;
  font-size: 24px;
  line-height: 32px;
  font-weight: 680;
  letter-spacing: -0.03em;
}
.library-head-actions {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.lib-action {
  min-height: 44px;
  border-radius: 999px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 500;
  background: var(--muse-raised);
  color: var(--ink);
}
.lib-action-icon {
  width: 44px;
  padding: 0;
}
.lib-action-primary {
  background: var(--clay-face);
  color: var(--on-clay);
}
.library-filter {
  position: absolute;
  right: 28px;
  top: 78px;
  z-index: 12;
  width: 220px;
  max-height: min(60vh, 440px);
  overflow-y: auto;
  padding: 8px;
  border-radius: 16px;
  background: var(--muse-popover);
  box-shadow:
    var(--lift-2),
    0 0 0 1px var(--line-strong);
}
.library-filter .base-button {
  width: 100%;
  font-size: 13px;
  border-radius: 10px;
}
.library-filter-label {
  display: block;
  padding: 8px 12px 4px;
  color: var(--ink-3);
  font-size: 11px;
}
.library-mobile-filters {
  display: none;
}
.library-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 28px 36px;
  scrollbar-width: none;
}
.library-scroll::-webkit-scrollbar {
  display: none;
}
.library-section {
  display: block;
  margin: 14px 0 10px;
  font-size: 19px;
  line-height: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.library-section:first-child {
  margin-top: 2px;
}
.selection-count {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 400;
}
.recent-card {
  display: block;
  width: 420px;
  max-width: 100%;
  padding: 0;
  margin-bottom: 18px;
  border: 0;
  overflow: hidden;
  border-radius: 16px;
  color: var(--ink);
  text-align: left;
  background: var(--paper);
}
.recent-card :deep(.base-button__content) {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 0;
  align-items: stretch;
}
.recent-preview {
  width: 100%;
  height: 230px;
  padding: 22px 26px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 14px 22px;
  align-content: start;
  background: #fff;
  color: #0b0b0c;
}
.recent-plan {
  display: block;
  font-size: 10px;
  font-weight: 600;
}
.recent-value {
  display: block;
  margin: 6px 0 0 -2px;
  font-size: 46px;
  line-height: 48px;
  font-weight: 700;
  letter-spacing: -0.05em;
  color: #d97942;
}
.recent-value > text {
  margin-left: 4px;
  font-size: 14px;
}
.recent-rule {
  height: 2px;
  margin: 8px 0 5px;
  background: #d97942;
}
.recent-muted {
  display: block;
  font-size: 9px;
  line-height: 14px;
  font-weight: 400;
  color: #9a9b9f;
}
.recent-preview-aside {
  border-left: 1px solid #ececec;
  padding-left: 18px;
}
.recent-chip {
  display: inline-flex;
  padding: 1px 7px;
  border-radius: 999px;
  background: #fbe9df;
  color: #b45127;
  font-size: 8px;
  line-height: 14px;
}
.recent-heading {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}
.recent-preview-aside .recent-muted {
  margin-top: 5px;
  font-size: 8px;
}
.recent-columns {
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  border-top: 1px solid #ececec;
  padding-top: 10px;
}
.recent-columns > view {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 8px;
  font-weight: 600;
}
.recent-columns > view > text + text {
  font-size: 8px;
  font-weight: 400;
  color: #9a9b9f;
}
.recent-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  min-height: 70px;
  background: var(--paper);
  font-size: 14px;
}
.recent-foot > view {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.recent-foot-meta {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-3);
}
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 290px));
  justify-content: start;
  gap: 20px;
  margin-top: 4px;
}
.artifact {
  display: block;
  padding: 0;
  min-width: 0;
  border: 1px solid var(--line);
  overflow: hidden;
  border-radius: 16px;
  background: var(--muse-rich-surface);
  text-align: left;
}
.artifact :deep(.base-button__content) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 0;
}
.artifact-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
  aspect-ratio: 16/10;
  height: auto;
  background: linear-gradient(135deg, #2a4f8a, #16243c);
  color: #fff;
}
.artifact-cover :deep(.base-icon) {
  color: inherit !important;
}
.artifact-cover-material {
  background: linear-gradient(135deg, #255c46, #12241c);
}
.artifact-cover-writing {
  background: linear-gradient(135deg, #7a4a21, #2a1a0e);
}
.artifact-cover-summary {
  background: linear-gradient(135deg, #4b3a78, #1d1730);
}
.artifact-selection {
  position: absolute;
  top: 10px;
  right: 10px;
}
.artifact.is-selected {
  border-color: var(--blue);
}
.artifact-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px 12px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 400;
  color: var(--ink-3);
}
.artifact-title {
  display: block;
  font-size: 13px;
  line-height: 19px;
  font-weight: 600;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.library-sidebar :deep(.base-icon),
.library-empty :deep(.base-icon) {
  color: inherit !important;
}
.library-empty > text {
  margin: 13px 0;
  line-height: 18px;
}
.library-empty-mark {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: var(--muse-rich-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-3);
}
.library-empty {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 600;
}
.material-reader {
  margin-top: 24px;
  padding: 20px;
  border-radius: 16px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line);
}
.reader-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.material-segment {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 16px 0;
  font-size: 14px;
  line-height: 1.7;
}
@media (max-width: 977px) {
  .library-context {
    display: block;
  }
  .library-sidebar {
    display: none;
  }
  .library-mobile-filters {
    max-height: 144px;
    overflow-y: auto;
    flex: none;
    display: flex;
    gap: 4px;
    padding: 0 28px 12px;
    flex-wrap: wrap;
  }
  .library-mobile-filters .base-button {
    border-radius: 999px;
    font-size: 12px;
    min-height: 44px;
    padding: 0 10px;
  }
  .library-mobile-filters > :deep(.base-field) {
    width: 100%;
  }
}
@media (max-width: 820px) {
  .library-head {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .library-head-actions {
    height: auto;
    min-height: 44px;
    max-width: 100%;
    flex-wrap: wrap;
    align-self: flex-start;
  }
}
@media (max-width: 760px) {
  .library-head {
    padding: 24px 16px 14px;
  }
  .library-context {
    padding: 0 16px 12px;
  }
  .library-title {
    font-size: 24px;
    line-height: 32px;
  }
  .library-scroll {
    padding: 0 16px 24px;
  }
  .library-mobile-filters {
    padding: 0 16px 12px;
  }
  .lib-action {
    padding: 0 12px;
    font-size: 13px;
  }
  .lib-action-icon {
    padding: 0;
  }
  .library-filter {
    right: 16px;
    top: 126px;
  }
  .recent-preview {
    padding: 22px 20px;
    gap: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .muse-library {
    animation: none;
  }
  .lib-section-body {
    transition: none;
  }
}
@media (min-width: 600px) {
  .artifact-cover {
    height: 150px;
    aspect-ratio: auto;
  }
}
</style>
