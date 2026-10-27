import { describe, expect, it } from 'vitest';
import {
  COACH_VIOLATION_CLASS,
  WRITING_COACH_CONTRACT,
  normalizeCoachOutput,
  parseCoachModelOutput
} from '../../laf-backend/functions/_shared/learning-writing-coach.js';
import { coachFixture } from '../fixtures/writing-coach.js';

function requestFor(phase) {
  return {
    contract: WRITING_COACH_CONTRACT,
    phase,
    target: phase === 'feedback' ? 'diagnostic' : phase,
    exam: 'english1',
    day: '2026-10-19',
    sources: [],
    input: 'Synthetic answer.'
  };
}

function expectViolation(run, message, path) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: 'COACH_INVALID', message, path });
    return;
  }
  expect.fail('应拒绝违规输出');
}

describe('教学输出违规的字段路径', () => {
  it.each([
    ['diagnostic', 'kind', '模型返回的教学阶段不符', (v) => (v.kind = 'daily')],
    ['diagnostic', 'cards', '缺少训练卡片', (v) => (v.cards = null)],
    ['diagnostic', 'cards[1].kind', '内容为空或过长', (v) => (v.cards[1].kind = '')],
    ['diagnostic', 'cards[2].prompt', '内容为空或过长', (v) => (v.cards[2].prompt = 'a'.repeat(1201))],
    ['diagnostic', 'cards[1].id', '卡片编号不合法', (v) => (v.cards[1].id = 'bad id')],
    ['diagnostic', 'cards[3].id', '卡片编号重复', (v) => (v.cards[3].id = v.cards[0].id)],
    ['diagnostic', 'cards', '摸底需依次覆盖五项', (v) => v.cards.pop()],
    ['diagnostic', 'cards[2].id', '摸底需依次覆盖五项', (v) => (v.cards[2].id = 'd9')],
    ['diagnostic', 'cards[4].kind', '摸底需依次覆盖五项', (v) => (v.cards[4].kind = 'translate_en')],
    ['diagnostic', 'cards[3].sourceId', '模型引用了未分享的资料', (v) => (v.cards[3].sourceId = 'unshared')],
    [
      'diagnostic',
      'cards[4].source.id',
      '模型引用了未分享的资料',
      (v) => (v.cards[4].source = { kind: 'private_material', id: 'unshared' })
    ],
    ['daily', 'cards', '每日卡片数量或类型不符', (v) => v.cards.pop()],
    ['daily', 'writing', '写作结构需二至三段', (v) => (v.writing = null)],
    ['daily', 'writing.patterns', '写作结构需二至三段', (v) => (v.writing.patterns = [])],
    ['daily', 'writing.patterns', '大作文需三段', (v, r) => (r.essayType = 'large')],
    ['daily', 'writing.prompt', '内容为空或过长', (v) => (v.writing.prompt = '')],
    ['daily', 'writing.patterns[1]', '每段需一至两个句式', (v) => (v.writing.patterns[1] = [])],
    ['daily', 'writing.patterns[1][1]', '内容为空或过长', (v) => v.writing.patterns[1].push(' ')],
    ['daily', 'writing.sourceId', '模型引用了未分享的资料', (v) => (v.writing.sourceId = 'unshared')],
    [
      'daily',
      'writing.source.id',
      '模型引用了未分享的资料',
      (v) => (v.writing.source = { kind: 'private_material', id: 'unshared' })
    ],
    ['summary', 'learned', '内容数量不合法', (v) => (v.learned = 'not an array')],
    ['summary', 'tomorrow[1]', '内容为空或过长', (v) => v.tomorrow.push(' ')],
    ['feedback', 'target', '反馈与当前原答不符', (v) => (v.target = 'another-target')],
    ['feedback', 'lines', '反馈与当前原答不符', (v) => (v.lines = [])],
    ['feedback', 'lines[0].original', '内容为空或过长', (v) => (v.lines[0].original = '')],
    ['feedback', 'lines[0].original', '反馈没有引用当前原答', (v) => (v.lines[0].original = 'Fabricated answer.')],
    ['feedback', 'lines[0].advice', '内容为空或过长', (v) => (v.lines[0].advice = ' ')],
    ['feedback', 'lines[0].rewrite', '内容为空或过长', (v) => (v.lines[0].rewrite = 'a'.repeat(1001))],
    ['feedback', 'dimensions', '写作维度不合法', (v) => (v.dimensions = {})],
    [
      'essay',
      'dimensions',
      '写作维度不合法',
      (v) => v.dimensions.push({ name: '额外维度', comment: 'Synthetic feedback.' })
    ],
    ['essay', 'dimensions[1].name', '写作维度不合法', (v) => (v.dimensions[1].name = '官方分数')],
    ['essay', 'dimensions[2].comment', '内容为空或过长', (v) => (v.dimensions[2].comment = '')],
    ['essay', 'dimensions', '成文反馈需覆盖四维', (v) => v.dimensions.pop()],
    ['feedback', 'weaknesses[1]', '内容为空或过长', (v) => v.weaknesses.push('')],
    ['feedback', 'phrases', '内容数量不合法', (v) => (v.phrases = 'not an array')]
  ])('%s: %s（%s）', (phase, path, message, violate) => {
    const request = requestFor(phase);
    const output = coachFixture(request);
    violate(output, request);
    expectViolation(() => normalizeCoachOutput(output, request), message, path);
  });
});

