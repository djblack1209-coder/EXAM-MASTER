const FALLBACK_CHOICE_OPTIONS = ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'];
const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const QUESTION_TYPE_LABELS = {
  single_choice: '单选题',
  multi_choice: '多选题',
  analysis: '分析题',
  flashcard: '闪卡',
  translation: '翻译题',
  essay: '写作题',
  short_answer: '简答题'
};
const KNOWLEDGE_STATE_LABELS = {
  unknown: '待点亮',
  primed: '接近掌握',
  strong: '稳定掌握',
  watch: '需要观察',
  weak: '薄弱点'
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function normalizeDifficulty(difficulty) {
  if (difficulty === 'easy' || difficulty === 1 || difficulty === '1') return 1;
  if (difficulty === 'hard' || difficulty === 3 || difficulty === '3') return 3;
  const numeric = Number(difficulty);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 2;
}

function isEvidenceOnlyType(type) {
  return ['analysis', 'flashcard', 'translation', 'essay', 'short_answer'].includes(type);
}

function isMultiChoiceType(type) {
  return type === 'multi_choice' || type === 'multiple_choice' || type === '多选';
}

export function normalizeQuizAnswer(question, type = question?.type) {
  const rawAnswer = question?.answer;
  if (isEvidenceOnlyType(type)) {
    return rawAnswer || '暂无答案';
  }

  const raw = (rawAnswer || 'A').toString().trim().toUpperCase();
  const optionCount = Array.isArray(question?.options) ? Math.max(question.options.length, 4) : 4;
  const allowedLabels = OPTION_LABELS.slice(0, optionCount).join('');
  const compact = raw.replace(/[\s,，、;；/|]+/g, '');

  if (isMultiChoiceType(type) && new RegExp(`^[${allowedLabels}]+$`).test(compact)) {
    const uniqueLabels = Array.from(new Set(compact.split('')));
    return OPTION_LABELS.filter((label) => uniqueLabels.includes(label)).join('');
  }

  const firstLabel = raw.match(new RegExp(`[${allowedLabels}]`))?.[0];
  return firstLabel || 'A';
}

export function normalizeQuizQuestion(question, index = 0, options = {}) {
  if (!question) return null;

  const type = question.type || options.defaultType || '单选';
  const rawOptions = Array.isArray(question.options) ? question.options : [];
  const shouldFillOptions = Boolean(options.fillMissingChoiceOptions) && !isEvidenceOnlyType(type);
  const normalizedOptions =
    shouldFillOptions && rawOptions.length < Number(options.minOptions || 4)
      ? [...FALLBACK_CHOICE_OPTIONS]
      : rawOptions;
  const knowledgeNodeIds = asArray(question.knowledgeNodeIds).length
    ? asArray(question.knowledgeNodeIds)
    : asArray(question.knowledge_points);
  const knowledgePoints = asArray(question.knowledge_points).length
    ? asArray(question.knowledge_points)
    : knowledgeNodeIds;
  const eloRating =
    question.eloRating ??
    (typeof options.resolveEloRating === 'function' ? options.resolveEloRating(question) : question.eloRating);

  return {
    ...question,
    id: question.id || question._id || `q_${index}`,
    question: question.question || question.title || options.defaultQuestion || `题目 ${index + 1}`,
    passage: question.passage || question.context || question.material || question.article || '',
    context: question.context || question.passage || question.material || question.article || '',
    material: question.material || question.passage || question.context || question.article || '',
    paperId: question.paperId || question.paper_id || '',
    paperName: question.paperName || question.paper_name || '',
    section: question.section || question.part || '',
    groupId: question.groupId || question.group_id || question.passageId || '',
    options: normalizedOptions,
    answer: normalizeQuizAnswer(question, type),
    desc: question.desc || question.description || question.explanation || question.analysis || '暂无解析',
    category: question.category || question.subject || '未分类',
    type,
    difficulty: normalizeDifficulty(question.difficulty),
    source: question.source || '',
    year: question.year || '',
    knowledgeNodeIds,
    knowledge_points: knowledgePoints,
    eloRating
  };
}

export function getQuizOptionLabel(question, index) {
  const option = question?.options?.[index] || '';
  const match = String(option).trim().match(/^([A-Z])[\s.。:：、-]/i);
  return match ? match[1].toUpperCase() : OPTION_LABELS[index] || 'A';
}

export function isCorrectQuizOption(question, index) {
  if (!question) return false;
  const correctAnswer = (question.answer || 'A').toString().trim().toUpperCase();
  const optionLabel = getQuizOptionLabel(question, index);
  if (/^[A-Z]{2,}$/.test(correctAnswer)) {
    return correctAnswer.includes(optionLabel);
  }
  if (OPTION_LABELS.slice(0, 4).includes(correctAnswer)) {
    return optionLabel === correctAnswer;
  }
  const optionText = String(question.options?.[index] || '');
  return Boolean(correctAnswer) && (optionText.startsWith(correctAnswer) || optionText.includes(correctAnswer));
}

export function isQuizFlashcardMode(question) {
  if (!question) return false;
  const type = question.type;
  return isEvidenceOnlyType(type) || !question.options?.length;
}

export function hasQuizSelectableOptions(question) {
  return Boolean(question?.options?.length) && !isQuizFlashcardMode(question);
}

export function getQuizQuestionTypeLabel(question) {
  const type = question?.type;
  return QUESTION_TYPE_LABELS[type] || type || '单选题';
}

export function buildQuizAnswerRecord(input = {}) {
  const question = input.question || {};
  const now = input.now == null ? Date.now() : input.now;
  const record = {
    questionId: question.id || question._id || input.questionId || '',
    index: Number(input.index || 0),
    userChoice: input.userChoice,
    isCorrect: input.isCorrect,
    timeSpent: Number(input.timeSpent || 0),
    answeredAt: now
  };

  ['speedScore', 'elo', 'rating', 'source', 'mode'].forEach((key) => {
    if (input[key] !== undefined) {
      record[key] = input[key];
    }
  });

  return record;
}

export function upsertQuizAnswerRecord(records = [], record = {}) {
  const normalized = {
    ...record,
    index: Number(record.index || 0),
    questionId: record.questionId || ''
  };
  const existingIndex = (records || []).findIndex((item) => {
    const sameIndex = Number(item.index || 0) === normalized.index;
    const sameQuestion = (item.questionId || '') === normalized.questionId;
    return sameIndex && sameQuestion;
  });

  if (existingIndex < 0) {
    return [...(records || []), normalized];
  }

  const next = [...records];
  next.splice(existingIndex, 1, {
    ...next[existingIndex],
    ...normalized
  });
  return next;
}

export function summarizeQuizProgress({ questions = [], answeredQuestions = [], currentIndex = 0 } = {}) {
  const deduped = (answeredQuestions || []).reduce((acc, record) => upsertQuizAnswerRecord(acc, record), []);
  const total = questions.length;
  const correctCount = deduped.filter((record) => record.isCorrect === true).length;
  const wrongCount = deduped.filter((record) => record.isCorrect === false).length;
  const neutralCount = deduped.length - correctCount - wrongCount;
  const gradedCount = correctCount + wrongCount;

  return {
    total,
    currentIndex,
    answeredCount: deduped.length,
    gradedCount,
    correctCount,
    wrongCount,
    neutralCount,
    progressRate: total > 0 ? deduped.length / total : 0,
    accuracy: gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : 0
  };
}

function formatNextReviewDelay(delayMs) {
  const delay = Number(delayMs);
  if (!Number.isFinite(delay) || delay <= 0) return '';
  const minutes = Math.round(delay / 60000);
  if (minutes < 60) {
    return `约 ${minutes} 分钟后首次复习`;
  }
  const hours = Math.round(delay / 3600000);
  return `约 ${hours} 小时后首次复习`;
}

export function buildQuizCompletionContent({
  questions = [],
  answeredQuestions = [],
  diagnosisLoading = false,
  diagnosisReady = false,
  diagnosisSummary = '',
  hasNextRecommendation = false,
  nextReviewDelayMs = null
} = {}) {
  const summary = summarizeQuizProgress({ questions, answeredQuestions });
  const base = `本次完成 ${summary.total} 题，正确率 ${summary.accuracy}%`;
  const nextReviewText = formatNextReviewDelay(nextReviewDelayMs);
  const scheduleHint =
    summary.wrongCount > 0 && nextReviewText ? `\n${summary.wrongCount} 道错题已加入复习计划，${nextReviewText}` : '';

  if (diagnosisLoading) return `${base}\n\nAI 正在分析你的答题数据...`;
  if (diagnosisReady && diagnosisSummary) return `${base}\n\n${diagnosisSummary}${scheduleHint}`;
  if (hasNextRecommendation) return `${base}${scheduleHint}\n\nAI 已根据薄弱点为你准备了下一组练习`;
  return `${base}${scheduleHint}\n\n点击查看 AI 诊断报告`;
}

export function buildQuizKnowledgeFeedback({
  activity = {},
  question = {},
  node = null,
  trail = [],
  visual = null,
  speedScore = 0
} = {}) {
  const nodeId = activity?.nodeIds?.[0] || '';
  const visualState = visual || { state: 'unknown', color: '#DDE8DD', mastery: 0 };
  const stateText = KNOWLEDGE_STATE_LABELS[visualState.state] || '已记录';
  const masteryText = `${visualState.mastery || 0}%`;
  const normalizedTrail = (trail || []).map((item) => ({
    id: item.id,
    label: item.label,
    type: item.type,
    tracks: item.tracks || []
  }));

  return {
    nodeId,
    label: node?.label || question.category || '公共课综合',
    color: visualState.color || '#DDE8DD',
    speedScore: activity?.speedScore ?? speedScore,
    tracks: node?.tracks || [],
    trail: normalizedTrail,
    chainText: normalizedTrail.length > 1 ? normalizedTrail.map((item) => item.label).join(' / ') : '',
    summary: `${stateText}，当前掌握 ${masteryText}，已记录到复习计划`
  };
}
