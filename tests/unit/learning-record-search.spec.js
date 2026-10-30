import { obfuscate, deobfuscate } from '@/utils/crypto/cipher.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
import {
  searchLearningRecords,
  createLearningRecordSearch,
  learningRecordTarget
} from '../../laf-backend/functions/_shared/learning-record-search.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import { initI18n, setLanguage, t } from '@/i18n/index.js';
import LearningPage from '@/pages/learning/index.vue';
import LearningShell from '@/components/business/learning/learning-shell.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import { computed } from 'vue';
import { learningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import { storageService } from '@/services/storageService.js';
import '@/pages/learning/messages.js';
vi.mock('@dcloudio/uni-app', () => ({ onLoad: () => {}, onShow: () => {}, onHide: () => {}, onBackPress: () => {} }));
const clone = (value) => JSON.parse(JSON.stringify(value));
const wrappers = [];
beforeEach(() => {
  // 保留模块在明确开启时仍须通过原安全和恢复合同。
  vi.stubEnv('VITE_ENABLE_WRITING_COACH', 'false');
  vi.stubEnv('VITE_ENABLE_LEGACY_LEARNING', 'true');
  uni.clearStorageSync();
  setActivePinia(createPinia());
  initI18n();
});
afterEach(() => {
  wrappers
    .splice(0)
    .reverse()
    .forEach((wrapper) => wrapper.unmount());
  for (const store of getActivePinia()?._s.values() || []) store.$dispose();
  learningWriteLease.release();
  setLanguage('zh-CN');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function fixture() {
  const state = emptyLearningState('search-owner');
  state.conversations = [
    { id: 'math', goal: '方程练习', at: 1000, activeQuestionKey: 'math-q@2' },
    { id: 'writing', goal: 'English writing', at: 2000, activeQuestionKey: 'essay@1' }
  ];
  state.questions = [
    { id: 'math-q', version: 1, prompt: '解方程 x+3=5', subject: '数学' },
    { id: 'math-q', version: 2, prompt: '解方程 x+4=7', subject: '数学' },
    { id: 'essay', version: 1, prompt: '说明阅读材料中的观点', subject: '语文' },
    { id: 'unlinked', version: 1, prompt: '未关联题目不能被任意会话搜到' }
  ];
  state.attempts = [
    {
      id: 'old',
      conversationId: 'math',
      questionKey: 'math-q@1',
      answer: ' x=2\n',
      at: 3000,
      hints: [],
      grade: { status: 'reliable', outcome: 'correct' }
    },
    {
      id: 'wrong',
      conversationId: 'math',
      questionKey: 'math-q@2',
      answer: 'x=2',
      at: 4000,
      hints: [],
      grade: { status: 'reliable', outcome: 'wrong' }
    },
    {
      id: 'essay-answer',
      conversationId: 'writing',
      questionKey: 'essay@1',
      answer: '开头\n' + '保留原文'.repeat(1000) + '\nUniqueEvidence 末尾  ',
      at: 5000,
      hints: [{ id: 'help' }],
      grade: { status: 'pending', outcome: null }
    }
  ];
  return state;
}
describe('owner-local learning record search', () => {
  it('reuses readonly projections across queries, pages and equivalent reads, and rebuilds for revision or lifecycle changes', () => {
    const state = fixture(),
      search = createLearningRecordSearch();
    const build = vi.spyOn(state.questions, 'map');
    const DateTimeFormat = Intl.DateTimeFormat;
    const dates = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (...args) {
      return new DateTimeFormat(...args);
    });
    expect(search.search(state, 'absent-from-records', {}, 'context-a').total).toBe(0);
    expect(dates).not.toHaveBeenCalled();
    const result = search.search(state, '', { limit: 1 }, 'context-a');
    expect(dates).toHaveBeenCalledTimes(1);
    const target = search.target(state, result.items[0].id, 'context-a');
    expect(Object.isFrozen(target.grade)).toBe(true);
    expect(build).toHaveBeenCalledTimes(1);
    const equivalent = clone(state),
      equivalentBuild = vi.spyOn(equivalent.questions, 'map');
    search.search(equivalent, '', { offset: 1, limit: 1 }, 'context-a');
    expect(equivalentBuild).not.toHaveBeenCalled();
    equivalent.attempts[0].answer = 'new-revision-evidence';
    equivalent.revision++;
    expect(search.search(equivalent, 'new-revision-evidence', {}, 'context-a').total).toBe(1);
    expect(equivalentBuild).toHaveBeenCalledTimes(1);
    const restored = clone(equivalent);
    restored.attempts[0].answer = 'restored-same-revision';
    expect(search.search(restored, 'restored-same-revision', {}, 'context-b').total).toBe(1);
    search.clear();
    expect(search.search(emptyLearningState('other-owner'), '', {}, 'context-c').total).toBe(0);
  });
  it('finds goals, exact question versions, subjects and full original answers across disciplines without mutation', () => {
    const state = fixture(),
      before = clone(state);
    expect(searchLearningRecords(state, 'ENGLISH').items[0].kind).toBe('conversation');
    expect(searchLearningRecords(state, 'x+3=5').items[0]).toMatchObject({ questionKey: 'math-q@1', attemptId: 'old' });
    expect(searchLearningRecords(state, '语文').items[0].attemptId).toBe('essay-answer');
    const result = searchLearningRecords(state, 'uniqueevidence');
    expect(result.items[0].excerpt).toContain('UniqueEvidence');
    expect(learningRecordTarget(state, result.items[0].id).answer).toBe(state.attempts[2].answer);
    expect(state).toEqual(before);
  });
  it('normalizes width, case and whitespace for matching while treating regex and markup literally', () => {
    const state = fixture();
    expect(searchLearningRecords(state, 'Ｘ＝２').items).toHaveLength(2);
    expect(searchLearningRecords(state, '开头 保留原文').items).toHaveLength(1);
    for (const input of ['.*', '[x]', '<script>']) expect(searchLearningRecords(state, input).total).toBe(0);
  });
  it('paginates deterministically without losing or duplicating records', () => {
    const state = fixture(),
      all = searchLearningRecords(state, '').items;
    const pages = all.map((_, offset) => searchLearningRecords(state, '', { offset, limit: 1 }));
    expect(pages.flatMap((page) => page.items)).toEqual(all);
    expect(new Set(all.map((row) => row.id)).size).toBe(all.length);
    expect(pages.at(-1).hasMore).toBe(false);
    expect(pages[0].hasMore).toBe(true);
  });
  it('includes unsubmitted linked questions but never invents an answer or shares unlinked questions', () => {
    const state = fixture();
    state.attempts = [];
    state.events = [
      { type: 'question.focus', at: 3000, data: { conversationId: 'math', questionKey: 'math-q@1' } },
      { type: 'question.focus', at: 3000, data: { conversationId: 'missing', questionKey: 'unlinked@1' } }
    ];
    expect(searchLearningRecords(state, 'x+3=5').items[0]).toMatchObject({ kind: 'question', attemptId: null });
    expect(searchLearningRecords(state, '未关联').items).toEqual([]);
    expect(() => learningRecordTarget(state, '["other",null,null]')).toThrow();
  });
  it.each([{ limit: 0 }, { limit: 51 }, { offset: -1 }, { offset: 0.5 }])('rejects an invalid page %j', (options) => {
    expect(() => searchLearningRecords(fixture(), '', options)).toThrow();
  });
  it('rejects invalid query types and lengths, and returns a real empty state', () => {
    expect(searchLearningRecords(emptyLearningState('other-owner'), 'UniqueEvidence').total).toBe(0);
    for (const query of [null, {}, 'x'.repeat(121)]) expect(() => searchLearningRecords(fixture(), query)).toThrow();
  });
});
async function storeRecords() {
  const store = useConversationLearningStore();
  const conversation = store.start('题目：阅读这段文字并说明你的理由');
  const question = store.commit('question.add', {
    question: {
      id: 'search-reading',
      version: 1,
      scope: 'private',
      type: 'subjective',
      prompt: '阅读这段文字并说明你的理由',
      subject: '语文',
      source: { kind: 'user_input' }
    }
  });
  store.commit('question.focus', { conversationId: conversation.id, questionKey: question.questionKey });
  const first = store.submit('第一稿\n保留完整理由与末尾空格  ', true, 'search-first');
  store.submit('第二稿\n修订理由', true, 'search-second');
  store.start('12 + 8');
  store.submit('19', true, 'search-math');
  return { store, first };
}
describe('record location uses canonical facts', () => {
  it.each(
    ['cloud', 'local'].flatMap((mode) =>
      [
        'refresh',
        'same-token',
        'same-id',
        'userInfo',
        'EXAM_USER_INFO',
        'access_token',
        'refresh_token',
        'token_expire_time',
        'auth:restore'
      ].map((change) => ({ mode, change }))
    )
  )(
    'keeps configuration, search and the open original for $mode / $change through encrypted storage',
    async ({ mode, change }) => {
      storageService.save('EXAM_USER_ID', 'same-account-search-owner', true);
      storageService.save('EXAM_TOKEN', 'synthetic-original-session-token', true);
      const { store } = await storeRecords();
      const result = store.searchRecords('第一稿');
      store.openRecord(result.items[0].id, result.context);
      store.selectedMode = mode;
      store.modelId = 'explicit-model';
      store.models = [
        {
          id: 'explicit-model',
          provider: 'synthetic',
          model: 'explicit',
          source: 'byok',
          configured: true,
          capabilities: { stream: true }
        }
      ];
      store.modelPresets = [{ id: 'preset' }];
      store.usage = { fixture: 'visible-usage' };
      store.localConnection = { endpoint: 'http://127.0.0.1:8765/chat', consent: true };
      store.materialConnection = { endpoint: 'http://127.0.0.1:8765/parse', consent: true };
      store.sharingAllowed = true;
      store.streamEnabled = true;
      store.streamPreview = '当前预览';
      store.error = '保留的提示';
      const fields = [
        'selectedMode',
        'modelId',
        'models',
        'modelPresets',
        'usage',
        'localConnection',
        'materialConnection',
        'sharingAllowed',
        'streamEnabled',
        'streamPreview',
        'error'
      ];
      const configuration = () => clone(Object.fromEntries(fields.map((key) => [key, store[key]])));
      const before = configuration(),
        state = store.state,
        original = store.locatedRecord,
        location = store.conversationLocation,
        facts = store.exportData();
      const search = computed(() => store.searchRecords('第一稿'));
      const filtered = computed(() => store.searchRecords('', { filter: 'pending' }));
      expect(search.value.total).toBe(1);
      expect(filtered.value.total).toBe(2);
      if (change === 'auth:restore') uni.$on.mock.calls.findLast(([name]) => name === change)[1]();
      else {
        const key =
          change === 'refresh' || change === 'same-token'
            ? 'EXAM_TOKEN'
            : change === 'same-id'
              ? 'EXAM_USER_ID'
              : change;
        const value =
          change === 'refresh'
            ? 'synthetic-renewed-session-token'
            : change === 'same-token'
              ? 'synthetic-original-session-token'
              : change === 'same-id'
                ? 'same-account-search-owner'
                : { nickname: '更新资料' };
        expect(storageService.save(key, value, true)).toBe(true);
        expect(uni.getStorageSync(key)).toBe('');
        expect(uni.getStorageSync(`_enc_${key}`)).toBeTruthy();
      }
      expect(configuration()).toEqual(before);
      expect(store.state).toBe(state);
      expect(store.locatedRecord).toBe(original);
      expect(store.conversationLocation).toBe(location);
      expect(store.recordReadState).toBe('ready');
      expect(search.value.total).toBe(1);
      expect(filtered.value.total).toBe(2);
      expect(store.exportData()).toBe(facts);
    }
  );
  it.each(['EXAM_USER_ID', '_enc_EXAM_USER_ID', '__exam_storage__:EXAM_USER_ID', '__exam_storage__:_enc_EXAM_USER_ID'])(
    'revokes cached originals on %s using real encrypted login writes and fresh compat identity reads',
    async (eventKey) => {
      // Keep the uni event/request surface while exercising the browser compat storage.
      vi.stubGlobal('uni', {
        ...uni,
        getStorageSync: undefined,
        setStorageSync: undefined,
        removeStorageSync: undefined
      });
      localStorage.clear();
      storageService.saveLoginSession({ userId: 'search-peer', token: 'fixture-peer-token', userInfo: {} });
      const peerIdentity = localStorage.getItem('__exam_storage__:_enc_EXAM_USER_ID');
      const peerToken = localStorage.getItem('__exam_storage__:_enc_EXAM_TOKEN');
      const peerEpoch = localStorage.getItem('__exam_storage__:_enc_EXAM_SESSION_EPOCH');
      storageService.saveLoginSession({
        userId: 'search-current',
        token: 'synthetic-encrypted-search-token',
        userInfo: {}
      });
      expect(storageService.get('EXAM_USER_ID')).toBe('search-current'); // Warm the former compat cache.
      const { store } = await storeRecords();
      const result = store.searchRecords('第一稿');
      store.openRecord(result.items[0].id, result.context);
      const search = computed(() => store.searchRecords('第一稿'));
      const original = computed(() => store.locatedRecord);
      expect(search.value.total).toBe(1);
      expect(original.value.answer).toContain('第一稿');
      const oldFacts = localStorage.getItem('__exam_storage__:u_search-current_conversation_learning_v1');
      expect(localStorage.getItem('EXAM_USER_ID')).toBeNull();
      expect(localStorage.getItem('__exam_storage__:EXAM_USER_ID')).toBeNull();
      // A peer commits a fresh complete generation; this window receives only StorageEvent.
      const generation = JSON.parse(localStorage.getItem('__exam_storage__:EXAM_IDENTITY_GENERATION')).value + 1;
      const record = {
        ...deobfuscate(JSON.parse(peerEpoch).value),
        generation,
        epoch: `search-peer-fresh-${generation}`,
        revocation: `search-peer-fence-${generation}`
      };
      const encrypted = JSON.parse(peerIdentity).value;
      localStorage.setItem(
        eventKey.startsWith('__exam_storage__:') ? '__exam_storage__:_enc_EXAM_USER_ID' : '_enc_EXAM_USER_ID',
        eventKey.startsWith('__exam_storage__:') ? peerIdentity : encrypted
      );
      localStorage.setItem('__exam_storage__:_enc_EXAM_TOKEN', peerToken);
      localStorage.setItem('__exam_storage__:_enc_EXAM_SESSION_EPOCH', JSON.stringify({ value: obfuscate(record) }));
      localStorage.setItem('__exam_storage__:EXAM_SESSION_REVOCATION', JSON.stringify({ value: record.revocation }));
      localStorage.setItem('__exam_storage__:EXAM_IDENTITY_GENERATION', JSON.stringify({ value: generation }));
      window.dispatchEvent(new StorageEvent('storage', { key: eventKey }));
      expect(storageService.get('EXAM_USER_ID')).toBe('search-peer');
      expect(store.state.owner).toBe('search-peer');
      expect(search.value.items).toEqual([]);
      expect(original.value).toBeNull();
      expect(() => store.openRecord(result.items[0].id, result.context)).toThrow();
      expect(localStorage.getItem('__exam_storage__:u_search-current_conversation_learning_v1')).toBe(oldFacts);
      // Removing an encrypted identity must not resurrect the warmed cached account.
      localStorage.removeItem('__exam_storage__:_enc_EXAM_SESSION_EPOCH');
      localStorage.removeItem('_enc_EXAM_USER_ID');
      localStorage.removeItem('__exam_storage__:_enc_EXAM_USER_ID');
      window.dispatchEvent(new StorageEvent('storage', { key: eventKey }));
      expect(storageService.get('EXAM_USER_ID')).toBeNull();
      expect(store.state.owner).toBe('guest');
    }
  );
  it('invalidates encrypted same-window login, token removal and logout without a legacy auth event', async () => {
    storageService.save('EXAM_USER_ID', 'same-window-search-owner', true);
    storageService.save('EXAM_TOKEN', 'synthetic-search-token', true);
    const { store } = await storeRecords();
    const result = store.searchRecords('第一稿');
    store.openRecord(result.items[0].id, result.context);
    storageService.remove('EXAM_TOKEN', true);
    expect(store.locatedRecord).toBeNull();
    expect(store.state.owner).toBe('guest');
    storageService.saveLoginSession({
      userId: 'same-window-search-owner',
      token: 'synthetic-search-token',
      userInfo: {}
    });
    store.openRecord(store.searchRecords('第一稿').items[0].id, store.searchRecords('第一稿').context);
    storageService.saveLoginSession({ userId: 'same-window-second-owner', token: 'fixture-peer-token', userInfo: {} });
    expect(store.state.owner).toBe('same-window-second-owner');
    expect(store.searchRecords('第一稿').items).toEqual([]);
    expect(store.locatedRecord).toBeNull();
    storageService.remove('EXAM_USER_ID', true);
    expect(store.state.owner).toBe('guest');
  });
  it.each(['user:logout', 'loginStatusChanged', 'auth:userdata', 'storage-account', 'storage-lifecycle'])(
    'synchronously hides cached search, filters and the open answer before a failed %s read, then recovers',
    async (event) => {
      const { store } = await storeRecords();
      const result = store.searchRecords('第一稿');
      store.openRecord(result.items[0].id, result.context);
      const search = computed(() => store.searchRecords('第一稿'));
      const filtered = computed(() => store.searchRecords('', { filter: 'pending' }));
      const original = computed(() => store.locatedRecord);
      expect(search.value.items).toHaveLength(1);
      expect(filtered.value.total).toBe(2);
      expect(original.value.answer).toContain('第一稿');
      const oldOwner = store.state.owner;
      if (event !== 'storage-lifecycle') uni.setStorageSync('EXAM_USER_ID', 'incompatible-search-owner');
      const broken = emptyLearningState(event === 'storage-lifecycle' ? oldOwner : 'incompatible-search-owner');
      broken.version = 2;
      storageService.save(LEARNING_KEY, broken, true);
      const read = learningRepository.read;
      const reading = vi.spyOn(learningRepository, 'read').mockImplementation(() => {
        expect(store.recordReadState).toBe('loading');
        expect(search.value.items).toEqual([]);
        expect(filtered.value.items).toEqual([]);
        expect(original.value).toBeNull();
        return read();
      });
      if (event.startsWith('storage-')) {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: event === 'storage-account' ? 'EXAM_USER_ID' : `${LEARNING_KEY}_lifecycle`
          })
        );
      } else {
        const handler = uni.$on.mock.calls.findLast(([name]) => name === event)?.[1];
        expect(handler).toBeTypeOf('function');
        expect(() => handler()).not.toThrow();
      }
      expect(reading).toHaveBeenCalled();
      expect(store.recordReadState).toBe('error');
      expect(store.state.conversations).toEqual([]);
      expect(search.value.items).toEqual([]);
      expect(filtered.value.items).toEqual([]);
      expect(original.value).toBeNull();
      await flushPromises();
      expect(search.value.items).toEqual([]);
      expect(original.value).toBeNull();
      expect(() => store.openRecord(result.items[0].id, result.context)).toThrow();
      reading.mockRestore();
      storageService.save(LEARNING_KEY, { ...broken, version: 1 }, true);
      store.reloadRecords();
      expect(store.recordReadState).toBe('ready');
      expect(store.searchRecords('第一稿').items).toEqual([]);
      expect(store.locatedRecord).toBeNull();
    }
  );
  it('removes rendered results and the full answer on an incompatible account and offers a short retry state', async () => {
    const { store } = await storeRecords();
    const result = store.searchRecords('第一稿');
    store.openRecord(result.items[0].id, result.context);
    const wrapper = mount(LearningPage, {
      attachTo: document.body,
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          BaseIcon: true,
          PrivacyPopup: true,
          LearningLab: true
        }
      }
    });
    wrappers.push(wrapper);
    const shell = wrapper.findComponent(LearningShell);
    await shell.get('.rail-item[aria-label="搜索题目、原答或对话"]').trigger('tap');
    await flushPromises();
    shell
      .findAllComponents(BaseInput)
      .find((row) => Number(row.props('maxlength')) === 120)
      .vm.$emit('update:modelValue', '第一稿');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await flushPromises();
    expect(shell.get('[aria-label="学习记录搜索结果"]').text()).toContain('第一稿');
    expect(wrapper.get('[data-test="located-original-answer"]').text()).toContain('第一稿');
    uni.setStorageSync('EXAM_USER_ID', 'incompatible-render-owner');
    storageService.save(LEARNING_KEY, { ...emptyLearningState('incompatible-render-owner'), version: 2 }, true);
    const notify = uni.$on.mock.calls.findLast(([name]) => name === 'loginStatusChanged')[1];
    notify();
    await flushPromises();
    expect(wrapper.find('[data-test="located-original-answer"]').exists()).toBe(false);
    expect(shell.find('[aria-label="学习记录搜索结果"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('第一稿');
    expect(wrapper.text()).not.toContain('第二稿');
    expect(wrapper.text()).toContain('学习记录暂不可读，请重试。');
    setLanguage('en');
    await flushPromises();
    expect(wrapper.text()).toContain('Learning records are unavailable. Try again.');
    expect(wrapper.text()).not.toContain('第一稿');
  });
  it('rejects a pre-clear result even when a same-owner restore reuses its IDs, and supports a fresh search', async () => {
    const { store } = await storeRecords(),
      result = store.searchRecords('第一稿'),
      backup = store.exportData();
    store.openRecord(result.items[0].id, result.context);
    store.deleteData();
    expect(store.locatedRecord).toBeNull();
    store.restoreData(backup, await store.previewRestore(backup));
    const restored = store.exportData();
    expect(() => store.openRecord(result.items[0].id, result.context)).toThrow();
    expect(store.exportData()).toBe(restored);
    const fresh = store.searchRecords('第一稿');
    expect(fresh.items).toHaveLength(1);
    store.openRecord(fresh.items[0].id, fresh.context);
    expect(store.locatedRecord.answer).toContain('第一稿');
  });
  it('only navigates on explicit opening, keeps a selected old original and stopped status, and never requests a model', async () => {
    const { store, first } = await storeRecords();
    const session = store.state.conversations.find((row) => row.id === first.conversationId);
    store.commit('task.stop', { conversationId: session.id });
    const before = clone(store.state),
      request = vi.spyOn(uni, 'request');
    const result = store.searchRecords('第一稿');
    expect(store.state).toEqual(before);
    store.openRecord(result.items[0].id, result.context);
    expect(store.active.id).toBe(first.conversationId);
    expect(store.active.stopped).toBe(true);
    expect(store.locatedRecord).toMatchObject({
      attemptId: first.id,
      answer: first.answer,
      grade: { status: 'pending' }
    });
    for (const key of ['attempts', 'questions', 'profile', 'reviews', 'plans'])
      expect(store.state[key]).toEqual(before[key]);
    store.dismissLocatedRecord();
    expect(store.locatedRecord).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
  it('rejects stale account results before navigation and hides selected originals on account change', async () => {
    const { store } = await storeRecords(),
      result = store.searchRecords('第一稿');
    store.openRecord(result.items[0].id, result.context);
    uni.setStorageSync('EXAM_USER_ID', 'different-search-owner');
    expect(store.searchRecords('第一稿').items).toEqual([]);
    store.refresh();
    const before = clone(store.state);
    expect(store.locatedRecord).toBeNull();
    expect(() => store.openRecord(result.items[0].id, result.context)).toThrow();
    expect(store.state).toEqual(before);
    expect(store.searchRecords('第一稿').items).toEqual([]);
  });
  it('renders the exact selected original as text and searching keeps facts unchanged in both languages', async () => {
    const { store, first } = await storeRecords();
    const wrapper = mount(LearningPage, {
      attachTo: document.body,
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          BaseIcon: true,
          PrivacyPopup: true,
          LearningLab: true
        }
      }
    });
    wrappers.push(wrapper);
    const shell = wrapper.findComponent(LearningShell);
    await shell.get('.rail-item[aria-label="搜索题目、原答或对话"]').trigger('tap');
    await flushPromises();
    const input = shell.findAllComponents(BaseInput).find((row) => Number(row.props('maxlength')) === 120);
    const before = store.exportData();
    input.vm.$emit('update:modelValue', '第一稿');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await flushPromises();
    expect(store.exportData()).toBe(before);
    const row = shell.findAllComponents(BaseButton).find((button) => button.text().includes('第一稿'));
    expect(row).toBeTruthy();
    row.vm.$emit('tap');
    await flushPromises();
    expect(wrapper.get('[data-test="located-original-answer"]').element.textContent).toBe(first.answer);
    const afterOpen = store.exportData();
    setLanguage('en');
    await flushPromises();
    expect(wrapper.get('#learning-record-original').text()).toContain('Pending review');
    expect(wrapper.get('[data-test="located-original-answer"]').element.textContent).toBe(first.answer);
    expect(store.exportData()).toBe(afterOpen);
  });
});

