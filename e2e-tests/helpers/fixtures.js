import { getMiniProgram } from './mini-utils.js';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

async function hasE2EBridge() {
  const miniProgram = getMiniProgram();
  try {
    return await miniProgram.evaluate(() => Boolean(globalThis.__E2E_BRIDGE__));
  } catch {
    return false;
  }
}

export function buildQuestionBank(count = 20) {
  return Array.from({ length: count }, (_, index) => {
    const correctAnswer = OPTION_LETTERS[index % OPTION_LETTERS.length];
    return {
      id: `e2e_q_${index + 1}`,
      question: `E2E Question ${index + 1}`,
      options: [
        `A. Option A-${index + 1}`,
        `B. Option B-${index + 1}`,
        `C. Option C-${index + 1}`,
        `D. Option D-${index + 1}`
      ],
      answer: correctAnswer,
      desc: `E2E explanation for question ${index + 1}`,
      category: 'E2E',
      type: 'single',
      difficulty: 2
    };
  });
}

export function answerToIndex(answer) {
  const normalized = String(answer || 'A')
    .trim()
    .toUpperCase()
    .charAt(0);
  const idx = OPTION_LETTERS.indexOf(normalized);
  return idx >= 0 ? idx : 0;
}

export async function resetStorage() {
  const miniProgram = getMiniProgram();
  if (await hasE2EBridge()) {
    await miniProgram.evaluate(() => globalThis.__E2E_BRIDGE__.clearAllStorage());
    return;
  }
  await miniProgram.callWxMethod('clearStorageSync');
}

export async function seedLoginState({ userId = 'e2e_user' } = {}) {
  const miniProgram = getMiniProgram();

  if (await hasE2EBridge()) {
    await miniProgram.evaluate((payload) => globalThis.__E2E_BRIDGE__.seedAuth(payload), { userId });
    return;
  }

  await miniProgram.callWxMethod('setStorageSync', 'EXAM_USER_ID', userId);
  await miniProgram.callWxMethod('setStorageSync', 'EXAM_TOKEN', `token_${userId}_${Date.now()}`);
  await miniProgram.callWxMethod('setStorageSync', 'userInfo', {
    _id: userId,
    userId,
    uid: userId,
    nickName: 'E2E User',
    avatarUrl: ''
  });
}

export async function seedQuestionBank(questions, { userId = 'e2e_user' } = {}) {
  const miniProgram = getMiniProgram();

  if (await hasE2EBridge()) {
    await miniProgram.evaluate(
      (payload) => globalThis.__E2E_BRIDGE__.seedQuestionBank(payload.questions, payload.userId),
      { questions, userId }
    );
    return;
  }

  await miniProgram.callWxMethod('setStorageSync', 'v30_bank', questions);
  await miniProgram.callWxMethod('setStorageSync', `u_${userId}_v30_bank`, questions);
}

export async function clearRuntimeDrafts() {
  const miniProgram = getMiniProgram();
  const volatileKeys = [
    'EXAM_QUIZ_PROGRESS',
    'EXAM_QUIZ_PROGRESS_TIME',
    'MOCK_EXAM_PROGRESS',
    'v30_search_result',
    'temp_practice_question'
  ];

  if (await hasE2EBridge()) {
    await miniProgram.evaluate((keys) => {
      keys.forEach((key) => {
        globalThis.__E2E_BRIDGE__.removeStorage(key);
      });
      return true;
    }, volatileKeys);
    return;
  }

  for (const key of volatileKeys) {
    await miniProgram.callWxMethod('removeStorageSync', key);
  }
}

export async function seedBaseState({ userId = 'e2e_user', questionCount = 20 } = {}) {
  const questions = buildQuestionBank(questionCount);

  await resetStorage();
  await seedLoginState({ userId });
  await seedQuestionBank(questions, { userId });
  await clearRuntimeDrafts();

  const miniProgram = getMiniProgram();
  if (await hasE2EBridge()) {
    await miniProgram.evaluate(() => globalThis.__E2E_BRIDGE__.setStorage('theme_mode', 'light'));
  } else {
    await miniProgram.callWxMethod('setStorageSync', 'theme_mode', 'light');
  }

  return questions;
}
