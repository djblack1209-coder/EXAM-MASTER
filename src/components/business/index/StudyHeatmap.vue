<template>
  <view class="study-heatmap">
    <view class="heatmap-shell">
      <view class="month-strip">
        <text v-for="(month, index) in monthLabels" :key="index" class="month-label">
          {{ month }}
        </text>
      </view>

      <view class="heatmap-panel">
        <view class="week-labels">
          <text class="week-label" />
          <text class="week-label"> 一 </text>
          <text class="week-label" />
          <text class="week-label"> 三 </text>
          <text class="week-label" />
          <text class="week-label"> 五 </text>
          <text class="week-label" />
        </view>

        <scroll-view class="heatmap-scroll" scroll-x :show-scrollbar="false">
          <view class="heatmap-grid">
            <view v-for="(week, weekIndex) in heatmapData" :key="weekIndex" class="week-column">
              <view
                v-for="(day, dayIndex) in week"
                :key="dayIndex"
                class="day-cell"
                :class="getDayClass(day)"
                :style="getDayStyle(day)"
                @tap="handleDayTap(day)"
              />
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="legend-row">
      <view class="legend-pill">
        <text class="legend-text"> 少 </text>
        <view class="legend-cells">
          <view class="legend-cell level-0" />
          <view class="legend-cell level-1" />
          <view class="legend-cell level-2" />
          <view class="legend-cell level-3" />
          <view class="legend-cell level-4" />
        </view>
        <text class="legend-text"> 多 </text>
      </view>
    </view>

    <view class="stats-row">
      <view class="stat-item glass-stat">
        <text class="stat-value">
          {{ totalDays }}
        </text>
        <text class="stat-label"> 学习天数 </text>
      </view>
      <view class="stat-item glass-stat">
        <text class="stat-value">
          {{ currentStreak }}
        </text>
        <text class="stat-label"> 当前连续 </text>
      </view>
      <view class="stat-item glass-stat">
        <text class="stat-value">
          {{ maxStreak }}
        </text>
        <text class="stat-label"> 最长连续 </text>
      </view>
    </view>

    <view v-if="selectedDay" class="day-detail">
      <view>
        <text class="detail-caption"> 已选日期 </text>
        <text class="detail-date">
          {{ selectedDay.dateStr }}
        </text>
      </view>
      <text class="detail-value"> 学习 {{ selectedDay.minutes }} 分钟 </text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'StudyHeatmap',
  props: {
    // 学习记录数据 { 'YYYY-MM-DD': minutes }
    studyData: {
      type: Object,
      default: () => ({})
    },
    // 显示的周数（默认显示最近52周，即一年）
    weeks: {
      type: Number,
      default: 52
    }
  },
  emits: ['day-tap'],
  data() {
    return {
      heatmapData: [],
      monthLabels: [],
      selectedDay: null,
      totalDays: 0,
      currentStreak: 0,
      maxStreak: 0
    };
  },
  watch: {
    // [AUDIT FIX R135] 移除 deep: true —— 父组件替换整个 studyData 对象引用时
    // 浅引用比较已能捕获变化，无需深度遍历 52×7 个属性
    studyData: {
      handler() {
        this.generateHeatmapData();
        this.calculateStats();
      },
      immediate: true
    }
  },
  methods: {
    /**
     * 生成热力图数据
     */
    generateHeatmapData() {
      const today = new Date();
      const data = [];
      const months = new Set();

      // 计算起始日期（从最近的周日开始往前推）
      const endDate = new Date(today);
      const _dayOfWeek = endDate.getDay();

      // 计算需要显示的总天数
      const totalDays = this.weeks * 7;

      // 从今天往前推算
      for (let i = totalDays - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);

        const weekIndex = Math.floor((totalDays - 1 - i) / 7);
        const dayIndex = date.getDay();

        if (!data[weekIndex]) {
          data[weekIndex] = new Array(7).fill(null);
        }

        const dateStr = this.formatDate(date);
        const minutes = this.studyData[dateStr] || 0;

        data[weekIndex][dayIndex] = {
          date: date,
          dateStr: this.formatDisplayDate(date),
          key: dateStr,
          minutes: minutes,
          level: this.getLevel(minutes)
        };

        // 收集月份标签
        if (date.getDate() <= 7) {
          months.add(this.getMonthLabel(date));
        }
      }

      this.heatmapData = data;
      this.generateMonthLabels();
    },

    /**
     * 生成月份标签
     */
    generateMonthLabels() {
      const labels = [];
      const today = new Date();
      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

      for (let i = 0; i < this.weeks; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (this.weeks - 1 - i) * 7);

        if (i === 0 || date.getDate() <= 7) {
          labels.push(monthNames[date.getMonth()]);
        } else {
          labels.push('');
        }
      }

      this.monthLabels = labels;
    },

    /**
     * 计算统计数据
     */
    calculateStats() {
      let totalDays = 0;
      let currentStreak = 0;
      let maxStreak = 0;
      let tempStreak = 0;

      const today = new Date();
      const sortedDates = Object.keys(this.studyData).sort().reverse();

      // 计算总学习天数
      totalDays = sortedDates.filter((date) => this.studyData[date] > 0).length;

      // 计算连续天数
      const checkDate = new Date(today);
      let isCurrentStreak = true;

      for (let i = 0; i < 365; i++) {
        const dateStr = this.formatDate(checkDate);
        const minutes = this.studyData[dateStr] || 0;

        if (minutes > 0) {
          tempStreak++;
          if (isCurrentStreak) {
            currentStreak = tempStreak;
          }
        } else {
          if (isCurrentStreak && i > 0) {
            isCurrentStreak = false;
          }
          maxStreak = Math.max(maxStreak, tempStreak);
          tempStreak = 0;
        }

        checkDate.setDate(checkDate.getDate() - 1);
      }

      maxStreak = Math.max(maxStreak, tempStreak, currentStreak);

      this.totalDays = totalDays;
      this.currentStreak = currentStreak;
      this.maxStreak = maxStreak;
    },

    /**
     * 根据学习时长获取等级 (0-4)
     */
    getLevel(minutes) {
      if (minutes === 0) return 0;
      if (minutes < 15) return 1;
      if (minutes < 30) return 2;
      if (minutes < 60) return 3;
      return 4;
    },

    /**
     * 获取日期格子的类名
     */
    getDayClass(day) {
      if (!day) return 'empty';
      return `level-${day.level}`;
    },

    /**
     * 获取日期格子的样式
     */
    getDayStyle(day) {
      if (!day) return {};
      return {};
    },

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    /**
     * 格式化显示日期
     */
    formatDisplayDate(date) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `${month}月${day}日 ${weekDays[date.getDay()]}`;
    },

    /**
     * 获取月份标签
     */
    getMonthLabel(date) {
      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      return monthNames[date.getMonth()];
    },

    /**
     * 处理日期点击
     */
    handleDayTap(day) {
      if (!day) return;
      this.selectedDay = day;
      this.$emit('day-tap', day);
    }
  }
};
</script>

