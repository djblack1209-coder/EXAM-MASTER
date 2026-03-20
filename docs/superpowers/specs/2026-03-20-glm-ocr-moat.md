# Spec: GLM-OCR Multi-Modal Integration

## 1. Overview
As requested, we will upgrade the existing `proxy-ai.ts` to support the highly-specialized `GLM-OCR` model, establishing a significant moat in parsing complex multi-modal educational content (like math formulas and complex exam papers) accurately.

## 2. Approach
Instead of adding a new microservice, we will augment the existing Zhipu AI client inside `proxy-ai.ts` and `ai-photo-search.ts`.
- When an action like `ocr_parse` or `photo_search` triggers, we route the request specifically to the GLM-4V or the specialized Zhipu Document Understanding endpoint.
- We will construct the prompt to enforce output in strict LaTeX and Markdown format, ensuring 100% structural fidelity of exam papers.

## 3. Technical Strategy
1. **Model Endpoint Shift**: Instead of generic `chat/completions`, we will adjust payload parameters when a document or image is submitted (using `glm-4v` or specialized `glm-ocr` endpoint signatures if documented).
2. **Payload Restructuring**: Update `proxy-ai.ts` to accept base64 images under a unified `multimodal_input` schema.
3. **Structured Output**: The prompt will demand JSON output with keys: `{ content, analysis, tags, difficulty, formula_latex }`.

## 4. Execution Steps
1. Refactor `ai-photo-search.ts` to use a dedicated `OcrService` (or just robust prompt engineering in `proxy-ai.ts`).
2. Add `multimodal_input` handling in `proxy-ai.ts`.
3. Verify Zhipu request format.
