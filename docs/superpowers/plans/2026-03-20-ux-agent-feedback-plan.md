# UX Agent Feedback & Flow State Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the powerful Multi-Agent Tutor Feedback and FSRS Memory Stats calculated by the backend in the frontend `do-quiz.vue` answer submission flow.

**Architecture:** We will create two new presentational components: `TutorFeedbackCard` and `MemoryStatsRow`. We'll integrate them into `do-quiz.vue`'s post-submission response handling, feeding the newly returned `tutorFeedback` and `memoryState` data directly into the DOM.

**Tech Stack:** Vue 3 (Composition API), uni-app, SCSS, Wot Design Uni

---

### Task 1: Create MemoryStatsRow Component

**Files:**
- Create: `src/pages/practice-sub/components/quiz-result/MemoryStatsRow.vue`

- [ ] **Step 1: Write component**
```vue
<template>
  <view v-if="memoryState" class="memory-stats-row apple-glass-pill">
    <view class="stat-item">
      <text class="stat-label">上次复习</text>
      <text class="stat-value">{{ formatDate(memoryState.last_review) }}</text>
    </view>
    <view class="stat-divider" />
    <view class="stat-item">
      <text class="stat-label">下次复习</text>
      <text class="stat-value highlight">+{{ Math.max(1, memoryState.scheduled_days) }}天</text>
    </view>
    <view class="stat-divider" />
    <view class="stat-item">
      <text class="stat-label">稳定性</text>
      <text class="stat-value success">{{ memoryState.stability?.toFixed(1) || 0 }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  memoryState: { type: Object, default: () => null }
});

const formatDate = (dateStr) => {
  if (!dateStr) return '从未';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
</script>

<style lang="scss" scoped>
.memory-stats-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 16rpx 24rpx;
  margin: 20rpx 0;
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
  }
  
  .stat-label {
    font-size: 20rpx;
    color: var(--text-sub);
  }
  
  .stat-value {
    font-size: 24rpx;
    font-weight: bold;
    color: var(--text-primary);
    
    &.highlight {
      color: var(--em-brand);
    }
    
    &.success {
      color: var(--em-success);
    }
  }
  
  .stat-divider {
    width: 2rpx;
    height: 30rpx;
    background: var(--border-color);
    opacity: 0.5;
  }
}
</style>
```

- [ ] **Step 2: Commit**
```bash
git add src/pages/practice-sub/components/quiz-result/MemoryStatsRow.vue
git commit -m "feat(ui): add MemoryStatsRow component to display FSRS shifts"
```

### Task 2: Create TutorFeedbackCard Component

**Files:**
- Create: `src/pages/practice-sub/components/quiz-result/TutorFeedbackCard.vue`

- [ ] **Step 1: Write component**
```vue
<template>
  <view v-if="feedback" class="tutor-feedback-card">
    <BaseCard padding="medium">
      <template #header>
        <view class="tutor-header">
          <view class="tutor-avatar">
            <BaseIcon name="robot" :size="32" color="var(--em-brand)" />
          </view>
          <text class="tutor-title">AI Tutor 导师点评</text>
        </view>
      </template>
      <view class="tutor-body">
        <text class="tutor-text">{{ displayText }}</text>
        <view v-if="isTyping" class="typing-cursor" />
      </view>
    </BaseCard>
  </view>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const props = defineProps({
  feedback: { type: String, default: '' }
});

const displayText = ref('');
const isTyping = ref(false);
let typingTimer = null;

const startTyping = (text) => {
  if (!text) return;
  displayText.value = '';
  isTyping.value = true;
  let index = 0;
  
  clearInterval(typingTimer);
  typingTimer = setInterval(() => {
    if (index < text.length) {
      displayText.value += text[index];
      index++;
    } else {
      isTyping.value = false;
      clearInterval(typingTimer);
    }
  }, 30); // 30ms per char
};

watch(() => props.feedback, (newVal) => {
  if (newVal) {
    startTyping(newVal);
  }
}, { immediate: true });

onUnmounted(() => {
  if (typingTimer) clearInterval(typingTimer);
});
</script>

<style lang="scss" scoped>
.tutor-feedback-card {
  margin: 24rpx 0;
  
  .tutor-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding-bottom: 16rpx;
    border-bottom: 1rpx solid var(--border-color);
  }
  
  .tutor-avatar {
    width: 48rpx;
    height: 48rpx;
    background: var(--primary-light);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .tutor-title {
    font-size: 28rpx;
    font-weight: bold;
    color: var(--em-brand);
  }
  
  .tutor-body {
    margin-top: 16rpx;
    font-size: 28rpx;
    line-height: 1.6;
    color: var(--text-primary);
    position: relative;
  }
  
  .typing-cursor {
    display: inline-block;
    width: 4rpx;
    height: 28rpx;
    background: var(--em-brand);
    margin-left: 4rpx;
    vertical-align: middle;
    animation: blink 1s step-end infinite;
  }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
```

- [ ] **Step 2: Commit**
```bash
git add src/pages/practice-sub/components/quiz-result/TutorFeedbackCard.vue
git commit -m "feat(ui): add TutorFeedbackCard with typewriter effect"
```

### Task 3: Integrate components into do-quiz.vue

**Files:**
- Modify: `src/pages/practice-sub/do-quiz.vue`

- [ ] **Step 1: Import components and define state**
Add imports in the `<script>` setup:
```javascript
import MemoryStatsRow from './components/quiz-result/MemoryStatsRow.vue';
import TutorFeedbackCard from './components/quiz-result/TutorFeedbackCard.vue';

// Define state
const memoryState = ref(null);
const tutorFeedback = ref('');
```

- [ ] **Step 2: Update handleSubmit processing**
In `do-quiz.vue`, locate the method that processes the answer submission response (likely `handleAnswer` or `submitAnswer` where `data` is returned).
Update it to extract the new Moat data:
```javascript
// Example modification inside the submit success block:
if (res.data) {
  memoryState.value = res.data.memoryState || null;
  tutorFeedback.value = res.data.tutorFeedback || '';
}
```

- [ ] **Step 3: Inject components into template**
In the `<template>` of `do-quiz.vue`, find the result panel area (where it shows the correct answer and AI analysis) and inject the new components:
```vue
<!-- Insert after the main result status area -->
<MemoryStatsRow v-if="hasAnswered && memoryState" :memory-state="memoryState" />
<TutorFeedbackCard v-if="hasAnswered && tutorFeedback" :feedback="tutorFeedback" />
```

- [ ] **Step 4: Commit**
```bash
git add src/pages/practice-sub/do-quiz.vue
git commit -m "feat(practice): integrate moat visualizers into do-quiz"
```
