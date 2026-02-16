<template>
  <view v-if="visible" class="formula-modal" @tap="$emit('close')">
    <view class="formula-content" @tap.stop>
      <view class="formula-header">
        <text class="formula-title">
          🧮 公式定理速查
        </text>
        <view class="formula-close" @tap="$emit('close')">
          <text>×</text>
        </view>
      </view>
      <scroll-view scroll-y class="formula-scroll">
        <view
          v-for="(item, index) in formulaList"
          :key="index"
          class="formula-item"
        >
          <view class="formula-category">
            {{ item.category }}
          </view>
          <text class="formula-name">
            {{ item.name }}
          </text>
          <text class="formula-text">
            {{ item.formula }}
          </text>
        </view>
      </scroll-view>
      <view class="formula-footer">
        <text class="formula-tip">
          💡 更多公式正在整理中...
        </text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'FormulaModal',
  props: {
    visible: { type: Boolean, default: false },
    formulaList: { type: Array, default: () => [] }
  },
  emits: ['close']
};
</script>

<style lang="scss" scoped>
.formula-modal {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(10rpx);
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
	animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}

.formula-content {
	width: 90%;
	max-width: 680rpx;
	max-height: 80vh;
	background: var(--bg-card);
	border-radius: 32rpx;
	overflow: hidden;
	box-shadow: var(--shadow-xl);
	animation: slideUp 0.3s ease;
}

@keyframes slideUp {
	from { transform: translateY(100rpx); opacity: 0; }
	to { transform: translateY(0); opacity: 1; }
}

.formula-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 32rpx;
	border-bottom: 1rpx solid var(--border);
	background: var(--bg-secondary);
}

.formula-title {
	font-size: 36rpx;
	font-weight: 700;
	color: var(--text-primary);
}

.formula-close {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: var(--bg-card);
	color: var(--text-sub);
	font-size: 40rpx;
}

.formula-scroll {
	max-height: 60vh;
	padding: 24rpx;
}

.formula-item {
	background: var(--bg-secondary);
	border-radius: 20rpx;
	padding: 24rpx;
	margin-bottom: 20rpx;
	border: 1rpx solid var(--border);
}

.formula-category {
	display: inline-block;
	background: var(--primary-light);
	color: var(--primary);
	font-size: 20rpx;
	padding: 4rpx 16rpx;
	border-radius: 10rpx;
	margin-bottom: 12rpx;
}

.formula-name {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--text-primary);
	margin-bottom: 8rpx;
}

.formula-text {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: var(--primary);
	font-family: 'Times New Roman', serif;
}

.formula-footer {
	padding: 24rpx 32rpx;
	border-top: 1rpx solid var(--border);
	text-align: center;
}

.formula-tip {
	font-size: 24rpx;
	color: var(--text-sub);
}
</style>
