# Module 7: Sealos 后端配置指南

> **🔴 需要人工介入**  
> 本文档提供详细的 Sealos 后端配置步骤，用于创建 Module 7 社交功能所需的云函数。

---

## 📋 配置目标

在 Sealos 平台创建 `social-service` 云函数，实现以下接口：
1. `search_user` - 搜索用户
2. `send_request` - 发送好友请求
3. `handle_request` - 处理好友请求
4. `get_friend_list` - 获取好友列表
5. `get_friend_requests` - 获取好友请求列表
6. `remove_friend` - 删除好友

---

## 🛠️ 步骤 1: 登录 Sealos 平台

### 操作路径
1. 打开浏览器，访问：https://cloud.sealos.io/
2. 使用您的账号登录
3. 进入项目控制台

### 验证
✅ 能看到项目列表和云函数管理入口

---

## 🛠️ 步骤 2: 找到 Laf 云函数入口

### ⚠️ 重要提示
**我们需要的是 Laf 云函数，不是 Sealos 数据库！**

### 操作路径（方案 A：如果项目已有 Laf）
1. 在 Sealos 控制台，找到 **"Laf"** 应用图标
2. 点击进入 Laf 控制台
3. 在 Laf 左侧菜单，点击 **"云函数"**
4. 点击 **"新建函数"** 按钮
5. 填写以下信息：
   - **函数名称**：`social-service`
   - **描述**：Module 7 社交服务
   - **HTTP 方法**：`POST`

### 操作路径（方案 B：如果没有 Laf，使用 Sealos 云函数）
1. 在 Sealos 控制台，点击左上角 **"应用商店"** 或 **"App Store"**
2. 搜索 **"Laf"** 或 **"云函数"**
3. 点击安装 Laf 应用
4. 安装完成后，按照方案 A 的步骤操作

### 验证
✅ 进入云函数编辑页面，可以看到代码编辑器

---

## 🛠️ 步骤 3: 配置云函数代码

### 操作路径
1. 在代码编辑器中，删除默认代码
2. 复制以下完整代码并粘贴：

