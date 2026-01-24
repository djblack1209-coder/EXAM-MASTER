# UI 修复计划

## 反馈问题清单

### 优先级 1：主题系统（已完成）
- ✅ **问题 10**: 删除主题选择器，深色模式直接切换 Wise/Bitget
  - 已修改 `src/stores/modules/theme.js`
  - 已修改 `src/pages/settings/index.vue`
  - 深色模式 = Bitget Wallet 风格
  - 浅色模式 = Wise 风格

### 优先级 2：首页设计问题
- ⏳ **问题 1**: 调整能力评级、学习时长气泡设计
  - 文件：`src/components/StudyOverview.vue`
  - 要求：圆润设计，避免椭圆
  
- ⏳ **问题 2**: 本周学习卡片高度问题
  - 文件：`src/pages/index/index.vue`
  - 要求：统一卡片高度
  
- ⏳ **问题 3**: 顶栏透明化
  - 文件：`src/components/HomeNavbar.vue`
  - 要求：透明背景
  
- ⏳ **问题 4**: 主页配色
  - 文件：`src/pages/index/index.vue`
  - 要求：绿色+白色配色方案

### 优先级 3：择校页面
- ⏳ **问题 5**: 优化开始AI择校匹配按钮
  - 文件：`src/pages/school/index.vue`
  - 要求：按钮设计优化

### 优先级 4：设置页面
- ⏳ **问题 6**: 个人信息栏重新设计
  - 文件：`src/pages/settings/index.vue`
  - 要求：小卡片设计
  
- ⏳ **问题 7**: 登录后默认头像问题
  - 文件：`src/pages/settings/index.vue`
  - 要求：修复头像显示逻辑
  
- ⏳ **问题 8**: 点击登录文字对齐
  - 文件：`src/pages/settings/index.vue`
  - 要求：修复文字居中
  
- ⏳ **问题 9**: 重新设计邀请好友按钮
  - 文件：`src/pages/settings/index.vue`
  - 要求：按钮设计优化

---

## 修复顺序

### 第一批：首页优化（问题 1-4）
1. StudyOverview 气泡设计
2. 首页卡片高度统一
3. 顶栏透明化
4. 主页配色调整

### 第二批：设置页面优化（问题 6-9）
1. 个人信息栏小卡片化
2. 头像显示逻辑修复
3. 登录文字对齐
4. 邀请按钮重新设计

### 第三批：择校页面优化（问题 5）
1. AI择校匹配按钮优化

---

## 技术要点

### 气泡设计规范
- 使用 `border-radius: 50%` 确保圆形
- 宽高相等（如 80px × 80px）
- 避免使用不同的宽高值

### 卡片高度统一
- 使用 `min-height` 而非固定 `height`
- 确保内容对齐

### 透明背景
- 使用 `background: transparent`
- 或 `background: rgba(255, 255, 255, 0)`

### 配色方案
- Wise 浅色：绿色 (#00a96d) + 白色 (#FFFFFF)
- Wise 深色：Wise Green (#9FE870) + 深绿背景 (#163300)

---

## 下一步
开始第一批修复：首页优化
