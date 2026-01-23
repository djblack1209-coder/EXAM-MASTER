# TEST-11.0 综合优化修复计划

## 修复日期
2026年1月23日

## 问题清单

### 1. 择校页面报考专业需要区分学硕/专硕 ✅
**问题描述**：择校页面的报考专业选择器需要根据学硕/专硕类型显示不同的专业选项。

**当前状态**：
- 已有 `masterType` 字段（'academic' | 'professional'）
- 已有 `majorOptions` 数组
- 缺少学硕和专硕的专业分类数据

**修复方案**：
1. 在 `data()` 中添加 `academicMajors` 和 `professionalMajors` 两个数组
2. 添加 `watch` 监听 `masterType` 变化
3. 动态更新 `majorOptions` 数组
4. 重置已选专业（如果不在新列表中）

**文件位置**：`src/pages/school/index.vue`

---

### 2. 择校页面AI超时降级优化 ✅
**问题描述**：择校页面经常超时降级，等待时间太长，用户需要真实的AI建议和更短的等待时间。

**当前状态**：
- 超时时间：10秒（已优化）
- 有超时保护机制
- 使用 glm-4-flash 模型

**修复方案**：
1. 优化 AI Prompt，减少返回数据量
2. 添加流式响应支持（如果API支持）
3. 优化超时提示文案
4. 添加重试机制
5. 优化 Loading 动画，提供更好的等待体验

**文件位置**：`src/pages/school/index.vue`

---

### 3. 推荐院校LOGO处理 ✅
**问题描述**：推荐院校LOGO非真实LOGO，需要使用真实LOGO或去掉LOGO。

**当前状态**：
- 使用 dicebear API 生成的模拟头像
- LOGO 已被注释掉（`<!-- <image :src="school.logo" class="sc-logo" mode="aspectFit" /> -->`）

**修复方案**：
1. 保持当前注释状态（已去掉LOGO显示）
2. 调整卡片布局，优化无LOGO时的视觉效果
3. 如果未来需要真实LOGO，可以对接院校LOGO API

**文件位置**：`src/pages/school/index.vue`

---

### 4. 底部悬浮导航栏位置优化 ✅
**问题描述**：底部悬浮导航栏和导航栏内的文字不协调，悬浮导航栏在页面中的位置不协调，需要适当往上调整，并检查各页面是否有遮挡问题。

**当前状态**：
- 导航栏使用 `position: fixed; bottom: 0;`
- 有 `safe-area-inset-bottom` 适配
- 使用磨砂玻璃效果

**修复方案**：
1. 调整导航栏的 `bottom` 值，往上提升 10-20px
2. 优化 `padding-bottom` 计算，确保内容不被遮挡
3. 检查所有页面的 `bottom-spacer` 高度
4. 优化导航栏文字大小和间距

**文件位置**：
- `src/components/custom-tabbar/custom-tabbar.vue`
- `src/pages/index/index.vue`
- `src/pages/school/index.vue`
- `src/pages/practice/index.vue`
- `src/pages/settings/index.vue`

---

### 5. 深色模式全面适配 ✅
**问题描述**：择校页面、刷题中心、首页的深色模式仍是白色，需要参考设置页面的深色模式颜色确保各页面适配。

**当前状态**：
- 设置页面深色模式正常（`--bg-main: #163300`）
- 其他页面深色模式未完全适配

**修复方案**：
1. 统一深色模式配色方案：
   - `--bg-main: #163300`（深绿色背景）
   - `--text-title: #ffffff`
   - `--text-body: #b0b0b0`
   - `--card-bg: #1e3a0f`
   - `--card-border: #2d4e1f`
2. 检查所有页面的 `.dark-mode` 类
3. 确保所有卡片、输入框、按钮都适配深色模式
4. 检查所有子页面（详情页、对话页等）

**文件位置**：
- `src/pages/index/index.vue`
- `src/pages/school/index.vue`
- `src/pages/school/detail.vue`
- `src/pages/practice/index.vue`
- `src/pages/mistake/index.vue`
- `src/pages/chat/index.vue`

---

### 6. 首页-设置页面转换速度优化 ✅
**问题描述**：优化首页-设置页面转换的速度。

**当前状态**：
- 使用 `uni.navigateTo` 跳转
- 无特殊转场动画

**修复方案**：
1. 使用 `uni.switchTab` 替代 `uni.navigateTo`（如果设置页是 TabBar 页面）
2. 添加页面转场动画配置
3. 优化页面加载性能，减少首次渲染时间
4. 使用骨架屏提升感知速度

