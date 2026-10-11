<template>
  <view class="material-layout" data-test="material-layout">
    <text class="layout-status" role="status">{{ t('learning.kq6') }}{{ segment.page }}{{ t('learning.kii') }}</text>
    <view v-if="valid && segment.preview" class="page-image">
      <image
        :src="segment.preview"
        mode="widthFix"
        class="original-page"
        :aria-label="t('learning.kq6') + segment.page + t('learning.kia')"
      />
      <view
        v-if="highlight"
        class="region-highlight"
        :style="highlight"
        aria-hidden="true"
        data-test="layout-highlight"
      />
    </view>
    <BaseEmpty
      v-if="!valid || segment.status === 'failed'"
      state="error"
      :title="t('learning.kar')"
      mascot-size="small"
    />
    <template v-else>
      <view v-if="regions.length" class="region-options" :aria-label="t('learning.k6j')">
        <BaseChip
          v-for="entry in visibleRegions"
          :key="entry.block.id"
          :data-test="'layout-region-' + entry.index"
          :model-value="selectedIndex === entry.index"
          @update:model-value="selectRegion(entry.index)"
        >
          {{ learningText(regionLabel(entry.block.kind)) }} {{ entry.index + 1 }}
        </BaseChip>
      </view>
      <view v-if="regions.length > 20" class="region-options">
        <BaseButton :disabled="offset === 0" variant="quiet" @tap="offset -= 20">{{ t('learning.kig') }}</BaseButton>
        <text>{{ offset + 1 }}–{{ Math.min(offset + 20, regions.length) }} / {{ regions.length }}</text>
        <BaseButton :disabled="offset + 20 >= regions.length" variant="quiet" @tap="offset += 20">{{
          t('learning.kf2')
        }}</BaseButton>
      </view>
      <BaseEmpty v-if="!regions.length" state="empty" :title="t('learning.kqi')" mascot-size="small" />
      <view v-if="selected" class="region-content" aria-live="polite">
        <text>{{ learningText(regionLabel(selected.kind)) }}{{ t('learning.kf') }}</text>
        <scroll-view v-if="selected.kind === 'table' && selected.cells.length" scroll-x class="table-scroll">
          <view class="table-cells" :style="tableStyle" :aria-label="t('learning.ke9')">
            <BaseChip
              v-for="(cell, index) in selected.cells"
              :key="index"
              class="table-cell"
              :data-test="'layout-cell-' + index"
              :aria-label="
                t('learning.kq6') +
                (cell.row + 1) +
                t('learning.klx') +
                (cell.column + 1) +
                t('learning.k8u') +
                (cell.text || t('learning.k8c'))
              "
              :style="cellStyle(cell)"
              :model-value="selectedCell === index"
              @update:model-value="selectedCell = index"
            >
              {{ cell.text || t('learning.k18') }}
            </BaseChip>
          </view>
        </scroll-view>
        <text
          v-if="selected.kind === 'table' && selectedCell !== null && !selected.cells[selectedCell]?.bbox"
          class="layout-status"
          >{{ t('learning.k78') }}</text
        >
        <text v-if="selectedText" class="candidate-text" selectable data-test="layout-raw-text">{{
          selectedText
        }}</text>
        <BaseEmpty v-else-if="!selected.cells?.length" state="empty" :title="t('learning.k7')" mascot-size="small" />
        <text v-if="selected.kind === 'formula'" class="layout-status">{{ t('learning.kct') }}</text>
      </view>
    </template>
  </view>
</template>
<script setup>
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import { learningText } from '@/i18n/learning.js';
import { t } from '@/i18n/index.js';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';

import { computed, ref, watch } from 'vue';
import { validMaterialLayoutSegment } from '@/services/learning/learning-domain.js';
const props = defineProps({ segment: { type: Object, required: true } });
const selectedIndex = ref(0),
  selectedCell = ref(null),
  offset = ref(0);
watch(
  () => props.segment,
  () => {
    selectedIndex.value = 0;
    selectedCell.value = null;
    offset.value = 0;
  }
);
const valid = computed(() =>
  validMaterialLayoutSegment(props.segment, props.segment.sourceSha256, props.segment.method === 'docling_rapidocr')
);
const regions = computed(() => (valid.value ? props.segment.blocks || [] : []));
const visibleRegions = computed(() =>
  regions.value.slice(offset.value, offset.value + 20).map((block, index) => ({ block, index: offset.value + index }))
);
const selected = computed(() => regions.value[selectedIndex.value]);
const selectedText = computed(() => selected.value?.rawText || selected.value?.text || '');
const tableStyle = computed(() => ({
  gridTemplateColumns: `repeat(${selected.value?.columns || 1}, minmax(var(--mascot-state), 1fr))`,
  minWidth: `calc(var(--mascot-state) * ${selected.value?.columns || 1})`
}));
const highlight = computed(() => {
  const block = selected.value;
  if (!block) return null;
  const bounds = block.cells?.[selectedCell.value]?.bbox || block.bbox;
  const { width, height } = props.segment.dimensions;
  return {
    left: `${(bounds[0] / width) * 100}%`,
    top: `${(bounds[1] / height) * 100}%`,
    width: `${((bounds[2] - bounds[0]) / width) * 100}%`,
    height: `${((bounds[3] - bounds[1]) / height) * 100}%`
  };
});
function selectRegion(index) {
  selectedIndex.value = index;
  selectedCell.value = null;
}
function cellStyle(cell) {
  return {
    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
    gridColumn: `${cell.column + 1} / span ${cell.columnSpan}`
  };
}
function regionLabel(kind) {
  return (
    {
      table: '表格',
      formula: '公式',
      picture: '图形',
      caption: '图注',
      title: '标题',
      section_header: '标题',
      page_header: '页眉',
      page_footer: '页脚',
      list_item: '条目'
    }[kind] || '文字'
  );
}
</script>
<style scoped>
.material-layout {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  min-width: 0;
}
.page-image {
  position: relative;
  width: 100%;
  max-width: var(--dialog-width);
  line-height: 0;
}
.original-page {
  display: block;
  width: 100%;
}
.region-highlight {
  position: absolute;
  box-sizing: border-box;
  border: var(--border-selected) solid var(--line);
  background: var(--paper-sunk);
  pointer-events: none;
}
.region-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}
.region-content {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  min-width: 0;
}
.table-scroll {
  width: 100%;
  min-width: 0;
}
.table-cells {
  display: grid;
  width: 100%;
}
.table-cell {
  width: 100%;
  margin: 0;
}
.candidate-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.layout-status {
  font-size: var(--size-small);
  color: var(--ink-3);
}
</style>
