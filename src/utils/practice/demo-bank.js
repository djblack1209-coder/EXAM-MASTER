import { DEMO_QUESTIONS } from '@/config/home-data.js';
import { storageService } from '@/services/storageService.js';
import { clearQuizProgress } from '@/composables/useQuizAutoSave.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';

const PRACTICE_TAB_URL = '/pages/practice/index';
const QUIZ_URL = '/pages/practice-sub/do-quiz';

function cloneDemoQuestions() {
  return DEMO_QUESTIONS.map((question) => ({
    ...question,
    source: 'guest_demo',
    sourceType: 'guest_demo'
  }));
}

function switchToPracticeTab() {
  uni.switchTab({
    url: PRACTICE_TAB_URL,
    fail: () => {
      uni.reLaunch({ url: PRACTICE_TAB_URL });
    }
  });
}

export function loadDemoQuestionBank() {
  const questions = cloneDemoQuestions();

  storageService.save('v30_bank', questions);
  storageService.save('v30_bank_source', {
    type: 'guest_demo',
    publishableOfficial: false,
    questionCount: questions.length,
    loadedAt: new Date().toISOString()
  });
  storageService.remove('v30_user_answers');
  clearQuizProgress();

  return {
    questionCount: questions.length
  };
}

export function startGuestDemoPractice(options = {}) {
  const destination = options.destination === 'practice' ? 'practice' : 'quiz';

  try {
    const result = loadDemoQuestionBank();
    toast.success('示例题库已加载');

    if (destination === 'practice') {
      switchToPracticeTab();
    } else {
      safeNavigateTo(QUIZ_URL);
    }

    return result;
  } catch (error) {
    logger.error('[demo-bank] failed to start guest demo practice:', error);
    toast.info('示例题库加载失败，请稍后重试');
    return {
      questionCount: 0
    };
  }
}

export default {
  loadDemoQuestionBank,
  startGuestDemoPractice
};
