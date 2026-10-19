import { COACH_SUBJECTS, COACH_DEFAULT_TRACK } from '../../../laf-backend/functions/_shared/learning-writing-coach.js';

// 建档「跳过」只补缺省值，不覆盖用户已经明确的考试类型与准备方向：
// 那两项是用户表达过的目标事实，不是默认项。
export const COACH_EXAMS = Object.freeze(['english1', 'english2']);
export { COACH_SUBJECTS, COACH_DEFAULT_TRACK };

// 用户在选项里选的是时间段，不是一个精确日期；这里只把它换算成档案需要的日期。
export function deadlineForBucket(bucket) {
  const year = new Date().getFullYear();
  if (bucket === 'this') return `${year}-12-20`;
  if (bucket === 'next') return `${year + 1}-12-19`;
  return null;
}

export function resolveSkippedProfile(profile = {}) {
  const picked = Array.isArray(profile?.subjects) ? profile.subjects : [];
  const primary = COACH_SUBJECTS.includes(profile?.subject) ? profile.subject : null;
  return {
    exam: COACH_EXAMS.includes(profile?.exam) ? profile.exam : 'english1',
    deadline: deadlineForBucket(profile?.deadlineBucket) || `${new Date().getFullYear()}-12-22`,
    minutes: 25,
    foundation: null,
    // 跳过不等于清空：已经点过的方向必须留下。
    subjects: [...new Set([primary, ...picked].filter((subject) => COACH_SUBJECTS.includes(subject)))],
    track: COACH_DEFAULT_TRACK
  };
}
