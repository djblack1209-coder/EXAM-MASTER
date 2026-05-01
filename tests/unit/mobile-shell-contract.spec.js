import { describe, expect, it } from 'vitest';

import { buildMobileShellSnapshot } from '@/services/mobile-shell-contract.js';

describe('mobile shell contract', () => {
  it('prioritizes the next learning action from review, intake, and bank state', () => {
    const snapshot = buildMobileShellSnapshot({
      user: { nickname: 'Smoke User', examTrack: '2027 考研公共课' },
      intake: { imports: { generating: 1 }, release: { state: 'partial', pendingSlots: 2 } },
      review: { dueCount: 7, streakDays: 5 },
      bank: { totalQuestions: 15, publishedQuestions: 15 },
      network: { online: true, syncPending: 0 }
    });

    expect(snapshot.identity.title).toBe('2027 考研公共课');
    expect(snapshot.primaryAction).toEqual({
      type: 'review',
      label: '继续复习',
      route: '/pages/practice-sub/do-quiz?mode=review',
      priority: 100
    });
    expect(snapshot.statusBadges).toContainEqual({ tone: 'info', label: '清洗中 1' });
    expect(snapshot.statusBadges).toContainEqual({ tone: 'success', label: '连续 5 天' });
  });

  it('falls back to import guidance when no published bank questions exist', () => {
    const snapshot = buildMobileShellSnapshot({
      intake: { imports: { generating: 0 }, release: { state: 'empty' } },
      review: { dueCount: 0 },
      bank: { totalQuestions: 0, publishedQuestions: 0 },
      network: { online: false, syncPending: 3 }
    });

    expect(snapshot.primaryAction.type).toBe('import');
    expect(snapshot.statusBadges).toContainEqual({ tone: 'warning', label: '离线' });
    expect(snapshot.statusBadges).toContainEqual({ tone: 'warning', label: '待同步 3' });
  });
});
