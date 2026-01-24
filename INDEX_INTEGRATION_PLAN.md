# 首页功能接入计划

## 📋 当前状态

### ✅ 已完成
- 首页UI完全重构（Wise/Bitget双主题）
- 8个核心模块的视觉设计
- TodoList组件状态管理
- 主题切换功能

### 🎯 待接入功能

## 1. 统计卡片数据接入

### 当前状态
```javascript
// 硬编码的模拟数据
totalQuestions: 1234,
finishedCount: 23,
accuracy: 78.5,
totalStudyDays: 14,
achievementCount: 23
```

### 目标方案
```javascript
// 从 useStudyStore 获取真实数据
import { useStudyStore } from '../../stores/modules/study'

const studyStore = useStudyStore()

// 映射关系
totalQuestions: studyStore.studyProgress.totalQuestions
finishedCount: studyStore.studyProgress.completedQuestions
accuracy: studyStore.accuracy (computed)
totalStudyDays: studyStore.studyProgress.studyDays
achievementCount: 从本地存储或新建Store获取
```

### 实施步骤
1. 在 `onLoad` 中初始化 studyStore
2. 调用 `studyStore.restoreProgress()` 恢复数据
3. 使用 computed 属性映射数据
4. 添加数据刷新逻辑（onShow）

---

## 2. 待办事项数据接入

### 当前状态
```javascript
// 硬编码的3条待办
todos: [
  { id: 1, text: '复习数学第三章', completed: false, priority: 'Priority' },
  { id: 2, text: '完成物理作业', completed: false, priority: 'Important' },
  { id: 3, text: '准备英语演讲', completed: false, priority: 'Normal' }
]
```

### 目标方案
```javascript
// 从 useTodoStore 获取真实数据
import { useTodoStore } from '../../stores/modules/todo'

const todoStore = useTodoStore()

// 映射关系
todos: computed(() => todoStore.tasks.map(task => ({
  id: task.id,
  text: task.title,
  completed: task.done,
  priority: task.tag || task.priority
})))
```

### 实施步骤
1. 在 `onLoad` 中初始化 todoStore
2. 调用 `todoStore.initTasks()` 加载数据
3. 使用 computed 属性映射数据格式
4. 修改 `handleToggleTodo` 调用 `todoStore.toggleTask()`

---

## 3. 知识点气泡数据接入

### 当前状态
```javascript
// 硬编码的6个知识点
knowledgePoints: [
  { id: 1, title: '错题集', count: 156, icon: '🎯', mastery: 35, color: '#EF4444' },
  { id: 2, title: '热门考点', count: 89, icon: '🔥', mastery: 45, color: '#F59E0B' },
  // ...
]
```

### 目标方案
```javascript
// 方案A: 从错题本数据计算
import { storageService } from '../../services/storageService'

async loadKnowledgePoints() {
  const mistakes = await storageService.getMistakes(1, 999)
  // 按科目/章节分组统计
  // 计算掌握度
}

// 方案B: 创建新的 knowledgeStore
// 存储用户的知识点掌握情况
```

### 实施步骤
1. 决定数据来源（错题本 or 新Store）
2. 实现数据加载逻辑
3. 计算掌握度（mastery）
4. 动态分配颜色和图标

---

## 4. 学习轨迹数据接入

### 当前状态
```javascript
// 硬编码的4条活动记录
recentActivities: [
  { title: '模拟考试：数学', subtitle: '完成，得分 85%', time: '2小时前', icon: '✓', status: 'completed' },
  // ...
]
```

### 目标方案
```javascript
// 从 studyStore.questionHistory 获取
computed(() => {
  return studyStore.questionHistory.slice(0, 4).map(record => ({
    title: `练习：${record.questionType || '综合'}`,
    subtitle: record.isCorrect ? '答对' : '答错',
    time: formatTime(record.timestamp),
    icon: record.isCorrect ? '✓' : '✗',
    status: record.isCorrect ? 'completed' : 'in-progress'
  }))
})
```

### 实施步骤
1. 从 studyStore 获取历史记录
2. 格式化时间显示
3. 映射状态和图标
4. 限制显示数量（最近4条）

---

## 5. 用户信息接入

### 当前状态
```javascript
// 硬编码的用户信息
userName: 'John',
userInitials: 'JD'
```

