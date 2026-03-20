# GLM-OCR Integration Plan (Building Core Moat)

## Objective
Replace current basic OCR with `GLM-OCR` for ultimate parsing capability (math formulas, layout structures) from photos/files.

## Strategy
1. **Laf Backend Adapter (`laf-backend/functions/api-ocr-glm.ts`)**:
   - Create a proxy cloud function in Laf that takes an image (base64 or URL).
   - Calls the SiliconFlow or Zhipu API that exposes the GLM-OCR model (since Zhipu models are often hosted there, or directly call Zhipu's API).
   - Parse the response (which includes Markdown and LaTeX).
2. **Frontend UI Update (`photo-search.vue` & `import-data.vue`)**:
   - Replace the loading spinner with a "Radar Scan" animation.
   - Use a streaming or typewriter effect to display the extracted markdown/LaTeX on the screen real-time.
   - Use `mp-html` (or existing markdown renderer temporarily) to render the math formulas properly.

## Implementation Steps
1. Create `laf-backend/functions/api-ocr-glm.ts` (stub the Zhipu API call).
2. Update `src/pages/tools/photo-search.vue` to use this new endpoint.
3. Enhance the UX during the scanning process to feel "intelligent".
