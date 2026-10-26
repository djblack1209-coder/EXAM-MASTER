// Offline foundation only. Nothing imports this module into the teaching flow or client bundle.
import { WRITING_BAND_NULL_REASONS, writingBandRubric } from './learning-rubric.js';
export {
  WRITING_BAND_NULL_REASONS,
  WRITING_BAND_RESULT_CONTRACT,
  normalizeWritingBandResult
} from './learning-rubric.js';

export const WRITING_RUBRICS_CONTRACT = 'writing-rubrics-foundation-v1';
export const WRITING_SCORE_NOTICE = 'AI 评估，不是官方分数';

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const englishSource = {
  kind: 'publisher_transcription',
  title: '考研英语写作高分速成 · 第一章 · 表1.1',
  publisher: '清华大学出版社',
  url: 'https://www.tup.tsinghua.edu.cn/upload/books/yz/103886-02.pdf',
  version: '出版社试读文件103886-02；正文提及2023大纲；版次/出版年未核实',
  location: 'PDF物理页2–3：结构、评分原则及五档表',
  checkedAt: '2026-10-22',
  officialOriginalVerified: false,
  note: '仅转录分值区间，描述由项目归纳；不是考试院原文。当前考试年份的大纲及题面仍待核对。'
};
const chineseSource = {
  kind: 'third_party_transcription',
  title: '成都市2019级高中毕业班第三次诊断性检测 · 语文参考答案及评分意见',
  publisher: 'jhgk.cn所载试卷副本',
  url: 'https://www.jhgk.cn/upload/file/20220509/1652076774591008712.pdf',
  version: '2019级三诊；文件路径2022-05-09；非当年高考官方细则',
  location: 'PDF物理页3：60分作文等级表及说明',
  checkedAt: '2026-10-22',
  officialOriginalVerified: false,
  note: '仅转录20+20+20及四档范围，教学描述为项目归纳；不能外推到所有地区/年份。'
};

export const WRITING_ANTI_LENGTH_POLICY = freeze({
  contract: 'writing-no-length-bonus-v1',
  status: 'policy_only_semantic_resistance_unverified',
  lengthBonus: 0,
  unknownScore: null,
  rules: [
    { id: 'no-new-content', text: '无新增有效内容，不得仅因字数增长、重复或套话而加分。' },
    { id: 'facts-not-offset', text: '事实错误、捏造数据及与材料矛盾，不得被篇幅或华丽词汇抵消。' },
    { id: 'task-not-offset', text: '任务缺失、离题或交际目的未完成，不得被篇幅抵消。' },
    { id: 'evidence-first', text: '分数须定位当前原答及对应题目要求；重复证据不重复计分。' },
    { id: 'unknown-null', text: '无法判断、题面或图表冲突、缺少关键依据时，相应分数及总分保持null。' },
    { id: 'task-length-only', text: '长度仅用于核对该题明示要求；不臆造每词扣分，不自动奖励长文。' }
  ],
  requiredPairChecks: ['无信息扩写', '重复堆砌', '离题长文', '华丽词汇但任务缺失', '材料矛盾或捏造数据', '短但完整']
});

const evidence = {
  binding: ['taskId', 'taskVersion', 'attemptId', 'answerHash', 'rubricId', 'rubricVersion'],
  quote: '逐字原答及UTF-16起止范围，绑定具体维度和题目要求；引用本身不证明语义判断正确。',
  missingTask: '缺失要点列明任务编号与覆盖检查；不能为缺失内容编造原答引文。',
  unknownScore: null,
  totalWhenAnyComponentUnknown: null,
  handwriting: '仅有文本时书写表现为null，不猜测卷面，也不因此自动扣分。'
};

const englishEvidence = {
  binding: evidence.binding,
  quote: evidence.quote,
  missingTask: evidence.missingTask,
  unknownScore: null,
  totalWhenAnyComponentUnknown: null,
  nullReasons: WRITING_BAND_NULL_REASONS
};
const englishAntiLength = {
  ...WRITING_ANTI_LENGTH_POLICY,
  rules: WRITING_ANTI_LENGTH_POLICY.rules.map((rule) =>
    rule.id === 'unknown-null'
      ? {
          ...rule,
          text: 'null只限题面数据缺失、题面数据冲突、模型输出无效或证据无效；原答短、差、离题或与题面数据矛盾不能据此弃权。'
        }
      : rule
  )
};
const compatibility = {
  legacyContract: 'subjective-rubric-v1/v2',
  adapter: null,
  automaticConversion: false,
  note: '保留原0–30分/最多6维/半分合同；本骨架不迁移历史记录、不接工具或模型。',
  coachDimensions: { role: 'auxiliary_only', names: ['语法', '搭配', '表达', '任务完成'], scoreConversion: null }
};