<style lang="scss" scoped>
.study-heatmap {
  width: 100%;
}

.heatmap-shell {
  padding: 20rpx;
  border-radius: 24rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 40%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.56) 0%, rgba(255, 255, 255, 0.34) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.month-strip {
  display: flex;
  padding-left: 56rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
}

.month-label {
  flex: 1;
  min-width: 24rpx;
  font-size: 20rpx;
  color: var(--text-secondary, var(--text-sub, #666));
  text-align: left;
}

.heatmap-panel {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  padding: 20rpx;
  border-radius: 22rpx;
  background: linear-gradient(180deg, var(--apple-group-bg) 0%, var(--apple-glass-card-bg) 100%);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.week-labels {
  display: flex;
  flex-direction: column;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  padding-top: 4rpx;
}

.week-label {
  height: 28rpx;
  line-height: 28rpx;
  font-size: 20rpx;
  color: var(--text-secondary, var(--text-sub, #666));
  text-align: right;
  padding-right: 10rpx;
}

.heatmap-scroll {
  flex: 1;
  white-space: nowrap;
}

.heatmap-grid {
  display: inline-flex;
  /* gap: 6rpx; -- replaced for Android WebView compat */
}

.week-column {
  display: flex;
  flex-direction: column;
  /* gap: 6rpx; -- replaced for Android WebView compat */
}

.day-cell {
  width: 28rpx;
  height: 28rpx;
  border-radius: 10rpx;
  border: 1px solid rgba(255, 255, 255, 0.24);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.3);
  transition: all 0.2s ease;

  &.empty {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  &.level-0 {
    background: rgba(255, 255, 255, 0.34);
  }

  &.level-1 {
    background: rgba(139, 216, 161, 0.92);
  }

  &.level-2 {
    background: rgba(90, 201, 120, 0.94);
  }

  &.level-3 {
    background: rgba(52, 199, 89, 0.96);
  }

  &.level-4 {
    background: rgba(34, 135, 58, 0.98);
  }

  &:active {
    transform: scale(1.08);
  }
}

.legend-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 20rpx;
}

.legend-pill {
  display: inline-flex;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.44);
  box-shadow: var(--apple-shadow-surface);
}

.legend-text {
  font-size: 20rpx;
  color: var(--text-secondary, var(--text-sub, #666));
}

.legend-cells {
  display: flex;
  /* gap: 6rpx; -- replaced for Android WebView compat */
}

.legend-cell {
  width: 20rpx;
  height: 20rpx;
  border-radius: 8rpx;
  border: 1px solid rgba(255, 255, 255, 0.22);

  &.level-0 {
    background: rgba(255, 255, 255, 0.34);
  }

  &.level-1 {
    background: rgba(139, 216, 161, 0.92);
  }

  &.level-2 {
    background: rgba(90, 201, 120, 0.94);
  }

  &.level-3 {
    background: rgba(52, 199, 89, 0.96);
  }

  &.level-4 {
    background: rgba(34, 135, 58, 0.98);
  }
}

.stats-row {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-top: 24rpx;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
}

.glass-stat {
  padding: 22rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}

.stat-value {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main, #111);
}

.stat-label {
  font-size: 22rpx;
  color: var(--text-secondary, var(--text-sub, #666));
}

.day-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 46%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 20rpx;
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.detail-caption {
  display: block;
  margin-bottom: 8rpx;
  font-size: 20rpx;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  color: var(--text-secondary, var(--text-sub, #666));
}

.detail-date {
  display: block;
  font-size: 24rpx;
  color: var(--text-main, #111);
  font-weight: 600;
}

.detail-value {
  font-size: 24rpx;
  color: var(--ds-color-primary, #007aff);
  font-weight: 600;
  white-space: nowrap;
}

.dark {
  .heatmap-shell {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
      linear-gradient(160deg, rgba(22, 24, 30, 0.9) 0%, rgba(10, 12, 18, 0.82) 100%);
  }

  .heatmap-panel,
  .legend-pill,
  .glass-stat {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
  }

  /* [AUDIT FIX R178] 暗黑模式下日期格子边框/阴影适配 */
  .day-cell {
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: none;

    &.level-0 {
      background: rgba(255, 255, 255, 0.08);
    }

    &.level-1 {
      background: rgba(28, 63, 110, 0.84);
    }

    &.level-2 {
      background: rgba(24, 91, 171, 0.88);
    }

    &.level-3 {
      background: rgba(10, 132, 255, 0.92);
    }

    &.level-4 {
      background: rgba(69, 159, 255, 0.98);
    }
  }

  /* [AUDIT FIX R179] 暗黑模式下图例格子边框适配 */
  .legend-cell {
    border-color: rgba(255, 255, 255, 0.08);

    &.level-0 {
      background: rgba(255, 255, 255, 0.08);
    }

    &.level-1 {
      background: rgba(28, 63, 110, 0.84);
    }

    &.level-2 {
      background: rgba(24, 91, 171, 0.88);
    }

    &.level-3 {
      background: rgba(10, 132, 255, 0.92);
    }

    &.level-4 {
      background: rgba(69, 159, 255, 0.98);
    }
  }

  .day-detail {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
      linear-gradient(160deg, rgba(18, 20, 28, 0.92) 0%, rgba(8, 10, 16, 0.9) 100%);
  }
}
</style>
