# Bitget Wallet Hot Picks 风格实现计划

## 已完成功能 ✅

### 1. 首页胶囊卡片优化
- ✅ 添加陀螺仪光晕效果（capsuleStyle 和 glowStyle）
- ✅ 优化陀螺仪灵敏度（角度限制在 ±10度）
- ✅ 添加气泡点击跳转功能（navToBubbleDetail 方法）
- ✅ 三个气泡可独立点击，跳转到详情页面

### 2. 陀螺仪效果细节
- 卡片跟随设备倾斜产生 3D 透视效果
- 光晕位置随陀螺仪移动
- 平滑过渡动画（0.1s ease-out）

## 待实现功能 📋

### 3. 学习详情页面增强
- [ ] 将首页热力图移动到详情页
- [ ] 添加三个数据维度的详细展示：
  - 学习时长详情（时间趋势图）
  - 正确率详情（准确率分析）
  - 能力分布详情（雷达图/柱状图）
- [ ] 根据 URL 参数显示对应的详细数据

### 4. 深色/浅色模式适配
- [ ] 深色模式：渐变黑色胶囊 + 透明气泡 + 白色文字 + 浅蓝色数据
- [ ] 浅色模式（绿色背景）：白色胶囊 + 光晕划过效果 + 黑色文字
- [ ] 浅色模式（白色背景）：渐变绿色胶囊 + 光晕划过效果 + 白色文字

### 5. 卡片尺寸优化
- [ ] 确保卡片在首页不突兀
- [ ] 控制卡片宽度和高度，适配不同屏幕

## 需要的图标清单 🎨

根据当前设计，气泡使用的是 Emoji 图标：
- ⏱️ 学习时长
- ✓ 正确率  
- ⭐ 能力评级

如果需要更专业的图标，请提供以下图标：
1. **时钟图标** - 用于学习时长气泡
2. **对勾图标** - 用于正确率气泡
3. **星星/奖杯图标** - 用于能力评级气泡

## 技术实现细节

### 陀螺仪实现
```javascript
startGyroscope() {
  uni.startAccelerometer({
    interval: 'game',
    success: () => {
      uni.onAccelerometerChange((res) => {
        let x = res.x * 15; // 左右倾斜
        let y = res.y * 15; // 前后倾斜
        
        // 限制角度
        x = Math.max(-10, Math.min(10, x));
        y = Math.max(-10, Math.min(10, y));
        
        // 更新样式
        this.capsuleStyle = {
          transform: `perspective(1000px) rotateX(${-y}deg) rotateY(${x}deg)`,
          transition: 'transform 0.1s ease-out'
        };
        
        this.glowStyle = {
          transform: `translate(${x * 3}px, ${y * 3}px)`,
          transition: 'transform 0.1s ease-out'
        };
      });
    }
  });
}
```

### 气泡点击跳转
```javascript
navToBubbleDetail(type) {
  this.navToPage(`/src/pages/study-detail/index?type=${type}`);
}
```

## 下一步行动

1. **优先级 P0**：完善学习详情页面
   - 接收 URL 参数（type: time/accuracy/ability）
   - 根据参数显示对应的详细数据
   - 添加热力图组件

2. **优先级 P1**：主题模式适配
   - 实现深色/浅色模式的视觉差异
   - 添加光晕划过动画

3. **优先级 P2**：图标优化
   - 如果需要，替换 Emoji 为专业图标

## 设计参考

参考 Bitget Wallet 的 Hot Picks 设计：
- 胶囊形状的卡片容器
- 内部气泡随机分布（大小不一）
- 陀螺仪光晕跟随效果
- 点击气泡查看详细数据
- 深色模式下的渐变黑色背景
- 浅色模式下的光晕划过效果
