// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';

vi.mock('@/utils/practice/demo-bank.js', () => ({
  isGuestDemoEnabled: () => false,
  startGuestDemoPractice: vi.fn()
}));

vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

import PracticePage from '@/pages/practice/index.vue';
import storageService from '@/services/storageService.js';
import { saveQuizProgress } from '@/composables/useQuizAutoSave.js';
import { aiGenerationMixin } from '@/pages/practice-sub/composables/ai-generation-mixin.js';

enableAutoUnmount(afterEach);

function mountPractice({ hasBank = false, hasQuizResume = false } = {}) {
  if (hasBank) storageService.save('v30_bank', [{ id: 'fixture', question: '合成题' }]);
  const wrapper = mount(
    {
      ...PracticePage,
      computed: {
        ...PracticePage.computed,
        navigationTree: () => [
          {
            id: 'subject',
            tracks: [
              {
                id: 'track',
                banks: [],
                modes: [
                  { id: 'past_exam', label: '普通练习' },
                  { id: 'timed_sprint', label: '限时练习' },
                  { id: 'weakness', label: '错题强化' }
                ]
              }
            ]
          }
        ],
        publicCoursePlan: () => ({ today: {}, weeklyTasks: [] })
      }
    },
    {
      data: () => ({ hasQuizResume }),
      global: { plugins: [createPinia()], stubs: { BaseStat: true, BaseEmpty: true, CustomTabbar: true } }
    }
  );
  wrapper.vm.hasBank = hasBank;
  return wrapper;
}

