# Module 7: AI聊天功能验证报告 (TEST-7.0)

**测试日期**: 2026-01-23  
**测试人员**: AI Assistant (Role: QA Lead)  
**版本**: V1.0 (Module 7)

## 1. 静态代码审计结果 (Code Audit)

### ✅ 通过项
1. **API 服务类 (`ZhipuService.js`)**:
   - JWT Token 生成逻辑正常（包含过期时间检查）。
   - 消息发送格式符合智谱 API 规范。
   - 错误处理机制存在。

2. **聊天页面 (`chat.vue`)**:
   - UI 结构完整（消息列表、输入框）。
   - 包含自动滚动 (`scroll-into-view`) 逻辑。
   - 状态管理 (`isLoading`, `messages`) 清晰。

3. **配置管理 (`config.js`)**:
   - 包含默认测试 Key，方便开发调试。
   - `getRuntimeApiKey` 提供了灵活的 Key 获取方式。

### 🔴 发现的问题 (Defects)

#### Bug-7.1: 入口文案与文档不符 (已修复 ✅)
- **描述**: `AiEntry.vue` 中的按钮文案仍为“解锁”，而 `第7阶段开发总结.md` 中声称已改为“开始对话”。
- **证据**: `src/components/practice/AiEntry.vue` 第 32 行 `<text class="btn-text">解锁</text>`。
- **严重性**: 低 (UI 文案)
- **状态**: **Fixed**

#### Bug-7.2: 导航栏标题硬编码 (已修复 ✅)
- **描述**: `chat.vue` 默认好友名硬编码为 `'张巍'`，应改为 `'AI助教'` 更为合适。
- **位置**: `src/pages/chat/chat.vue` 第 70 行。
- **严重性**: 低 (UI)
- **状态**: **Fixed**

## 2. 修复记录 (Fix Log)
1. **[Fixed] AiEntry.vue**:
   - 按钮文案改为“开始对话”。
   - 占位符改为“输入问题...”。
   - 图标改为 🤖，标题改为“AI助教”。
2. **[Fixed] chat.vue**:
   - 默认标题修改为 `'AI助教'`。

## 3. 结论
核心逻辑代码质量良好，UI 文案不一致问题已修复。
建议用户进行真机测试以验证 API 连接性和 UI 交互体验。