// Five observations, not five independently awarded official subscores.
const englishDimensions = [
  [
    'content',
    '内容要点',
    [
      '主体信息大多缺失或偏离任务',
      '要点有明显遗漏，夹杂无关信息',
      '主要要点可找到，部分展开不足',
      '任务要点齐备，少数细节尚可展开',
      '各要点准确、充分，信息与题面一致'
    ],
    '逐项对应题干任务；涉及图表须核对对象、单位、趋势和数值。'
  ],
  [
    'language',
    '语言',
    [
      '错误密集，难以还原意思',
      '词句选择受限，错误妨碍理解',
      '基本能表达，错误尚不阻断主要意思',
      '用词和结构较灵活，局部错误不妨碍理解',
      '词句选择服务于任务，表达准确而自然'
    ],
    '引用完整句并说明错误或准确用法的作用；不按生僻词数量加分。'
  ],
  [
    'cohesion',
    '衔接连贯',
    [
      '信息散乱，关系难辨',
      '段句关系跳跃，组织不足',
      '可跟随基本顺序，衔接较简单',
      '段落目的明确，信息关系较顺畅',
      '段句推进自然，指代和逻辑关系清楚'
    ],
    '引用相邻句/段，标出顺序、指代或因果；连接词数量不是证据。'
  ],
  [
    'register',
    '文体语体',
    [
      '无法辨认所需文体或对象',
      '格式、称呼或语气明显失当',
      '基本符合文体和对象，仍有局部不妥',
      '格式及语气较适合对象和情境',
      '文体要素齐全，语气与对象、目的相称'
    ],
    '按具体题目核查信件/通知/短文要素；不强制所有作文三段。'
  ],
  [
    'reader',
    '读者效果',
    [
      '读者无法识别主要信息',
      '读者仍缺关键行动或结论信息',
      '主要目的可理解，部分信息需猜测',
      '读者可理解目的并作出预期回应',
      '读者能清楚获得全部必要信息和合理回应路径'
    ],
    '将读者所需信息与原答对照，不以模型声称“感染力强”充当依据。'
  ]
];

