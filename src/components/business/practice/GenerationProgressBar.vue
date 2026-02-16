<template>
  <view class="generation-progress-bar">
    <view class="progress-header">
      <view class="progress-icon">
        📚
      </view>
      <view class="progress-info">
        <text class="progress-label">
          正在生成题库
        </text>
        <text class="progress-detail">
          {{ fileName || '学习资料' }}
        </text>
      </view>
      <text class="progress-percent">
        {{ progress }}%
      </text>
    </view>
    <view class="progress-bar-wrapper">
      <view class="progress-bar-bg">
        <view class="progress-bar-fill" :style="{ width: progress + '%' }" />
      </view>
    </view>
    <view class="progress-steps">
      <view class="step-item" :class="{ active: progress >= 0, done: progress >= 20 }">
        <view class="step-dot" />
        <text class="step-label">
          解析文档
        </text>
      </view>
      <view class="step-line" :class="{ done: progress >= 20 }" />
      <view class="step-item" :class="{ active: progress >= 20, done: progress >= 50 }">
        <view class="step-dot" />
        <text class="step-label">
          AI出题
        </text>
      </view>
      <view class="step-line" :class="{ done: progress >= 50 }" />
      <view class="step-item" :class="{ active: progress >= 50, done: progress >= 80 }">
        <view class="step-dot" />
        <text class="step-label">
          校验去重
        </text>
      </view>
      <view class="step-line" :class="{ done: progress >= 80 }" />
      <view class="step-item" :class="{ active: progress >= 80, done: progress >= 100 }">
        <view class="step-dot" />
        <text class="step-label">
          完成
        </text>
      </view>
    </view>
    <view class="progress-footer">
      <text class="progress-status">
        {{ statusText }}
      </text>
      <button class="pause-btn-small" @tap="$emit('pause')">
        暂停
      </button>
    </view>
  </view>
</template>

<script>
export default {
  name: 'GenerationProgressBar',
  props: {
    progress: { type: Number, default: 0 },
    fileName: { type: String, default: '' },
    generatedQuestionCount: { type: Number, default: 0 }
  },
  emits: ['pause'],
  computed: {
    statusText() {
      if (this.progress < 20) return '正在分析文档结构...';
      if (this.progress < 50) return '已生成 ' + this.generatedQuestionCount + ' 道题目';
      if (this.progress < 80) return '题目生成中，即将完成...';
      return '最后冲刺，马上就好！';
    }
  }
};
</script>

<style lang="scss" scoped>
.generation-progress-bar {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.progress-header { display: flex; align-items: center; gap: 12px; }
.progress-icon { font-size: 64rpx; flex-shrink: 0; }
.progress-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.progress-label { font-size: 32rpx; color: var(--text-primary); font-weight: 600; }
.progress-detail {
  font-size: 24rpx; color: var(--text-sub);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.progress-percent { font-size: 48rpx; font-weight: 700; color: var(--primary); flex-shrink: 0; }
.progress-bar-wrapper { width: 100%; }
.progress-bar-bg {
  width: 100%; height: 10px;
  background: var(--primary-light); border-radius: 5px; overflow: hidden;
}
.progress-bar-fill {
  height: 100%; background: var(--gradient-primary);
  border-radius: 5px; transition: width 0.3s ease; position: relative;
}
.progress-bar-fill::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.progress-footer { display: flex; justify-content: space-between; align-items: center; }
.progress-status { font-size: 28rpx; color: var(--text-sub); }
.pause-btn-small {
  padding: 8px 16px; background: var(--warning-light); color: var(--warning);
  border-radius: 16px; font-size: 28rpx; border: none; font-weight: 500;
}
.pause-btn-small::after { border: none; }
.progress-steps { display: flex; align-items: center; justify-content: space-between; padding: 0 8px; }
.step-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.step-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--border); transition: all 0.3s ease;
}
.step-item.active .step-dot {
  background: var(--primary);
  box-shadow: 0 0 8px rgba(var(--primary-rgb, 16, 185, 129), 0.4);
}
.step-item.done .step-dot { background: var(--primary); }
.step-label { font-size: 22rpx; color: var(--text-sub); white-space: nowrap; }
.step-item.active .step-label { color: var(--primary); font-weight: 500; }
.step-line {
  flex: 1; height: 2px; background: var(--border);
  margin: 0 4px; margin-bottom: 20px; transition: background 0.3s ease;
}
.step-line.done { background: var(--primary); }
</style>
