import { describe, expect, it } from 'vitest';
import { emptyLearningState, applyLearningOperation } from '@/services/learning/learning-domain.js';
import {
  INTAKE_CHOICES,
  normalizeIntakeReply,
  parseIntakeOutput
} from '../../laf-backend/functions/_shared/learning-intake.js';
import { museLearningLibrary } from '@/services/learning/muse-workspace-data.js';
import { reminderJobs } from '../../laf-backend/functions/_shared/learning-reminders.js';
import { dayKey } from '@/services/learning/learning-domain.js';
import { MODEL_CONNECTION_PRESETS } from '../../laf-backend/functions/_shared/ai-providers/model-endpoints.js';
import { modelBrand } from '@/config/model-brands.js';
import { existsSync } from 'node:fs';

const at = Date.parse('2026-10-21T12:00:00Z');
const greeting = () => ({
  message: '你在准备什么？',
  intake: { options: INTAKE_CHOICES, input: true, profile: null },
  question: null,
  tools: []
});
function harness() {
  let state = emptyLearningState('intake-student'),
    serial = 0;
  return {
    get state() {
      return state;
    },
    apply(type, data) {
      const outcome = applyLearningOperation(state, { id: `operation-${++serial}`, type, data, at });
      state = outcome.state;
      return outcome.result;
    }
  };
}
function proposal(profile) {
  return { message: '按这个目标开始吗？', intake: { options: [], input: false, profile }, question: null, tools: [] };
}
function confirmed(category = 'kaoyan', exam = 'cs408', subjects = ['数据结构'], minutes = 15) {
  const h = harness();
  h.apply('intake.request', { requestId: 'first', modelId: 'connected-model', explicit: true });
  h.apply('intake.result', { requestId: 'first', modelId: 'connected-model', reply: greeting() });
  h.apply('intake.request', {
    requestId: 'second',
    modelId: 'connected-model',
    answer: `计算机考研，${subjects.join('、')}，零基础，15分钟`,
    explicit: true
  });
  h.apply('intake.result', {
    requestId: 'second',
    modelId: 'connected-model',
    reply: proposal({ goal: '计算机考研', category, exam, subjects, minutes, deadline: null, foundation: '零基础' })
  });
  return h;
}
describe('model-authored intake and saved subject library', () => {
  it('requires an actual receipt, exact first choices and no execution tools', () => {
    const h = harness();
    expect(h.state.intake).toBeUndefined();
    expect(() => h.apply('intake.result', { requestId: 'old', modelId: 'model', reply: greeting() })).toThrow();
    expect(normalizeIntakeReply(greeting(), true).intake.options.map((x) => x.label)).toEqual([
      '四六级',
      '考研',
      '考公',
      '雅思',
      '托福',
      '其他'
    ]);
    expect(() => normalizeIntakeReply({ ...greeting(), message: '先选科目' }, true)).toThrow();
    expect(() => normalizeIntakeReply({ ...greeting(), tools: [{ name: 'plan' }] }, true)).toThrow();
    expect(() =>
      parseIntakeOutput(JSON.stringify(greeting()), { turns: Array(5).fill({ question: '问', answer: '答' }) })
    ).toThrow();
  });
  it('keeps a proposal out of learning facts until explicit acceptance, then creates one compatible coach', () => {
    const h = confirmed();
    expect(h.state.conversations).toHaveLength(0);
    expect(() => h.apply('intake.accept', {})).toThrow();
    const conversation = h.apply('intake.accept', { explicit: true });
    expect(conversation.studyProfile.subjects).toEqual(['数据结构']);
    expect(conversation.coach.profile).toMatchObject({
      exam: 'cs408',
      minutes: 15,
      subjects: ['kaoyan_major'],
      foundation: '零基础'
    });
    expect(conversation.messages.map((m) => m.role)).toEqual(['assistant', 'user']);
    expect(() => h.apply('intake.accept', { explicit: true })).toThrow();
    expect(h.state.attempts).toHaveLength(0);
  });
  it('retains answered intake turns across model changes and failed retries, rejecting the old proposal', () => {
    const h = confirmed();
    const turns = structuredClone(h.state.intake.turns);
    h.apply('intake.request', { requestId: 'new-model-request', modelId: 'another-model', explicit: true });
    expect(h.state.intake.turns).toEqual(turns);
    expect(h.state.intake.reply).toBeNull();
    expect(() =>
      h.apply('intake.result', { requestId: 'second', modelId: 'connected-model', reply: greeting() })
    ).toThrow('旧模型建档回复不再适用');
    h.apply('intake.failed', { requestId: 'new-model-request', final: true });
    h.apply('intake.request', { requestId: 'retry', modelId: 'another-model', explicit: true });
    expect(h.state.intake.turns).toEqual(turns);
    h.apply('intake.request', { requestId: 'restart', modelId: 'another-model', explicit: true, reset: true });
    expect(h.state.intake.turns).toEqual([]);
    expect(h.state.conversations).toHaveLength(0);
  });
  it('keeps confirmed profile with unknown minutes unknown in the writing coach', () => {
    const h = confirmed('kaoyan', 'english2', ['英语'], null);
    const conversation = h.apply('intake.accept', { explicit: true });
    expect(conversation.studyProfile.minutes).toBeNull();
    expect(conversation.coach.profile.minutes).toBeNull();
  });
  it('does not coerce law, CET or other subjects into English writing', () => {
    const h = confirmed('kaoyan', 'general', ['刑法', '民法']);
    const conversation = h.apply('intake.accept', { explicit: true });
    expect(conversation.coach).toBeUndefined();
    expect(conversation.studyProfile.exam).toBe('general');
    expect(() =>
      normalizeIntakeReply(proposal({ ...conversation.studyProfile, category: 'cet', exam: 'english1' }))
    ).toThrow();
  });
  it('shows the approved four subject filters without inventing records, classifies saved assets and retains every output format', () => {
    const empty = emptyLearningState('empty');
    const emptyBefore = JSON.stringify(empty);
    const emptyLibrary = museLearningLibrary(empty, at);
    // 批次 12B：学科是只读筛选入口，零记录学科同样保留。
    expect(emptyLibrary.sections.map((x) => [x.id, x.count])).toEqual([
      ['all', 0],
      ['unclassified', 0],
      ['subject:英语', 0],
      ['subject:政治', 0],
      ['subject:数学', 0],
      ['subject:专业课', 0]
    ]);
    expect(emptyLibrary.items).toEqual([]);
    expect(JSON.stringify(empty)).toBe(emptyBefore);
    const h = confirmed('kaoyan', 'general', ['刑法', '民法']);
    const c = h.apply('intake.accept', { explicit: true });
    c.messages.push({
      id: 'result',
      role: 'assistant',
      content: '[讲解](https://example.com/law.pptx) [练习](https://example.com/law.mp4)',
      at
    });
    const before = JSON.stringify(h.state),
      library = museLearningLibrary(h.state, at);
    expect(library.groups.find((g) => g.id === 'subjects').items.map((x) => [x.label, x.count])).toEqual([
      ['英语', 0],
      ['政治', 0],
      ['数学', 0],
      ['专业课', 4]
    ]);
    expect(library.items.map((x) => x.kind)).toEqual(expect.arrayContaining(['presentation', 'video', 'note']));
    expect(JSON.stringify(h.state)).toBe(before);
    expect(library.sections.find((x) => x.id === 'subject:专业课').itemIds).toEqual(library.items.map((x) => x.id));
  });
  it('schedules confirmed general study goals without inventing attempts or completion', () => {
    const h = confirmed('cet', 'general', ['阅读']);
    const c = h.apply('intake.accept', { explicit: true });
    h.apply('reminder.set', {
      conversationId: c.id,
      kind: 'study',
      time: '20:00',
      repeatDays: [0, 1, 2, 3, 4, 5, 6],
      timezone: h.state.timezone,
      enabled: true
    });
    expect(reminderJobs(h.state, at, { dayKey })).toHaveLength(28);
    expect(h.state.attempts).toHaveLength(0);
  });
  it('ships a matching local brand mark for every connector', () => {
    // 批次 7 / 12A：15 家国产连接器归入 general，海外连接器仍为 other。
    const domestic = [
      '智谱',
      'Z.ai',
      'DeepSeek',
      'ModelScope',
      'SiliconFlow',
      '通义千问（阿里云百炼）',
      '月之暗面 Kimi',
      '豆包（火山方舟）',
      '百度文心（千帆）',
      '腾讯混元',
      'MiniMax',
      '阶跃星辰',
      '讯飞星火',
      '零一万物',
      '百川智能'
    ];
    for (const provider of MODEL_CONNECTION_PRESETS) {
      const brand = modelBrand(provider.provider);
      expect(brand.logo, provider.provider).toBeTruthy();
      expect(existsSync(`src${brand.logo}`), provider.provider).toBe(true);
      expect(brand.group).toBe(domestic.includes(provider.provider) ? 'general' : 'other');
    }
    expect(MODEL_CONNECTION_PRESETS.filter((provider) => domestic.includes(provider.provider))).toHaveLength(15);
  });
});
