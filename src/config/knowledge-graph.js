/**
 * 公共课知识神经图谱种子配置。
 *
 * 这里存放可在小程序端安全使用的轻量图谱；完整 3D 图谱由后端根据同一
 * node id 体系扩展。节点命名不包含机构或老师信息，避免资料来源泄露。
 */

export const KNOWLEDGE_GRAPH_VERSION = '2026.04-public-courses-v1';

export const KNOWLEDGE_STATE_COLORS = {
  unknown: '#DDE8DD',
  primed: '#FFFFFF',
  strong: '#9FE870',
  watch: '#FFD166',
  weak: '#FF5A5F'
};

export const PUBLIC_COURSE_TRACKS = [
  { id: 'politics', subject: 'politics', code: '101', label: '考研政治' },
  { id: 'english1', subject: 'english', code: '201', label: '英语一' },
  { id: 'english2', subject: 'english', code: '204', label: '英语二' },
  { id: 'math1', subject: 'math', code: '301', label: '数学一' },
  { id: 'math2', subject: 'math', code: '302', label: '数学二' },
  { id: 'math3', subject: 'math', code: '303', label: '数学三' }
];

const SUBJECT_NODES = [
  node('subject:politics', 'subject', '考研政治', ['politics']),
  node('subject:english', 'subject', '考研英语', ['english1', 'english2']),
  node('subject:math', 'subject', '考研数学', ['math1', 'math2', 'math3'])
];

const TRACK_NODES = [
  node('track:politics', 'track', '政治 101', ['politics'], 'subject:politics'),
  node('track:english1', 'track', '英语一 201', ['english1'], 'subject:english'),
  node('track:english2', 'track', '英语二 204', ['english2'], 'subject:english'),
  node('track:math1', 'track', '数学一 301', ['math1'], 'subject:math'),
  node('track:math2', 'track', '数学二 302', ['math2'], 'subject:math'),
  node('track:math3', 'track', '数学三 303', ['math3'], 'subject:math')
];

const MODULE_NODES = [
  node('module:politics:marxism', 'module', '马克思主义基本原理', ['politics'], 'track:politics'),
  node('module:politics:mao', 'module', '毛中特', ['politics'], 'track:politics'),
  node('module:politics:history', 'module', '中国近现代史纲要', ['politics'], 'track:politics'),
  node('module:politics:law', 'module', '思修法基', ['politics'], 'track:politics'),
  node('module:politics:current', 'module', '形势与政策', ['politics'], 'track:politics'),

  node('module:english:cloze', 'module', '完形填空', ['english1', 'english2'], 'subject:english'),
  node('module:english:reading', 'module', '阅读理解', ['english1', 'english2'], 'subject:english'),
  node('module:english:new-type', 'module', '新题型', ['english1', 'english2'], 'subject:english'),
  node('module:english:translation', 'module', '翻译', ['english1', 'english2'], 'subject:english'),
  node('module:english:writing', 'module', '写作', ['english1', 'english2'], 'subject:english'),

  node('module:math:calculus', 'module', '高等数学', ['math1', 'math2', 'math3'], 'subject:math'),
  node('module:math:linear', 'module', '线性代数', ['math1', 'math2', 'math3'], 'subject:math'),
  node('module:math:probability', 'module', '概率统计', ['math1', 'math3'], 'subject:math')
];