describe('模型响应解析的字段路径', () => {
  it('新回复的优点需要逐字原答证据，历史记录保持原样', () => {
    const request = requestFor('feedback');
    const value = { ...coachFixture(request), strengths: ['句子结构完整'] };
    const parse = (coach) => parseCoachModelOutput(JSON.stringify({ message: '继续', coach }), request).coach;
    expect(normalizeCoachOutput(value, request).strengths).toEqual(['句子结构完整']);
    expect(parse(value).strengths).toEqual([]);
    expect(
      parse({ ...value, strengthEvidence: [{ label: '句子结构完整', quote: 'Fabricated answer.' }] }).strengths
    ).toEqual([]);
    const grounded = parse({ ...value, strengthEvidence: [{ label: '句子结构完整', quote: request.input }] });
    expect(grounded.strengths).toEqual(['句子结构完整']);
    expect(normalizeCoachOutput(grounded, request).strengthEvidence).toEqual([
      { label: '句子结构完整', quote: request.input }
    ]);
    expect(parse({ ...value, strengths: [{ label: '句子结构完整', quote: request.input }] }).strengths).toEqual([
      '句子结构完整'
    ]);
    expect(parse({ ...value, strengths: [{ label: '句子结构完整', quote: 'Fabricated answer.' }] }).strengths).toEqual(
      []
    );
    expect(() =>
      parse({ ...value, strengths: [{ label: '句子结构完整', quote: request.input, tool: 'finish' }] })
    ).toThrow();
  });
  it('JSON 无法解析时定位原始响应，不猜测内部字段', () => {
    expectViolation(
      () => parseCoachModelOutput('{', requestFor('summary')),
      '模型未返回完整教学卡片，请保留原答后查看请求状态',
      'raw'
    );
  });

  it.each([
    ['question', '写作带练不接受模型工具', { question: {} }],
    ['tools', '写作带练不接受模型工具', { tools: [{ name: 'unexpected' }] }],
    ['message', '内容为空或过长', { message: '' }],
    ['learned[1]', '内容为空或过长', { coach: { kind: 'summary', learned: ['合成小结', ''] } }]
  ])('%s（%s）', (path, message, overrides) => {
    const request = requestFor('summary');
    const raw = JSON.stringify({ message: '合成过渡语', coach: coachFixture(request), ...overrides });
    expectViolation(() => parseCoachModelOutput(raw, request), message, path);
  });
});

describe('教学违规分类', () => {
  it('分类对象冻结，且仅两条指定消息是 shortfall', () => {
    expect(Object.isFrozen(COACH_VIOLATION_CLASS)).toBe(true);
    expect(Object.entries(COACH_VIOLATION_CLASS).filter(([, kind]) => kind === 'shortfall')).toEqual([
      ['成文反馈需覆盖四维', 'shortfall'],
      ['大作文需三段', 'shortfall']
    ]);
    expect(Reflect.set(COACH_VIOLATION_CLASS, '大作文需三段', 'fabrication')).toBe(false);
  });

  it.each(['内容为空或过长', '模型引用了未分享的资料', '未知违规消息', '__proto__', 'constructor'])(
    '%s 默认是 fabrication',
    (message) => {
      expect(COACH_VIOLATION_CLASS[message]).toBe('fabrication');
    }
  );
});