function englishRubric(section, maxScore, priorities, exam = 2) {
  const identity = writingBandRubric(`english${exam}`, section === 'B' ? 'large' : 'small');
  const id = identity.id;
  const dimensions = englishDimensions.map(([key, name, descriptions, requiredEvidence], index) => ({
    id: key,
    name,
    focusPriority: priorities[index],
    priorityAuthority: 'project_provisional',
    bands: descriptions.map((description, i) => ({ level: i + 1, description })),
    evidence: requiredEvidence
  }));
  const ranges =
    section === 'A'
      ? [
          [1, 2],
          [3, 4],
          [5, 6],
          [7, 8],
          [9, 10]
        ]
      : [
          [1, 3],
          [4, 6],
          [7, 9],
          [10, 12],
          [13, 15]
        ];
  const points = dimensions.map((d) => ({
    id: `${id}:${d.id}`,
    dimensionId: d.id,
    title: d.name,
    explanation: d.evidence,
    award: '整体分档的观察点，非官方独立分值，不重复加分。'
  }));
  const prompts =
    section === 'A'
      ? [
          '原创情境：邀请同学周五到阅览室参加读书会，并请周三前回复。列出三项要求，各写一句对应信息。',
          '改正并说明：The list of activities are ready. 再写一句意思相同的正确表达，不堆叠高级词。',
          '把“邀请目的、活动安排、回复请求”排成合理顺序，各写一句，指出相邻两句的关系。',
          '同一邀请分别写给好友和首次联系的老师：各写称呼、请求句与结束语，并说明语气差别。',
          '检查“Please join our event.”缺了哪些行动信息；按周五、阅览室、周三前回复补全，不能另造时间。'
        ]
      : exam === 1
        ? [
            '原创画面要点：两位同学一起整理阅览室，其中一人扶稳书架，另一人摆放书籍。分别写出画面事实和有边界的解释，不虚构人物身份。',
            '改正并说明：Two students is arranging books. 用准确句子描述合作动作，不添加画面没有提供的结果。',
            '先写画面中的合作动作，再解释可能体现的意义，明确区分画面事实和个人观点。',
            '将口语化的画面评论改为适合说明性短文的表述，不增加信件称呼或署名。',
            '给没有看过画面的读者交代两人的动作，再写一句有依据的评论；不能编造画面外的事实。'
          ]
        : [
            '合成图表：读书会参加人数2023年20人、2024年30人。写两句描述变化并提出一个有边界的解释，保留年份与单位。',
            '改正并解释：The number of participants have increased. 用准确句子描述20人到30人的变化，不把50%写成50人。',
            '写三句短文：先描述20人到30人的变化，再提出可能原因，最后说明仅两年数据不能证明因果。',
            '把“Hey, numbers are crazy!”改为适合说明性短文的一句描述，保留数据含义，不添加信件格式。',
            '给没见过图表的读者写两句，交代对象、年份和变化；区分已给事实与可能解释。'
          ];
  return {
    contract: WRITING_RUBRICS_CONTRACT,
    id,
    version: 1,
    status: 'draft_unreviewed',
    subject: `考研英语${exam === 1 ? '一' : '二'}写作`,
    section,
    maxScore,
    notice: WRITING_SCORE_NOTICE,
    source:
      exam === 2
        ? englishSource
        : {
            kind: 'unverified',
            title: `考研英语一写作${section}原始依据待核对`,
            publisher: null,
            url: null,
            version: 'unverified',
            location: null,
            checkedAt: null,
            officialOriginalVerified: false,
            note: '未取得并核实一手原件，不借用英语二的分值区间；只保留项目观察结构。'
          },
    sourceTier: identity.sourceTier,
    evidence: englishEvidence,
    antiLength: englishAntiLength,
    compatibility,
    scoring: {
      mode: 'holistic_band',
      step: 1,
      focusUse: '任务点缺失优先；默认序号仅作同等证据下的教学顺序，不计算分数。',
      display: 'observation_only',
      scoreBands:
        maxScore === null
          ? null
          : [
              {
                level: 0,
                min: 0,
                max: 0,
                description: '空白提交为确定性零；没有任务相关表达的零档候选须复核，不能因原答短或差而弃权。'
              },
              ...ranges.map(([min, max], i) => ({
                level: i + 1,
                min,
                max,
                description: `综合对照五项观察的第${i + 1}档。`
              }))
            ]
    },
    dimensions,
    scorePoints: points,
    microExercises: points.map((p, i) => ({
      id: `${p.id}:micro-1`,
      pointId: p.id,
      provenance: 'project_original_synthetic',
      minutes: 3,
      prompt: prompts[i],
      acceptance: [dimensions[i].evidence, '只核对本练习目标；不换算为考试分数。'],
      status: 'unreviewed_not_connected'
    }))
  };
}

const chineseRanges = [
  [0, 5],
  [6, 10],
  [11, 15],
  [16, 20]
];
const chineseBands = (descriptions) =>
  chineseRanges.map(([min, max], i) => ({
    level: 4 - i,
    min,
    max,
    description: descriptions[i]
  }));