describe('practice template mode entry', () => {
  it('selects weakness as a draft, then explicitly starts review without a bank', async () => {
    const wrapper = mountPractice();
    const before = JSON.stringify(global.__mockStorage);
    expect(wrapper.find('.practice-new').exists()).toBe(false);
    await wrapper.get('.mode-row').findAll('button')[2].trigger('tap');
    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(wrapper.get('.practice-command.primary').text()).toContain('错题强化');
    await wrapper.get('.practice-command.primary').trigger('tap');
    expect(uni.navigateTo.mock.calls.map(([options]) => options.url)).toEqual(['/pages/mistake/index?mode=review']);
    expect(uni.showToast).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('exposes independent review without a bank and keeps ordinary/timed entry in the directory', async () => {
    const wrapper = mountPractice();
    await wrapper.get('.practice-review').trigger('tap');
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/mistake/index?mode=review');
    for (const index of [0, 1]) {
      await wrapper.get('.mode-row').findAll('button')[index].trigger('tap');
      expect(wrapper.find('.practice-new').exists()).toBe(false);
      await wrapper.get('.practice-command.primary').trigger('tap');
      expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/practice-sub/question-bank');
    }
  });

  it('preserves explicit continuation priority while weakness start begins review', async () => {
    saveQuizProgress(
      {
        questions: [
          { id: 'saved-a', question: '合成续答题一' },
          { id: 'saved-b', question: '合成续答题二' }
        ],
        currentIndex: 1,
        seconds: 30,
        hasAnswered: false,
        answeredQuestions: []
      },
      true
    );
    const wrapper = mountPractice({ hasQuizResume: true });
    const before = JSON.stringify(global.__mockStorage);
    await wrapper.get('.mode-row').findAll('button')[2].trigger('tap');
    await wrapper.get('.practice-command.primary').trigger('tap');
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/practice-sub/do-quiz?resume=true');
    await wrapper.get('.practice-new').trigger('tap');
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/mistake/index?mode=review');
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it.each([
    ['past_exam', 0, ''],
    ['timed_sprint', 1, '?mode=timed_sprint']
  ])('keeps %s start checking the bank after the button was rendered', async (_mode, index, query) => {
    const wrapper = mountPractice({ hasBank: true });
    await wrapper.get('.mode-row').findAll('button')[index].trigger('tap');
    await wrapper.get('.practice-command.primary').trigger('tap');
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe(`/pages/practice-sub/do-quiz${query}`);
    uni.navigateTo.mockClear();
    storageService.save('v30_bank', []);
    await wrapper.get('.practice-command.primary').trigger('tap');
    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '请先加载题库' }));
  });
});

describe('practice 动态方法加载', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.__mockStorage = {};
    uni.loadSubPackage = undefined;
  });

  it('opens the paper directory without retired processing copy or data writes', () => {
    const before = JSON.stringify(global.__mockStorage);
    aiGenerationMixin.methods.chooseImportSource.call({});
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/practice-sub/question-bank');
    expect(uni.showToast).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('continues the saved complete session rather than starting a newly picked group', () => {
    const questions = Array.from({ length: 38 }, (_, i) => ({ id: `saved-${i}`, question: `原第${i + 1}题` }));
    saveQuizProgress({ questions, currentIndex: 17, seconds: 418, hasAnswered: false, answeredQuestions: [] }, true, {
      mode: 'smart_review',
      paperId: 'politics-2024',
      questionBankFingerprint: 'original'
    });
    const before = JSON.stringify(storageService.get('EXAM_QUIZ_PROGRESS'));
    PracticePage.methods.goDoQuiz.call({ hasBank: true, refreshBankStatus: vi.fn() }, { resume: true });
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/practice-sub/do-quiz?resume=true' })
    );
    expect(JSON.stringify(storageService.get('EXAM_QUIZ_PROGRESS'))).toBe(before);
  });

  it('keeps explicit start separate from continuation, and can continue a complete snapshot after the bank is unavailable', () => {
    saveQuizProgress(
      {
        questions: [
          { id: 'a', question: '原题一' },
          { id: 'b', question: '原题二' }
        ],
        currentIndex: 1,
        seconds: 30,
        hasAnswered: false,
        answeredQuestions: []
      },
      true
    );
    PracticePage.methods.goDoQuiz.call({ hasBank: true, refreshBankStatus: vi.fn() });
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/practice-sub/do-quiz');
    PracticePage.methods.goDoQuiz.call({ hasBank: false, refreshBankStatus: vi.fn() }, { resume: true });
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/practice-sub/do-quiz?resume=true');
  });

  it('starts a new ordinary group when there is no recoverable snapshot, keeping the bad cache intact', () => {
    storageService.save('EXAM_QUIZ_PROGRESS', '{bad');
    storageService.save('EXAM_QUIZ_PROGRESS_TIME', String(Date.now()));
    const before = JSON.stringify(global.__mockStorage);
    PracticePage.methods.goDoQuiz.call({ hasBank: true, refreshBankStatus: vi.fn() }, { resume: true });
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/practice-sub/do-quiz');
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('keeps mode selection as a draft and enters the chosen flow only on explicit start', () => {
    const context = { hasBank: true, selectedModeId: 'past_exam', refreshBankStatus: vi.fn() };
    const before = JSON.stringify(global.__mockStorage);
    PracticePage.methods.selectMode.call(context, 'timed_sprint');
    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    PracticePage.methods.goDoQuiz.call(context);
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/practice-sub/do-quiz?mode=timed_sprint');
    context.selectedModeId = 'weakness';
    PracticePage.methods.goDoQuiz.call(context);
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/mistake/index?mode=review');
    PracticePage.methods.goSmartReview.call(context);
    expect(uni.navigateTo.mock.calls.at(-1)[0].url).toBe('/pages/mistake/index?mode=review');
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('_invokeDynamicMethod 应优先调用已缓存方法', async () => {
    const cachedMethod = vi.fn((x) => x + 1);
    const ctx = {
      dynamicMethodsCache: {
        addOne: cachedMethod
      }
    };

    const result = await PracticePage.methods._invokeDynamicMethod.call(ctx, 'addOne', [41], { silent: true });

    expect(result).toBe(42);
    expect(cachedMethod).toHaveBeenCalledWith(41);
  });

  it('_invokeDynamicMethod 应等待 _mixinReady 后再调用动态方法', async () => {
    const delayedMethod = vi.fn(() => 'ready');
    let resolveReady;

    const ctx = {
      dynamicMethodsCache: {},
      _mixinReady: new Promise((resolve) => {
        resolveReady = resolve;
      })
    };

    const pending = PracticePage.methods._invokeDynamicMethod.call(ctx, 'delayedAction', [], { silent: true });

    ctx.dynamicMethodsCache.delayedAction = delayedMethod;
    resolveReady();

    const result = await pending;

    expect(result).toBe('ready');
    expect(delayedMethod).toHaveBeenCalledTimes(1);
  });

  it('_invokeDynamicMethod 在方法缺失且非静默时应提示', async () => {
    const ctx = {
      dynamicMethodsCache: {},
      _mixinReady: Promise.resolve()
    };

    const result = await PracticePage.methods._invokeDynamicMethod.call(ctx, 'missingAction', [], { silent: false });

    expect(result).toBeUndefined();
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '功能初始化失败，请稍后重试',
        icon: 'none'
      })
    );
  });

  it('_ensurePracticeSubPackageLoaded 应仅加载一次分包', async () => {
    // ✅ [D002重构] 此方法已由 useDynamicMixin composable 提供
    // 测试 composable 的 ensurePracticeSubPackageLoaded 逻辑
    const { useDynamicMixin } = await import('@/composables/useDynamicMixin.js');
    const loadSubPackageMock = vi.fn(({ root, success }) => {
      expect(root).toBe('pages/practice-sub');
      success?.();
    });
    uni.loadSubPackage = loadSubPackageMock;

    const mixin = useDynamicMixin();
    await mixin.ensurePracticeSubPackageLoaded();
    await mixin.ensurePracticeSubPackageLoaded();

    expect(mixin.subPackageLoaded.value).toBe(true);
    expect(loadSubPackageMock).toHaveBeenCalledTimes(1);
  });

  it('_loadAIGenerationMixin 应先加载分包再注入方法', async () => {
    // ✅ [D002重构] 此方法已由 useDynamicMixin composable 提供
    // 通过组件方法测试，需要提供 dynamicMixinHelper 上下文
    const chooseImportSource = vi.fn(() => 'ok');
    const loadLearningStats = vi.fn(() => Promise.resolve());

    const mockDynamicMixin = {
      loadAIGenerationMixin: vi.fn(async (instance) => {
        instance.dynamicMethodsCache = instance.dynamicMethodsCache || {};
        instance.dynamicMethodsCache.chooseImportSource = chooseImportSource;
        instance.dynamicMethodsCache.loadLearningStats = loadLearningStats;
        instance._mixinLoaded = true;
      })
    };

    const ctx = {
      _mixinLoaded: false,
      dynamicMethodsCache: {},
      dynamicMixinHelper: mockDynamicMixin
    };

    await PracticePage.methods._loadAIGenerationMixin.call(ctx);

    expect(mockDynamicMixin.loadAIGenerationMixin).toHaveBeenCalledTimes(1);
    expect(ctx._mixinLoaded).toBe(true);
    expect(typeof ctx.dynamicMethodsCache.chooseImportSource).toBe('function');
    expect(typeof ctx.dynamicMethodsCache.loadLearningStats).toBe('function');
    expect(ctx.dynamicMethodsCache.chooseImportSource()).toBe('ok');
  });

  it('chooseImportSource 在分包方法缺失时应回退到题库页', () => {
    const ctx = {
      dynamicMethodsCache: {}
    };

    PracticePage.methods.chooseImportSource.call(ctx);

    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.navigateTo.mock.calls[0][0].url).toBe('/pages/practice-sub/question-bank');
  });

  it('openBankDetail 应忽略同一题库的重复点击，避免重复打开', async () => {
    const ctx = {
      loadingBankId: null,
      openQuestionBank: vi.fn()
    };

    await PracticePage.methods.openBankDetail.call(ctx, 'english1-2025');
    ctx.loadingBankId = 'english1-2025';
    await PracticePage.methods.openBankDetail.call(ctx, 'english1-2025');

    expect(ctx.openQuestionBank).toHaveBeenCalledTimes(1);
    expect(ctx.openQuestionBank).toHaveBeenCalledWith('english1-2025');
  });

  it('goDoQuiz 无本地题库时应停留在刷题中心并提示导入', () => {
    const ctx = { hasBank: false };

    PracticePage.methods.goDoQuiz.call(ctx);

    expect(uni.navigateTo).not.toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '请先加载题库' }));
  });
});
