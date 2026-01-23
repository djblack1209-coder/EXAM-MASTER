# Exam Master UI/UX 交互升级实施计划

## 项目概述
根据 Wise.com 的设计风格，对 Exam Master 考研备考小程序进行全面的 UI/UX 交互升级，包括样式重构、交互反馈增强、数据可视化集成和功能深度重构。

## 实施路线图

### 第一阶段：视觉与基础体验 (Sprint 1)

#### 任务 1：样式重构 - Wise.com 配色系统
**目标**：引入清新的绿色系 + 中性色配色方案，统一应用到全局 CSS 变量

**实施步骤**：
1. 更新 `common/styles/common.scss`，添加 Wise.com 风格变量
2. 替换现有颜色变量为新的配色方案
3. 确保所有组件使用新的 CSS 变量

**技术实现**：
```scss
// common/styles/common.scss

// Wise.com 风格变量
$wise-green: #2ed06e;
$wise-dark-bg: #1a1f26;
$wise-card-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.05);

// 更新现有变量
$primary-color: $wise-green;
$text-primary: #1a1f26;
$text-secondary: #6b7280;
$text-tertiary: #9ca3af;
```

#### 任务 2：增强型顶部导航与时间显示
**目标**：实现“时间+星期”显示，优化头像视觉效果

**实施步骤**：
1. 在 `utils/` 目录下创建 `date.js`，实现优化的时间获取逻辑
2. 更新首页 Header 组件，集成新的时间显示
3. 优化头像样式，添加边框和阴影效果

**技术实现**：
```javascript
// utils/date.js
export const getGreetingTime = () => {
  const date = new Date();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekDay = weekDays[date.getDay()];
  
  let greeting = '';
  if (hours < 12) greeting = '早上好';
  else if (hours < 18) greeting = '下午好';
  else greeting = '晚上好';

  return {
    timeDisplay: `${hours}:${minutes} ${weekDay}`,
    greetingText: greeting
  };
};
```

#### 任务 3：交互反馈增强
**目标**：为所有卡片和按钮添加:active 缩放效果，提升点击体验

**实施步骤**：
1. 在 `common/styles/common.scss` 中添加通用卡片点击下沉效果
2. 为按钮添加点击反馈样式
3. 确保所有交互元素应用新的反馈样式

**技术实现**：
```scss
// common/styles/common.scss

// 通用卡片点击下沉效果
.card-hover-effect {
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  &:active {
    transform: scale(0.98);
    box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.05);
    background-color: darken(#fff, 2%);
  }
}

// 按钮点击反馈
.btn-primary:active {
  filter: brightness(0.9);
  transform: translateY(1px);
}
```

#### 任务 4：骨架屏实现
**目标**：解决页面加载时的“白屏”问题，提升用户体验

**实施步骤**：
1. 创建全局骨架屏组件 `base-skeleton`
2. 在首页集成骨架屏，使用 v-if 控制加载状态
3. 添加骨架屏到渐显内容的过渡动画

**技术实现**：
```vue
<!-- components/base-skeleton/base-skeleton.vue -->
<template>
  <view class="skeleton-container">
    <!-- Header 骨架 -->
    <view class="skeleton-header">
      <view class="skeleton-avatar"></view>
      <view class="skeleton-greeting"></view>
    </view>
    
    <!-- Stats Grid 骨架 -->
    <view class="skeleton-stats">
      <view class="skeleton-stat-item" v-for="i in 3" :key="i">
        <view class="skeleton-stat-value"></view>
        <view class="skeleton-stat-label"></view>
      </view>
    </view>
    
    <!-- TodoList 骨架 -->
    <view class="skeleton-todo" v-for="i in 3" :key="i">
      <view class="skeleton-todo-checkbox"></view>
      <view class="skeleton-todo-text"></view>
    </view>
  </view>
</template>
```

### 第二阶段：核心功能增强 (Sprint 2)

#### 任务 1：任务列表 (Todo List) 升级为 CRUD
**目标**：支持任务的添加、编辑、删除和优先级设置

