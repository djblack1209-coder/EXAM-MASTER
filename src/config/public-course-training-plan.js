import { buildPublicCourseCoverage } from './bank-registry.js';

export const PUBLIC_COURSE_RELEASE_SCOPE = {
  startYear: 2005,
  endYear: 2026,
  tracks: ['politics', 'english1', 'english2', 'math1', 'math2', 'math3'],
  totalSlots: 132
};

export const PUBLIC_COURSE_PHASES = [
  {
    id: 'baseline',
    label: '摸底',
    weeks: 1,
    target: '每条轨道先做近三年一套，建立速度、正确率和错题基线。'
  },
  {
    id: 'full-paper',
    label: '整卷',
    weeks: 8,
    target: '按年份轮转做 2005-2026 真题，英语优先完整文章，数学保留演算，政治标记易混点。'
  },
  {
    id: 'repair',
    label: '修复',
    weeks: 4,
    target: '错题按知识点回炉，英语复盘文章证据句，数学复盘公式链，政治复盘选项陷阱。'
  },
  {
    id: 'sprint',
    label: '冲刺',
    weeks: 3,
    target: '限时整卷和错题二刷交替，保留最后一轮近五年套卷。'
  }
];

const DAY_TEMPLATES = [
  {
    day: 1,
    label: '周一',
    track: 'english1',
    mode: 'article_first',
    minutes: 70,
    focus: '英语一阅读文章 + 对应选择题'
  },
  { day: 2, label: '周二', track: 'math1', mode: 'calculation', minutes: 75, focus: '数学一高数/线代演算题' },
  { day: 3, label: '周三', track: 'politics', mode: 'choice_review', minutes: 55, focus: '政治单选/多选 + 易混选项' },
  { day: 4, label: '周四', track: 'english2', mode: 'article_first', minutes: 65, focus: '英语二阅读文章 + 新题型' },
  { day: 5, label: '周五', track: 'math2', mode: 'calculation', minutes: 70, focus: '数学二高数/线代专项' },
  { day: 6, label: '周六', track: 'math3', mode: 'calculation', minutes: 70, focus: '数学三概率/经济类应用' },
  { day: 7, label: '周日', track: 'mixed', mode: 'review', minutes: 60, focus: '本周错题、收藏和笔记复盘' }
];

function trackLabel(track) {
  const labels = {
    politics: '政治',
    english1: '英语一',
    english2: '英语二',
    math1: '数学一',
    math2: '数学二',
    math3: '数学三',
    mixed: '综合复盘'
  };
  return labels[track] || track;
}

function taskStatusForTrack(track, coverage) {
  if (track === 'mixed') return 'review';
  const row = coverage.tracks.find((item) => item.track === track);
  if (!row) return 'missing';
  if (row.publishedCount > 0) return 'ready';
  if (row.pendingCount > 0) return 'pending';
  return 'missing';
}

function nextYearForTrack(track, coverage) {
  const row = coverage.tracks.find((item) => item.track === track);
  if (!row) return '';
  return row.publishedYears.at(-1) || row.pendingYears.at(-1) || row.missingYears[0] || '';
}

export function buildPublicCourseTrainingPlan(options = {}) {
  const coverage = buildPublicCourseCoverage({
    minYear: options.startYear || PUBLIC_COURSE_RELEASE_SCOPE.startYear,
    maxYear: options.endYear || PUBLIC_COURSE_RELEASE_SCOPE.endYear,
    tracks: options.tracks || PUBLIC_COURSE_RELEASE_SCOPE.tracks
  });
  const now = options.now ? new Date(options.now) : new Date();
  const todayIndex = Number.isFinite(options.todayIndex) ? options.todayIndex : now.getDay() || 7;
  const todayTemplate = DAY_TEMPLATES.find((item) => item.day === todayIndex) || DAY_TEMPLATES[0];

  const weeklyTasks = DAY_TEMPLATES.map((template) => ({
    ...template,
    trackLabel: trackLabel(template.track),
    status: taskStatusForTrack(template.track, coverage),
    suggestedYear: nextYearForTrack(template.track, coverage)
  }));

  return {
    version: 1,
    scope: PUBLIC_COURSE_RELEASE_SCOPE,
    generatedAt: now.toISOString(),
    summary: {
      requiredSlots: coverage.summary.requiredSlots,
      publishedSlots: coverage.summary.publishedSlots,
      pendingSlots: coverage.summary.pendingSlots,
      missingSlots: coverage.summary.missingSlots,
      coverageRate: coverage.summary.coverageRate
    },
    phases: PUBLIC_COURSE_PHASES,
    today: weeklyTasks.find((item) => item.day === todayTemplate.day),
    weeklyTasks,
    trackCoverage: coverage.tracks.map((track) => ({
      track: track.track,
      label: track.label,
      publishedCount: track.publishedCount,
      pendingCount: track.pendingCount,
      missingCount: track.missingYears.length,
      nextPublishedYear: track.publishedYears.at(-1) || '',
      nextPendingYear: track.pendingYears.at(-1) || ''
    })),
    rules: [
      '英语阅读先读完整文章，再做题并标注证据句。',
      '数学题保留演算草稿，错题按公式链复盘。',
      '政治多选错题优先记录易混概念，不追求刷题速度。',
      '未通过门禁的题库只显示为整理中，不进入正式发布。'
    ]
  };
}

export const defaultPublicCourseTrainingPlan = buildPublicCourseTrainingPlan();
