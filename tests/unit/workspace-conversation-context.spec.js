import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
import { museLearningLibrary, museHistory, museUsage } from '@/services/learning/muse-workspace-data.js';
import { museLearningInsights } from '@/services/learning/muse-learning-insights.js';
import { workspaceConversationContext, scopeWorkspaceState } from '@/services/learning/workspace-context.js';
const now = Date.parse('2026-10-21T12:00:00Z');
function fixture() {
  const state = emptyLearningState('owner', 'Asia/Shanghai');
  state.conversations = [
    {
      id: 'english',
      goal: '英语二申请信',
      at: now,
      materialIds: ['m'],
      messages: [{ id: 'source-one', role: 'assistant', content: '申请信称呼与结束语', at: now }]
    },
    {
      id: 'other',
      goal: '我的资料练习',
      at: now,
      messages: [{ id: 'source-two', role: 'assistant', content: '分析你的资料', at: now }]
    }
  ];
  state.materials = [
    { id: 'm', name: '申请信.pdf', segments: [] },
    { id: 'unknown', name: '数学.pdf', segments: [] }
  ];
  state.events = [
    { id: 'r-one', type: 'model.request', at: now, data: { conversationId: 'english', requestId: 'one' } },
    { id: 'r-two', type: 'model.request', at: now, data: { conversationId: 'other', requestId: 'two' } }
  ];
  return state;
}
describe('saved conversation categories and shared read context', () => {
  it('uses saved targets and source links, not filenames as subjects; renames and new messages update counts', () => {
    const state = fixture(),
      before = JSON.stringify(state),
      library = museLearningLibrary(state, now);
    expect(library.groups[0].id).toBe('conversations');
    expect(library.groups[0].items.find((g) => g.id === 'conversation:english')).toMatchObject({
      label: '英语二申请信',
      count: 2
    });
    expect(library.items.find((i) => i.id === 'message:source-one')).toMatchObject({
      messageId: 'source-one',
      conversationId: 'english'
    });
    expect(library.items.find((i) => i.materialId === 'm').sources).toEqual([
      { conversationId: 'english', label: '英语二申请信' }
    ]);
    expect(library.items.find((i) => i.materialId === 'unknown')).toMatchObject({
      categoryIds: ['unclassified'],
      subjects: ['未分类']
    });
    expect(JSON.stringify(state)).toBe(before);
    state.conversations[0].goal = '申请信复习';
    state.conversations[0].messages.push({ id: 'new', role: 'assistant', content: '新的已保存内容', at: now });
    expect(museLearningLibrary(state, now).groups[0].items.find((g) => g.id === 'conversation:english')).toMatchObject({
      label: '申请信复习',
      count: 3
    });
  });
  it('shares one context between panels, never changes the active chat or writes facts, clears on account change', () => {
    const learning = reactive({
      state: fixture(),
      selectedConversationId: 'other',
      epoch: 'a',
      recordContext() {
        return this.epoch;
      }
    });
    const library = workspaceConversationContext(learning),
      insights = workspaceConversationContext(learning);
    const before = JSON.stringify(learning.state);
    library.id.value = 'conversation:english';
    expect(insights.id.value).toBe('conversation:english');
    expect(museHistory(insights.state.value).every((i) => i.conversationId === 'english')).toBe(true);
    expect(museUsage(insights.state.value, now).total).toBe(1);
    expect(museLearningInsights(insights.state.value, now).submitted).toBe(0);
    expect(learning.selectedConversationId).toBe('other');
    expect(JSON.stringify(learning.state)).toBe(before);
    learning.epoch = 'b';
    expect(library.id.value).toBe('all');
  });
  it('filters attempts/reviews by owning conversation while preserving originals and unknown ownership', () => {
    const state = fixture();
    state.attempts = [
      { id: 'a', conversationId: 'english', questionKey: 'q1' },
      { id: 'b', conversationId: 'other', questionKey: 'q2' }
    ];
    state.reviews = [{ questionKey: 'q1' }, { questionKey: 'q1', conversationId: 'other' }, { questionKey: 'q2' }];
    const before = JSON.stringify(state),
      scoped = scopeWorkspaceState(state, 'conversation:english');
    expect(scoped.attempts.map((a) => a.id)).toEqual(['a']);
    expect(scoped.reviews).toEqual([{ questionKey: 'q1' }]);
    expect(scopeWorkspaceState(state, 'unclassified').conversations).toHaveLength(0);
    expect(JSON.stringify(state)).toBe(before);
  });
});
