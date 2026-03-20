# Spec: Full Exam Parser (GLM-OCR based)

## 1. Overview
Currently, `import-data.vue` parses files by sending them to a generic backend text parser. However, for real exam preparation, PDFs often contain complex LaTeX formulas, charts, and two-column layouts that generic text extractors mangle.

We will upgrade `import-data.vue` and the backend to use the **GLM-OCR** endpoint for deep visual structural parsing of PDFs, slicing them page by page or converting them to images to extract pristine Markdown + LaTeX.

## 2. Approach
- **Frontend (`import-data.vue`)**:
  - Add an option toggle: "Generic Text Mode" vs "Deep OCR (Exam Mode)".
  - Clean up existing raw `<button>` spaghetti and implement `<wd-button>` and `<BaseCard>` for the upload zone and configurations.
- **Backend (`doc-convert` / `proxy-ai`)**:
  - The backend `doc-convert` (or a dedicated `exam-parser`) handles the file, rasterizes PDF to images, and sends them to the `ocr_parse` action in `proxy-ai` in a loop.
  - The results are concatenated into a pure JSON list of questions and injected into the user's `question_bank`.

## 3. Scope of this Iteration
- Refactor the UI in `import-data.vue` first, completely wiping out custom `.btn` and `.glass-morphism` spaghetti in favor of `<BaseCard>` and `<wd-button>`.
- Hook up the `isDeepOcr` flag in the UI so the frontend sends the flag to the backend during `import_material` calls.
