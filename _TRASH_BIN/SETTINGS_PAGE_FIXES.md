# 设置页面 UI 修复计划

## 待修复问题

### 问题6：个人信息栏小卡片化 ⏳
**当前状态**：用户卡片占据大量空间
**目标**：缩小用户卡片尺寸，更紧凑

**修复方案**：
```scss
.user-card {
  padding: 16px; // 从 24px 减少到 16px
}

.avatar {
  width: 60px;  // 从 80px 减少到 60px
  height: 60px;
}

.nickname-input {
  font-size: 20px; // 从 24px 减少到 20px
}

.stats-section {
  padding-top: 12px; // 从 20px 减少到 12px
}

.stat-value {
  font-size: 28px; // 从 36px 减少到 28px
}
```

---

### 问题7：登录后默认头像问题 ⏳
**当前状态**：登录后可能显示默认头像
**目标**：确保登录后正确显示用户头像

**修复方案**：
1. 检查 `onChooseAvatar` 函数逻辑
2. 确保头像URL正确保存到 `userInfo.avatarUrl`
3. 添加头像加载失败的降级处理
4. 修复 `onAvatarError` 函数，不要覆盖用户选择的头像

**关键代码**：
```javascript
// 修复前
const onAvatarError = (e) => {
  console.log('[Settings] ⚠️ 头像加载失败，使用默认头像', e);
  // 错误：直接覆盖用户头像
  userInfo.value.avatarUrl = defaultAvatar;
};

// 修复后
const onAvatarError = (e) => {
  console.log('[Settings] ⚠️ 头像加载失败，保留用户选择', e);
  // 不修改 userInfo，让用户重新选择
  // 或者只在真正无效时才使用默认头像显示
};
```

---

### 问题8：点击登录文字对齐 ⏳
**当前状态**：登录提示文字可能未居中
**目标**：确保"点击登录"文字居中对齐

**修复方案**：
```scss
.login-prompt {
  text-align: center;
  width: 100%;
  display: block;
  margin-top: 4px;
}

.avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}
```

---

### 问题9：邀请好友按钮重新设计 ⏳
**当前状态**：邀请按钮样式需要优化
**目标**：重新设计邀请按钮，更醒目

**修复方案**：
```scss
.invite-btn-header {
  background: linear-gradient(135deg, #00a96d 0%, #008055 100%);
  box-shadow: 0 2px 8px rgba(0, 169, 109, 0.3);
  padding: 8px 16px;
  border-radius: 20px;
}

.invite-btn-header:hover {
  box-shadow: 0 4px 12px rgba(0, 169, 109, 0.4);
  transform: translateY(-1px);
}
```

---

## 修复顺序

1. **问题6** - 个人信息栏小卡片化（样式调整）
2. **问题8** - 点击登录文字对齐（样式调整）
3. **问题9** - 邀请按钮重新设计（样式调整）
4. **问题7** - 头像显示逻辑修复（逻辑修复，最复杂）

---

## 注意事项

1. 保持功能完整性，只修改样式
2. 确保深色模式适配
3. 测试头像上传和显示流程
4. 验证登录状态同步

---

## 预期效果

- ✅ 用户卡片更紧凑，节省空间
- ✅ 登录提示文字居中对齐
- ✅ 邀请按钮更醒目，有渐变效果
- ✅ 头像显示逻辑正确，不会被默认头像覆盖
