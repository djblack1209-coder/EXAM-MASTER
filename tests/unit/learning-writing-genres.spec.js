import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  applyLearningOperation,
  emptyLearningState,
  normalizePrivateSyncOperation,
  questionKey
} from '@/services/learning/learning-domain.js';
import {
  createNoticeQuestion,
  createWritingQuestion,
  guidedSentenceFeedback,
  writingGenre,
  nextWritingTask,
  WRITING_GENRES,
  writingStepsForQuestion,
  WRITING_WORD_MEANINGS,
  PUBLIC_WRITING_REFERENCES,
  publicWritingReference,
  writingReferenceNoteLocation
} from '../../laf-backend/functions/_shared/learning-writing.js';
import LearningLab from '@/components/business/learning/learning-lab.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
const button = (wrapper, label) => wrapper.findAll('button').find((item) => item.text() === label);
const clone = (value) => JSON.parse(JSON.stringify(value));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup(genre) {
  const store = useConversationLearningStore();
  store.start(WRITING_GENRES.find((item) => item.id === genre).goal, { track: 'junior', stage: '八年级', edition: '' });
  return store;
}
describe('各写作入口的明确原文提交', () => {
  it('基础体裁保留首尾空白，仍待核对且不安排可靠复习', () => {
    const store = setup('narrative');
    const original = '\r\n \tI learned to plan my time and finish the task.\n\t ';
    store.submit(original, true, 'guided-original-whitespace');
    expect(store.state.attempts[0]).toMatchObject({ answer: original, grade: { status: 'pending' } });
    expect(store.state.events.find((event) => event.id === 'guided-original-whitespace').type).toBe(
      'attempt.submit-original-v1'
    );
    expect(store.state.reviews).toEqual([]);
  });
});
describe('USGS英文正文全文与固定段落帮助', () => {
  const id = 'usgs-water-cycle-full-en-v1';
  it('保留7小节8段正文和末段，许可仅限署名机构制作文字，不夹入第三方图注', () => {
    const source = publicWritingReference(id, 1);
    expect(source).toMatchObject({
      coverage: 'full_text',
      genreId: 'explanation',
      language: 'en',
      paragraphCount: 8,
      sectionCount: 7,
      author: 'Water Science School',
      publisher: 'U.S. Geological Survey',
      published: '日期未标注',
      license: '美国公有领域（USGS文字）',
      scoringAuthority: false
    });
    expect(source.excerpt.split('\n\n')).toHaveLength(15);
    expect(source.excerpt.startsWith('What is the water cycle?\n\nThe water cycle describes')).toBe(true);
    expect(source.excerpt.endsWith('we can work toward using water sustainably.')).toBe(true);
    expect(createHash('sha256').update(source.excerpt).digest('hex')).toBe(
      '33d6dfea21f4adda94a3b904c5fa347ec53f5ea2cc3dec79a69de739328faa78'
    );
    expect(source.excerpt).not.toMatch(
      /75%|Pixabay|Tobias|Thomas Ehrhardt|Sources\/Usage|Credit:|<script|Read more about/
    );
    expect(source.licenseUrl).toBe('https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits');
    expect(source.notes.map(writingReferenceNoteLocation)).toEqual(['第1段', '第3段', '第8段']);
    source.excerpt = '替代原文';
    source.notes[0].paragraph = 99;
    source.scoringAuthority = true;
    expect(publicWritingReference(id, 1).notes[0].paragraph).toBe(1);
    expect(publicWritingReference(id, 1).scoringAuthority).toBe(false);
  });
  it('明确阅读只保存当前题目帮助，幂等重读、私人重放、原答与独立题保持', () => {
    const store = setup('explanation'),
      question = clone(store.activeQuestion);
    const read = store.readWritingReference(store.writingContext(), id, 1),
      saved = store.exportData();
    expect(store.readWritingReference(store.writingContext(), id, 1)).toEqual(read);
    expect(store.exportData()).toBe(saved);
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.active.pendingHints[0].content).toContain('第8段 · 收束');
    expect(store.active.pendingHints[0].content).not.toContain('undefined');
    expect(store.activeQuestion).toEqual(question);
    const raw = 'We can protect water by  keeping rivers clean.\nWe should reduce waste.';
    store.submit(raw, true, 'usgs-reference-answer');
    expect(store.state.attempts.at(-1)).toMatchObject({
      answer: raw,
      grade: { status: 'pending' },
      hints: [{ reference: { id, version: 1 } }]
    });
    let replay = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(clone(event))).state;
    expect(replay.attempts).toEqual(store.state.attempts);
    const attempts = clone(store.state.attempts);
    store.startWriting(store.writingContext(), 'explanation');
    expect(store.active.pendingHints).toEqual([]);
    expect(store.state.attempts).toEqual(attempts);
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.reviews).toEqual([]);
    store.commit('task.stop', { conversationId: store.active.id });
    const stopped = store.exportData();
    expect(() => store.readWritingReference(store.writingContext(), id, 1)).toThrow('停止');
    expect(store.exportData()).toBe(stopped);
  });
  it.each([
    { referenceVersion: 2 },
    { reference: { scoringAuthority: true } },
    { content: '自带替换原文' },
    { questionKey: 'other@1' }
  ])('客户端不能覆盖固定正文、版本、评分身份或题目：%j', (patch) => {
    const store = setup('explanation'),
      before = store.exportData();
    expect(() =>
      store.commit('hint.add', {
        conversationId: store.active.id,
        questionKey: questionKey(store.activeQuestion),
        referenceId: id,
        referenceVersion: 1,
        ...patch
      })
    ).toThrow();
    expect(store.exportData()).toBe(before);
  });
  it('选全文只改草稿，明确读正文全文后才展示固定段落批注，并保留用户原稿', async () => {
    const store = setup('explanation'),
      save = vi.fn((context, sourceId, version) => store.readWritingReference(context, sourceId, version));
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        readWritingReference: save
      },
      global: { stubs }
    });
    try {
      await button(wrapper, '互动学习').trigger('tap');
      await button(wrapper, '逐句带练').trigger('tap');
      await wrapper.find('textarea').setValue('Keep my  original draft.');
      const before = store.exportData();
      await button(wrapper, '水循环 · 英文正文全文').trigger('tap');
      expect(store.exportData()).toBe(before);
      expect(save).not.toHaveBeenCalled();
      expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
      await button(wrapper, '读正文全文').trigger('tap');
      expect(save).toHaveBeenCalledWith(store.writingContext(), id, 1);
      expect(wrapper.find('.reference-excerpt').text()).toBe(publicWritingReference(id, 1).excerpt);
      expect(wrapper.find('.public-writing-reference').text()).toContain('第3段 · 过程');
      expect(wrapper.find('.public-writing-reference').text()).not.toContain('undefined句');
      expect(wrapper.find('textarea').element.value).toBe('Keep my  original draft.');
      await wrapper.setProps({ stopped: true });
      expect(button(wrapper, '读正文全文').attributes('disabled')).toBeDefined();
    } finally {
      wrapper.unmount();
    }
  });
  it('旧来源仍按原句号显示，读取帮助内容保持句级归属', () => {
    const store = setup('explanation');
    const source = publicWritingReference('frontiers-soil-moisture-en-v1', 1);
    expect(source.notes.map(writingReferenceNoteLocation)).toEqual(['第1句', '第2句', '第3句']);
    store.readWritingReference(store.writingContext(), source.id, source.version);
    expect(store.active.pendingHints[0].content).toContain('第2句 · 比较：用 the more … the less …');
    expect(store.active.pendingHints[0].reference).toEqual(source);
  });
});
describe('有出处的公开说明文阅读帮助', () => {
  const source = PUBLIC_WRITING_REFERENCES[0];
  const read = (store) => store.readWritingReference(store.writingContext(), source.id, source.version);
  const referenceOperation = (store, extra = {}) => ({
    id: 'reference-read',
    type: 'hint.add',
    data: {
      conversationId: store.active.id,
      questionKey: questionKey(store.activeQuestion),
      referenceId: source.id,
      referenceVersion: source.version,
      ...extra
    }
  });
  it('固定正文摘要和许可归属；注释与来源分开，调用副本不能改写公共正文', () => {
    expect(createHash('sha256').update(source.excerpt).digest('hex')).toBe(source.excerptSha256);
    expect(source).toMatchObject({
      author: 'Luca Brocca',
      coWritingCredit: 'Susan Debad',
      published: '2024-03-05',
      retrieved: '2026-10-06',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      purpose: 'writing_reference',
      scoringAuthority: false,
      noteAuthor: 'Yozi AI'
    });
    const copy = publicWritingReference(source.id, source.version);
    copy.excerpt = '改写';
    copy.notes[0].text = '官方分数';
    expect(publicWritingReference(source.id, source.version)).toEqual(source);
    expect(JSON.stringify(source)).not.toMatch(/youngReviewers|imageUrl|email|<script|official_score/);
  });
  it('仅明确阅读写帮助；重复打开不添重复记录，题目量表和指定教法保持', () => {
    const store = setup('explanation');
    store.commit('strategy.set', {
      conversationId: store.active.id,
      method: 'steps',
      source: 'self_report',
      reason: '用户指定逐步'
    });
    const q = clone(store.activeQuestion),
      strategies = clone(store.state.events.filter((event) => event.type === 'strategy.set'));
    const result = read(store),
      saved = store.exportData();
    expect(result.reference).toEqual(source);
    expect(store.active.pendingHints).toMatchObject([{ id: result.hintId, level: 1, reference: source }]);
    expect(read(store)).toEqual(result);
    expect(store.exportData()).toBe(saved);
    expect(store.activeQuestion).toEqual(q);
    expect(store.state.events.filter((event) => event.type === 'strategy.set')).toEqual(strategies);
    expect(store.state.attempts).toEqual([]);
    expect(store.state.reviews).toEqual([]);
    expect(store.summary.knowledge).toEqual({});
    expect(store.state.events.at(-1).data).toEqual(referenceOperation(store).data);
  });
  for (const [name, data] of [
    ['未知来源', { referenceId: 'https://127.0.0.1/private' }],
    ['未知版本', { referenceVersion: 2 }],
    ['空标识', { referenceId: null }],
    ['正文注入', { content: '官方满分参考' }],
    ['许可注入', { reference: { license: 'all rights reserved' } }],
    ['提示级别注入', { level: 3 }],
    ['另一题目', { questionKey: 'other@1' }]
  ])
    it(`${name}拒绝且原记录不变`, () => {
      const store = setup('explanation'),
        before = store.exportData();
      expect(() => applyLearningOperation(store.state, referenceOperation(store, data))).toThrow();
      expect(store.exportData()).toBe(before);
    });
  for (const genre of ['notice', 'narrative'])
    it(`${genre}不冒充这段英文说明的来源`, () => {
      const store = setup(genre),
        before = store.exportData();
      expect(() => read(store)).toThrow('英文说明');
      expect(store.exportData()).toBe(before);
    });
  it('实际阅读归属原答并随私人重放保留；换情境不复制旧帮助或原答', () => {
    const store = setup('explanation'),
      original = questionKey(store.activeQuestion);
    read(store);
    const answer = 'Our school will recycle  paper.\nPlease bring old paper.';
    store.submit(answer, true, 'first');
    expect(store.state.attempts[0]).toMatchObject({
      answer,
      hints: [{ reference: source }],
      grade: { status: 'pending' }
    });
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.reviews).toEqual([]);
    store.startWriting(store.writingContext(), 'explanation');
    expect(store.activeQuestion.parentQuestionKey).toBe(original);
    expect(store.active.pendingHints).toEqual([]);
    let replayed = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events)
      replayed = applyLearningOperation(replayed, normalizePrivateSyncOperation(event)).state;
    expect(replayed.questions).toEqual(store.state.questions);
    expect(replayed.attempts).toEqual(store.state.attempts);
    expect(replayed.conversations).toEqual(store.state.conversations);
    expect(replayed.events.find((event) => event.data?.referenceId)?.data).toEqual({
      conversationId: store.active.id,
      questionKey: original,
      referenceId: source.id,
      referenceVersion: 1
    });
  });
  it('参考后的新认词题继承已展示帮助，不能借切换刷新为无提示首答', () => {
    const store = setup('explanation');
    read(store);
    const q = store.openVocabulary(store.writingContext(), 'recycle');
    const result = store.submitVocabulary(store.writingContext(), questionKey(q), q.validation.answer);
    const attempt = store.state.attempts.find((item) => item.id === result.attemptId);
    expect(attempt.hints).toMatchObject([{ reference: source }]);
    expect(store.summary.first.denominator).toBe(0);
  });
  it('跨账户、切题与停止拒绝迟到阅读；打开旧题不解除停止', async () => {
    const store = setup('explanation'),
      oldContext = store.writingContext();
    store.startWriting(oldContext, 'narrative');
    expect(() => store.readWritingReference(oldContext, source.id, 1)).toThrow('切换');
    store.startWriting(store.writingContext(), 'explanation');
    await store.send('停止当前任务');
    const stopped = store.exportData();
    expect(() => read(store)).toThrow('停止');
    expect(() => applyLearningOperation(store.state, referenceOperation(store))).toThrow('进行中的');
    expect(store.exportData()).toBe(stopped);
    uni.setStorageSync('EXAM_USER_ID', 'other-owner');
    store.refresh();
    expect(() => store.readWritingReference(oldContext, source.id, 1)).toThrow('切换');
  });
  it('提交后收起参考；重新阅读重新记帮助，原出处和草稿保持', async () => {
    const store = setup('explanation');
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        readWritingReference: (context, id, version) => store.readWritingReference(context, id, version)
      },
      global: { stubs }
    });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await wrapper.find('textarea').setValue('Our school will recycle  paper.');
    await button(wrapper, '读一段说明').trigger('tap');
    const firstHint = store.active.pendingHints[0].id;
    store.submit('Our school will recycle  paper.', true, 'first');
    await wrapper.setProps({ state: store.state, question: store.activeQuestion });
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    expect(store.active.pendingHints).toEqual([]);
    expect(store.state.attempts[0].hints[0]).toMatchObject({ id: firstHint, reference: source });
    expect(wrapper.find('textarea').element.value).toBe('Our school will recycle  paper.');
    await button(wrapper, '读一段说明').trigger('tap');
    expect(wrapper.find('.public-writing-reference').exists()).toBe(true);
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.active.pendingHints[0].id).not.toBe(firstHint);
    expect(store.active.pendingHints[0].reference).toEqual(source);
    wrapper.unmount();
  });
  it('保存失败时不展示正文；成功展示后保留双空格草稿，停止与上下文变化收起', async () => {
    const store = setup('explanation');
    let fail = true;
    const commit = learningRepository.commit.bind(learningRepository);
    vi.spyOn(learningRepository, 'commit').mockImplementation((operation) => {
      if (fail && operation.data.referenceId) throw Error('合成保存失败');
      return commit(operation);
    });
    const save = vi.fn((context, id, version) => {
      try {
        return store.readWritingReference(context, id, version);
      } catch {
        return null;
      }
    });
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        readWritingReference: save
      },
      global: { stubs }
    });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await wrapper.find('textarea').setValue('Our school will recycle  paper.');
    await button(wrapper, '读一段说明').trigger('tap');
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    expect(store.active.pendingHints).toEqual([]);
    fail = false;
    await button(wrapper, '读一段说明').trigger('tap');
    expect(wrapper.find('.reference-excerpt').text()).toBe(source.excerpt);
    expect(wrapper.find('textarea').element.value).toBe('Our school will recycle  paper.');
    expect(wrapper.findAll('.reference-links a').map((a) => a.attributes('href'))).toEqual([
      source.url,
      source.licenseUrl
    ]);
    await wrapper.setProps({ state: store.state, question: store.activeQuestion });
    expect(wrapper.find('.public-writing-reference').exists()).toBe(true);
    await wrapper.setProps({ stopped: true });
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    expect(button(wrapper, '读一段说明').attributes('disabled')).toBeDefined();
    await wrapper.setProps({ stopped: false });
    await button(wrapper, '读一段说明').trigger('tap');
    await wrapper.setProps({ context: 'other-owner' });
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    wrapper.unmount();
  });
});
describe('中文叙事的公共原文与学习目标', () => {
  const source = PUBLIC_WRITING_REFERENCES.find((item) => item.id === 'wikisource-shexi-return-zh-v1');
  const read = (store) => store.readWritingReference(store.writingContext(), source.id, 1);
  const operation = (store, extra = {}) => ({
    id: 'narrative-reference-read',
    type: 'hint.add',
    data: {
      conversationId: store.active.id,
      questionKey: questionKey(store.activeQuestion),
      referenceId: source.id,
      referenceVersion: 1,
      ...extra
    }
  });
  it('固定鲁迅片段、版本和许可；官方目标与项目量表分开，返回副本不能改写原文', () => {
    expect(source.excerpt).toBe(
      '我向船头一望，前面已经是平桥，桥脚上站着一个人，却是我的母亲，双喜便是对伊说着话。我走出前舱去，船也就进了平桥了，停了船，我们纷纷都上岸。母亲颇有些生气，说是过了三更了，怎么回来得这样迟，但也就高兴了，笑着邀大家去吃炒米。'
    );
    expect(createHash('sha256').update(source.excerpt).digest('hex')).toBe(
      '51f38b91b1db2dfcb68fa69b8a22800b976182679d1d6d499b3e6712ee593a80'
    );
    expect(source).toMatchObject({
      contract: 'public-writing-reference-v1',
      version: 1,
      genreId: 'narrative',
      author: '鲁迅',
      published: '1922-12',
      license: 'CC BY-SA 4.0（转录）',
      scoringAuthority: false,
      teachingBasis: {
        printedPage: 16,
        pdfPage: 23,
        interpretationAuthor: 'Yozi AI',
        criterionIds: ['story', 'detail', 'organisation'],
        scoringAuthority: false
      }
    });
    expect(source.url).toContain('oldid=10605419');
    expect(source.teachingBasis.url).toContain('www.ictr.edu.cn/Uploads/File/2022/04/28/');
    expect(source.teachingBasis.url).toContain('#page=23');
    const copy = publicWritingReference(source.id, 1);
    copy.excerpt = '改写';
    copy.notes[0].text = '满分';
    copy.teachingBasis.scoringAuthority = true;
    copy.teachingBasis.criterionIds.push('official_score');
    expect(publicWritingReference(source.id, 1)).toEqual(source);
  });
  it('明确阅读只存本题帮助，重复阅读不增写，原题量表和指定教法不变', () => {
    const store = setup('narrative');
    store.commit('strategy.set', {
      conversationId: store.active.id,
      method: 'steps',
      source: 'self_report',
      reason: '用户指定逐步'
    });
    const question = clone(store.activeQuestion),
      strategy = clone(store.state.strategy),
      result = read(store),
      saved = store.exportData();
    expect(read(store)).toEqual(result);
    expect(store.exportData()).toBe(saved);
    expect(store.active.pendingHints).toMatchObject([
      { id: result.hintId, reference: source, questionKey: questionKey(question), level: 1 }
    ]);
    expect(store.active.pendingHints[0].content).toContain('第16页 · Yozi AI转述');
    expect(store.activeQuestion).toEqual(question);
    expect(store.activeQuestion.rubric.source.kind).toBe('project_original');
    expect(store.state.strategy).toEqual(strategy);
    expect(store.state.attempts).toEqual([]);
    expect(store.state.reviews).toEqual([]);
    expect(store.summary.first.denominator).toBe(0);
  });
  for (const genre of ['notice', 'explanation'])
    it(`${genre}不能伪称中文原文属于本题`, () => {
      const store = setup(genre),
        before = store.exportData();
      expect(() => read(store)).toThrow('中文叙事');
      expect(store.exportData()).toBe(before);
    });
  for (const patch of [
    { content: '替换原文' },
    { reference: { teachingBasis: { scoringAuthority: true } } },
    { referenceVersion: 2 },
    { questionKey: 'another@1' }
  ])
    it(`拒绝正文/权威/版本/题目注入 ${JSON.stringify(patch)}`, () => {
      const store = setup('narrative'),
        before = store.exportData();
      expect(() => applyLearningOperation(store.state, operation(store, patch))).toThrow();
      expect(store.exportData()).toBe(before);
    });
  it('原答保留出处与目标，私人重放不提升语义/成绩；新情境不迁移帮助', () => {
    const store = setup('narrative');
    read(store);
    store.submit('下雨后，我把伞递给同学。  同学握着伞道谢，我松了一口气。', true, 'narrative-answer');
    const original = clone(store.state.attempts[0]);
    expect(original).toMatchObject({
      hints: [{ reference: source }],
      grade: { status: 'pending', outcome: null }
    });
    let replay = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(clone(event))).state;
    expect(replay.attempts).toEqual(store.state.attempts);
    expect(replay.questions).toEqual(store.state.questions);
    store.startWriting(store.writingContext(), 'narrative');
    expect(store.active.pendingHints).toEqual([]);
    expect(store.state.attempts[0]).toEqual(original);
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.reviews).toEqual([]);
  });
  it('未来复测可阅读，提前原答仍拒绝，停止和账户切换不接纳迟到阅读', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T09:00:00Z'));
    const store = setup('narrative');
    store.submit('原答。', true, 'original');
    const plan = store.scheduleWritingRetest();
    store.focus(plan.questionKey);
    read(store);
    const future = store.exportData(),
      context = store.writingContext();
    expect(() => store.submit('提前原答。', true)).toThrow('复测日期');
    expect(store.exportData()).toBe(future);
    await store.send('停止当前任务');
    const stopped = store.exportData();
    expect(() => read(store)).toThrow('停止');
    expect(store.exportData()).toBe(stopped);
    uni.setStorageSync('EXAM_USER_ID', 'other-owner');
    store.refresh();
    expect(() => store.readWritingReference(context, source.id, 1)).toThrow('切换');
  });
  it('实际中文入口先保存后展示；不显示空协作署名，原稿和目标链接保持', async () => {
    const store = setup('narrative'),
      save = vi.fn((context, id, version) => store.readWritingReference(context, id, version));
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        readWritingReference: save
      },
      global: { stubs }
    });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await wrapper.find('textarea').setValue('我的  原稿。');
    await button(wrapper, '读一段叙事').trigger('tap');
    expect(save).toHaveBeenCalledWith(store.writingContext(), source.id, 1);
    expect(wrapper.find('.reference-excerpt').text()).toBe(source.excerpt);
    expect(wrapper.find('.public-writing-reference').text()).not.toContain('协作撰写');
    expect(wrapper.find('.public-writing-reference').text()).not.toContain('undefined');
    expect(wrapper.find('.public-writing-reference').text()).toContain('Yozi AI 转述');
    expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toContain(source.teachingBasis.url);
    expect(wrapper.find('textarea').element.value).toBe('我的  原稿。');
    store.submit('当前中文原答。', true, 'submitted');
    await wrapper.setProps({ state: store.state, question: store.activeQuestion });
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    await button(wrapper, '读一段叙事').trigger('tap');
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.active.pendingHints[0].id).not.toBe(store.state.attempts[0].hints[0].id);
    await wrapper.setProps({ busy: true });
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    wrapper.unmount();
  });
  it('中文参考保存失败或错误版本收据不展示，停止后保留原答和禁止重读', async () => {
    const store = setup('narrative'),
      before = store.exportData();
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        readWritingReference: () => null
      },
      global: { stubs }
    });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await button(wrapper, '读一段叙事').trigger('tap');
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    expect(store.exportData()).toBe(before);
    await wrapper.setProps({
      readWritingReference: () => ({ hintId: 'forged', reference: { id: source.id, version: 2 } })
    });
    await button(wrapper, '读一段叙事').trigger('tap');
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    await wrapper.setProps({ stopped: true });
    expect(button(wrapper, '读一段叙事').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});
