<template>
  <view class="recent-tools">
    <view class="section-header">
      <text class="title">最近</text>
    </view>
    
    <view class="tools-grid">
      <view 
        class="tool-item" 
        v-for="tool in tools" 
        :key="tool.id"
        @tap="handleToolClick(tool)"
      >
        <view class="tool-icon" :style="{ background: tool.bgColor }">
          <image class="icon-image" :src="tool.iconUrl" mode="aspectFit" />
        </view>
        <text class="tool-name">{{ tool.name }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

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
  fetch('http://127.0.0.1:7242/ingest/f5c451ee-9a20-46e5-a996-fe0cc48cf454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RecentTools.vue:mounted',message:'recent_tools_icons',data:{tools:tools.value.map(item=>({name:item.name,icon:item.icon}))},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
})
</script>

<style lang="scss" scoped>
.recent-tools {
  background-color: #FFFFFF;
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  margin-bottom: 30rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
}

.tools-grid {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15rpx;
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
  transition: transform 0.3s ease;
  
  &:active {
    transform: scale(0.95);
  }
}

.icon-image {
  width: 72rpx;
  height: 72rpx;
}

.tool-name {
  font-size: 24rpx;
  color: #666666;
}
</style>