**实施步骤**：
1. 创建 Pinia Store `stores/todo.js`，实现完整的任务管理逻辑
2. 改造 Todo 组件，支持左滑删除和新增任务弹窗
3. 添加任务优先级选择功能

**技术实现**：
```javascript
// stores/todo.js
import { defineStore } from 'pinia';

export const useTodoStore = defineStore('todo', {
  state: () => ({
    tasks: [] // { id: 1, title: '背单词', done: false, priority: 'high' }
  }),
  actions: {
    addTask(title, priority = 'normal') {
      this.tasks.unshift({
        id: Date.now(),
        title,
        done: false,
        priority
      });
      this.saveToStorage();
    },
    removeTask(id) {
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.saveToStorage();
    },
    toggleTask(id) {
      const task = this.tasks.find(t => t.id === id);
      if (task) task.done = !task.done;
      this.saveToStorage();
    },
    saveToStorage() {
      uni.setStorageSync('my_tasks', this.tasks);
    }
  }
});
```

#### 任务 2：数据可视化集成 - 学习概览卡片
**目标**：引入 uCharts，开发“统计数据卡片”

**实施步骤**：
1. 安装并配置 `qiun-data-charts` 组件
2. 在首页添加“学习概览”卡片组，包含：
   - 刷题正确率环形进度条
   - 本周学习时长迷你柱状图
   - 能力雷达图
3. 确保图表适配深色/浅色模式

**技术实现**：
```vue
<!-- pages/index/index.vue -->
<template>
  <view class="study-overview">
    <!-- 环形进度条 - 正确率 -->
    <qiun-data-charts
      type="ring"
      :chartData="accuracyChartData"
      :canvas2d="true"
      :opts="ringChartOpts"
    />
    
    <!-- 柱状图 - 本周学习时长 -->
    <qiun-data-charts
      type="column"
      :chartData="studyTimeChartData"
      :canvas2d="true"
      :opts="columnChartOpts"
    />
    
    <!-- 雷达图 - 能力分布 -->
    <qiun-data-charts
      type="radar"
      :chartData="abilityRadarData"
      :canvas2d="true"
      :opts="radarChartOpts"
    />
  </view>
</template>
```

#### 任务 3：热力图交互优化
**目标**：为热力图单元格添加点击事件，显示具体日期和学习时长

**实施步骤**：
1. 修改热力图组件，为每个单元格添加 @click 事件
2. 实现点击弹窗 (Tooltip)，显示详细信息
3. 优化热力图的视觉效果

**技术实现**：
```vue
<!-- pages/index/index.vue -->
<template>
  <view class="heatmap-container">
    <view 
      class="hm-cell" 
      v-for="(day, index) in heatMapData" 
      :key="index"
      :style="{ background: getColor(day.count) }"
      @click="showDetail(day)"
    ></view>
    
    <uni-popup ref="popup" type="message">
      <view>{{ currentDay.date }}：学习 {{ currentDay.count }} 分钟</view>
    </uni-popup>
  </view>
</template>
```

### 第三阶段：业务闭环 (Sprint 3)

#### 任务 1：邀请系统实现
**目标**：开发邀请码生成和分享回调逻辑

**实施步骤**：
1. 创建云函数，生成唯一邀请码
2. 在分享功能中携带邀请码参数
3. 实现新用户注册时的邀请关系关联
4. 开发奖励发放逻辑

**技术实现**：
```javascript
// 云函数 - generateInviteCode
'use strict';

exports.main = async (event, context) => {
  const { userId } = event;
  // 生成基于用户ID的唯一邀请码
  const inviteCode = require('crypto')
    .createHash('md5')
    .update(userId)
    .digest('hex')
    .substring(0, 8);
  
  // 保存邀请码到数据库
  await db.collection('user_invites').add({
    userId,
    inviteCode,
    createdAt: new Date()
  });
  
  return { inviteCode };
};
```

#### 任务 2：错题本功能完善
**目标**：实现错题自动入库和错题重做功能

**实施步骤**：
1. 在数据库中创建 `error_book` 表
2. 修改刷题页面逻辑，将错题自动保存到错题本
3. 实现错题重做功能
4. 添加错题分类和统计功能

