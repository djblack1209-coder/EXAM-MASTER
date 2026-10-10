<template>
  <view class="material-layout" data-test="material-layout">
    <text class="layout-status" role="status">第 {{ segment.page }} 页 · 待核对</text>
    <view v-if="valid && segment.preview" class="page-image">
      <image
        :src="segment.preview"
        mode="widthFix"
        class="original-page"
        :aria-label="'第' + segment.page + '页原图'"
      />
      <view
        v-if="highlight"
        class="region-highlight"
        :style="highlight"
        aria-hidden="true"
        data-test="layout-highlight"
      />
    </view>
    <text v-if="!valid || segment.status === 'failed'">此页尚未解析，请重试。</text>
    <template v-else>
      <view v-if="regions.length" class="region-options" aria-label="原页区域">
        <button
          v-for="entry in visibleRegions"
          :key="entry.block.id"
          role="button"
          tabindex="0"
          size="mini"
          :aria-pressed="selectedIndex === entry.index"
          :data-test="'layout-region-' + entry.index"
          @tap="selectRegion(entry.index)"
        >
          {{ regionLabel(entry.block.kind) }} {{ entry.index + 1 }}
        </button>
      </view>
      <view v-if="regions.length > 20" class="region-options">
        <button role="button" tabindex="0" size="mini" :disabled="offset === 0" @tap="offset -= 20">前一组</button>
        <text>{{ offset + 1 }}–{{ Math.min(offset + 20, regions.length) }} / {{ regions.length }}</text>
        <button role="button" tabindex="0" size="mini" :disabled="offset + 20 >= regions.length" @tap="offset += 20">
          后一组
        </button>
      </view>
      <text v-if="!regions.length">此页未提取到文字。</text>
      <view v-if="selected" class="region-content" aria-live="polite">
        <text>{{ regionLabel(selected.kind) }}候选</text>
        <scroll-view v-if="selected.kind === 'table' && selected.cells.length" scroll-x class="table-scroll">
          <view class="table-cells" :style="tableStyle" aria-label="待核对表格">
            <button
              v-for="(cell, index) in selected.cells"
              :key="index"
              role="button"
              tabindex="0"
              class="table-cell"
              :aria-pressed="selectedCell === index"
              :data-test="'layout-cell-' + index"
              :aria-label="'第' + (cell.row + 1) + '行，第' + (cell.column + 1) + '列：' + (cell.text || '空白')"
              :style="cellStyle(cell)"
              @tap="selectedCell = index"
            >
              {{ cell.text || '（空白）' }}
            </button>
          </view>
        </scroll-view>
        <text
          v-if="selected.kind === 'table' && selectedCell !== null && !selected.cells[selectedCell]?.bbox"
          class="layout-status"
          >此格未定位，原图显示整张表。</text
        >
        <text v-if="selectedText" class="candidate-text" selectable data-test="layout-raw-text">{{
          selectedText
        }}</text>
        <text v-else-if="!selected.cells?.length">此区域未提取到文字。</text>
        <text v-if="selected.kind === 'formula'" class="layout-status">上下标和符号请对照原页。</text>
      </view>
    </template>
  </view>
</template>
<script setup>
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
  gridTemplateColumns: `repeat(${selected.value?.columns || 1}, minmax(88px, 1fr))`,
  minWidth: `${(selected.value?.columns || 1) * 88}px`
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
  gap: 12px;
  min-width: 0;
}
.page-image {
  position: relative;
  width: 100%;
  max-width: 680px;
  line-height: 0;
}
.original-page {
  display: block;
  width: 100%;
}
.region-highlight {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid #6d42d8;
  background: #9363f529;
  pointer-events: none;
}
.region-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.region-options button {
  margin: 0;
}
.region-options button[aria-pressed='true'],
.table-cell[aria-pressed='true'] {
  outline: 2px solid var(--space-ink, #5638ae);
  outline-offset: -2px;
}
.region-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  height: 100%;
  min-height: 44px;
  margin: 0;
  padding: 8px;
  border: 1px solid var(--space-line, #c5ccd5);
  border-radius: 0;
  line-height: 1.5;
  font-size: 14px;
  overflow-wrap: anywhere;
  color: var(--space-ink, #202a36);
  background: var(--space-composer, #fff);
}
.candidate-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.layout-status {
  font-size: 13px;
  color: var(--space-muted, #626572);
}
button:focus-visible {
  outline: 3px solid var(--space-ink, #5638ae);
  outline-offset: 2px;
}
</style>