const TOPIC_NODES = [
  node('topic:politics:marxism:materialism', 'topic', '唯物论', ['politics'], 'module:politics:marxism'),
  node('topic:politics:marxism:dialectics', 'topic', '辩证法', ['politics'], 'module:politics:marxism'),
  node('topic:politics:marxism:epistemology', 'topic', '认识论', ['politics'], 'module:politics:marxism'),
  node('topic:politics:marxism:history', 'topic', '唯物史观', ['politics'], 'module:politics:marxism'),
  node('topic:politics:mao:new-era', 'topic', '新时代中国特色社会主义', ['politics'], 'module:politics:mao'),
  node('topic:politics:law:ethics', 'topic', '道德与法治', ['politics'], 'module:politics:law'),

  node('topic:english:reading:main-idea', 'topic', '主旨题', ['english1', 'english2'], 'module:english:reading'),
  node('topic:english:reading:detail', 'topic', '细节题', ['english1', 'english2'], 'module:english:reading'),
  node('topic:english:reading:inference', 'topic', '推断题', ['english1', 'english2'], 'module:english:reading'),
  node('topic:english:reading:attitude', 'topic', '态度题', ['english1', 'english2'], 'module:english:reading'),
  node('topic:english:cloze:vocab', 'topic', '词义辨析', ['english1', 'english2'], 'module:english:cloze'),
  node('topic:english:writing:structure', 'topic', '写作结构', ['english1', 'english2'], 'module:english:writing'),

  node('topic:math:calculus:limit', 'topic', '极限', ['math1', 'math2', 'math3'], 'module:math:calculus'),
  node('topic:math:calculus:derivative', 'topic', '导数与微分', ['math1', 'math2', 'math3'], 'module:math:calculus'),
  node('topic:math:calculus:integral', 'topic', '积分', ['math1', 'math2', 'math3'], 'module:math:calculus'),
  node('topic:math:linear:matrix', 'topic', '矩阵', ['math1', 'math2', 'math3'], 'module:math:linear'),
  node('topic:math:linear:eigen', 'topic', '特征值与特征向量', ['math1', 'math2', 'math3'], 'module:math:linear'),
  node('topic:math:probability:distribution', 'topic', '随机变量分布', ['math1', 'math3'], 'module:math:probability')
];

const MICRO_NODES = [
  node(
    'micro:politics:dialectics:contradiction',
    'micro',
    '矛盾普遍性与特殊性',
    ['politics'],
    'topic:politics:marxism:dialectics'
  ),
  node(
    'micro:politics:epistemology:practice',
    'micro',
    '实践与认识关系',
    ['politics'],
    'topic:politics:marxism:epistemology'
  ),
  node(
    'micro:english:reading:attitude-turning',
    'micro',
    '转折词判断态度',
    ['english1', 'english2'],
    'topic:english:reading:attitude'
  ),
  node(
    'micro:english:reading:detail-locate',
    'micro',
    '同义改写定位',
    ['english1', 'english2'],
    'topic:english:reading:detail'
  ),
  node('micro:math:limit:squeeze', 'micro', '夹逼准则', ['math1', 'math2', 'math3'], 'topic:math:calculus:limit'),
  node(
    'micro:math:derivative:chain-rule',
    'micro',
    '复合函数求导',
    ['math1', 'math2', 'math3'],
    'topic:math:calculus:derivative'
  ),
  node('micro:math:integral:parts', 'micro', '分部积分', ['math1', 'math2', 'math3'], 'topic:math:calculus:integral'),
  node('micro:math:linear:eigen-basic', 'micro', '特征方程', ['math1', 'math2', 'math3'], 'topic:math:linear:eigen')
];

export const KNOWLEDGE_NODES = [...SUBJECT_NODES, ...TRACK_NODES, ...MODULE_NODES, ...TOPIC_NODES, ...MICRO_NODES];

export const KNOWLEDGE_EDGES = KNOWLEDGE_NODES.filter((item) => item.parentId).map((item) => ({
  id: `${item.parentId}->${item.id}`,
  source: item.parentId,
  target: item.id,
  relation: 'contains'
}));

const NODE_BY_ID = new Map(KNOWLEDGE_NODES.map((item) => [item.id, item]));