describe('cross-subject review filters use saved evidence', () => {
  it('debounces draft input, clears immediately, and cancels pending work on unmount without submitting facts', async () => {
    const { store } = await storeRecords();
    const before = store.exportData();
    const wrapper = mount(LearningShell, { global: { stubs: { BaseIcon: true } } });
    await wrapper.get('.rail-item[aria-label="搜索题目、原答或对话"]').trigger('tap');
    await flushPromises();
    const input = wrapper.findAllComponents(BaseInput).find((row) => Number(row.props('maxlength')) === 120);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const search = vi.spyOn(store, 'searchRecords');
      for (const value of ['第', '第一', '第一稿']) input.vm.$emit('update:modelValue', value);
      await vi.advanceTimersByTimeAsync(179);
      await flushPromises();
      expect(search).not.toHaveBeenCalled();
      // 当前读取状态用骨架呈现；保留可访问的精确状态名。
      expect(wrapper.get('.muse-list-skeleton[role="status"]').attributes('aria-label')).toBe(
        t('learning.records.loading')
      );
      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();
      expect(search).toHaveBeenCalledTimes(1);
      expect(wrapper.get('[aria-label="学习记录搜索结果"]').text()).toContain('第一稿');
      input.vm.$emit('update:modelValue', '');
      await flushPromises();
      expect(wrapper.find('[aria-label="学习记录搜索结果"]').exists()).toBe(false);
      input.vm.$emit('update:modelValue', '取消中的搜索');
      wrapper.unmount();
      await vi.advanceTimersByTimeAsync(1000);
      expect(search).toHaveBeenCalledTimes(1);
      expect(store.exportData()).toBe(before);
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });
  it('separates reliable wrong, partial, pending and helped answers without counting unsubmitted questions', () => {
    const state = fixture(),
      before = clone(state);
    expect(searchLearningRecords(state, '', { filter: 'wrong' }).items.map((row) => row.attemptId)).toEqual(['wrong']);
    expect(searchLearningRecords(state, '', { filter: 'partial' }).total).toBe(0);
    expect(searchLearningRecords(state, '', { filter: 'pending' }).items.map((row) => row.attemptId)).toEqual([
      'essay-answer'
    ]);
    expect(searchLearningRecords(state, '', { filter: 'helped' }).items[0]).toMatchObject({
      attemptId: 'essay-answer',
      gradeStatus: 'pending',
      outcome: null,
      helped: true
    });
    expect(state).toEqual(before);
    state.attempts = [];
    state.revision++;
    expect(searchLearningRecords(state, '', { filter: 'pending' }).total).toBe(0);
  });
  it('uses the latest effective correction, keeps partial separate, and never upgrades AI assistance to reliable grading', () => {
    const state = fixture();
    state.attempts[1].corrections = [{ grade: { status: 'pending', outcome: null } }];
    state.attempts[1].assistance = [{ score: 100, outcome: 'correct' }];
    state.attempts[0].grade = { status: 'reliable', outcome: 'partial' };
    expect(searchLearningRecords(state, '', { filter: 'wrong' }).items).toEqual([]);
    expect(searchLearningRecords(state, '', { filter: 'partial' }).items.map((row) => row.attemptId)).toEqual(['old']);
    expect(searchLearningRecords(state, '', { filter: 'pending' }).items.map((row) => row.attemptId)).toEqual([
      'essay-answer',
      'wrong'
    ]);
    state.attempts[1].corrections.push({ grade: { status: 'reliable', outcome: 'correct' } });
    state.revision++;
    expect(searchLearningRecords(state, '', { filter: 'pending' }).items.map((row) => row.attemptId)).toEqual([
      'essay-answer'
    ]);
  });
  it('intersects literal search with a filter and retains an old wrong answer after a later correct attempt', () => {
    const state = fixture();
    state.attempts.push({
      ...state.attempts[1],
      id: 'fixed',
      answer: 'x=3',
      at: 6000,
      grade: { status: 'reliable', outcome: 'correct' }
    });
    expect(searchLearningRecords(state, 'x=2', { filter: 'wrong' }).items.map((row) => row.attemptId)).toEqual([
      'wrong'
    ]);
    expect(searchLearningRecords(state, 'English', { filter: 'wrong' }).total).toBe(0);
    expect(learningRecordTarget(state, searchLearningRecords(state, '', { filter: 'wrong' }).items[0].id).answer).toBe(
      'x=2'
    );
  });
  it('paginates the filtered result rather than filtering an already truncated page', () => {
    const state = fixture(),
      base = state.attempts[1];
    state.attempts = Array.from({ length: 23 }, (_, i) => ({ ...base, id: `wrong-${i}`, at: 10000 + i }));
    const pages = [0, 8, 16].map((offset) => searchLearningRecords(state, '', { offset, limit: 8, filter: 'wrong' }));
    expect(pages.map((page) => page.items.length)).toEqual([8, 8, 7]);
    expect(new Set(pages.flatMap((page) => page.items.map((row) => row.id))).size).toBe(23);
    expect(pages.map((page) => page.total)).toEqual([23, 23, 23]);
    expect(pages.at(-1).hasMore).toBe(false);
  });
  it.each(['mastered', '__proto__', null])('rejects unsupported filters %s', (filter) => {
    expect(() => searchLearningRecords(fixture(), '', { filter })).toThrow();
  });
  it('searches and clears in the single-input palette without filter chips, tags, writes or model requests in both languages', async () => {
    const { store } = await storeRecords();
    const wrapper = mount(LearningShell, {
      attachTo: document.body,
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          BaseIcon: true
        }
      }
    });
    wrappers.push(wrapper);
    await wrapper.get('.rail-item[aria-label="搜索题目、原答或对话"]').trigger('tap');
    await flushPromises();
    const before = store.exportData(),
      request = vi.spyOn(uni, 'request');
    // 批次 12A：搜索浮层只保留一个输入，不再呈现筛选 chip 或结果 Tag。
    expect(wrapper.findAllComponents(BaseChip)).toHaveLength(0);
    expect(wrapper.findAll('input, textarea')).toHaveLength(1);
    const input = wrapper.findComponent(BaseInput);
    input.vm.$emit('update:modelValue', '第一稿');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await flushPromises();
    expect(wrapper.get('[aria-label="学习记录搜索结果"]').text()).toContain('第一稿');
    expect(wrapper.get('[aria-label="学习记录搜索结果"]').findAll('.base-tag')).toHaveLength(0);
    expect(store.exportData()).toBe(before);
    input.vm.$emit('update:modelValue', '不存在的学习原文');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await flushPromises();
    expect(wrapper.text()).toContain('没有匹配的学习记录');
    setLanguage('en');
    await flushPromises();
    expect(wrapper.text()).toContain('No matching learning records');
    expect(wrapper.findAllComponents(BaseChip)).toHaveLength(0);
    input.vm.$emit('update:modelValue', '');
    await flushPromises();
    expect(wrapper.find('[aria-label="Learning record search results"]').exists()).toBe(false);
    input.vm.$emit('update:modelValue', '第一稿');
    await new Promise((resolve) => setTimeout(resolve, 200));
    await flushPromises();
    expect(wrapper.get('[aria-label="Learning record search results"]').text()).toContain('第一稿');
    expect(wrapper.get('[aria-label="Learning record search results"]').findAll('.base-tag')).toHaveLength(0);
    expect(store.exportData()).toBe(before);
    expect(request).not.toHaveBeenCalled();
  });
});
