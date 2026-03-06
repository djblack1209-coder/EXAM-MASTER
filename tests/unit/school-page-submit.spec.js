// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxyAIMock = vi.hoisted(() => vi.fn());
const storageGetMock = vi.hoisted(() => vi.fn());
const storageSaveMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/lafService.js', () => ({
  lafService: {
    proxyAI: proxyAIMock,
    getHotSchools: vi.fn(),
    request: vi.fn()
  }
}));

vi.mock('@/services/storageService.js', () => ({
  default: {
    get: storageGetMock,
    save: storageSaveMock
  }
}));

vi.mock('@/utils/auth/loginGuard.js', () => ({
  isUserLoggedIn: vi.fn(() => true)
}));

vi.mock('@/utils/helpers/haptic.js', () => ({
  vibrateLight: vi.fn()
}));

vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/utils/core/system.js', () => ({
  getStatusBarHeight: vi.fn(() => 44)
}));

vi.mock('@/config/index.js', () => ({
  default: {
    externalCdn: {
      dicebearBaseUrl: 'https://example.com'
    }
  }
}));

import SchoolPage from '@/pages/school/index.vue';

describe('school 页面提交逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageGetMock.mockImplementation((key, defaultValue = null) => {
      if (key === 'target_schools') {
        return [{ id: 's1' }];
      }
      return defaultValue;
    });
  });

  it('syncTargetStatus 应覆盖旧状态并保持一致', () => {
    const ctx = {
      schoolList: [
        { id: 's1', isTarget: false },
        { id: 's2', isTarget: true }
      ]
    };

    SchoolPage.methods.syncTargetStatus.call(ctx);

    expect(ctx.schoolList[0].isTarget).toBe(true);
    expect(ctx.schoolList[1].isTarget).toBe(false);
  });

  it('submitForm 应兼容 data.reply 且允许带括号的院校名', async () => {
    proxyAIMock.mockResolvedValue({
      code: 0,
      data: {
        reply: JSON.stringify([
          {
            id: 's1',
            name: '北京大学',
            location: '北京',
            tags: ['985', '211'],
            majors: [
              {
                name: '临床医学',
                scores: [{ total: 390, eng: 60 }]
              }
            ]
          }
        ])
      }
    });

    const methods = SchoolPage.methods;
    const ctx = {
      formData: {
        degree: 'bk',
        school: '武汉大学',
        currentMajor: '临床医学',
        targetSchool: '北京大学(医学部)',
        targetMajor: '临床医学',
        englishCert: '六级'
      },
      canSubmit: true,
      isOffline: false,
      isSubmitting: false,
      currentStep: 2,
      schoolList: [],
      hasRealData: false,
      filter: { location: '', tag: '' },
      applySchoolList: methods.applySchoolList,
      syncTargetStatus: methods.syncTargetStatus
    };

    Object.defineProperty(ctx, 'filteredSchools', {
      get() {
        return this.schoolList;
      }
    });

    await methods.submitForm.call(ctx);

    expect(proxyAIMock).toHaveBeenCalledTimes(1);
    expect(ctx.currentStep).toBe(3);
    expect(ctx.hasRealData).toBe(true);
    expect(ctx.schoolList).toHaveLength(1);
    expect(ctx.schoolList[0].isTarget).toBe(true);
    expect(ctx.schoolList[0].majors[0].scores).toHaveLength(3);
  });

  it('submitForm 在智能返回非 JSON 时也应关闭 loading 并进入结果页', async () => {
    proxyAIMock.mockResolvedValue({
      code: 0,
      data: {
        reply: '推荐如下：北京大学、清华大学'
      }
    });

    const methods = SchoolPage.methods;
    const ctx = {
      formData: {
        degree: 'bk',
        school: '武汉大学',
        currentMajor: '临床医学',
        targetSchool: '北京大学(医学部)',
        targetMajor: '临床医学',
        englishCert: '六级'
      },
      canSubmit: true,
      isOffline: false,
      isSubmitting: false,
      currentStep: 2,
      schoolList: [{ id: 'old', isTarget: true }],
      hasRealData: true,
      filter: { location: '', tag: '' },
      applySchoolList: methods.applySchoolList,
      syncTargetStatus: methods.syncTargetStatus
    };

    Object.defineProperty(ctx, 'filteredSchools', {
      get() {
        return this.schoolList;
      }
    });

    await methods.submitForm.call(ctx);

    expect(proxyAIMock).toHaveBeenCalledTimes(1);
    expect(uni.showLoading).toHaveBeenCalled();
    expect(uni.hideLoading).toHaveBeenCalled();
    expect(ctx.currentStep).toBe(3);
    expect(ctx.hasRealData).toBe(false);
    expect(ctx.schoolList).toEqual([]);
  });
});
