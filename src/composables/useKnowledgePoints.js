/**
 * useKnowledgePoints — 知识点气泡数据加载 & 点击交互 (Composable 版)
 * 替代 knowledgePointMixin，使用 Composition API
 *
 * @module composables/useKnowledgePoints
 */
import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { bubbleInteraction } from '@/utils/helpers/bubble-interaction.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { logger } from '@/utils/logger.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';

export function useKnowledgePoints() {
  const knowledgePoints = ref([]);
  const animatingBubbleId = ref(null);
  const showFormulaModal = ref(false);

  /**
   * 从真实数据计算知识点掌握度（异步版本）
   */
  async function loadKnowledgePoints() {
    try {
      // 从本地缓存异步读取错题数据
      let mistakeList = [];
      try {
        const localMistakes = await Promise.resolve(storageService.get('mistake_book', []));
        mistakeList = Array.isArray(localMistakes) ? localMistakes : [];
      } catch (_e) {
        // 本地缓存读取失败，使用空数组
      }
      const mistakeCount = mistakeList.length;

      // 从题库获取数据
      const questionBank = await Promise.resolve(storageService.get('v30_bank', []));
      const totalQuestions = questionBank.length;

      // 从用户答题记录计算真实掌握度
      const userAnswers = await Promise.resolve(storageService.get('v30_user_answers', {}));
      const answeredIds = Object.keys(userAnswers);
      const totalAnswered = answeredIds.length;

      // 按分类统计题目和正确率
      const categoryStats = {};
      questionBank.forEach((q) => {
        const cat = q.category || q.subject || '未分类';
        if (!categoryStats[cat]) {
          categoryStats[cat] = { total: 0, answered: 0, correct: 0 };
        }
        categoryStats[cat].total++;
        if (userAnswers[q.id || q._id]) {
          categoryStats[cat].answered++;
          if (userAnswers[q.id || q._id]?.correct) {
            categoryStats[cat].correct++;
          }
        }
      });

      const calcMastery = (stats) => {
        if (!stats || stats.answered === 0) return 0;
        return Math.round((stats.correct / stats.answered) * 100);
      };

      const points = [
        {
          id: 1,
          title: '错题集',
          count: mistakeCount,
          icon: 'category-mistakes',
          mastery: mistakeCount > 0 ? Math.max(10, 100 - mistakeCount * 2) : 100,
          color: '#EF4444'
        },
        {
          id: 2,
          title: '练习题',
          count: totalQuestions,
          icon: 'category-practice',
          mastery:
            totalAnswered > 0 && totalQuestions > 0
              ? Math.min(95, Math.round((totalAnswered / totalQuestions) * 100))
              : 0,
          color: '#00F2FF'
        }
      ];

      // 动态添加真实分类（最多4个，按题目数量排序）
      const categoryEntries = Object.entries(categoryStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 4);

      const categoryIcons = ['category-hot', 'category-concept', 'category-formula', 'category-reading'];
      const categoryColors = ['#F59E0B', '#9FE870', '#A855F7', '#EC4899'];

      categoryEntries.forEach(([name, stats], idx) => {
        points.push({
          id: idx + 3,
          title: name,
          count: stats.total,
          icon: categoryIcons[idx] || 'books',
          mastery: calcMastery(stats),
          color: categoryColors[idx] || '#6B7280'
        });
      });

      if (totalQuestions === 0 && mistakeCount === 0) {
        points.push({
          id: 3,
          title: '导入题库开始学习',
          count: 0,
          icon: 'books',
          mastery: 0,
          color: '#6B7280'
        });
      }

      knowledgePoints.value = points;
    } catch (error) {
      logger.error('[useKnowledgePoints] 加载知识点失败:', error);
    }
  }

  /**
   * 知识点气泡点击处理
   */
  async function handleKnowledgeClick(point) {
    logger.log('[useKnowledgePoints] clicked:', point.title);

    if (animatingBubbleId.value === point.id) return;
    animatingBubbleId.value = point.id;

    vibrateLight();

    await bubbleInteraction.handleClick(point, {
      enableAnimation: true,
      enableTracking: true,
      onAnimationEnd: () => {
        animatingBubbleId.value = null;
      }
    });

    const routeMap = {
      错题集: () => requireLogin(() => safeNavigateTo('/pages/mistake/index'), { message: '请先登录后查看错题集' }),
      练习题: () =>
        uni.switchTab({
          url: '/pages/practice/index',
          fail: () => uni.reLaunch({ url: '/pages/practice/index' })
        }),
      热门考点: () => _navToHotTopics(point),
      核心概念: () => _navToConcepts(point),
      公式定理: () => {
        showFormulaModal.value = true;
      },
      阅读理解: () => _navToReading(point)
    };

    setTimeout(() => {
      const handler = routeMap[point.title];
      if (handler) {
        handler();
      } else {
        uni.showToast({
          title: `${point.title}\n\n掌握度：${point.mastery}%\n题目数：${point.count} 项`,
          icon: 'none',
          duration: 2000,
          mask: true
        });
      }
    }, 300);
  }

  function _navToHotTopics(point) {
    safeNavigateTo('/pages/practice-sub/import-data?source=hotTopics', {
      success: () => {
        uni.showToast({
          title: `热门考点\n\n共 ${point.count} 个考点\n正确率目标：${point.mastery}%`,
          icon: 'none',
          duration: 2000
        });
      }
    });
  }

  function _navToConcepts(point) {
    safeNavigateTo('/pages/practice-sub/import-data?source=concepts', {
      success: () => {
        uni.showToast({
          title: `核心概念\n\n共 ${point.count} 个概念\n掌握度：${point.mastery}%`,
          icon: 'none',
          duration: 2000
        });
      }
    });
  }

  function _navToReading(point) {
    uni.switchTab({
      url: '/pages/practice/index',
      success: () => {
        uni.showToast({
          title: `阅读理解\n\n共 ${point.count} 篇\n正确率：${point.mastery}%`,
          icon: 'none',
          duration: 2000
        });
      },
      fail: () => uni.reLaunch({ url: '/pages/practice/index' })
    });
  }

  return {
    knowledgePoints,
    animatingBubbleId,
    showFormulaModal,
    loadKnowledgePoints,
    handleKnowledgeClick
  };
}
