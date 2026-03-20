# Full Exam Parser (GLM-OCR) Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `import-data.vue` to use standard `wot-design-uni` and `BaseCard` components, and add an "Exam Mode (Deep OCR)" toggle switch that signals the backend to utilize the GLM-OCR multimodal endpoints for PDF parsing.

**Architecture:** Use `wd-button`, `wd-switch`, and `BaseCard` to replace the raw `.glass-morphism` upload box. Add a reactive `useDeepOcr` boolean flag and pass it in the `lafService.callFunction('material-manager', { parseMode: useDeepOcr ? 'ocr' : 'text' })` call.

**Tech Stack:** Vue 3, SCSS, Wot Design Uni

---

### Task 1: Replace raw buttons in import-data.vue

**Files:**
- Modify: `src/pages/practice-sub/import-data.vue`

- [ ] **Step 1: Update UI template**
Replace `div.operation-zone` and custom `.upload-trigger` with `<BaseCard>` and `<wd-button>`. 

```vue
<!-- Inside the main card -->
<BaseCard padding="large" hoverable @click="chooseFile">
  <view class="upload-trigger">
    <BaseIcon name="folder" :size="48" color="var(--em-brand)" />
    <text class="upload-main-text">{{ isPickingFile ? '正在拉起...' : '选择真题/资料' }}</text>
  </view>
</BaseCard>

<view class="options-group">
  <text class="option-label">使用 GLM-OCR 深度解析公式图表</text>
  <wd-switch v-model="useDeepOcr" size="24px" active-color="var(--em-brand)" />
</view>

<wd-button type="primary" block size="large" :disabled="!fileName" :loading="isAnalyzing" @click="startAnalysis">
  {{ isAnalyzing ? '智能解析中...' : '开始导入题库' }}
</wd-button>
```

- [ ] **Step 2: Add logic state**
Add `import { ref } from 'vue';`
Add `const useDeepOcr = ref(true);`

- [ ] **Step 3: Update `startAnalysis` / `upload` logic**
In `uploadFileAndProcess()`, append `parseMode: useDeepOcr.value ? 'ocr' : 'text'` to the request metadata.

- [ ] **Step 4: Commit**
```bash
git add src/pages/practice-sub/import-data.vue
git commit -m "feat(practice): add GLM-OCR mode toggle and refactor import-data UI"
```
