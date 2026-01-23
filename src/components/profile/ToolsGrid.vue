<template>
  <view class="tools-section">
    <view class="section-title">工具功能</view>
    
    <view class="tools-grid">
      <view 
        v-for="tool in tools" 
        :key="tool.id"
        class="tool-item"
        @click="handleToolClick(tool)"
      >
        <view class="tool-icon">{{ tool.icon }}</view>
        <text class="tool-name">{{ tool.name }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const tools = ref([
  {
    id: 1,
    name: '作文功能句',
    icon: '📖',
    color: '#52C41A'
  },
  {
    id: 2,
    name: '高等数学计算器',
    icon: '🔢',
    color: '#52C41A'
  }
])

const handleToolClick = (tool) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/f5c451ee-9a20-46e5-a996-fe0cc48cf454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ToolsGrid.vue:handleToolClick',message:'tool_click',data:{toolId:tool.id,toolName:tool.name},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H7'})}).catch(()=>{});
  // #endregion
  uni.showToast({
    title: `打开${tool.name}`,
    icon: 'none'
  })
}
</script>

<style lang="scss" scoped>
.tools-section {
  margin: 0 24rpx 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 24rpx;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.tool-item {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
  
  &:active {
    transform: scale(0.98);
  }
}

.tool-icon {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #52C41A 0%, #73D13D 100%);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.tool-name {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
  flex: 1;
}
</style>
