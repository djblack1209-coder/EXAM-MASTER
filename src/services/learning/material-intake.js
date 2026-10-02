import { assert, normalizeRubric } from './learning-domain.js';

export const MATERIAL_LIMITS = Object.freeze({
  maxBytes: 10 * 1024 * 1024,
  maxText: 50000,
  segmentChars: 2000,
  pagesPerBatch: 5
});
// 用于本地去重，不用于来源真实性或安全签名。
export function materialFingerprint(value) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${value.length}:${(hash >>> 0).toString(16)}`;
}
export function parsePastedMaterial(input, id) {
  assert(
    typeof input === 'string' && input.trim() && input.length <= MATERIAL_LIMITS.maxText,
    'RESOURCE_LIMIT',
    '粘贴资料最多 50000 字，请分段处理'
  );
  const segments = [];
  for (let start = 0; start < input.length; start += MATERIAL_LIMITS.segmentChars) {
    const content = input.slice(start, start + MATERIAL_LIMITS.segmentChars);
    segments.push({
      id: `${id}_${segments.length + 1}`,
      content,
      page: null,
      location: { start, end: start + content.length },
      role: 'source_text',
      extractionVersion: 'paste-v1',
      // 自动发现答案文字不意味着其角色已确定，更不意味着正确。
      reviewRequired: /答案|解析|批注|我答|作答/.test(content)
    });
  }
  return {
    id,
    name: '粘贴资料',
    kind: 'text',
    scope: 'private',
    original: input,
    fingerprint: materialFingerprint(input),
    extractionVersion: 'paste-v1',
    segments,
    dataFlow: 'device_only',
    status: 'ready',
    corrections: []
  };
}
export function questionFromMaterial(material, input, id) {
  const segment = material.segments.find((s) => s.id === input.segmentId);
  assert(segment, 'NOT_FOUND', '原资料片段不存在');
  assert(input.prompt?.trim() && input.prompt.length <= 8000, 'INVALID_INPUT', '题干为空或过长');
  assert(['number', 'choice', 'subjective'].includes(input.type), 'INVALID_INPUT', '题型不支持');
  return {
    id,
    version: 1,
    prompt: input.prompt.trim(),
    answerType: input.type,
    options: input.options || [],
    subject: input.subject || '综合',
    knowledgePoint: input.knowledgePoint || '当前任务',
    scope: 'private',
    source: {
      materialId: material.id,
      segmentId: segment.id,
      page: segment.page,
      location: segment.location,
      extractionVersion: segment.extractionVersion || material.extractionVersion,
      extractionEventId: segment.extractionEventId || null,
      kind: 'private_material'
    },
    // 作答、批注与参考答案各自保存。默认不产生可靠判分依据。
    importedAnswer: input.userAnswer || null,
    teacherAnnotation: input.annotation || null,
    reference: input.reference ? { content: input.reference, role: 'reference_candidate', verified: false } : null,
    validation: null,
    ...(input.rubric ? { rubric: normalizeRubric(input.rubric) } : {}),
    uncertainties: input.uncertainties || [],
    changes: []
  };
}
export function structureMaterialCandidate(segment) {
  const lines = segment.content.split(/\r?\n/);
  const role = (pattern) =>
    lines
      .find((line) => pattern.test(line))
      ?.replace(pattern, '')
      .trim() || '';
  const prompt = role(/^(?:题目|问题|题干)[：:]\s*/);
  return {
    prompt: prompt || segment.content,
    options: lines.filter((line) => /^[A-H][.、．]\s*/.test(line)),
    userAnswer: role(/^(?:我答|用户作答|学生作答)[：:]\s*/),
    annotation: role(/^(?:教师批注|批注)[：:]\s*/),
    reference: role(/^(?:参考答案|标准答案|答案)[：:]\s*/),
    rolesConfirmed: Boolean(prompt) && !segment.reviewRequired,
    uncertainties: segment.reviewRequired
      ? [{ field: '题目条件或区域角色', resolved: false, reason: '解析仍有疑义，需对照原页局部确认' }]
      : []
  };
}
export function correctMaterialQuestion(question, patch, reason) {
  assert(reason?.trim() && patch.prompt?.trim(), 'INVALID_INPUT', '校对需填写题干和修改理由');
  const corrected = {
    ...question,
    ...patch,
    id: question.id,
    version: question.version + 1,
    scope: 'private',
    validation: null,
    changes: [...(question.changes || []), { fromVersion: question.version, reason, previousPrompt: question.prompt }],
    source: question.source
  };
  if (patch.prompt.trim() !== question.prompt) delete corrected.rubricRevisionOf;
  // 人工编辑之后沿普通候选题处理，不能继续沿用原字段练习的可执行合同。
  delete corrected.materialExercise;
  return corrected;
}
export function parserCapability(platform) {
  return {
    text: true,
    pdf: 'connector_required',
    image: 'connector_required',
    appleVision: platform === 'macos-connector' ? 'native_adapter_requires_health' : 'unavailable',
    cloudOCR: 'disabled_until_explicit_consent',
    extraCost: 'connector_dependent'
  };
}
