import { describe, expect, it } from 'vitest';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
import { coachMaterialContext } from '@/services/learning/coach-material-context.js';
import { museLearningInsights } from '@/services/learning/muse-learning-insights.js';
import { museAccountUsage } from '@/services/learning/muse-account-usage.js';
import { museArtifacts, museHistory } from '@/services/learning/muse-workspace-data.js';
import {
  normalizeCoachOutput,
  parseCoachModelOutput,
  WRITING_COACH_CONTRACT
} from '../../laf-backend/functions/_shared/learning-writing-coach.js';

const now = Date.parse('2026-10-20T03:00:00Z');
function fixture() {
  const state = emptyLearningState('isolated-owner');
  const conversation = {
    id: 'coach',
    goal: '英语写作',
    at: now,
    messages: [],
    coach: { materialIds: ['source'], requests: [], days: [], library: [], startedDay: '2026-10-20', diagnostic: null }
  };
  state.conversations.push(conversation);
  state.materials.push({
    id: 'source',
    name: '整本资料',
    segments: [
      { id: 'p1', page: 1, content: 'Invitation letter. invite students to a workshop.' },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `p${index + 2}`,
        page: index + 2,
        content: `Travel plan chapter ${index + 2}.`
      }))
    ]
  });
  return { state, conversation };
}
describe('资料、学习洞察、成果与用量共用保存事实', () => {
  it('每轮从整本原件检索而非固定末页，保留确切片段和页码，并隔离未绑定资料', () => {
    const { state, conversation } = fixture();
    state.materials.push({ id: 'unbound', name: '其他目标私人材料', segments: [{ content: 'Invitation letter' }] });
    const before = JSON.stringify(state);
    const selected = coachMaterialContext(state, conversation, { task: 'Invitation letter', input: 'invite students' });
    expect(selected).toHaveLength(3);
    expect(selected[0]).toMatchObject({ name: '整本资料', page: 1 });
    expect(selected.every((part) => part.content.length <= 1100 && part.id.startsWith('source:page:'))).toBe(true);
    expect(
      selected.every((part) =>
        state.materials[0].segments.some(
          (segment) => (segment.page || null) === part.page && segment.content.includes(part.content)
        )
      )
    ).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(coachMaterialContext(emptyLearningState('other'), conversation, {})).toEqual([]);
  });
  it('按相关性覆盖多个已绑定原件；同等相关时轮换旧片段，不依赖模型自述记忆', () => {
    const { state, conversation } = fixture();
    conversation.coach.materialIds.push('second');
    state.materials.push({
      id: 'second',
      name: '搭配资料',
      segments: [{ page: 1, content: 'Invitation letter collocations.' }]
    });
    const first = coachMaterialContext(state, conversation, {});
    expect(new Set(first.map((item) => item.name)).size).toBe(2);
    conversation.coach.requests.push({ request: { sources: first } });
    const next = coachMaterialContext(state, conversation, {});
    expect(next.some((item) => !first.some((old) => old.content === item.content))).toBe(true);
  });
  it('新请求必须引用分享资料，旧无引用卡片仍可正常回看；优点与原答一并保留', () => {
    const request = {
      contract: WRITING_COACH_CONTRACT,
      phase: 'diagnostic',
      exam: 'english1',
      day: '2026-10-20',
      sources: [{ id: 'source:page:1', name: '资料', page: 1, content: 'Invitation letter.' }]
    };
    const cards = Array.from({ length: 5 }, (_, index) => ({
      id: `d${index + 1}`,
      kind: 'diagnostic',
      title: '摸底',
      prompt: 'Write a sentence.',
      sourceId: null
    }));
    expect(normalizeCoachOutput({ kind: 'diagnostic', cards }, request).cards).toHaveLength(5);
    expect(() =>
      parseCoachModelOutput(JSON.stringify({ message: '开始', coach: { kind: 'diagnostic', cards } }), request)
    ).toThrow('训练未引用');
    cards[0].sourceId = 'source:page:1';
    cards[0].sourceQuote = 'Invitation letter.';
    cards[0].sourcePage = 1;
    expect(
      parseCoachModelOutput(JSON.stringify({ message: '开始', coach: { kind: 'diagnostic', cards } }), request).coach
        .cards[0].source.page
    ).toBe(1);
  });
  it('优点只取明确反馈，不将未写优点的旧记录、采纳或自评升级为客观掌握', () => {
    const { state, conversation } = fixture();
    conversation.coach.diagnostic = {
      answers: [{ answer: '原答' }],
      feedback: {
        id: 'f1',
        weaknesses: ['主谓一致'],
        strengths: ['目的明确'],
        lines: [{ original: '原答', advice: '先找主语，再核对动词单复数。', rewrite: '改写' }],
        phrases: [],
        dimensions: []
      }
    };
    const before = JSON.stringify(state);
    const data = museLearningInsights(state, now);
    expect(data.weaknesses[0]).toMatchObject({ label: '主谓一致' });
    expect(data.weaknesses[0].evidence[0].feedback.lines[0].original).toBe('原答');
    expect(data.strengths.map((item) => item.label)).toEqual(['目的明确']);
    expect(data).toMatchObject({ submitted: 1, familiar: 0, essays: 0 });
    expect(JSON.stringify(state)).toBe(before);
    delete conversation.coach.diagnostic.feedback.strengths;
    expect(museLearningInsights(state, now).strengths).toEqual([]);
  });
  it('只收集助手提供的真实输出链接，分类 PPT、动画和媒体，不执行代码或恢复已删对话', () => {
    const { state, conversation } = fixture();
    conversation.messages = [
      {
        id: 'm1',
        role: 'assistant',
        at: now,
        content:
          '[课件](https://files.example/writing.pptx) [动画](https://files.example/lesson.gif) [视频](https://files.example/lesson.mp4) [图片](https://files.example/a.png) ` [示例](https://files.example/fake.pptx) ` [恶意](javascript:alert)'
      },
      { id: 'm2', role: 'user', content: '[用户链接](https://files.example/private.mp4)' }
    ];
    const output = museArtifacts(state).filter((item) => item.url);
    expect(output.map((item) => item.kind)).toEqual(['presentation', 'animation', 'video', 'image']);
    expect(output.every((item) => item.conversationId === 'coach')).toBe(true);
    state.conversations = [];
    expect(museArtifacts(state).filter((item) => item.url)).toEqual([]);
    expect(museHistory(state)).toEqual([]);
  });
  it('Pro/Max必须来自订阅记录；第三方Tokens和费用只取收据，缺失保持待确认', () => {
    expect(museAccountUsage(null)).toEqual({ tier: null, subscription: null, quota: null, models: [] });
    const snapshot = {
      entitlement: { weeklyUnits: 100, spent: 21, reserved: 4, week: '2026-W43' },
      subscription: { plan: 'pro', status: 'active' },
      calls: [
        {
          source: 'byok',
          provider: 'DeepSeek',
          modelId: 'one',
          model: 'selected',
          costStatus: 'settled',
          actualCost: 0.02,
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        },
        { source: 'byok', provider: 'DeepSeek', modelId: 'one', model: 'selected', costStatus: 'pending', usage: null },
        { source: 'platform', model: 'domestic', costStatus: 'settled', actualCost: 2 }
      ]
    };
    const before = JSON.stringify(snapshot),
      result = museAccountUsage(snapshot);
    expect(result).toMatchObject({ tier: 'pro', quota: { percent: 21, remaining: 75 } });
    expect(result.models).toHaveLength(1);
    expect(result.models[0]).toMatchObject({ tokens: 30, count: 2, missingUsage: 1, cost: 0.02, pendingCost: 1 });
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(museAccountUsage({ ...snapshot, subscription: null }).tier).toBeNull();
  });
});