**技术实现**：
```javascript
// pages/practice/do-quiz.vue
// 答题完成后保存错题
const saveMistakes = async (answers) => {
  const mistakes = answers.filter(answer => !answer.isCorrect);
  if (mistakes.length === 0) return;
  
  // 保存到错题本
  for (const mistake of mistakes) {
    await db.collection('error_book').add({
      userId: userInfo.id,
      questionId: mistake.questionId,
      errorCount: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
};
```

#### 任务 3：学习计划功能
**目标**：新增学习计划制定页面，允许用户设定倒计时目标

**实施步骤**：
1. 创建学习计划页面 `pages/plan/create`
2. 实现计划创建、编辑和删除功能
3. 集成倒计时组件，显示剩余时间
4. 添加计划提醒功能

**技术实现**：
```vue
<!-- pages/plan/create.vue -->
<template>
  <view class="plan-create-page">
    <view class="plan-form">
      <view class="form-item">
        <text class="form-label">计划名称</text>
        <input v-model="planName" placeholder="请输入计划名称" />
      </view>
      
      <view class="form-item">
        <text class="form-label">目标日期</text>
        <picker mode="date" v-model="targetDate">
          <view class="picker-text">{{ targetDate }}</view>
        </picker>
      </view>
      
      <button class="primary-btn" @click="createPlan">创建计划</button>
    </view>
  </view>
</template>
```

## 预期效果

### 视觉效果
1. 清新的绿色系 + 中性色配色方案，符合 Wise.com 设计风格
2. 统一的卡片样式和阴影效果
3. 流畅的动画过渡和交互反馈

### 交互体验
1. 点击时的视觉反馈（轻微缩放和颜色变化）
2. 页面加载时的骨架屏显示
3. 热力图点击时的详情弹窗
4. 流畅的页面切换和内容过渡

### 功能增强
1. 完整的任务管理功能（添加、编辑、删除）
2. 丰富的数据可视化图表
3. 实用的邀请系统和错题本功能
4. 个性化的学习计划制定

## 风险评估与应对策略

1. **风险**：第三方图表库与 uni-app 兼容性问题
   **应对**：选择成熟的 uni-app 生态图表库（qiun-data-charts），并进行充分测试

2. **风险**：样式重构可能影响现有功能
   **应对**：分模块进行样式更新，确保每个模块更新后进行充分测试

3. **风险**：云函数开发和部署复杂性
   **应对**：使用 uniCloud CLI 进行云函数管理，确保开发环境和生产环境一致

4. **风险**：性能问题（特别是在低端设备上）
   **应对**：优化图表渲染，使用虚拟列表处理长列表，减少不必要的重渲染

## 验收标准

1. 所有组件使用新的配色方案，视觉风格统一
2. 页面加载时显示骨架屏，无白屏现象
3. 所有交互元素有明确的点击反馈
4. 任务管理功能完整可用
5. 数据可视化图表正常显示
6. 邀请系统和错题本功能正常工作
7. 学习计划功能符合设计要求
8. 应用在各种设备上性能良好，无明显卡顿

## 开发工具与环境

1. **开发工具**：HBuilderX、Visual Studio Code、微信开发者工具
2. **技术栈**：Vue 3、uni-app、Pinia、SCSS、Vite
3. **构建命令**：
   - 开发：`npm run dev:mp-weixin`
   - 构建：`npm run build:mp-weixin`
4. **测试环境**：微信开发者工具模拟器 + 真实设备测试

## 后续优化建议

1. **性能监控**：集成性能监控工具，实时监控应用性能
2. **用户反馈收集**：添加用户反馈功能，收集用户对新设计的意见
3. **A/B 测试**：对不同设计方案进行 A/B 测试，选择最优方案
4. **国际化支持**：考虑添加多语言支持，扩大用户群体
5. **小程序码分享**：优化分享功能，支持生成个性化小程序码

---

**计划制定时间**：2026-01-21
**计划版本**：1.0
**预计完成时间**：3 个 Sprint（约 3 周）