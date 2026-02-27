<template>
  <view>
    <!-- 生成 AI 诊断报告按钮 -->
    <view v-if="hasMistakes" class="bottom-bar">
      <button class="export-btn ds-flex ds-flex-center ds-gap-xs" :disabled="isGenerating" @tap="prepareReport">
        <BaseIcon name="chart-bar" :size="36" class="export-icon" />
        <view class="export-text-wrapper ds-flex-center">
          <text class="export-text ds-text-sm ds-font-bold">
            {{ isGenerating ? 'AI 正在深度诊断...' : '生成 AI 诊断报告' }}
          </text>
        </view>
      </button>
    </view>

    <!-- Canvas 用于绘制报告 - 始终挂载（offscreen），避免 v-if 导致 DOM 抖动 -->
    <canvas canvas-id="reportCanvas" class="report-canvas"></canvas>

    <!-- 自定义Loading界面 -->
    <view v-if="showCustomLoading" class="custom-loading-mask">
      <view class="custom-loading-card">
        <view class="loading-spinner">
          <view class="spinner-ring" />
        </view>
        <text class="loading-text">
          AI 正在深度诊断...
        </text>
        <text class="loading-desc">
          请稍候，正在生成专属报告
        </text>
      </view>
    </view>

    <!-- 报告预览弹窗 -->
    <view v-if="showReportModal" v-show="showReportModal" class="report-modal">
      <view class="modal-bg" @tap="closeReport" />
      <view class="modal-content">
        <view class="modal-header ds-flex ds-flex-between">
          <text class="modal-title ds-text-xl ds-font-bold">
            AI 诊断报告
          </text>
          <view class="modal-close ds-flex-center ds-rounded-full ds-touchable" @tap="closeReport">
            <text class="modal-close-icon">
              &times;
            </text>
          </view>
        </view>
        <scroll-view scroll-y class="modal-scroll">
          <!-- E010: Canvas 图片模式 -->
          <image
            v-if="reportImagePath"
            :src="reportImagePath"
            mode="widthFix"
            class="report-image"
            @error="handleImageError"
            @load="handleImageLoad"
          />
          <!-- E010: 文本降级模式（Canvas 不可用时） -->
          <view v-else-if="reportTextContent" class="report-text-fallback">
            <view class="report-text-header">
              <text class="report-text-title">
                Exam Master
              </text>
              <text class="report-text-subtitle">
                AI 智能诊断报告
              </text>
            </view>
            <view class="report-text-userinfo">
              <text class="report-text-name">
                {{ userInfo.nickName || '考研人' }}
              </text>
              <text class="report-text-meta">
                错题总数：{{ mistakes.length }} 道
              </text>
            </view>
            <view class="report-text-body">
              <text class="report-text-content" selectable>
                {{ reportTextContent }}
              </text>
            </view>
            <view class="report-text-footer">
              <text>汗水铸就辉煌 · AI 伴你上岸</text>
            </view>
          </view>
          <view v-else class="loading-placeholder">
            <text class="ds-text-sm">
              图片加载中...
            </text>
          </view>
        </scroll-view>
        <view class="modal-footer ds-flex ds-gap-xs">
          <button class="modal-btn secondary ds-font-bold" @tap="closeReport">
            关闭
          </button>
          <button v-if="reportImagePath" class="modal-btn primary ds-font-bold" @tap="saveReport">
            保存到相册
          </button>
          <button v-else-if="reportTextContent" class="modal-btn primary ds-font-bold" @tap="copyReportText">
            复制报告文本
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import {
  getCanvasTheme,
  drawStyledCard as drawCard,
  drawWrappedText as drawText,
  drawRadarChart as drawRadar,
  drawDivider,
  canvasToImage,
  drawLabel,
  drawReportBackground
} from './canvas-report.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'MistakeReport',
  components: { BaseIcon },
  props: {
    /** 错题列表 */
    mistakes: {
      type: Array,
      default: () => []
    },
    /** 用户信息 */
    userInfo: {
      type: Object,
      default: () => ({})
    },
    /** 是否深色模式 */
    isDark: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isGenerating: false,
      showReportModal: false,
      reportImagePath: '',
      // E010: Canvas 不可用时的文本降级内容
      reportTextContent: '',
      showCustomLoading: false,
      cachedBankData: null,
      cachedBankTimestamp: 0
    };
  },
  computed: {
    hasMistakes() {
      return this.mistakes && this.mistakes.length > 0;
    }
  },
  methods: {
    async prepareReport() {
      if (this.mistakes.length === 0) {
        return uni.showToast({ title: '先刷题积累错题才能生成报告哦', icon: 'none' });
      }

      if (this.isGenerating) return;

      this.isGenerating = true;
      this.showCustomLoading = true;
      this.showReportModal = false;
      this.reportImagePath = '';
      this.reportTextContent = '';

      const mistakeSummary = this.mistakes
        .map((m, i) => {
          const questionText = (m.question || m.question_content || m.title || '题目内容').substring(0, 50);
          const safeQuestionText = questionText.replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200B]/g, '').trim();
          const category = m.category || '未分类';
          const safeCategory = category.replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200B]/g, '').trim();
          return i + 1 + '. [' + safeCategory + '] ' + safeQuestionText;
        })
        .join('\n');

      let isTimeoutHandled = false;
      const timeoutId = setTimeout(() => {
        if (isTimeoutHandled) return;
        isTimeoutHandled = true;

        logger.warn('[MistakeReport] AI 诊断报告生成超时（30秒）');
        this.showCustomLoading = false;
        this.isGenerating = false;

        uni.showModal({
          title: 'AI 分析超时',
          content: '网络较慢，是否使用本地数据生成简化报告？',
          confirmText: '生成简化版',
          cancelText: '稍后重试',
          success: (res) => {
            if (res.confirm) {
              this.generateLocalReport();
            }
          }
        });
      }, 30000);

      try {
        const response = await lafService.proxyAI('report', {
          userName: this.userInfo.nickName || '考研人',
          mistakeSummary: mistakeSummary,
          mistakeCount: this.mistakes.length
        });

        clearTimeout(timeoutId);
        if (isTimeoutHandled) {
          logger.log('[MistakeReport] 超时已处理，跳过正常响应处理');
          return;
        }

        if (response.code === 0 && response.data) {
          const reportText = response.data.trim();
          const finalReportText = typeof reportText === 'string' ? reportText : JSON.stringify(reportText);

          try {
            await this.drawReport(finalReportText);
            logger.log('[MistakeReport] 报告生成完成');
          } catch (drawError) {
            logger.error('[MistakeReport] 绘制报告失败:', drawError);
            this.showCustomLoading = false;
            this.isGenerating = false;
          }
        } else {
          logger.error('[MistakeReport] AI报告生成失败:', response.message);
          this.showCustomLoading = false;
          this.isGenerating = false;
          uni.showToast({ title: '报告生成失败，请重试', icon: 'none', duration: 3000 });
        }
      } catch (_e) {
        logger.error('[MistakeReport] AI 报告生成失败', _e);
        this.showCustomLoading = false;
        this.isGenerating = false;

        let errorMsg = '网络错误，请检查网络后重试';
        if (_e.message && _e.message.includes('timeout')) {
          errorMsg = '请求超时，请稍后重试';
        } else if (_e.message && _e.message.includes('401')) {
          errorMsg = 'AI 服务配置异常，请联系管理员';
        } else if (_e.message && _e.message.includes('500')) {
          errorMsg = '服务器错误，请稍后重试';
        } else if (_e.message && _e.message.includes('JSON')) {
          errorMsg = '数据解析失败，请重试';
        }

        uni.showToast({ title: errorMsg, icon: 'none', duration: 3000 });
      }
    },

    closeReport() {
      logger.log('[MistakeReport] 关闭报告弹窗');
      this.showReportModal = false;
      setTimeout(() => {
        this.reportImagePath = '';
        this.reportTextContent = '';
      }, 300);
    },

    handleImageError(e) {
      logger.error('[MistakeReport] 图片加载失败:', e);
      uni.showToast({ title: '图片加载失败', icon: 'none', duration: 2000 });
      this.showReportModal = false;
    },

    handleImageLoad() {
      logger.log('[MistakeReport] 图片加载成功');
    },

    saveReport() {
      if (!this.reportImagePath) return;

      // #ifdef MP-WEIXIN
      uni.saveImageToPhotosAlbum({
        filePath: this.reportImagePath,
        success: () => {
          uni.showToast({ title: '已保存到相册', icon: 'success' });
          this.showReportModal = false;
        },
        fail: (err) => {
          logger.error(err);
          if (err.errMsg && err.errMsg.includes('auth')) {
            uni.showModal({
              title: '提示',
              content: '需要保存到相册权限',
              success: (res) => {
                if (res.confirm) uni.openSetting();
              }
            });
          } else {
            uni.showToast({ title: '保存失败', icon: 'none' });
          }
        }
      });
      // #endif

      // #ifndef MP-WEIXIN
      uni.saveImageToPhotosAlbum({
        filePath: this.reportImagePath,
        success: () => {
          uni.showToast({ title: '已保存到相册', icon: 'success' });
          this.showReportModal = false;
        },
        fail: (_err) => {
          uni.showToast({ title: '保存失败', icon: 'none' });
        }
      });
      // #endif
    },

    drawReport(aiSummary) {
      return new Promise((resolve, reject) => {
        // E010: Canvas 兼容性检测 — 不支持时走文本降级
        if (typeof uni.createCanvasContext !== 'function') {
          logger.warn('[MistakeReport] drawReport: 当前平台不支持 createCanvasContext，使用文本降级');
          this.reportTextContent = aiSummary || '报告生成失败';
          this.reportImagePath = '';
          this.showCustomLoading = false;
          this.isGenerating = false;
          this.showReportModal = true;
          return resolve('text-fallback');
        }

        if (!aiSummary || typeof aiSummary !== 'string') {
          logger.error('[MistakeReport] drawReport: aiSummary必须是字符串', typeof aiSummary);
          aiSummary = String(aiSummary || '报告生成失败，请重试');
        }

        logger.log('[MistakeReport] 开始绘制报告，内容长度:', aiSummary.length);

        try {
          const ctx = uni.createCanvasContext('reportCanvas', this);
          if (!ctx) throw new Error('Canvas上下文创建失败');

          const theme = getCanvasTheme(this.isDark);

          // ✅ F011: 使用提取的工具函数绘制背景
          drawReportBackground(ctx, 750, 1334, theme, this.isDark);

          // ✅ F011: 使用 drawLabel 消除重复的文本绘制模式
          drawLabel(ctx, 'Exam Master', 50, 150, { fontSize: 48, color: theme.titleColor });
          drawLabel(ctx, 'AI 智能诊断报告', 50, 200, { fontSize: 28, color: theme.subText });

          drawCard(ctx, 50, 250, 650, 180, 30, theme.cardBg, this.isDark);

          const userName = this.userInfo.nickName || '考研人';
          drawLabel(ctx, userName, 100, 330, { fontSize: 42, color: theme.mainText });

          const now = new Date();
          const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
          drawLabel(ctx, '错题总数：' + this.mistakes.length + ' 道  |  生成日期：' + dateStr, 100, 390, {
            fontSize: 26,
            color: theme.subText
          });

          const capabilityData = this.calculateCapabilityData();
          if (capabilityData && capabilityData.length > 0) {
            drawLabel(ctx, '学科能力模型', 80, 490, { fontSize: 32, color: theme.mainText });
            drawRadar(ctx, 375, 730, 160, capabilityData, theme);
          }

          drawLabel(ctx, 'AI 深度诊断', 50, 1000, { fontSize: 32, color: theme.titleColor });

          drawDivider(ctx, 50, 700, 1020, theme.dividerColor);

          ctx.setFillStyle(theme.mainText);
          ctx.setFontSize(28);
          drawText(ctx, aiSummary, 80, 1060, 590, 50);

          drawLabel(ctx, '汗水铸就辉煌 · AI 伴你上岸', 375, 1330, {
            fontSize: 24,
            color: theme.subText,
            align: 'center'
          });

          ctx.draw(false, () => {
            logger.log('[MistakeReport] Canvas绘制完成');

            canvasToImage('reportCanvas', this)
              .then((imagePath) => {
                logger.log('[MistakeReport] 图片路径:', imagePath);

                this.reportImagePath = imagePath;
                this.showCustomLoading = false;
                this.isGenerating = false;

                this.showReportModal = true;
                this.$nextTick(() => {
                  resolve(imagePath);
                });
              })
              .catch((err) => {
                logger.error('[MistakeReport] Canvas导出失败:', err);
                this.showCustomLoading = false;
                this.isGenerating = false;
                uni.showToast({
                  title: '图片生成失败：' + (err.errMsg || err.message || '未知错误'),
                  icon: 'none',
                  duration: 3000
                });
                reject(err);
              });
          });
        } catch (error) {
          logger.error('[MistakeReport] drawReport执行失败:', error);
          this.showCustomLoading = false;
          this.isGenerating = false;
          uni.showToast({
            title: '报告生成失败：' + (error.message || '未知错误'),
            icon: 'none',
            duration: 3000
          });
          reject(error);
        }
      });
    },

    calculateCapabilityData() {
      const now = Date.now();
      const CACHE_TTL = 5 * 60 * 1000;

      let allQuestions = this.cachedBankData;
      if (!allQuestions || now - this.cachedBankTimestamp > CACHE_TTL) {
        allQuestions = storageService.get('v30_bank', []) || [];
        this.cachedBankData = allQuestions;
        this.cachedBankTimestamp = now;
        logger.log('[MistakeReport] calculateCapabilityData: 从storage刷新题库缓存，共', allQuestions.length, '题');
      }
      const mistakes = this.mistakes || [];

      // ✅ F021: 当题库为空但有错题时，从错题数据计算能力值（而非返回空数组）
      if (!allQuestions || allQuestions.length === 0) {
        if (mistakes.length === 0) return [];

        // 按分类统计错题数量，错题越多该分类能力越低
        const mistakeStats = {};
        mistakes.forEach((m) => {
          if (!m) return;
          const cat = m.category || '其他';
          if (!mistakeStats[cat]) mistakeStats[cat] = 0;
          mistakeStats[cat]++;
        });

        const maxMistakes = Math.max(...Object.values(mistakeStats), 1);
        const data = Object.keys(mistakeStats).map((cat) => {
          // 错题占比越高，能力值越低（最低0.3）
          const ratio = mistakeStats[cat] / maxMistakes;
          return {
            category: cat,
            rate: Math.max(0.3, 1 - ratio * 0.7)
          };
        });

        return data.sort((a, b) => b.rate - a.rate).slice(0, 6);
      }

      const stats = {};
      allQuestions.forEach((q) => {
        if (!q) return;
        const cat = q.category || '其他';
        if (!stats[cat]) stats[cat] = { total: 0, mistakes: 0 };
        stats[cat].total++;
      });

      mistakes.forEach((m) => {
        if (!m) return;
        const cat = m.category || '其他';
        if (stats[cat]) stats[cat].mistakes++;
      });

      const data = Object.keys(stats).map((cat) => {
        const total = stats[cat].total || 1;
        const correctRate = (total - stats[cat].mistakes) / total;
        return {
          category: cat,
          rate: Math.max(0.3, correctRate || 0.3)
        };
      });

      return data.sort((a, b) => b.rate - a.rate).slice(0, 6);
    },

    generateLocalReport() {
      logger.log('[MistakeReport] 开始生成本地简化版报告');

      this.isGenerating = true;
      this.showCustomLoading = true;

      try {
        const categoryStats = {};
        this.mistakes.forEach((m) => {
          const cat = m.category || '未分类';
          if (!categoryStats[cat]) {
            categoryStats[cat] = { count: 0, questions: [] };
          }
          categoryStats[cat].count++;
          categoryStats[cat].questions.push(m.question || m.question_content || '题目');
        });

        const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1].count - a[1].count);

        const weakestCategory = sortedCategories[0] ? sortedCategories[0][0] : '未知';
        const weakestCount = sortedCategories[0] ? sortedCategories[0][1].count : 0;

        const userName = this.userInfo.nickName || '考研人';
        const totalMistakes = this.mistakes.length;
        const categoryCount = Object.keys(categoryStats).length;

        let reportText = '错题诊断报告（简化版）\n\n';
        reportText += '亲爱的' + userName + '，\n\n';
        reportText += '错题总数：' + totalMistakes + ' 道\n';
        reportText += '涉及分类：' + categoryCount + ' 个\n\n';
        reportText += '薄弱环节：' + weakestCategory + '（' + weakestCount + '道错题）\n\n';
        reportText += '各分类错题分布：\n';

        sortedCategories.slice(0, 5).forEach(([cat, data], idx) => {
          const percentage = Math.round((data.count / totalMistakes) * 100);
          reportText += idx + 1 + '. ' + cat + '：' + data.count + '道（' + percentage + '%）\n';
        });

        reportText += '\n建议：\n';
        reportText += '1. 重点复习「' + weakestCategory + '」相关知识点\n';
        reportText += '2. 每日坚持错题重练，巩固薄弱环节\n';
        reportText += '3. 建议使用错题重练功能逐题攻克\n\n';
        reportText += '加油！坚持就是胜利！';

        this.drawReport(reportText)
          .then(() => {
            logger.log('[MistakeReport] 本地简化版报告生成成功');
          })
          .catch((err) => {
            logger.error('[MistakeReport] 本地报告绘制失败:', err);
            this.showCustomLoading = false;
            this.isGenerating = false;
            uni.showToast({ title: '报告生成失败', icon: 'none' });
          });
      } catch (error) {
        logger.error('[MistakeReport] 本地报告生成异常:', error);
        this.showCustomLoading = false;
        this.isGenerating = false;
        uni.showToast({ title: '报告生成失败：' + error.message, icon: 'none' });
      }
    },

    retryGenerateReport() {
      logger.log('[MistakeReport] 重试生成AI报告');
      this.prepareReport();
    },

    // E010: Canvas 不可用时复制报告文本
    copyReportText() {
      if (!this.reportTextContent) return;
      uni.setClipboardData({
        data: this.reportTextContent,
        success: () => {
          uni.showToast({ title: '报告已复制到剪贴板', icon: 'success' });
        },
        fail: () => {
          uni.showToast({ title: '复制失败', icon: 'none' });
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
/* AI 诊断报告按钮 */
.bottom-bar {
  position: fixed;
  bottom: 50rpx;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 40rpx;
  box-sizing: border-box;
  z-index: 99;
}

.export-btn {
  width: 100%;
  max-width: 650rpx;
  min-width: 500rpx;
  height: 100rpx;
  background: var(--gradient-primary);
  color: var(--primary-foreground);
  border-radius: 50rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  box-shadow: var(--shadow-lg);
  border: none;
  padding: 0 30rpx;
  box-sizing: border-box;
}

.export-btn[disabled] {
  opacity: 0.7;
}

.export-btn::after {
  border: none;
}

.export-icon {
  font-size: 36rpx;
  flex-shrink: 0;
  line-height: var(--line-height-normal);
  display: block;
}

.export-text-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  overflow: visible;
}

.export-text {
  font-size: 30rpx;
  line-height: 1.4;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  display: block;
  width: 100%;
  text-align: center;
}

/* 自定义Loading界面 */
.custom-loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--overlay);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  animation: fadeIn 0.3s ease-in-out;
}

.custom-loading-card {
  background: var(--bg-card);
  border-radius: 30rpx;
  padding: 60rpx 50rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-xl);
  min-width: 400rpx;
}

