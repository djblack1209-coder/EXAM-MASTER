<template>
  <view class="bottom-navbar">
    <view 
      class="nav-item"
      :class="{ active: currentTab === 'home' }"
      @tap="switchTab('home')"
    >
      <view class="nav-icon home-icon"></view>
      <text class="nav-text">首页</text>
    </view>
    <view 
      class="nav-item"
      :class="{ active: currentTab === 'practice' }"
      @tap="switchTab('practice')"
    >
      <view class="nav-icon check-icon"></view>
      <text class="nav-text">刷题</text>
    </view>
    <view 
      class="nav-item"
      :class="{ active: currentTab === 'school' }"
      @tap="switchTab('school')"
    >
      <view class="nav-icon school-icon"></view>
      <text class="nav-text">择校</text>
    </view>
    <view 
      class="nav-item"
      :class="{ active: currentTab === 'settings' }"
      @tap="switchTab('settings')"
    >
      <view class="nav-icon settings-icon"></view>
      <text class="nav-text">设置</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 当前选中的标签
const currentTab = ref('home')

// 切换标签
const switchTab = (tab) => {
  // 如果当前已经是该标签，不执行跳转
  if (currentTab.value === tab) return
  
  currentTab.value = tab
  const pages = {
    home: '/src/pages/index/index',
    practice: '/src/pages/practice/index',
    school: '/src/pages/school/index',
    settings: '/src/pages/profile/index'
  }
  
  // 使用reLaunch替代switchTab，因为我们已经移除了原生tabBar配置
  // reLaunch会关闭所有页面，打开指定页面，适合tab切换场景
  uni.reLaunch({
    url: pages[tab],
    fail: (err) => {
      console.error('页面跳转失败:', err)
      // 如果reLaunch失败，尝试使用navigateTo（但会保留页面栈）
      uni.navigateTo({
        url: pages[tab],
        fail: () => {
          console.error('所有跳转方式都失败了')
        }
      })
    }
  })
}

// 更新选中状态的函数
const updateCurrentTab = () => {
  try {
    const pages = getCurrentPages()
    if (pages && pages.length > 0) {
      const currentPage = pages[pages.length - 1]
      const route = currentPage.route
      
      if (route === 'pages/index/index') currentTab.value = 'home'
      else if (route === 'pages/practice/index') currentTab.value = 'practice'
      else if (route === 'pages/school/index') currentTab.value = 'school'
      else if (route === 'pages/profile/index') currentTab.value = 'settings'
    }
  } catch (e) {
    console.error('更新导航栏状态失败:', e)
  }
}

// 页面加载时获取当前页面路径，设置初始选中状态
onMounted(() => {
  updateCurrentTab()
  
  // 监听页面显示事件
  uni.onShow && uni.onShow(() => {
    updateCurrentTab()
  })
})
</script>

<style lang="scss" scoped>
.bottom-navbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 60px;
  background: #FFFFFF;
  border-top: 1px solid rgba(229, 231, 235, 0.5);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  z-index: 999;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  
  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    -webkit-tap-highlight-color: transparent;
    padding: 4px 0;
    
    .nav-icon {
      width: 24px;
      height: 24px;
      position: relative;
      transition: all 0.2s ease;
      
      /* 首页图标 - 房屋 (纯CSS) */
      &.home-icon {
        width: 20px;
        height: 18px;
        position: relative;
        
        /* 房屋主体 */
        &::before {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 0;
          width: 14px;
          height: 10px;
          border: 2px solid #9CA3AF;
          border-top: none;
          border-radius: 0 0 2px 2px;
          background: transparent;
        }
        
        /* 屋顶 */
        &::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          top: 0;
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 10px solid #9CA3AF;
        }
      }
      
      /* 刷题图标 - 带对勾的书籍 */
      &.check-icon {
        width: 20px;
        height: 16px;
        position: relative;
        
        /* 书籍主体 */
        &::before {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 0;
          width: 16px;
          height: 12px;
          border: 2px solid #9CA3AF;
          border-radius: 2px;
        }
        
        /* 对勾 */
        &::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          top: 4px;
          width: 6px;
          height: 6px;
          border: 2px solid #9CA3AF;
          border-top: none;
          border-left: none;
          transform: translateX(-50%) rotate(45deg);
        }
      }
      
      /* 择校图标 - 学士帽 */
      &.school-icon {
        width: 20px;
        height: 16px;
        position: relative;
        
        /* 帽子底部 */
        &::before {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 0;
          width: 16px;
          height: 8px;
          border: 2px solid #9CA3AF;
          border-bottom: none;
          border-radius: 0;
        }
        
        /* 帽子顶部 */
        &::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          top: 0;
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 10px solid #9CA3AF;
        }
      }
      
      /* 设置图标 - 齿轮 (Settings/Cog/Gear) */
      &.settings-icon {
        width: 18px;
        height: 18px;
        position: relative;
        
        /* 齿轮外圈 */
        &::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 18px;
          height: 18px;
          border: 2px solid #9CA3AF;
          border-radius: 50%;
          background: transparent;
        }
        
        /* 齿轮内部十字线 */
        &::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 2px;
          height: 6px;
          background: #9CA3AF;
          box-shadow: 
            0 8px 0 0 #9CA3AF,
            -4px 4px 0 0 #9CA3AF,
            4px 4px 0 0 #9CA3AF;
        }
      }
    }
    
    /* 激活状态下的图标颜色 - 实心/填充 */
    &.active .nav-icon {
      &.home-icon {
        /* 激活状态：实心填充 */
        &::before {
          border-color: #07C160;
          background: #07C160;
        }
        &::after {
          border-bottom-color: #07C160;
        }
      }
      
      &.check-icon {
        /* 激活状态：实心填充 */
        &::before {
          border-color: #07C160;
          background: #07C160;
        }
        &::after {
          border-color: #07C160;
        }
      }
      
      &.school-icon {
        /* 激活状态：实心填充 */
        &::before {
          border-color: #07C160;
          background: #07C160;
        }
        &::after {
          border-bottom-color: #07C160;
        }
      }
      
      &.settings-icon {
        /* 激活状态：实心填充 */
        &::before {
          border-color: #07C160;
          background: #07C160;
        }
        &::after {
          background: #FFFFFF;
          box-shadow: 
            0 8px 0 0 #FFFFFF,
            -4px 4px 0 0 #FFFFFF,
            4px 4px 0 0 #FFFFFF;
        }
      }
    }
    
    .nav-text {
      font-size: 10px;
      font-weight: 400;
      color: #9CA3AF;
      -webkit-font-smoothing: antialiased;
      transition: color 0.2s ease;
      margin-top: 4px;
    }
    
    /* 激活状态 */
    &.active .nav-text {
      color: #07C160;
      font-weight: 600;
    }
  }
}
</style>
