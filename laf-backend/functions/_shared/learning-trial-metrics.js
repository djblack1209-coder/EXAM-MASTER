import crypto from 'node:crypto';
const DAY = 86400000;
export function coachingMetricFacts(state) {
  return {
    version: 1,
    coaches: (state.conversations || [])
      .filter((c) => c.coach)
      .map(({ coach: c }) => ({
        startedDay: c.startedDay,
        days: c.days.map((d) => ({
          day: d.day,
          completed: d.completed,
          answers: d.answers.map(({ at }) => ({ at })),
          rewrites: d.rewrites.map(({ at }) => ({ at }))
        })),
        library: c.library.map((item) => ({ reviews: item.reviews.map(({ at }) => ({ at })) })),
        survey: c.survey ? { answer: c.survey.answer } : null
      }))
  };
}
const week = (day) => {
  const value = new Date(day + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
};
// 调用者只读取字段投影；此函数不需要原答、题目、画像、邮箱或模型密钥。
export function trialMetrics(states, accounts, { asOf = Date.now(), salt } = {}) {
  if (typeof salt !== 'string' || salt.length < 24) throw new Error('需要至少24字符的指标匿名化盐');
  const pseudonym = (owner) => crypto.createHmac('sha256', salt).update(owner).digest('hex').slice(0, 16);
  const weekly = new Map(),
    monthly = new Map();
  let missingMetricSnapshots = 0;
  let eligible = 0,
    retained = 0;
  const willingness = { yes: 0, no: 0, skip: 0 };
  for (const row of states) {
    if (!row.user_id || row.user_id.startsWith('__platform_day_v1:')) continue;
    if (row.state?.format && !row.trialFacts) missingMetricSnapshots++;
    const coaches = row.trialFacts?.coaches || (row.state?.conversations || []).map((c) => c.coach).filter(Boolean);
    if (!coaches.length) continue;
    const first = Math.min(...coaches.map((c) => Date.parse(c.startedDay))),
      active = [];
    for (const coach of coaches) {
      for (const day of coach.days || []) {
        if (day.answers?.length || day.rewrites?.length) active.push(Date.parse(day.day));
        if (day.completed) {
          const key = JSON.stringify([pseudonym(row.user_id), week(day.day)]);
          weekly.set(key, (weekly.get(key) || 0) + 1);
        }
      }
      for (const item of coach.library || []) for (const review of item.reviews || []) active.push(review.at);
      if (coach.survey && Object.hasOwn(willingness, coach.survey.answer)) willingness[coach.survey.answer]++;
    }
    if (asOf >= first + 14 * DAY) {
      eligible++;
      if (active.some((at) => at >= first + 7 * DAY && at < first + 14 * DAY)) retained++;
    }
  }
  for (const account of accounts) {
    if (!account.user_id || account.user_id.startsWith('__platform_day_v1:')) continue;
    for (const call of account.calls || []) {
      if (!Number.isFinite(call.at) || call.at > asOf) continue;
      const month = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit'
      }).format(new Date(call.at));
      const key = JSON.stringify([pseudonym(account.user_id), month]),
        value = monthly.get(key) || { knownCost: 0, pendingCalls: 0, calls: 0 };
      value.calls++;
      if (call.costStatus === 'settled' && Number.isFinite(call.actualCost) && call.actualCost >= 0)
        value.knownCost += call.actualCost;
      else value.pendingCalls++;
      monthly.set(key, value);
    }
  }
  return {
    asOf: new Date(asOf).toISOString(),
    coverage: {
      scope: 'cloud_saved_records',
      localOnlyActivity: 'unobservable',
      missingMetricSnapshots,
      complete: missingMetricSnapshots === 0
    },
    definition:
      '带练次数=明确完成的一天训练；第二周留存=首日起7至13日有已保存活动，仅统计已满14日的用户；费用未知保留待结算',
    secondWeek: { eligibleUsers: eligible, activeUsers: retained },
    willingness,
    perUserWeekly: [...weekly].map(([key, sessions]) => {
      const [learner, week] = JSON.parse(key);
      return { learner, week, sessions };
    }),
    perUserMonthly: [...monthly].map(([key, value]) => {
      const [learner, month] = JSON.parse(key);
      return {
        learner,
        month,
        currency: 'USD',
        ...value,
        knownCost: Number(value.knownCost.toFixed(6)),
        totalCost: value.pendingCalls ? null : Number(value.knownCost.toFixed(6))
      };
    })
  };
}
