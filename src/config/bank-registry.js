/**
 * 闪卡题库注册表
 * 所有可用的闪卡题库在此注册，APP启动时按需加载
 * 新增题库只需：1.放JSON到flashcard-banks/ 2.在此注册
 */
import { PUBLIC_COURSE_TRACKS } from './knowledge-graph.js';

// 题库注册表（懒加载，用到时才import）
const BANK_REGISTRY = [
  {
    id: 'politics-2025',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2025',
    name: '2025考研政治真题',
    description: '16道单选 + 17道多选 + 5道分析题',
    enabled: false,
    disabledReason: '答案清洗未完成，发布前不得进入刷题中心',
    // 动态导入，不会增加首屏加载体积
    loader: () => import('./flashcard-banks/politics-2025.json')
  },
  {
    id: 'politics-2024',
    subject: '政治',
    subjectKey: 'politics',
    track: 'politics',
    year: '2024',
    name: '2024考研政治真题',
    description: '22道单选 + 8道多选 + 5道分析题',
    enabled: false,
    disabledReason: '缺少 SourceEvidence 与答案证据 hash，发布前不得进入刷题中心',
    loader: () => import('./flashcard-banks/politics-2024.json')
  },
  {
    id: 'english-2025',
    subject: '英语',
    subjectKey: 'english',
    track: 'english1',
    year: '2025',
    name: '2025考研英语真题',
    description: '阅读理解 + 完形填空 + 词汇 + 翻译 + 写作',
    enabled: false,
    disabledReason: '缺少 SourceEvidence 与答案证据 hash，发布前不得进入刷题中心',
    loader: () => import('./flashcard-banks/english-2025.json')
  },
  {
    id: 'math-2025',
    subject: '数学',
    subjectKey: 'math',
    track: 'math1',
    year: '2025',
    name: '2025考研数学真题',
    description: '高等数学 + 线性代数 + 概率统计',
    enabled: false,
    disabledReason: '缺少 SourceEvidence 与答案证据 hash，发布前不得进入刷题中心',
    loader: () => import('./flashcard-banks/math-2025.json')
  }
  // 后续新增题库在这里添加
];

const DEFAULT_COVERAGE_START_YEAR = 2010;
const DEFAULT_COVERAGE_END_YEAR = 2026;

function getSubjectLabel(subjectKey) {
  if (subjectKey === 'politics') return '考研政治';
  if (subjectKey === 'english') return '考研英语';
  return '考研数学';
}

function getSelectedTracks(profile) {
  if (Array.isArray(profile.tracks) && profile.tracks.length > 0) {
    return profile.tracks;
  }
  return PUBLIC_COURSE_TRACKS.map((track) => track.id);
}

/**
 * 获取所有可用题库列表（不加载数据，只返回元信息）
 */
export function getAvailableBanks() {
  return BANK_REGISTRY.filter((bank) => bank.enabled !== false).map(({ loader, ...meta }) => meta);
}

export function getAllBankMetas() {
  return BANK_REGISTRY.map(({ loader, ...meta }) => meta);
}

