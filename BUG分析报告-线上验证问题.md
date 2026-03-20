# 🐛 Exam-Master 线上验证问题 - Bug分析报告

**生成时间**: 2026-03-18  
**项目版本**: v1.0.0  
**分析范围**: 文件上传、权限管理、微信登录授权  
**测试平台**: macOS / iPadOS 兼容

---

## 📊 问题概览

根据代码全量扫描，发现以下**关键问题**：

| 问题类型                | 严重程度 | 影响范围        | 状态   |
| ----------------------- | -------- | --------------- | ------ |
| 微信H5登录配置缺失      | 🔴 严重  | H5环境微信登录  | 待修复 |
| 文件选择权限未声明      | 🟡 中等  | 资料导入功能    | 需配置 |
| 头像上传权限检查缺失    | 🟡 中等  | 头像更换功能    | 待优化 |
| 相机/相册权限提示不友好 | 🟢 轻微  | 拍照搜题/证件照 | 待优化 |

---

## 🔍 详细Bug分析

### 1. 【严重】微信H5登录无授权窗口

**问题描述**:  
用户反馈"使用微信登录没有授权窗口"，经代码分析发现：

**根本原因**:

```javascript
// src/config/index.js:131
gzhAppId: getEnv('VITE_WX_GZH_APP_ID', ''); // ❌ 环境变量未配置，返回空字符串
```

**影响代码路径**:

1. `src/pages/login/index.vue:635` - H5登录检查 `config.wx.gzhAppId`
2. `src/pages/login/index.vue:672` - 构建OAuth URL时使用空AppID
3. `laf-backend/functions/login.ts:1320` - 后端检查 `WX_GZH_APPID` 环境变量

**触发条件**:

- 用户在H5环境（微信浏览器内）点击"微信授权登录"
- 前端检测到 `isWeChatBrowser = true`
- 但 `config.wx.gzhAppId` 为空字符串

**实际表现**:

```javascript
// src/pages/login/index.vue:636-639
if (!wxAppId) {
  uni.showToast({ title: '微信公众号未配置', icon: 'none' });
  isLoading.value = false;
  return; // ✅ 前端会提示"微信公众号未配置"，不会跳转
}
```

**修复方案**:

```bash
# 1. 前端环境变量配置（.env.production）
VITE_WX_GZH_APP_ID=wx1234567890abcdef  # 替换为真实公众号AppID

# 2. 后端环境变量配置（Laf云函数）
WX_GZH_APPID=wx1234567890abcdef
SECRET_PLACEHOLDER
```

**验证方法**:

- 在微信内置浏览器打开H5页面
- 点击"微信授权登录"按钮
- 应跳转到微信授权页面（`https://open.weixin.qq.com/connect/oauth2/authorize`）

---

### 2. 【中等】文件上传显示"文件权限未开启"

**问题描述**:  
用户在"资料导入"功能中选择文件时，提示"文件权限未开启"。

**根本原因**:
微信小程序隐私协议未声明 `chooseMessageFile` API。

**相关代码**:

```javascript
// src/pages/practice-sub/file-handler.js:532-536
if (this.isPrivacyScopeUndeclaredError(err)) {
  logger.warn('[FileHandler] 隐私协议未声明文件选择权限:', err);
  this.showPrivacyScopeGuide(); // 显示引导弹窗
  finish({ success: false, privacyScopeMissing: true, error: err });
  return;
}
```

**判断逻辑**:

```javascript
// src/pages/practice-sub/file-handler.js:428-431
isPrivacyScopeUndeclaredError(err) {
  const msg = String(err?.errMsg || '').toLowerCase();
  return Number(err?.errno) === 112 ||
         msg.includes('privacy agreement') ||
         msg.includes('scope is not declared');
}
```

**manifest.json配置**:

```json
// manifest.json:108
"__usePrivacyCheck__": true,  // ✅ 已启用隐私检查

// manifest.json:120
"requiredPrivateInfos": ["chooseAddress", "chooseLocation", "choosePoi"],
// ❌ 缺少 "chooseMessageFile"
```

**修复方案**:

```json
// manifest.json 添加文件选择权限声明
"requiredPrivateInfos": [
  "chooseAddress",
  "chooseLocation",
  "choosePoi",
  "chooseMessageFile"  // ✅ 添加此项
]
```

**注意事项**:

- 修改后需重新提交微信小程序审核
- 用户首次使用时会弹出隐私授权弹窗
- 代码已实现 `wx.requirePrivacyAuthorize()` 预检查（file-handler.js:551-571）

---

### 3. 【中等】头像上传失败

**问题描述**:  
用户更换头像时上传失败，可能的原因有多个。

**潜在问题点**:

#### 3.1 相册权限未授权（微信小程序）

```javascript
// src/pages/settings/index.vue:805-832
// ❌ 非微信环境使用 uni.chooseImage，但未检查 scope.album 权限
uni.chooseImage({
  count: 1,
  sizeType: ['compressed'],
  sourceType: ['album', 'camera'], // 需要相册和相机权限
  success: (res) => {
    /* ... */
  },
  fail: () => {
    logger.log('[Settings] 用户取消了头像选择'); // ❌ 未区分"取消"和"权限拒绝"
  }
});
```

**改进建议**:

