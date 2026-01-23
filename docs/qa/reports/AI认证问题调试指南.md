# AI 认证问题调试指南

## 📋 问题描述

AI 战报生成时返回 `401 未登录` 错误，但降级方案已生效。

## 🔍 调试步骤

### 步骤 1：检查控制台认证日志

重新编译后，在控制台查看 `[LafService] 🔐 认证信息检查` 日志：

```
[LafService] 🔐 认证信息检查: {
  hasToken: true/false,
  hasUserId: true/false,
  tokenLength: 0,
  userId: "69714ab1e7cc2607c934fc6a",
  path: "/proxy-ai"
}
```

**预期结果**：
- 如果有 token：`hasToken: true, tokenLength: > 0`
- 如果有 userId：`hasUserId: true, userId: "xxx"`

---

### 步骤 2：在小程序控制台检查存储

**注意**：小程序控制台不能直接使用 `uni.getStorageSync`，需要使用以下方法：

#### 方法 A：通过页面实例访问

```javascript
// 在控制台执行
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
const vm = currentPage.$vm;

// 检查存储（通过页面实例）
console.log('EXAM_TOKEN:', vm.$storage?.getItem?.('EXAM_TOKEN') || '未找到');
console.log('EXAM_USER_ID:', vm.$storage?.getItem?.('EXAM_USER_ID') || '未找到');
```

#### 方法 B：使用 wx API（推荐）

```javascript
// 在控制台执行
wx.getStorage({
  key: 'EXAM_TOKEN',
  success: (res) => console.log('EXAM_TOKEN:', res.data),
  fail: () => console.log('EXAM_TOKEN: 不存在')
});

wx.getStorage({
  key: 'EXAM_USER_ID',
  success: (res) => console.log('EXAM_USER_ID:', res.data),
  fail: () => console.log('EXAM_USER_ID: 不存在')
});
```

#### 方法 C：通过 App 实例访问

```javascript
// 在控制台执行
const app = getApp();
console.log('App 实例:', app);

// 如果 App 中有全局方法，可以调用
// 例如：app.checkStorage('EXAM_TOKEN')
```

---

### 步骤 3：检查登录流程

查看登录时的日志：

```
✅ Laf 登录成功: 69714ab1e7cc2607c934fc6a
```

**检查点**：
1. 登录是否成功？
2. 后端是否返回了 token？
3. token 是否被正确保存？

**如果后端没有返回 token**：
- 检查后端 `/login` 接口的返回格式
- 确认后端是否需要返回 token
- 如果后端不返回 token，可能需要修改后端代码

---

### 步骤 4：检查请求头

查看网络请求的请求头（在 Network 面板）：

**预期请求头**：
```
Authorization: ${AUTH_HEADER}
或
X-User-Id: <userId>
```

**如果请求头中没有认证信息**：
- 说明 token/userId 读取失败
- 检查存储键名是否正确

---

## 🔧 可能的原因和解决方案

### 原因 1：后端没有返回 token

**现象**：
- 登录成功，但 `hasToken: false`
- 只有 `hasUserId: true`

**解决方案**：
1. **方案 A**：修改后端 `/login` 接口，返回 token
2. **方案 B**：修改后端 `/proxy-ai` 接口，接受 userId 作为认证方式
3. **方案 C**：使用 userId 生成临时 token（需要后端支持）

---

### 原因 2：Token 存储键名不匹配

**现象**：
- 登录时保存了 token，但读取时找不到

**解决方案**：
- 已修复：`lafService.request()` 现在会尝试多种存储键名：
  - `EXAM_TOKEN`（优先）
  - `token`
  - `EXAM_USER_TOKEN`

---

### 原因 3：后端认证方式不同

**现象**：
- 请求头中有认证信息，但后端仍返回 401

**可能的原因**：
1. 后端期望的 header 名称不同（不是 `Authorization` 或 `X-User-Id`）
2. 后端期望的 token 格式不同（不是 `Bearer <token>`）
3. 后端需要其他认证方式（如 cookie、签名等）

**解决方案**：
- 检查后端代码，确认期望的认证方式
- 修改 `lafService.request()` 以匹配后端要求

---

### 原因 4：后端接口不需要认证

**现象**：
- 后端 `/proxy-ai` 接口实际上不需要认证，但返回了 401

**解决方案**：
- 修改后端代码，移除 `/proxy-ai` 接口的认证检查
- 或者添加白名单，允许未登录用户访问

---

## 📝 临时解决方案（已实施）

如果认证问题暂时无法解决，可以使用降级方案：

**当前实现**：
- AI 分析失败时，自动使用本地评语库
- 根据胜负结果显示相应的评语
- 用户体验不受影响

**降级评语示例**：
- 胜利：`"这手速，阅卷老师都追不上！精准度碾压对手，看来知识点掌握得很扎实。"`
- 惜败：`"对手很厉害，但你的潜力更大，再多刷几题就能反超。"`
- 平局：`"势均力敌！这局平局，下局见分晓。"`

---

## 🎯 下一步行动

### 优先级 1：确认后端认证要求

1. 检查后端 `/proxy-ai` 接口代码
2. 确认是否需要认证
3. 如果需要，确认期望的认证方式

### 优先级 2：修复认证逻辑

根据后端要求，修改前端认证逻辑：
- 如果后端需要 token，确保登录时保存 token
- 如果后端需要 userId，确保正确传递 userId
- 如果后端需要其他方式，修改 `lafService.request()`

### 优先级 3：测试验证

1. 重新编译小程序
2. 执行 PK 对战，完成一局
3. 查看控制台日志，确认认证信息
4. 检查 AI 分析是否成功

---

## 📊 日志示例

### 成功的认证日志

```
[LafService] 🔐 认证信息检查: {
  hasToken: true,
  hasUserId: true,
  tokenLength: 32,
  userId: "69714ab1e7cc2607c934fc6a",
  path: "/proxy-ai"
}
[LafService] ✅ 已添加 Authorization header (Bearer token)
```

### 使用 userId 的认证日志

```
[LafService] 🔐 认证信息检查: {
  hasToken: false,
  hasUserId: true,
  tokenLength: 0,
  userId: "69714ab1e7cc2607c934fc6a",
  path: "/proxy-ai"
}
[LafService] ✅ 已添加 X-User-Id header 和 userId 到请求体
```

### 认证失败的日志

```
[LafService] 🔐 认证信息检查: {
  hasToken: false,
  hasUserId: false,
  tokenLength: 0,
  userId: undefined,
  path: "/proxy-ai"
}
[LafService] ⚠️ 未找到认证信息（token 或 userId），请求可能失败
```

---

## ✅ 验证清单

- [ ] 控制台显示认证信息检查日志
- [ ] 能够读取到 token 或 userId
- [ ] 请求头中包含认证信息
- [ ] 后端不再返回 401 错误
- [ ] AI 分析成功生成

---

*文档生成时间：2026年1月22日*
*状态：待验证*