```javascript
import cloud from '@lafjs/cloud'

/**
 * Module 7: 社交服务云函数
 * 架构原则：Cloud First, Local Fallback
 */
export default async function (ctx: FunctionContext) {
  const { action, ...params } = ctx.body
  
  console.log('[Social Service] 收到请求:', { action, params })
  
  try {
    // 验证用户登录状态
    const user = ctx.user
    if (!user || !user._id) {
      return {
        code: 401,
        msg: '未登录，请先登录'
      }
    }
    
    const currentUid = user._id
    console.log('[Social Service] 当前用户:', currentUid)
    
    // 路由分发
    switch (action) {
      case 'search_user':
        return await searchUser(ctx, params)
      
      case 'send_request':
        return await sendRequest(ctx, currentUid, params)
      
      case 'handle_request':
        return await handleRequest(ctx, currentUid, params)
      
      case 'get_friend_list':
        return await getFriendList(ctx, currentUid, params)
      
      case 'get_friend_requests':
        return await getFriendRequests(ctx, currentUid)
      
      case 'remove_friend':
        return await removeFriend(ctx, currentUid, params)
      
      default:
        return {
          code: 400,
          msg: `未知操作: ${action}`
        }
    }
  } catch (err) {
    console.error('[Social Service] 异常:', err)
    return {
      code: -1,
      msg: err.message || '服务异常'
    }
  }
}

/**
 * 搜索用户
 */
async function searchUser(ctx, params) {
  const { keyword } = params
  
  if (!keyword || keyword.trim().length < 2) {
    return { code: 400, msg: '搜索关键词至少2个字符' }
  }
  
  const db = cloud.database()
  
  // 模糊搜索昵称
  const users = await db.collection('uni-id-users')
    .where({
      nickname: new RegExp(keyword, 'i')
    })
    .field({
      _id: true,
      nickname: true,
      avatar: true,
      score: true
    })
    .limit(10)
    .get()
  
  return {
    code: 0,
    msg: '搜索成功',
    data: users.data
  }
}

/**
 * 发送好友请求
 */
async function sendRequest(ctx, currentUid, params) {
  const { targetUid, message = '' } = params
  
  if (currentUid === targetUid) {
    return { code: 400, msg: '不能添加自己为好友' }
  }
  
  const db = cloud.database()
  const _ = db.command
  
  // 检查是否已经是好友
  const currentUser = await db.collection('uni-id-users')
    .doc(currentUid)
    .get()
  
  const isFriend = currentUser.data?.friends?.some(f => f.uid === targetUid)
  if (isFriend) {
    return { code: 400, msg: '已经是好友了' }
  }
  
  // 检查是否已发送过请求
  const hasSent = currentUser.data?.sent_requests?.some(
    r => r.to_uid === targetUid && r.status === 'pending'
  )
  if (hasSent) {
    return { code: 400, msg: '已发送过好友请求，请等待对方回应' }
  }
  
  // 获取当前用户信息
  const myInfo = await db.collection('uni-id-users')
    .doc(currentUid)
    .field({ nickname: true, avatar: true, score: true })
    .get()
  
  // 向目标用户添加好友请求
  await db.collection('uni-id-users')
    .doc(targetUid)
    .update({
      friend_requests: _.push({
        from_uid: currentUid,
        from_nickname: myInfo.data.nickname,
        from_avatar: myInfo.data.avatar,
        from_score: myInfo.data.score || 0,
        message: message,
        created_at: Date.now(),
        status: 'pending'
      })
    })
  
  // 记录已发送的请求
  await db.collection('uni-id-users')
    .doc(currentUid)
    .update({
      sent_requests: _.push({
        to_uid: targetUid,
        created_at: Date.now(),
        status: 'pending'
      })
    })
  
  return {
    code: 0,
    msg: '好友请求已发送'
  }
}

/**
 * 处理好友请求
 */
async function handleRequest(ctx, currentUid, params) {
  const { fromUid, requestAction } = params
  
  if (!['accept', 'reject'].includes(requestAction)) {
    return { code: 400, msg: '无效的操作类型' }
  }
  
  const db = cloud.database()
  const _ = db.command
  
  // 查找请求
  const currentUser = await db.collection('uni-id-users')
    .doc(currentUid)
    .get()
  
  const request = currentUser.data?.friend_requests?.find(
    r => r.from_uid === fromUid && r.status === 'pending'
  )
  
  if (!request) {
    return { code: 404, msg: '未找到该好友请求' }
  }
  
  // 如果是同意，建立双向好友关系
  if (requestAction === 'accept') {
    const [myInfo, friendInfo] = await Promise.all([
      db.collection('uni-id-users').doc(currentUid).get(),
      db.collection('uni-id-users').doc(fromUid).get()
    ])
    
    const now = Date.now()
    
    // 向我的好友列表添加对方
    await db.collection('uni-id-users')
      .doc(currentUid)
      .update({
        friends: _.push({
          uid: fromUid,
          nickname: friendInfo.data.nickname,
          avatar: friendInfo.data.avatar,
          score: friendInfo.data.score || 0,
          added_at: now,
          last_active: now
        })
      })
    
    // 向对方的好友列表添加我
    await db.collection('uni-id-users')
      .doc(fromUid)
      .update({
        friends: _.push({
          uid: currentUid,
          nickname: myInfo.data.nickname,
          avatar: myInfo.data.avatar,
          score: myInfo.data.score || 0,
          added_at: now,
          last_active: now
        })
      })
  }
  
  // 更新请求状态
  const updatedRequests = currentUser.data.friend_requests.map(r =>
    r.from_uid === fromUid ? { ...r, status: requestAction === 'accept' ? 'accepted' : 'rejected' } : r
  )
  
  await db.collection('uni-id-users')
    .doc(currentUid)
    .update({
      friend_requests: updatedRequests
    })
  
  return {
    code: 0,
    msg: requestAction === 'accept' ? '已添加为好友' : '已拒绝好友请求'
  }
}

/**
 * 获取好友列表
 */
async function getFriendList(ctx, currentUid, params) {
  const { sortBy = 'score' } = params
  
  const db = cloud.database()
  
  const user = await db.collection('uni-id-users')
    .doc(currentUid)
    .get()
  
  let friends = user.data?.friends || []
  
  // 排序
  if (sortBy === 'score') {
    friends.sort((a, b) => (b.score || 0) - (a.score || 0))
  } else if (sortBy === 'active') {
    friends.sort((a, b) => (b.last_active || 0) - (a.last_active || 0))
  } else if (sortBy === 'added') {
    friends.sort((a, b) => (b.added_at || 0) - (a.added_at || 0))
  }
  
  return {
    code: 0,
    msg: '获取成功',
    data: friends
  }
}

/**
 * 获取好友请求列表
 */
async function getFriendRequests(ctx, currentUid) {
  const db = cloud.database()
  
  const user = await db.collection('uni-id-users')
    .doc(currentUid)
    .get()
  
  const pendingRequests = (user.data?.friend_requests || [])
    .filter(r => r.status === 'pending')
    .sort((a, b) => b.created_at - a.created_at)
  
  return {
    code: 0,
    msg: '获取成功',
    data: pendingRequests
  }
}

/**
 * 删除好友
 */
async function removeFriend(ctx, currentUid, params) {
  const { friendUid } = params
  
  const db = cloud.database()
  
  // 从我的好友列表中移除对方
  const myUser = await db.collection('uni-id-users')
    .doc(currentUid)
    .get()
  
  const updatedFriends = myUser.data?.friends?.filter(f => f.uid !== friendUid) || []
  
  await db.collection('uni-id-users')
    .doc(currentUid)
    .update({
      friends: updatedFriends
    })
  
  // 从对方的好友列表中移除我
  const friendUser = await db.collection('uni-id-users')
    .doc(friendUid)
    .get()
  
  const updatedFriendFriends = friendUser.data?.friends?.filter(f => f.uid !== currentUid) || []
  
  await db.collection('uni-id-users')
    .doc(friendUid)
    .update({
      friends: updatedFriendFriends
    })
  
  return {
    code: 0,
    msg: '已删除好友'
  }
}
```

