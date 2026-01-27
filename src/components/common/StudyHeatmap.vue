<template>
    <view class="study-heatmap">
        <!-- 月份标签 -->
        <view class="month-labels">
            <text v-for="(month, index) in monthLabels" :key="index" class="month-label">
                {{ month }}
            </text>
        </view>

        <!-- 热力图主体 -->
        <view class="heatmap-body">
            <!-- 星期标签 -->
            <view class="week-labels">
                <text class="week-label"></text>
                <text class="week-label">一</text>
                <text class="week-label"></text>
                <text class="week-label">三</text>
                <text class="week-label"></text>
                <text class="week-label">五</text>
                <text class="week-label"></text>
            </view>

            <!-- 热力图格子 -->
            <scroll-view class="heatmap-scroll" scroll-x :show-scrollbar="false">
                <view class="heatmap-grid">
                    <view v-for="(week, weekIndex) in heatmapData" :key="weekIndex" class="week-column">
                        <view v-for="(day, dayIndex) in week" :key="dayIndex" class="day-cell"
                            :class="getDayClass(day)" :style="getDayStyle(day)" @tap="handleDayTap(day)">
                        </view>
                    </view>
                </view>
            </scroll-view>
        </view>

        <!-- 图例 -->
        <view class="legend">
            <text class="legend-text">少</text>
            <view class="legend-cells">
                <view class="legend-cell level-0"></view>
                <view class="legend-cell level-1"></view>
                <view class="legend-cell level-2"></view>
                <view class="legend-cell level-3"></view>
                <view class="legend-cell level-4"></view>
            </view>
            <text class="legend-text">多</text>
        </view>

        <!-- 统计信息 -->
        <view class="stats-row">
            <view class="stat-item">
                <text class="stat-value">{{ totalDays }}</text>
                <text class="stat-label">学习天数</text>
            </view>
            <view class="stat-item">
                <text class="stat-value">{{ currentStreak }}</text>
                <text class="stat-label">当前连续</text>
            </view>
            <view class="stat-item">
                <text class="stat-value">{{ maxStreak }}</text>
                <text class="stat-label">最长连续</text>
            </view>
        </view>

        <!-- 选中日期详情 -->
        <view v-if="selectedDay" class="day-detail">
            <text class="detail-date">{{ selectedDay.dateStr }}</text>
            <text class="detail-value">学习 {{ selectedDay.minutes }} 分钟</text>
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
    data() {
        return {
            heatmapData: [],
            monthLabels: [],
            selectedDay: null,
            totalDays: 0,
            currentStreak: 0,
            maxStreak: 0
        }
    },
    watch: {
        studyData: {
            handler() {
                this.generateHeatmapData()
                this.calculateStats()
            },
            deep: true,
            immediate: true
        }
    },
    methods: {
        /**
         * 生成热力图数据
         */
        generateHeatmapData() {
            const today = new Date()
            const data = []
            const months = new Set()

            // 计算起始日期（从最近的周日开始往前推）
            const endDate = new Date(today)
            const dayOfWeek = endDate.getDay()
            
            // 计算需要显示的总天数
            const totalDays = this.weeks * 7

            // 从今天往前推算
            for (let i = totalDays - 1; i >= 0; i--) {
                const date = new Date(today)
                date.setDate(today.getDate() - i)
                
                const weekIndex = Math.floor((totalDays - 1 - i) / 7)
                const dayIndex = date.getDay()

                if (!data[weekIndex]) {
                    data[weekIndex] = new Array(7).fill(null)
                }

                const dateStr = this.formatDate(date)
                const minutes = this.studyData[dateStr] || 0

                data[weekIndex][dayIndex] = {
                    date: date,
                    dateStr: this.formatDisplayDate(date),
                    key: dateStr,
                    minutes: minutes,
                    level: this.getLevel(minutes)
                }

                // 收集月份标签
                if (date.getDate() <= 7) {
                    months.add(this.getMonthLabel(date))
                }
            }

            this.heatmapData = data
            this.generateMonthLabels()
        },

        /**
         * 生成月份标签
         */
        generateMonthLabels() {
            const labels = []
            const today = new Date()
            const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

            for (let i = 0; i < this.weeks; i++) {
                const date = new Date(today)
                date.setDate(today.getDate() - (this.weeks - 1 - i) * 7)

                if (i === 0 || date.getDate() <= 7) {
                    labels.push(monthNames[date.getMonth()])
                } else {
                    labels.push('')
                }
            }

            this.monthLabels = labels
        },

        /**
         * 计算统计数据
         */
        calculateStats() {
            let totalDays = 0
            let currentStreak = 0
            let maxStreak = 0
            let tempStreak = 0

            const today = new Date()
            const sortedDates = Object.keys(this.studyData).sort().reverse()

            // 计算总学习天数
            totalDays = sortedDates.filter(date => this.studyData[date] > 0).length

            // 计算连续天数
            let checkDate = new Date(today)
            let isCurrentStreak = true

            for (let i = 0; i < 365; i++) {
                const dateStr = this.formatDate(checkDate)
                const minutes = this.studyData[dateStr] || 0

                if (minutes > 0) {
                    tempStreak++
                    if (isCurrentStreak) {
                        currentStreak = tempStreak
                    }
                } else {
                    if (isCurrentStreak && i > 0) {
                        isCurrentStreak = false
                    }
                    maxStreak = Math.max(maxStreak, tempStreak)
                    tempStreak = 0
                }

                checkDate.setDate(checkDate.getDate() - 1)
            }

            maxStreak = Math.max(maxStreak, tempStreak, currentStreak)

            this.totalDays = totalDays
            this.currentStreak = currentStreak
            this.maxStreak = maxStreak
        },

        /**
         * 根据学习时长获取等级 (0-4)
         */
        getLevel(minutes) {
            if (minutes === 0) return 0
            if (minutes < 15) return 1
            if (minutes < 30) return 2
            if (minutes < 60) return 3
            return 4
        },

        /**
         * 获取日期格子的类名
         */
        getDayClass(day) {
            if (!day) return 'empty'
            return `level-${day.level}`
        },

        /**
         * 获取日期格子的样式
         */
        getDayStyle(day) {
            if (!day) return {}
            return {}
        },

        /**
         * 格式化日期为 YYYY-MM-DD
         */
        formatDate(date) {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        },

        /**
         * 格式化显示日期
         */
        formatDisplayDate(date) {
            const month = date.getMonth() + 1
            const day = date.getDate()
            const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
            return `${month}月${day}日 ${weekDays[date.getDay()]}`
        },

        /**
         * 获取月份标签
         */
        getMonthLabel(date) {
            const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
            return monthNames[date.getMonth()]
        },

        /**
         * 处理日期点击
         */
        handleDayTap(day) {
            if (!day) return
            this.selectedDay = day
            this.$emit('day-tap', day)
        }
    }
}
</script>

