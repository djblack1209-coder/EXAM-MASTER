// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

import PracticePage from '@/pages/practice/index.vue';

describe('practice 动态方法加载', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.__mockStorage = {};
    uni.loadSubPackage = undefined;
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

  it('chooseImportSource 在分包方法缺失时应回退到导入页', () => {
    const ctx = {
      dynamicMethodsCache: {}
    };

    PracticePage.methods.chooseImportSource.call(ctx);

    expect(uni.navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.navigateTo.mock.calls[0][0].url).toBe('/pages/practice-sub/import-data');
  });
});
