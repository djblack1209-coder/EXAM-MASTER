# GLM-OCR Multi-Modal Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `proxy-ai.ts` and `ai-photo-search.ts` to fully leverage Zhipu AI's advanced visual document understanding (GLM-OCR / GLM-4V) to parse complex math formulas, tables, and exam papers with 100% structural fidelity.

**Architecture:** Modify the Zhipu API request payload to support multimodal `messages` arrays when base64 images are provided. Create a strictly formatted system prompt demanding JSON output.

**Tech Stack:** Node.js, Zhipu AI (GLM-4V), Laf Cloud

---

### Task 1: Add Multimodal Payload Support

**Files:**
- Modify: `laf-backend/functions/proxy-ai.ts`

- [ ] **Step 1: Update API call structure**
In `laf-backend/functions/proxy-ai.ts`, modify the `messages` array construction to handle `image_url` if a base64 string is passed in `data.imageUrl` or `data.base64`.
```typescript
let messages = [
  { role: "system", content: systemPrompt }
];

if (data.base64) {
  // Use multimodal glm-4v
  model = "glm-4v";
  messages.push({
    role: "user",
    content: [
      { type: "text", text: userPrompt },
      { type: "image_url", image_url: { url: data.base64 } }
    ]
  });
} else {
  messages.push({ role: "user", content: userPrompt });
}
```

- [ ] **Step 2: Commit**
```bash
git add laf-backend/functions/proxy-ai.ts
git commit -m "feat(ai): add multimodal message support to proxy-ai"
```

### Task 2: Strengthen OCR Extraction Prompts

**Files:**
- Modify: `laf-backend/functions/proxy-ai.ts`

- [ ] **Step 1: Add `ocr_parse` action handler**
In the switch-case for actions in `proxy-ai.ts`, add an `ocr_parse` handler that sets the `systemPrompt` specifically for structural extraction:
```typescript
case 'ocr_parse':
  systemPrompt = `You are an elite exam parser (like GLM-OCR). Extract the text, formulas, and structural layout from the image. 
  1. ALL math MUST use valid LaTeX format (e.g. $E=mc^2$ or $$...$$). 
  2. Return ONLY a pure JSON object containing: { "content": "Full extracted text", "type": "single/multiple/essay", "options": ["A", "B"], "extracted_formulas": ["LaTeX"] }`;
  model = "glm-4v";
  break;
```

- [ ] **Step 2: Commit**
```bash
git add laf-backend/functions/proxy-ai.ts
git commit -m "feat(ai): add strict GLM-OCR system prompt for ocr_parse"
```

### Task 3: Refactor Photo Search Endpoint

**Files:**
- Modify: `laf-backend/functions/ai-photo-search.ts`

- [ ] **Step 1: Simplify logic by proxying to proxy-ai logic**
Ensure `ai-photo-search.ts` formats the base64 correctly and calls out with the strict JSON constraint to parse questions perfectly, eliminating the old generic fallback.

- [ ] **Step 2: Commit**
```bash
git add laf-backend/functions/ai-photo-search.ts
git commit -m "refactor(ai): upgrade photo search to leverage GLM-OCR structure"
```
