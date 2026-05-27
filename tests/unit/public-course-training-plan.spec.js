import { describe, expect, it } from 'vitest';
import {
  PUBLIC_COURSE_RELEASE_SCOPE,
  buildPublicCourseTrainingPlan
} from '@/config/public-course-training-plan.js';

describe('public course training plan', () => {
  it('keeps the strict 2005-2026 six-track release scope', () => {
    expect(PUBLIC_COURSE_RELEASE_SCOPE).toMatchObject({
      startYear: 2005,
      endYear: 2026,
      totalSlots: 132
    });
    expect(PUBLIC_COURSE_RELEASE_SCOPE.tracks).toEqual([
      'politics',
      'english1',
      'english2',
      'math1',
      'math2',
      'math3'
    ]);
  });

  it('builds a weekly plan without marking missing banks as ready', () => {
    const plan = buildPublicCourseTrainingPlan({ now: '2026-05-22T12:00:00Z', todayIndex: 4 });

    expect(plan.summary.requiredSlots).toBe(132);
    expect(plan.weeklyTasks).toHaveLength(7);
    expect(plan.today.track).toBe('english2');
    expect(plan.today.status).toBe('ready');
    expect(plan.weeklyTasks.find((task) => task.track === 'english1').status).toBe('ready');
    expect(plan.weeklyTasks.find((task) => task.track === 'math1').status).toBe('ready');
    expect(plan.weeklyTasks.find((task) => task.track === 'politics').status).toBe('ready');
    expect(plan.weeklyTasks.find((task) => task.track === 'math2').status).toBe('ready');
    expect(plan.weeklyTasks.find((task) => task.track === 'math3').status).toBe('pending');
    expect(plan.rules.join('\n')).toContain('英语阅读先读完整文章');
  });
});
