import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questionTimer } from '@/pages/practice-sub/question-timer.js';
const QuestionTimer = questionTimer.constructor;
import storageService from '@/services/storageService.js';

describe('question active time', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date', 'performance'] });
    vi.setSystemTime(100000);
  });
  afterEach(() => vi.useRealTimers());
  it('samples the fractional final interval and stays frozen after explicit stop', () => {
    const timer = new QuestionTimer();
    timer.start();
    vi.advanceTimersByTime(1550);
    const stopped = timer.stop();
    expect(stopped.elapsedMs).toBe(1550);
    expect(stopped.elapsed).toBe(1.55);
    vi.advanceTimersByTime(10000);
    expect(timer.stop().elapsedMs).toBe(1550);
  });
  it('a delayed tick uses measured elapsed time rather than counting callback deliveries', () => {
    const timer = new QuestionTimer(),
      tick = vi.fn();
    timer.start({ onTick: tick });
    const clock = vi.spyOn(performance, 'now').mockReturnValue(12500);
    timer._tick();
    expect(tick.mock.calls[0][0].elapsed).toBe(12.5);
    expect(timer.stop().elapsedMs).toBe(12500);
    clock.mockRestore();
  });
  it('excludes paused time and carries elapsed time across resume', () => {
    const timer = new QuestionTimer();
    timer.start();
    vi.advanceTimersByTime(1750);
    timer.pause();
    vi.advanceTimersByTime(50000);
    expect(timer.getRemaining().elapsedMs).toBe(1750);
    timer.resume();
    vi.advanceTimersByTime(2250);
    expect(timer.stop().elapsedMs).toBe(4000);
  });
  it('measures time with countdown notifications disabled and after the soft deadline', () => {
    const timer = new QuestionTimer();
    const timeout = vi.fn();
    timer.start({ customTimeLimit: 2, onTimeout: timeout });
    vi.advanceTimersByTime(5000);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timer.stop().elapsedMs).toBe(5000);
    timer.start({ notificationsEnabled: false });
    vi.advanceTimersByTime(1400);
    expect(timer.stop().elapsedMs).toBe(1400);
  });
  it('restores saved active time without counting the closed interval', () => {
    const first = new QuestionTimer();
    const token = first.start().token;
    vi.advanceTimersByTime(1750);
    first.pause(token);
    const snapshot = first.getRemaining(token).elapsedMs;
    first.stop(token);
    vi.advanceTimersByTime(60000);
    const reopened = new QuestionTimer();
    reopened.start({ initialElapsedMs: snapshot });
    vi.advanceTimersByTime(2250);
    expect(reopened.stop().elapsedMs).toBe(4000);
  });
  it('late cleanup cannot stop another question token', () => {
    const timer = new QuestionTimer();
    const first = timer.start();
    vi.advanceTimersByTime(1000);
    const second = timer.start();
    timer.stop(first.token);
    vi.advanceTimersByTime(1500);
    expect(timer.stop(second.token).elapsedMs).toBe(1500);
  });
  it('reloads only current-owner settings and legacy time rows without claiming guest data', () => {
    storageService.save('question_time_records', [{ questionId: 'guest', timeSpent: 20 }], true);
    uni.setStorageSync('EXAM_USER_ID', 'timer-a');
    storageService.save('question_timer_settings', { defaultTimeLimit: 60 }, true);
    const timer = new QuestionTimer();
    expect(timer.getSettings().defaultTimeLimit).toBe(60);
    uni.setStorageSync('EXAM_USER_ID', 'timer-b');
    expect(timer.getSettings().defaultTimeLimit).toBe(120);
    expect(timer.getTimeStats().totalQuestions).toBe(0);
  });
});
