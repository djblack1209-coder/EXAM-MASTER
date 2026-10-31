import { describe, it, expect } from 'vitest';
import {
  coachAssessmentTask,
  coachInferenceContext,
  coachSystemPrompt,
  normalizeCoachOutput,
  parseCoachModelOutput,
  COACH_EXERCISE_CONTRACT,
  COACH_SUMMARY_CONTRACT
} from '../../laf-backend/functions/_shared/learning-writing-coach.js';
import { mixedDiagnosticRequest, mixedDiagnosticReply } from '../fixtures/writing-mixed.js';
import {
  prepareCoachFeedbackModel,
  decodeCoachResponse,
  coachRepairFeedback,
  coachRepairPrompt,
  syntaxAgreement,
  outlineAgreement,
  verifyCoachErrors,
  calibrateCoachExercises
} from '../../laf-backend/functions/_shared/ai-providers/learning-provider.ts';
const base = {
  contract: 'kaoyan-writing-coach-v1',
  phase: 'feedback',
  target: 'card-c1',
  exam: 'english2',
  day: '2026-10-27',
  sources: [],
  feedbackVersion: 2,
  dimensionContract: 'writing-dimensions-v1'
};
const cloze = {
  ...base,
  input: 'to',
  task: '复习固定搭配“for the purpose of”表示目的。题目：完成句子，填入正确介词：The sale is ___ help kids in need.\n答题方式：选择题。选项：["for","of","to","in"]'
};
const syntax = {
  ...base,
  target: 'card-c8',
  task: '拆分句子主干与从句，再翻译：The charity sale, which is organized by our class, will be held in the school hall.\n题目提供的原句或示例（内容待核对）：The book, which I bought yesterday, is interesting.',
  input:
    '主干是The charity sale will be held in the school hall。which is organized by our class是非限制性定语从句，修饰the charity sale。翻译：由我们班组织的慈善义卖将在学校礼堂举行。'
};
const config = {
  source: 'byok',
  model: 'agnes-3.0-flash',
  endpoint: 'https://apihub.agnes-ai.com/v1/chat/completions',
  maxOutput: 8192,
  capabilities: { tools: true, structured: true },
  capabilityCheck: { version: 1, tools: true, structured: true, checkedAt: 1 }
};
function exercisePack() {
  const kinds = [
    'collocation',
    'collocation',
    'collocation',
    'translate_zh',
    'translate_zh',
    'translate_en',
    'translate_en',
    'long_sentence'
  ];
  const sources = [
    'We raise money ___ children.',
    'Please donate books ___ the sale.',
    'The sale will be held ___ Monday.',
    'We hope you can join us.',
    'All the money will help the children.',
    '请带一些旧书来义卖。',
    '活动将在周五下午举行。',
    'The charity sale, which is organized by our class, will be held in the school hall.'
  ];
  return {
    kind: 'daily',
    cards: kinds.map((kind, i) => ({
      id: `c${i + 1}`,
      kind,
      exercise: { source: sources[i], options: [] },
      sourceId: null
    })),
    writing: {
      prompt: 'Write your classmates an email about a charity sale. About 100 words. Sign Li Ming.',
      patterns: [['Our class will hold a charity sale.'], ['It will take place at {place} on {time}.']],
      sourceId: null
    }
  };
}
describe('练习和小结按事实组装', () => {
  const request = {
    ...base,
    phase: 'daily',
    feedbackVersion: undefined,
    dimensionContract: undefined,
    target: 'daily',
    input: '安排今天的训练',
    exerciseContract: COACH_EXERCISE_CONTRACT
  };
  it('宿主固定翻译方向与不泄题的方法，不把待核对题标成可靠', () => {
    const result = normalizeCoachOutput(exercisePack(), request);
    expect(result.cards[3]).toMatchObject({
      kind: 'translate_zh',
      title: '英译中',
      example: '',
      source: { verified: false }
    });
    expect(result.cards[3].prompt).toContain('译成中文：We hope you can join us.');
    expect(result.cards[5].prompt).toContain('译成英文：请带一些旧书来义卖。');
    expect(result.cards[0].prompt).not.toContain('for the purpose');
    expect(normalizeCoachOutput(result, request)).toEqual(result);
  });
  it('支持工具调用的出题端点走同一闭合契约，宿主只负责还原信封', () => {
    const prepared = prepareCoachFeedbackModel(config, request);
    expect(prepared.writingOutput.responseMode).toBe('generation');
    const pack = exercisePack();
    const exercises = Object.fromEntries(
      [...pack.cards].reverse().map((card) => [
        card.id,
        {
          [card.kind === 'translate_en' ? 'chinese' : 'english']: card.exercise.source,
          sourceId: null,
          sourceQuote: null,
          sourcePage: null
        }
      ])
    );
    const generated = {
      message: '开始练习',
      exercises,
      writing: { prompt: pack.writing.prompt, sourceId: null, sourceQuote: null, sourcePage: null }
    };
    const decoded = decodeCoachResponse(prepared, JSON.stringify(generated));
    const out = parseCoachModelOutput(decoded, request).coach;
    expect(out.cards).toHaveLength(8);
    expect(out.cards.map((c) => c.id)).toEqual(pack.cards.map((c) => c.id));
    expect(out.writing.patterns).toHaveLength(3);
    expect(out.writing.patterns.flat().join(' ')).not.toMatch(/Friday|charity/);
    expect(coachSystemPrompt(request, prepared.writingOutput.schema)).toContain('只调用yozi_coach_response');
    expect(() => decodeCoachResponse(prepared, JSON.stringify({ ...generated, coach: { kind: 'daily' } }))).toThrow();
  });
  it.each(['direction', 'synonyms', 'unverified_choice', 'leak', 'free_prompt', 'example'])(
    '拒绝错误方向、多解单选及泄题内容：%s',
    (kind) => {
      const pack = exercisePack();
      if (kind === 'direction') pack.cards[3].exercise.source = '活动将在周五举行。';
      if (kind === 'synonyms') pack.cards[3].exercise.options = ['期待你来', '希望你来'];
      if (kind === 'unverified_choice') pack.cards[0].exercise.options = ['for', 'to'];
      if (kind === 'leak') {
        pack.cards[0].exercise.source = 'Use take part in. Please ___ the sale.';
        pack.cards[0].exercise.options = ['take part in', 'take away'];
      }
      if (kind === 'free_prompt') pack.cards[0].prompt = '正确答案是for';
      if (kind === 'example') pack.cards[0].exercise.example = 'We raise money for children.';
      const paths = {
        direction: 'cards[3].exercise.source',
        synonyms: 'cards[3].exercise.options',
        unverified_choice: 'cards[0].exercise.options',
        leak: 'cards[0].exercise.source',
        free_prompt: 'cards[0]',
        example: 'cards[0].exercise'
      };
      expect(() => normalizeCoachOutput(pack, request)).toThrowError(
        expect.objectContaining({ code: 'COACH_INVALID', path: paths[kind] })
      );
    }
  );
  it('原始新出题不能伪装成旧卡绕过校验，已保存旧卡继续回看', () => {
    const result = normalizeCoachOutput(exercisePack(), request),
      envelope = { message: '合成练习', tools: [], question: null, coach: result };
    expect(() => parseCoachModelOutput(JSON.stringify(envelope), request)).toThrow();
    expect(() => normalizeCoachOutput(result, { ...request, exerciseContract: undefined })).not.toThrow();
  });
  it.each([
    ['english2', 'small', 'Write your classmates an email about a charity sale. About 100 words.', true],
    ['english1', 'small', '给同学写一封邀请信，约100词。', true],
    ['english2', 'small', 'Write a 100-word email to your classmates about a charity sale.', true],
    ['english2', 'small', 'Write your classmates an email about a charity sale in 120–150 words.', false],
    ['english2', 'small', 'Write your classmates an email about a charity sale.', false],
    ['english1', 'large', 'Describe the picture of a boy reading, then comment on it. Write 160–200 words.', true],
    ['english1', 'large', 'Describe the picture of a boy reading, then comment on it. Write about 150 words.', false],
    ['english2', 'large', 'The chart shows reading time rose from 20 to 35 minutes. Write about 150 words.', true]
  ])('新出写作任务的字数须与考试一致：%s %s「%s」', (exam, essayType, prompt, ok) => {
    const asked = { ...request, exam, essayType },
      pack = exercisePack();
    pack.writing.prompt = prompt;
    if (essayType === 'large') pack.writing.patterns.push(['In my view, {reason}.']);
    const parse = () =>
      parseCoachModelOutput(JSON.stringify({ message: '开始', tools: [], question: null, coach: pack }), asked);
    if (ok) expect(parse().coach.writing.prompt).toBe(prompt);
    else expect(parse).toThrowError(expect.objectContaining({ code: 'COACH_INVALID', path: 'writing.prompt' }));
    // A task saved before this check stays readable as written.
    expect(normalizeCoachOutput(pack, asked).writing.prompt).toBe(prompt);
    const words = {
      english1: { small: '约100词', large: '160–200词' },
      english2: { small: '约100词', large: '约150词' }
    };
    expect(coachSystemPrompt(asked)).toContain(`字数写明${words[exam][essayType]}`);
  });
  it.each([
    ['Write an email to invite your classmates to a science fair. About 100 words.', true],
    ['Write an email to invite your classmates to a science fair in 120 to 150 words.', false]
  ])('新摸底审题任务的字数须与小作文一致：%s', (task, ok) => {
    const asked = { ...request, phase: 'diagnostic', target: 'diagnostic' },
      sources = [
        'The book which I bought was useful.',
        'We provide books ___ children.',
        '我们欢迎你参加读书会。',
        'The sale, which is open to everyone, starts soon.',
        task
      ],
      coach = {
        kind: 'diagnostic',
        cards: sources.map((source, i) => ({
          id: `d${i + 1}`,
          kind: 'diagnostic',
          exercise: { source, options: [] },
          sourceId: null
        }))
      };
    const parse = () =>
      parseCoachModelOutput(JSON.stringify({ message: '开始', tools: [], question: null, coach }), asked);
    if (ok) expect(parse().coach.cards[4].prompt).toContain(task);
    else
      expect(parse).toThrowError(expect.objectContaining({ code: 'COACH_INVALID', path: 'cards[4].exercise.source' }));
    expect(normalizeCoachOutput(coach, asked).cards).toHaveLength(5);
    const prepared = prepareCoachFeedbackModel(config, asked);
    expect(coachSystemPrompt(asked, prepared.writingOutput.schema)).toContain(
      'd5：完整英文应用文任务，须有对象、目的、内容，字数写明约100词'
    );
    expect(coachSystemPrompt(asked)).toContain('d5给完整英文应用文任务，字数写明约100词');
  });
  it('小结只选择已保存的行为和允许动作，不继承历史误判或宣称掌握', () => {
    const r = {
      ...base,
      phase: 'summary',
      feedbackVersion: undefined,
      dimensionContract: undefined,
      target: 'summary',
      summaryContract: COACH_SUMMARY_CONTRACT,
      task: '已完成训练：搭配练习、英译中；请小结并安排明日复习。',
      weaknesses: ['未覆盖email整体任务']
    };
    const output = normalizeCoachOutput(
      { kind: 'summary', activityIds: ['activity-1', 'writing'], nextActions: ['check_due'] },
      r
    );
    expect(output.learned).toEqual(['练习了搭配练习', '练习了全文写作与反馈']);
    expect(JSON.stringify(output)).not.toMatch(/掌握|未覆盖|已安排/);
    expect(coachInferenceContext(r).weaknesses).toEqual([]);
    expect(() =>
      normalizeCoachOutput({ kind: 'summary', activityIds: ['unseen'], nextActions: ['check_due'] }, r)
    ).toThrow();
    expect(() =>
      parseCoachModelOutput(
        JSON.stringify({ message: '小结', coach: { kind: 'summary', learned: ['已掌握'], tomorrow: ['缺少署名'] } }),
        r
      )
    ).toThrow();
  });
});
describe('片段修正不能扩写成新的作文或事实', () => {
  const r = {
    ...base,
    phase: 'essay',
    target: 'essay',
    input: 'We has arranged a sale at 2 p.m.',
    task: 'Write about the sale.'
  };
  const model = () => prepareCoachFeedbackModel(config, r, false, false, false, true);
  function reply(prepared) {
    return {
      quoteVersion: prepared.writingOutput.schema.properties.quoteVersion.enum[0],
      message: 'AI评估',
      lines: [{ quoteId: 'q1', advice: '主语We后用have' }],
      errors: [{ label: '主谓一致', quoteId: 'q1', dimension: '语法', errorText: 'We has', replacement: 'We have' }],
      strengths: [],
      uncertainties: [],
      phrases: ['q1'],
      dimensionReviews: Object.fromEntries(
        ['grammar', 'collocation', 'expression', 'task'].map((key) => [
          key,
          {
            score: key === 'grammar' ? 1 : 2,
            comment: '按本维要求判断',
            evidenceIds: ['q1']
          }
        ])
      )
    };
  }
  it('只应用唯一定位的具名错误修正，其他原文逐字保留，兼容旧返回结构', () => {
    const prepared = model(),
      wire = reply(prepared),
      out = JSON.parse(decodeCoachResponse(prepared, JSON.stringify(wire))).coach;
    expect(out.lines[0]).toMatchObject({ original: r.input, rewrite: 'We have arranged a sale at 2 p.m.' });
    expect(out.phrases).toEqual(['We have arranged a sale at 2 p.m.']);
    expect(out.weaknesses).toEqual(['主谓一致']);
    expect(out).not.toHaveProperty('observations');
    expect(wire.errors[0].errorText).toBe('We has');
  });
  it('反馈只容纳三处重点，结构名称可占用180字符但仍拒绝溢出', () => {
    const prepared = model(),
      wire = reply(prepared);
    expect(prepared.writingOutput.schema.properties.lines.maxItems).toBe(1);
    wire.lines[0].advice = '字'.repeat(180);
    expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).not.toThrow();
    wire.lines[0].advice += '字';
    expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).toThrow();
  });
  it.each(['extra_edit', 'new_number', 'duplicate', 'cross_dimension', 'unbound_phrase', 'unseen_error'])(
    '拒绝扩写、重复归因、虚构事实和无来源句式：%s',
    (kind) => {
      const prepared = model(),
        wire = reply(prepared);
      if (kind === 'extra_edit') wire.lines[0].edits = [{ before: 'a sale', after: 'a sale for a local orphanage' }];
      if (kind === 'new_number') wire.errors[0].replacement = 'We have arranged 3 stalls';
      if (kind === 'duplicate') wire.lines.push(structuredClone(wire.lines[0]));
      if (kind === 'cross_dimension') wire.dimensionReviews.collocation.score = 1;
      if (kind === 'unbound_phrase') wire.phrases[0] = 'An entirely invented template.';
      if (kind === 'unseen_error') wire.errors[0].errorText = 'We never wrote this';
      expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).toThrowError(
        expect.objectContaining({ code: 'COACH_INVALID' })
      );
    }
  );
  it('星期加时段的合法零冠词表达不能被当成语法错误', () => {
    const req = { ...r, input: 'The meeting is on Monday morning.' };
    const prepared = prepareCoachFeedbackModel(config, req, false, false, false, true),
      wire = reply(prepared);
    wire.errors = [
      {
        label: '时间短语缺冠词',
        quoteId: 'q1',
        dimension: '语法',
        errorText: 'Monday morning',
        replacement: 'the Monday morning'
      }
    ];
    wire.phrases = [];
    expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).toThrowError(
      expect.objectContaining({ code: 'COACH_INVALID', path: 'errors[0]' })
    );
  });
  it('正确原答保留，不为未请求的润色制造观察或修改', () => {
    const prepared = model(),
      wire = reply(prepared);
    wire.errors = [];
    wire.phrases = [];
    Object.values(wire.dimensionReviews).forEach((d) => (d.score = 2));
    expect(JSON.parse(decodeCoachResponse(prepared, JSON.stringify(wire))).coach.lines[0].rewrite).toBe(r.input);
    wire.lines[0].edits = [{ before: 'a sale', after: 'a charity sale' }];
    expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).toThrow();
    delete wire.lines[0].edits;
    wire.observations = [
      { label: '可选正式语气', quoteId: 'q1', classification: 'suggestion', dimension: '表达', errorText: null }
    ];
    expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).toThrow();
  });
});
describe('按任务的真实答题形式送评', () => {
  it('返修保留字段合同的原规则、维度和引用；缺失回复也有有界返修指令', () => {
    const prepared = prepareCoachFeedbackModel(
      config,
      coachInferenceContext(mixedDiagnosticRequest()),
      false,
      false,
      false,
      true
    );
    const wire = mixedDiagnosticReply(prepared);
    wire.dimensionReviews.grammar.evidenceIds = ['q1'];
    const error = {
      code: 'COACH_INVALID',
      path: 'root.dimensionReviews.grammar.evidenceIds[0]',
      message: '模型响应未通过完整字段合同'
    };
    const feedback = coachRepairFeedback(prepared, error, JSON.stringify(wire));
    expect(feedback).toMatchObject({ path: error.path, rule: error.message, dimension: '语法', quoteIds: ['q1'] });
    expect(coachRepairPrompt(feedback)).toContain(error.message);
    expect(coachRepairFeedback(prepared, { code: 'COACH_INVALID', path: 'tools', message: '格式错误' })).toMatchObject({
      rule: '格式错误',
      previousResponse: null
    });
    expect(coachRepairFeedback(prepared, { ...error, repairForbidden: true }, JSON.stringify(wire))).toBeNull();
    expect(coachRepairFeedback(prepared, { ...error, code: 'TIMEOUT' }, JSON.stringify(wire))).toBeNull();
  });

  it('同一处搭配错误换维度登记仍被拒收，两个独立错误可分别登记', () => {
    const input = mixedDiagnosticRequest();
    input.input = input.input.replace('Welcome to the science fair.', 'She welcome visitors.');
    const request = coachInferenceContext(input);
    const prepared = prepareCoachFeedbackModel(config, request, false, false, false, true);
    const wire = mixedDiagnosticReply(prepared);
    wire.errors.push({ ...wire.errors[0], dimension: '语法', label: '介词语法错误' });
    expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).toThrowError(
      expect.objectContaining({
        code: 'COACH_INVALID',
        path: 'errors[1]',
        validationDimension: '语法',
        validationQuoteIds: ['q2']
      })
    );
    wire.errors[1] = {
      label: '主谓一致',
      quoteId: 'q3',
      dimension: '语法',
      errorText: 'welcome',
      replacement: null,
      rule: '第三人称单数主语后动词加s'
    };
    const out = JSON.parse(decodeCoachResponse(prepared, JSON.stringify(wire))).coach;
    expect(out.dimensions.map((d) => [d.name, d.score])).toEqual([
      ['语法', 1],
      ['搭配', 1],
      ['表达', 2],
      ['任务完成', 2]
    ]);
  });
  it.each(['grammar', 'collocation', 'expression', 'task'])('模型自报的%s档位不被接受，档位只由宿主推出', (key) => {
    const prepared = prepareCoachFeedbackModel(
      config,
      coachInferenceContext(mixedDiagnosticRequest()),
      false,
      false,
      false,
      true
    );
    const wire = mixedDiagnosticReply(prepared);
    wire.errors = [];
    wire.dimensionReviews[key].score = 1;
    expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).toThrowError(
      expect.objectContaining({ code: 'COACH_INVALID', path: `root.dimensionReviews.${key}` })
    );
  });
  it('宿主按核对后的错误推档：无错2、一处1、两处0、无可评证据null', () => {
    const prepared = prepareCoachFeedbackModel(
      config,
      coachInferenceContext(mixedDiagnosticRequest()),
      false,
      false,
      false,
      true
    );
    const scores = (wire) =>
      Object.fromEntries(
        JSON.parse(decodeCoachResponse(prepared, JSON.stringify(wire))).coach.dimensions.map((d) => [
          d.name,
          [d.score, d.evidence]
        ])
      );
    const wire = mixedDiagnosticReply(prepared);
    expect(scores({ ...wire, errors: [] })).toEqual({
      语法: [2, ['at', 'Welcome to the science fair.']],
      搭配: [2, ['at', 'Welcome to the science fair.']],
      表达: [2, ['Welcome to the science fair.']],
      任务完成: [2, expect.arrayContaining([expect.stringContaining('主干The tool works well')])]
    });
    expect(scores(wire).搭配).toEqual([1, ['at']]);
    const twoGrammar = ['Welcome', 'fair'].map((errorText) => ({
      label: '语法错误' + errorText,
      quoteId: 'q3',
      dimension: '语法',
      errorText,
      replacement: null,
      rule: '示例规则'
    }));
    expect(scores({ ...wire, errors: twoGrammar }).语法).toEqual([0, ['Welcome to the science fair.']]);
    const unsure = scores({ ...wire, errors: [], uncertainties: [{ label: '译意待核对', quoteId: 'q3' }] });
    expect(unsure.表达).toEqual([null, []]);
    expect(unsure.语法).toEqual([2, ['at']]);
  });
  it('每条已登记错误都有讲解行，模型没选到的由宿主用规则补齐并按题序排列', () => {
    const prepared = prepareCoachFeedbackModel(
      config,
      coachInferenceContext(mixedDiagnosticRequest()),
      false,
      false,
      false,
      true
    );
    const wire = mixedDiagnosticReply(prepared);
    wire.errors.push({
      label: '修饰对象判断错误',
      quoteId: 'q4',
      dimension: '任务完成',
      errorText: null,
      replacement: null,
      rule: '题目要求指出从句修饰对象'
    });
    const coach = parseCoachModelOutput(
      decodeCoachResponse(prepared, JSON.stringify(wire)),
      coachInferenceContext(mixedDiagnosticRequest()),
      false,
      undefined,
      true
    ).coach;
    expect(coach.lines.map((line) => line.advice)).toEqual([
      '核对固定搭配所需的介词，再填回原句。',
      '题目要求指出从句修饰对象'
    ]);
    expect(coach.weaknesses).toEqual(['固定搭配介词选择错误', '修饰对象判断错误']);
    expect(coach.dimensions.find((d) => d.name === '任务完成').score).toBe(1);
  });
  it('同类换题仍使用通用作答形式，不引入旧题词汇与理由要求', () => {
    const first = coachAssessmentTask(mixedDiagnosticRequest());
    const second = coachAssessmentTask({
      ...mixedDiagnosticRequest(),
      task: mixedDiagnosticRequest().task.replace('science', 'art').replace('at', 'in')
    });
    expect(first.items.map((item) => item.answerFormat)).toEqual(second.items.map((item) => item.answerFormat));
    expect(first.items[1].answerFormat).toContain('仅在题干明确要求时');
    expect(JSON.stringify(first.items.map((item) => item.answerFormat))).not.toMatch(/provide|give|自拟实际时间/u);
    const prepared = prepareCoachFeedbackModel(
      config,
      coachInferenceContext(mixedDiagnosticRequest()),
      false,
      false,
      false,
      true
    );
    expect(coachSystemPrompt(coachInferenceContext(mixedDiagnosticRequest()), prepared.writingOutput.schema)).toContain(
      '固定搭配中的介词选择、动词搭配归搭配'
    );
  });
  it('填空比较完整候选句，隔离带有错误预设的讲解，保留标签原答', () => {
    const input = structuredClone(cloze),
      projected = coachInferenceContext(input),
      task = JSON.parse(projected.task);
    expect(task.source).toBe('The sale is ___ help kids in need.');
    expect(task.selectedSentence).toBe('The sale is to help kids in need.');
    expect(task.candidates).toEqual(
      ['for', 'of', 'to', 'in'].map((option) => ({ option, sentence: `The sale is ${option} help kids in need.` }))
    );
    expect(projected.task).not.toContain('for the purpose of');
    expect(projected.input).toBe('to');
    expect(input).toEqual(cloze);
    expect(coachAssessmentTask({ ...cloze, input: 'for' }).selectedSentence).toBe('The sale is for help kids in need.');
  });
  it('多空或损坏选项不猜测题目，开放填空也不伪造候选答案', () => {
    expect(coachAssessmentTask({ ...cloze, task: 'Fill in: We ___ to ___.' })).toBeNull();
    expect(coachAssessmentTask({ ...cloze, task: cloze.task.replace('["for","of","to","in"]', '[1,2]') })).toBeNull();
    expect(coachAssessmentTask({ ...cloze, task: '完成句子：We plan ___ help.' })).toMatchObject({
      selectedSentence: 'We plan to help.',
      candidates: []
    });
  });
  it('中文分析是笔记；不把另一道示范句或原句还原要求带入验答', () => {
    const task = JSON.parse(coachInferenceContext(syntax).task);
    expect(task.kind).toBe('syntax_analysis');
    expect(task.source).toBe('The charity sale, which is organized by our class, will be held in the school hall.');
    expect(task.required).toEqual(['主干识别', '从句类型和修饰对象', '中文翻译']);
    expect(JSON.stringify(task)).not.toContain('The book');
    const prepared = prepareCoachFeedbackModel(config, syntax);
    expect(prepared.writingOutput.schema.properties.dimensions.items.properties.name.enum).toEqual([
      '表达',
      '任务完成'
    ]);
    const wire = {
      quoteVersion: prepared.writingOutput.schema.properties.quoteVersion.enum[0],
      message: '分析反馈',
      lines: [{ quoteId: 'q1', advice: '仅按分析内容判断', rewriteMode: 'keep', rewrite: null }],
      strengths: [],
      strengthEvidence: [],
      weaknesses: ['从句类型判断错误'],
      weaknessEvidence: [{ label: '从句类型判断错误', quoteId: 'q1', classification: 'error' }],
      phrases: [],
      dimensions: [{ name: '任务完成', score: 1, comment: '真实分析错误仍须指出', evidenceIds: ['q1'] }]
    };
    expect(JSON.parse(decodeCoachResponse(prepared, JSON.stringify(wire))).coach.dimensions[0].score).toBe(1);
    wire.dimensions[0].name = '语法';
    expect(() => decodeCoachResponse(prepared, JSON.stringify(wire))).toThrow();
    expect(coachSystemPrompt(coachInferenceContext(syntax), prepared.writingOutput.schema)).toContain(
      '不是学生重写的英文整句'
    );
  });
  it('五项摸底按各题角色绑定引用，中文分析不能计为英文语法错', () => {
    const r = {
      ...base,
      target: 'diagnostic',
      task: [
        '分析句子主干：The book which I bought was useful.',
        '补全搭配：provide ___ for children。',
        '译成英文：我们欢迎你参加。',
        '拆分从句：The sale, which is open to everyone, starts soon.',
        '提取写作要点：Write an email to classmates, about 100 words.'
      ].join('\n'),
      input: [
        '主干The book was useful，which作bought的宾语。',
        'help。空格填名词。',
        'We welcome you to join us.',
        '主句The sale starts soon，which从句修饰sale。',
        '对象同学，目的告知并邀请，约100词。'
      ].join('\n')
    };
    const projected = coachInferenceContext(r),
      task = JSON.parse(projected.task);
    expect(task.kind).toBe('diagnostic_set');
    expect(task.items[0]).toMatchObject({ quoteId: 'q1', allowedDimensions: ['任务完成'], allowReplacement: false });
    expect(task.items.map((item) => item.allowedDimensions)).toEqual([
      ['任务完成'],
      ['语法', '搭配'],
      ['语法', '搭配', '表达'],
      ['任务完成'],
      ['任务完成']
    ]);
    expect(task.items[1].answerFormat).toContain('允许有据质疑');
    expect(task.items[4].answerFormat).toContain('内容要点提纲，不是成文');
    expect(projected.input).toBe(r.input);
    const prepared = prepareCoachFeedbackModel(config, projected, false, false, false, true);
    expect(prepared.writingOutput.scorePolicy).toBe('host-derived-v1');
    expect(Object.keys(prepared.writingOutput.schema.properties.dimensionReviews.properties.grammar.properties)).toEqual([
      'comment'
    ]);
    expect(prepared.writingOutput.schema.properties.errors.items.required).toContain('rule');
    const wire = {
      quoteVersion: prepared.writingOutput.schema.properties.quoteVersion.enum[0],
      message: '摸底反馈',
      lines: [{ quoteId: 'q1', advice: '核对分析内容' }],
      errors: [
        {
          quoteId: 'q1',
          label: '关系词误作宾语',
          dimension: '语法',
          errorText: '宾语',
          replacement: null,
          rule: '关系词在从句中作主语'
        }
      ],
      strengths: [],
      uncertainties: [],
      phrases: [],
      dimensionReviews: Object.fromEntries(
        ['grammar', 'collocation', 'expression', 'task'].map((key) => [key, { comment: '本题维度' }])
      )
    };
    let rejected;
    try {
      decodeCoachResponse(prepared, JSON.stringify(wire));
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toMatchObject({
      code: 'COACH_INVALID',
      path: 'errors[0].dimension',
      validationAllowedDimensions: ['任务完成']
    });
    const feedback = coachRepairFeedback(prepared, rejected, JSON.stringify(wire));
    expect(feedback.allowedDimensions).toEqual(['任务完成']);
    expect(coachRepairPrompt(feedback)).toContain('"allowedDimensions":["任务完成"]');
    wire.errors[0].dimension = '任务完成';
    wire.errors[0].errorText = null;
    expect(JSON.parse(decodeCoachResponse(prepared, JSON.stringify(wire))).coach.dimensions[3]).toMatchObject({
      name: '任务完成',
      score: 1
    });
    expect(coachAssessmentTask({ ...r, input: r.input + '\n额外一行' })).toBeNull();
  });
  it('短填空只引用学生标签，中文分析的错答不由模型代写', () => {
    const filled = prepareCoachFeedbackModel(
      config,
      coachInferenceContext({ ...cloze, input: 'for' }),
      false,
      false,
      false,
      true
    );
    expect(filled.writingOutput.schema.properties.errors.items.properties.errorText.enum).toEqual(['for', null]);
    const analyzed = prepareCoachFeedbackModel(config, coachInferenceContext(syntax), false, false, false, true);
    expect(analyzed.writingOutput.schema.properties.errors.items.properties.errorText).toEqual({ type: 'null' });
    expect(analyzed.writingOutput.schema.properties.errors.items.properties.replacement).toEqual({ type: 'null' });
  });
});
describe('摸底错误合并复核一次：讲解题只删不加，单词填空盲填比对', () => {
  const preparedFor = (r) =>
    prepareCoachFeedbackModel(config, coachInferenceContext(r), false, false, false, true);
  const prepared = () => preparedFor(mixedDiagnosticRequest());
  const blankAnswer = (answer) => {
    const r = mixedDiagnosticRequest(),
      lines = r.input.split('\n');
    lines[1] = answer;
    return { ...r, input: lines.join('\n') };
  };
  const overflagged = (p) => {
    const wire = mixedDiagnosticReply(p);
    wire.lines.push({ quoteId: 'q5', advice: '没写出邮件的称呼和落款' });
    wire.errors.push({
      label: '未列邮件格式要素',
      quoteId: 'q5',
      dimension: '任务完成',
      errorText: null,
      replacement: null,
      rule: '须写出邮件的称呼和落款'
    });
    wire.dimensionReviews.task.comment = '缺少邮件格式要素';
    return wire;
  };
  const fill = (accepted) => ({ id: 'b1', accepted, label: 'interested in', rule: 'be interested in 是固定搭配，介词用 in' });
  const parsed = (id, mainSubject, mainVerb, clause, antecedent, clauseSubject, clauseVerb, pronounRole) => ({
    id,
    mainSubject,
    mainVerb,
    clause,
    antecedent,
    pronoun: clause.split(' ')[0],
    clauseSubject,
    clauseVerb,
    pronounRole,
    note: `主干是${mainSubject} ${mainVerb}，${clause}修饰${antecedent}`
  });
  const verdict = (raw) => async () => JSON.stringify(raw);
  const fairPoints = [
    { span: 'Write an email to classmates', keywords: ['邮件', '同学'] },
    { span: 'introduce a science fair', keywords: ['介绍', '科学展'] },
    { span: 'invite them', keywords: ['邀请'] },
    { span: 'About 100 words', keywords: ['100', '一百'] }
  ];
  const outline = (points = fairPoints) => ({ id: 'p1', points, note: '给同学写邮件，介绍科学展并邀请参加，约100词' });
  const outlineAnswer = (answer) => {
    const r = mixedDiagnosticRequest(),
      lines = r.input.split('\n');
    lines[4] = answer;
    return { ...r, input: lines.join('\n') };
  };
  it('审题题只给复核员英文题干盲列要点，提纲逐点写到就删掉挑错；填空只给题干不给原答', async () => {
    const p = prepared();
    const calls = [];
    const { content, receipt } = await verifyCoachErrors(p, JSON.stringify(overflagged(p)), async (verifier, messages) => {
      calls.push({ verifier, messages });
      return verdict({ blanks: [fill(['in'])], outlines: [outline()] })();
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].verifier.writingOutput.contract).toBe('writing-error-verification-v1');
    const sent = JSON.parse(calls[0].messages[1].content);
    expect(sent.errors).toEqual([]);
    expect(sent.blanks).toEqual([{ id: 'b1', task: '补全固定搭配：We are interested ___ science. 只填介词。' }]);
    expect(sent.outlines).toEqual([
      { id: 'p1', prompt: 'Write an email to classmates to introduce a science fair and invite them. About 100 words.' }
    ]);
    expect(sent).not.toHaveProperty('syntax');
    expect(calls[0].messages[1].content).not.toContain('"at"');
    expect(calls[0].messages[1].content).not.toContain('邀请邮件');
    expect(calls[0].messages[1].content).not.toContain('未列邮件格式要素');
    expect(receipt).toMatchObject({ status: 'completed', checked: 2, removed: 1, added: 0 });
    expect(receipt.reviews[0]).toMatchObject({ quoteId: 'q2', kept: true, wrong: true });
    expect(receipt.reviews[1]).toMatchObject({ quoteId: 'q5', kept: false, wrong: false });
    expect(receipt.blanks).toEqual([{ quoteId: 'q2', accepted: ['in'], correct: false }]);
    expect(receipt.outlines).toEqual([
      { quoteId: 'q5', valid: true, agreed: true, points: fairPoints.map(({ span }) => ({ span, covered: true })) }
    ]);
    const coach = JSON.parse(decodeCoachResponse(p, content)).coach;
    expect(coach.dimensions.map((d) => [d.name, d.score])).toEqual([
      ['语法', 2],
      ['搭配', 1],
      ['表达', 2],
      ['任务完成', 2]
    ]);
    expect(coach.dimensions[3].comment).toBe('给同学写邮件，介绍科学展并邀请参加，约100词');
    expect(coach.lines.find((line) => line.original.startsWith('写给同学')).advice).toBe(
      '给同学写邮件，介绍科学展并邀请参加，约100词'
    );
    expect(coach.weaknesses).toEqual(['固定搭配介词选择错误']);
  });
  it.each([
    ['提纲漏写一个要点', '写给同学的邮件，介绍科学展，约100词。', fairPoints, true],
    ['要点所在分句带否定', '写给同学的邮件，介绍科学展，不用邀请，约100词。', fairPoints, true],
    ['要点片段不是题干原文', null, [{ span: 'Write a letter to classmates', keywords: ['邮件', '同学'] }, ...fairPoints.slice(1)], false],
    ['题干有一句没列要点', null, fairPoints.slice(0, 3), false],
    ['同一关键词出现在两个要点下', null, [...fairPoints.slice(0, 2), { span: 'invite them', keywords: ['邀请', '邮件'] }, fairPoints[3]], false]
  ])('审题错误保留：%s', async (_name, answer, points, valid) => {
    const p = answer ? preparedFor(outlineAnswer(answer)) : prepared();
    const { content, receipt } = await verifyCoachErrors(
      p,
      JSON.stringify(overflagged(p)),
      verdict({ blanks: [fill(['in'])], outlines: [outline(points)] })
    );
    expect(receipt).toMatchObject({ status: 'completed', checked: 2, removed: 0 });
    expect(receipt.reviews[1]).toMatchObject({ quoteId: 'q5', kept: true });
    expect(receipt.outlines[0]).toMatchObject({ quoteId: 'q5', valid, agreed: false });
    expect(JSON.parse(decodeCoachResponse(p, content)).coach.dimensions[3].score).toBe(1);
  });
  it('开发集园艺感谢信：提纲逐条写到题干要点，盲列要点判为一致', () => {
    const prompt =
      'Write a letter to volunteers thanking them for their work in the school garden. Mention their contribution and express your appreciation. About 100 words.';
    const points = [
      { span: 'Write a letter', keywords: ['感谢信', '书信', '写信'] },
      { span: 'to volunteers', keywords: ['志愿者', '义工'] },
      { span: 'thanking them for their work in the school garden', keywords: ['感谢', '园艺', '花园'] },
      { span: 'Mention their contribution', keywords: ['贡献', '付出'] },
      { span: 'express your appreciation', keywords: ['谢意', '感激', '致谢'] },
      { span: 'About 100 words.', keywords: ['100', '一百'] }
    ];
    const answer = '感谢信，写给志愿者，感谢校园园艺工作；提到志愿者的贡献并表达谢意，约100词。';
    expect(outlineAgreement(prompt, points, answer)).toMatchObject({ valid: true, agreed: true });
    expect(outlineAgreement(prompt, points, '感谢信，写给志愿者，感谢校园园艺工作，约100词。')).toMatchObject({
      valid: true,
      agreed: false,
      points: expect.arrayContaining([{ span: 'Mention their contribution', covered: false }])
    });
  });
  it('中译英的语法错误只看是否写错，复核说题干没要求也保留；表达类仍按两问删除（封存题 H3 时态）', async () => {
    const r = mixedDiagnosticRequest(),
      tasks = r.task.split('\n'),
      answers = r.input.split('\n');
    tasks[2] = '译成英文：我们昨天参观了科学展。';
    answers[2] = 'We visit the science fair yesterday.';
    const p = preparedFor({ ...r, task: tasks.join('\n'), input: answers.join('\n') }),
      wire = mixedDiagnosticReply(p);
    wire.errors.push(
      {
        label: '时态错误',
        quoteId: 'q3',
        dimension: '语法',
        errorText: 'visit',
        replacement: null,
        rule: '有yesterday，谓语用一般过去时'
      },
      {
        label: '用词可更地道',
        quoteId: 'q3',
        dimension: '表达',
        errorText: 'science fair',
        replacement: null,
        rule: '可换用更正式的说法'
      }
    );
    const sent = [];
    const { content, receipt } = await verifyCoachErrors(p, JSON.stringify(wire), async (_verifier, messages) => {
      sent.push(JSON.parse(messages[1].content));
      return verdict({
        reviews: [
          { index: 1, required: false, wrong: true, reason: '题干未要求时态' },
          { index: 2, required: false, wrong: true, reason: '题干未要求用词' }
        ],
        blanks: [fill(['in'])]
      })();
    });
    expect(sent[0].errors.map((item) => item.index)).toEqual([1, 2]);
    expect(receipt).toMatchObject({ status: 'completed', checked: 3, removed: 1 });
    expect(receipt.reviews[1]).toMatchObject({ quoteId: 'q3', dimension: '语法', required: false, wrong: true, kept: true });
    expect(receipt.reviews[2]).toMatchObject({ quoteId: 'q3', dimension: '表达', kept: false });
    expect(JSON.parse(content).errors.map((e) => e.label)).toEqual(['固定搭配介词选择错误', '时态错误']);
  });
  it('初评漏登记的错填由盲填补登一条，不代写答案，矛盾的优点撤下', async () => {
    const p = prepared(),
      wire = { ...mixedDiagnosticReply(p), errors: [], strengths: [{ label: '介词正确', quoteId: 'q2' }] };
    wire.dimensionReviews.collocation.comment = '已达到本次要求';
    const { content, receipt } = await verifyCoachErrors(p, JSON.stringify(wire), verdict({ blanks: [fill(['in'])] }));
    expect(receipt).toMatchObject({ status: 'completed', checked: 1, removed: 0, added: 1 });
    const value = JSON.parse(content);
    expect(value.errors).toEqual([
      {
        label: 'interested in',
        quoteId: 'q2',
        dimension: '搭配',
        errorText: 'at',
        replacement: null,
        rule: 'be interested in 是固定搭配，介词用 in'
      }
    ]);
    expect(value.strengths).toEqual([]);
    const coach = JSON.parse(decodeCoachResponse(p, content)).coach;
    expect(coach.dimensions.find((d) => d.name === '搭配')).toMatchObject({
      score: 1,
      comment: 'be interested in 是固定搭配，介词用 in'
    });
    expect(coach.lines.find((line) => line.original === 'at').advice).toBe('be interested in 是固定搭配，介词用 in');
    expect(coach.weaknesses).toEqual(['interested in']);
  });
  it('原答带句末标点（at。）照样盲填比对，补登的错误片段只取单词', async () => {
    const p = preparedFor(blankAnswer('at。')),
      wire = { ...mixedDiagnosticReply(p), errors: [] };
    const calls = [];
    const { content, receipt } = await verifyCoachErrors(p, JSON.stringify(wire), async (verifier, messages) => {
      calls.push(messages);
      return verdict({ blanks: [fill(['in'])] })();
    });
    expect(calls).toHaveLength(1);
    expect(calls[0][1].content).not.toContain('at。');
    expect(receipt).toMatchObject({ status: 'completed', checked: 1, added: 1 });
    expect(receipt.blanks).toEqual([{ quoteId: 'q2', accepted: ['in'], correct: false }]);
    expect(JSON.parse(content).errors[0]).toMatchObject({ quoteId: 'q2', errorText: 'at' });
    const coach = JSON.parse(decodeCoachResponse(p, content)).coach;
    expect(coach.dimensions.find((d) => d.name === '搭配')).toMatchObject({ score: 1 });
  });
  it.each([
    ['正确答案', 'in', ['in']],
    ['大写原答', 'In', ['in']],
    ['带句号', 'in。', ['in']],
    ['带英文句点', 'in.', ['in']],
    ['合法变体', 'upon', ['on', 'upon']]
  ])('填对的空（%s）上的初评错误被删除，档位回到2', async (_name, answer, accepted) => {
    const p = preparedFor(blankAnswer(answer)),
      wire = mixedDiagnosticReply(p);
    wire.errors[0].errorText = answer;
    const { content, receipt } = await verifyCoachErrors(p, JSON.stringify(wire), verdict({ blanks: [fill(accepted)] }));
    expect(receipt).toMatchObject({ status: 'completed', checked: 1, removed: 1, added: 0 });
    expect(receipt.blanks[0]).toMatchObject({ quoteId: 'q2', correct: true });
    const coach = JSON.parse(decodeCoachResponse(p, content)).coach;
    expect(coach.dimensions.find((d) => d.name === '搭配')).toMatchObject({ score: 2 });
    expect(coach.weaknesses).toEqual([]);
  });
  it.each([
    ['限流', async () => Promise.reject(Object.assign(new Error('limit'), { code: 'RATE_LIMITED' }))],
    ['漏答填空', verdict({ outlines: [outline()] })],
    ['漏答审题', verdict({ blanks: [fill(['in'])] })],
    ['重复回答', verdict({ outlines: [outline(), outline()], blanks: [fill(['in'])] })],
    ['填空列出短语', verdict({ outlines: [outline()], blanks: [fill(['interested in'])] })],
    [
      '关键词只有一个字',
      verdict({ outlines: [outline([{ span: 'Write an email', keywords: ['信'] }, ...fairPoints.slice(1)])], blanks: [fill(['in'])] })
    ],
    ['不是JSON', async () => 'not json']
  ])('复核失败（%s）时原错误照常进门禁，不当成无错', async (_name, call) => {
    const p = prepared(),
      wire = overflagged(p);
    const { content, receipt } = await verifyCoachErrors(p, JSON.stringify(wire), call);
    expect(receipt).toMatchObject({ status: 'failed', checked: 2, reviews: [] });
    expect(JSON.parse(content).errors).toHaveLength(2);
    expect(JSON.parse(decodeCoachResponse(p, content)).coach.dimensions[3].score).toBe(1);
  });
  it('无错误且没有单词填空、未过字段合同或非摸底时不发复核；取消照常抛出', async () => {
    const p = preparedFor(blankAnswer('in，因为interested后接in')),
      never = async () => {
        throw new Error('should not call');
      };
    const clean = { ...mixedDiagnosticReply(p), errors: [] };
    expect(await verifyCoachErrors(p, JSON.stringify(clean), never)).toEqual({
      content: JSON.stringify(clean),
      receipt: null
    });
    const broken = mixedDiagnosticReply(prepared());
    broken.errors[0].dimension = '表达';
    expect((await verifyCoachErrors(prepared(), JSON.stringify(broken), never)).receipt).toBeNull();
    const card = prepareCoachFeedbackModel(config, coachInferenceContext(cloze), false, false, false, true);
    expect(card.writingOutput.scorePolicy).toBeUndefined();
    expect((await verifyCoachErrors(card, '{}', never)).receipt).toBeNull();
    await expect(
      verifyCoachErrors(prepared(), JSON.stringify(mixedDiagnosticReply(prepared())), async () => {
        throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
      })
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  const syntaxRequest = (q1, a1, q4, a4) => {
    const r = mixedDiagnosticRequest(),
      tasks = r.task.split('\n'),
      answers = r.input.split('\n');
    [tasks[0], answers[0], tasks[3], answers[3]] = [q1, a1, q4, a4];
    return { ...r, task: tasks.join('\n'), input: answers.join('\n') };
  };
  const cycling = () =>
    syntaxRequest(
      '分析主干与修饰成分：The workshop which our teacher recommended starts tomorrow.',
      '主干The workshop starts tomorrow；which our teacher recommended修饰workshop，which是recommended的宾语。',
      '拆分主句和从句并指出修饰对象：The coach, whom we met last week, teaches beginners.',
      '主句The coach teaches beginners；whom we met last week是非限制性定语从句，修饰coach，whom是met的宾语。'
    );
  const robotics = () =>
    syntaxRequest(
      '分析主干和从句：The device that our team tested works well.',
      '主干The device works well；that our team tested修饰device，that作tested的宾语。',
      '拆分主句与从句并指出修饰对象：The engineer, who designed the robot, visited our school.',
      '主句The engineer visited our school；who designed the robot是非限制性定语从句，修饰school，who作从句主语。'
    );
  const syntaxError = (quoteId, label, rule) => ({
    label,
    quoteId,
    dimension: '任务完成',
    errorText: null,
    replacement: null,
    rule
  });
  it('句法题只给复核员英文原句盲析，不给学生原答和初评说法；笔记与盲析一致就删掉误判（摸底开发集 which 作宾语）', async () => {
    const p = preparedFor(cycling()),
      wire = mixedDiagnosticReply(p);
    wire.errors.push(
      syntaxError('q1', '将which误判为recommended的宾语', '本句which是定语从句主语，而非recommended的宾语')
    );
    wire.lines.push({ quoteId: 'q1', advice: 'which在从句中作主语' });
    wire.dimensionReviews.task.comment = 'which成分判断有误';
    const calls = [];
    const { content, receipt } = await verifyCoachErrors(p, JSON.stringify(wire), async (verifier, messages) => {
      calls.push(messages);
      return verdict({
        blanks: [fill(['in'])],
        syntax: [parsed('s1', 'The workshop', 'starts', 'which our teacher recommended', 'workshop', 'our teacher', 'recommended', '宾语')]
      })();
    });
    const sent = JSON.parse(calls[0][1].content);
    expect(sent.syntax).toEqual([{ id: 's1', sentence: 'The workshop which our teacher recommended starts tomorrow.' }]);
    expect(sent.errors).toEqual([]);
    expect(calls[0][1].content).not.toContain('which是recommended的宾语');
    expect(calls[0][1].content).not.toContain('定语从句主语');
    expect(receipt).toMatchObject({ status: 'completed', checked: 2, removed: 1, added: 0 });
    expect(receipt.syntax).toEqual([
      { quoteId: 'q1', valid: true, agreed: true, claims: { trunk: true, clause: true, target: true, role: true } }
    ]);
    expect(receipt.reviews[1]).toMatchObject({ quoteId: 'q1', kept: false, wrong: false });
    expect(JSON.parse(content).errors.map((e) => e.quoteId)).toEqual(['q2']);
    const coach = JSON.parse(decodeCoachResponse(p, content)).coach;
    expect(coach.dimensions.find((d) => d.name === '任务完成')).toMatchObject({ score: 2 });
    expect(coach.lines.find((line) => line.original.startsWith('主干')).advice).toBe(
      '主干是The workshop starts，which our teacher recommended修饰workshop'
    );
  });
  it('主干里没有从句动词时，初评说 tested 是主句谓语被盲析否定；修饰对象写错的真错误保留（摸底开发集）', async () => {
    const p = preparedFor(robotics()),
      wire = { ...mixedDiagnosticReply(p), errors: [] };
    wire.errors.push(
      syntaxError('q1', '主干漏掉谓语tested', 'tested是主句谓语之一，不能归入that从句'),
      syntaxError('q4', '非限制性定语从句修饰对象判断错误', 'who指代逗号前的先行词the engineer，而非school')
    );
    const { content, receipt } = await verifyCoachErrors(
      p,
      JSON.stringify(wire),
      verdict({
        blanks: [fill(['in'])],
        syntax: [
          parsed('s1', 'The device', 'works', 'that our team tested', 'device', 'our team', 'tested', '宾语'),
          parsed('s2', 'The engineer', 'visited', 'who designed the robot', 'engineer', 'who', 'designed', '主语')
        ]
      })
    );
    expect(receipt.syntax).toEqual([
      { quoteId: 'q1', valid: true, agreed: true, claims: { trunk: true, clause: true, target: true, role: true } },
      {
        quoteId: 'q4',
        valid: true,
        agreed: false,
        claims: { trunk: true, clause: true, target: false, role: true, restrictive: true, kind: true }
      }
    ]);
    expect(JSON.parse(content).errors.map((e) => [e.quoteId, e.label])).toEqual([
      ['q4', '非限制性定语从句修饰对象判断错误'],
      ['q2', 'interested in']
    ]);
    expect(JSON.parse(decodeCoachResponse(p, content)).coach.dimensions[3].score).toBe(1);
  });
  it.each([
    ['关系词成分与从句主谓位置矛盾', { pronounRole: '主语', clauseSubject: 'which' }],
    ['主句谓语落在从句里', { mainVerb: 'recommended' }],
    ['先行词不紧挨从句', { antecedent: 'teacher' }],
    ['从句不是原句片段', { clause: 'which the teacher recommended' }],
    ['关系词不在从句开头', { pronoun: 'that' }],
    ['成分选其他', { pronounRole: '其他' }]
  ])('盲析不自洽（%s）时不拿来删错，初评错误保留', async (_name, change) => {
    const p = preparedFor(cycling()),
      wire = mixedDiagnosticReply(p);
    wire.errors.push(syntaxError('q1', 'which成分判断错误', 'which是定语从句主语'));
    const { content, receipt } = await verifyCoachErrors(
      p,
      JSON.stringify(wire),
      verdict({
        blanks: [fill(['in'])],
        syntax: [
          {
            ...parsed('s1', 'The workshop', 'starts', 'which our teacher recommended', 'workshop', 'our teacher', 'recommended', '宾语'),
            ...change
          }
        ]
      })
    );
    expect(receipt.syntax).toEqual([{ quoteId: 'q1', valid: false, agreed: false, claims: {} }]);
    expect(JSON.parse(content).errors.map((e) => e.quoteId)).toEqual(['q2', 'q1']);
  });
  it('句法题要求翻译、没有定语从句或该题没有错误时不做盲析；盲析漏答整次复核失败', async () => {
    const translate = syntaxRequest(
      '分析主干并翻译：The workshop which our teacher recommended starts tomorrow.',
      '主干The workshop starts tomorrow；翻译：老师推荐的工作坊明天开始。',
      '拆分主句和从句：Our teacher said the workshop starts tomorrow.',
      '主句Our teacher said；宾语从句the workshop starts tomorrow。'
    );
    const p = preparedFor(translate),
      wire = mixedDiagnosticReply(p);
    wire.errors.push(syntaxError('q1', '翻译漏译', '须译出推荐'), syntaxError('q4', '从句类型错误', '须写出从句类型'));
    const calls = [];
    await verifyCoachErrors(p, JSON.stringify(wire), async (verifier) => {
      calls.push(verifier.writingOutput.schema);
      return JSON.stringify({
        reviews: [
          { index: 1, required: true, wrong: true, reason: '略' },
          { index: 2, required: true, wrong: true, reason: '略' }
        ],
        blanks: [fill(['in'])]
      });
    });
    expect(calls[0].properties).not.toHaveProperty('syntax');
    const c = preparedFor(cycling()),
      only = mixedDiagnosticReply(c);
    only.errors.push(syntaxError('q4', 'whom成分判断错误', 'whom是从句主语'));
    const { content, receipt } = await verifyCoachErrors(c, JSON.stringify(only), verdict({ blanks: [fill(['in'])] }));
    expect(receipt).toMatchObject({ status: 'failed', checked: 2 });
    expect(JSON.parse(content).errors).toHaveLength(2);
  });
  // 摸底开发集 6 份样本的两道句法题，正确盲析下逐份比对：只有 robotics 的 q4（修饰对象写成 school）不一致。
  it.each([
    ['The guide that we received explains the library rules.', ['The guide', 'explains', 'that we received', 'guide', 'we', 'received', '宾语'], '主干The guide explains the library rules；that we received是修饰guide的定语从句，that作received的宾语。', true],
    ['The librarian, who helped us yesterday, will attend the meeting.', ['The librarian', 'will attend', 'who helped us yesterday', 'librarian', 'who', 'helped', '主语'], '主句The librarian will attend the meeting；who helped us yesterday是非限制性定语从句，修饰librarian，who作从句主语。', true],
    ['The coach, whom we met last week, teaches beginners.', ['The coach', 'teaches', 'whom we met last week', 'coach', 'we', 'met', '宾语'], '主句The coach teaches beginners；whom we met last week是非限制性定语从句，修饰coach，whom是met的宾语。', true],
    ['The engineer, who designed the robot, visited our school.', ['The engineer', 'visited', 'who designed the robot', 'engineer', 'who', 'designed', '主语'], '主句The engineer visited our school；who designed the robot是非限制性定语从句，修饰school，who作从句主语。', false],
    ['The seeds which we planted have grown.', ['The seeds', 'have grown', 'which we planted', 'seeds', 'we', 'planted', '宾语'], '主干The seeds have grown；which we planted修饰seeds，which作planted的宾语。', true],
    ['The gardener, whose advice we followed, thanked our class.', ['The gardener', 'thanked', 'whose advice we followed', 'gardener', 'we', 'followed', '定语'], '主句The gardener thanked our class；whose advice we followed是非限制性定语从句，修饰gardener，whose修饰advice，advice是followed的宾语。', true],
    ['The bike that my father bought last year still runs well.', ['The bike', 'runs', 'that my father bought last year', 'bike', 'my father', 'bought', '宾语'], '主干The bike still runs well；that my father bought last year是定语从句，修饰bike。', true],
    ['The guide, who showed us around, answered every question.', ['The guide', 'answered', 'who showed us around', 'guide', 'who', 'showed', '主语'], '主句The guide answered every question；从句who showed us around修饰guide。', true],
    ['The volunteers who cleaned the park received a prize.', ['The volunteers', 'received', 'who cleaned the park', 'volunteers', 'who', 'cleaned', '主语'], '主干The volunteers received a prize；who cleaned the park修饰volunteers，who作cleaned的主语。', true],
    ['The park, which opened last spring, is near our school.', ['The park', 'is', 'which opened last spring', 'park', 'which', 'opened', '主语'], '主句The park is near our school；which opened last spring是非限制性定语从句，修饰park，which作从句主语。', true]
  ])('%s', (sentence, fields, note, agreed) => {
    const result = syntaxAgreement(sentence, parsed('s1', ...fields), note);
    expect(result.valid).toBe(true);
    expect(result.agreed).toBe(agreed);
  });
  it.each([
    ['主干混进从句动词', '主干The device tested works well；that our team tested修饰device。', 'trunk'],
    ['主干缺主句谓语', '主干The device；that our team tested修饰device。', 'trunk'],
    ['从句原文抄错', '主干The device works well；that our team tested works修饰device。', 'clause'],
    ['成分说成主语', '主干The device works well；that our team tested修饰device，that作从句主语。', 'role'],
    ['成分所属动词写错', '主干The device works well；that our team tested修饰device，that作works的宾语。', 'role'],
    ['限制性说成非限制性', '主干The device works well；that our team tested是非限制性定语从句，修饰device。', 'restrictive'],
    ['从句类型写错', '主干The device works well；that our team tested是状语从句，修饰device。', 'kind']
  ])('学生笔记有错（%s）时不删错', (_name, note, claim) => {
    const result = syntaxAgreement(
      'The device that our team tested works well.',
      parsed('s1', 'The device', 'works', 'that our team tested', 'device', 'our team', 'tested', '宾语'),
      note
    );
    expect(result).toMatchObject({ valid: true, agreed: false });
    expect(result.claims[claim]).toBe(false);
  });
  it('主干删去形容词后冠词随之改变（an→a）仍算一致', () => {
    expect(
      syntaxAgreement(
        'The speaker whom we invited gave an interesting talk.',
        parsed('s1', 'The speaker', 'gave', 'whom we invited', 'speaker', 'we', 'invited', '宾语'),
        '主干The speaker gave a talk；whom we invited是定语从句，修饰speaker。'
      )
    ).toMatchObject({ valid: true, agreed: true, claims: { trunk: true } });
  });
  it('笔记读不出主干时不删错', () => {
    expect(
      syntaxAgreement(
        'The device that our team tested works well.',
        parsed('s1', 'The device', 'works', 'that our team tested', 'device', 'our team', 'tested', '宾语'),
        'that our team tested修饰device，that作tested的宾语。'
      )
    ).toMatchObject({ valid: true, agreed: false });
  });
  it('返修只修结构：回执写明被拒字段的期望类型与允许键', () => {
    const p = prepared(),
      wire = mixedDiagnosticReply(p);
    wire.dimensionReviews = JSON.stringify(wire.dimensionReviews);
    let rejected;
    try {
      decodeCoachResponse(p, JSON.stringify(wire));
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toMatchObject({ code: 'COACH_INVALID', path: 'root.dimensionReviews', schemaKeyword: 'type' });
    const feedback = coachRepairFeedback(p, rejected, JSON.stringify(wire));
    expect(feedback.expected).toEqual({ type: 'object', keys: ['grammar', 'collocation', 'expression', 'task'] });
    const prompt = coachRepairPrompt(feedback);
    expect(prompt).toContain('"expected":{"type":"object"');
    expect(prompt).toContain('只按回执修正被拒字段的结构');
  });
  it('长度越界时回执写明上下限与原值长度', () => {
    const p = prepared(),
      wire = mixedDiagnosticReply(p);
    wire.errors[0].rule = '固'.repeat(200);
    let rejected;
    try {
      decodeCoachResponse(p, JSON.stringify(wire));
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toMatchObject({ code: 'COACH_INVALID', path: 'root.errors[0].rule', schemaKeyword: 'stringLength' });
    const feedback = coachRepairFeedback(p, rejected, JSON.stringify(wire));
    expect(feedback.expected).toMatchObject({ type: 'string', minLength: 1, maxLength: 180, actualLength: 200 });
    expect(coachRepairPrompt(feedback)).toContain('"maxLength":180,"actualLength":200');
  });
});
describe('新出搭配填空经盲填校准才下发', () => {
  const request = {
    ...base,
    phase: 'daily',
    feedbackVersion: undefined,
    dimensionContract: undefined,
    target: 'daily',
    input: '安排今天的训练',
    essayType: 'small',
    exerciseContract: COACH_EXERCISE_CONTRACT
  };
  const generated = (asked = request, pack = exercisePack()) =>
    parseCoachModelOutput(JSON.stringify({ message: '开始', tools: [], question: null, coach: pack }), asked).coach;
  const verifier = (reply) => {
    const calls = [];
    const call = async (verifierConfig, messages) => {
      calls.push({ verifierConfig, messages });
      if (reply instanceof Error) throw reply;
      return typeof reply === 'string' ? reply : JSON.stringify(reply);
    };
    return { calls, call };
  };
  const fills = (...accepted) => ({
    blanks: accepted.map((words, i) => ({ id: `b${i + 1}`, accepted: words, rule: '固定搭配' }))
  });
  it('只把三道搭配题的题干交给复核员盲填，一到两个词能填对就通过，收据不带答案', async () => {
    const { calls, call } = verifier(fills(['for'], ['for', 'to'], ['on']));
    const receipt = await calibrateCoachExercises(config, generated(), call);
    expect(receipt).toEqual({
      status: 'completed',
      checked: 3,
      blanks: [
        { cardId: 'c1', acceptedCount: 1 },
        { cardId: 'c2', acceptedCount: 2 },
        { cardId: 'c3', acceptedCount: 1 }
      ]
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].verifierConfig.writingOutput.contract).toBe('writing-exercise-calibration-v1');
    expect(JSON.parse(calls[0].messages[1].content)).toEqual({
      blanks: [
        { id: 'b1', task: 'We raise money ___ children.' },
        { id: 'b2', task: 'Please donate books ___ the sale.' },
        { id: 'b3', task: 'The sale will be held ___ Monday.' }
      ]
    });
    expect(JSON.stringify(receipt)).not.toMatch(/"for"|"on"/);
  });
  it.each([
    ['none', fills(['for'], [], ['on']), '没有单个英文单词能填对'],
    ['too-many', fills(['for'], ['for', 'to', 'at'], ['on']), '能填对的词超过两个']
  ])('能填对的词为零或超过两个时整套拒收，指明是哪一题：%s', async (_, reply, rule) => {
    const { call } = verifier(reply);
    await expect(calibrateCoachExercises(config, generated(), call)).rejects.toMatchObject({
      code: 'COACH_INVALID',
      path: 'cards[1].exercise.source',
      message: expect.stringContaining(rule)
    });
  });
  it.each([
    ['broken-json', '{"blanks":'],
    ['repeated-id', { blanks: ['b1', 'b1', 'b3'].map((id) => ({ id, accepted: ['for'], rule: '固定搭配' })) }],
    ['phrase', fills(['for'], ['take part'], ['on'])],
    ['timeout', Object.assign(new Error('复核时间不足'), { code: 'TIMEOUT' })]
  ])('复核失败时题目保持待核对、不当成已校准：%s', async (mode, reply) => {
    const { call } = verifier(reply);
    const coach = generated();
    const receipt = await calibrateCoachExercises(config, coach, call);
    expect(receipt).toMatchObject({ status: 'failed', checked: 3 });
    expect(receipt.failure).toBe(
      mode === 'broken-json' ? 'CALIBRATION_INVALID' : mode === 'timeout' ? 'TIMEOUT' : 'COACH_INVALID'
    );
    expect(coach.cards.slice(0, 3).every((card) => card.source.verified === false)).toBe(true);
  });
  it('停止生成时不吞掉取消', async () => {
    const { call } = verifier(Object.assign(new Error('stopped'), { code: 'CANCELLED' }));
    await expect(calibrateCoachExercises(config, generated(), call)).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  it('没通过工具与结构化往返检查的连接不发校准请求', async () => {
    const { calls, call } = verifier(fills(['for'], ['for'], ['on']));
    for (const unchecked of [
      { ...config, capabilityCheck: undefined },
      { ...config, capabilityCheck: { ...config.capabilityCheck, tools: false } },
      { ...config, source: 'platform' }
    ])
      expect(await calibrateCoachExercises(unchecked, generated(), call)).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it('摸底只校准第二题搭配填空', async () => {
    const asked = { ...request, phase: 'diagnostic', target: 'diagnostic' },
      sources = [
        'The book which I bought was useful.',
        'Many cyclists are interested ___ road safety.',
        '我们欢迎你参加读书会。',
        'The sale, which is open to everyone, starts soon.',
        'Write an email to invite your classmates to a science fair. About 100 words.'
      ],
      pack = {
        kind: 'diagnostic',
        cards: sources.map((source, i) => ({
          id: `d${i + 1}`,
          kind: 'diagnostic',
          exercise: { source, options: [] },
          sourceId: null
        }))
      };
    const { calls, call } = verifier(fills(['in']));
    expect(await calibrateCoachExercises(config, generated(asked, pack), call)).toMatchObject({
      status: 'completed',
      blanks: [{ cardId: 'd2', acceptedCount: 1 }]
    });
    expect(JSON.parse(calls[0].messages[1].content).blanks).toEqual([
      { id: 'b1', task: 'Many cyclists are interested ___ road safety.' }
    ]);
  });
  it('出题被拒时返修回执写明题号与规则，并提示空格只填一个单词', () => {
    const prepared = prepareCoachFeedbackModel(config, request);
    const error = Object.assign(new Error('搭配填空没有单个英文单词能填对；空格只留一个单词'), {
      code: 'COACH_INVALID',
      path: 'cards[1].exercise.source'
    });
    const feedback = coachRepairFeedback(prepared, error, JSON.stringify({ exercises: { c2: { english: 'x' } } }));
    expect(feedback).toMatchObject({ path: 'exercises.c2', rule: error.message });
    expect(coachRepairPrompt(feedback)).toContain('"path":"exercises.c2"');
    const words = Object.assign(new Error('写作任务字数须写约100词'), {
      code: 'COACH_INVALID',
      path: 'writing.prompt'
    });
    expect(coachRepairFeedback(prepared, words, '{}')).toMatchObject({ path: 'writing.prompt' });
    expect(coachSystemPrompt(request, prepared.writingOutput.schema)).toContain('恰好一个___且只能填一个英文单词');
    expect(coachSystemPrompt(request)).toContain('空格只能填一个英文单词');
  });
});
