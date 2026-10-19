import { parsePastedMaterial, MATERIAL_LIMITS } from './material-intake.js';

// 文件在设备内提取，只有用户随后明确授权的片段会进入模型请求。
export async function readWritingMaterial(file, id) {
  if (!file || file.size > MATERIAL_LIMITS.maxBytes) throw new Error('文件最多10MB');
  const name = String(file.name || '我的资料').slice(0, 160);
  if (/\.(txt|md)$/i.test(name)) {
    const material = parsePastedMaterial(await file.text(), id);
    return { ...material, name };
  }
  if (!/\.pdf$/i.test(name)) throw new Error('请选择文字型 PDF、txt 或 md 文件');
  // #ifdef H5
  const { readPDF } = await import('./writing-pdf-h5.js');
  return readPDF(file, id);
  // #endif
  // #ifndef H5
  throw new Error('请在网页版导入文字型 PDF；这里可粘贴文字');
  // #endif
}
