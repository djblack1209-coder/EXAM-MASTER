<template>
  <view>
    <view class="section-header">
      <text class="section-title">
        概况
      </text>
    </view>
    <view class="bubble-field">
      <view
        v-for="(point, index) in sortedPoints"
        :key="point.id"
        :class="[
          'bubble-card',
          isDark ? 'bubble-card-dark' : 'bubble-card-light',
          'bubble-size-' + getBubbleSize(point.mastery),
          'bubble-float',
          animatingBubbleId === point.id && 'bubble-animating'
        ]"
        :style="getBubbleCardStyle(point, index)"
        @tap="$emit('knowledge-click', point)"
      >
        <view
          class="bubble-glow animate-breathe"
          :style="{
            background: 'radial-gradient(circle at center, '
              + point.color + '33 0%, transparent 70%)'
          }"
        />
        <view class="bubble-content">
          <text class="bubble-icon" :style="{ color: point.color }">
            {{ point.icon }}
          </text>
          <text class="bubble-title" :style="{ color: point.color }">
            {{ point.title }}
          </text>
          <text class="bubble-count">
            {{ point.count }} 项
          </text>
          <view class="bubble-progress-bar">
            <view
              class="bubble-progress-fill"
              :style="{ width: point.mastery + '%', backgroundColor: point.color }"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'KnowledgeBubbleField',
  props: {
    isDark: { type: Boolean, default: false },
    knowledgePoints: { type: Array, default: () => [] },
    animatingBubbleId: { type: [Number, String, null], default: null }
  },
  emits: ['knowledge-click'],
  computed: {
    sortedPoints() {
      return [...this.knowledgePoints].sort((a, b) => a.mastery - b.mastery);
    }
  },
  methods: {
    getBubbleSize(mastery) {
      if (mastery >= 65) return 'lg';
      if (mastery >= 35) return 'md';
      return 'sm';
    },
    getBubbleCardStyle(point, index) {
      // 6个错位位置，紧凑排列、气泡间有轻微重叠
      const positions = [
        { top: '0', left: '2%' },
        { top: '16rpx', right: '4%' },
        { top: '210rpx', left: '22%' },
        { top: '195rpx', right: '0%' },
        { top: '400rpx', left: '4%' },
        { top: '415rpx', right: '10%' }
      ];
      const pos = positions[index % positions.length];
      const base = {
        ...pos,
        zIndex: 10 + index,
        animationDelay: `${index * 300}ms`
      };

      if (this.isDark) {
        return {
          ...base,
          boxShadow: `0 0 24rpx ${point.color}4D, 0 0 48rpx ${point.color}1A`
        };
      }
      return {
        ...base,
        boxShadow: '0 4rpx 16rpx rgba(0, 0, 0, 0.06)'
      };
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

.section-title {
	font-size: 36rpx;
	font-weight: 700;
	color: var(--text-primary);
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
	0%, 100% { transform: translateY(0); }
	50% { transform: translateY(-12rpx); }
}

.bubble-float {
	animation: float 4s ease-in-out infinite;
}

/* 点击动画 */
.bubble-animating {
	animation: bubbleClick 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes bubbleClick {
	0% { transform: scale(1); }
	30% { transform: scale(1.12); }
	60% { transform: scale(0.96); }
	100% { transform: scale(1); }
}

.bubble-card-light {
	background: var(--bg-card);
	backdrop-filter: blur(16rpx);
	-webkit-backdrop-filter: blur(16rpx);
	border: 1rpx solid var(--border);
}

.bubble-card-dark {
	background: var(--bg-card);
	backdrop-filter: blur(16rpx);
	-webkit-backdrop-filter: blur(16rpx);
	border: 1rpx solid var(--border);
}

/* 光晕呼吸 */
.bubble-glow {
	position: absolute;
	inset: 0;
	border-radius: 50%;
	opacity: 0.5;
	pointer-events: none;
}

@keyframes breathe {
	0%, 100% { opacity: 0.5; }
	50% { opacity: 1; }
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
	gap: 4rpx;
	padding: 16rpx;
	text-align: center;
}

.bubble-icon {
	font-size: 38rpx;
	line-height: 1;
}

.bubble-size-lg .bubble-icon {
	font-size: 44rpx;
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
	font-size: 18rpx;
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
