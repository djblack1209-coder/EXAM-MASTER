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
  verifyCoachErrors
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
    wire.lines.push({ quoteId: 'q1', advice: '没写出关系代词的句法功能' });
    wire.errors.push({
      label: '未写关系代词功能',
      quoteId: 'q1',
      dimension: '任务完成',
      errorText: null,
      replacement: null,
      rule: '须写出关系代词在从句中的功能'
    });
    wire.dimensionReviews.task.comment = '缺少关系代词功能说明';
    return wire;
  };
  const fill = (accepted) => ({ id: 'b1', accepted, label: 'interested in', rule: 'be interested in 是固定搭配，介词用 in' });
  const verdict = (raw) => async () => JSON.stringify(raw);
  it('题干未要求的挑错被删除，填空只给题干不给原答，档位按盲填比对', async () => {
    const p = prepared();
    const calls = [];
    const { content, receipt } = await verifyCoachErrors(p, JSON.stringify(overflagged(p)), async (verifier, messages) => {
      calls.push({ verifier, messages });
      return verdict({
        reviews: [{ index: 1, required: false, wrong: true, reason: '题目只要求主干和修饰对象，原答已答出' }],
        blanks: [fill(['in'])]
      })();
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].verifier.writingOutput.contract).toBe('writing-error-verification-v1');
    const sent = JSON.parse(calls[0].messages[1].content);
    expect(sent.errors.map((item) => item.label)).toEqual(['未写关系代词功能']);
    expect(sent.blanks).toEqual([{ id: 'b1', task: '补全固定搭配：We are interested ___ science. 只填介词。' }]);
    expect(calls[0].messages[1].content).not.toContain('"at"');
    expect(receipt).toMatchObject({ status: 'completed', checked: 2, removed: 1, added: 0 });
    expect(receipt.reviews[0]).toMatchObject({ quoteId: 'q2', kept: true, wrong: true });
    expect(receipt.reviews[1]).toMatchObject({ quoteId: 'q1', kept: false, required: false });
    expect(receipt.blanks).toEqual([{ quoteId: 'q2', accepted: ['in'], correct: false }]);
    const coach = JSON.parse(decodeCoachResponse(p, content)).coach;
    expect(coach.dimensions.map((d) => [d.name, d.score])).toEqual([
      ['语法', 2],
      ['搭配', 1],
      ['表达', 2],
      ['任务完成', 2]
    ]);
    expect(coach.dimensions[3].comment).toBe('题目只要求主干和修饰对象，原答已答出');
    expect(coach.lines.find((line) => line.original.startsWith('主干')).advice).toBe(
      '题目只要求主干和修饰对象，原答已答出'
    );
    expect(coach.weaknesses).toEqual(['固定搭配介词选择错误']);
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
    ['漏答填空', verdict({ reviews: [{ index: 1, required: true, wrong: false, reason: '略' }] })],
    [
      '重复回答',
      verdict({
        reviews: [
          { index: 1, required: true, wrong: false, reason: '略' },
          { index: 1, required: true, wrong: false, reason: '略' }
        ],
        blanks: [fill(['in'])]
      })
    ],
    [
      '填空列出短语',
      verdict({ reviews: [{ index: 1, required: true, wrong: false, reason: '略' }], blanks: [fill(['interested in'])] })
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
