export type Grade = number;

export interface Card {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: Date;
}

export interface FSRSParameters {
  request_retention?: number;
  maximum_interval?: number;
  enable_fuzz?: boolean;
  enable_short_term?: boolean;
  w?: number[];
}

export interface RecordLogData {
  rating: number;
  state: number;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  review: Date;
}

export interface RecordLogItem {
  card: Card;
  log: RecordLogData;
}

export interface FSRSScheduler {
  next(card: Card, now: Date, grade: Grade): RecordLogItem;
}

export interface FSRSBundleExports {
  createEmptyCard(now?: Date): Card;
  generatorParameters(params?: Partial<FSRSParameters>): FSRSParameters;
  fsrs(params?: FSRSParameters): FSRSScheduler;
  Rating: {
    Manual: number;
    Again: number;
    Hard: number;
    Good: number;
    Easy: number;
  };
  State: Record<string, number>;
}