function buildYearRange(minYear = DEFAULT_COVERAGE_START_YEAR, maxYear = DEFAULT_COVERAGE_END_YEAR) {
  const start = Number(minYear);
  const end = Number(maxYear);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function normalizeBankYear(bank) {
  const year = Number.parseInt(String(bank?.year || ''), 10);
  return Number.isFinite(year) ? year : null;
}

function releaseStateFor({ publishedYears, requiredYears }) {
  if (publishedYears.length === 0) return 'empty';
  if (publishedYears.length >= requiredYears.length) return 'complete';
  return 'partial';
}

/**
 * Build the release coverage matrix for public-course past-exam banks.
 *
 * This deliberately does not require Baidu group access. Group Source Manifest
 * records may enrich the ingest queue later, but the published/pending coverage
 * state is derived from the neutral bank registry.
 */
export function buildPublicCourseCoverage(options = {}) {
  const requiredYears = buildYearRange(options.minYear, options.maxYear);
  const selectedTracks =
    Array.isArray(options.tracks) && options.tracks.length
      ? options.tracks
      : PUBLIC_COURSE_TRACKS.map((track) => track.id);
  const bankMetas = Array.isArray(options.banks) ? options.banks : getAllBankMetas();

  const tracks = PUBLIC_COURSE_TRACKS.filter((track) => selectedTracks.includes(track.id)).map((track) => {
    const banksForTrack = bankMetas.filter((bank) => bank.track === track.id);
    const publishedYears = banksForTrack
      .filter((bank) => bank.enabled !== false)
      .map(normalizeBankYear)
      .filter((year) => year !== null && requiredYears.includes(year))
      .sort((a, b) => a - b);
    const pendingYears = banksForTrack
      .filter((bank) => bank.enabled === false)
      .map(normalizeBankYear)
      .filter((year) => year !== null && requiredYears.includes(year))
      .sort((a, b) => a - b);
    const knownYears = new Set([...publishedYears, ...pendingYears]);
    const missingYears = requiredYears.filter((year) => !knownYears.has(year));

    return {
      subject: track.subject,
      track: track.id,
      code: track.code,
      label: track.label,
      requiredYears,
      publishedYears,
      pendingYears,
      missingYears,
      publishedCount: publishedYears.length,
      pendingCount: pendingYears.length,
      requiredCount: requiredYears.length,
      coverageRate: requiredYears.length ? Number((publishedYears.length / requiredYears.length).toFixed(4)) : 1,
      releaseState: releaseStateFor({ publishedYears, requiredYears })
    };
  });

  const publishedSlots = tracks.reduce((sum, track) => sum + track.publishedCount, 0);
  const pendingSlots = tracks.reduce((sum, track) => sum + track.pendingCount, 0);
  const requiredSlots = tracks.reduce((sum, track) => sum + track.requiredCount, 0);

  return {
    version: 1,
    policy: {
      source: 'bank_registry',
      groupSourceRequired: false,
      groupSourceRole: 'optional_discovery'
    },
    summary: {
      trackCount: tracks.length,
      requiredSlots,
      publishedSlots,
      pendingSlots,
      missingSlots: tracks.reduce((sum, track) => sum + track.missingYears.length, 0),
      coverageRate: requiredSlots ? Number((publishedSlots / requiredSlots).toFixed(4)) : 1,
      groupSourceRequired: false
    },
    tracks
  };
}

/**
 * 按ID加载某个题库的完整数据
 * @param {string} bankId - 题库ID
 * @returns {Promise<Object>} - 闪卡JSON数据
 */
export async function loadBank(bankId) {
  const entry = BANK_REGISTRY.find((b) => b.id === bankId && b.enabled !== false);
  if (!entry) {
    throw new Error(`题库不存在或未发布: ${bankId}`);
  }

  const module = await entry.loader();
  // 兼容ESM和CJS的default导出
  return module.default || module;
}

/**
 * 按科目筛选题库
 * @param {string} subject - 科目名
 */
export function getBanksBySubject(subject) {
  return BANK_REGISTRY.filter((b) => b.subject === subject && b.enabled !== false).map(({ loader, ...meta }) => meta);
}

/**
 * 生成刷题页多级导航树：科目 -> 公共课轨道 -> 题库。
 * 当前小程序可先消费这个轻量结构，后续后端完整题库发布后只需扩展 registry。
 */
export function getPracticeNavigationTree(profile = {}) {
  const selectedTracks = getSelectedTracks(profile);
  const banks = getAllBankMetas();
  const coverageByTrack = new Map(
    buildPublicCourseCoverage({ tracks: selectedTracks, banks }).tracks.map((track) => [track.track, track])
  );

  return PUBLIC_COURSE_TRACKS.filter((track) => selectedTracks.includes(track.id)).reduce((subjects, track) => {
    let subject = subjects.find((item) => item.id === track.subject);
    if (!subject) {
      subject = {
        id: track.subject,
        label: getSubjectLabel(track.subject),
        tracks: []
      };
      subjects.push(subject);
    }

    subject.tracks.push({
      id: track.id,
      code: track.code,
      label: track.label,
      banks: banks.filter((bank) => bank.track === track.id && bank.enabled !== false),
      pendingBanks: banks.filter((bank) => bank.track === track.id && bank.enabled === false),
      coverage: {
        ...coverageByTrack.get(track.id),
        groupSourceRequired: false
      },
      modes: [
        { id: 'past_exam', label: '历年真题' },
        { id: 'timed_sprint', label: '限时冲刺' },
        { id: 'weakness', label: '薄弱点强化' },
        { id: 'knowledge_graph', label: '知识地图' }
      ]
    });
    return subjects;
  }, []);
}
