// 跨端共享的页图合同；只检查编码/头部与资源边界，不声称完成图像真实性或 OCR 校验。
export const VISION_CONTRACT = 'page-reading-v1';
export const VISION_ADAPTER = 'openai-image-url-v1';
export const VISION_LIMITS = Object.freeze({ maxBytes: 512 * 1024, maxSide: 4096, maxPixels: 8 * 1024 * 1024 });
export const VISUAL_ROLES = Object.freeze([
  'question',
  'options',
  'user_answer',
  'teacher_annotation',
  'reference_candidate',
  'unknown'
]);
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function check(condition, code, message) {
  if (!condition) throw Object.assign(new Error(message), { code });
}
function record(value, keys) {
  return (
    value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((k) => keys.includes(k))
  );
}
export function visualSource(source) {
  check(
    record(source, ['materialId', 'segmentId', 'page', 'extractionVersion', 'extractionEventId']),
    'IMAGE_SOURCE_INVALID',
    '页图来源须关联明确的私人资料片段和提取版本'
  );
  for (const key of ['materialId', 'segmentId', 'extractionVersion'])
    check(
      typeof source[key] === 'string' && source[key].length > 0 && source[key].length <= 160,
      'IMAGE_SOURCE_INVALID',
      '页图来源标识不合法'
    );
  check(
    source.page === null || (Number.isInteger(source.page) && source.page >= 1 && source.page <= 100000),
    'IMAGE_SOURCE_INVALID',
    '页码不合法'
  );
  check(
    source.extractionEventId === null ||
      (typeof source.extractionEventId === 'string' &&
        source.extractionEventId.length > 0 &&
        source.extractionEventId.length <= 160),
    'IMAGE_SOURCE_INVALID',
    '提取记录不合法'
  );
  return Object.fromEntries(
    ['materialId', 'segmentId', 'page', 'extractionVersion', 'extractionEventId'].map((k) => [k, source[k]])
  );
}
export function matchesVisualSource(source, questionSource) {
  return (
    questionSource?.kind === 'private_material' &&
    Object.entries(visualSource(source)).every(([key, value]) => questionSource[key] === value)
  );
}
export function inspectPageImage(dataUrl) {
  check(
    typeof dataUrl === 'string' && dataUrl.length <= Math.ceil(VISION_LIMITS.maxBytes / 3) * 4 + 32,
    'IMAGE_LIMIT',
    '单张页图最多 512 KB，请在资料解析器生成较小页图'
  );
  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  check(match && match[2].length % 4 === 0, 'IMAGE_INVALID', '只支持有效的 PNG/JPEG 内嵌页图，不访问远程图片地址');
  const encoded = match[2],
    padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const length = (encoded.length / 4) * 3 - padding;
  check(
    length >= 24 &&
      length <= VISION_LIMITS.maxBytes &&
      (!padding || (alphabet.indexOf(encoded.at(-padding - 1)) & (padding === 2 ? 15 : 3)) === 0),
    'IMAGE_INVALID',
    '页图编码不完整或超过资源上限'
  );
  const bytes = new Uint8Array(length);
  for (let input = 0, output = 0; input < encoded.length; input += 4) {
    const n =
      (alphabet.indexOf(encoded[input]) << 18) |
      (alphabet.indexOf(encoded[input + 1]) << 12) |
      ((alphabet.indexOf(encoded[input + 2]) & 63) << 6) |
      (alphabet.indexOf(encoded[input + 3]) & 63);
    for (const shift of [16, 8, 0]) if (output < length) bytes[output++] = (n >>> shift) & 255;
  }
  let width, height;
  if (match[1] === 'png') {
    check(
      [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82].every((v, i) => bytes[i] === v),
      'IMAGE_INVALID',
      'PNG 头部与声明不一致'
    );
    const view = new DataView(bytes.buffer);
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else {
    check(bytes[0] === 255 && bytes[1] === 216, 'IMAGE_INVALID', 'JPEG 头部与声明不一致');
    let position = 2;
    for (let count = 0; count < 256 && position + 4 < length; count++) {
      check(bytes[position++] === 255, 'IMAGE_INVALID', 'JPEG 段边界不合法');
      while (bytes[position] === 255) position++;
      const marker = bytes[position++];
      const size = bytes[position] * 256 + bytes[position + 1];
      check(size >= 2 && position + size <= length, 'IMAGE_INVALID', 'JPEG 段长度不合法');
      if ([192, 193, 194].includes(marker)) {
        check(size >= 8, 'IMAGE_INVALID', 'JPEG 尺寸缺失');
        height = bytes[position + 3] * 256 + bytes[position + 4];
        width = bytes[position + 5] * 256 + bytes[position + 6];
        break;
      }
      if (marker === 218 || marker === 217) break;
      position += size;
    }
  }
  check(
    width > 0 &&
      height > 0 &&
      width <= VISION_LIMITS.maxSide &&
      height <= VISION_LIMITS.maxSide &&
      width * height <= VISION_LIMITS.maxPixels,
    'IMAGE_DIMENSIONS',
    '页图尺寸不合法或过大，请按页或区域处理'
  );
  return { mime: match[1], bytes: length, width, height };
}
export function validateVisualInput(images, consent, question) {
  check(consent === true, 'IMAGE_CONSENT_REQUIRED', '发送页图需要本次单独授权');
  check(
    Array.isArray(images) && images.length === 1 && record(images[0], ['dataUrl', 'source']),
    'IMAGE_INVALID',
    '每次只允许发送当前题目的一张页图'
  );
  const source = visualSource(images[0].source);
  check(
    typeof question?.questionKey === 'string' && matchesVisualSource(source, question.source),
    'IMAGE_SOURCE_MISMATCH',
    '页图与当前题目的来源或提取版本不一致'
  );
  return { dataUrl: images[0].dataUrl, source, ...inspectPageImage(images[0].dataUrl) };
}
export function validateVisualReading(value, source) {
  check(
    record(value, ['summary', 'regions', 'uncertainties']) &&
      typeof value.summary === 'string' &&
      value.summary.trim() &&
      value.summary.length <= 1500 &&
      Array.isArray(value.regions) &&
      value.regions.length >= 1 &&
      value.regions.length <= 8 &&
      Array.isArray(value.uncertainties) &&
      value.uncertainties.length <= 6,
    'VISUAL_OUTPUT_INVALID',
    '图片辅助解读结构不合法'
  );
  const regions = value.regions.map((region) => {
    check(
      record(region, ['role', 'text', 'region']) &&
        VISUAL_ROLES.includes(region.role) &&
        typeof region.text === 'string' &&
        region.text.trim() &&
        region.text.length <= 1000,
      'VISUAL_OUTPUT_INVALID',
      '图片内容角色或文字不合法'
    );
    const rectangle = region.region;
    check(
      rectangle === null ||
        (Array.isArray(rectangle) &&
          rectangle.length === 4 &&
          rectangle.every((v) => Number.isFinite(v) && v >= 0 && v <= 1) &&
          rectangle[2] > 0 &&
          rectangle[3] > 0 &&
          rectangle[0] + rectangle[2] <= 1 &&
          rectangle[1] + rectangle[3] <= 1),
      'VISUAL_OUTPUT_INVALID',
      '图片区域须为归一化位置，无法定位时使用 null'
    );
    return { role: region.role, text: region.text, region: rectangle };
  });
  check(
    value.uncertainties.every((item) => typeof item === 'string' && item.trim() && item.length <= 200) &&
      value.summary.length + regions.reduce((n, r) => n + r.text.length, 0) <= 5000,
    'VISUAL_OUTPUT_INVALID',
    '图片解读或疑义超过限制'
  );
  return {
    version: VISION_CONTRACT,
    status: 'ai_assisted',
    source: visualSource(source),
    summary: value.summary,
    regions,
    uncertainties: [...value.uncertainties]
  };
}
export function normalizeSavedVisualReading(value, source) {
  check(
    record(value, ['version', 'status', 'source', 'summary', 'regions', 'uncertainties']) &&
      value.version === VISION_CONTRACT &&
      value.status === 'ai_assisted' &&
      JSON.stringify(visualSource(value.source)) === JSON.stringify(visualSource(source)),
    'VISUAL_OUTPUT_INVALID',
    '图片解读来源或状态与请求不一致'
  );
  return validateVisualReading(
    { summary: value.summary, regions: value.regions, uncertainties: value.uncertainties },
    source
  );
}
export function visualReadingText(reading) {
  const labels = {
    question: '题干候选',
    options: '选项候选',
    user_answer: '纸面用户作答候选',
    teacher_annotation: '教师批注候选',
    reference_candidate: '参考答案候选',
    unknown: '角色待确认'
  };
  return `图片辅助解读 · 待校对（不是判分或答案依据）\n${reading.summary}\n${reading.regions.map((r) => `${labels[r.role]}：${r.text}`).join('\n')}\n${reading.uncertainties.length ? `需局部确认：${reading.uncertainties.join('；')}` : '模型未报告疑义，仍需核对符号、条件和内容角色。'}\n区域定位和角色均是模型候选；可靠部分可沿用，含糊部分先在资料校对中确认。`;
}
