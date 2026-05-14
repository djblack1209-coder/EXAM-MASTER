import { storageService } from '@/services/storageService.js';
import { clearQuizProgress } from '@/composables/useQuizAutoSave.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import config from '@/config/index.js';

const QUIZ_URL = '/pages/practice-sub/do-quiz';
const PRACTICE_TAB_URL = '/pages/practice/index';

function cloneDemoQuestions(questions) {
  return questions.map((question) => ({
    ...question,
    source: 'guest_demo',
    sourceType: 'guest_demo'
  }));
}

export function isGuestDemoEnabled() {
  return Boolean(__ENABLE_GUEST_DEMO__ && (config.debug.enableMock || config.audit.isAuditMode || config.isDev));
}

function switchToPracticeTab() {
  uni.switchTab({
    url: PRACTICE_TAB_URL,
    fail: () => {
      uni.reLaunch({ url: PRACTICE_TAB_URL });
    }
  });
}

export async function loadDemoQuestionBank() {
  if (!isGuestDemoEnabled()) {
    throw new Error('Guest demo practice is disabled in production');
  }

  if (!__ENABLE_GUEST_DEMO__) {
    throw new Error('Guest demo practice is not included in this build');
  }

  const { DEMO_QUESTIONS } = await import('@/config/demo-questions.js');
  const questions = cloneDemoQuestions(DEMO_QUESTIONS);

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

export async function startGuestDemoPractice(options = {}) {
  if (!isGuestDemoEnabled()) {
    toast.info('请先登录或导入正式题库后开始练习');
    return {
      questionCount: 0
    };
  }

  const destination = options.destination === 'practice' ? 'practice' : 'quiz';

  try {
    const result = await loadDemoQuestionBank();
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
  isGuestDemoEnabled,
  loadDemoQuestionBank,
  startGuestDemoPractice
};