const QUESTION_MATCHERS = [
  [/(矛盾|辩证法|联系|发展|量变|质变)/, 'topic:politics:marxism:dialectics'],
  [/(实践|认识|真理|感性|理性)/, 'topic:politics:marxism:epistemology'],
  [/(人民|社会存在|社会意识|历史|群众)/, 'topic:politics:marxism:history'],
  [/(attitude|态度|tone|转折|however|but)/i, 'topic:english:reading:attitude'],
  [/(infer|inferred|推断|imply|suggest)/i, 'topic:english:reading:inference'],
  [/(main idea|best title|主旨|标题)/i, 'topic:english:reading:main-idea'],
  [/(极限|lim|squeeze|夹逼)/i, 'topic:math:calculus:limit'],
  [/(导数|微分|derivative|f'|求导)/i, 'topic:math:calculus:derivative'],
  [/(积分|integral|∫)/i, 'topic:math:calculus:integral'],
  [/(矩阵|matrix|det|行列式)/i, 'topic:math:linear:matrix'],
  [/(特征值|特征向量|eigen)/i, 'topic:math:linear:eigen'],
  [/(概率|随机变量|分布|正态|泊松|variance|expectation)/i, 'topic:math:probability:distribution']
];

function node(id, type, label, tracks, parentId = '') {
  return { id, type, label, tracks, parentId };
}

function normalizeTracks(profile = {}) {
  const rawTracks = profile.tracks || profile.enabledTracks || profile.publicCourses || [];
  if (Array.isArray(rawTracks) && rawTracks.length > 0) return rawTracks;
  if (profile.track) return [profile.track];
  return PUBLIC_COURSE_TRACKS.map((track) => track.id);
}

function intersects(a = [], b = []) {
  return a.some((item) => b.includes(item));
}

export function buildKnowledgeGraph(profile = {}) {
  const tracks = normalizeTracks(profile);
  const included = new Set();

  for (const item of KNOWLEDGE_NODES) {
    if (intersects(item.tracks, tracks)) {
      let current = item;
      while (current) {
        included.add(current.id);
        current = NODE_BY_ID.get(current.parentId);
      }
    }
  }

  const nodes = KNOWLEDGE_NODES.filter((item) => included.has(item.id));
  const edges = KNOWLEDGE_EDGES.filter((edge) => included.has(edge.source) && included.has(edge.target));
  return { version: KNOWLEDGE_GRAPH_VERSION, tracks, nodes, edges };
}

export function resolveQuestionKnowledge(question = {}, profile = {}) {
  let explicit = [];
  if (Array.isArray(question.knowledgeNodeIds)) {
    explicit = question.knowledgeNodeIds;
  } else if (Array.isArray(question.knowledge_points)) {
    explicit = question.knowledge_points;
  }
  const explicitMatches = explicit.filter((id) => NODE_BY_ID.has(id));
  if (explicitMatches.length > 0) return explicitMatches;

  const graph = buildKnowledgeGraph(profile);
  const available = new Set(graph.nodes.map((item) => item.id));
  const text = [
    question.subject,
    question.category,
    question.knowledge_point,
    question.question,
    question.stem,
    question.analysis,
    question.explanation
  ]
    .filter(Boolean)
    .join(' ');

  for (const [pattern, nodeId] of QUESTION_MATCHERS) {
    if (pattern.test(text) && available.has(nodeId)) return [nodeId];
  }

  if (/政治/.test(text) && available.has('track:politics')) return ['track:politics'];
  if (/英语|english/i.test(text) && available.has('subject:english')) return ['subject:english'];
  if (/数学|高数|线代|概率/.test(text) && available.has('subject:math')) return ['subject:math'];
  return [];
}

export function getKnowledgeNodeTrail(nodeId) {
  const trail = [];
  let current = NODE_BY_ID.get(nodeId);
  const guard = new Set();

  while (current && !guard.has(current.id)) {
    trail.unshift(current);
    guard.add(current.id);
    current = NODE_BY_ID.get(current.parentId);
  }

  return trail;
}

export function deriveKnowledgeVisualState(stats = {}) {
  const attempts = Number(stats.attempts || 0);
  const correct = Number(stats.correct || 0);
  const streak = Number(stats.streak || 0);
  const lastCorrect = stats.lastCorrect;

  if (attempts <= 0) return { state: 'unknown', color: KNOWLEDGE_STATE_COLORS.unknown, mastery: 0 };

  const accuracy = correct / attempts;
  const mastery = Math.round(Math.min(1, Math.max(0, accuracy)) * 100);

  if (lastCorrect === false) return { state: 'weak', color: KNOWLEDGE_STATE_COLORS.weak, mastery };
  if (accuracy >= 0.9 && streak >= 2) return { state: 'strong', color: KNOWLEDGE_STATE_COLORS.strong, mastery };
  if (accuracy >= 0.9) return { state: 'primed', color: KNOWLEDGE_STATE_COLORS.primed, mastery };
  if (accuracy >= 0.65) return { state: 'watch', color: KNOWLEDGE_STATE_COLORS.watch, mastery };
  return { state: 'weak', color: KNOWLEDGE_STATE_COLORS.weak, mastery };
}

function average(values = []) {
  const normalized = values.map((value) => Number(value || 0)).filter((value) => Number.isFinite(value));
  if (!normalized.length) return 0;
  return Math.round(normalized.reduce((sum, value) => sum + value, 0) / normalized.length);
}

function knowledgeSortWeight(item) {
  const stateWeight = {
    weak: 0,
    watch: 1,
    primed: 2,
    strong: 3,
    unknown: 4
  };
  return [stateWeight[item.state] ?? 5, item.accuracy, -item.attempts, item.avgSpeedScore, item.label];
}

function compareKnowledgeInsight(a, b) {
  const aw = knowledgeSortWeight(a);
  const bw = knowledgeSortWeight(b);
  for (let index = 0; index < aw.length; index += 1) {
    if (aw[index] < bw[index]) return -1;
    if (aw[index] > bw[index]) return 1;
  }
  return 0;
}

export function buildSessionKnowledgeInsights(questions = [], answeredQuestions = [], profile = {}) {
  const byNode = new Map();

  answeredQuestions.forEach((answer, fallbackIndex) => {
    if (answer.isCorrect === null || typeof answer.isCorrect === 'undefined') return;

    const question = questions[answer.index ?? fallbackIndex];
    if (!question) return;

    const nodeIds = resolveQuestionKnowledge(question, profile);
    nodeIds.forEach((nodeId) => {
      const current = byNode.get(nodeId) || {
        nodeId,
        attempts: 0,
        correct: 0,
        wrong: 0,
        totalTimeMs: 0,
        speedScores: [],
        lastCorrect: undefined,
        streak: 0
      };
      const isCorrect = Boolean(answer.isCorrect);
      current.attempts += 1;
      current.correct += isCorrect ? 1 : 0;
      current.wrong += isCorrect ? 0 : 1;
      current.totalTimeMs += Number(answer.timeSpent || answer.timeSpentMs || 0);
      current.lastCorrect = isCorrect;
      current.streak = isCorrect ? current.streak + 1 : 0;
      if (Number.isFinite(Number(answer.speedScore))) current.speedScores.push(Number(answer.speedScore));
      byNode.set(nodeId, current);
    });
  });

  const nodes = Array.from(byNode.values())
    .map((stats) => {
      const nodeMeta = NODE_BY_ID.get(stats.nodeId);
      const visual = deriveKnowledgeVisualState(stats);
      const trail = getKnowledgeNodeTrail(stats.nodeId);
      const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;

      return {
        nodeId: stats.nodeId,
        label: nodeMeta?.label || stats.nodeId,
        type: nodeMeta?.type || 'unknown',
        trail: trail.map((item) => ({ id: item.id, label: item.label, type: item.type })),
        chainText: trail.map((item) => item.label).join(' / '),
        attempts: stats.attempts,
        correct: stats.correct,
        wrong: stats.wrong,
        accuracy,
        avgSpeedScore: average(stats.speedScores),
        avgTimeMs: stats.attempts ? Math.round(stats.totalTimeMs / stats.attempts) : 0,
        state: visual.state,
        color: visual.color,
        mastery: visual.mastery
      };
    })
    .sort(compareKnowledgeInsight);

  const attemptedNodes = nodes.length;
  const weakNodes = nodes.filter((item) => item.state === 'weak').length;
  const strongNodes = nodes.filter((item) => item.state === 'strong').length;
  const averageMastery = attemptedNodes ? average(nodes.map((item) => item.mastery)) : 0;

  return {
    summary: {
      answerCount: answeredQuestions.length,
      attemptedNodes,
      weakNodes,
      strongNodes,
      averageMastery
    },
    nodes,
    focusNodes: nodes.slice(0, 3),
    headline: attemptedNodes ? `定位到 ${attemptedNodes} 个知识点，${weakNodes} 个薄弱链路` : '本组题暂未定位到知识链路'
  };
}
