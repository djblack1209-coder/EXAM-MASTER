# UI/UX Wot-Design-Uni Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate fragmented, raw UI components to `wot-design-uni` while preserving the application's unique Wise Light / Bitget Dark glassmorphism design identity.

**Architecture:** Inject design tokens as CSS Custom Properties into Wot Design's root scope. Replace raw `<button>` and custom popups in pages with `<wd-button>` and `<wd-popup>`. Create missing `BaseCard` to standardize the glassmorphism wrapper.

**Tech Stack:** Vue 3, uni-app, SCSS, wot-design-uni

---

### Task 1: Create Theme Mapping Bridge

**Files:**
- Create: `src/styles/_wot-theme.scss`
- Modify: `src/App.vue`

- [ ] **Step 1: Write the theme mapping variables**
In `src/styles/_wot-theme.scss`:
```scss
/* Inject Exam-Master theme into wot-design-uni */
page {
  /* Primary brand colors mapped to Wot */
  --wot-color-theme: var(--em-brand);
  --wot-color-success: var(--em-success);
  --wot-color-warning: var(--em-warning);
  --wot-color-danger: var(--em-danger);
  
  /* Button overrides to maintain our aesthetic */
  --wot-button-border-radius: var(--ds-radius-full, 999px);
  --wot-button-height: 88rpx;
  --wot-button-primary-bg-color: var(--em-brand);
  --wot-button-primary-color: var(--em-text-inverse);
  
  /* Popup / Modal backgrounds for glassmorphism */
  --wot-popup-bg: var(--bg-glass);
}
```

- [ ] **Step 2: Import into App.vue**
Modify `src/App.vue` to import this new file inside the `<style lang="scss">` block, right after `_theme-vars.scss` or `design-system.scss`.

- [ ] **Step 3: Commit**
```bash
git add src/styles/_wot-theme.scss src/App.vue
git commit -m "feat(ui): create wot-design-uni theme mapping bridge"
```

### Task 2: Implement BaseCard Wrapper

**Files:**
- Create: `src/components/base/base-card/base-card.vue`

- [ ] **Step 1: Write the BaseCard implementation**
```vue
<template>
  <view class="base-card apple-glass-card" :class="[paddingClass, { 'is-hoverable': hoverable }]">
    <view v-if="title || $slots.header" class="base-card__header">
      <slot name="header">
        <text v-if="title" class="base-card__title">{{ title }}</text>
        <text v-if="subtitle" class="base-card__subtitle">{{ subtitle }}</text>
      </slot>
    </view>
    <view class="base-card__body">
      <slot />
    </view>
    <view v-if="$slots.footer" class="base-card__footer">
      <slot name="footer" />
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  padding: { type: String, default: 'medium' }, // none, small, medium, large
  hoverable: { type: Boolean, default: false }
});

const paddingClass = computed(() => `padding-${props.padding}`);
</script>

<style lang="scss" scoped>
.base-card {
  border-radius: var(--ds-radius-xl, 32rpx);
  overflow: hidden;
  
  &.padding-none .base-card__body { padding: 0; }
  &.padding-small .base-card__body { padding: var(--ds-spacing-sm, 16rpx); }
  &.padding-medium .base-card__body { padding: var(--ds-spacing-md, 24rpx); }
  &.padding-large .base-card__body { padding: var(--ds-spacing-lg, 32rpx); }
  
  &__header {
    padding: var(--ds-spacing-md) var(--ds-spacing-md) 0;
  }
  &__title {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--text-primary);
  }
  &__subtitle {
    font-size: 24rpx;
    color: var(--text-sub);
    margin-top: 8rpx;
    display: block;
  }
  &__footer {
    padding: 0 var(--ds-spacing-md) var(--ds-spacing-md);
  }
  
  &.is-hoverable:active {
    transform: scale(0.98);
    transition: transform 0.2s;
  }
}
</style>
```

- [ ] **Step 2: Commit**
```bash
git add src/components/base/base-card/
git commit -m "feat(ui): add standard BaseCard component with glassmorphism"
```

### Task 3: Refactor do-quiz.vue (Buttons & Dialogs)

**Files:**
- Modify: `src/pages/practice-sub/do-quiz.vue`

- [ ] **Step 1: Replace raw buttons with wd-button**
Find instances of:
`<button class="next-btn" hover-class="ds-hover-btn" @tap="toNext">...`
Replace with:
`<wd-button block size="large" @click="toNext" :disabled="isNavigating" :loading="isNavigating">{{ ... }}</wd-button>`

- [ ] **Step 2: Remove duplicated button styles**
Remove `.next-btn`, `.btn-disabled` CSS from the `<style>` block in `do-quiz.vue` as Wot handles this.

- [ ] **Step 3: Commit**
```bash
git add src/pages/practice-sub/do-quiz.vue
git commit -m "refactor(quiz): migrate raw buttons to wd-button in do-quiz"
```

### Task 4: Refactor GoalSettingModal

**Files:**
- Modify: `src/components/business/practice/GoalSettingModal.vue`

- [ ] **Step 1: Replace custom overlay with wd-popup**
Change `<view class="goal-modal-overlay">` to use `<wd-popup v-model="visible" position="center" custom-class="apple-glass-card">`.

- [ ] **Step 2: Replace buttons with wd-button**
Change action buttons to `<wd-button>` and input to `<wd-input-number v-model="localValue" :min="5" :max="200" :step="5" />`.

- [ ] **Step 3: Commit**
```bash
git add src/components/business/practice/GoalSettingModal.vue
git commit -m "refactor(practice): migrate GoalSettingModal to use wd-popup and wd-input-number"
```
