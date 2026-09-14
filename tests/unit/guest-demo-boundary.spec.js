import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import config from '@/config/index.js';
import { storageService } from '@/services/storageService.js';
import { isGuestDemoEnabled, loadDemoQuestionBank } from '@/utils/practice/demo-bank.js';

vi.mock('@/config/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      isDev: false,
      debug: { ...actual.default.debug, enableMock: false },
      audit: { ...actual.default.audit, isAuditMode: false }
    }
  };
});
vi.mock('@/composables/useQuizAutoSave.js', () => ({ clearQuizProgress: vi.fn() }));
vi.mock('@/utils/safe-navigate', () => ({ safeNavigateTo: vi.fn() }));

describe('guest demo boundary', () => {
  beforeEach(() => {
    uni.clearStorageSync();
    vi.stubGlobal('__ENABLE_GUEST_DEMO__', true);
    config.isDev = false;
    config.debug.enableMock = false;
    config.audit.isAuditMode = false;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('rejects a production load and preserves the existing bank', async () => {
    storageService.save('v30_bank', [{ id: 'existing' }]);
    expect(isGuestDemoEnabled()).toBe(false);
    await expect(loadDemoQuestionBank()).rejects.toThrow('disabled in production');
    expect(storageService.get('v30_bank')).toEqual([{ id: 'existing' }]);
  });

  it('cannot enable demo content omitted at build time', async () => {
    vi.stubGlobal('__ENABLE_GUEST_DEMO__', false);
    config.debug.enableMock = true;
    expect(isGuestDemoEnabled()).toBe(false);
    await expect(loadDemoQuestionBank()).rejects.toThrow();
  });

  it('marks every sample and its bank as nonofficial', async () => {
    config.isDev = true;
    expect(await loadDemoQuestionBank()).toEqual({ questionCount: 3 });
    expect(storageService.get('v30_bank_source')).toMatchObject({
      type: 'guest_demo',
      publishableOfficial: false,
      questionCount: 3
    });
    for (const question of storageService.get('v30_bank')) {
      expect(question).toMatchObject({ source: 'guest_demo', sourceType: 'guest_demo' });
    }
  });
});
