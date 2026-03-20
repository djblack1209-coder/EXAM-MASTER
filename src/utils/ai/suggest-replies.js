/**
 * 智能推荐回复生成器
 *
 * 基于 AI 回复内容，通过启发式规则提取 2-3 条跟进问题建议。
 * 纯本地计算，不产生额外 API 调用。
 *
 * @module utils/ai/suggest-replies
 */

// 概念类关键词模式：中文术语、英文术语
const CONCEPT_RE = /[「【《]([^」】》]{2,12})[」】》]/g;
const TERM_RE = /(?:所谓|即|称为|叫做|指的是)\s*[「""]?([^\s,，。""」]{2,10})/g;
const EN_TERM_RE = /\b([A-Z][a-zA-Z]{2,15}(?:\s[A-Z][a-zA-Z]+){0,2})\b/g;

// 步骤类模式
const STEP_RE = /(?:第([一二三四五六七八九十\d]+)[步个]|(\d+)[.、)）])/g;

// 列举类模式
const LIST_RE = /(?:包括|分别是|有以下|如下|主要有)[：:]/;

// 通用跟进问题池
const GENERIC_POOL = [
  '能举个具体的例子吗？',
  '还有其他方法吗？',
  '能再详细解释一下吗？',
  '实际应用中需要注意什么？',
  '有没有常见的误区？',
  '能总结一下要点吗？'
];

/**
 * 从 AI 回复中提取/生成 2-3 条推荐跟进问题
 * @param {string} text - AI 回复文本
 * @returns {string[]} 2-3 条推荐问题
 */
export function generateSuggestedReplies(text) {
  if (!text || typeof text !== 'string' || text.length < 10) {
    return GENERIC_POOL.slice(0, 2);
  }

  const suggestions = [];

  // 1. 提取概念类关键词 → "详细解释 X"
  const concepts = extractConcepts(text);
  if (concepts.length > 0) {
    suggestions.push(`「${concepts[0]}」能详细解释一下吗？`);
  }

  // 2. 检测步骤 → "第X步能详细说说吗"
  const steps = extractSteps(text);
  if (steps.length >= 2) {
    // 取中间或最后一个步骤
    const target = steps[Math.min(1, steps.length - 1)];
    suggestions.push(`第${target}步能详细说说吗？`);
  }

  // 3. 检测列举 → "还有其他的吗"
  if (LIST_RE.test(text)) {
    suggestions.push('还有其他的吗？');
  }

  // 4. 如果有第二个概念，追加
  if (concepts.length > 1 && suggestions.length < 3) {
    suggestions.push(`「${concepts[1]}」是什么意思？`);
  }

  // 5. 用通用问题补齐到 2-3 条（去重）
  const used = new Set(suggestions);
  for (const g of GENERIC_POOL) {
    if (suggestions.length >= 3) break;
    if (!used.has(g)) {
      suggestions.push(g);
      used.add(g);
    }
  }

  return suggestions.slice(0, 3);
}

/** 提取概念关键词（去重，最多3个） */
function extractConcepts(text) {
  const found = new Set();
  for (const re of [CONCEPT_RE, TERM_RE, EN_TERM_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const term = (m[1] || '').trim();
      if (term && term.length >= 2) found.add(term);
    }
  }
  return Array.from(found).slice(0, 3);
}

/** 提取步骤编号 */
function extractSteps(text) {
  STEP_RE.lastIndex = 0;
  const steps = [];
  let m;
  while ((m = STEP_RE.exec(text)) !== null) {
    steps.push(m[1] || m[2]);
  }
  return steps;
}
