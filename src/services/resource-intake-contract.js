const IMPORT_STATUS_LABELS = {
  ready: '待处理',
  generating: '生成中',
  completed: '已完成',
  paused: '已暂停',
  failed: '失败',
  cancelled: '已取消'
};

const SOURCE_LABELS = {
  local: '本地文件',
  chat: '聊天记录',
  baidu: '百度网盘',
  admin: '管理后台',
  system: '系统导入'
};

const SOURCE_KEYS_BY_LABEL = Object.fromEntries(Object.entries(SOURCE_LABELS).map(([key, label]) => [label, key]));

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function isoDate(value) {
  return asDate(value).toISOString();
}

function dayString(value) {
  return isoDate(value).slice(0, 10);
}

function createDefaultId() {
  return `upload_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function resolveSource(source) {
  const raw = source || 'local';
  if (SOURCE_LABELS[raw]) {
    return { sourceKey: raw, source: SOURCE_LABELS[raw] };
  }
  if (SOURCE_KEYS_BY_LABEL[raw]) {
    return { sourceKey: SOURCE_KEYS_BY_LABEL[raw], source: raw };
  }
  return { sourceKey: 'system', source: String(raw) };
}

function normalizeDifficulty(difficulty) {
  if (difficulty === 'easy' || difficulty === 1 || difficulty === '1') return 'easy';
  if (difficulty === 'hard' || difficulty === 3 || difficulty === '3') return 'hard';
  return 'medium';
}

function normalizeQuestion(question, index = 0) {
  const id = question?._id || question?.id || `local_q_${index}`;
  return {
    ...question,
    id,
    _id: id,
    category: question?.category || question?.subject || '未分类',
    difficulty: normalizeDifficulty(question?.difficulty),
    options: question?.options || []
  };
}

export function formatIntakeStatusLabel(status) {
  return IMPORT_STATUS_LABELS[status] || IMPORT_STATUS_LABELS.ready;
}

export function createImportRecord(input = {}, options = {}) {
  const now = asDate(options.now);
  const { sourceKey, source } = resolveSource(input.source);
  const idFactory = options.idFactory || createDefaultId;
  const createdAt = input.createdAt ? isoDate(input.createdAt) : now.toISOString();
  const updatedAt = input.updatedAt ? isoDate(input.updatedAt) : now.toISOString();

  return {
    id: input.id || idFactory(),
    name: input.name || '未命名资料',
    size: Number(input.size || 0),
    date: input.date || dayString(now),
    source,
    sourceKey,
    sourceId: input.sourceId || '',
    status: input.status || 'ready',
    createdAt,
    updatedAt
  };
}

export function normalizeImportRecord(record = {}, options = {}) {
  const fallbackNow = options.now || record.updatedAt || record.createdAt || Date.now();
  return createImportRecord(
    {
      ...record,
      source: record.sourceKey || record.source,
      status: record.status || 'ready',
      createdAt: record.createdAt || fallbackNow,
      updatedAt: record.updatedAt || fallbackNow
    },
    {
      now: fallbackNow,
      idFactory: () => record.id || createDefaultId()
    }
  );
}

export function updateImportRecordStatus(records = [], id, status, options = {}) {
  const updatedAt = isoDate(options.now || Date.now());
  return (records || []).map((record) => {
    const normalized = normalizeImportRecord(record, options);
    if (normalized.id !== id) return normalized;
    return {
      ...normalized,
      status,
      updatedAt
    };
  });
}

export function buildQuestionBankStats(bank = []) {
  const categories = new Map();
  const normalized = (bank || []).map(normalizeQuestion);

  normalized.forEach((question) => {
    const category = question.category || '未分类';
    if (!categories.has(category)) {
      categories.set(category, {
        category,
        total: 0,
        difficulty: { easy: 0, medium: 0, hard: 0 }
      });
    }
    const item = categories.get(category);
    item.total += 1;
    item.difficulty[normalizeDifficulty(question.difficulty)] += 1;
  });

  return {
    total: normalized.length,
    categories: Array.from(categories.values()).sort((a, b) => b.total - a.total)
  };
}

export function filterBankQuestions(bank = [], params = {}) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.max(1, Number(params.pageSize || params.limit || 20));
  const category = params.category || '';
  const difficulty = params.difficulty ? normalizeDifficulty(params.difficulty) : '';

  const filtered = (bank || []).map(normalizeQuestion).filter((question) => {
    if (category && question.category !== category) return false;
    if (difficulty && normalizeDifficulty(question.difficulty) !== difficulty) return false;
    return true;
  });

  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  return {
    list,
    total: filtered.length,
    page,
    pageSize,
    hasMore: start + pageSize < filtered.length
  };
}

export function sampleBankQuestions(bank = [], params = {}) {
  const count = Math.max(1, Number(params.count || params.pageSize || params.limit || 20));
  return filterBankQuestions(bank, { ...params, page: 1, pageSize: count }).list.slice(0, count);
}

export function buildIntakeSnapshot({ records = [], bank = [], releaseCoverage = null, loadedBankIds = [] } = {}) {
  const normalizedRecords = (records || []).map(normalizeImportRecord);
  const statusCounts = normalizedRecords.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {});
  const activeRecord =
    normalizedRecords.find((record) => record.status === 'generating') ||
    normalizedRecords.find((record) => record.status === 'paused') ||
    normalizedRecords.find((record) => record.status === 'failed') ||
    normalizedRecords[0] ||
    null;

  const bankStats = buildQuestionBankStats(bank);
  const sources = Array.from(new Set((bank || []).map((item) => item?.source).filter(Boolean))).sort();
  const years = Array.from(new Set((bank || []).map((item) => item?.year).filter(Boolean))).sort((a, b) => a - b);
  const summary = releaseCoverage?.summary || {};
  const tracks = releaseCoverage?.tracks || [];
  const releaseState =
    summary.requiredSlots > 0 && summary.publishedSlots >= summary.requiredSlots
      ? 'complete'
      : summary.publishedSlots > 0 || summary.pendingSlots > 0
        ? 'partial'
        : 'empty';

  return {
    imports: {
      total: normalizedRecords.length,
      ready: statusCounts.ready || 0,
      generating: statusCounts.generating || 0,
      completed: statusCounts.completed || 0,
      paused: statusCounts.paused || 0,
      failed: statusCounts.failed || 0,
      cancelled: statusCounts.cancelled || 0,
      records: normalizedRecords
    },
    generation: {
      status: activeRecord?.status || 'idle',
      label: activeRecord ? formatIntakeStatusLabel(activeRecord.status) : '未开始',
      activeRecord
    },
    bank: {
      totalQuestions: bankStats.total,
      categories: bankStats.categories,
      sources,
      years,
      loadedBankIds: Array.from(loadedBankIds || [])
    },
    release: {
      state: releaseState,
      coverageRate: Number(summary.coverageRate || 0),
      publishedSlots: Number(summary.publishedSlots || 0),
      pendingSlots: Number(summary.pendingSlots || 0),
      requiredSlots: Number(summary.requiredSlots || 0),
      tracks
    }
  };
}