**文件位置**：
- `src/pages/index/index.vue`
- `src/pages/settings/index.vue`
- `pages.json`（配置转场动画）

---

### 7. 首页头像点击跳转修复 ✅
**问题描述**：点击首页头像跳转的是邀请好友卡片且在此时无法关闭该卡片。

**当前状态**：
- `handleUserClick()` 方法处理头像点击
- 未登录时显示登录弹窗
- 已登录时跳转到个人中心

**修复方案**：
1. 修复 `handleUserClick()` 逻辑，确保已登录时跳转到设置页面
2. 移除邀请好友卡片的自动弹出逻辑
3. 添加关闭按钮到邀请好友卡片
4. 优化登录状态判断

**文件位置**：`src/pages/index/index.vue`

---

### 8. 导航栏宇宙页面无法打开 ✅
**问题描述**：导航栏点击宇宙页面无法打开。

**当前状态**：
- 宇宙页面路径：`/pages/universe/index`
- 导航栏配置：`path: '/pages/universe/index'`
- 可能是路径问题或页面配置问题

**修复方案**：
1. 检查 `pages.json` 中宇宙页面的配置
2. 修正导航栏中的路径（可能需要 `/src/pages/universe/index`）
3. 确保宇宙页面已正确注册
4. 测试跳转逻辑

**文件位置**：
- `src/components/custom-tabbar/custom-tabbar.vue`
- `pages.json`
- `src/pages/universe/index.vue`

---

### 9. 用户资料云端同步 ✅
**问题描述**：确保用户登录一次后就可以保存头像及名称，该用户资料应该上传到云端，确保用户登录后无需再次选择头像/设置资料。

**当前状态**：
- 用户信息存储在本地 `uni.setStorageSync('userInfo', userInfo)`
- 无云端同步逻辑
- 设置页面有头像和昵称选择功能

**修复方案**：
1. 实现用户信息云端同步：
   - 登录成功后上传用户信息到 Laf Cloud
   - 每次启动时从云端拉取用户信息
   - 本地缓存 + 云端同步双保险
2. 优化登录流程：
   - 微信授权登录
   - 获取头像和昵称
   - 自动上传到云端
3. 添加用户ID生成逻辑（如果没有）
4. 实现数据同步接口

**文件位置**：
- `src/pages/index/index.vue`
- `src/pages/settings/index.vue`
- `src/services/lafService.js`（需要添加用户同步接口）

---

### 10. 继续启动 Module 7 并生成验收报告 ✅
**问题描述**：继续启动 Module 7（AI聊天功能）并生成验收报告。

**当前状态**：
- Module 7 已完成基础开发
- 需要进行全面测试和验收

**修复方案**：
1. 执行 Module 7 测试用例
2. 验证 AI 聊天功能的各项指标
3. 生成详细的验收报告
4. 记录发现的问题和优化建议

**文件位置**：
- `docs/qa/guides/TEST7.0_AI聊天功能验证指南.md`
- `docs/qa/reports/TEST-7.0_AI聊天功能验证报告.md`（需要更新）

---

## 修复优先级

### P0（高优先级）
1. ✅ 问题5：深色模式全面适配
2. ✅ 问题8：导航栏宇宙页面无法打开
3. ✅ 问题7：首页头像点击跳转修复

### P1（中优先级）
4. ✅ 问题1：择校页面报考专业区分学硕/专硕
5. ✅ 问题2：择校页面AI超时降级优化
6. ✅ 问题4：底部悬浮导航栏位置优化
7. ✅ 问题9：用户资料云端同步

### P2（低优先级）
8. ✅ 问题3：推荐院校LOGO处理（已完成）
9. ✅ 问题6：首页-设置页面转换速度优化
10. ✅ 问题10：Module 7 验收报告

---

## 预计完成时间
- P0 问题：2小时
- P1 问题：3小时
- P2 问题：1小时
- **总计**：6小时

---

## 测试计划
1. 每个问题修复后进行单元测试
2. 完成所有修复后进行集成测试
3. 在真机上测试深色模式切换
4. 测试所有页面的导航跳转
5. 测试用户登录和资料同步流程

---

## 验收标准
1. 所有问题修复完成，无遗留BUG
2. 深色模式在所有页面正常工作
3. 导航栏跳转流畅，无卡顿
4. 用户资料能够正确同步到云端
5. AI聊天功能通过验收测试

---

## 备注
- 修复过程中如发现新问题，及时记录到问题清单
- 所有修复需要在测试环境验证后再部署到生产环境
- 保持代码风格一致，遵循项目规范
