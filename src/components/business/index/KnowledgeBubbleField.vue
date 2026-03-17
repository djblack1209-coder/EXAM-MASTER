<template>
  <view>
    <view class="section-header section-header-apple">
      <text class="section-title"> 概况 </text>
    </view>
    <view class="bubble-field">
      <view
        v-for="point in sortedPoints"
        :key="point.id"
        :class="[
          'bubble-card',
          isDark ? 'bubble-card-dark' : 'bubble-card-light',
          'bubble-size-' + point._sizeClass,
          'bubble-float',
          animatingBubbleId === point.id && 'bubble-animating'
        ]"
        :style="point._style"
        @tap="$emit('knowledge-click', point)"
      >
        <view class="bubble-glow animate-breathe" :style="{ background: point._glowBg }" />
        <view class="bubble-content">
          <view class="bubble-icon" :style="{ backgroundColor: point._iconBg }">
            <BaseIcon :name="point.icon" :size="point._iconSize" />
          </view>
          <text class="bubble-title" :style="{ color: point.color }">
            {{ point.title }}
          </text>
          <text class="bubble-count"> {{ point.count }} 项 </text>
          <view class="bubble-progress-bar">
            <view class="bubble-progress-fill" :style="{ width: point.mastery + '%', backgroundColor: point.color }" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'KnowledgeBubbleField',
  components: {
    BaseIcon
  },
  props: {
    isDark: { type: Boolean, default: false },
    knowledgePoints: { type: Array, default: () => [] },
    animatingBubbleId: { type: [Number, String, null], default: null }
  },
  emits: ['knowledge-click'],
  computed: {
    // ✅ 2.3: 预计算排序+样式+尺寸，避免 v-for 中重复方法调用
    sortedPoints() {
      const positions = [
        { top: '0', left: '2%' },
        { top: '16rpx', right: '4%' },
        { top: '210rpx', left: '22%' },
        { top: '195rpx', right: '0%' },
        { top: '400rpx', left: '4%' },
        { top: '415rpx', right: '10%' }
      ];
      return [...this.knowledgePoints]
        .sort((a, b) => a.mastery - b.mastery)
        .map((point, index) => {
          const sizeClass = point.mastery >= 65 ? 'lg' : point.mastery >= 35 ? 'md' : 'sm';
          const pos = positions[index % positions.length];
          const base = { ...pos, zIndex: 10 + index, animationDelay: `${index * 300}ms` };
          const style = this.isDark
            ? { ...base, boxShadow: `0 0 24rpx ${point.color}4D, 0 0 48rpx ${point.color}1A` }
            : { ...base, boxShadow: '0 4rpx 16rpx rgba(0, 0, 0, 0.06)' };
          const glowBg = `radial-gradient(circle at center, ${point.color}33 0%, transparent 70%)`;
          const iconBg = this.isDark ? 'rgba(255, 255, 255, 0.9)' : `${point.color}1A`;
          const iconSize = sizeClass === 'lg' ? 42 : sizeClass === 'md' ? 36 : 32;
          return {
            ...point,
            _sizeClass: sizeClass,
            _style: style,
            _glowBg: glowBg,
            _iconBg: iconBg,
            _iconSize: iconSize
          };
        });
    }
  }
};
</script>

<style lang="scss" scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-header-apple {
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 24rpx;
  font-weight: 620;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.bubble-field {
  position: relative;
  min-height: 610rpx;
  margin-bottom: 12rpx;
}

.bubble-card {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s ease;
  overflow: hidden;
}

.bubble-card:active {
  transform: scale(1.06);
}

/* 三档尺寸 */
.bubble-size-sm {
  width: 200rpx;
  height: 200rpx;
}

.bubble-size-md {
  width: 240rpx;
  height: 240rpx;
}

.bubble-size-lg {
  width: 280rpx;
  height: 280rpx;
}

/* 浮动呼吸动画 */
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12rpx);
  }
}

.bubble-float {
  animation: float 4s ease-in-out infinite;
}

/* 点击动画 */
.bubble-animating {
  animation: bubbleClick 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes bubbleClick {
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.12);
  }
  60% {
    transform: scale(0.96);
  }
  100% {
    transform: scale(1);
  }
}

.bubble-card-light {
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border: 1rpx solid var(--apple-glass-border-strong);
}

.bubble-card-dark {
  background: linear-gradient(160deg, rgba(16, 20, 28, 0.9) 0%, rgba(12, 15, 22, 0.96) 100%);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border: 1rpx solid rgba(124, 176, 255, 0.18);
}

/* 光晕呼吸 */
.bubble-glow {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: 50%;
  opacity: 0.5;
  pointer-events: none;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.animate-breathe {
  animation: breathe 2.5s ease-in-out infinite;
}

/* 内容 */
.bubble-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 4rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 4rpx;
  }
  padding: 16rpx;
  text-align: center;
}

.bubble-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.bubble-size-sm .bubble-icon {
  width: 62rpx;
  height: 62rpx;
}

.bubble-size-md .bubble-icon {
  width: 72rpx;
  height: 72rpx;
}

.bubble-size-lg .bubble-icon {
  width: 84rpx;
  height: 84rpx;
}

.bubble-title {
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.2;
  word-break: break-all;
  max-width: 100%;
}

.bubble-size-lg .bubble-title {
  font-size: 24rpx;
}

.bubble-count {
  font-size: 20rpx;
  color: var(--text-sub);
}

.bubble-size-lg .bubble-count {
  font-size: 20rpx;
}

.bubble-progress-bar {
  width: 65%;
  height: 4rpx;
  background: var(--bg-secondary);
  border-radius: 2rpx;
  overflow: hidden;
  margin-top: 2rpx;
}

.bubble-progress-fill {
  height: 100%;
  border-radius: 2rpx;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
