# API Key 安全迁移总结

## 迁移日期
2026年1月23日

## 迁移目标
将前端直接调用智谱 AI API 的不安全方式，迁移到通过 Sealos 后端代理的安全架构。

## 已完成的迁移

### 1. ✅ 后端服务 (`lafService.js`)
- **位置**: `src/services/lafService.js`
- **改动**: 
  - 新增 `proxyAI(action, payload)` 方法
  - 支持多种 action 类型：`chat`、`generate`、`analyze`
  - 统一错误处理和超时控制
  - 移除前端 API Key 依赖

### 2. ✅ AI 聊天页面 (`chat/index.vue`)
- **位置**: `src/pages/chat/index.vue`
- **改动**:
  - 移除 `getApiKey()` 函数
  - 移除 `uni.request` 直接调用
  - 使用 `lafService.proxyAI('chat', { messages, stream: true })` 
  - 保持流式响应功能

### 3. ✅ 资料导入页面 (`practice/import-data.vue`)
- **位置**: `src/pages/practice/import-data.vue`
- **改动**:
  - 移除旧的 `handleAIResult()` 方法
  - 新增 `saveQuestions()` 方法
  - 使用 `lafService.proxyAI('generate', { content })` 
  - 优化题目保存逻辑

### 4. ✅ 配置文件清理
- **位置**: `src/common/config.js`
- **改动**: 
  - 移除 `AI_PROVIDER_KEY_PLACEHOLDER
  - 保留 `ZHIPU_API_URL` 用于后端

## 安全改进

### 之前（不安全）
```javascript
// ❌ API Key 暴露在前端代码中
const API_KEY_PLACEHOLDER
uni.request({
  url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  header: {
    'Authorization': `Bearer ${API_KEY}`  // 危险！
  }
});
```

### 之后（安全）
```javascript
// ✅ API Key 安全存储在后端
const response = await lafService.proxyAI('chat', {
  messages: [...],
  stream: true
});
// 后端自动添加 API Key，前端无法访问
```

## 架构优势

1. **安全性**: API Key 仅存储在 Sealos 后端环境变量中
2. **可维护性**: 统一的 API 调用接口，易于管理
3. **可扩展性**: 支持多种 action 类型，便于添加新功能
4. **错误处理**: 统一的错误处理和超时控制
5. **兼容性**: 保持原有功能不变，用户体验无影响

## 后端配置要求

### Sealos 环境变量
```bash
AI_PROVIDER_KEY_PLACEHOLDER
```

### 后端云函数
- **函数名**: `ai-proxy`
- **功能**: 接收前端请求，添加 API Key，转发到智谱 AI
- **支持的 action**:
  - `chat`: AI 对话（支持流式）
  - `generate`: 题目生成
  - `analyze`: 内容分析

## 测试验证

### 需要测试的功能
1. ✅ AI 聊天对话（流式响应）
2. ✅ 资料导入生成题目
3. ⏳ 其他可能使用 AI 的功能

### 测试方法
```bash
# 1. 启动开发服务器
npm run dev:h5

# 2. 测试 AI 聊天
# - 打开聊天页面
# - 发送消息
# - 验证流式响应正常

# 3. 测试题目生成
# - 打开资料导入页面
# - 上传文件
# - 验证题目生成正常
```

## 回滚方案

如果需要回滚到旧版本：

1. 恢复 `src/common/config.js` 中的 `AI_PROVIDER_KEY_PLACEHOLDER
2. 恢复各页面中的 `getApiKey()` 函数
3. 恢复 `uni.request` 直接调用

**注意**: 不建议回滚，因为会重新暴露 API Key 安全风险。

## 后续优化建议

1. **添加请求限流**: 防止 API 滥用
2. **添加用户认证**: 确保只有授权用户可以调用 AI
3. **添加使用统计**: 监控 API 调用量和成本
4. **添加缓存机制**: 减少重复请求
5. **添加错误监控**: 及时发现和处理异常

## 相关文档

- [API Key 安全修复指南](./API_KEY_SECURITY_FIX.md)
- [Sealos 部署文档](../migration/ALIYUN_TO_SEALOS_MIGRATION.md)
- [后端服务文档](../../src/services/README.md)

## 联系方式

如有问题，请联系开发团队。
