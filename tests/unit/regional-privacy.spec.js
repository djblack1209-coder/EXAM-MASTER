import { afterEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/services/storageService.js', () => ({ default: fixture }));
vi.mock('@/utils/logger.js', () => ({ logger: { log: vi.fn(), error: vi.fn() } }));
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.resetModules();
  vi.clearAllMocks();
});
describe('registration analytics privacy', () => {
  it('anonymous age screening creates no events, session, profile or retention and starts no upload timer', async () => {
    vi.useFakeTimers();
    fixture.get.mockReturnValue(null);
    const { analytics } = await import('@/utils/analytics/event-bus-analytics.js');
    analytics.init();
    analytics.track('age_screen', { fixture: true });
    analytics.setUserProperties({ fixture: true });
    await vi.advanceTimersByTimeAsync(120000);
    expect(fixture.save).not.toHaveBeenCalled();
    expect(analytics.eventQueue).toEqual([]);
    expect(analytics.sessionId).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('authenticated events still work; logout stops recording and queued upload', async () => {
    fixture.get.mockImplementation((key) => (key === 'EXAM_USER_ID' ? 'synthetic-user' : null));
    const { analytics } = await import('@/utils/analytics/event-bus-analytics.js');
    analytics.track('synthetic-authenticated-event');
    expect(analytics.eventQueue).toHaveLength(1);
    fixture.save.mockClear();
    fixture.get.mockReturnValue(null);
    analytics.track('synthetic-anonymous-event');
    analytics._uploadBatch();
    expect(analytics.eventQueue).toHaveLength(1);
    expect(fixture.save).not.toHaveBeenCalled();
  });
});
