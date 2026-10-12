/**
 * 公共课知识神经图谱种子配置。
 *
 * 这里存放可在小程序端安全使用的轻量图谱；完整 3D 图谱由后端根据同一
 * node id 体系扩展。节点命名不包含机构或老师信息，避免资料来源泄露。
 */

export const KNOWLEDGE_GRAPH_VERSION = '2026.05-knowledge-system-v2';

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

const PROFESSIONAL_TRACKS = [
  { id: 'law_illegal', subject: 'professional', code: '398/498', label: '法律非法学' }
];

const LAW_ILLEGAL_PROFILE_PATTERN = /法律|非法学|法硕|法学/;
const LAW_ILLEGAL_TRACKS = ['english1', 'politics', 'law_illegal'];

const SUBJECT_NODES = [
  node('subject:politics', 'subject', '考研政治', ['politics']),
  node('subject:english', 'subject', '考研英语', ['english1', 'english2']),
  node('subject:math', 'subject', '考研数学', ['math1', 'math2', 'math3']),
  node('subject:law_illegal', 'subject', '专业课', ['law_illegal'])
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
  node('module:english:grammar', 'module', '语言基础', ['english1', 'english2'], 'subject:english'),

  node('module:math:calculus', 'module', '高等数学', ['math1', 'math2', 'math3'], 'subject:math'),
  node('module:math:linear', 'module', '线性代数', ['math1', 'math2', 'math3'], 'subject:math'),
  node('module:math:probability', 'module', '概率统计', ['math1', 'math3'], 'subject:math'),

  node('module:law:jurisprudence', 'module', '法理学', ['law_illegal'], 'subject:law_illegal'),
  node('module:law:constitution', 'module', '宪法学', ['law_illegal'], 'subject:law_illegal'),
  node('module:law:civil', 'module', '民法学', ['law_illegal'], 'subject:law_illegal'),
  node('module:law:criminal', 'module', '刑法学', ['law_illegal'], 'subject:law_illegal'),
  node('module:law:history', 'module', '法制史', ['law_illegal'], 'subject:law_illegal')
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
  node('topic:english:grammar:long-sentence', 'topic', '长难句', ['english1', 'english2'], 'module:english:grammar'),
  node('topic:english:grammar:tense', 'topic', '时态', ['english1', 'english2'], 'module:english:grammar'),
  node('topic:english:grammar:clause', 'topic', '从句', ['english1', 'english2'], 'module:english:grammar'),
  node('topic:english:translation:syntax', 'topic', '句法拆解', ['english1', 'english2'], 'module:english:translation'),
  node('topic:english:writing:argument', 'topic', '论证展开', ['english1', 'english2'], 'module:english:writing'),

  node('topic:math:calculus:limit', 'topic', '极限', ['math1', 'math2', 'math3'], 'module:math:calculus'),
  node('topic:math:calculus:derivative', 'topic', '导数与微分', ['math1', 'math2', 'math3'], 'module:math:calculus'),
  node('topic:math:calculus:integral', 'topic', '积分', ['math1', 'math2', 'math3'], 'module:math:calculus'),
  node('topic:math:linear:matrix', 'topic', '矩阵', ['math1', 'math2', 'math3'], 'module:math:linear'),
  node('topic:math:linear:eigen', 'topic', '特征值与特征向量', ['math1', 'math2', 'math3'], 'module:math:linear'),
  node('topic:math:probability:distribution', 'topic', '随机变量分布', ['math1', 'math3'], 'module:math:probability'),

  node('topic:law:jurisprudence:rule', 'topic', '法律规则', ['law_illegal'], 'module:law:jurisprudence'),
  node('topic:law:jurisprudence:relation', 'topic', '法律关系', ['law_illegal'], 'module:law:jurisprudence'),
  node('topic:law:constitution:citizen', 'topic', '公民基本权利', ['law_illegal'], 'module:law:constitution'),
  node('topic:law:civil:contract', 'topic', '合同', ['law_illegal'], 'module:law:civil'),
  node('topic:law:civil:tort', 'topic', '侵权责任', ['law_illegal'], 'module:law:civil'),
  node('topic:law:criminal:crime', 'topic', '犯罪构成', ['law_illegal'], 'module:law:criminal'),
  node('topic:law:criminal:punishment', 'topic', '刑罚', ['law_illegal'], 'module:law:criminal'),
  node('topic:law:history:system', 'topic', '法律制度演进', ['law_illegal'], 'module:law:history')
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
  node(
    'micro:english:grammar:present-continuous',
    'micro',
    '现在进行时',
    ['english1', 'english2'],
    'topic:english:grammar:tense'
  ),
  node(
    'micro:english:grammar:past-perfect',
    'micro',
    '过去完成时',
    ['english1', 'english2'],
    'topic:english:grammar:tense'
  ),
  node(
    'micro:english:grammar:attributive-clause',
    'micro',
    '定语从句',
    ['english1', 'english2'],
    'topic:english:grammar:clause'
  ),
  node(
    'micro:english:grammar:adverbial-clause',
    'micro',
    '状语从句',
    ['english1', 'english2'],
    'topic:english:grammar:clause'
  ),
  node(
    'micro:english:long-sentence:modifier',
    'micro',
    '修饰成分拆解',
    ['english1', 'english2'],
    'topic:english:grammar:long-sentence'
  ),
  node(
    'micro:english:translation:predicate',
    'micro',
    '谓语定位',
    ['english1', 'english2'],
    'topic:english:translation:syntax'
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
  node('micro:math:linear:eigen-basic', 'micro', '特征方程', ['math1', 'math2', 'math3'], 'topic:math:linear:eigen'),

  node('micro:law:rule:logic', 'micro', '规则三要素', ['law_illegal'], 'topic:law:jurisprudence:rule'),
  node('micro:law:rule:validity', 'micro', '法律效力', ['law_illegal'], 'topic:law:jurisprudence:rule'),
  node('micro:law:relation:subject', 'micro', '法律关系主体', ['law_illegal'], 'topic:law:jurisprudence:relation'),
  node('micro:law:constitution:rights', 'micro', '平等权', ['law_illegal'], 'topic:law:constitution:citizen'),
  node('micro:law:contract:formation', 'micro', '合同成立', ['law_illegal'], 'topic:law:civil:contract'),
  node('micro:law:contract:breach', 'micro', '违约责任', ['law_illegal'], 'topic:law:civil:contract'),
  node('micro:law:tort:liability', 'micro', '过错责任', ['law_illegal'], 'topic:law:civil:tort'),
  node('micro:law:crime:elements', 'micro', '犯罪客体', ['law_illegal'], 'topic:law:criminal:crime'),
  node('micro:law:crime:intent', 'micro', '犯罪故意', ['law_illegal'], 'topic:law:criminal:crime'),
  node('micro:law:punishment:sentencing', 'micro', '量刑情节', ['law_illegal'], 'topic:law:criminal:punishment'),
  node('micro:law:history:tang-code', 'micro', '唐律疏议', ['law_illegal'], 'topic:law:history:system')
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
  [/(现在进行时|present continuous|is\/am\/are\s+\w+ing)/i, 'micro:english:grammar:present-continuous'],
  [/(过去完成时|past perfect|had\s+\w+ed|had\s+been)/i, 'micro:english:grammar:past-perfect'],
  [/(定语从句|attributive clause|relative clause|关系代词|which\s*引导|that\s*引导|who\s*引导)/i, 'micro:english:grammar:attributive-clause'],
  [/(状语从句|adverbial clause|although|because|when|while)/i, 'micro:english:grammar:adverbial-clause'],
  [/(长难句|主干|修饰成分|modifier|sentence structure)/i, 'micro:english:long-sentence:modifier'],
  [/(谓语|predicate|主谓宾|句法拆解)/i, 'micro:english:translation:predicate'],
  [/(法律规则|规则三要素|假定条件|行为模式|法律后果)/, 'micro:law:rule:logic'],
  [/(法律效力|效力等级|溯及力)/, 'micro:law:rule:validity'],
  [/(法律关系主体|权利能力|行为能力)/, 'micro:law:relation:subject'],
  [/(平等权|公民基本权利|宪法权利)/, 'micro:law:constitution:rights'],
  [/(合同成立|要约|承诺)/, 'micro:law:contract:formation'],
  [/(违约责任|继续履行|损害赔偿)/, 'micro:law:contract:breach'],
  [/(过错责任|侵权责任|无过错责任)/, 'micro:law:tort:liability'],
  [/(犯罪客体|犯罪构成|客观方面|主观方面)/, 'micro:law:crime:elements'],
  [/(犯罪故意|犯罪过失|认识因素|意志因素)/, 'micro:law:crime:intent'],
  [/(量刑|自首|立功|累犯)/, 'micro:law:punishment:sentencing'],
  [/(唐律疏议|中华法系|法制史)/, 'micro:law:history:tang-code'],
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

export function normalizeKnowledgeTracks(profile = {}) {
  const rawTracks = profile.tracks || profile.enabledTracks || profile.publicCourses || [];
  const explicitTracks =
    Array.isArray(rawTracks) && rawTracks.length > 0 ? [...rawTracks] : profile.track ? [profile.track] : [];
  const majorText = [profile.major, profile.targetMajor, profile.examTrack].filter(Boolean).join(' ');
  if (LAW_ILLEGAL_PROFILE_PATTERN.test(majorText) || explicitTracks.includes('law_illegal')) {
    return [...LAW_ILLEGAL_TRACKS];
  }
  const tracks = explicitTracks.length > 0 ? explicitTracks : PUBLIC_COURSE_TRACKS.map((track) => track.id);
  return Array.from(new Set(tracks));
}

function intersects(a = [], b = []) {
  return a.some((item) => b.includes(item));
}

export function buildKnowledgeGraph(profile = {}) {
  const tracks = normalizeKnowledgeTracks(profile);
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
  const explicitMatches = explicit
    .map((value) => {
      if (NODE_BY_ID.has(value)) return value;
      const labelMatch = KNOWLEDGE_NODES.find((nodeItem) => nodeItem.label === value);
      return labelMatch?.id || '';
    })
    .filter(Boolean);
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
  if (/法律|法理|宪法|民法|刑法|法制史/.test(text) && available.has('subject:law_illegal')) {
    return ['subject:law_illegal'];
  }
  return [];
}

export function getKnowledgeTrackMeta(trackId) {
  return [...PUBLIC_COURSE_TRACKS, ...PROFESSIONAL_TRACKS].find((track) => track.id === trackId) || null;
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
