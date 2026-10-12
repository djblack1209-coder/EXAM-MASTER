function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPrimaryAction({ review, bank }) {
  const dueCount = finiteNumber(review?.dueCount);
  const publishedQuestions = finiteNumber(bank?.publishedQuestions);

  if (dueCount > 0) {
    return {
      type: 'review',
      label: '继续复习',
      route: '/pages/mistake/index?mode=review',
      priority: 100
    };
  }

  if (publishedQuestions > 0) {
    return {
      type: 'practice',
      label: '开始刷题',
      route: '/pages/practice/index',
      priority: 80
    };
  }

  return {
    type: 'import',
    label: '查看题库',
    route: '/pages/practice-sub/question-bank',
    priority: 60
  };
}

function buildStatusBadges({ intake, review, network }) {
  const badges = [];
  const generating = finiteNumber(intake?.imports?.generating);
  const streakDays = finiteNumber(review?.streakDays);
  const syncPending = finiteNumber(network?.syncPending);

  if (generating > 0) badges.push({ tone: 'info', label: `准备中 ${generating}` });
  if (streakDays > 0) badges.push({ tone: 'success', label: `连续 ${streakDays} 天` });
  if (network?.online === false) badges.push({ tone: 'warning', label: '离线' });
  if (syncPending > 0) badges.push({ tone: 'warning', label: `待同步 ${syncPending}` });

  return badges;
}

export function buildMobileShellSnapshot({ user = {}, intake = {}, review = {}, bank = {}, network = {} } = {}) {
  return {
    identity: {
      title: user.examTrack || '考研备考',
      subtitle: user.nickname || '学习者'
    },
    primaryAction: buildPrimaryAction({ review, bank }),
    statusBadges: buildStatusBadges({ intake, review, network }),
    release: intake.release || { state: 'empty' },
    metrics: {
      dueCount: finiteNumber(review.dueCount),
      totalQuestions: finiteNumber(bank.totalQuestions),
      publishedQuestions: finiteNumber(bank.publishedQuestions)
    }
  };
}
