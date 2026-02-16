# EXAM-MASTER 组件文档

> 版本: 1.0.0  
> 更新日期: 2026-02-06

## 目录

1. [基础组件 (base)](#基础组件)
2. [通用组件 (common)](#通用组件)
3. [布局组件 (layout)](#布局组件)
4. [业务组件 (business)](#业务组件)

---

## 基础组件

### BaseButton

**路径**: `src/components/base/BaseButton.vue`

**描述**: 统一风格的按钮组件，支持多种类型和尺寸。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | String | 'primary' | 按钮类型: primary/secondary/text/danger |
| size | String | 'medium' | 尺寸: small/medium/large |
| disabled | Boolean | false | 是否禁用 |
| loading | Boolean | false | 是否显示加载状态 |
| icon | String | '' | 图标（emoji或图标类名） |
| block | Boolean | false | 是否块级按钮 |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| click | event | 点击事件 |

**使用示例**:

```vue
<template>
  <BaseButton type="primary" @click="handleClick">
    提交
  </BaseButton>
  
  <BaseButton type="secondary" size="small" icon="📤">
    上传
  </BaseButton>
  
  <BaseButton :loading="isLoading" block>
    {{ isLoading ? '处理中...' : '确认' }}
  </BaseButton>
</template>
```

---

### BaseCard

**路径**: `src/components/base/BaseCard.vue`

**描述**: 卡片容器组件，提供统一的卡片样式。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | String | '' | 卡片标题 |
| subtitle | String | '' | 副标题 |
| padding | String | 'medium' | 内边距: none/small/medium/large |
| shadow | Boolean | true | 是否显示阴影 |
| hoverable | Boolean | false | 是否有悬停效果 |

**Slots**:

| 插槽 | 说明 |
|------|------|
| default | 卡片内容 |
| header | 自定义头部 |
| footer | 卡片底部 |

**使用示例**:

```vue
<template>
  <BaseCard title="学习统计" subtitle="本周数据">
    <view class="stats">
      <text>做题数: 100</text>
      <text>正确率: 85%</text>
    </view>
    <template #footer>
      <BaseButton size="small">查看详情</BaseButton>
    </template>
  </BaseCard>
</template>
```

---

### BaseInput

**路径**: `src/components/base/BaseInput.vue`

**描述**: 输入框组件，支持多种输入类型。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | String/Number | '' | 绑定值 |
| type | String | 'text' | 输入类型: text/password/number/textarea |
| placeholder | String | '' | 占位文本 |
| disabled | Boolean | false | 是否禁用 |
| maxlength | Number | -1 | 最大长度 |
| clearable | Boolean | false | 是否显示清除按钮 |
| prefix | String | '' | 前缀图标 |
| suffix | String | '' | 后缀图标 |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| update:modelValue | value | 值变化 |
| focus | event | 获得焦点 |
| blur | event | 失去焦点 |
| clear | - | 清除内容 |

**使用示例**:

```vue
<template>
  <BaseInput 
    v-model="searchText" 
    placeholder="搜索题目..."
    prefix="🔍"
    clearable
    @clear="handleClear"
  />
</template>
```

---

## 通用组件

### EmptyState

**路径**: `src/components/common/EmptyState.vue`

**描述**: 统一的空状态组件，支持多种展示模式。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | String | 'simple' | 类型: simple/guide/home |
| theme | String | 'light' | 主题: light/dark/auto |
| size | String | 'medium' | 尺寸: small/medium/large |
| icon | String | '📚' | 图标（emoji） |
| title | String | '暂无数据' | 标题 |
| description | String | '' | 描述文本 |
| showButton | Boolean | true | 是否显示按钮 |
| buttonText | String | '立即添加' | 按钮文本 tonIcon | String | '' | 按钮图标 |
| hint | String | '' | 底部提示 |
| showDecoration | Boolean | true | 是否显示装饰 |
| animated | Boolean | true | 是否启用动画 |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| action | - | 按钮点击（simple/guide模式） |
| upload | - | 上传按钮点击（home模式） |
| quickStart | - | 快速开始点击（home模式） |
| tutorial | - | 教程按钮点击（home模式） |

**使用示例**:

```vue
<template>
  <!-- 简单模式 -->
  <EmptyState 
    icon="📭" 
    title="暂无收藏" 
    description="收藏的题目会显示在这里"
    buttonText="去刷题"
    @action="goToPractice"
  />
  
  <!-- 引导模式 -->
  <EmptyState 
    type="guide"
    theme="dark"
    icon="🎯"
    title="开始你的学习之旅"
    @action="startLearning"
  />
  
  <!-- 首页模式（3个按钮） -->
  <EmptyState 
    type="home"
    @upload="handleUpload"
    @quickStart="handleQuickStart"
    @tutorial="showTutorial"
  />
</template>
```

---

### EmptyGuide

**路径**: `src/components/common/EmptyGuide.vue`

**描述**: 空状态引导组件（建议使用 EmptyState 替代）。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| icon | String | '📚' | 图标 |
| title | String | '暂无数据' | 标题 |
| description | String | '这里空空如也' | 描述 |
| showButton | Boolean | true | 是否显示按钮 |
| buttonIcon | String | '➕' | 按钮图标 |
| buttonText | String | '立即添加' | 按钮文本 |
| hint | String | '' | 底部提示 |
| isDark | Boolean | false | 深色模式 |
| guideType | String | 'default' | 引导类型（用于埋点） |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| action | { type } | 按钮点击 |

---

### LoadingSpinner

**路径**: `src/components/common/LoadingSpinner.vue`

**描述**: 加载动画组件。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| size | String | 'medium' | 尺寸: small/medium/large |
| color | String | 'primary' | 颜色: primary/white/gray |
| text | String | '' | 加载文本 |

**使用示例**:

```vue
<template>
  <LoadingSpinner size="large" text="加载中..." />
</template>
```

---

### SkeletonLoader

**路径**: `src/components/common/SkeletonLoader.vue`

**描述**: 骨架屏加载组件。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | String | 'text' | 类型: text/card/list/avatar |
| rows | Number | 3 | 行数（text类型） |
| animated | Boolean | true | 是否有动画 |

**使用示例**:

```vue
<template>
  <SkeletonLoader v-if="loading" type="card" />
  <ContentCard v-else :data="cardData" />
</template>
```

---

### TodoList

**路径**: `src/components/common/TodoList.vue`

**描述**: 待办事项列表组件。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| items | Array | [] | 待办项列表 |
| showAdd | Boolean | true | 是否显示添加按钮 |
| editable | Boolean | true | 是否可编辑 |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| add | - | 添加待办 |
| toggle | item | 切换完成状态 |
| delete | item | 删除待办 |
| update | item | 更新待办 |

---

## 布局组件

### CustomTabbar

**路径**: `src/components/layout/custom-tabbar/custom-tabbar.vue`

**描述**: 自定义底部导航栏组件。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| current | Number | 0 | 当前选中索引 |
| isDark | Boolean | false | 深色模式 |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| change | index | 切换标签 |

**使用示例**:

```vue
<template>
  <CustomTabbar :current="tabIndex" @change="switchTab" />
</template>
```

---

### SafeAreaBottom

**路径**: `src/components/layout/SafeAreaBottom.vue`

**描述**: 底部安全区域占位组件，适配 iPhone X 等设备。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| height | Number | 0 | 额外高度 |
| bgColor | String | 'transparent' | 背景色 |

---

### PageHeader

**路径**: `src/components/layout/PageHeader.vue`

**描述**: 页面头部组件，包含返回按钮和标题。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | String | '' | 页面标题 |
| showBack | Boolean | true | 是否显示返回按钮 |
| transparent | Boolean | false | 是否透明背景 |
| fixed | Boolean | true | 是否固定定位 |

**Slots**:

| 插槽 | 说明 |
|------|------|
| left | 左侧内容 |
| right | 右侧内容 |

---

## 业务组件

### AiConsult

**路径**: `src/components/business/ai-consult/ai-consult.vue`

**描述**: AI 咨询弹窗组件。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| visible | Boolean | false | 是否显示 |
| title | String | 'AI 助手' | 标题 |
| placeholder | String | '请输入问题...' | 输入框占位 |
| isDark | Boolean | false | 深色模式 |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| update:visible | boolean | 显示状态变化 |
| send | message | 发送消息 |

**使用示例**:

```vue
<template>
  <AiConsult 
    v-model:visible="showAi"
    title="学习助手"
    @send="handleAiMessage"
  />
</template>
```

---

### QuestionCard

**路径**: `src/components/business/QuestionCard.vue`

**描述**: 题目卡片组件，用于展示单个题目。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| question | Object | {} | 题目数据 |
| showAnswer | Boolean | false | 是否显示答案 |
| showAnalysis | Boolean | false | 是否显示解析 |
| selectable | Boolean | true | 是否可选择 |
| selectedAnswer | String | '' | 已选答案 |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| select | answer | 选择答案 |
| favorite | question | 收藏题目 |

---

### MistakeCard

**路径**: `src/components/business/MistakeCard.vue`

**描述**: 错题卡片组件。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| mistake | Object | {} | 错题数据 |
| showActions | Boolean | true | 是否显示操作按钮 |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| review | mistake | 复习错题 |
| master | mistake | 标记已掌握 |
| delete | mistake | 删除错题 |

---

### StudyTimer

**路径**: `src/components/business/StudyTimer.vue`

**描述**: 学习计时器组件。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| autoStart | Boolean | false | 是否自动开始 |
| targetMinutes | Number | 0 | 目标时长（分钟） |

**Events**:

| 事件 | 参数 | 说明 |
|------|------|------|
| start | - | 开始计时 |
| pause | duration | 暂停计时 |
| stop | duration | 停止计时 |
| complete | duration | 达到目标时长 |

---

### RadarChart

**路径**: `src/components/business/RadarChart.vue`

**描述**: 能力雷达图组件，用于展示各科目掌握程度。

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| data | Array | [] | 数据数组 [{name, value}] |
| size | Number | 300 | 图表尺寸（rpx） |
| maxValue | Number | 100 | 最大值 |
| animated | Boolean | true | 是否有动画 |

**使用示例**:

```vue
<template>
  <RadarChart 
    :data="[
      { name: '政治', value: 85 },
      { name: '英语', value: 72 },
      { name: '数学', value: 68 },
      { name: '专业课', value: 90 }
    ]"
    :size="400"
  />
</template>
```

---

## 设计规范

### 颜色变量

```scss
// 主色
--ds-primary: #00a96d;
--ds-primary-light: #00E5FF;

// 文本色
--ds-text-primary: #1a1a1a;
--ds-text-secondary: #64748b;
--ds-text-tertiary: #94a3b8;

// 背景色
--ds-bg-primary: #ffffff;
--ds-bg-secondary: #f8fafc;
--ds-bg-card: #ffffff;

// 边框色
--ds-border-color: rgba(0, 0, 0, 0.1);

// 深色模式
.dark-mode {
  --ds-text-primary: #ffffff;
  --ds-text-secondary: rgba(255, 255, 255, 0.7);
  --ds-bg-primary: #121212;
  --ds-bg-secondary: #1e1e1e;
}
```

### 间距规范

```scss
// 间距
--ds-spacing-xs: 8rpx;
--ds-spacing-sm: 16rpx;
--ds-spacing-md: 24rpx;
--ds-spacing-lg: 32rpx;
--ds-spacing-xl: 48rpx;
```

### 圆角规范

```scss
// 圆角
--ds-radius-sm: 8rpx;
--ds-radius-md: 16rpx;
--ds-radius-lg: 24rpx;
--ds-radius-xl: 32rpx;
--ds-radius-full: 9999rpx;
```

---

## 最佳实践

### 1. 组件引入

```vue
<script>
// 按需引入组件
import EmptyState from '@/components/common/EmptyState.vue';
import BaseButton from '@/components/base/BaseButton.vue';

export default {
  components: {
    EmptyState,
    BaseButton
  }
}
</script>
```

### 2. 主题适配

```vue
<template>
  <view :class="{ 'dark-mode': isDark }">
    <EmptyState :theme="isDark ? 'dark' : 'light'" />
  </view>
</template>

<script>
export default {
  computed: {
    isDark() {
      return this.$store.state.theme === 'dark';
    }
  }
}
</script>
```

### 3. 响应式设计

- 使用 `rpx` 单位确保在不同设备上的一致性
- 使用 Flex 布局实现自适应
- 为小屏幕设备提供简化的 UI

### 4. 性能优化

- 使用 `v-if` 而非 `v-show` 来延迟渲染不常用的组件
- 对列表使用 `v-for` 时添加 `:key`
- 使用 `computed` 缓存计算结果
- 避免在模板中使用复杂表达式
