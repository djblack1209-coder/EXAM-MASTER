<template>
  <view class="learning-message-content">
    <template v-for="(block, index) in blocks" :key="index">
      <view v-if="block.kind === 'table'" class="learning-text-table" role="table" :aria-label="t('learning.kos')">
        <view
          v-for="(row, rowIndex) in block.rows"
          :key="rowIndex"
          class="learning-text-row"
          role="row"
          :style="{ gridTemplateColumns: `repeat(${block.columns}, minmax(0, 1fr))` }"
        >
          <text
            v-for="(cell, cellIndex) in row"
            :key="cellIndex"
            :role="rowIndex ? 'cell' : 'columnheader'"
            :class="{ 'table-heading': rowIndex === 0 }"
            selectable
            >{{ cell }}</text
          >
        </view>
      </view>
      <view
        v-else
        :class="['learning-text-block', `block-${block.kind}`]"
        :role="block.kind === 'heading' ? 'heading' : undefined"
        :aria-level="block.kind === 'heading' ? block.level : undefined"
      >
        <text v-if="block.kind === 'item'" class="list-marker" aria-hidden="true">•</text>
        <text selectable
          ><text
            v-for="(part, partIndex) in inline(block.text)"
            :key="partIndex"
            :class="{ 'text-emphasis': part.strong }"
            >{{ part.text }}</text
          ></text
        >
      </view>
    </template>
  </view>
</template>
<script setup>
import { t } from '@/i18n/index.js';

import { computed } from 'vue';
const props = defineProps({ content: { type: String, default: '' } });
function inline(text) {
  return text
    .split(/(\*\*[^*\n]+\*\*)/u)
    .filter(Boolean)
    .map((part) => ({
      text: /^\*\*[^*\n]+\*\*$/u.test(part) ? part.slice(2, -2) : part,
      strong: /^\*\*[^*\n]+\*\*$/u.test(part)
    }));
}
// 只识别阅读结构；HTML、链接、脚本和未知语法均保持普通文字，不执行模型标记。
const blocks = computed(() => {
  const lines = props.content.split('\n'),
    output = [];
  let paragraph = [],
    code = false;
  const flush = () => {
    if (paragraph.length) output.push({ kind: code ? 'code' : 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^```/u.test(line)) {
      flush();
      code = !code;
      continue;
    }
    if (code) {
      paragraph.push(line);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/u.exec(line);
    if (heading) {
      flush();
      output.push({ kind: 'heading', level: heading[1].length + 1, text: heading[2] });
      continue;
    }
    if (/^\s*[-*]\s+/u.test(line)) {
      flush();
      output.push({ kind: 'item', text: line.replace(/^\s*[-*]\s+/u, '') });
      continue;
    }
    if (/^\|.*\|\s*$/u.test(line) && /^\|[\s:|\-]+\|\s*$/u.test(lines[index + 1] || '')) {
      const cells = (value) =>
        value
          .trim()
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim());
      const columns = cells(line).length;
      if (columns <= 6) {
        flush();
        const rows = [cells(line)];
        index += 2;
        while (index < lines.length && /^\|.*\|\s*$/u.test(lines[index]) && cells(lines[index]).length === columns) {
          rows.push(cells(lines[index]));
          index++;
        }
        index--;
        output.push({ kind: 'table', columns, rows });
        continue;
      }
    }
    if (!line.trim()) flush();
    else paragraph.push(line);
  }
  flush();
  return output;
});
</script>
<style scoped>
.learning-message-content {
  font-size: var(--size-body);
  line-height: 1.75;
  overflow-wrap: anywhere;
  max-width: 70ch;
}
.learning-text-block {
  white-space: pre-wrap;
  margin: var(--s-3) 0;
}
.block-heading {
  font-size: var(--size-title-3);
  font-weight: var(--weight-ui-emphasis);
  line-height: 1.4;
  margin: var(--s-6) 0 var(--s-3);
}
.block-heading:first-child {
  margin-top: 0;
}
.block-item {
  display: flex;
  gap: var(--s-3);
  margin: var(--s-2) 0;
}
.list-marker {
  flex-shrink: 0;
}
.text-emphasis {
  font-weight: var(--weight-ui-emphasis);
}
.block-code {
  padding: var(--s-3);
  background: var(--violet-soft);
  border-radius: var(--s-3);
  font-family: var(--font-ui);
  font-size: var(--size-small);
}
.learning-text-table {
  margin: var(--s-4) 0;
}
.learning-text-row {
  display: grid;
  gap: var(--s-3);
  border-bottom: var(--border-thin) solid var(--line);
  padding: var(--s-3) 0;
  font-size: var(--size-small);
}
.learning-text-row text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.table-heading {
  font-weight: var(--weight-ui-emphasis);
}
@media (max-width: 520px) {
  .block-heading {
    font-size: var(--size-title-3);
  }
  .learning-text-row {
    gap: var(--s-2);
  }
}
</style>
