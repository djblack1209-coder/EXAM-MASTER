/**
 * knowledgePointMixin — 知识点气泡数据加载 & 点击交互
 * F002-I2: 从 index/index.vue 提取，减少主页面体积
 *
 * 依赖父组件提供的 data:
 *   - knowledgePoints (Array)
 *   - animatingBubbleId (String|null)
 *   - showFormulaModal (Boolean)
 */
import { storageService } from '@/services/storageService.js';
import { bubbleInteraction } from '@/utils/helpers/bubble-interaction.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { logger } from '@/utils/logger.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';

export const knowledgePointMixin = {
  methods: {
    /**
     * 从真实数据计算知识点掌握度
     * ✅ F017: 移除硬编码模拟数据
     */
    async loadKnowledgePoints() {
      try {
        // 从错题本获取数据
        const mistakes = await storageService.getMistakes(1, 999);
        const mistakeList = mistakes?.data || [];
        const mistakeCount = mistakeList.length;

        // 从题库获取数据
        const questionBank = storageService.get('v30_bank', []);
        const totalQuestions = questionBank.length;

        // 从用户答题记录计算真实掌握度
        const userAnswers = storageService.get('v30_user_answers', {});
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

        // 计算各分类掌握度（基于正确率）
        const calcMastery = (stats) => {
          if (!stats || stats.answered === 0) return 0;
          return Math.round((stats.correct / stats.answered) * 100);
        };

        // 构建知识点列表：错题集 + 练习题 + 真实分类数据
        const knowledgePoints = [
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
          knowledgePoints.push({
            id: idx + 3,
            title: name,
            count: stats.total,
            icon: categoryIcons[idx] || 'books',
            mastery: calcMastery(stats),
            color: categoryColors[idx] || '#6B7280'
          });
        });

        // 如果没有分类数据（题库为空），显示默认提示
        if (totalQuestions === 0 && mistakeCount === 0) {
          knowledgePoints.push({
            id: 3,
            title: '导入题库开始学习',
            count: 0,
            icon: 'books',
            mastery: 0,
            color: '#6B7280'
          });
        }

        this.knowledgePoints = knowledgePoints;
      } catch (error) {
        logger.error('[Index] 加载知识点失败:', error);
      }
    },

    /**
     * 知识点气泡点击处理
     */
    async handleKnowledgeClick(point) {
      logger.log('[Index] Knowledge point clicked:', point.title);

      // ✅ 检查点1.4: 防止重复点击
      if (this.animatingBubbleId === point.id) return;

      // ✅ 检查点1.4: 播放缩放动画
      this.animatingBubbleId = point.id;

      vibrateLight();

      // ✅ 检查点1.4: 记录轨迹
      await bubbleInteraction.handleClick(point, {
        enableAnimation: true,
        enableTracking: true,
        onAnimationEnd: () => {
          this.animatingBubbleId = null;
        }
      });

      // 根据气泡类型跳转到对应页面
      const routeMap = {
        错题集: () => requireLogin(() => safeNavigateTo('/pages/mistake/index'), { message: '请先登录后查看错题集' }),
        练习题: () =>
          uni.switchTab({
            url: '/pages/practice/index',
            fail: () => uni.reLaunch({ url: '/pages/practice/index' })
          }),
        热门考点: () => this._navToHotTopics(point),
        核心概念: () => this._navToConcepts(point),
        公式定理: () => this._navToFormulas(),
        阅读理解: () => this._navToReading(point)
      };

      // 延迟执行跳转，等待动画完成
      setTimeout(() => {
        const handler = routeMap[point.title];
        if (handler) {
          handler();
        } else {
          // 兜底：显示功能预告
          uni.showToast({
            title: `${point.title}\n\n掌握度：${point.mastery}%\n题目数：${point.count} 项`,
            icon: 'none',
            duration: 2000,
            mask: true
          });
        }
      }, 300);
    },

    // ---- 知识点导航辅助方法（内部使用，以 _ 前缀标识） ----

    _navToHotTopics(point) {
      safeNavigateTo('/pages/practice-sub/import-data?source=hotTopics', {
        success: () => {
          uni.showToast({
            title: `热门考点\n\n共 ${point.count} 个考点\n正确率目标：${point.mastery}%`,
            icon: 'none',
            duration: 2000
          });
        }
      });
    },

    _navToConcepts(point) {
      safeNavigateTo('/pages/practice-sub/import-data?source=concepts', {
        success: () => {
          uni.showToast({
            title: `核心概念\n\n共 ${point.count} 个概念\n掌握度：${point.mastery}%`,
            icon: 'none',
            duration: 2000
          });
        }
      });
    },

    _navToFormulas() {
      this.showFormulaModal = true;
    },

    _navToReading(point) {
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
  }
};
