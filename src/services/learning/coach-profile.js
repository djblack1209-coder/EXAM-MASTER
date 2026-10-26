import {
  COACH_SUBJECTS,
  COACH_DEFAULT_TRACK,
  COACH_MATERIAL_TRACK
} from '../../../laf-backend/functions/_shared/learning-writing-coach.js';

// 跳过保留明确回答；未知字段不写成系统默认值。
export const COACH_EXAMS = Object.freeze(['english1', 'english2', 'cs408']);
export { COACH_SUBJECTS, COACH_DEFAULT_TRACK };

export function resolveSkippedProfile(profile = {}) {
  const picked = Array.isArray(profile?.subjects) ? profile.subjects : [];
  const primary = COACH_SUBJECTS.includes(profile?.subject) ? profile.subject : null;
  const materialTrack = primary === 'kaoyan_major' || profile?.exam === 'cs408';
  return {
    exam: materialTrack ? 'cs408' : COACH_EXAMS.includes(profile?.exam) ? profile.exam : null,
    deadline: profile?.deadline || null,
    deadlineBucket: ['this', 'next'].includes(profile?.deadlineBucket) ? profile.deadlineBucket : null,
    minutes: profile?.minutes ? Number(profile.minutes) : null,
    foundation: profile?.foundation?.trim() || null,
    skipped: true,
    // 跳过不等于清空：已经点过的方向必须留下。
    subjects: [...new Set([primary, ...picked].filter((subject) => COACH_SUBJECTS.includes(subject)))],
    track: materialTrack ? COACH_MATERIAL_TRACK : COACH_DEFAULT_TRACK
  };
}