.loading-spinner {
  width: 120rpx;
  height: 120rpx;
  position: relative;
  margin-bottom: 40rpx;
}

.spinner-ring {
  width: 120rpx;
  height: 120rpx;
  border: 6rpx solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16rpx;
  white-space: nowrap;
  overflow: visible;
}

.loading-desc {
  font-size: 24rpx;
  color: var(--text-sub);
  text-align: center;
  line-height: 1.5;
}

.loading-placeholder {
  padding: 100rpx;
  text-align: center;
  color: var(--text-sub);
}

/* Canvas 画布（隐藏） */
.report-canvas {
  width: 750px;
  height: 1334px;
  position: fixed;
  left: -9999px;
  top: -9999px;
  z-index: -1;
  opacity: 0;
  pointer-events: none;
}

/* 报告弹窗 */
.report-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
  display: flex !important;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease-in-out;
  pointer-events: auto;
  visibility: visible !important;
  opacity: 1 !important;

  .modal-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 1;
  }

  .modal-content {
    position: relative;
    width: 90%;
    max-width: 700rpx;
    max-height: 85vh;
    background: var(--bg-card);
    border-radius: 30rpx;
    display: flex;
    flex-direction: column;
    z-index: 2;
    box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid var(--border, #f0f0f0);

    .modal-title {
      font-size: 36rpx;
      font-weight: bold;
      color: var(--text-primary, #333);
    }

    .modal-close {
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--bg-secondary);
      transition: all 0.2s;

      &:active {
        background: var(--bg-secondary);
        transform: scale(0.95);
      }
    }

    .modal-close-icon {
      font-size: 40rpx;
      color: var(--ds-color-text-secondary);
      line-height: var(--line-height-normal);
      font-weight: 300;
    }
  }

  .modal-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 20rpx;
    background: var(--bg-secondary);
  }

  .report-image {
    width: 100%;
    display: block;
    border-radius: 20rpx;
  }

  .modal-footer {
    display: flex;
    gap: 20rpx;
    padding: 30rpx 40rpx;
    border-top: 1rpx solid var(--border, #f0f0f0);
    background: var(--bg-card);

    .modal-btn {
      flex: 1;
      height: 88rpx;
      line-height: 88rpx;
      border-radius: 44rpx;
      font-size: 32rpx;
      font-weight: bold;
      border: none;

      &.secondary {
        background: var(--bg-secondary);
        color: var(--text-primary, #333);
      }

      &.primary {
        background: #2ecc71;
        color: #fff;
      }

      &::after {
        border: none;
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* E010: Canvas 不可用时的文本降级样式 */
.report-text-fallback {
  padding: 40rpx 30rpx;
  background: var(--bg-card);
  border-radius: 20rpx;

  .report-text-header {
    text-align: center;
    margin-bottom: 40rpx;
    padding-bottom: 30rpx;
    border-bottom: 2rpx solid var(--border, #e0e0e0);
  }

  .report-text-title {
    display: block;
    font-size: 40rpx;
    font-weight: 700;
    color: #2ecc71;
    margin-bottom: 12rpx;
  }

  .report-text-subtitle {
    display: block;
    font-size: 26rpx;
    color: var(--text-sub, #666);
  }

  .report-text-userinfo {
    margin-bottom: 30rpx;
    padding: 24rpx;
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 16rpx;
  }

  .report-text-name {
    display: block;
    font-size: 36rpx;
    font-weight: 600;
    color: var(--text-primary, #333);
    margin-bottom: 8rpx;
  }

  .report-text-meta {
    display: block;
    font-size: 24rpx;
    color: var(--text-sub, #666);
  }

  .report-text-body {
    margin-bottom: 30rpx;
  }

  .report-text-content {
    font-size: 28rpx;
    color: var(--text-primary, #333);
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .report-text-footer {
    text-align: center;
    padding-top: 30rpx;
    border-top: 2rpx solid var(--border, #e0e0e0);

    text {
      font-size: 24rpx;
      color: var(--text-sub, #999);
    }
  }
}
</style>
