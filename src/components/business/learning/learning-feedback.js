import { effectiveGrade } from '@/services/learning/learning-domain.js';

// Presentation only: a reference match or an AI score never becomes a reliable result.
export function answerFeedback(attempt) {
  const grade = attempt ? effectiveGrade(attempt) : null;
  if (!grade || grade.status !== 'reliable')
    return { pose: 'read', play: 'none', tone: 'apricot', label: 'learning.pending' };
  if (grade.outcome === 'correct') return { pose: 'celebrate', play: 'once', tone: 'mint', label: 'learning.correct' };
  return {
    pose: 'encourage',
    play: 'once',
    tone: 'coral',
    label: grade.outcome === 'partial' ? 'learning.partial' : 'learning.wrong'
  };
}
export function answerOptionState(attempt, value) {
  if (!attempt || !String(attempt.answer).toUpperCase().match(/[A-H]/g)?.includes(value)) return 'default';
  const grade = effectiveGrade(attempt);
  return grade.status !== 'reliable' ? 'pending' : grade.outcome === 'correct' ? 'correct' : 'wrong';
}
