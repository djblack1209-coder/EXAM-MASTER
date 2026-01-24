<!-- REFACTOR: Modern countdown card with design system utilities -->
<template>
  <view class="countdown-card ds-touchable" :class="{ 'dark-mode': isDark }" @tap="onCardTap">
    <view class="card-header">
      <text class="header-text ds-text-sm">考研倒计时</text>
    </view>

    <view class="countdown-number ds-flex">
      <text class="number ds-text-display">{{ daysRemaining }}</text>
      <text class="unit ds-text-xl ds-font-semibold">天</text>
    </view>

    <view class="exam-date">
      <text class="date-text ds-text-xs">考试日期：{{ examDate }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

// 定义props
const props = defineProps({
  targetDate: {
    type: String,
    default: '2026-12-19'
  },
  isDark: {
    type: Boolean,
    default: false
  }
})

// 定义emits
const emit = defineEmits(['cardTap'])

// 计算剩余天数
const daysRemaining = computed(() => {
  const target = new Date(props.targetDate)
  target.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = target.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 0
})

// 格式化考试日期
const examDate = computed(() => {
  const date = new Date(props.targetDate)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}年${month}月${day}日`
})

// 卡片点击事件
const onCardTap = () => {
  emit('cardTap')
}
</script>

<style lang="scss" scoped>
.countdown-card {
  width: 100%;
  height: 160px;
  background: linear-gradient(135deg, #42E695 0%, #3BB2B8 100%);
  border-radius: 16px;
  margin-bottom: 0;
  padding: 24px;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;

  &:active {
    opacity: 0.85;
    transform: scale(0.98);
  }

  .card-header {
    width: 100%;
    margin-bottom: 8px;

    .header-text {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 400;
      -webkit-font-smoothing: antialiased;
    }
  }

  .countdown-number {
    display: flex;
    align-items: baseline;
    justify-content: center;
    margin-bottom: 8px;
    width: 100%;
    padding: 0 8px;
    box-sizing: border-box;

    .number {
      font-size: 64px;
      font-weight: 700;
      color: #FFFFFF;
      line-height: 1;
      -webkit-font-smoothing: antialiased;
      letter-spacing: -2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .unit {
      font-size: 24px;
      font-weight: 600;
      color: #FFFFFF;
      margin-left: 4px;
      -webkit-font-smoothing: antialiased;
      flex-shrink: 0;
    }
  }

  .exam-date {
    width: 100%;
    text-align: center;

    .date-text {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 400;
      -webkit-font-smoothing: antialiased;
    }
  }
}

/* VISUAL: Dark mode styles */
.countdown-card.dark-mode {
  /* 深色模式渐变：深绿到深青 */
  background: linear-gradient(135deg, #1a5f3a 0%, #1a4d5f 100%);
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.3);

  .card-header .header-text {
    color: rgba(255, 255, 255, 0.7);
  }

  .countdown-number {
    .number {
      color: #FFFFFF;
    }

    .unit {
      color: rgba(255, 255, 255, 0.9);
    }
  }

  .exam-date .date-text {
    color: rgba(255, 255, 255, 0.7);
  }
}
</style>
