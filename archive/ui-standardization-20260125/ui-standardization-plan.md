# UI 标准化计划 - 第二阶段

## 扫描结果总结

已完成标准化的页面（10个）：
- ✅ profile/index.vue
- ✅ splash/index.vue
- ✅ plan/index.vue
- ✅ study-detail/index.vue
- ✅ school/index.vue
- ✅ chat/index.vue
- ✅ index/index.vue
- ✅ mistake/index.vue
- ✅ practice/index.vue
- ✅ universe/index.vue

## 待标准化页面（12个）

### 高优先级（核心功能页面）
1. **settings/index.vue** - 设置页面（大量硬编码颜色）
2. **school/detail.vue** - 学校详情页（大量硬编码颜色）
3. **social/friend-list.vue** - 好友列表（大量硬编码颜色）

### 中优先级（practice 子页面）
4. **practice/pk-battle.vue** - PK对战页面（大量硬编码颜色）
5. **practice/file-manager.vue** - 文件管理（大量硬编码颜色）
6. **practice/do-quiz.vue** - 做题页面（硬编码颜色）
7. **practice/rank.vue** - 排行榜（硬编码颜色）
8. **practice/rank-list.vue** - 排行榜列表（硬编码颜色）
9. **practice/import-data.vue** - 导入数据（硬编码颜色）

### 低优先级（其他页面）
10. **plan/create.vue** - 创建计划（硬编码颜色）
11. **chat/chat.vue** - 聊天页面（硬编码颜色）
12. **index/index-old.vue** - 旧版首页（可能不需要标准化）

## 执行策略

### 批次1：核心页面（3个）
- settings/index.vue
- school/detail.vue
- social/friend-list.vue

### 批次2：practice 子页面（6个）
- practice/pk-battle.vue
- practice/file-manager.vue
- practice/do-quiz.vue
- practice/rank.vue
- practice/rank-list.vue
- practice/import-data.vue

### 批次3：其他页面（2个）
- plan/create.vue
- chat/chat.vue

### 跳过
- index/index-old.vue（旧版本，不需要标准化）

## 标准化原则

1. 替换所有硬编码颜色为 CSS 变量
2. 保持视觉效果一致
3. 确保深色模式兼容
4. 每个文件完成后进行构建测试
5. 特殊效果颜色（如粒子效果）可保留

## 预计工作量

- 批次1：3个文件，预计 45-60 分钟
- 批次2：6个文件，预计 90-120 分钟
- 批次3：2个文件，预计 30-40 分钟

总计：约 2.5-3.5 小时