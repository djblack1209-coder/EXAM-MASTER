export const testUsers = {
  primary: {
    email: process.env.E2E_EMAIL || 'qa+exam-master@example.com',
    password: process.env.E2E_PASSWORD || 'Qa123456!',
    nickname: process.env.E2E_NICKNAME || '自动化回归账号'
  }
};

export const schoolFormData = {
  targetSchool: '武汉大学',
  targetMajor: '计算机科学与技术',
  currentSchool: '华中科技大学',
  currentMajor: '软件工程',
  score: '360',
  englishCert: 'CET-6'
};

export const aiPrompts = {
  chat: '请帮我制定今天的政治复习计划，控制在2小时以内。',
  importData: '马克思主义哲学中的主要矛盾与次要矛盾如何区分？'
};

export const performanceThresholds = {
  firstScreenMs: Number(process.env.E2E_FIRST_SCREEN_THRESHOLD || 3500),
  interactionMs: Number(process.env.E2E_INTERACTION_THRESHOLD || 1000)
};
