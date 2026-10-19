// 建档「跳过」只补缺省值，不覆盖用户已经明确的考试类型：考试类型是目标事实，不是默认项。
export const COACH_EXAMS = Object.freeze(['english1', 'english2']);

export function resolveSkippedProfile(profile = {}) {
  return {
    exam: COACH_EXAMS.includes(profile?.exam) ? profile.exam : 'english1',
    deadline: `${new Date().getFullYear()}-12-22`,
    minutes: 25,
    foundation: null
  };
}
