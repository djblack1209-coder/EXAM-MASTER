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
    const loadSubPackageMock = vi.fn(({ root, success }) => {
      expect(root).toBe('pages/practice-sub');
      success?.();
    });
    uni.loadSubPackage = loadSubPackageMock;

    const ctx = {
      subPackageLoaded: false
    };

    await PracticePage.methods._ensurePracticeSubPackageLoaded.call(ctx);
    await PracticePage.methods._ensurePracticeSubPackageLoaded.call(ctx);

    expect(ctx.subPackageLoaded).toBe(true);
    expect(loadSubPackageMock).toHaveBeenCalledTimes(1);
  });

  it('_loadAIGenerationMixin 应先加载分包再注入方法', async () => {
    const chooseImportSource = vi.fn(() => 'ok');
    const loadLearningStats = vi.fn(() => Promise.resolve());

    const ctx = {
      _mixinLoaded: false,
      dynamicMethodsCache: {},
      _ensurePracticeSubPackageLoaded: vi.fn(() => Promise.resolve()),
      _requirePracticeSubpackageModule: vi.fn((modulePath) => {
        if (modulePath.includes('ai-generation-mixin')) {
          return Promise.resolve({
            aiGenerationMixin: {
              methods: {
                chooseImportSource
              }
            }
          });
        }
        return Promise.resolve({
          learningStatsMixin: {
            methods: {
              loadLearningStats
            }
          }
        });
      })
    };

    await PracticePage.methods._loadAIGenerationMixin.call(ctx);

    expect(ctx._ensurePracticeSubPackageLoaded).toHaveBeenCalledTimes(1);
    expect(ctx._requirePracticeSubpackageModule).toHaveBeenCalledTimes(2);
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
