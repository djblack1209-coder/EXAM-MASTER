<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <!-- 骨架屏 -->
    <MistakeSkeleton v-if="isInitLoading" :is-dark="isDark" />

    <!-- 导航栏 - 添加设计系统工具类 -->
    <view v-if="!isInitLoading" class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content ds-flex ds-flex-between">
        <text class="nav-back ds-touchable" @tap="goBack"> ← </text>
        <text class="nav-title ds-text-lg ds-font-semibold"> 我的错题本 </text>
        <view class="nav-actions">
          <!-- 移除垃圾桶图标 -->
          <view class="nav-placeholder" />
        </view>
      </view>
    </view>

    <scroll-view
      v-if="!isInitLoading"
      scroll-y
      class="main-scroll"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
      @scrolltolower="loadMore"
    >
      <!-- 统计卡片区域 -->
      <view v-if="mistakes.length > 0" class="stats-grid">
        <StatsCard title="错题总数" :value="mistakes.length" icon="note" :is-dark="isDark" />
        <StatsCard
          title="待复习"
          :value="pendingReviewCount"
          icon="refresh"
          change="需要巩固"
          change-type="neutral"
          :is-dark="isDark"
        />
      </view>

      <!-- ✅ P1: 重练模式提示 -->
      <view v-if="isReviewMode && mistakes.length > 0" class="review-mode-banner">
        <BaseIcon name="refresh" :size="40" class="review-icon" />
        <view class="review-info">
          <text class="review-title"> 错题重练模式 </text>
          <text class="review-desc"> {{ filteredReviewMistakes.length }} 道待重练 </text>
        </view>
        <button class="start-review-btn" @tap="startSequentialReview">开始重练</button>
      </view>

      <!-- ✅ 1.7: 错题筛选栏 -->
      <view v-if="isReviewMode && mistakes.length > 0" class="review-filter-bar">
        <view :class="['filter-chip', { active: reviewFilter === 'all' }]" @tap="reviewFilter = 'all'">
          <text class="filter-text"> 全部 </text>
        </view>
        <view :class="['filter-chip', { active: reviewFilter === 'high_freq' }]" @tap="reviewFilter = 'high_freq'">
          <text class="filter-text"> 高频错题 </text>
        </view>
        <view :class="['filter-chip', { active: reviewFilter === 'recent' }]" @tap="reviewFilter = 'recent'">
          <text class="filter-text"> 最近错题 </text>
        </view>
      </view>

      <!-- 模式切换 - 优化布局 -->
      <view v-if="mistakes.length > 0" class="mode-switch glass-card ds-flex ds-gap-xs">
        <view
          :class="['mode-item', 'ds-flex-center', 'ds-touchable', { active: mode === 'quiz' }]"
          @tap="switchMode('quiz')"
        >
          <text class="ds-text-sm ds-font-medium"> 刷题模式 </text>
        </view>
        <view
          :class="['mode-item', 'ds-flex-center', 'ds-touchable', { active: mode === 'recite' }]"
          @tap="switchMode('recite')"
        >
          <text class="ds-text-sm ds-font-medium"> 背诵模式 </text>
        </view>
      </view>

      <!-- 空状态 - 优化样式 -->
      <view v-if="mistakes.length === 0 && !isInitLoading" class="empty-box ds-flex-col ds-flex-center">
        <BaseIcon name="celebrate" :size="160" class="empty-icon" />
        <text class="empty-title ds-text-lg ds-font-bold"> 太厉害了！ </text>
        <text class="empty-text ds-text-sm"> 暂时没有错题，继续保持这个状态！ </text>
        <text class="empty-hint ds-text-xs"> 刷题过程中答错的题目会自动收录到这里 </text>
        <view class="go-practice-btn ds-touchable" @tap="goBack">
          <BaseIcon name="pen" :size="28" /><text>去刷题</text>
        </view>
      </view>

      <!-- 错题列表 (F007: 限制DOM节点数量，最多渲染 maxDomItems 条) -->
      <MistakeCard
        v-for="(item, index) in displayedMistakes"
        :key="item.id || item._id || index"
        :item="item"
        :index="index"
        :mode="mode"
        :mistakes="mistakes"
        @remove="removeMistake"
      />

      <!-- 一键清空按钮（显示在列表最底部） - 优化样式 -->
      <view v-if="mistakes.length > 0 && !isLoading" class="clear-all-section">
        <button
          class="clear-all-btn ds-flex ds-flex-center ds-gap-xs ds-touchable"
          :disabled="isClearing"
          @tap="clearAllMistakes"
        >
          <BaseIcon name="delete" :size="36" class="clear-all-icon" />
          <text class="clear-all-text ds-text-sm ds-font-semibold">
            {{ isClearing ? '清空中...' : '清空所有错题' }}
          </text>
        </button>
      </view>

      <view class="safe-area" />
    </scroll-view>

    <!-- 智能诊断报告组件 - ✅ 2.3: 仅在有错题时渲染，避免空数据时的无效组件挂载 -->
    <MistakeReport v-if="mistakes.length > 0" :mistakes="mistakes" :user-info="userInfo" :is-dark="isDark" />
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';
import MistakeSkeleton from './components/mistake-skeleton/mistake-skeleton.vue';
import StatsCard from './StatsCard.vue';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import MistakeCard from './MistakeCard.vue';
import MistakeReport from './MistakeReport.vue';
import { normalizeMistakes as normalizeFields } from '@/utils/field-normalizer.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: {
    MistakeSkeleton,
    StatsCard,
    MistakeCard,
    MistakeReport,
    BaseIcon
  },
  data() {
    return {
      statusBarHeight: 44,
      mistakes: [],
      mode: 'quiz', // 'quiz' 或 'recite'
      userInfo: {},
      isDark: false,
      // 分页相关
      currentPage: 1,
      pageSize: 20,
      hasMore: true,
      isLoading: false,
      isInitLoading: true, // 初始骨架屏加载状态
      isClearing: false, // 防重复点击：清空错题
      isReviewMode: false, // ✅ P1: 错题重练模式
      reviewFilter: 'all', // ✅ 1.7: 筛选条件 all | high_freq | recent
      maxDomItems: 80 // F007: DOM 上限，防止无限滚动导致 DOM 节点过多
    };
  },
  onLoad(options) {
    // 获取窗口信息
    try {
      const windowInfo = uni.getWindowInfo();
      this.statusBarHeight = windowInfo.statusBarHeight || 44;
    } catch (_e) {
      this.statusBarHeight = 44;
    }

    // 初始化主题
    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';

    // F003: 存储回调引用，确保 $off 只移除自己的监听器
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // ✅ P1: 检查是否为重练模式
    if (options && options.mode === 'review') {
      this.mode = 'quiz';
      this.isReviewMode = true;
      logger.log('[mistake-book] 📝 进入错题重练模式');
    }
  },
  onUnload() {
    // 移除事件监听
    uni.$off('themeUpdate', this._themeHandler);
  },
  computed: {
    // 待复习错题数量（错误次数>=2的题目）
    pendingReviewCount() {
      return this.mistakes.filter((item) => (item.wrong_count || 1) >= 2).length;
    },
    // ✅ 1.7: 根据筛选条件过滤错题（兼容 camelCase 和 snake_case 字段名）
    filteredReviewMistakes() {
      if (this.reviewFilter === 'high_freq') {
        // 高频错题：错误次数>=2，按错误次数降序
        return [...this.mistakes]
          .filter((m) => (m.wrongCount || m.wrong_count || 1) >= 2)
          .sort((a, b) => (b.wrongCount || b.wrong_count || 1) - (a.wrongCount || a.wrong_count || 1));
      }
      if (this.reviewFilter === 'recent') {
        // 最近错题：按最后错误时间降序，取最近20道
        return [...this.mistakes]
          .sort((a, b) => {
            const ta = a.last_wrong_time || a.lastWrongTime || a.created_at || 0;
            const tb = b.last_wrong_time || b.lastWrongTime || b.created_at || 0;
            return tb - ta;
          })
          .slice(0, 20);
      }
      // 全部：按错误次数降序（优先复习高频错题）
      return [...this.mistakes].sort(
        (a, b) => (b.wrongCount || b.wrong_count || 1) - (a.wrongCount || a.wrong_count || 1)
      );
    },
    // F007: 限制渲染到 DOM 的错题数量，防止无限滚动导致 DOM 过大
    displayedMistakes() {
      return this.mistakes.slice(0, this.maxDomItems);
    }
  },
  onShow() {
    this.loadData(true); // 重置并重新加载
    this.loadUserInfo();
    // 自动同步待同步的错题
    this.syncPendingMistakes();
  },
  methods: {
    // 统一错题字段名，消除 wrongCount/wrong_count 等不一致
    normalizeMistakes(list) {
      return normalizeFields(list).map((item) => ({
        ...item,
        showAnalysis: item.showAnalysis ?? false
      }));
    },
    loadMore() {
      const nextPage = this.currentPage + 1;
      logger.log(`[mistake-book] 📄 触底加载: page=${nextPage}, isLoading=${this.isLoading}, hasMore=${this.hasMore}`);
      if (this.isLoading || !this.hasMore) {
        logger.log(`[mistake-book] ⏸️ 分页加载被阻止 - isLoading: ${this.isLoading}, hasMore: ${this.hasMore}`);
        return;
      }
      this.currentPage = nextPage;
      logger.log(`[mistake-book] ➡️ 开始加载第 ${this.currentPage} 页（追加模式）`);
      this.loadData(false);
    },
    loadUserInfo() {
      this.userInfo = storageService.get('userInfo', { nickName: '考研人' });
    },
    async syncPendingMistakes() {
      uni.showLoading({ title: '同步中...', mask: false });
      try {
        logger.log('[mistake-book] 开始自动同步待同步错题...');
        const result = await storageService.syncPendingMistakes();
        if (result.synced > 0) {
          logger.log(`[mistake-book] ✅ 同步完成: ${result.synced} 条错题已同步到云端`);
          // 如果同步成功，重新加载列表以显示更新后的 ID
          if (result.synced > 0) {
            // 延迟一下，确保本地存储已更新
            setTimeout(() => {
              this.loadData(true);
            }, 300);
          }
        } else if (result.failed > 0) {
          logger.warn(`[mistake-book] ⚠️ 同步部分失败: ${result.failed} 条错题未能同步`);
        }
      } catch (error) {
        logger.error('[mistake-book] 同步待同步错题异常:', error);
      } finally {
        uni.hideLoading();
      }
    },
    /**
     * 加载错题列表数据（支持分页和重置）
     * @param {boolean} [reset=false] - 是否重置到第一页重新加载
     */
    async loadData(reset = false) {
      if (this.isLoading) {
        logger.log('[mistake-book] ⏸️ 加载中，跳过重复请求');
        return;
      }

      this.isLoading = true;
      logger.log(
        `[mistake-book] 🔄 开始加载数据 - reset: ${reset}, currentPage: ${this.currentPage}, pageSize: ${this.pageSize}`
      );

      try {
        if (reset) {
          this.currentPage = 1;
          this.mistakes = [];
          logger.log('[mistake-book] 🔄 重置状态，从第1页开始加载');
        }

        logger.log(`[mistake-book] 📡 调用 storageService.getMistakes(${this.currentPage}, ${this.pageSize})`);
        // 使用云端方法获取错题列表
        const result = await storageService.getMistakes(this.currentPage, this.pageSize);
        logger.log('[mistake-book] ✅ 数据加载完成:', {
          count: result?.list?.length || 0,
          total: result?.total || 0,
          page: result?.page || this.currentPage,
          hasMore: result?.hasMore || false,
          source: result?.source || 'unknown'
        });

        if (result && result.list) {
          const normalizedList = this.normalizeMistakes(result.list);
          const beforeCount = this.mistakes.length;
          if (reset) {
            this.mistakes = normalizedList;
            logger.log(`[mistake-book] ✅ 重置模式：加载了 ${normalizedList.length} 条错题`);
          } else {
            // 追加数据（用于分页加载）
            this.mistakes = [...this.mistakes, ...normalizedList];
            logger.log(
              `[mistake-book] ✅ 追加模式：从 ${beforeCount} 条增加到 ${this.mistakes.length} 条（新增 ${normalizedList.length} 条）`
            );
          }

          // 如果本页返回空列表，强制终止分页，防止无限加载
          this.hasMore = normalizedList.length > 0 && (result.hasMore || false);
          logger.log(
            `[mistake-book] 📊 当前状态 - 总错题数: ${this.mistakes.length}, hasMore: ${this.hasMore}, currentPage: ${this.currentPage}`
          );

          // 空状态检查
          if (this.mistakes.length === 0) {
            logger.log(`[mistake-book] 📭 空状态：错题列表为空，显示空状态UI`);
          }

          // 如果从云端获取，本地缓存已在 storageService.getMistakes 中更新（包含合并逻辑）
          if (result.source === 'cloud' && this.currentPage === 1) {
            logger.log('[mistake-book] ✅ 云端数据已加载并合并本地待同步数据');
          }
        } else {
          // 降级到本地读取
          this.mistakes = this.normalizeMistakes(storageService.get('mistake_book', []));
        }
      } catch (error) {
        logger.error('加载错题列表失败:', error);
        // 降级到本地读取
        this.mistakes = this.normalizeMistakes(storageService.get('mistake_book', []));
      } finally {
        this.isLoading = false;
        this.isInitLoading = false; // 隐藏骨架屏
      }
    },
    goBack() {
      // 从空状态跳转到刷题页面
      uni.switchTab({
        url: '/pages/practice/index',
        fail: () => {
          uni.reLaunch({ url: '/pages/practice/index' });
        }
      });
    },

    // ✅ P1 + 1.7: 开始顺序重练（使用筛选后的错题列表）
    startSequentialReview() {
      const source = this.isReviewMode ? this.filteredReviewMistakes : this.mistakes;
      if (source.length === 0) {
        uni.showToast({ title: '暂无错题', icon: 'none' });
        return;
      }

      logger.log('[mistake-book] 📝 开始错题重练，共', source.length, '道题，筛选:', this.reviewFilter);

      // 问题51修复：确保错题数据格式正确，兼容多种字段名
      const reviewQuestions = source
        .map((m, index) => {
          // 获取题目内容（兼容多种字段名）
          const questionContent = m.question || m.question_content || m.title || `错题 ${index + 1}`;

          // 获取选项（确保是数组且有内容）
          let options = m.options;
          if (!Array.isArray(options) || options.length === 0) {
            // 尝试从其他字段获取选项
            options = m.choices || m.option_list || ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'];
          }

          // 获取正确答案（兼容多种格式）
          let answer = m.answer || m.correct_answer || m.correctAnswer || 'A';
          // 确保答案是单个字母
          if (typeof answer === 'string' && answer.length > 1) {
            answer = answer.charAt(0).toUpperCase();
          }
          if (typeof answer === 'number') {
            answer = ['A', 'B', 'C', 'D'][answer] || 'A';
          }

          const reviewQuestion = {
            id: m.id || m._id || `review_${index}_${Date.now()}`,
            question: questionContent,
            options: options,
            answer: answer,
            desc: m.desc || m.analysis || m.explanation || '暂无解析',
            category: m.category || m.subject || '错题重练',
            type: m.type || '单选',
            difficulty: m.difficulty || 2,
            wrongCount: m.wrong_count || 1,
            isReview: true // 标记为复习题
          };

          logger.log(`[mistake-book] 📋 错题 ${index + 1}:`, {
            id: reviewQuestion.id,
            question: reviewQuestion.question.substring(0, 30) + '...',
            optionsCount: reviewQuestion.options.length,
            answer: reviewQuestion.answer
          });

          return reviewQuestion;
        })
        .filter((q) => q.question && q.options.length >= 2); // 过滤无效题目

      if (reviewQuestions.length === 0) {
        uni.showToast({ title: '错题数据格式异常', icon: 'none' });
        logger.error('[mistake-book] ❌ 所有错题数据格式异常，无法开始重练');
        return;
      }

      logger.log('[mistake-book] ✅ 有效错题数量:', reviewQuestions.length);

      // 问题51修复：使用正确的存储键名，并同时更新题库
      storageService.save('temp_review_questions', reviewQuestions);

      // 同时将错题临时写入题库，确保 do-quiz 页面能读取
      const currentBank = storageService.get('v30_bank', []);
      if (currentBank.length > 0) {
        storageService.save('v30_bank_backup', currentBank); // 备份原题库
      }
      storageService.save('v30_bank', reviewQuestions); // 临时替换为错题
      storageService.save('is_review_mode', true); // 标记为复习模式

      safeNavigateTo('/pages/practice-sub/do-quiz?mode=review', {
        success: () => {
          logger.log('[mistake-book] ✅ 成功跳转到答题页面');
        },
        fail: (err) => {
          logger.error('[mistake-book] ❌ 跳转失败:', err);
          // 立即恢复原题库
          this._restoreOriginalBank();
          storageService.remove('is_review_mode');
        }
      });
    },

    clearAllMistakes() {
      // 防重复点击
      if (this.isClearing) return;

      // 一键清空所有错题
      if (this.mistakes.length === 0) {
        return uni.showToast({ title: '已经没有错题了', icon: 'none' });
      }

      uni.showModal({
        title: '清空错题本',
        content: `确定要清空所有 ${this.mistakes.length} 道错题吗？此操作不可恢复。`,
        confirmColor: '#FF3B30',
        success: async (res) => {
          if (res.confirm) {
            this.isClearing = true;
            uni.showLoading({ title: '清空中...' });

            try {
              logger.log('[mistake-book] 🧹 开始清空所有错题...');

              // 获取所有错题的 ID
              const mistakeIds = this.mistakes.map((m) => m.id || m._id).filter(Boolean);

              // P2-4: 批量删除云端错题（单次请求替代 N+1 逐条删除）
              // batchRemoveMistakes 内部已同步清理本地缓存
              const result = await storageService.batchRemoveMistakes(mistakeIds);
              const deletedCount = result.deleted || 0;

              // 清空列表
              this.mistakes = [];
              this.currentPage = 1;
              this.hasMore = false;

              logger.log(
                `[mistake-book] ✅ 清空完成: 已删除 ${deletedCount}/${mistakeIds.length} 条云端错题，本地缓存已清空`
              );
              logger.log(`[mistake-book] 📭 空状态：错题列表为空，显示空状态UI`);

              uni.hideLoading();
              const totalCount = mistakeIds.length;
              uni.showToast({
                title: totalCount > 0 ? `已清空 ${totalCount} 道错题` : '已清空所有错题',
                icon: 'success',
                duration: 2000
              });

              // 响应式数据已更新，Vue 会自动触发视图更新
            } catch (error) {
              logger.error('[mistake-book] ❌ 清空错题失败:', error);
              uni.hideLoading();
              uni.showToast({
                title: '清空失败，请重试',
                icon: 'none',
                duration: 2000
              });
            } finally {
              this.isClearing = false;
            }
          }
        }
      });
    },
    // 恢复原始题库（从备份中还原）
    _restoreOriginalBank() {
      try {
        const backup = storageService.get('v30_bank_backup', []);
        if (backup.length > 0) {
          storageService.save('v30_bank', backup);
          logger.log('[mistake-book] ✅ 原题库已恢复');
        }
        storageService.remove('v30_bank_backup');
      } catch (e) {
        logger.error('[mistake-book] ❌ 恢复原题库失败:', e);
      }
    },
    switchMode(newMode) {
      this.mode = newMode;
    },
    /** @param {number} index - 错题在列表中的索引 */
    async removeMistake(index) {
      const mistake = this.mistakes[index];
      if (!mistake) return;

      uni.showModal({
        title: '移除题目',
        content: '掌握了吗？移除后无法恢复。',
        confirmColor: '#FF3B30',
        success: async (res) => {
          if (res.confirm) {
            uni.showLoading({ title: '删除中...' });

            try {
              // 使用云端方法删除
              const mistakeId = mistake.id || mistake._id;
              logger.log(`[mistake-book] 开始删除错题: ${mistakeId} (index: ${index})`);
              const result = await storageService.removeMistake(mistakeId);

              if (result.success) {
                // 从列表中移除
                this.mistakes.splice(index, 1);
                logger.log(`[mistake-book] ✅ 删除成功，列表剩余 ${this.mistakes.length} 条错题`);
                uni.showToast({ title: '已移除', icon: 'success' });
              } else {
                // 如果云端删除失败，尝试本地删除
                logger.warn(`[mistake-book] ⚠️ 删除失败，降级到本地删除: ${result.error}`);
                this.mistakes.splice(index, 1);
                storageService.save('mistake_book', this.mistakes, true);
                uni.showToast({ title: '已移除（本地）', icon: 'none' });
              }
            } catch (error) {
              logger.error('[mistake-book] 删除错题异常:', error);
              // 降级到本地删除
              this.mistakes.splice(index, 1);
              storageService.save('mistake_book', this.mistakes, true);
              uni.showToast({ title: '已移除（本地）', icon: 'none' });
            } finally {
              uni.hideLoading();
            }
          }
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
/* 统计卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  padding: 0 30rpx;
  margin-bottom: 30rpx;
}

.container {
  min-height: 100vh;
  background: var(--bg-secondary, #f5f5f7);
  position: relative;
  overflow: hidden;
}

.aurora-bg {
  position: absolute;
  top: 0;
  width: 100%;
  height: 500rpx;
  background: var(--gradient-primary);
  filter: blur(80px);
  opacity: 0.6;
  z-index: 0;
}

.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background: var(--bg-glass);
  backdrop-filter: blur(20px);

  .nav-content {
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30rpx;

    .nav-back {
      font-size: 36rpx;
      color: var(--text-primary);
      font-weight: bold;
    }

    .nav-title {
      font-size: 34rpx;
      font-weight: 600;
      color: var(--text-primary);
    }

    .nav-placeholder {
      width: 36rpx;
    }

    .nav-actions {
      display: flex;
      align-items: center;
    }

    .nav-clear-btn {
      display: flex;
      align-items: center;
      gap: 8rpx;
      padding: 8rpx 16rpx;
      border-radius: 20rpx;
      background: var(--danger-light);
      transition: all 0.2s;

      &:active {
        background: var(--danger-light);
        transform: scale(0.95);
      }

      .clear-icon {
        font-size: 28rpx;
      }

      .clear-text {
        font-size: 24rpx;
        color: var(--danger);
        font-weight: 500;
      }
    }
  }
}

.main-scroll {
  height: 100vh;
  padding: 30rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.glass-card {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 40rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: var(--shadow-md);
}

.mode-switch {
  display: flex;
  padding: 10rpx;
  border-radius: 20rpx;
  gap: 10rpx;

  .mode-item {
    flex: 1;
    padding: 20rpx 40rpx;
    border-radius: 20rpx;
    font-size: 26rpx;
    text-align: center;
    transition: 0.3s;
    color: var(--text-sub);

    &.active {
      background: var(--primary);
      color: var(--primary-foreground);
      font-weight: bold;
      box-shadow: var(--shadow-md);
    }
  }
}

.empty-box {
  text-align: center;
  padding-top: 150rpx;
  padding-bottom: 100rpx;

  .empty-icon {
    font-size: 160rpx;
    display: block;
    margin-bottom: 30rpx;
    animation: bounce 2s ease-in-out infinite;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-20rpx);
    }
  }

  .empty-title {
    color: var(--text-primary);
    font-size: 40rpx;
    font-weight: 700;
    margin-bottom: 16rpx;
    display: block;
  }

  .empty-text {
    color: var(--text-sub);
    font-size: 28rpx;
    margin-bottom: 16rpx;
    display: block;
  }

  .empty-hint {
    color: var(--text-sub);
    font-size: 24rpx;
    opacity: 0.7;
    margin-bottom: 60rpx;
    display: block;
  }

  .go-practice-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
    padding: 24rpx 64rpx;
    background: var(--gradient-primary);
    color: var(--primary-foreground);
    border-radius: 50rpx;
    font-weight: 600;
    font-size: 30rpx;
    box-shadow: var(--shadow-lg);
    transition: all 0.3s ease;
  }

  .go-practice-btn:active {
    transform: scale(0.95);
    opacity: 0.9;
  }
}

/* 重练模式横幅 */
.review-mode-banner {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 30rpx;
  margin: 0 0 30rpx 0;
  background: rgba(46, 204, 113, 0.1);
  border: 1rpx solid rgba(46, 204, 113, 0.3);
  border-radius: 24rpx;

  .review-icon {
    font-size: 40rpx;
    flex-shrink: 0;
  }

  .review-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
  }

  .review-title {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-primary, #333);
  }

  .review-desc {
    font-size: 24rpx;
    color: var(--text-sub, #999);
  }

  .start-review-btn {
    padding: 14rpx 32rpx;
    background: #2ecc71;
    color: #fff;
    border-radius: 20rpx;
    font-size: 26rpx;
    font-weight: 600;
    border: none;
    flex-shrink: 0;

    &::after {
      border: none;
    }
  }
}

.fab-btn {
  position: fixed;
  bottom: 60rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 300rpx;
  height: 90rpx;
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 45rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  font-size: 28rpx;
  box-shadow: var(--shadow-lg);
  z-index: 99;
}

.safe-area {
  height: 200rpx;
}

/* 一键清空按钮区域（列表底部） */
.clear-all-section {
  padding: 40rpx 30rpx;
  display: flex;
  justify-content: center;
}

.clear-all-btn {
  width: 100%;
  max-width: 600rpx;
  height: 88rpx;
  padding: 0 32rpx;
  background: var(--danger-light);
  border: 2rpx solid var(--danger);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.clear-all-btn:active {
  background: var(--danger-light);
  transform: scale(0.98);
  box-shadow: var(--shadow-xs);
}

.clear-all-btn::after {
  border: none;
}

.clear-all-icon {
  font-size: 36rpx;
  line-height: var(--line-height-normal);
}

.clear-all-text {
  font-size: 30rpx;
  color: var(--danger);
  font-weight: 600;
  white-space: nowrap;
}

/* 深色模式适配 */
.container.dark-mode {
  --bg-color: var(--bg-body);
  --text-primary: #f1f5f9;
  --text-sub: #b0b0b0;
  --text-main: #f1f5f9;
  --card-bg: #1e3a0f;
  --card-border: #2d4e1f;
  background-color: var(--bg-color);
}

.container.dark-mode .nav-title {
  color: #f1f5f9;
}

.container.dark-mode .nav-back {
  color: #f1f5f9;
}

.container.dark-mode .nav-clear-btn {
  background: rgba(255, 59, 48, 0.2);

  .clear-text {
    color: #ff6b6b;
  }
}

.container.dark-mode .clear-all-btn {
  background: rgba(255, 59, 48, 0.2);
  border-color: rgba(255, 59, 48, 0.4);

  .clear-all-text {
    color: #ff6b6b;
  }
}

.container.dark-mode .empty-title {
  color: #f1f5f9;
}

.container.dark-mode .empty-text,
.container.dark-mode .empty-hint {
  color: #b0b0b0;
}

.container.dark-mode .fab-btn {
  background: #1e3a0f;
  color: #f1f5f9;
  border: 1rpx solid #2d4e1f;
}

.container.dark-mode .mode-item {
  color: var(--text-sub);
}

.container.dark-mode .mode-item.active {
  background: #2ecc71;
  color: #fff;
}

.container.dark-mode .review-mode-banner {
  background: rgba(46, 204, 113, 0.15);
  border-color: rgba(46, 204, 113, 0.3);
}

.container.dark-mode .review-title {
  color: #f1f5f9;
}

.container.dark-mode .review-desc {
  color: #b0b0b0;
}

.container.dark-mode .aurora-bg {
  background: linear-gradient(135deg, var(--bg-body) 0%, #1a2e05 50%, var(--bg-body) 100%) !important;
  opacity: 0.8;
}

/* ✅ 1.7: 错题筛选栏 */
.review-filter-bar {
  display: flex;
  gap: 16rpx;
  padding: 0 30rpx;
  margin-bottom: 24rpx;
}

.filter-chip {
  padding: 10rpx 24rpx;
  border-radius: 32rpx;
  background: var(--bg-card, #f5f5f5);
  border: 1px solid var(--border-light, #e0e0e0);
  transition: all 0.2s;
}

.filter-chip.active {
  background: var(--color-primary, #4caf50);
  border-color: var(--color-primary, #4caf50);
}

.filter-chip.active .filter-text {
  color: #fff;
}

.filter-text {
  font-size: 24rpx;
  color: var(--text-sub, #666);
}

.container.dark-mode .filter-chip {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.container.dark-mode .filter-text {
  color: #b0b0b0;
}

.container.dark-mode .filter-chip.active {
  background: var(--color-primary, #4caf50);
  border-color: var(--color-primary, #4caf50);
}

.container.dark-mode .filter-chip.active .filter-text {
  color: #fff;
}
</style>
