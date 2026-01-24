<template>
  <view class="recent-tools ds-card" :class="{ 'dark-mode': isDark }">
    <view class="section-header">
      <text class="title ds-text-lg ds-font-semibold">最近</text>
    </view>

    <view class="tools-grid ds-flex">
      <view class="tool-item ds-flex ds-flex-col ds-gap-sm ds-touchable" v-for="tool in tools" :key="tool.id"
        @tap="handleToolClick(tool)">
        <view class="tool-icon ds-touch-target" :style="{ background: tool.bgColor }">
          <image class="icon-image" :src="tool.iconUrl" mode="aspectFit" />
        </view>
        <text class="tool-name ds-text-xs ds-text-secondary">{{ tool.name }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Props
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
})

const tools = ref([
  {
    id: 1,
    name: '高数真题',
    iconUrl: 'https://img.icons8.com/color/96/calculator--v1.png',
    bgColor: 'linear-gradient(135deg, #B7F5D8 0%, #7ED3B2 100%)'
  },
  {
    id: 2,
    name: '英语一',
    iconUrl: 'https://img.icons8.com/color/96/great-britain.png',
    bgColor: 'linear-gradient(135deg, #A7E3FF 0%, #6EC6FF 100%)'
  },
  {
    id: 3,
    name: '政治大纲',
    iconUrl: 'https://img.icons8.com/color/96/scales.png',
    bgColor: 'linear-gradient(135deg, #FFE9A8 0%, #FFC85C 100%)'
  }
])

const handleToolClick = (tool) => {
  console.log('点击工具:', tool.name)
  uni.showToast({
    title: tool.name,
    icon: 'none'
  })
}

onMounted(() => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f5c451ee-9a20-46e5-a996-fe0cc48cf454', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'RecentTools.vue:mounted',
      message: 'recent_tools_icons',
      data: { tools: tools.value.map((item) => ({ name: item.name, icon: item.icon })) },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'pre-fix',
      hypothesisId: 'H4'
    })
  }).catch(() => { })
  // #endregion
})
</script>

<style lang="scss" scoped>
.recent-tools {
  background-color: var(--ds-bg-primary);
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
  transition: all 150ms ease-out;
}

.section-header {
  margin-bottom: 30rpx;
}

.title {
  color: var(--ds-text-primary);
}

.tools-grid {
  justify-content: space-around;
  align-items: center;
}

.tool-item {
  align-items: center;
}

.tool-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.15);
  transition: all 150ms ease-out;

  &:active {
    transform: scale(0.95);
  }
}

.icon-image {
  width: 72rpx;
  height: 72rpx;
}

.tool-name {
  color: var(--ds-text-secondary);
}

/* 深色模式 */
.dark-mode {
  .recent-tools {
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
  }

  .tool-icon {
    box-shadow: 0 8rpx 24rpx rgba(159, 232, 112, 0.15);
  }
}
</style>