<style lang="scss" scoped>
.study-heatmap {
    width: 100%;
}

/* 月份标签 */
.month-labels {
    display: flex;
    padding-left: 48rpx;
    margin-bottom: 8rpx;
    overflow: hidden;
}

.month-label {
    flex: 1;
    min-width: 24rpx;
    font-size: 20rpx;
    color: var(--text-sub, #666);
    text-align: left;
}

/* 热力图主体 */
.heatmap-body {
    display: flex;
    gap: 8rpx;
}

/* 星期标签 */
.week-labels {
    display: flex;
    flex-direction: column;
    gap: 4rpx;
    padding-top: 2rpx;
}

.week-label {
    height: 24rpx;
    line-height: 24rpx;
    font-size: 18rpx;
    color: var(--text-sub, #666);
    text-align: right;
    padding-right: 8rpx;
}

/* 热力图滚动区域 */
.heatmap-scroll {
    flex: 1;
    white-space: nowrap;
}

/* 热力图格子容器 */
.heatmap-grid {
    display: inline-flex;
    gap: 4rpx;
}

/* 周列 */
.week-column {
    display: flex;
    flex-direction: column;
    gap: 4rpx;
}

/* 日期格子 */
.day-cell {
    width: 24rpx;
    height: 24rpx;
    border-radius: 4rpx;
    transition: all 0.2s ease;

    &.empty {
        background: transparent;
    }

    &.level-0 {
        background: var(--heatmap-level-0, #ebedf0);
    }

    &.level-1 {
        background: var(--heatmap-level-1, #9be9a8);
    }

    &.level-2 {
        background: var(--heatmap-level-2, #40c463);
    }

    &.level-3 {
        background: var(--heatmap-level-3, #30a14e);
    }

    &.level-4 {
        background: var(--heatmap-level-4, #216e39);
    }

    &:active {
        transform: scale(1.2);
    }
}

/* 图例 */
.legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8rpx;
    margin-top: 16rpx;
    padding-right: 8rpx;
}

.legend-text {
    font-size: 20rpx;
    color: var(--text-sub, #666);
}

.legend-cells {
    display: flex;
    gap: 4rpx;
}

.legend-cell {
    width: 20rpx;
    height: 20rpx;
    border-radius: 4rpx;

    &.level-0 {
        background: var(--heatmap-level-0, #ebedf0);
    }

    &.level-1 {
        background: var(--heatmap-level-1, #9be9a8);
    }

    &.level-2 {
        background: var(--heatmap-level-2, #40c463);
    }

    &.level-3 {
        background: var(--heatmap-level-3, #30a14e);
    }

    &.level-4 {
        background: var(--heatmap-level-4, #216e39);
    }
}

/* 统计信息 */
.stats-row {
    display: flex;
    justify-content: space-around;
    margin-top: 24rpx;
    padding-top: 24rpx;
    border-top: 1px solid var(--border-color, #e5e5e5);
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
}

.stat-value {
    font-size: 36rpx;
    font-weight: 700;
    color: var(--text-main, #111);
}

.stat-label {
    font-size: 22rpx;
    color: var(--text-sub, #666);
}

/* 选中日期详情 */
.day-detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16rpx;
    padding: 16rpx 24rpx;
    background: var(--muted, #f5f5f7);
    border-radius: 12rpx;
}

.detail-date {
    font-size: 24rpx;
    color: var(--text-main, #111);
    font-weight: 500;
}

.detail-value {
    font-size: 24rpx;
    color: var(--ds-color-primary, #007AFF);
    font-weight: 600;
}

/* 暗色模式适配 */
.dark {
    .day-cell {
        &.level-0 {
            background: var(--heatmap-level-0-dark, #161b22);
        }

        &.level-1 {
            background: var(--heatmap-level-1-dark, #0e4429);
        }

        &.level-2 {
            background: var(--heatmap-level-2-dark, #006d32);
        }

        &.level-3 {
            background: var(--heatmap-level-3-dark, #26a641);
        }

        &.level-4 {
            background: var(--heatmap-level-4-dark, #39d353);
        }
    }

    .legend-cell {
        &.level-0 {
            background: var(--heatmap-level-0-dark, #161b22);
        }

        &.level-1 {
            background: var(--heatmap-level-1-dark, #0e4429);
        }

        &.level-2 {
            background: var(--heatmap-level-2-dark, #006d32);
        }

        &.level-3 {
            background: var(--heatmap-level-3-dark, #26a641);
        }

        &.level-4 {
            background: var(--heatmap-level-4-dark, #39d353);
        }
    }
}
</style>
