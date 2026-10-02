export const PAGE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
export const PAGE_SOURCE = {
  materialId: 'page-material',
  segmentId: 'page-1',
  page: 1,
  extractionVersion: 'fixture-image-v1',
  extractionEventId: 'page-extraction'
};
export const PAGE_READING = {
  summary: '合成测试页图候选；不是实际识别结果。',
  regions: [
    { role: 'question', text: '计算 12 + 8。', region: [0, 0, 1, 0.3] },
    { role: 'user_answer', text: '纸面写了19', region: null },
    { role: 'teacher_annotation', text: '需检查进位', region: null },
    { role: 'reference_candidate', text: '20，参考候选尚未核验', region: null }
  ],
  uncertainties: ['无法确认手写数字末位，请局部校对。']
};
