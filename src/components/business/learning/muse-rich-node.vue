<template>
  <text v-if="node.kind === 'literal'" selectable>{{ node.text }}</text>
  <BaseIcon v-else-if="node.kind === 'icon' && node.attrs?.icon" :name="node.attrs.icon" class="rich-icon" />
  <view v-else-if="node.kind === 'divider'" class="rich-divider" role="separator" />
  <!-- #ifdef H5 -->
  <component
    :is="'a'"
    v-else-if="node.kind === 'link' && node.attrs?.href"
    :href="node.attrs.href"
    target="_blank"
    rel="noopener noreferrer"
    class="rich-link"
    ><MuseRichNode v-for="(child, index) in node.children" :key="index" :node="child"
  /></component>
  <!-- #endif -->
  <view v-else :class="classes" :style="style" :role="role" :aria-level="node.level">
    <MuseRichNode v-for="(child, index) in node.children" :key="index" :node="child" />
  </view>
</template>
<script setup>
import { computed } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
defineOptions({ name: 'MuseRichNode' });
const props = defineProps({ node: { type: Object, required: true } });
const classes = computed(() => {
  const a = props.node.attrs || {};
  return [
    'rich-node',
    `rich-${props.node.kind}`,
    a.color && `rich-color-${a.color}`,
    a.size && `rich-size-${a.size}`,
    a.weight && `rich-weight-${a.weight}`,
    a.radius && `rich-radius-${a.radius}`,
    { 'rich-border': a.border, 'rich-surface': a.surface, 'rich-wrap': a.wrap }
  ];
});
const style = computed(() => {
  const a = props.node.attrs || {},
    value = {};
  if (a.gap !== undefined) value.gap = `${a.gap * 4}px`;
  if (a.padding !== undefined) value.padding = `${a.padding * 4}px`;
  if (a.columns) value.gridTemplateColumns = `repeat(${a.columns}, minmax(0, 1fr))`;
  if (a.justify === 'between') value.justifyContent = 'space-between';
  if (a.align) value.alignItems = a.align === 'center' ? 'center' : 'flex-start';
  return value;
});
const role = computed(
  () =>
    ({ table: 'table', 'table-row': 'row', 'table-cell': 'cell', heading: 'heading', title: 'heading' })[
      props.node.kind
    ]
);
</script>
<style scoped>
.rich-node {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.rich-paragraph {
  margin: 5px 0;
}
.rich-paragraph:first-child {
  margin-top: 0;
}
.rich-paragraph:last-child {
  margin-bottom: 0;
}
.rich-box,
.rich-col,
.rich-grid-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rich-box {
  padding: 12px;
  border-radius: 16px;
  background: var(--muse-rich-surface);
}
.rich-border {
  box-shadow: inset 0 0 0 1px var(--control-line);
}
.rich-surface {
  background: var(--muse-rich-surface);
}
.rich-radius-md {
  border-radius: 10px;
}
.rich-radius-lg {
  border-radius: 12px;
}
.rich-radius-xl {
  border-radius: 16px;
}
.rich-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.rich-row > .rich-paragraph {
  margin: 0;
}
.rich-wrap {
  flex-wrap: wrap;
}
.rich-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.rich-title,
.rich-heading {
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
  margin: 14px 0 6px;
}
.rich-title {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
}
.rich-heading:first-child {
  margin-top: 0;
}
.rich-text,
.rich-strong,
.rich-inline-code,
.rich-formula,
.rich-link {
  display: inline;
}
.rich-text > .rich-paragraph,
.rich-badge > .rich-paragraph,
.rich-title > .rich-paragraph,
.rich-strong > .rich-paragraph,
.rich-table-cell > .rich-paragraph {
  display: inline;
  margin: 0;
}
.rich-strong,
.rich-weight-semibold {
  font-weight: 600;
}
.rich-weight-medium {
  font-weight: 500;
}
.rich-badge {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  align-self: flex-start;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--muse-selected);
  font-size: 12px;
  line-height: 18px;
}
.rich-color-secondary,
.rich-caption {
  color: var(--ink-3);
}
.rich-color-success {
  color: var(--muse-rich-success);
}
.rich-color-warning {
  color: var(--muse-rich-warning);
}
.rich-color-danger {
  color: var(--muse-rich-danger);
}
.rich-badge.rich-color-success {
  background: var(--muse-rich-success-bg);
}
.rich-badge.rich-color-danger {
  background: var(--muse-rich-danger-bg);
}
.rich-size-xs,
.rich-caption {
  font-size: 12px;
  line-height: 18px;
}
.rich-size-sm {
  font-size: 13px;
  line-height: 20px;
}
.rich-size-lg {
  font-size: 18px;
  line-height: 26px;
}
.rich-size-xl {
  font-size: 22px;
  line-height: 28px;
}
.rich-size-2xl {
  font-size: 26px;
  line-height: 30px;
  font-weight: 650;
}
.rich-divider {
  height: 1px;
  width: 100%;
  background: var(--line-strong);
  margin: 8px 0;
}
.rich-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rich-list-item {
  display: list-item;
  margin-left: 20px;
}
.rich-quote {
  border-left: 3px solid var(--line-strong);
  padding-left: 12px;
  color: var(--ink-3);
}
.rich-code,
.rich-inline-code,
.rich-formula {
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
.rich-code {
  padding: 12px;
  background: var(--muse-rich-surface);
  border-radius: 12px;
  overflow-x: auto;
}
.rich-inline-code {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--muse-rich-surface);
}
.rich-link {
  color: var(--violet-ink);
  text-decoration: underline;
}
.rich-icon {
  display: inline-flex;
  vertical-align: middle;
  width: 16px !important;
  height: 16px !important;
  color: inherit;
  flex: none;
}
.rich-table {
  display: table;
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.rich-table-row {
  display: table-row;
}
.rich-table-cell {
  display: table-cell;
  border-bottom: 1px solid var(--line);
  padding: 7px 10px;
  vertical-align: top;
}
.rich-table-row:first-child {
  color: var(--ink-3);
  font-size: 13px;
}
.rich-table-row:last-child > .rich-table-cell {
  border-bottom: 0;
}
@media (max-width: 520px) {
  .rich-table-cell {
    padding: 7px 6px;
  }
  .rich-grid {
    gap: 6px;
  }
}
</style>