describe('公共完整作品与明确阅读', () => {
  const sources = [
    [
      'wikisource-chengtian-full-zh-v1',
      '8732064',
      3,
      '822f31a4e103bf15f36fe1e3f8df0c2d0d0f2e62b4777ae4b9fe30ab99ed909a',
      '黄州团练副使苏某书。'
    ],
    [
      'wikisource-xiaoshitan-full-zh-v1',
      '2510274',
      5,
      '8aebd85753bba934fde9d67923513583ef092805b7816b97427a1e29d03d6b08',
      '曰奉壹。'
    ]
  ];
  for (const [id, revision, paragraphs, hash, ending] of sources) {
    it(`${id}保留固定全文、末段与许可，副本不能改动正文`, () => {
      const source = publicWritingReference(id, 1);
      expect(source).toMatchObject({
        coverage: 'full_work',
        genreId: 'narrative',
        language: 'zh',
        scoringAuthority: false,
        license: 'CC BY-SA 4.0（转录）',
        notesLicense: 'CC BY-SA 4.0',
        excerptSha256: hash
      });
      expect(source.url).toContain(`oldid=${revision}`);
      expect(source.excerpt.split('\n\n')).toHaveLength(paragraphs);
      expect(source.excerpt.endsWith(ending)).toBe(true);
      expect(createHash('sha256').update(source.excerpt).digest('hex')).toBe(hash);
      expect(source.excerpt).not.toMatch(/<style|\.mw-parser-output|一作/);
      source.excerpt = '改写';
      source.notes[0].text = '官方满分答案';
      source.scoringAuthority = true;
      expect(publicWritingReference(id, 1).excerptSha256).toBe(hash);
      expect(publicWritingReference(id, 1).scoringAuthority).toBe(false);
    });
    it(`${id}只存本题帮助，幂等、私人重放与独立新题保留判分边界`, () => {
      const store = setup('narrative'),
        question = clone(store.activeQuestion);
      const first = store.readWritingReference(store.writingContext(), id, 1),
        saved = store.exportData();
      expect(store.readWritingReference(store.writingContext(), id, 1)).toEqual(first);
      expect(store.exportData()).toBe(saved);
      expect(store.active.pendingHints[0].reference).toEqual(publicWritingReference(id, 1));
      expect(store.active.pendingHints[0].content).not.toContain('undefined');
      expect(store.activeQuestion).toEqual(question);
      store.submit('下雨时，我把  伞递给同学。', true, `answer-${id}`);
      expect(store.state.attempts[0]).toMatchObject({
        answer: '下雨时，我把  伞递给同学。',
        grade: { status: 'pending', outcome: null },
        hints: [{ reference: { id, version: 1 } }]
      });
      let replay = emptyLearningState(store.state.owner, store.state.timezone);
      for (const event of store.state.events)
        replay = applyLearningOperation(replay, normalizePrivateSyncOperation(clone(event))).state;
      expect(replay.attempts).toEqual(store.state.attempts);
      const original = clone(store.state.attempts);
      store.startWriting(store.writingContext(), 'narrative');
      expect(store.active.pendingHints).toEqual([]);
      expect(store.state.attempts).toEqual(original);
      expect(store.summary.first.denominator).toBe(0);
      expect(store.state.reviews).toEqual([]);
    });
    for (const patch of [
      { content: '自带原文' },
      { reference: { scoringAuthority: true } },
      { referenceVersion: 2 },
      { questionKey: 'other@1' }
    ])
      it(`${id}原子拒绝注入 ${JSON.stringify(patch)}`, () => {
        const store = setup('narrative'),
          before = store.exportData();
        expect(() =>
          applyLearningOperation(store.state, {
            id: 'injected',
            type: 'hint.add',
            data: {
              conversationId: store.active.id,
              questionKey: questionKey(store.activeQuestion),
              referenceId: id,
              referenceVersion: 1,
              ...patch
            }
          })
        ).toThrow();
        expect(store.exportData()).toBe(before);
      });
    it(`${id}拒绝错体裁、停止和失效账户上下文`, async () => {
      const wrong = setup('explanation'),
        before = wrong.exportData();
      expect(() => wrong.readWritingReference(wrong.writingContext(), id, 1)).toThrow('中文叙事');
      expect(wrong.exportData()).toBe(before);
      const store = setup('narrative'),
        context = store.writingContext();
      await store.send('停止当前任务');
      const stopped = store.exportData();
      expect(() => store.readWritingReference(context, id, 1)).toThrow('停止');
      expect(store.exportData()).toBe(stopped);
      uni.setStorageSync('EXAM_USER_ID', 'other-reader');
      store.refresh();
      expect(() => store.readWritingReference(context, id, 1)).toThrow('切换');
    });
  }
  it('篇目选择只改草稿，明确阅读归本题；切换全文不改原稿、进度或量表', async () => {
    const store = setup('narrative'),
      save = vi.fn((...args) => store.readWritingReference(...args));
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        readWritingReference: save
      },
      global: { stubs }
    });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await wrapper.find('textarea').setValue('我的  原稿。');
    const before = store.exportData(),
      progress = wrapper.find('.writing-progress').text();
    await button(wrapper, '记承天寺夜游 · 全文').trigger('tap');
    expect(save).not.toHaveBeenCalled();
    expect(store.exportData()).toBe(before);
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    await button(wrapper, '读全文').trigger('tap');
    expect(save).toHaveBeenLastCalledWith(store.writingContext(), sources[0][0], 1);
    expect(wrapper.find('.reference-excerpt').text()).toBe(publicWritingReference(sources[0][0], 1).excerpt);
    expect(wrapper.find('.public-writing-reference').text()).toContain('《永乐大典》补');
    const afterRead = store.exportData();
    await button(wrapper, '小石潭记 · 全文').trigger('tap');
    expect(store.exportData()).toBe(afterRead);
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    await button(wrapper, '读全文').trigger('tap');
    expect(wrapper.find('.reference-excerpt').text()).toBe(publicWritingReference(sources[1][0], 1).excerpt);
    expect(wrapper.find('.public-writing-reference').text()).toContain('批注许可 · CC BY-SA 4.0');
    expect(wrapper.find('textarea').element.value).toBe('我的  原稿。');
    expect(wrapper.find('.writing-progress').text()).toBe(progress);
    expect(store.active.pendingHints.map((h) => h.reference.id)).toEqual(sources.map((s) => s[0]));
    await button(wrapper, '收起参考').trigger('tap');
    await button(wrapper, '读全文').trigger('tap');
    expect(store.active.pendingHints).toHaveLength(2);
    wrapper.unmount();
  });
  it('未保存或错篇收据不展示全文；隐藏、忙碌、停止与新题阻断迟到阅读', async () => {
    const store = setup('narrative'),
      save = vi.fn(() => null);
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        readWritingReference: save
      },
      global: { stubs }
    });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await button(wrapper, '小石潭记 · 全文').trigger('tap');
    await button(wrapper, '读全文').trigger('tap');
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    await wrapper.setProps({
      readWritingReference: () => ({ hintId: 'wrong', reference: { id: sources[0][0], version: 1 } })
    });
    await button(wrapper, '读全文').trigger('tap');
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    await wrapper.setProps({ readWritingReference: save, visible: false });
    save.mockClear();
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    expect(button(wrapper, '读全文')).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
    await wrapper.setProps({ visible: true });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '记承天寺夜游 · 全文').trigger('tap');
    await wrapper.setProps({ busy: true });
    await button(wrapper, '读全文').trigger('tap');
    expect(save).not.toHaveBeenCalled();
    await wrapper.setProps({ busy: false, stopped: true });
    await button(wrapper, '读全文').trigger('tap');
    expect(save).not.toHaveBeenCalled();
    store.submit('当前原答。', true, 'before-independent-reference');
    store.startWriting(store.writingContext(), 'narrative');
    await wrapper.setProps({
      stopped: false,
      state: store.state,
      question: store.activeQuestion,
      context: store.writingContext()
    });
    await button(wrapper, '互动学习').trigger('tap');
    expect(button(wrapper, '读一段叙事')).toBeDefined();
    expect(wrapper.find('.public-writing-reference').exists()).toBe(false);
    wrapper.unmount();
  });
});
describe('原创体裁的规范题目、原答与来源', () => {
  it('旧通知创建结果逐字兼容，结构化选择不猜体裁', () => {
    expect(createWritingQuestion('q', 'c')).toEqual(createNoticeQuestion('q', 'c'));
    expect(() => createWritingQuestion('q', 'c', 'unknown')).toThrow('体裁');
    expect(() => createWritingQuestion('q', 'c', 'explanation', 'unknown')).toThrow('情境');
    const store = useConversationLearningStore();
    store.start('英文说明里写到“停止任务”');
    expect(store.state.questions).toHaveLength(0);
    expect(store.active.stopped).toBe(false);
  });
  for (const genre of ['explanation', 'narrative']) {
    it(`${genre}独立原答待核对，不把结构检查变成分数`, () => {
      const store = setup(genre),
        q = store.activeQuestion;
      expect(writingGenre(q)).toBe(genre);
      expect(q.source).toEqual({ kind: 'project_original', reference: 'guided-writing-v1' });
      expect(q.rubric.source).toEqual(q.source);
      expect(q.rubric.criteria).toHaveLength(4);
      expect(q.validation).toBeNull();
      expect(q.publishable).toBe(false);
      const answer =
        genre === 'narrative'
          ? '下雨了。\n我把  伞递给同学。<b>只是原答文本</b>'
          : 'Our school recycles paper.\nPlease bring  old paper.';
      expect(store.submit(answer, false).clarification).toBe(true);
      expect(store.state.attempts).toEqual([]);
      store.submit(answer, true, 'answer');
      expect(store.state.attempts[0]).toMatchObject({ answer, grade: { status: 'pending' } });
      expect(store.summary.first.denominator).toBe(0);
      expect(store.state.reviews).toEqual([]);
      expect(store.summary.tasks.numerator).toBe(1);
    });
    for (const [name, mutate] of [
      [
        '题面变化',
        (q) => {
          q.prompt += '参考答案';
        }
      ],
      [
        '体裁变化',
        (q) => {
          q.writingExercise.genreId = 'notice';
        }
      ],
      [
        '版本变化',
        (q) => {
          q.writingExercise.contract = 'unknown';
        }
      ],
      [
        '多余权限',
        (q) => {
          q.writingExercise.code = 'eval(1)';
        }
      ],
      [
        '客观权威',
        (q) => {
          q.validation = { type: 'exact', authority: 'executable', answer: 'A' };
        }
      ],
      [
        '答案注入',
        (q) => {
          q.expectedAnswer = 'A';
        }
      ],
      [
        '来源变化',
        (q) => {
          q.source.kind = 'official';
        }
      ],
      [
        '维度错配',
        (q) => {
          q.rubric.criteria[0].maxScore = 10;
        }
      ],
      [
        '维度权威',
        (q) => {
          q.rubric.source.kind = 'official';
        }
      ],
      [
        '漏任务元信息',
        (q) => {
          delete q.writingExercise;
        }
      ]
    ])
      it(`${genre}新建与私人重放拒绝${name}且原状态不变`, () => {
        const state = applyLearningOperation(emptyLearningState('guest'), {
          id: 'c',
          type: 'conversation.start',
          data: { goal: '写作' }
        }).state;
        const before = clone(state),
          q = createWritingQuestion('q', 'c', genre);
        mutate(q);
        const op = { id: 'question', type: 'question.add', data: { question: q } };
        expect(() => applyLearningOperation(state, op)).toThrow();
        expect(() => applyLearningOperation(state, normalizePrivateSyncOperation(op))).toThrow();
        expect(state).toEqual(before);
      });
  }
  it('帮助只归当前体裁；新情境撤去旧帮助，原答留在原题', () => {
    const store = setup('explanation'),
      original = questionKey(store.activeQuestion);
    const before = store.exportData();
    expect(store.recordWritingHelp(store.writingContext(), '中文提示', 'narrative')).toBe(false);
    expect(store.exportData()).toBe(before);
    store.recordWritingHelp(store.writingContext(), 'recycle：回收利用', 'explanation');
    store.submit('Our school recycles paper.', true, 'first');
    store.startWriting(store.writingContext(), 'explanation');
    expect(store.activeQuestion.writingExercise.taskId).toBe('water');
    expect(store.activeQuestion.parentQuestionKey).toBe(original);
    expect(store.active.pendingHints).toEqual([]);
    expect(store.state.attempts[0].hints).toHaveLength(1);
    expect(store.summary.first.denominator).toBe(0);
  });
  it('体裁切换保留旧题、帮助和原答；跨对话聚焦、假父题和重复情境拒绝', () => {
    const store = setup('explanation'),
      q = clone(store.activeQuestion),
      conversationId = store.active.id;
    store.recordWritingHelp(store.writingContext(), '一个原因就够了');
    store.submit('Our school recycles paper.', true, 'a');
    store.startWriting(store.writingContext(), 'narrative');
    expect(writingGenre(store.activeQuestion)).toBe('narrative');
    expect(store.state.questions[0]).toEqual(q);
    expect(store.state.attempts[0].answer).toBe('Our school recycles paper.');
    const parent = createWritingQuestion('bad-parent', conversationId, 'narrative', 'book', questionKey(q));
    expect(() => store.commit('question.add', { question: parent })).toThrow('同一对话');
    const duplicate = createWritingQuestion('duplicate', conversationId, 'explanation');
    expect(() => store.commit('question.add', { question: duplicate })).toThrow('已存在');
    store.start('其他学习');
    expect(() => store.focus(questionKey(q), store.active.id)).toThrow('另一对话');
  });
  it('四个有限情境耗尽如实拒绝；未知体裁不能扩权', () => {
    const store = setup('explanation');
    for (let i = 0; i < 3; i++) {
      store.recordWritingHelp(store.writingContext(), '帮助');
      store.startWriting(store.writingContext(), 'explanation');
    }
    expect(() => nextWritingTask(store.state, store.active.id, 'explanation')).toThrow('已练完');
    expect(() => nextWritingTask(store.state, store.active.id, 'unknown')).toThrow('体裁');
  });
  it('停止、账户和题目变化拒绝旧草稿帮助，导航不恢复停止', async () => {
    const store = setup('narrative'),
      context = store.writingContext();
    store.startWriting(context, 'explanation');
    expect(() => store.recordWritingHelp(context, '旧提示', 'narrative')).toThrow('切换');
    await store.send('停止当前任务');
    const stopped = store.exportData();
    expect(() => store.startWriting(store.writingContext(), 'narrative')).toThrow('停止');
    expect(store.exportData()).toBe(stopped);
    uni.setStorageSync('EXAM_USER_ID', 'other-owner');
    store.refresh();
    expect(() => store.recordWritingHelp(context, '旧提示')).toThrow('切换');
  });
});
describe('明日新情境与私人重放', () => {
  for (const genre of ['notice', 'explanation', 'narrative'])
    it(`${genre}日期按原时区；提前拒绝，到期明确原答仍待核对`, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-05T20:00:00Z'));
      const store = setup(genre);
      store.commit('timezone.set', { timezone: 'America/Los_Angeles' });
      store.submit('原答。', true, 'a');
      const result = store.scheduleWritingRetest(),
        saved = store.exportData();
      expect(store.scheduleWritingRetest()).toEqual(result);
      expect(store.exportData()).toBe(saved);
      const target = store.state.questions.find((q) => questionKey(q) === result.questionKey);
      expect(writingGenre(target)).toBe(genre);
      expect(target.writingExercise.dueDay).toBe('2026-10-06');
      store.focus(result.questionKey);
      expect(store.writingCanSubmit()).toBe(false);
      expect(() => store.submit('提前。', true)).toThrow('复测日期');
      const early = store.exportData();
      expect(store.state.attempts).toHaveLength(1);
      vi.setSystemTime(new Date('2026-10-06T06:59:00Z'));
      store.refresh();
      expect(store.writingCanSubmit()).toBe(false);
      expect(store.exportData()).toBe(early);
      vi.setSystemTime(new Date('2026-10-06T07:00:00Z'));
      store.refresh();
      expect(store.writingCanSubmit()).toBe(true);
      store.submit('到期新原答。', true, 'review');
      expect(store.state.attempts.at(-1)).toMatchObject({ kind: 'review', grade: { status: 'pending' } });
      expect(store.summary.first.denominator).toBe(0);
      expect(store.state.reviews).toEqual([]);
      let replayed = emptyLearningState(store.state.owner, store.state.timezone);
      for (const operation of store.state.events)
        replayed = applyLearningOperation(replayed, normalizePrivateSyncOperation(operation)).state;
      expect(replayed.questions).toEqual(store.state.questions);
      expect(replayed.attempts).toEqual(store.state.attempts);
    });
  it('新体裁复测计划保存失败复用同一新题，保留其他任务', () => {
    const store = setup('narrative');
    store.submit('原答。', true, 'a');
    const commit = learningRepository.commit.bind(learningRepository);
    let fail = true;
    vi.spyOn(learningRepository, 'commit').mockImplementation((operation) => {
      if (fail && operation.type === 'plan.set' && operation.data.day) {
        fail = false;
        throw Error('合成保存失败');
      }
      return commit(operation);
    });
    expect(() => store.scheduleWritingRetest()).toThrow('保存失败');
    const count = store.state.questions.length;
    const result = store.scheduleWritingRetest();
    expect(store.state.questions).toHaveLength(count);
    expect(store.state.questions.find((q) => questionKey(q) === result.questionKey).writingExercise.taskId).toBe(
      'book'
    );
  });
});
describe('每句短反馈与体裁选择', () => {
  for (const [genre, taskId, expected] of [
    ['notice', 'reading-club', '阅读社团'],
    ['notice', 'art-circle', '美术'],
    ['notice', 'sports-meet', '运动会'],
    ['notice', 'history-tour', '历史参观'],
    ['explanation', 'paper', '回收旧纸'],
    ['explanation', 'water', '节约用水'],
    ['explanation', 'books', '交换旧书'],
    ['explanation', 'walking', '公园'],
    ['narrative', 'umbrella', '下雨'],
    ['narrative', 'book', '书不见'],
    ['narrative', 'race', '摔倒'],
    ['narrative', 'plant', '发黄']
  ])
    it(`${genre}/${taskId}逐句目标和词语跟随当前情境，不复用第一题`, () => {
      const q = createWritingQuestion('q', 'c', genre, taskId),
        steps = writingStepsForQuestion(q);
      expect(steps).toHaveLength(4);
      expect(steps[0].prompt).toContain(expected);
      for (const step of steps)
        for (const word of step.words) expect(WRITING_WORD_MEANINGS[word]).toEqual(expect.any(String));
      const altered = clone(q);
      altered.prompt += '改变';
      expect(() => writingStepsForQuestion(altered)).toThrow('情境');
      expect(() =>
        guidedSentenceFeedback(genre === 'narrative' ? 'explanation' : 'narrative', steps[0].id, '一句话。', q)
      ).toThrow('体裁');
    });
  it('字面规则无法确认的表达可明确保留，继续草稿不保存作答或掌握', async () => {
    const store = setup('explanation'),
      wrapper = mount(LearningLab, {
        props: {
          state: store.state,
          question: store.activeQuestion,
          context: store.writingContext(),
          recordWritingHelp: (context, content, genre) => store.recordWritingHelp(context, content, genre)
        },
        global: { stubs }
      });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await wrapper.find('textarea').setValue('Useful things can be used again.');
    await button(wrapper, '检查这一句').trigger('tap');
    await button(wrapper, '先保留这句').trigger('tap');
    expect(wrapper.text()).toContain('草稿 · 2 / 4');
    expect(store.state.attempts).toEqual([]);
    expect(store.summary.knowledge).toEqual({});
    wrapper.unmount();
  });
  it('提示保存后的普通状态刷新保持带练和草稿，仅真实上下文变化收起', async () => {
    const store = setup('explanation');
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        recordWritingHelp: (context, content, genre) => store.recordWritingHelp(context, content, genre)
      },
      global: { stubs }
    });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await wrapper.find('textarea').setValue('Our school recycles paper.');
    const context = store.writingContext();
    await button(wrapper, 'recycle').trigger('tap');
    expect(store.writingContext()).toBe(context);
    await wrapper.setProps({ state: store.state, question: store.activeQuestion, context: store.writingContext() });
    expect(wrapper.find('.lab-content').exists()).toBe(true);
    expect(wrapper.find('textarea').element.value).toBe('Our school recycles paper.');
    expect(wrapper.text()).toContain('recycle：回收利用');
    await wrapper.setProps({ context: 'other-owner' });
    expect(wrapper.find('.lab-content').exists()).toBe(false);
    wrapper.unmount();
  });
  it('先改一个格式问题；字面线索不升级作文或词汇掌握', () => {
    expect(guidedSentenceFeedback('explanation', 'topic', 'our school recycles paper.')).toMatchObject({
      kind: 'capital',
      ready: false
    });
    expect(guidedSentenceFeedback('narrative', 'scene', '放学时下雨，同学没有带伞')).toMatchObject({
      kind: 'punctuation',
      ready: false
    });
    expect(guidedSentenceFeedback('narrative', 'response', '他笑着说：“谢谢你！”')).toMatchObject({
      kind: 'draft',
      ready: true
    });
    expect(guidedSentenceFeedback('narrative', 'response', 'He says thanks.')).toMatchObject({
      kind: 'language',
      ready: false
    });
    expect(guidedSentenceFeedback('explanation', 'topic', '<b>Paper recycling.</b>').ready).toBe(false);
    expect(() => guidedSentenceFeedback('narrative', 'scene', '字'.repeat(241))).toThrow();
  });
  for (const genre of ['explanation', 'narrative'])
    it(`${genre}逐句带练后只发出独立入口事件，不复制草稿`, async () => {
      const store = setup(genre),
        helper = vi.fn((context, content, selected) => store.recordWritingHelp(context, content, selected));
      const wrapper = mount(LearningLab, {
        props: {
          state: store.state,
          question: store.activeQuestion,
          context: store.writingContext(),
          recordWritingHelp: helper
        },
        global: { stubs }
      });
      await button(wrapper, '互动学习').trigger('tap');
      await button(wrapper, '逐句带练').trigger('tap');
      const sentences =
        genre === 'explanation'
          ? [
              'Our school is going to recycle paper.',
              'This can reduce waste.',
              'First, collect paper. Then, put it in a box.',
              'Please bring old paper.'
            ]
          : ['放学时突然下雨，同学没有带伞。', '我把伞递给同学。', '他笑着说：“谢谢你！”', '那一刻，我觉得很温暖。'];
      for (let i = 0; i < 4; i++) {
        await wrapper.find('textarea').setValue(sentences[i]);
        await button(wrapper, '检查这一句').trigger('tap');
        await button(wrapper, i === 3 ? '拼成我的草稿' : '继续下一句').trigger('tap');
      }
      expect(wrapper.text()).toContain(sentences.join('\n'));
      expect(store.state.attempts).toEqual([]);
      expect(store.summary.knowledge).toEqual({});
      await button(wrapper, '独立写作').trigger('tap');
      expect(wrapper.emitted('writing')).toEqual([[store.writingContext(), genre]]);
      expect(wrapper.emitted('question')).toBeUndefined();
      await wrapper.setProps({ context: 'other-account' });
      expect(wrapper.find('textarea').exists()).toBe(false);
      wrapper.unmount();
    });
  it('体裁选择只改本地草稿；异体裁先建立任务，帮助保存失败不展示', async () => {
    const store = setup('notice'),
      helper = vi.fn(() => false),
      wrapper = mount(LearningLab, {
        props: {
          state: store.state,
          question: store.activeQuestion,
          context: store.writingContext(),
          recordWritingHelp: helper
        },
        global: { stubs }
      });
    await button(wrapper, '互动学习').trigger('tap');
    await button(wrapper, '逐句带练').trigger('tap');
    await wrapper.find('textarea').setValue('A draft.');
    const before = store.exportData();
    await button(wrapper, '中文叙事').trigger('tap');
    expect(store.exportData()).toBe(before);
    expect(wrapper.find('textarea').exists()).toBe(false);
    await button(wrapper, '开始带练').trigger('tap');
    expect(wrapper.emitted('writing')).toEqual([[store.writingContext(), 'narrative']]);
    await button(wrapper, '英文通知').trigger('tap');
    expect(wrapper.find('textarea').element.value).toBe('');
    await button(wrapper, '需要一个句型').trigger('tap');
    expect(wrapper.text()).not.toContain('Our school will hold a …');
    expect(helper).toHaveBeenCalled();
    wrapper.unmount();
  });
});
