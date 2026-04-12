# 3D 立体卡通 UI 重构设计文档

> 日期: 2026-04-12 | 状态: 已批准 | 风格: 3D Cartoon (Duolingo-inspired)

## 概述

将 EXAM-MASTER 前端从「Apple 毛玻璃」风格全面重构为「3D 立体卡通」风格，参考 uiverse.io 设计理念。分 4 批推进，本文档定义第 1 批：设计令牌 + 原子组件。

## 设计原则

1. **物理隐喻**：按钮像实体按键（有厚度，按下去会陷），卡片像浮在桌面上的纸牌
2. **鲜明色彩**：纯色为主，不用渐变和透明度
3. **弹性动效**：所有交互反馈用 spring 弹性曲线，不用线性过渡
4. **大圆角**：统一 16rpx~24rpx 圆角，按钮用胶囊形
5. **粗体排印**：标题 700，正文 600，弱化文字 400

## 色彩系统

### 亮色模式

| Token              | 色值      | 3D 阴影色 | 用途             |
| ------------------ | --------- | --------- | ---------------- |
| `--em3d-primary`   | `#58cc02` | `#46a302` | 主操作           |
| `--em3d-secondary` | `#1cb0f6` | `#1899d6` | 次要操作/信息    |
| `--em3d-danger`    | `#ff4b4b` | `#e63946` | 危险/删除        |
| `--em3d-warning`   | `#ffc800` | `#e6b400` | 警告             |
| `--em3d-purple`    | `#ce82ff` | `#a855f7` | AI 功能          |
| `--em3d-bg`        | `#f7f7f7` | —         | 页面背景         |
| `--em3d-card-bg`   | `#ffffff` | —         | 卡片背景         |
| `--em3d-border`    | `#e5e5e5` | —         | 边框             |
| `--em3d-text-1`    | `#3c3c3c` | —         | 主文字           |
| `--em3d-text-2`    | `#777777` | —         | 次文字           |
| `--em3d-text-3`    | `#afafaf` | —         | 弱文字           |
| `--em3d-text-inv`  | `#ffffff` | —         | 反色文字(按钮上) |

### 暗色模式

| Token                          | 色值      | 3D 阴影色 |
| ------------------------------ | --------- | --------- |
| `--em3d-bg`                    | `#1b1b1b` | —         |
| `--em3d-card-bg`               | `#2a2a2a` | —         |
| `--em3d-border`                | `#3a3a3a` | —         |
| `--em3d-text-1`                | `#f0f0f0` | —         |
| `--em3d-text-2`                | `#a0a0a0` | —         |
| `--em3d-text-3`                | `#666666` | —         |
| 功能色保持不变，阴影色加深 20% |           |           |

## 组件规格

### 1. 按钮 `.em3d-btn`

4 种变体：`primary` / `secondary` / `danger` / `ghost`

```
高度: 88rpx (大) / 72rpx (中) / 56rpx (小)
圆角: 999rpx (胶囊)
底部阴影: 0 6rpx 0 <shadow-color>
文字: 700 weight, 30rpx (大) / 28rpx (中) / 24rpx (小)
按下态: translateY(4rpx), shadow 缩为 0 2rpx 0
过渡: all 0.1s ease
禁用态: opacity 0.5, pointer-events none
加载态: 文字替换为旋转 spinner
```

### 2. 输入框 `.em3d-input`

```
高度: 88rpx
圆角: 16rpx
边框: 2rpx solid var(--em3d-border)
背景: var(--em3d-card-bg)
内阴影: inset 0 2rpx 4rpx rgba(0,0,0,0.06)
聚焦: border-color var(--em3d-primary), 外发光 0 0 0 6rpx rgba(88,204,2,0.15)
文字: 28rpx, 400 weight
placeholder: var(--em3d-text-3)
```

### 3. 开关 `.em3d-switch`

```
轨道: 104rpx × 56rpx, 圆角 28rpx
关闭: bg #e5e5e5, border 2rpx solid #d0d0d0
开启: bg var(--em3d-primary), border var(--em3d-primary-shadow)
滑块: 48rpx 圆形, 白色, box-shadow 0 4rpx 0 rgba(0,0,0,0.08)
滑块移动: 左0 → 右48rpx, transition 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)
```

### 4. 复选框 `.em3d-checkbox`

```
尺寸: 44rpx × 44rpx
未选: bg white, border 2rpx solid var(--em3d-border), 圆角 10rpx
选中: bg var(--em3d-primary), border var(--em3d-primary-shadow)
勾号: 白色 SVG, 选中时 scale(0→1.2→1) 弹性动画 0.3s
3D: box-shadow 0 3rpx 0 var(--em3d-border)
```

### 5. 单选按钮 `.em3d-radio`

```
尺寸: 44rpx × 44rpx, 圆形
未选: bg white, border 2rpx solid var(--em3d-border)
选中: border var(--em3d-primary), 内圆 24rpx 绿色 scale 弹入
3D: box-shadow 0 3rpx 0 var(--em3d-border)
```

### 6. 卡片 `.em3d-card`

```
背景: var(--em3d-card-bg)
边框: 2rpx solid var(--em3d-border)
圆角: 24rpx
阴影: 0 4rpx 0 var(--em3d-border)
内边距: 32rpx
```

替代现有: `apple-glass-card`, `apple-group-card`, `glass-card`, `card`

## 分批计划

| 批次         | 内容                                                       | 依赖    |
| ------------ | ---------------------------------------------------------- | ------- |
| **1 (本批)** | 设计令牌 + 按钮 + 输入框 + 开关 + 复选框 + 单选 + 卡片基础 | 无      |
| 2            | 弹窗/模态框 + 加载动画 + 工具提示 + 徽章 + 标签            | 批次1   |
| 3            | TabBar + 导航栏 + 骨架屏 + 空状态 + 表单组合               | 批次1-2 |
| 4            | 38 个页面逐页适配                                          | 批次1-3 |

## 兼容性约束

- 所有 CSS 必须兼容微信小程序 WebView（Android 5.0+）
- 不使用 `backdrop-filter`（改为纯色背景 + border）
- 不使用 CSS `gap`（改用 margin）
- `<div>` → `<view>`, `<span>` → `<text>`
- 动画优先 `transform` + `opacity`（GPU 加速）