const chinesePoints = [
  [
    'content',
    '审题与材料',
    '把题目任务、中心与具体材料对应起来，材料事实可核对。',
    '原创任务：学校是否应保留午休讨论区？写一句立场、一条支持理由和适用条件；不把一天观察推广到全校。'
  ],
  [
    'expression',
    '结构与表达',
    '段落各有作用，句子清楚，文体与任务相合；无图像不评字迹。',
    '将“观点、理由、具体例子、限制”排成一段，删去一处重复，并解释为什么删除不损失信息。'
  ],
  [
    'development',
    '深刻',
    '说明现象背后的关系或条件，推论不超过材料。',
    '从“讨论区有噪声”写出原因、对策和对策的适用边界，区分事实与推测。',
    'depth'
  ],
  [
    'development',
    '丰富',
    '补充承担不同论证作用的细节或材料，不把同义重复算丰富。',
    '为同一立场写一条支持情境与一条反例，解释它们各承担什么作用，不杜撰调查数字。',
    'richness'
  ],
  [
    'development',
    '有文采',
    '准确鲜明的词句服务于意思与情境，不按辞藻数量给分。',
    '把“那里很好很好”改成一个可感的具体场景，保留原意；说明一个词或句式的作用。',
    'style'
  ],
  [
    'development',
    '有创意',
    '有根据的新角度、结构或推理，允许独到而合理的表达。',
    '针对“安静区与讨论区只能二选一”提出一种不同安排，写出理由与可能失效的条件。',
    'originality'
  ]
];
const chineseId = 'gaokao-chinese-60-foundation-v1';
const chineseRubric = {
  contract: WRITING_RUBRICS_CONTRACT,
  id: chineseId,
  version: 1,
  status: 'draft_unreviewed',
  subject: '高考语文作文60分量规候选',
  maxScore: 60,
  notice: WRITING_SCORE_NOTICE,
  source: chineseSource,
  evidence,
  antiLength: WRITING_ANTI_LENGTH_POLICY,
  compatibility,
  applicability: { region: null, examYear: null, currentOfficialRulesVerified: false },
  scoring: {
    mode: 'component_bands',
    step: 1,
    baseMaxScore: 40,
    developmentMaxScore: 20,
    totalBands: null,
    weightUse: '三项各20分，占总分各1/3；发展特征不拆成四项各5分。',
    deductions: null,
    deductionNote: '缺标题、字数、抄袭等须绑定具体地区/年份细则；骨架不自动扣分。'
  },
  dimensions: [
    {
      id: 'content',
      name: '内容',
      group: 'base',
      maxScore: 20,
      weight: 1 / 3,
      evidence: chinesePoints[0][2],
      bands: chineseBands([
        '任务对应薄弱，中心难辨，材料不足或失当',
        '大体回应任务，有中心但支撑较单薄',
        '回应任务，中心清楚，有相关材料支撑',
        '紧扣材料与任务，中心鲜明，支撑具体而可信'
      ])
    },
    {
      id: 'expression',
      name: '表达',
      group: 'base',
      maxScore: 20,
      weight: 1 / 3,
      evidence: chinesePoints[1][2],
      bands: chineseBands([
        '文体与任务不合，结构或语句妨碍理解',
        '有基本结构，语言大体可理解但衔接不足',
        '文体合宜，结构完整，语言通顺',
        '组织严密而自然，表达流畅、准确，文体服务任务'
      ])
    },
    {
      id: 'development',
      name: '发展等级',
      group: 'development',
      maxScore: 20,
      weight: 1 / 3,
      evidence: '定位突出特征及作用，整体给发展等级分；不要求四项齐备，不按字数或素材个数累加。',
      aggregation: 'holistic_not_sum_of_facets',
      facets: chinesePoints
        .slice(2)
        .map((p) => ({ id: p[4], name: p[1], evidence: p[2], maxScore: null, weight: null })),
      bands: chineseBands([
        '仅有零星有价值的表达或思考，尚未形成突出特征',
        '可见局部思考、细节或表达特色',
        '部分特征较突出，并对中心或表达有效',
        '有经证据支持的突出特征，思考或表达形成鲜明价值'
      ])
    }
  ],
  scorePoints: chinesePoints.map(([dimensionId, title, explanation, , facetId], i) => ({
    id: `${chineseId}:point-${i + 1}`,
    dimensionId,
    ...(facetId ? { facetId } : {}),
    title,
    explanation,
    award:
      dimensionId === 'development' ? '发展等级整体20分的观察入口，不设单项5分。' : '对应基础等级20分项，不另设奖励。'
  })),
  microExercises: chinesePoints.map((p, i) => ({
    id: `${chineseId}:micro-${i + 1}`,
    pointId: `${chineseId}:point-${i + 1}`,
    provenance: 'project_original_synthetic',
    minutes: 3,
    prompt: p[3],
    acceptance: [p[2], '定位当前练习依据；不冒充已评分高考作文。'],
    status: 'unreviewed_not_connected'
  }))
};

export const WRITING_RUBRICS = freeze([
  englishRubric('A', 10, [1, 2, 3, 3, 4]),
  englishRubric('B', 15, [1, 2, 3, 4, 4]),
  chineseRubric,
  englishRubric('A', null, [1, 2, 3, 3, 4], 1),
  englishRubric('B', null, [1, 2, 3, 4, 4], 1)
]);

