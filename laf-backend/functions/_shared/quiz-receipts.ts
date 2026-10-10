/** 原始题库回执的只读汇总；旧布尔判定不升级为当前可靠评分。 */
export async function summarizeQuizReceipts(db: any, userId: string, filters: Record<string, unknown> = {}) {
  const legacyBoolean = [
    { $eq: [{ $type: '$submission_contract' }, 'missing'] },
    { $eq: [{ $type: '$grade' }, 'missing'] }
  ];
  const countMatching = (condition: any) => ({ $sum: { $cond: [condition, 1, 0] } });
  const result = await db
    .collection('practice_records')
    .aggregate()
    .match({ ...filters, user_id: userId })
    .group({
      _id: null,
      received: { $sum: 1 },
      pending: countMatching({ $eq: ['$grade.status', 'pending'] }),
      legacyCorrect: countMatching({ $and: [...legacyBoolean, { $eq: ['$is_correct', true] }] }),
      legacyWrong: countMatching({ $and: [...legacyBoolean, { $eq: ['$is_correct', false] }] })
    })
    .end();
  const counts = result.data[0] || { received: 0, pending: 0, legacyCorrect: 0, legacyWrong: 0 };
  const legacyGraded = counts.legacyCorrect + counts.legacyWrong;
  return {
    contract: 'quiz-receipt-summary-v1',
    scope: 'filtered_records',
    scoringAuthority: false,
    received: counts.received,
    pending: counts.pending,
    legacyGraded,
    legacyCorrect: counts.legacyCorrect,
    legacyWrong: counts.legacyWrong,
    unclassified: counts.received - counts.pending - legacyGraded,
    legacyAccuracy: legacyGraded > 0 ? Math.round((counts.legacyCorrect / legacyGraded) * 100) : null
  };
}
