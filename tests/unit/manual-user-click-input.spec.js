// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const safeNavigateToMock = vi.hoisted(() => vi.fn());
const proxyAIMock = vi.hoisted(() => vi.fn());
const storageGetMock = vi.hoisted(() => vi.fn());
const storageSaveMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: {
    trackApi: vi.fn(),
    trackRender: vi.fn(),
    getReport: vi.fn(() => ({}))
  }
}));

vi.mock('@/utils/safe-navigate', () => ({
  safeNavigateTo: safeNavigateToMock,
  default: safeNavigateToMock
}));

vi.mock('@/utils/favorite/question-favorite.js', () => ({
  getFavorites: vi.fn(() => [])
}));

vi.mock('@/utils/learning/adaptive-learning-engine.js', () => ({
  getLearningStats: vi.fn(() => ({ todayQuestions: 0, overallAccuracy: 0 })),
  getWeakKnowledgePoints: vi.fn(() => [])
}));

vi.mock('@/services/lafService.js', () => ({
  lafService: {
    proxyAI: proxyAIMock,
    getHotSchools: vi.fn().mockResolvedValue({ code: 0, success: true, data: [] }),
    request: vi.fn()
  }
}));

// B2 迁移：school 页面现通过 schoolStore 调用，需 mock store
vi.mock('@/stores/modules/school', () => ({
  useSchoolStore: vi.fn(() => ({
    aiRecommend: proxyAIMock,
    fetchHotSchools: vi.fn().mockResolvedValue({ code: 0, data: [] }),
    crawlSchoolData: vi.fn().mockResolvedValue({ code: 0, data: { list: [] } }),
    searchSchools: vi.fn(),
    fetchSchoolDetail: vi.fn(),
    aiPredict: vi.fn()
  }))
}));

vi.mock('@/services/storageService.js', () => {
  const mockService = {
    get: storageGetMock,
    save: storageSaveMock,
    saveDebounced: vi.fn(),
    remove: vi.fn(),
    flushPendingWrites: vi.fn()
  };
  return {
    storageService: mockService,
    default: mockService
  };
});

vi.mock('@/utils/auth/loginGuard.js', () => ({
  isUserLoggedIn: vi.fn(() => true),
  requireLogin: vi.fn((cb) => {
    if (typeof cb === 'function') cb();
    return true;
  })
}));

vi.mock('@/utils/helpers/haptic.js', () => ({
  vibrateLight: vi.fn()
}));

vi.mock('@/utils/core/system.js', () => ({
  getStatusBarHeight: vi.fn(() => 44)
}));

vi.mock('@/config/index.js', () => ({
  default: {
    isDev: true,
    externalCdn: {
      dicebearBaseUrl: 'https://example.com'
    },
    deepLink: {
      h5BaseUrl: 'https://example.com'
    }
  }
}));

import PracticePage from '@/pages/practice/index.vue';
import SchoolPage from '@/pages/school/index.vue';

async function flushTicks(times = 3) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe('模拟用户真实点击与输入（组件交互层）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.__mockStorage = {};

    storageGetMock.mockImplementation((key, defaultValue = null) => {
      if (key === 'v30_bank') return [];
      if (key === 'v30_user_answers') return {};
      if (key === 'imported_files') return [];
      if (key === 'target_schools') return [];
      return defaultValue;
    });
  });

  it('刷题页：用户真实点击导入资料卡片后可立即进入导入页', async () => {
    const wrapper = shallowMount(PracticePage);
    // ✅ [D002重构] isPageLoading, hasBank 现为 setup() 返回的 ref，
    // 需要直接修改 vm 属性而非 setData
    wrapper.vm.isPageLoading = false;
    wrapper.vm.hasBank = true;
    wrapper.vm.dynamicMethodsCache = {};
    await wrapper.vm.$nextTick();

    const importCard = wrapper.find('.import-card');
    expect(importCard.exists()).toBe(true);

    await importCard.trigger('tap');

    expect(safeNavigateToMock).toHaveBeenCalledTimes(1);
    expect(safeNavigateToMock).toHaveBeenCalledWith('/pages/practice-sub/import-data');
  });

  it('择校页：用户输入并点击提交后可进入推荐结果页', async () => {
    proxyAIMock.mockResolvedValue({
      code: 0,
      success: true,
      data: {
        reply: JSON.stringify([
          {
            id: 's1',
            name: '浙江大学',
            location: '浙江',
            tags: ['985', '211'],
            matchRate: 86,
            majors: [
              {
                code: '085404',
                name: '计算机技术',
                type: '专硕',
                scores: [{ total: 382, eng: 60 }]
              }
            ]
          }
        ])
      }
    });

    const wrapper = shallowMount(SchoolPage);
    await wrapper.setData({
      isLoading: false,
      currentStep: 1,
      isSubmitting: false
    });

    let inputs = wrapper.findAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    await inputs[0].setValue('武汉大学');
    await inputs[1].setValue('计算机科学与技术');
    await flushTicks();

    const step1NextBtn = wrapper.find('button.primary-btn');
    await step1NextBtn.trigger('tap');
    await flushTicks();

    expect(wrapper.vm.currentStep).toBe(2);

    inputs = wrapper.findAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    await inputs[0].setValue('浙江大学');
    await inputs[1].setValue('计算机技术');
    await flushTicks();

    const submitBtn = wrapper.find('button.pulse-btn');
    await submitBtn.trigger('tap');
    await flushTicks(8);

    expect(proxyAIMock).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.currentStep).toBe(3);
    expect(wrapper.vm.schoolList.length).toBeGreaterThan(0);
    expect(wrapper.vm.schoolList[0].name).toBe('浙江大学');
  });
});
