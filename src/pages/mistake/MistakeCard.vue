<template>
  <view class="glass-card mistake-card">
    <view class="card-tag">
      {{ getCategory(item) }}
    </view>
    <text class="question-text">
      {{ item.question || item.question_content || '题目内容加载中...' }}
    </text>

    <!-- 错题重做区域 -->
    <view v-if="localIsPracticing" class="practice-area">
      <view v-if="item.practiceStatus" class="practice-status-bar">
        <view class="status-icon" :class="item.practiceStatus">
          <BaseIcon v-if="item.practiceStatus === 'checking'" name="timer" :size="28" />
          <BaseIcon v-else-if="item.practiceStatus === 'correct'" name="check" :size="28" />
          <BaseIcon v-else name="cross" :size="28" />
        </view>
        <text class="status-text">
          {{
            item.practiceStatus === 'checking'
              ? '正在检查答案...'
              : item.practiceStatus === 'correct'
                ? '回答正确！'
                : '回答错误'
          }}
        </text>
      </view>
      <view class="options-list practice-options">
        <view
          v-for="(opt, i) in item.options"
          :key="i"
          class="option-row"
          :class="{
            selected: practiceChoice === i,
            disabled: isAnalyzing,
            'correct-option': practiceResult && ['A', 'B', 'C', 'D'][i] === (item.answer || item.correct_answer),
            'wrong-option': practiceResult && !practiceResult.isCorrect && practiceChoice === i
          }"
          @tap="selectOption(i)"
        >
          <text class="opt-idx">
            {{ ['A', 'B', 'C', 'D'][i] }}
          </text>
          <text class="opt-text">
            {{ opt }}
          </text>
        </view>
      </view>
      <view class="practice-actions">
        <button
          class="action-btn primary"
          hover-class="ds-hover-btn"
          :disabled="practiceChoice === undefined || isAnalyzing"
          @tap="submitAnswer"
        >
          {{ isAnalyzing ? '检查中...' : '提交答案' }}
        </button>
        <button class="action-btn" hover-class="ds-hover-btn" @tap="cancelPractice">取消</button>
      </view>
      <view v-if="practiceResult" class="practice-result">
        <view class="result-header">
          <view class="result-icon" :class="practiceResult.isCorrect ? 'correct' : 'wrong'">
            <BaseIcon :name="practiceResult.isCorrect ? 'check' : 'cross'" :size="28" />
          </view>
          <text class="result-text">
            {{
              practiceResult.isCorrect
                ? '回答正确！太棒了！'
                : '回答错误，正确答案是 ' + (item.answer || item.correct_answer)
            }}
          </text>
        </view>
        <text v-if="practiceResult.feedback" class="result-desc">
          {{ practiceResult.feedback }}
        </text>
        <view v-if="!practiceResult.isCorrect" class="result-actions">
          <button class="retry-btn" @tap="retryPractice">再试一次</button>
        </view>
      </view>
    </view>

    <!-- 普通错题展示区域 -->
    <view v-else>
      <view class="options-list">
        <view v-for="(opt, i) in item.options" :key="i" class="option-row">
          <text
            class="opt-idx"
            :class="{
              correct:
                (mode === 'recite' || localShowAnalysis) &&
                ['A', 'B', 'C', 'D'][i] === (item.answer || item.correct_answer),
              wrong:
                (mode === 'recite' || localShowAnalysis) &&
                item.userChoice &&
                item.userChoice.charAt(0) === ['A', 'B', 'C', 'D'][i] &&
                item.userChoice.charAt(0) !== (item.answer || item.correct_answer)
            }"
          >
            {{ ['A', 'B', 'C', 'D'][i] }}
          </text>
          <text class="opt-text">
            {{ opt }}
          </text>
        </view>
      </view>

      <view v-if="mode === 'recite' || localShowAnalysis" class="analysis-box">
        <view class="correct-ans"> 正确答案：{{ item.answer || item.correct_answer || '未知' }} </view>
        <view class="analysis-content">
          <text class="label"> 智能解析： </text>
          {{ item.desc || item.analysis || '暂无解析' }}
        </view>
      </view>
    </view>

    <view class="card-footer">
      <text class="time-text">
        {{ formatDate(item.addTime || item.created_at || item.timestamp) }}
      </text>
      <view v-if="(item.wrongCount || item.wrong_count || 0) > 1" class="wrong-count">
        <BaseIcon name="warning" :size="20" class="count-icon" />
        <text class="count-text"> 错误 {{ item.wrongCount || item.wrong_count || 1 }} 次 </text>
      </view>
      <view class="actions">
        <button v-if="mode === 'quiz' && !localIsPracticing" class="action-btn sm" @tap="toggleAnalysis">
          {{ localShowAnalysis ? '隐藏解析' : '查看解析' }}
        </button>
        <button v-if="!localIsPracticing" class="action-btn sm primary" @tap="startPractice">重做此题</button>
        <button v-if="!localIsPracticing" class="action-btn sm del" @tap="$emit('remove', index)">移除</button>
      </view>
    </view>
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
import { recordReview } from '@/utils/learning/adaptive-learning-engine.js';
import { logger } from '@/utils/logger.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'MistakeCard',
  components: { BaseIcon },
  props: {
    /** 错题数据对象 */
    item: {
      type: Object,
      required: true
    },
    /** 在错题列表中的索引 */
    index: {
      type: Number,
      required: true
    },
    /** 当前模式: quiz / recite */
    mode: {
      type: String,
      default: 'quiz'
    },
    /** 完整错题列表引用（用于云端同步后更新本地缓存） */
    mistakes: {
      type: Array,
      default: () => []
    }
  },
  emits: ['remove', 'update:item'],
  data() {
    return {
      practiceChoice: undefined,
      practiceResult: null,
      isAnalyzing: false,
      localShowAnalysis: false,
      localIsPracticing: false
    };
  },
  methods: {
    getCategory(item) {
      return item.category || item.subject || '未分类';
    },
    formatDate(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hour = d.getHours().toString().padStart(2, '0');
      const min = d.getMinutes().toString().padStart(2, '0');
      return month + '月' + day + '日 ' + hour + ':' + min;
    },
    toggleAnalysis() {
      this.localShowAnalysis = !this.localShowAnalysis;
    },
    startPractice() {
      this.localIsPracticing = true;
      this.practiceChoice = undefined;
      this.practiceResult = null;
    },
    selectOption(optionIndex) {
      if (!this.isAnalyzing) {
        this.practiceChoice = optionIndex;
      }
    },
    submitAnswer() {
      if (this.isAnalyzing) return;
      if (this.practiceChoice === undefined) {
        logger.log('[MistakeCard] 未选择答案，无法提交');
        return;
      }

      const mistake = this.item;
      if (!mistake) {
        logger.error('[MistakeCard] 错题数据不存在');
        return;
      }

      const mistakeId = mistake.id || mistake._id;
      const selectedOption = this.practiceChoice;
      const selectedAnswer = ['A', 'B', 'C', 'D'][selectedOption];
      const correctAnswer = (mistake.answer || mistake.correct_answer || 'A').toUpperCase();
      const correctOptionIndex = ['A', 'B', 'C', 'D'].indexOf(correctAnswer);
      const isCorrect = selectedOption === correctOptionIndex;

      logger.log(
        '[MistakeCard] 提交重做答案 - ID: ' +
          mistakeId +
          ', 选择: ' +
          selectedAnswer +
          ', 正确: ' +
          correctAnswer +
          ', 结果: ' +
          isCorrect
      );

      this.isAnalyzing = true;

      setTimeout(() => {
        this.isAnalyzing = false;

        const feedback = isCorrect ? '太棒了！你已经掌握了这道题。' : '再想想！正确答案是 ' + correctAnswer + '。';

        this.practiceResult = { isCorrect, feedback };

        // 追踪复习错题事件
        analytics.trackReviewMistake(mistakeId, isCorrect, {
          category: mistake.category,
          wrongCount: mistake.wrong_count || mistake.wrongCount || 1
        });

        // 记录复习结果到自适应学习引擎
        if (mistakeId) {
          recordReview(mistakeId, isCorrect);
        }

        // 答对了，通知父组件更新错题状态
        if (isCorrect) {
          logger.log('[MistakeCard] 答案正确，更新掌握状态 - ID: ' + mistakeId);

          this.localIsPracticing = false;
          const updatedItem = {
            ...this.item,
            is_mastered: true,
            isMastered: true,
            isPracticing: false,
            last_practice_time: Date.now()
          };
          this.$emit('update:item', updatedItem);

          if (mistakeId) {
            storageService
              .updateMistakeStatus(mistakeId, true)
              .then((result) => {
                if (result.success) {
                  logger.log('[MistakeCard] 云端状态更新成功 - source: ' + result.source);
                } else {
                  logger.warn('[MistakeCard] 云端状态更新失败: ' + result.error);
                }
                storageService.save('mistake_book', this.mistakes, true);
              })
              .catch((err) => {
                logger.error('[MistakeCard] 更新错题状态异常:', err);
                storageService.save('mistake_book', this.mistakes, true);
              });
          } else {
            logger.warn('[MistakeCard] 错题ID为空，仅更新本地状态');
            storageService.save('mistake_book', this.mistakes, true);
          }

          vibrateLight();
        } else {
          logger.log('[MistakeCard] 答案错误，不更新掌握状态');
        }
      }, 500);
    },
    cancelPractice() {
      this.localIsPracticing = false;
      this.practiceChoice = undefined;
      this.practiceResult = null;
    },
    retryPractice() {
      this.practiceChoice = undefined;
      this.practiceResult = null;
    }
  }
};
</script>