3. 点击 **"保存"** 或 **"Save"** 按钮

### 验证
✅ 代码保存成功，无语法错误提示

---

## 🛠️ 步骤 4: 配置环境变量（可选）

### 操作路径
1. 在云函数页面，找到 **"环境变量"** 或 **"Environment Variables"** 选项卡
2. 如果需要配置特殊参数（如 API 密钥），在此添加

### 验证
✅ 环境变量配置完成（如果不需要可跳过）

---

## 🛠️ 步骤 5: 部署云函数

### 操作路径
1. 点击 **"部署"** 或 **"Deploy"** 按钮
2. 等待部署完成（通常需要 10-30 秒）
3. 查看部署日志，确认无错误

### 验证
✅ 部署成功，状态显示为 **"运行中"** 或 **"Running"**
✅ 获取到云函数的 HTTP 触发器 URL

---

## 🛠️ 步骤 6: 配置数据库索引（性能优化）

### 操作路径
1. 进入 **"数据库"** 或 **"Database"** 管理页面
2. 选择 `uni-id-users` 集合
3. 点击 **"索引"** 或 **"Indexes"** 选项卡
4. 创建以下索引：

#### 索引 1: 好友列表查询
```json
{
  "name": "friends_uid_index",
  "keys": {
    "friends.uid": 1
  }
}
```

#### 索引 2: 好友请求查询
```json
{
  "name": "friend_requests_from_uid_index",
  "keys": {
    "friend_requests.from_uid": 1
  }
}
```

#### 索引 3: 昵称搜索（文本索引）
```json
{
  "name": "nickname_text_index",
  "keys": {
    "nickname": "text"
  }
}
```

### 验证
✅ 索引创建成功，状态显示为 **"活跃"** 或 **"Active"**

---

## 🛠️ 步骤 7: 更新前端配置（我来完成）

### 操作说明
我将为您更新 `src/services/lafService.js` 文件，添加 `socialService` 方法。

### 需要的信息
请提供以下信息（如果您已经完成了步骤 2-6）：
1. **Laf 云函数 URL**：例如 `https://xxx.laf.run/social-service`
2. **是否已部署成功**：云函数状态是否为"运行中"

### 验证
✅ 前端可以正常调用 `lafService.socialService()`

---

## 🛠️ 步骤 8: 测试云函数（可选 - 如果 Laf 有测试功能）

### 操作路径
1. 在 Laf 云函数页面，找到 **"调试"** 或 **"Debug"** 功能
2. 输入测试数据：

```json
{
  "action": "get_friend_list",
  "sortBy": "score"
}
```

3. 点击 **"运行"** 或 **"Run"** 按钮
4. 查看返回结果

### 预期结果
```json
{
  "code": 0,
  "msg": "获取成功",
  "data": []
}
```

### ⚠️ 如果无法测试
如果 Laf 没有内置测试功能，可以跳过此步骤，直接在前端测试。

### 验证
✅ 云函数返回正确的 JSON 格式数据
✅ 无报错信息

---

## 📋 完成检查清单

请确认以下所有项目都已完成：

- [ ] 云函数 `social-service` 创建成功
- [ ] 云函数代码已部署
- [ ] 云函数状态为 **"运行中"**
- [ ] 数据库索引已创建（3个）
- [ ] 前端 `lafService.js` 已配置
- [ ] 云函数测试通过

---

## 🎯 下一步

完成以上配置后，请执行以下操作：

1. **前端测试**：
   ```bash
   # 在微信开发者工具中打开好友列表页面
   # 路径：src/pages/social/friend-list.vue
   ```

2. **功能验证**：
   - 测试获取好友列表
   - 测试搜索用户
   - 测试发送好友请求
   - 测试接受/拒绝好友请求

3. **日志监控**：
   - 在 Sealos 云函数页面查看实时日志
   - 确认请求和响应正常

---

## ⚠️ 常见问题

### Q1: 云函数部署失败
**解决方案**：
- 检查代码语法是否正确
- 确认运行时版本选择正确（Node.js 18+）
- 查看部署日志中的错误信息

### Q2: 数据库索引创建失败
**解决方案**：
- 确认集合名称正确（`uni-id-users`）
- 检查字段路径是否正确（如 `friends.uid`）
- 如果是文本索引，确认数据库支持

### Q3: 前端调用云函数失败
**解决方案**：
- 检查 `lafService.js` 中的 URL 配置
- 确认用户已登录（云函数需要验证登录状态）
- 查看浏览器控制台的网络请求日志

---

## 📞 需要帮助？

如果遇到无法解决的问题，请提供以下信息：
1. 错误截图
2. 云函数日志
3. 浏览器控制台日志
4. 具体的操作步骤

---

**文档状态**: ✅ 完成  
**最后更新**: 2026-01-23  
**适用版本**: Module 7 Phase 1
