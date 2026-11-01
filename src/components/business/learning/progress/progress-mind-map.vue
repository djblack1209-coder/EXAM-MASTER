<template>
  <view class="progress-mind-map" role="tree" aria-label="思维导图">
    <text class="mind-root">{{ model.mindMap.label }}</text>
    <view
      v-for="branch in model.mindMap.branches"
      :key="branch.id"
      class="mind-branch"
      role="treeitem"
      aria-expanded="true"
    >
      <text class="mind-chapter">{{ branch.label }}</text>
      <view class="mind-leaves" role="group">
        <BaseButton
          v-for="node in branchNodes(branch)"
          :key="node.id"
          class="mind-node"
          :class="{ 'is-weakness': node.isWeakness }"
          variant="quiet"
          :data-mind-node="node.id"
          :selected="selectedId === node.id"
          :label="`${node.name} · ${node.statusLabel}`"
          @tap="emit('select', node.id)"
        >
          <text>{{ node.name }}</text
          ><text class="mind-status">{{ node.statusLabel }}<template v-if="node.isWeakness"> · 薄弱点</template></text>
        </BaseButton>
      </view>
    </view>
  </view>
</template>
<script setup>
import BaseButton from '@/components/base/base-button/base-button.vue';
const props = defineProps({ model: { type: Object, required: true }, selectedId: { type: String, default: '' } });
const emit = defineEmits(['select']);
const branchNodes = (branch) => props.model.nodes.filter((node) => branch.nodeIds.includes(node.id));
</script>
<style scoped>
.progress-mind-map {
  padding: 16px;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  background: var(--paper);
  width: 100%;
  box-sizing: border-box;
}
.mind-root {
  display: block;
  font-size: 16px;
  font-weight: 650;
  margin-bottom: 22px;
}
.mind-branch {
  margin-left: 8px;
  border-left: 1px solid var(--line-strong);
  padding: 0 0 20px 16px;
}
.mind-chapter {
  display: block;
  font-size: 13px;
  color: var(--ink-2);
  font-weight: 600;
  margin-bottom: 8px;
}
.mind-leaves {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mind-node.base-button {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper-sunk);
  font-size: 12px;
}
.mind-node :deep(.base-button__content) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mind-status {
  font-size: 11px;
  color: var(--ink-3);
}
.mind-node.is-weakness {
  border-left: 3px solid var(--muse-rich-warning);
}
@media (max-width: 420px) {
  .mind-leaves {
    display: grid;
    grid-template-columns: 1fr;
  }
  .mind-node.base-button {
    justify-content: flex-start;
    text-align: left;
  }
}
</style>
