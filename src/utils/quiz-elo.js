const DEFAULT_USER_RATING = 1500;
const DEFAULT_QUESTION_RATING = 1500;
const MIN_RATING = 800;
const MAX_RATING = 2400;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function getQuestionEloRating(question = {}, questionRatings = {}) {
  const id = question.id || question._id;
  if (id && Number.isFinite(Number(questionRatings[id]))) {
    return Number(questionRatings[id]);
  }
  const difficulty = clamp(question.difficulty ?? 3, 1, 5);
  return DEFAULT_QUESTION_RATING + (difficulty - 3) * 140;
}

export function calculateSpeedScore({ isCorrect, timeSpentMs, timeLimitMs, difficulty = 3 }) {
  const limit = Math.max(15000, Number(timeLimitMs || 60000));
  const spent = clamp(timeSpentMs, 0, limit * 2);
  const ratio = clamp(1 - spent / limit, 0, 1);
  const difficultyBonus = Math.round((clamp(difficulty, 1, 5) - 1) * 2.5);
  const base = isCorrect ? 58 : 18;
  const speedBonus = Math.round(ratio * (isCorrect ? 34 : 16));
  const penalty = !isCorrect && spent > limit ? 8 : 0;
  return clamp(base + speedBonus + difficultyBonus - penalty, 0, 100);
}

export function updateEloRating({
  userRating = DEFAULT_USER_RATING,
  questionRating = DEFAULT_QUESTION_RATING,
  isCorrect,
  speedScore = 60,
  k = 32
}) {
  const user = clamp(userRating, MIN_RATING, MAX_RATING);
  const question = clamp(questionRating, MIN_RATING, MAX_RATING);
  const expected = 1 / (1 + 10 ** ((question - user) / 400));
  const actual = isCorrect ? 1 : 0;
  const speedFactor = 0.75 + clamp(speedScore, 0, 100) / 200;
  const userDelta = Math.round(k * speedFactor * (actual - expected));
  const questionDelta = Math.round(-userDelta * 0.55);

  return {
    userRating: clamp(user + userDelta, MIN_RATING, MAX_RATING),
    questionRating: clamp(question + questionDelta, MIN_RATING, MAX_RATING),
    userDelta,
    questionDelta,
    expected: Math.round(expected * 1000) / 1000
  };
}

export function rankQuestionsByEloMatch(
  questions = [],
  { userRating = DEFAULT_USER_RATING, questionRatings = {}, limit = 0 } = {}
) {
  const ranked = questions
    .map((question, index) => {
      const rating = getQuestionEloRating(question, questionRatings);
      return {
        ...question,
        eloRating: rating,
        _eloDistance: Math.abs(rating - userRating),
        _originalIndex: index
      };
    })
    .sort((a, b) => {
      if (a._eloDistance !== b._eloDistance) return a._eloDistance - b._eloDistance;
      return b.eloRating - a.eloRating || a._originalIndex - b._originalIndex;
    })
    .map(({ _eloDistance, _originalIndex, ...question }) => question);

  return limit > 0 ? ranked.slice(0, limit) : ranked;
}

export function readEloState(storageService, key = 'quiz_elo_state_v1') {
  const saved = storageService?.get?.(key, null);
  if (!saved || typeof saved !== 'object') {
    return { userRating: DEFAULT_USER_RATING, questionRatings: {} };
  }
  return {
    userRating: Number(saved.userRating) || DEFAULT_USER_RATING,
    questionRatings: saved.questionRatings && typeof saved.questionRatings === 'object' ? saved.questionRatings : {}
  };
}

export function saveEloState(storageService, state, key = 'quiz_elo_state_v1') {
  storageService?.save?.(key, {
    userRating: Number(state.userRating) || DEFAULT_USER_RATING,
    questionRatings: state.questionRatings || {}
  });
}
