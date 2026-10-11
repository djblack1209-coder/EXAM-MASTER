<template>
  <view class="learning-message-content">
    <template v-for="(block, index) in blocks" :key="index">
      <view v-if="block.kind === 'table'" class="learning-text-table" role="table" aria-label="学习对照表">
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
  font-size: 16px;
  line-height: 1.75;
  overflow-wrap: anywhere;
  max-width: 70ch;
}
.learning-text-block {
  white-space: pre-wrap;
  margin: 12px 0;
}
.block-heading {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  margin: 24px 0 12px;
}
.block-heading:first-child {
  margin-top: 0;
}
.block-item {
  display: flex;
  gap: 10px;
  margin: 8px 0;
}
.list-marker {
  flex-shrink: 0;
}
.text-emphasis {
  font-weight: 600;
}
.block-code {
  padding: 12px;
  background: var(--space-notice);
  border-radius: 12px;
  font-family: monospace;
  font-size: 14px;
}
.learning-text-table {
  margin: 16px 0;
}
.learning-text-row {
  display: grid;
  gap: 12px;
  border-bottom: 1px solid var(--space-line);
  padding: 12px 0;
  font-size: 14px;
}
.learning-text-row text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.table-heading {
  font-weight: 600;
}
@media (max-width: 520px) {
  .block-heading {
    font-size: 18px;
  }
  .learning-text-row {
    gap: 8px;
  }
}
</style>