function requireValue(ok, message) {
  if (!ok) throw new Error(`WRITING_RUBRIC_INVALID: ${message}`);
}
const nonempty = (s) => typeof s === 'string' && s.trim().length > 0;
function checkBands(bands, maxScore) {
  requireValue(Array.isArray(bands) && bands.length > 0, 'bands');
  let next = 0;
  for (const b of [...bands].sort((a, b) => a.min - b.min)) {
    requireValue(
      Number.isInteger(b.min) && Number.isInteger(b.max) && b.min === next && b.max >= b.min && nonempty(b.description),
      'band coverage'
    );
    next = b.max + 1;
  }
  requireValue(next === maxScore + 1 && new Set(bands.map((b) => b.level)).size === bands.length, 'band range/level');
}

// Validates data integrity, never essay meaning or assessment authority.
export function validateWritingRubric(rubric) {
  requireValue(
    rubric?.contract === WRITING_RUBRICS_CONTRACT && rubric.version === 1 && nonempty(rubric.id),
    'identity'
  );
  requireValue(rubric.status === 'draft_unreviewed' && rubric.notice === WRITING_SCORE_NOTICE, 'authority');
  const unknownEnglish1 = /^kaoyan-english1-[ab]-foundation-v1$/.test(rubric.id);
  requireValue(
    nonempty(rubric.source?.version) &&
      (unknownEnglish1
        ? rubric.source.url === null && rubric.sourceTier === 'unverified'
        : nonempty(rubric.source?.url)) &&
      rubric.source.officialOriginalVerified === false,
    'source'
  );
  requireValue(
    unknownEnglish1 ? rubric.maxScore === null : Number.isInteger(rubric.maxScore) && rubric.maxScore > 0,
    'maxScore'
  );
  requireValue(rubric.scoring?.step === 1, 'integer score step');
  requireValue(Array.isArray(rubric.dimensions) && rubric.dimensions.length > 0, 'dimensions');
  requireValue(new Set(rubric.dimensions.map((d) => d.id)).size === rubric.dimensions.length, 'duplicate dimension');
  requireValue(
    rubric.dimensions.every((d) => nonempty(d.id) && nonempty(d.name) && nonempty(d.evidence)),
    'dimension fields'
  );
  if (rubric.scoring.mode === 'holistic_band') {
    requireValue(
      rubric.sourceTier === (unknownEnglish1 ? 'unverified' : 'secondary_unverified') &&
        rubric.scoring.display === 'observation_only',
      'unverified English scores must stay hidden'
    );
    requireValue(
      JSON.stringify(rubric.evidence.nullReasons) === JSON.stringify(WRITING_BAND_NULL_REASONS) &&
        !Object.hasOwn(rubric.evidence, 'handwriting'),
      'English null reasons'
    );
    if (unknownEnglish1) requireValue(rubric.scoring.scoreBands === null, 'unverified English1 bands');
    else {
      checkBands(rubric.scoring.scoreBands, rubric.maxScore);
      requireValue(rubric.scoring.scoreBands.length === 6, 'five bands plus zero');
    }
    for (const d of rubric.dimensions) {
      requireValue(
        Number.isInteger(d.focusPriority) &&
          d.focusPriority >= 1 &&
          d.focusPriority <= 5 &&
          d.priorityAuthority === 'project_provisional' &&
          !Object.hasOwn(d, 'weight') &&
          !Object.hasOwn(d, 'weightAuthority'),
        'provisional English focus priority'
      );
      requireValue(
        d.bands?.length === 5 && d.bands.every((b, i) => b.level === i + 1 && nonempty(b.description)),
        'dimension bands'
      );
    }
  } else {
    requireValue(rubric.scoring.mode === 'component_bands', 'scoring mode');
    requireValue(
      rubric.dimensions.every((d) => Number.isFinite(d.weight) && d.weight > 0) &&
        Math.abs(rubric.dimensions.reduce((n, d) => n + d.weight, 0) - 1) < 1e-10,
      'weights'
    );
    requireValue(rubric.dimensions.reduce((n, d) => n + d.maxScore, 0) === rubric.maxScore, 'component total');
    requireValue(
      rubric.dimensions.filter((d) => d.group === 'base').reduce((n, d) => n + d.maxScore, 0) ===
        rubric.scoring.baseMaxScore,
      'base total'
    );
    requireValue(
      rubric.dimensions.filter((d) => d.group === 'development').reduce((n, d) => n + d.maxScore, 0) ===
        rubric.scoring.developmentMaxScore,
      'development total'
    );
    for (const d of rubric.dimensions) checkBands(d.bands, d.maxScore);
    const development = rubric.dimensions.find((d) => d.group === 'development');
    requireValue(
      development?.aggregation === 'holistic_not_sum_of_facets' &&
        development.facets?.length === 4 &&
        development.facets.every((f) => f.weight === null && f.maxScore === null),
      'development facets'
    );
  }
  requireValue(
    rubric.antiLength?.lengthBonus === 0 &&
      rubric.antiLength.unknownScore === null &&
      rubric.evidence?.totalWhenAnyComponentUnknown === null,
    'length/unknown policy'
  );
  requireValue(
    rubric.antiLength.status === 'policy_only_semantic_resistance_unverified' &&
      WRITING_ANTI_LENGTH_POLICY.requiredPairChecks.every((pair) =>
        rubric.antiLength.requiredPairChecks?.includes(pair)
      ),
    'unverified pair-check policy'
  );
  requireValue(
    evidence.binding.every((key) => rubric.evidence.binding?.includes(key)) && rubric.evidence.unknownScore === null,
    'evidence binding/unknown'
  );
  requireValue(
    (rubric.scoring.mode === 'holistic_band' ? englishAntiLength : WRITING_ANTI_LENGTH_POLICY).rules.every((rule) =>
      rubric.antiLength.rules?.some((r) => r.id === rule.id && r.text === rule.text)
    ),
    'anti-length rules'
  );
  requireValue(
    Array.isArray(rubric.scorePoints) && rubric.scorePoints.length > 0 && Array.isArray(rubric.microExercises),
    'three-part set'
  );
  const ids = new Set(rubric.scorePoints.map((p) => p.id));
  requireValue(
    ids.size === rubric.scorePoints.length &&
      new Set(rubric.microExercises.map((e) => e.id)).size === rubric.microExercises.length,
    'duplicate point/exercise'
  );
  for (const p of rubric.scorePoints) {
    const dimension = rubric.dimensions.find((d) => d.id === p.dimensionId);
    requireValue(
      dimension &&
        nonempty(p.title) &&
        nonempty(p.explanation) &&
        (!p.facetId || dimension.facets?.some((f) => f.id === p.facetId)),
      'point'
    );
    requireValue(
      rubric.microExercises.some((e) => e.pointId === p.id),
      'point without exercise'
    );
  }
  requireValue(
    rubric.dimensions.every((d) => rubric.scorePoints.some((p) => p.dimensionId === d.id)),
    'dimension without point'
  );
  for (const d of rubric.dimensions) {
    if (d.facets) {
      requireValue(new Set(d.facets.map((f) => f.id)).size === d.facets.length, 'duplicate facet');
      requireValue(
        d.facets.every(
          (f) =>
            nonempty(f.id) &&
            nonempty(f.name) &&
            nonempty(f.evidence) &&
            rubric.scorePoints.some((p) => p.dimensionId === d.id && p.facetId === f.id)
        ),
        'facet without point'
      );
    }
  }
  for (const e of rubric.microExercises)
    requireValue(
      ids.has(e.pointId) &&
        nonempty(e.prompt) &&
        e.acceptance?.length > 0 &&
        e.acceptance.every(nonempty) &&
        e.provenance === 'project_original_synthetic',
      'exercise'
    );
  requireValue(
    rubric.compatibility?.automaticConversion === false && rubric.compatibility.adapter === null,
    'legacy isolation'
  );
  requireValue(
    rubric.compatibility.coachDimensions?.role === 'auxiliary_only' &&
      rubric.compatibility.coachDimensions.scoreConversion === null,
    'auxiliary coach dimensions'
  );
  return true;
}

// A range lookup for an already assigned integer score, not an essay scorer.
export function writingScoreBand(rubric, score, componentId) {
  validateWritingRubric(rubric);
  const component =
    rubric.scoring.mode === 'component_bands' ? rubric.dimensions.find((d) => d.id === componentId) : null;
  requireValue(rubric.scoring.mode === 'holistic_band' || component, 'component required; no total-band conversion');
  if (score === null) return null;
  const maximum = component?.maxScore ?? rubric.maxScore;
  requireValue(maximum !== null, 'unverified rubric has no numeric bands');
  requireValue(Number.isInteger(score) && score >= 0 && score <= maximum, 'score range');
  return (component?.bands || rubric.scoring.scoreBands).find((b) => score >= b.min && score <= b.max).level;
}
