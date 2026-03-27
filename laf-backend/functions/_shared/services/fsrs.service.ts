import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs';
import cloud from '@lafjs/cloud';

const db = cloud.database();

export class FsrsService {
  private f = fsrs(generatorParameters({ maximum_interval: 36500 }));

  /**
   * Process an answer and update its memory state in DB.
   * @param userId The user's ID
   * @param questionId The question ID
   * @param grade FSRS Grade (1: Again, 2: Hard, 3: Good, 4: Easy)
   */
  async processAnswer(userId: string, questionId: string, grade: number) {
    const reviewLogCol = db.collection('review_logs');

    // Find existing card state for user+question
    const existingLog = await reviewLogCol
      .where({ user_id: userId, question_id: questionId })
      .orderBy('review', 'desc')
      .get();

    let card = createEmptyCard();
    if (existingLog.data && existingLog.data.length > 0) {
      const latest = existingLog.data[0];
      card = {
        due: latest.card.due,
        stability: latest.card.stability,
        difficulty: latest.card.difficulty,
        elapsed_days: latest.card.elapsed_days,
        scheduled_days: latest.card.scheduled_days,
        reps: latest.card.reps,
        lapses: latest.card.lapses,
        state: latest.card.state as State,
        last_review: latest.card.last_review
      } as typeof card;
    }

    const now = new Date();
    const scheduledInfo = this.f.repeat(card, now);
    let recordLog: { card: typeof card; log: unknown };

    // Match TS-FSRS Rating Enum
    switch (grade) {
      case 1:
        recordLog = scheduledInfo[Rating.Again];
        break;
      case 2:
        recordLog = scheduledInfo[Rating.Hard];
        break;
      case 3:
        recordLog = scheduledInfo[Rating.Good];
        break;
      case 4:
        recordLog = scheduledInfo[Rating.Easy];
        break;
      default:
        recordLog = scheduledInfo[Rating.Good];
    }

    // Store in DB
    const newLogEntry = {
      user_id: userId,
      question_id: questionId,
      card: recordLog.card,
      log: recordLog.log,
      review: now,
      grade
    };

    await reviewLogCol.add(newLogEntry);

    return newLogEntry;
  }
}
