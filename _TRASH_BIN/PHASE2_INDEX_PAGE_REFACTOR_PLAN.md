# Phase 2: 首页重构计划

## 📅 开始时间
2026年1月24日 00:00

## 🎯 重构目标

### 核心任务
1. **应用双主题设计系统**
   - Light Mode: Wise风格（上白下绿拼接）
   - Dark Mode: Bitget风格（纯黑背景）

2. **学习概况完全重构**
   - 大胶囊卡片容器
   - 3个随机气泡（学习时长、完成率、能力分布）
   - 气泡特性：图标+数据，大小位置随机，防重叠
   - 点击气泡 → 跳转新详情页

3. **高级特效应用**
   - 陀螺仪光晕（Light白色，Dark青蓝）
   - 光晕划过效果
   - 滚动渐入动画
   - 触控反馈

4. **功能100%保留**
   - 所有跳转正常
   - 所有数据计算正常
   - 所有交互正常

---

## 📋 当前首页分析

### 现有组件
1. ✅ 固定顶栏（Logo + 头像）
2. ✅ 考研倒计时卡片
3. ✅ 每日金句卡片
4. ✅ Hot Picks推荐卡片
5. ✅ 邀请好友按钮
6. ✅ 智能刷题入口
7. ✅ 错题本按钮
8. ✅ 今日计划列表
9. ✅ 底部导航栏

### 需要重构的部分
- ❌ Hot Picks卡片 → 改为学习概况气泡卡片
- ❌ 缺少详情页面 → 新建study-detail页面

---

## 🎨 新设计方案

### 学习概况气泡卡片
```vue
<view class="study-overview-capsule ds-card-capsule ds-gyro-light ds-light-sweep">
  <view class="capsule-header">
    <text class="capsule-title">学习概况</text>
    <text class="capsule-arrow">→</text>
  </view>
  
  <view class="bubble-container">
    <!-- 气泡1: 学习时长 -->
    <view class="data-bubble bubble-time" 
          :style="bubbleStyles[0]"
          @tap="navToBubbleDetail('time')">
      <text class="bubble-icon">⏱️</text>
      <text class="bubble-value">{{ todayTime }}</text>
      <text class="bubble-label">今日学习</text>
    </view>
    
    <!-- 气泡2: 完成率 -->
    <view class="data-bubble bubble-progress"
          :style="bubbleStyles[1]"
          @tap="navToBubbleDetail('progress')">
      <text class="bubble-icon">📊</text>
      <text class="bubble-value">{{ accuracy }}%</text>
      <text class="bubble-label">正确率</text>
    </view>
    
    <!-- 气泡3: 能力分布 -->
    <view class="data-bubble bubble-ability"
          :style="bubbleStyles[2]"
          @tap="navToBubbleDetail('ability')">
      <text class="bubble-icon">🎯</text>
      <text class="bubble-value">{{ abilityRank }}</text>
      <text class="bubble-label">能力评级</text>
    </view>
  </view>
</view>
```

### 气泡随机布局算法
```javascript
generateBubbleLayout() {
  const containerWidth = 690 // rpx
  const containerHeight = 400 // rpx
  const bubbles = []
  
  // 气泡配置（大小随机）
  const configs = [
    { minSize: 180, maxSize: 220, name: 'time' },
    { minSize: 140, maxSize: 180, name: 'progress' },
    { minSize: 120, maxSize: 160, name: 'ability' }
  ]
  
  configs.forEach(config => {
    let attempts = 0
    let position = null
    
    // 最多尝试50次找到不重叠的位置
    while (attempts < 50) {
      const size = Math.random() * (config.maxSize - config.minSize) + config.minSize
      const x = Math.random() * (containerWidth - size)
      const y = Math.random() * (containerHeight - size)
      
      position = { x, y, size }
      
      // 检查是否与已有气泡重叠
      if (!this.checkOverlap(position, bubbles)) {
        break
      }
      
      attempts++
    }
    
    bubbles.push({
      name: config.name,
      style: {
        width: position.size + 'rpx',
        height: position.size + 'rpx',
        left: position.x + 'rpx',
        top: position.y + 'rpx'
      }
    })
  })
  
  this.bubbleStyles = bubbles.map(b => b.style)
}

checkOverlap(newPos, existingBubbles) {
  for (let bubble of existingBubbles) {
    const dx = newPos.x - bubble.x
    const dy = newPos.y - bubble.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const minDistance = (newPos.size + bubble.size) / 2 + 20 // 20rpx间距
    
    if (distance < minDistance) {
      return true // 重叠
    }
  }
  return false // 不重叠
}
```

---

## 📄 新建详情页面

### 文件路径
`src/pages/study-detail/index.vue`

### 页面内容
1. **顶部导航** - 返回按钮 + 标题
2. **数据卡片** - 根据type显示不同数据
3. **热力图** - 迁移原有热力图组件
4. **详细统计** - 更多数据展示
5. **底部导航** - 自定义TabBar

### 路由配置
```json
{
  "path": "src/pages/study-detail/index",
  "style": {
    "navigationBarTitleText": "学习详情",
    "enablePullDownRefresh": false
  }
}
```

---

## 🔧 实施步骤

### Step 1: 更新首页 (index.vue)
1. 移除Hot Picks卡片
2. 添加学习概况气泡卡片
3. 实现气泡随机布局算法
4. 添加陀螺仪光晕效果
5. 应用新设计系统CSS变量
6. 添加所有特效类名

### Step 2: 创建详情页 (study-detail/index.vue)
1. 创建页面结构
2. 迁移热力图组件
3. 添加详细数据展示
4. 应用双主题样式
5. 添加返回导航

### Step 3: 更新路由配置 (pages.json)
1. 添加study-detail页面配置

### Step 4: 测试验证
1. 测试所有跳转
2. 测试数据显示
3. 测试主题切换
4. 测试特效效果

---

## ⚠️ 注意事项

### 功能保护
- ✅ 不修改任何数据计算逻辑
- ✅ 不修改任何跳转逻辑
- ✅ 不修改任何事件处理
- ✅ 只修改UI和样式

### 兼容性
- ✅ 小程序：降级为静态布局
- ✅ H5/App：完整特效
- ✅ 条件编译：#ifndef MP

### 性能优化
- ✅ 气泡布局只计算一次
- ✅ 陀螺仪节流50ms
- ✅ 动画使用GPU加速

---

## 📊 预期效果

### Light Mode (Wise)
- 白色背景
- 绿色气泡渐变
- 白色光晕
- 清新简洁

### Dark Mode (Bitget)
- 纯黑背景
- 蓝色气泡渐变
- 青蓝光晕
- 科技沉浸

---

**计划创建时间**: 2026年1月24日 00:00
**预计完成时间**: 30分钟
**风险等级**: 低（只改UI，不改逻辑）
