const DEFAULT_COMBO_MILESTONES = [3, 5, 10, 15, 20, 30, 50];

export function calculateCorrectStreak(answeredQuestions = []) {
  if (!Array.isArray(answeredQuestions) || answeredQuestions.length === 0) return 0;

  let streak = 0;
  for (let index = answeredQuestions.length - 1; index >= 0; index--) {
    const item = answeredQuestions[index];
    if (!item || item.isCorrect !== true) break;
    streak += 1;
  }
  return streak;
}

export function getComboLevel(streak) {
  const safeStreak = Number(streak) || 0;
  if (safeStreak >= 30) return 4;
  if (safeStreak >= 15) return 3;
  if (safeStreak >= 10) return 2;
  if (safeStreak >= 5) return 1;
  return 0;
}

export function shouldShowCombo(streak, milestones = DEFAULT_COMBO_MILESTONES) {
  const safeStreak = Number(streak) || 0;
  if (safeStreak < 3) return false;
  return milestones.includes(safeStreak) || safeStreak % 10 === 0;
}

export function buildComboFeedback(streak) {
  const safeStreak = Number(streak) || 0;
  if (!shouldShowCombo(safeStreak)) return null;

  if (safeStreak >= 30) {
    return {
      streak: safeStreak,
      level: getComboLevel(safeStreak),
      title: `${safeStreak} 连对`,
      desc: '节奏非常稳定，保持当前速度'
    };
  }

  if (safeStreak >= 10) {
    return {
      streak: safeStreak,
      level: getComboLevel(safeStreak),
      title: `${safeStreak} 连对`,
      desc: '进入高质量连续答题状态'
    };
  }

  return {
    streak: safeStreak,
    level: getComboLevel(safeStreak),
    title: `${safeStreak} 连对`,
    desc: '正确节奏已建立'
  };
}