<style lang="scss" scoped>
.glass-card {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 40rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: var(--shadow-md);
}

/* 错题卡片 */
.mistake-card {
  position: relative;
  padding: 40rpx;

  .card-tag {
    position: absolute;
    top: 0;
    right: 40rpx;
    background: var(--primary-light);
    color: var(--primary);
    font-size: 20rpx;
    padding: 10rpx 20rpx;
    border-radius: 0 0 20rpx 20rpx;
  }

  .question-text {
    font-size: 30rpx;
    line-height: 1.6;
    color: var(--text-primary);
    margin-bottom: 30rpx;
    margin-top: 10rpx;
    display: block;
    font-weight: 600;
  }
}

.options-list {
  margin-bottom: 30rpx;
}

.option-row {
  display: flex;
  margin-bottom: 16rpx;
  align-items: flex-start;

  .opt-idx {
    width: 48rpx;
    font-weight: 700;
    color: var(--text-sub);
    flex-shrink: 0;
    font-size: 28rpx;

    &.correct {
      color: var(--success);
    }

    &.wrong {
      color: var(--danger);
    }
  }

  .opt-text {
    font-size: 28rpx;
    color: var(--text-primary);
    line-height: 1.5;
    flex: 1;
  }
}

.analysis-box {
  background: var(--bg-secondary);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border-left: 8rpx solid var(--primary);
  animation: fadeIn 0.3s;

  .correct-ans {
    font-weight: bold;
    color: var(--success);
    margin-bottom: 20rpx;
    font-size: 28rpx;
    display: block;
  }

  .analysis-content {
    font-size: 26rpx;
    color: var(--text-primary);
    line-height: 1.6;

    .label {
      font-weight: bold;
      color: var(--text-primary);
    }
  }
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--border, #f0f0f0);

  .time-text {
    font-size: 22rpx;
    color: var(--text-sub);
  }

  .actions {
    display: flex;
    gap: 16rpx;
  }

  .action-btn {
    padding: 10rpx 24rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    border: none;

    &.sm {
      background: var(--bg-secondary);
      color: var(--text-sub);
    }

    &.del {
      background: var(--danger-light);
      color: var(--danger);
    }

    &.primary {
      background: var(--primary);
      color: var(--primary-foreground);
      font-weight: bold;
    }

    &[disabled] {
      opacity: 0.5;
    }

    &::after {
      border: none;
    }
  }

  .wrong-count {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: 22rpx;
    color: var(--warning);
  }

  .count-icon {
    font-size: 20rpx;
  }
}