### 目标方案
```javascript
// 从 useUserStore 获取
import { useUserStore } from '../../stores/modules/user'

const userStore = useUserStore()

userName: computed(() => userStore.userInfo?.nickName || '学习者')
userInitials: computed(() => getInitials(userStore.userInfo?.nickName))
```

### 实施步骤
1. 在 `onLoad` 中初始化 userStore
2. 调用 `userStore.restoreUserInfo()` 恢复数据
3. 使用 computed 属性映射数据
4. 处理未登录状态

---

## 6. 按钮功能接入

### 快速练习按钮
```javascript
navToPractice() {
  // 当前：直接跳转到练习页
  uni.switchTab({ url: '/src/pages/practice/index' })
  
  // 优化：检查题库是否存在
  const questionBank = uni.getStorageSync('v30_bank') || []
  if (questionBank.length === 0) {
    uni.showModal({
      title: '提示',
      content: '题库为空，请先导入题目',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/src/pages/practice/import-data' })
        }
      }
    })
  } else {
    uni.switchTab({ url: '/src/pages/practice/index' })
  }
}
```

### 模拟考试按钮
```javascript
navToMockExam() {
  // 当前：显示 coming soon
  // 目标：跳转到模拟考试页面或显示功能说明
  uni.showModal({
    title: '模拟考试',
    content: '模拟考试功能正在开发中，敬请期待！',
    showCancel: false
  })
}
```

### 统计卡片点击
```javascript
handleStatClick(type) {
  const routes = {
    'questions': '/src/pages/practice/index',
    'accuracy': '/src/pages/mistake/index',
    'streak': '/src/pages/study-detail/index',
    'achievements': '/src/pages/profile/index'
  }
  
  if (routes[type]) {
    if (type === 'questions' || type === 'accuracy') {
      uni.switchTab({ url: routes[type] })
    } else {
      uni.navigateTo({ url: routes[type] })
    }
  }
}
```

### 知识点气泡点击
```javascript
handleKnowledgeClick(point) {
  // 当前：只显示 toast
  // 目标：跳转到对应的知识点详情或练习页
  
  if (point.title === '错题集') {
    uni.switchTab({ url: '/src/pages/mistake/index' })
  } else {
    // 跳转到练习页，带上筛选条件
    uni.navigateTo({
      url: `/src/pages/practice/index?filter=${point.title}`
    })
  }
}
```

---

## 7. 数据刷新策略

### onShow 生命周期
```javascript
onShow() {
  uni.hideTabBar({ animation: false })
  
  // 刷新所有数据
  this.refreshAllData()
}

refreshAllData() {
  // 1. 刷新学习统计
  studyStore.restoreProgress()
  this.calculateStats()
  
  // 2. 刷新待办事项
  todoStore.initTasks()
  
  // 3. 刷新用户信息
  userStore.restoreUserInfo()
  
  // 4. 刷新知识点数据
  this.loadKnowledgePoints()
}
```

---

## 8. 错误处理

### 数据加载失败
```javascript
try {
  await this.loadData()
} catch (error) {
  console.error('数据加载失败:', error)
  uni.showToast({
    title: '数据加载失败',
    icon: 'none'
  })
  // 使用默认数据
  this.useDefaultData()
}
```

### 网络请求失败
```javascript
// 在 lafService 中已有错误处理
// 前端只需处理业务逻辑错误
```

---

## 📅 实施时间表

### Phase 1: 核心数据接入（30分钟）
- [x] 接入学习统计数据（studyStore）
- [x] 接入待办事项数据（todoStore）
- [x] 接入用户信息（userStore）

### Phase 2: 扩展功能（20分钟）
- [ ] 实现知识点数据加载
- [ ] 实现学习轨迹显示
- [ ] 优化按钮功能

### Phase 3: 优化体验（10分钟）
- [ ] 添加数据刷新逻辑
- [ ] 添加错误处理
- [ ] 添加加载状态

---

## 🎯 预期效果

1. **数据真实性**: 所有数据来自真实的Store和本地存储
2. **功能完整性**: 所有按钮和卡片都有实际功能
3. **用户体验**: 流畅的数据加载和刷新
4. **错误处理**: 优雅的错误提示和降级方案

---

## 📝 注意事项

1. **向后兼容**: 确保旧数据格式仍然可用
2. **性能优化**: 使用 computed 避免重复计算
3. **错误边界**: 每个数据源都有默认值
4. **用户体验**: 添加适当的加载状态和反馈

---

**准备开始实施！**