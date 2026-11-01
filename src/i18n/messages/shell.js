import zh from '@/locale/zh-Hans.json';
import en from '@/locale/en.json';

export default { 'zh-CN': zh, en };

export const PAGE_TITLE_KEYS = {
  'pages/splash/index': 'pages.splash',
  'pages/index/index': 'pages.home',
  'pages/practice/index': 'pages.practice',
  'pages/profile/index': 'pages.profile',
  'pages/practice-sub/do-quiz': 'pages.quiz',
  'pages/archive/index': 'pages.archive',
  'pages/login/index': 'pages.login',
  'pages/login/onboarding': 'pages.onboarding',
  'pages/login/wechat-callback': 'pages.wechat',
  'pages/settings/privacy': 'pages.privacy',
  'pages/settings/terms': 'pages.terms',
  'pages/mistake/index': 'pages.mistake',
  'pages/favorite/index': 'pages.favorite',
  'pages/learning/index': 'pages.learning',
  'pages/learning/knowledge': 'pages.knowledge',
  'pages/learning/review': 'pages.review',
  'pages/plan/index': 'pages.plan',
  'pages/study-detail/index': 'pages.stats'
};

// Archive subviews share one route; lifecycle and locale refreshes must keep its visible title.
export const ARCHIVE_TITLE_KEYS = Object.freeze({
  plan: 'muse.goals',
  ideas: 'muse.ideas',
  phrases: 'muse.phrases',
  materials: 'muse.library',
  all: 'muse.activity',
  usage: 'muse.usage'
});
