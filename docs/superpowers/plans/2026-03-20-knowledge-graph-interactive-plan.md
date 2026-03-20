# Knowledge Graph Interactive Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Knowledge Graph UI to visualize FSRS memory states and allow one-click AI-driven mini-drills for weak nodes.

**Architecture:** Use `wot-design-uni` (`wd-button`, `wd-popup`) to replace raw layout components in `knowledge-graph/index.vue`. Add computed styling mapping `node.stability` to node opacity. Hook up the `startTargetedDrill` function to call the backend AI generator.

**Tech Stack:** Vue 3, SCSS, Wot Design Uni

---

### Task 1: Replace Action Strip and Modals in knowledge-graph

**Files:**
- Modify: `src/pages/knowledge-graph/index.vue`

- [ ] **Step 1: Replace Action Strip buttons**
Change `<view class="action-strip-inner">` contents. Use `<wd-button>` for the main actions (e.g., "掌握分布", "智能复习", "组卷抽测").

```vue
<!-- Find the action strip and replace internal views with buttons -->
<wd-button size="small" type="primary" plain @click="showMasteryStats">掌握分布</wd-button>
<wd-button size="small" type="primary" plain @click="showLearningPath">学习路径</wd-button>
<wd-button size="small" type="success" @click="startSmartReview">智能复习</wd-button>
```

- [ ] **Step 2: Replace Node Detail Modal with `<wd-popup>`**
```vue
<wd-popup v-model="detailModalVisible" position="bottom" custom-class="node-detail-modal apple-glass-card">
  <!-- Content of the detail card -->
  <view class="detail-header">
    <text class="detail-title">{{ activeNode?.title }}</text>
  </view>
  <view class="detail-stats">
    <!-- ... -->
  </view>
  <view class="detail-actions" style="display: flex; gap: 16rpx; margin-top: 32rpx;">
    <wd-button block style="flex: 1;" @click="goPractice(activeNode)">普通练习</wd-button>
    <wd-button type="warning" block style="flex: 1;" @click="summonAITutor(activeNode)">召唤 AI 特训</wd-button>
  </view>
</wd-popup>
```

- [ ] **Step 3: Commit**
```bash
git add src/pages/knowledge-graph/index.vue
git commit -m "refactor(graph): migrate UI to wd-button and wd-popup"
```

### Task 2: Connect Visuals and AI Tutor Logic

**Files:**
- Modify: `src/pages/knowledge-graph/index.vue`

- [ ] **Step 1: Update Node Styling**
In `getNodeStyle(node, index)`, add a dynamic opacity/glow based on node data (simulating FSRS stability/mastery).
```javascript
opacity: Math.max(0.4, (node.mastery || 50) / 100),
filter: `drop-shadow(0 0 ${(node.mastery || 50) / 10}px ${node.color})`
```

- [ ] **Step 2: Add `summonAITutor` logic**
In `setup()`, add the function:
```javascript
const summonAITutor = (node) => {
  if (!node) return;
  uni.showLoading({ title: 'AI 导师组卷中...' });
  // Call backend (mocked interaction or direct)
  setTimeout(() => {
    uni.hideLoading();
    uni.navigateTo({
      url: `/pages/practice-sub/do-quiz?mode=ai_tutor&topic=${encodeURIComponent(node.title)}`
    });
    detailModalVisible.value = false;
  }, 1500);
};
```

- [ ] **Step 3: Commit**
```bash
git add src/pages/knowledge-graph/index.vue
git commit -m "feat(graph): bind visual memory stability and AI Tutor drill logic"
```
