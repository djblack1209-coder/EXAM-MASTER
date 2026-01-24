# Phase 2: 设置页重构计划

## 📅 创建时间
2026年1月24日 00:11

## 🎯 重构目标
将首页气泡卡片的像素完美标准应用到设置页，实现Wise+Apple顶级质感。

---

## 📊 当前状态分析

### 优点 ✅
- ✅ 已有双主题支持（Wise/Bitget）
- ✅ 用户信息卡片设计现代（渐变背景）
- ✅ 登录功能完整（头像+昵称）
- ✅ AI导师对话功能
- ✅ 设置选项齐全

### 待优化 ⚠️
- ⚠️ 文字间距不统一（缺少line-height 1.5）
- ⚠️ 部分元素对齐不完美
- ⚠️ 缺少陀螺仪光晕效果
- ⚠️ 缺少滚动渐入动画
- ⚠️ 8px网格间距需检查
- ⚠️ 登录保护需强化

---

## 🎨 重构重点

### 1. 用户信息卡片优化 ✨
**当前状态**:
- 渐变绿色背景 ✅
- 头像+昵称+报考信息 ✅
- 统计数据（坚持天数、目标院校）✅

**优化方案**:
```css
/* 添加陀螺仪光晕 */
.user-card.wise-card::before {
  /* 已有，保持 */
}

/* 优化文字间距 */
.nickname-input {
  line-height: 1.5;          /* 添加 */
  letter-spacing: -0.5px;    /* 已有 */
}

.info-label {
  line-height: 1.5;          /* 添加 */
  letter-spacing: 0.5px;     /* 已有 */
}

.info-value {
  line-height: 1.5;          /* 添加 */
}

.stat-label {
  line-height: 1.5;          /* 添加 */
  letter-spacing: 0.3px;     /* 已有 */
}
```

---

### 2. 文字间距标准化 📝
**应用首页标准**:
- ✅ 标题：line-height 1.5 + letter-spacing 0.5rpx
- ✅ 正文：line-height 1.5 + letter-spacing 0.3rpx
- ✅ 数值：line-height 1.2 + letter-spacing -0.5px
- ✅ 标签：line-height 1.5 + letter-spacing 0.3rpx

**需要优化的元素**:
1. `.nav-title` - 页面标题
2. `.section-title` - 区块标题
3. `.tutor-name` - 导师名称
4. `.tutor-role` - 导师角色
5. `.setting-title` - 设置标题
6. `.setting-desc` - 设置描述

---

### 3. 内容对齐完美化 🎯
**对齐标准**:
```css
/* 所有flex容器 */
.flex-container {
  display: flex;
  align-items: center;      /* 垂直居中 */
  justify-content: center;  /* 水平居中（如需要）*/
}

/* 所有文字 */
.text-element {
  text-align: center;       /* 居中文字（如需要）*/
}
```

**需要检查的元素**:
- ✅ 用户信息卡片内容
- ✅ AI导师列表
- ✅ 设置选项列表
- ✅ 按钮对齐

---

### 4. 8px网格间距 📏
**检查清单**:
- [ ] 卡片padding: 32rpx（16px）或24rpx（12px）
- [ ] 元素间距: 24rpx（12px）、16rpx（8px）、8rpx（4px）
- [ ] section间距: 48rpx（24px）
- [ ] 卡片margin: 32rpx（16px）或24rpx（12px）

**当前间距**:
- 用户卡片padding: 20px → 改为24rpx（12px）✅
- section margin: 24px → 改为48rpx（24px）⚠️
- 卡片间距: 20px → 改为32rpx（16px）⚠️

---

### 5. 陀螺仪光晕效果 💫
**实现方案**:
```css
/* 用户卡片光晕（已有，保持）*/
.user-card.wise-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.user-card.wise-card:hover::before {
  opacity: 1;
}

/* 其他卡片添加光晕 */
.friend-entry-card::before,
.tutor-list::before,
.settings-list::before {
  /* 同样的光晕效果 */
}
```

---

### 6. 滚动渐入动画 🎬
**实现方案**:
```css
/* 所有卡片添加动画 */
.user-card,
.friend-entry-card,
.tutor-list,
.settings-list {
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;
}

/* 延迟动画 */
.user-card {
  animation-delay: 0.1s;
}

.friend-entry-card {
  animation-delay: 0.2s;
}

.tutor-list {
  animation-delay: 0.3s;
}

.settings-list {
  animation-delay: 0.4s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

### 7. 登录保护强化 🔒
**当前逻辑**:
- ✅ 未登录显示"点击登录"徽章
- ✅ 点击头像可选择头像
- ✅ 输入昵称完成登录

**优化方案**:
- ✅ 保持现有逻辑（已经很好）
- ✅ 未登录时禁止默认头像（已实现）
- ✅ 强化登录提示（已有modal）

---

## 📋 实施步骤

### Step 1: 文字间距优化
```css
/* 添加到所有文字元素 */
line-height: 1.5;
letter-spacing: 0.3-0.5rpx;
```

### Step 2: 8px网格间距
```css
/* 统一所有间距 */
padding: 24rpx / 32rpx;
margin: 24rpx / 32rpx / 48rpx;
gap: 16rpx / 24rpx;
```

### Step 3: 添加动画
```css
/* 所有卡片 */
animation: fadeInUp 0.5s ease-out forwards;
animation-delay: 0.1s-0.4s;
```

### Step 4: 添加光晕
```css
/* 所有可交互卡片 */
::before { /* 光晕效果 */ }
```

---

## ✅ 完成标准

### 功能完整性
- ✅ 所有原有功能100%保留
- ✅ 登录流程正常
- ✅ AI对话正常
- ✅ 设置功能正常

### 视觉质感
- ✅ 文字间距舒适（line-height 1.5）
- ✅ 内容完美对齐
- ✅ 8px网格间距
- ✅ 陀螺仪光晕效果
- ✅ 滚动渐入动画

### 双主题适配
- ✅ Light Mode（Wise风格）
- ✅ Dark Mode（Bitget风格）

---

## 🎯 预期效果

### Light Mode（Wise风格）
- 白色背景 + 绿色渐变卡片
- 清新自然、护眼舒适
- 文字清晰、对齐完美
- 光晕柔和、动画流畅

### Dark Mode（Bitget风格）
- 深绿背景 + 深蓝渐变卡片
- 科技感十足、专业高效
- 文字清晰、对比度高
- 光晕青蓝、动画流畅

---

**Phase 2 设置页重构计划完成时间**: 2026年1月24日 00:11
**预计完成度**: 100%
**功能完整性**: 100%
**视觉还原度**: 95%+

🚀 准备开始重构！
