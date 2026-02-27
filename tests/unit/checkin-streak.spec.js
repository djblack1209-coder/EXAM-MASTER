import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMock = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

const storageMock = {
  get: vi.fn(),
  save: vi.fn(),
  remove: vi.fn()
};

vi.mock('@/utils/logger.js', () => ({
  logger: loggerMock
}));

vi.mock('@/services/storageService.js', () => ({
  default: storageMock,
  storageService: storageMock
}));

describe('checkin-streak persistence hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes corrupted persisted values during init', async () => {
    storageMock.get.mockReturnValue({
      currentStreak: -10,
      longestStreak: '2',
      totalCheckins: 'invalid',
      recoveryCards: 1000,
      checkinHistory: 'bad',
      lastCheckinDate: 'not-a-date'
    });

    const { CheckinStreakService } = await import('@/services/checkin-streak.js');
    const service = new CheckinStreakService();

    await service.init('u_init');
    const info = service.getCheckinInfo();

    expect(info.currentStreak).toBe(0);
    expect(info.longestStreak).toBe(2);
    expect(info.totalCheckins).toBe(0);
    expect(info.recoveryCards).toBe(99);
    expect(info.lastCheckinDate).toBeNull();
    expect(service.data.checkinHistory).toEqual([]);
  });

  it('sanitizes state before save to storage', async () => {
    const { CheckinStreakService } = await import('@/services/checkin-streak.js');
    const service = new CheckinStreakService();

    service.userId = 'u_save';
    service.data.currentStreak = -3;
    service.data.longestStreak = -8;
    service.data.totalCheckins = /** @type {any} */ ('oops');
    service.data.recoveryCards = 10000;
    service.data.lastCheckinDate = 'broken';
    service.data.checkinHistory = [{ date: '2026-02-27', status: 'checked' }, { bad: true }];

    await service._saveData();

    expect(storageMock.save).toHaveBeenCalledWith(
      'checkin_u_save',
      expect.objectContaining({
        currentStreak: 0,
        longestStreak: 0,
        totalCheckins: 0,
        recoveryCards: 99,
        lastCheckinDate: null,
        checkinHistory: [{ date: '2026-02-27', status: 'checked' }]
      })
    );
  });

  it('caps recovery card grants and rejects invalid input', async () => {
    const { CheckinStreakService } = await import('@/services/checkin-streak.js');
    const service = new CheckinStreakService();

    service.userId = 'u_card';
    service.data.recoveryCards = 98;

    expect(service.addRecoveryCards(10)).toBe(true);
    expect(service.getRecoveryCards()).toBe(99);

    expect(service.addRecoveryCards(0)).toBe(false);
    expect(service.addRecoveryCards(-2)).toBe(false);
    expect(service.addRecoveryCards('NaN')).toBe(false);
    expect(service.getRecoveryCards()).toBe(99);
  });

  it('does not expose addRecoveryCards in hook api', async () => {
    const { useCheckinStreak } = await import('@/services/checkin-streak.js');
    const hook = useCheckinStreak();

    expect(/** @type {any} */ (hook).addRecoveryCards).toBeUndefined();
  });
});