```javascript
// 在 chooseImage 前先检查权限
// #ifndef MP-WEIXIN
const cameraGranted = await ensureMiniProgramScope('scope.camera', {
  title: '相机权限提示',
  content: '需要相机权限才能拍照，是否前往设置开启？'
});
if (!cameraGranted) {
  uni.showToast({ title: '未开启相机权限', icon: 'none' });
  return;
}
// #endif
```

#### 3.2 后端上传接口认证失败

```typescript
// laf-backend/functions/upload-avatar.ts:64-67
const authResult = requireAuth(ctx);
if (isAuthError(authResult)) {
  return { ...authResult, requestId }; // 返回 401 unauthorized
}
```

**可能原因**:

- Token过期或无效
- Authorization header未正确携带
- JWT_SECRET_PLACEHOLDER

**前端Token携带**:

```javascript
// src/pages/settings/index.vue:722
header: {
  Authorization: `Bearer ${token}`;
} // ✅ 已正确携带

// src/pages/profile/index.vue:857
header: {
  Authorization: `Bearer ${storageService.get('EXAM_TOKEN', '')}`; // ✅ 已正确携带
}
```

#### 3.3 文件大小超限

```typescript
// laf-backend/functions/upload-avatar.ts:36
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// laf-backend/functions/upload-avatar.ts:96-98
if (actualFileSize > MAX_FILE_SIZE) {
  return { ...badRequest(`图片大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`), requestId };
}
```

**前端配置**:

```javascript
// src/config/index.js:274
avatarMaxSize: getEnvNumber('VITE_AVATAR_MAX_SIZE', 2097152),  // 2MB，与后端一致 ✅
```

---

### 4. 【轻微】相机/相册权限提示不友好

**问题描述**:  
拍照搜题、证件照制作等功能在权限被拒绝后，错误提示不够明确。

**相关代码**:

#### 4.1 拍照搜题权限处理

```javascript
// src/pages/tools/photo-search.vue:350-357
const cameraGranted = await ensureMiniProgramScope('scope.camera', {
  title: '相机权限提示',
  content: '需要相机权限才能拍照搜题，是否前往设置开启？'
});
if (!cameraGranted) {
  uni.showToast({ title: '未开启相机权限', icon: 'none' }); // ✅ 提示清晰
  return;
}
```

#### 4.2 证件照权限处理

```javascript
// src/pages/tools/id-photo.vue:263-267
return ensureMiniProgramScope('scope.camera', {
  title: '相机权限提示',
  content: '需要相机权限才能拍摄证件照，是否前往设置开启？' // ✅ 提示清晰
});
```

#### 4.3 保存到相册权限

```javascript
// src/pages/tools/id-photo.vue:681
const albumGranted = await ensureMiniProgramScope('scope.writePhotosAlbum', {
  title: '相册权限提示',
  content: '需要相册权限才能保存照片，是否前往设置开启？' // ✅ 提示清晰
});
```

**评估结论**:  
权限提示已较为完善，但可以进一步优化：

- 添加权限用途说明（manifest.json已配置）
- 失败后提供"重试"按钮
- 记录权限拒绝次数，避免频繁弹窗

---

## 🎯 优先级修复建议

### P0 - 立即修复（影响核心功能）

1. ✅ **配置微信公众号AppID** - 修复H5微信登录
   - 前端: `.env.production` 添加 `VITE_WX_GZH_APP_ID`
   - 后端: Laf环境变量添加 `WX_GZH_APPID` 和 `WX_GZH_SECRET`

### P1 - 本周修复（影响用户体验）

2. ✅ **声明文件选择权限** - 修复资料导入
   - `manifest.json` 的 `requiredPrivateInfos` 添加 `"chooseMessageFile"`
   - 重新提交微信小程序审核

### P2 - 下版本优化（提升体验）

3. 🔄 **优化头像上传错误提示**
   - 区分"用户取消"和"权限拒绝"
   - 添加详细的失败原因提示
   - 提供"重试"按钮

4. 🔄 **增强权限引导流程**
   - 首次使用时主动说明权限用途
   - 权限被拒后提供图文引导
   - 避免频繁弹窗骚扰用户

---

## 📝 代码质量评估

### ✅ 做得好的地方

1. **权限检查封装完善** - `privacy-authorization.js` 提供统一的权限检查工具
2. **错误处理健壮** - 文件上传有完整的fallback机制（multipart失败自动降级base64）
3. **安全措施到位** - JWT认证、CSRF防护、密码加密（scrypt）
4. **日志记录详细** - 便于问题排查

### ⚠️ 需要改进的地方

1. **环境变量管理** - 部分关键配置未设置（如WX_GZH_APPID）
2. **权限声明不完整** - manifest.json缺少chooseMessageFile
3. **错误提示可优化** - 部分场景下用户不知道具体失败原因
4. **权限预检不统一** - 部分页面有权限预检，部分没有

---

## 🔧 技术债务清单

1. **统一权限管理** - 将所有权限检查迁移到 `permission-handler.js`
2. **完善错误码体系** - 定义统一的错误码和错误消息
3. **添加权限状态缓存** - 避免重复调用 `uni.getSetting()`
4. **优化文件上传体验** - 添加上传进度条、支持断点续传
5. **增强日志监控** - 上报权限拒绝率、上传失败率等指标

---

**报告生成完毕** ✅  
下一步：查看《人工测试清单》进行全面验证