/* 练习选项样式 */
.practice-options {
  margin-bottom: 20rpx;
}

.practice-options .option-row {
  padding: 20rpx;
  border-radius: 16rpx;
  background: var(--bg-secondary);
  transition: all 0.2s;

  &.selected {
    background: var(--primary-light);
    border: 1px solid var(--primary);
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.correct-option {
    background: rgba(46, 204, 113, 0.15);
    border: 1px solid var(--success);
  }

  &.wrong-option {
    background: rgba(255, 59, 48, 0.15);
    border: 1px solid var(--danger);
  }
}

.practice-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.practice-result {
  margin-top: 30rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: var(--bg-secondary);
}

.result-header {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.result-icon {
  font-size: 36rpx;
  font-weight: bold;
  margin-right: 10rpx;

  &.correct {
    color: var(--success);
  }

  &.wrong {
    color: var(--danger);
  }
}

.result-text {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.result-desc {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.5;
}

.result-actions {
  margin-top: 16rpx;
}

.retry-btn {
  padding: 10rpx 24rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  background: var(--primary-light);
  color: var(--primary);
  border: none;
  font-weight: 600;

  &::after {
    border: none;
  }
}

.practice-status-bar {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  border-radius: 12rpx;
  background: var(--bg-secondary);

  .status-icon {
    font-size: 28rpx;
    font-weight: bold;

    &.correct {
      color: var(--success);
    }
    &.wrong {
      color: var(--danger);
    }
    &.checking {
      color: var(--warning);
    }
  }

  .status-text {
    font-size: 26rpx;
    color: var(--text-primary);
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
</style>
