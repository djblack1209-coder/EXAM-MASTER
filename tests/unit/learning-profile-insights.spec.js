import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
import { createLearningRepository } from '@/services/learning/learning-repository.js';
import { learningInsights } from '@/services/learning/learning-insights.js';
import LearningProfileDraft from '@/components/business/learning/learning-profile-draft.vue';

describe('fact based learning archive', () => {
  it('excludes hinted, revised and uncertain answers from independent correct, without mutating history', () => {
    const state = emptyLearningState('insights', 'America/Los_Angeles');
    state.questions.push({ id: 'q', version: 1, subject: '数学', knowledgePoint: '占比' });
    const at = Date.parse('2026-10-18T06:30:00Z');
    state.attempts.push(
      ...[
        { id: 'independent', kind: 'first', hints: [], grade: { status: 'reliable', outcome: 'correct' } },
        {
          id: 'hinted',
          kind: 'review',
          hints: [{ content: '提示' }],
          grade: { status: 'reliable', outcome: 'correct' }
        },
        { id: 'revision', kind: 'revision', hints: [], grade: { status: 'reliable', outcome: 'correct' } },
        { id: 'pending', kind: 'variant', hints: [], grade: { status: 'pending', outcome: null } },
        {
          id: 'corrected',
          kind: 'redo',
          hints: [],
          grade: { status: 'pending' },
          corrections: [{ grade: { status: 'reliable', outcome: 'wrong' } }]
        }
      ].map((item) => ({ ...item, at, questionKey: 'q@1', conversationId: 'c' }))
    );
    const original = JSON.stringify(state),
      result = learningInsights(state, at);
    expect(result.units[0]).toMatchObject({ reliable: 4, independent: 1, pending: 1 });
    expect(result.units[0].evidenceIds).toHaveLength(5);
    expect(result.days[0]).toMatchObject({ day: '2026-10-17', answers: 5, reviews: 1, pending: 1 });
    expect(result.progress.total).toBeNull();
    expect(JSON.stringify(state)).toBe(original);
  });
  it('counts today’s submitted modules only and uses saved timezone for deadline/calendar', () => {
    const state = emptyLearningState('insights', 'America/Los_Angeles');
    state.conversations.push({
      id: 'c',
      goal: '数学',
      messages: [],
      journey: { moduleIds: ['a', 'b'] },
      trainingGroups: [
        { moduleId: 'a', day: '2026-10-17', submittedBy: 'old' },
        { moduleId: 'b', day: '2026-10-18', submittedBy: 'new' }
      ]
    });
    state.profile.push({
      id: 'deadline',
      scope: '数学',
      field: 'deadline',
      value: '2026-10-20',
      source: 'self_report'
    });
    state.reviews.push({ questionKey: 'other@1', due: Date.parse('2026-10-19T10:00Z') });
    const result = learningInsights(state, Date.parse('2026-10-18T12:00Z'), 'c');
    expect(result.progress).toEqual({ completed: 1, total: 2 });
    expect(result.daysLeft).toBe(2);
    expect(result.days).toEqual([]);
  });
});

it('validates all profile fields before an atomic save, preserving old facts on invalid deadline', () => {
  const values = new Map();
  const storage = {
    get: (key, fallback) => (values.has(key) ? structuredClone(values.get(key)) : fallback),
    save: (key, value) => {
      values.set(key, structuredClone(value));
      return true;
    },
    remove: (key) => values.delete(key)
  };
  const repository = createLearningRepository(storage, () => 'profile-owner');
  const before = repository.read(),
    at = Date.now();
  const ops = [
    { id: 'goal', type: 'profile.set', at, data: { field: 'goal', value: 'Addition', source: 'self_report' } },
    { id: 'deadline', type: 'profile.set', at, data: { field: 'deadline', value: '2026-02-30', source: 'self_report' } }
  ];
  expect(() => repository.commitBatch(ops, before.revision)).toThrow('日期');
  expect(repository.read()).toEqual(before);
  ops[1].data.value = '2026-12-01';
  repository.commitBatch(ops, before.revision);
  expect(repository.read().profile).toHaveLength(2);
});

it('keeps profile choices as a draft; skipping and closing never confirms facts', async () => {
  const wrapper = mount(LearningProfileDraft, {
    props: { goal: 'Learn fractions' },
    global: { stubs: { BaseIcon: true } }
  });
  try {
    expect(wrapper.find('input').element.value).toBe('Learn fractions');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '下一步')
      .trigger('tap');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '刚刚开始')
      .trigger('tap');
    expect(wrapper.emitted('confirm')).toBeUndefined();
    await wrapper.find('button[aria-label="关闭档案草稿"]').trigger('tap');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  } finally {
    wrapper.unmount();
  }
});

it('does not mix self-reported profile fields across goals in the global archive', () => {
  const state = emptyLearningState('insights', 'UTC');
  state.profile.push(
    { field: 'goal', scope: 'A', value: 'A', source: 'self_report' },
    { field: 'foundation', scope: 'B', value: 'Beginner', source: 'self_report' }
  );
  expect(learningInsights(state).profile).toEqual({});
});
