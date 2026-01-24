# AI服务调试指南

## 🔍 问题现状

**后端日志**: `⚠️ [请求拦截] content 为空或格式错误`

这说明后端收到的请求中 `content` 字段为空或不存在。

---

## ✅ 前端修复已完成

### 修复内容
文件：`src/services/lafService.js`

```javascript
async proxyAI(action, payload, options = {}) {
  // ✅ 针对特定 action 强制检查 content
  if (action === 'chat' || action === 'analyze' || action === 'generate_questions') {
    if (!payload.content || typeof payload.content !== 'string' || payload.content.trim() === '') {
      console.error('❌ [LafService] 拦截: 尝试发送空内容给 AI');
      return {
        code: -1,
        success: false,
        message: '输入内容不能为空',
        data: null
      };
    }
    payload.content = payload.content.trim();
  }
  // ...
}
```

---

## 🧪 测试步骤

### 步骤1: 验证前端修复
在微信开发者工具的 Console 中运行：

```javascript
// 测试1: 空字符串（应该被前端拦截）
const result1 = await lafService.proxyAI('chat', { content: '' });
console.log('测试1结果:', result1);
// 预期: { code: -1, message: '输入内容不能为空' }

// 测试2: undefined（应该被前端拦截）
const result2 = await lafService.proxyAI('chat', { content: undefined });
console.log('测试2结果:', result2);
// 预期: { code: -1, message: '输入内容不能为空' }

// 测试3: 正常内容（应该发送到后端）
const result3 = await lafService.proxyAI('chat', { content: '你好' });
console.log('测试3结果:', result3);
// 预期: { code: 0, data: "AI回复..." }
```

### 步骤2: 检查首页调用
在 `src/pages/index/index.vue` 的 `fetchDailyQuote` 方法中添加日志：

```javascript
async fetchDailyQuote() {
  this.isRefreshing = true;
  const prompt = "请生成一句简短的、充满力量的考研励志语录...";
  
  // 🔍 添加调试日志
  console.log('🔍 [Debug] prompt 值:', prompt);
  console.log('🔍 [Debug] prompt 类型:', typeof prompt);
  console.log('🔍 [Debug] prompt 长度:', prompt ? prompt.length : 0);

  try {
    const response = await lafService.proxyAI('chat', {
      content: prompt
    });
    
    console.log('🔍 [Debug] AI响应:', response);
    // ...
  } catch (error) {
    console.error('🔍 [Debug] AI请求失败:', error);
  }
}
```

---

## 🎯 可能的原因

### 原因1: 代码未重新编译
**解决方案**: 
1. 在微信开发者工具中点击"编译"按钮
2. 或者重启微信开发者工具

### 原因2: 缓存问题
**解决方案**:
1. 在微信开发者工具中：工具 → 清除缓存 → 清除全部缓存
2. 重新编译项目

### 原因3: 调用方式不对
**检查点**:
- 确认 `lafService` 是否正确导入
- 确认 `proxyAI` 方法是否被正确调用
- 确认 `content` 参数是否正确传递

### 原因4: 后端期望的数据格式不同
**检查后端代码**:
查看后端 `proxy-ai` 函数期望的数据格式：
```javascript
// 后端可能期望的格式1
{ action: 'chat', content: '...' }

// 后端可能期望的格式2
{ action: 'chat', payload: { content: '...' } }

// 后端可能期望的格式3
{ action: 'chat', messages: [{ role: 'user', content: '...' }] }
```

---

## 🔧 临时调试方案

### 方案1: 在前端添加更详细的日志

修改 `src/services/lafService.js` 的 `proxyAI` 方法：

```javascript
async proxyAI(action, payload, options = {}) {
  console.log('🔍 [Debug] proxyAI 被调用');
  console.log('🔍 [Debug] action:', action);
  console.log('🔍 [Debug] payload:', JSON.stringify(payload));
  console.log('🔍 [Debug] payload.content:', payload.content);
  console.log('🔍 [Debug] typeof payload.content:', typeof payload.content);
  
  // ... 原有代码
  
  console.log('🔍 [Debug] 即将发送的 requestData:', JSON.stringify(requestData));
  
  const response = await this.request('/proxy-ai', requestData);
  
  console.log('🔍 [Debug] 后端响应:', JSON.stringify(response));
  
  return response;
}
```

### 方案2: 直接在后端测试

在 Laf 云函数的"接口调试"中手动测试：

**请求体**:
```json
{
  "action": "chat",
  "content": "你好"
}
```

**预期响应**:
```json
{
  "success": true,
  "data": "AI回复内容..."
}
```

如果手动测试成功，说明后端没问题，问题在前端。

---

## 📋 检查清单

- [ ] 前端代码已修改（`src/services/lafService.js`）
- [ ] 微信开发者工具已重新编译
- [ ] 缓存已清除
- [ ] Console 中可以看到 `[LafService]` 开头的日志
- [ ] 测试用例1（空字符串）被前端拦截
- [ ] 测试用例2（undefined）被前端拦截
- [ ] 测试用例3（正常内容）成功发送到后端
- [ ] 首页"每日金句"可以正常刷新

---

## 🆘 如果问题仍然存在

### 请提供以下信息：

1. **前端 Console 日志**
   - 打开微信开发者工具的 Console 面板
   - 点击首页"每日金句"卡片
   - 复制所有 `[LafService]` 开头的日志

2. **后端日志**
   - 在 Laf 云函数的 Console 中查看完整日志
   - 复制所有相关日志

3. **测试结果**
   - 在 Console 中运行上述测试用例
   - 复制测试结果

4. **代码确认**
   - 确认 `src/services/lafService.js` 的第 155-167 行是否包含修复代码
   - 确认 `src/pages/index/index.vue` 的第 1020 行调用方式

---

## 💡 快速修复建议

如果你急需让AI功能工作，可以临时使用以下降级方案：

### 降级方案1: 使用默认金句
```javascript
async fetchDailyQuote() {
  // 临时使用默认金句，不调用AI
  const defaultQuotes = [
    "星光不问赶路人，时光不负有心人。",
    "天道酬勤，厚积薄发。",
    "不积跬步，无以至千里。"
  ];
  this.dailyQuote = defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)];
}
```

### 降级方案2: 使用本地随机生成
```javascript
async fetchDailyQuote() {
  const subjects = ['英语', '政治', '数学', '专业课'];
  const actions = ['坚持', '努力', '奋斗', '拼搏'];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const action = actions[Math.floor(Math.random() * actions.length)];
  this.dailyQuote = `${subject}${action}，成功在望！`;
}
```

---

## 📞 联系支持

如果以上方法都无法解决问题，请：
1. 运行测试脚本：`node scripts/test-ai-service.js`
2. 提供完整的前端和后端日志
3. 提供测试脚本的输出结果

我们会根据这些信息进一步诊断问题。
