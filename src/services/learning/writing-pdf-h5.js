import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { materialFingerprint, MATERIAL_LIMITS } from './material-intake.js';

export async function readPDF(file, id) {
  GlobalWorkerOptions.workerSrc = workerURL;
  const loading = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
    useWasm: false
  });
  let doc;
  try {
    doc = await loading.promise;
    if (doc.numPages > 100) throw new Error('请拆分为100页以内的资料');
    const segments = [];
    let total = 0;
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const data = await page.getTextContent();
      const content = data.items
        .map((item) => (item.str || '') + (item.hasEOL ? '\n' : ' '))
        .join('')
        .trim();
      total += content.length;
      if (total > MATERIAL_LIMITS.maxText) throw new Error('文字超过50000字，请拆分资料');
      if (content)
        segments.push({
          id: `${id}:p${pageNumber}`,
          page: pageNumber,
          content,
          role: 'source_text',
          extractionVersion: 'pdfjs-text-v1',
          reviewRequired: true
        });
      page.cleanup();
    }
    if (total < 20) throw new Error('暂不支持扫描版');
    return {
      id,
      name: String(file.name).slice(0, 160),
      kind: 'pdf',
      scope: 'private',
      fingerprint: materialFingerprint(segments.map((s) => s.content).join('\n')),
      extractionVersion: 'pdfjs-text-v1',
      segments,
      dataFlow: 'device_only',
      status: 'ready',
      corrections: []
    };
  } finally {
    await loading.destroy();
  }
}
