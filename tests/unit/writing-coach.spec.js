import { describe, it, expect } from 'vitest';
import {
  applyLearningOperation,
  emptyLearningState,
  inspectMaterialDeletion
} from '@/services/learning/learning-domain.js';
import {
  WRITING_METHOD,
  WRITING_COACH_CONTRACT,
  normalizeCoachRequest,
  normalizeCoachOutput,
  coachInputFor,
  coachEssayType,
  writingCoachDashboard
} from '../../laf-backend/functions/_shared/learning-writing-coach.js';
import { parsePastedMaterial } from '@/services/learning/material-intake.js';

// 明确的合成模型输出，仅验证编排和事实边界，不充当真实教学验收。
import { coachFixture } from '../fixtures/writing-coach.js';

function session() {
  let state = emptyLearningState('synthetic-user', 'Asia/Shanghai'),
    serial = 0,
    now = Date.parse('2026-10-18T03:00:00Z');
  const apply = (type, data = {}) => {
    const result = applyLearningOperation(state, {
      id: `test-${++serial}`,
      type,
      data: type.startsWith('coach.') ? { ...data, conversationId: 'c', explicit: true } : data,
      at: now
    });
    state = result.state;
    return result.result;
  };
  state = applyLearningOperation(state, {
    id: 'c',
    type: 'conversation.start',
    at: now,
    data: { goal: '考研英语一写作' }
  }).state;
  apply('coach.begin');
  apply('coach.profile', { profile: { exam: 'english1', deadline: '2026-12-22', minutes: 25 } });
  const coach = () => state.conversations[0].coach;
  const generate = (phase, target = phase) => {
    const c = coach(),
      day = c.days.find((d) => d.day === '2026-10-18');
    const request = normalizeCoachRequest({
      contract: WRITING_COACH_CONTRACT,
      phase,
      target,
      exam: 'english1',
      day: '2026-10-18',
      essayType: coachEssayType(c, '2026-10-18'),
      ...coachInputFor(c, day, phase, target)
    });
    const requestId = `r${++serial}`;
    apply('coach.request', { requestId, request, modelId: 'synthetic', binding: 'synthetic-binding' });
    apply('coach.result', { requestId, output: coachFixture(request) });
  };
  return {
    apply,
    generate,
    coach,
    get: () => state,
    nextDay: () => {
      now += 86400000;
    }
  };
}
describe('考研写作方法与完整已保存事实路径', () => {
  it('限定五项摸底和顺序、考试字数，拒绝伪造来源及不合法的动态目标', () => {
    expect(WRITING_METHOD.onboarding).toHaveLength(5);
    expect(WRITING_METHOD.diagnostic).toHaveLength(5);
    expect(WRITING_METHOD.words.english2.large).toBe('约150词');
    const base = { contract: WRITING_COACH_CONTRACT, phase: 'diagnostic', exam: 'english1', day: '2026-10-18' };
    expect(() => normalizeCoachRequest({ ...base, target: '__proto__' })).toThrow();
    expect(() => normalizeCoachRequest({ ...base, sources: {} })).toThrow();
    expect(() => normalizeCoachRequest({ ...base, day: '2026-02-30' })).toThrow();
    const request = normalizeCoachRequest(base),
      output = coachFixture(request);
    output.cards[0].sourceId = 'not-shared';
    expect(() => normalizeCoachOutput(output, request)).toThrow('未分享');
  });
  it('完整走通摸底、每日任务、逐段改写、句式采用、小结和次日复习；不升级可靠掌握', () => {
    const s = session();
    s.generate('diagnostic');
    expect(() => s.generate('daily')).toThrow();
    for (let i = 1; i <= 5; i++)
      s.apply('coach.answer', { target: 'diagnostic', cardId: `d${i}`, answer: 'Synthetic answer.' });
    s.generate('feedback', 'diagnostic');
    s.generate('daily');
    expect(s.coach().days[0].pack.cards.map((c) => c.kind)).toEqual([
      'collocation',
      'collocation',
      'collocation',
      'translate_zh',
      'translate_zh',
      'translate_en',
      'translate_en',
      'long_sentence'
    ]);
    for (let i = 0; i < 8; i++) {
      s.apply('coach.answer', { cardId: `c${i}`, answer: 'Synthetic answer.' });
      s.generate('feedback', `card-c${i}`);
    }
    s.apply('coach.analysis', {
      fields: { genre: 'letter', recipient: 'friend', purpose: 'invite', points: 'event', words: '100' }
    });
    s.generate('feedback', 'analysis');
    for (let i = 0; i < 2; i++) {
      expect(() => s.apply('coach.paragraph', { index: i, rewrite: true, text: 'premature' })).toThrow();
      s.apply('coach.paragraph', { index: i, text: 'I am writing to invite you.' });
      s.generate('feedback', `paragraph-${i}`);
      s.apply('coach.paragraph', { index: i, rewrite: true, text: 'I am writing to invite you to a reading event.' });
    }
    const feedback = s.coach().days[0].feedback['paragraph-0'];
    s.apply('coach.adopt', { feedbackId: feedback.id, phrase: feedback.phrases[0] });
    s.apply('coach.adopt', { feedbackId: feedback.id, phrase: feedback.phrases[0] });
    expect(s.coach().library).toHaveLength(1);
    s.generate('essay');
    s.generate('summary');
    s.apply('coach.finish');
    expect(writingCoachDashboard(s.coach(), '2026-10-18')).toMatchObject({
      weekDays: 1,
      essays: 1,
      learning: 1,
      familiar: 0,
      masteryBasis: 'self_report'
    });
    s.nextDay();
    expect(() =>
      s.apply('coach.review', {
        itemId: s.coach().library[0].id,
        answer: 'Recalled phrase.',
        rating: 3,
        schedule: { due: '2026-10-21T03:00:00Z' }
      })
    ).not.toThrow();
    expect(s.coach().library[0].reviews[0].source).toBe('self_report');
    expect(writingCoachDashboard(s.coach(), '2026-10-19').weekDays).toBe(1);
    expect(coachEssayType(s.coach(), '2026-10-25')).toBe('large');
    // 同步/备份重放同一批真实事件，事实看板保持一致。
    let restored = emptyLearningState('synthetic-user', 'Asia/Shanghai');
    for (const event of s.get().events) restored = applyLearningOperation(restored, event).state;
    expect(restored.conversations[0].coach).toEqual(s.coach());
  });
  it('未提交原答、切换日、重复反馈和未绑定资料都不能推进；删除资料同步脱敏派生带练', () => {
    const s = session();
    s.generate('diagnostic');
    expect(() => s.generate('feedback', 'diagnostic')).toThrow();
    expect(() =>
      s.apply('coach.answer', { day: '2026-10-17', target: 'diagnostic', cardId: 'd1', answer: 'old' })
    ).toThrow();
    const m = parsePastedMaterial('private synthetic material', 'm');
    s.apply('material.add', { material: m });
    s.apply('coach.material', { materialId: 'm' });
    const preview = inspectMaterialDeletion(s.get(), 'm');
    expect(preview.conversationIds).toEqual(['c']);
    s.apply('material.delete', {
      materialId: 'm',
      materialIds: preview.materialIds,
      questionKeys: preview.questionKeys
    });
    expect(JSON.stringify(s.get())).not.toContain('private synthetic material');
    expect(s.get().conversations[0].coach).toBeUndefined();
  });
});
