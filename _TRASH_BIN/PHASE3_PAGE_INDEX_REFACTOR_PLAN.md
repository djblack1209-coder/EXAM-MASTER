# 首页重构计划 - src/pages/index/index.vue

## 📋 重构目标

### 1. 视觉优化
- ✅ 应用完整设计系统（CSS变量已存在）
- ✅ 统一卡片样式（圆角、阴影、间距）
- ✅ 优化深色模式（已有基础，需增强）
- ✅ 添加Wise-style滚动动画

### 2. 滚动动画规范
```scss
// H5/App 完整效果
.scroll-item {
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.scroll-item.in-view {
  opacity: 1;
  transform: translateY(0);
}

// 小程序降级（简单fade）
#ifdef MP-WEIXIN
.scroll-item {
  animation: simpleFade 0.5s ease-out forwards;
}
#endif
```

### 3. 无障碍增强
- ✅ 确保所有触控区域 ≥ 44×44px
- ✅ 文字对比度符合WCAG AA标准
- ✅ 支持减少动画（prefers-reduced-motion）

### 4. 功能保护
- ✅ Template结构100%不变
- ✅ Script逻辑100%不变
- ✅ 所有事件处理保持不变
- ✅ 数据流保持不变

---

## 🎯 重构范围

### Template（不改）
- ✅ 保持所有v-if、v-for、:key
- ✅ 保持所有@click、@tap事件
- ✅ 保持所有:class、:style绑定
- ✅ 保持所有组件引用

### Script（不改）
- ✅ 保持所有data、computed、methods
- ✅ 保持所有生命周期钩子
- ✅ 保持所有store集成
- ✅ 保持所有API调用

### Style（重构重点）
- ✅ 优化CSS变量使用
- ✅ 添加滚动动画
- ✅ 统一卡片样式
- ✅ 增强深色模式
- ✅ 添加无障碍支持

---

## 📝 重构步骤

### Step 1: 添加滚动动画基础
```scss
// 全局滚动行为
scroll-view {
  scroll-behavior: smooth;
}

// 动画基础类
.fade-in-up {
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-in-up.in-view {
  opacity: 1;
  transform: translateY(0);
}

// Stagger延迟
.fade-in-up:nth-child(1) { transition-delay: 0.1s; }
.fade-in-up:nth-child(2) { transition-delay: 0.2s; }
.fade-in-up:nth-child(3) { transition-delay: 0.3s; }
```

### Step 2: 优化卡片样式
```scss
.glass-card {
  background: var(--ds-bg-primary);
  border: 1px solid var(--ds-border-color);
  border-radius: var(--ds-card-radius, 12px);
  box-shadow: var(--ds-card-shadow);
  transition: all 150ms ease-out;
}

.glass-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ds-card-shadow-hover);
}
```

### Step 3: 增强深色模式
```scss
.dark-mode {
  --ds-bg-primary: #1c1c1e;
  --ds-bg-secondary: #2c2c2e;
  --ds-text-primary: #ffffff;
  --ds-text-secondary: #8e8e93;
  --ds-border-color: #3a3a3c;
  --ds-card-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
```

### Step 4: 添加无障碍支持
```scss
// 减少动画支持
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

// 触控目标最小尺寸
.touchable {
  min-width: 44px;
  min-height: 44px;
}
```

---

## ✅ 验证清单

### 功能验证
- [ ] 所有卡片可点击
- [ ] 数据统计正确显示
- [ ] 热力图交互正常
- [ ] 任务列表可切换
- [ ] 深色模式切换正常
- [ ] 滚动流畅无卡顿

### 视觉验证
- [ ] 卡片样式统一
- [ ] 间距符合8px Grid
- [ ] 圆角统一（12px）
- [ ] 阴影层次清晰
- [ ] 深色模式对比度足够

### 动画验证
- [ ] H5滚动动画流畅
- [ ] 小程序降级正常
- [ ] Stagger延迟合理
- [ ] 无性能问题

### 无障碍验证
- [ ] 触控区域≥44px
- [ ] 文字对比度≥4.5:1
- [ ] 减少动画模式生效
- [ ] 键盘导航正常

---

## 🚨 风险控制

### 高风险区域
1. **滚动动画** - 可能影响性能
   - 解决：使用CSS transform，避免layout
   - 降级：小程序使用简单fade

2. **深色模式** - 可能影响可读性
   - 解决：确保对比度≥4.5:1
   - 测试：使用对比度检查工具

3. **卡片样式** - 可能影响布局
   - 解决：使用box-sizing: border-box
   - 测试：多设备测试

### 回滚策略
- 保留原始文件备份
- 分步提交，便于回滚
- 每步验证后再继续

---

## 📊 预期效果

### 性能指标
- FPS: ≥ 55fps（滚动时）
- 首屏加载: ≤ 1.5s
- 动画流畅度: 无掉帧

### 用户体验
- 视觉统一性: 100%
- 交互流畅度: 优秀
- 深色模式: 完美适配
- 无障碍: WCAG AA标准

---

**重构原则：稳定第一，体验第二，性能第三**
