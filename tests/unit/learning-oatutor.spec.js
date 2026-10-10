import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation,
  summarizeLearning
} from '@/services/learning/learning-domain.js';
import { oatutorContent } from '../../laf-backend/functions/_shared/learning-oatutor-content.js';
import {
  OATUTOR_TASKS,
  createOatutorQuestion,
  oatutorItem,
  oatutorProgress,
  oatutorFinalReference
} from '../../laf-backend/functions/_shared/learning-oatutor.js';
import { parseAlgebraExpression } from '../../laf-backend/functions/_shared/learning-algebra.js';
import OatutorPractice from '@/components/business/learning/oatutor-practice.vue';
const clone = (v) => JSON.parse(JSON.stringify(v));
let store;
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  store = useConversationLearningStore();
  store.start('函数运算带练');
});
afterEach(() => {
  store.$dispose();
  vi.restoreAllMocks();
});
const act = (action, id, answer, opId) => store.oatutorAction(store.oatutorContext(), action, id, answer, opId);
const button = (w, name) => w.findAll('button').find((b) => b.text() === name);
const props = () => ({
  state: store.state,
  question: store.activeQuestion,
  context: store.oatutorContext(),
  action: store.oatutorAction,
  startTask: store.startOatutor
});
const stubs = { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' } };

describe('OATutor fixed licensed content with explicit local adaptations', () => {
  it('retains originals, precise revision, historical license evidence and scoped content license', () => {
    const pack = oatutorContent();
    expect(pack.revision).toBe('1925decc91567faf6203bdb41b9d52b14891426f');
    expect(pack.items).toHaveLength(4);
    expect(Object.keys(pack.originals)).toHaveLength(9);
    expect(pack.license).toBe('CC BY 4.0');
    expect(pack.gradingAuthority).toBe(false);
    expect(pack.licensingEvidence.publisherLicenseSha256).toBe(
      '97d24386ff776d7160b87031b259a942bd03c9939796cab6724ad5d17d2cf785'
    );
    const license = readFileSync('src/static/licenses/oatutor-functions-CC-BY-4.0.txt', 'utf8');
    expect(license).toContain('No endorsement is implied');
    expect(license).toContain('Attribution 4.0 International');
    expect(JSON.parse(readFileSync('package.json', 'utf8')).license).toBe('UNLICENSED');
    const path = Object.keys(pack.originals).find((p) => p.endsWith('a005bd5real2bDefaultPathway.json'));
    const raw = pack.originals[path].content;
    expect(raw.filter((n) => n.id === 'a005bd5real2b-h3')).toHaveLength(2);
    expect(raw[1].hintAnswer).toEqual(['$$x^2+2x-6-x^2$$']);
    for (const item of pack.items) {
      expect(new Set(item.nodes.map((n) => n.id)).size).toBe(item.nodes.length);
      item.nodes.forEach((n, i) =>
        expect(n.dependencies.every((dep) => item.nodes.slice(0, i).some((p) => p.id === dep))).toBe(true)
      );
      expect(item.changes.length).toBeGreaterThan(0);
      const q = createOatutorQuestion('source-question', 'source-conversation', item.id);
      expect(q.source.files).toHaveLength(3);
      expect(q.source.files.every((s) => /^[a-f0-9]{64}$/.test(s.sha256) && s.url.includes(pack.revision))).toBe(true);
    }
    pack.items[0].answer = 'tampered';
    expect(oatutorItem('sum').answer).not.toBe('tampered');
    expect(() => oatutorItem('sum', 2)).toThrow();
    expect(() => oatutorItem('unknown')).toThrow();
  });
  it('checks the adapted arithmetic and repairs rather than trusting upstream reference answers', () => {
    for (const [left, right] of [
      ['(x^2+2x)+(6-x^2)', '2x+6'],
      ['(x^2+2x)-(6-x^2)', '2x^2+2x-6'],
      ['(x^2+2x)*(6-x^2)', '-x^4-2x^3+6x^2+12x'],
      ['x^2+2x', 'x*(x+2)']
    ])
      expect(parseAlgebraExpression(left)).toEqual(parseAlgebraExpression(right));
    expect(parseAlgebraExpression('(x^2+2x)-(6-x^2)')).not.toEqual(parseAlgebraExpression('x^2+2x-6-x^2'));
    const difference = oatutorItem('difference');
    expect(difference.nodes[1].reference).toContain('−(6−x²)');
    expect(difference.nodes[2].reference).toContain('−6+x²');
    expect(oatutorItem('quotient').answer).toContain('x≠−√6 且 x≠√6');
    expect(oatutorItem('quotient').nodes[2].reference).toContain('分别为6或2');
  });
});

it.each(OATUTOR_TASKS.map((x) => x.id))('%s keeps raw answers, ordered help and identical private replay', (itemId) => {
  if (itemId !== 'sum') store.startOatutor(store.oatutorContext(), itemId);
  const main = clone(store.activeQuestion);
  store.submit('  我的完整原答\n保留空行  ', true, `main-${itemId}`);
  const first = clone(store.state.attempts[0]);
  expect(first.answer).toBe('  我的完整原答\n保留空行  ');
  const item = oatutorItem(itemId);
  expect(() => act('open', item.nodes.at(-1).id)).toThrow('前一步');
  for (const node of item.nodes) {
    const opened = act('open', node.id);
    expect(opened.hintId).toBeTruthy();
    const revision = store.state.revision;
    expect(act('open', node.id).reused).toBe(true);
    expect(store.state.revision).toBe(revision);
    if (node.type === 'scaffold') {
      expect(() => act('reference', node.id)).toThrow('原答');
      const raw = `  第${node.id}步的原答\n  `;
      act('submit', node.id, raw, `${itemId}-node-${node.id}`);
      expect(store.state.attempts.at(-1).answer).toBe(raw);
      expect(store.state.attempts.at(-1).grade.status).toBe('pending');
      const hints = store.state.attempts.at(-1).hints;
      expect(new Set(hints.map((h) => h.id)).size).toBe(hints.length);
      expect(hints.length).toBeLessThanOrEqual(item.nodes.length * 2);
      act('reference', node.id);
    }
  }
  act('final');
  expect(oatutorFinalReference(store.state, store.activeQuestion)).toContain(item.answer);
  expect(store.state.attempts[0]).toEqual(first);
  expect(store.activeQuestion).toEqual(main);
  store.submit('第二份本题作答', true, `main-after-help-${itemId}`);
  expect(store.state.attempts.at(-1).hints.some((h) => h.oatutorReference?.part === 'final')).toBe(true);
  expect(store.state.reviews).toHaveLength(0);
  expect(summarizeLearning(store.state).totalReliableAnswers).toBe(0);
  store.commit('task.stop', { conversationId: store.active.id });
  expect(() => act('open', '1')).toThrow('停止');
  let replay = emptyLearningState(store.state.owner, store.state.timezone);
  for (const op of clone(store.state.events))
    replay = applyLearningOperation(replay, normalizePrivateSyncOperation(op)).state;
  expect(replay).toEqual(clone(store.state));
  expect(learningRepository.read()).toEqual(clone(store.state));
});

it.each(['prompt', 'source', 'version', 'authority', 'graph', 'owner'])(
  'rejects a forged %s in question data',
  (field) => {
    const q = createOatutorQuestion('new-source', store.active.id);
    if (field === 'prompt') q.prompt += ' changed';
    if (field === 'source') q.source.revision = 'other';
    if (field === 'version') q.oatutorExercise.packVersion = 2;
    if (field === 'authority') q.validation = { authority: 'executable', type: 'number', answer: '1' };
    if (field === 'graph') q.source.exerciseSnapshot.nodes[0].dependencies = ['4'];
    if (field === 'owner') q.oatutorExercise.conversationId = 'missing';
    const before = store.exportData();
    expect(() => store.commit('question.add', { question: q })).toThrow();
    expect(store.exportData()).toBe(before);
  }
);
it('refuses final answer before original, unopened scaffold, unknown input and implicit submits', () => {
  const session = store.active,
    questionKey = session.activeQuestionKey;
  expect(() => act('final')).toThrow('原答');
  expect(() => act('submit', '1', 'x')).toThrow('打开');
  act('open', '1');
  for (const data of [
    { nodeId: '1', answer: 'x', explicit: false },
    { nodeId: '1', answer: ' ', explicit: true },
    { nodeId: '1', answer: 'x'.repeat(1001), explicit: true },
    { nodeId: '1', answer: 'x', explicit: true, gradingAuthority: true }
  ])
    expect(() =>
      store.commit('oatutor.scaffold.submit', { conversationId: session.id, questionKey, ...data })
    ).toThrow();
  expect(store.state.attempts).toHaveLength(0);
});
it('keeps each task help, uses stable submit ids and rejects same id with another raw answer', () => {
  act('open', '1');
  act('submit', '1', 'first', 'stable-step');
  const before = clone(store.state.attempts);
  act('submit', '1', 'first', 'stable-step');
  expect(store.state.attempts).toEqual(before);
  expect(() => act('submit', '1', 'changed', 'stable-step')).toThrow('不同内容');
  store.startOatutor(store.oatutorContext(), 'product');
  expect(oatutorProgress(store.state, store.activeQuestion)[0].opened).toBe(false);
  store.startOatutor(store.oatutorContext(), 'sum');
  expect(oatutorProgress(store.state, store.activeQuestion)[0].attempts).toHaveLength(1);
});
it('keeps previously read help when repeating a main answer or returning to a scaffold from history', () => {
  const mainKey = store.active.activeQuestionKey;
  act('open', '1');
  act('submit', '1', 'first child', 'child-original');
  act('reference', '1');
  store.submit('  main original\n', true, 'main-original');
  act('final');
  store.submit('  main second\n', true, 'main-second');
  store.submit('  main third\n', true, 'main-third');
  const hints = clone(store.state.attempts.at(-1).hints);
  expect(hints).toHaveLength(3);
  const childKey = store.state.attempts.find((a) => a.id === 'child-original').questionKey;
  store.commit('question.focus', { conversationId: store.active.id, questionKey: childKey, kind: 'redo' });
  store.submit('  child revised\n', true, 'child-revised');
  expect(store.state.attempts.at(-1).answer).toBe('  child revised\n');
  expect(store.state.attempts.at(-1).hints).toEqual(hints);
  expect(store.state.attempts.at(-1).grade.status).toBe('pending');
  store.commit('question.focus', { conversationId: store.active.id, questionKey: mainKey });
  expect(oatutorProgress(store.state, store.activeQuestion)[0].attempts).toHaveLength(2);
  expect(store.state.attempts.find((a) => a.id === 'child-original').answer).toBe('first child');
  expect(store.state.reviews).toHaveLength(0);
  let replay = emptyLearningState(store.state.owner, store.state.timezone);
  for (const op of clone(store.state.events))
    replay = applyLearningOperation(replay, normalizePrivateSyncOperation(op)).state;
  expect(replay).toEqual(clone(store.state));
});
it.each(['stop-resume', 'task', 'owner'])('rejects a stale %s context with no extra learning writes', (change) => {
  const context = store.oatutorContext();
  if (change === 'stop-resume') {
    store.commit('task.stop', { conversationId: store.active.id });
    store.commit('task.resume', { conversationId: store.active.id, source: 'self_report' });
  }
  if (change === 'task') store.start('计算 2 + 2');
  if (change === 'owner') {
    uni.setStorageSync('EXAM_USER_ID', 'other');
    store.refresh();
  }
  const before = store.exportData();
  expect(() => store.oatutorAction(context, 'open', '1')).toThrow('变化');
  expect(store.exportData()).toBe(before);
});
it('cannot focus or operate another conversation’s pathway', () => {
  const q = store.active.activeQuestionKey;
  store.start('函数运算带练');
  expect(() => store.commit('question.focus', { conversationId: store.active.id, questionKey: q })).toThrow('另一对话');
  expect(() =>
    store.commit('oatutor.node.open', { conversationId: store.active.id, questionKey: q, nodeId: '1' })
  ).toThrow();
});
it('does not display reference or mark help when persistence fails', () => {
  vi.spyOn(learningRepository, 'commit').mockImplementation(() => {
    throw new Error('save failed');
  });
  expect(() => act('open', '1')).toThrow('save failed');
  expect(oatutorProgress(store.state, store.activeQuestion)[0].opened).toBe(false);
});

it('UI selection and typing stay draft; keyboard opening saves help; explicit submit stores exact raw text', async () => {
  const w = mount(OatutorPractice, { props: props(), global: { stubs } });
  const original = store.exportData();
  await button(w, '函数相乘').trigger('tap');
  expect(store.exportData()).toBe(original);
  expect(button(w, '读本题参考').attributes('disabled')).toBeDefined();
  const step = button(w, '第1步 · 写出关系');
  step.element.addEventListener('click', () => step.element.dispatchEvent(new Event('tap', { bubbles: true })));
  await step.trigger('keydown', { key: 'Enter' });
  await step.trigger('keyup', { key: 'Enter' });
  await w.setProps(props());
  expect(store.active.pendingHints).toHaveLength(1);
  const before = store.exportData();
  await w.find('textarea').setValue('  f(x)+g(x)\n');
  expect(store.exportData()).toBe(before);
  await button(w, '提交第1步').trigger('tap');
  await w.setProps(props());
  expect(store.state.attempts.at(-1).answer).toBe('  f(x)+g(x)\n');
  expect(w.text()).toContain('已保存 · 待核对');
  await button(w, '读第1步参考').trigger('tap');
  await w.setProps(props());
  expect(w.text()).toContain('本步参考：');
  expect(w.find('textarea').element.value).toBe('  f(x)+g(x)\n');
  const beforeStop = clone(store.state.attempts);
  await w.setProps({ stopped: true });
  expect(button(w, '打开这题').attributes('disabled')).toBeDefined();
  expect(store.state.attempts).toEqual(beforeStop);
  w.unmount();
});
