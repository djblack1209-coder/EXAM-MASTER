/** 历史调用兼容入口。原答/可靠错题由已有学习核心保存，旧入口不重写原件或编造计数。 */
export async function saveToMistakes(_params = {}) {
  return { success: false, code: 'RELIABLE_GRADE_REQUIRED', error: '请从学习记录查看可靠错题' };
}

export function updateMistakeWithAI(_params = {}) {
  return { success: false, code: 'ORIGINAL_IMMUTABLE', error: '解析建议不能改写原件' };
}

export async function generateMnemonic(_params = {}) {
  return null;
}
