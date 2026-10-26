// Lead's observed response fields from .collab/tasks/2026-10-22-deepseek-intake.md.
// Option values/envelope are synthetic until the original sanitized receipt is supplied.
// No credentials or account identifiers are included.
export const deepseekIntakeReceipt = {
  code: 0,
  success: true,
  data: {
    message: '你具体要准备考研的哪个科目？',
    intake: {
      options: [
        { value: 'english', label: '英语' },
        { value: 'math', label: '数学' },
        { value: 'major', label: '专业课' },
        { value: 'other', label: '其他' }
      ],
      input: true,
      profile: null
    },
    question: null,
    tools: [],
    provider: 'DeepSeek',
    model: 'deepseek-flash',
    usageStatus: 'pending'
  }
};
