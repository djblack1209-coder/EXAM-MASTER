# Module 7: 社交功能设计文档 (Social Features Design)

> **版本**: V1.0  
> **创建时间**: 2026-01-23  
> **状态**: 设计阶段 → 待实施  
> **架构原则**: Cloud First, Local Fallback

---

## 1. 功能概述 (Feature Overview)

### 1.1 核心目标
- 打通用户间的社交连接，增强 Module 9（排行榜）和 Module 10（PK 对战）的活跃度
- 提供简单高效的好友系统，支持好友 PK 邀请
- 降低用户获取对手的门槛，提升留存率

### 1.2 功能范围 (V1.0)
- ✅ **好友系统**：双向好友关系（需双方同意）
- ✅ **好友搜索**：通过昵称/用户ID搜索用户
- ✅ **好友请求**：发送/接受/拒绝好友请求
- ✅ **好友列表**：查看好友列表，显示在线状态和最近活跃时间
- ✅ **好友 PK**：从好友列表发起 PK 挑战（链接到 Module 10）
- ❌ **聊天功能**：V1.0 不包含（V2.0 考虑）
- ❌ **动态/朋友圈**：V1.0 不包含

---

## 2. 数据库设计 (Database Schema)

### 2.1 设计原则
1. **嵌入式数组优先**：好友列表存储在用户文档中，减少跨表查询
2. **冗余换性能**：存储好友的昵称和头像快照，避免每次查询都关联用户表
3. **索引优化**：为高频查询字段（如 `friends.uid`）建立索引

### 2.2 用户表扩展 (uni-id-users)

在现有的 `uni-id-users` 表中扩展以下字段：

```json
{
  "_id": "user_xxx",
  "nickname": "考研人",
  "avatar": "https://...",
  "score": 1200,
  
  // ========== Module 7 新增字段 ==========
  
  // 好友列表（双向关系，已同意的好友）
  "friends": [
    {
      "uid": "user_yyy",           // 好友用户ID
      "nickname": "学霸张",         // 好友昵称（快照）
      "avatar": "https://...",     // 好友头像（快照）
      "score": 1500,               // 好友分数（快照，用于排序）
      "added_at": 1737600000000,   // 添加时间（时间戳）
      "last_active": 1737610000000 // 最近活跃时间（用于显示在线状态）
    }
  ],
  
  // 待处理的好友请求（收到的请求）
  "friend_requests": [
    {
      "from_uid": "user_zzz",      // 发送者用户ID
      "from_nickname": "考研小白",  // 发送者昵称（快照）
      "from_avatar": "https://...", // 发送者头像（快照）
      "from_score": 800,            // 发送者分数（快照）
      "message": "一起刷题吧！",     // 请求附言（可选）
      "created_at": 1737605000000,  // 请求时间
      "status": "pending"           // 状态：pending/accepted/rejected
    }
  ],
  
  // 已发送的好友请求（我发出的请求）
  "sent_requests": [
    {
      "to_uid": "user_aaa",
      "to_nickname": "上岸锦鲤",
      "created_at": 1737605000000,
      "status": "pending"
    }
  ],
  
  // 社交统计（用于展示）
  "social_stats": {
    "friends_count": 5,            // 好友数量
    "pk_wins": 12,                 // PK 胜利次数
    "pk_total": 20                 // PK 总次数
  }
}
```

### 2.3 索引设计

```javascript
// 索引 1: 好友列表查询（按用户ID）
db.collection('uni-id-users').createIndex({ "friends.uid": 1 })

// 索引 2: 好友请求查询（按发送者ID）
db.collection('uni-id-users').createIndex({ "friend_requests.from_uid": 1 })

// 索引 3: 昵称搜索（模糊查询）
db.collection('uni-id-users').createIndex({ "nickname": "text" })
```

---

## 3. 云对象接口设计 (Cloud Function API)

### 3.1 云对象：`social-service`

新建云对象 `social-service`，提供以下方法：

#### 3.1.1 搜索用户 (Search User)

```javascript
/**
 * 搜索用户（通过昵称或用户ID）
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回结果数量限制（默认10）
 * @returns {Array} 用户列表
 */
async searchUser({ keyword, limit = 10 }) {
  // 输入验证
  if (!keyword || keyword.trim().length < 2) {
    return { code: 400, msg: '搜索关键词至少2个字符' }
  }
  
  // 查询逻辑（模糊匹配昵称）
  const users = await db.collection('uni-id-users')
    .where({
      nickname: new RegExp(keyword, 'i') // 不区分大小写
    })
    .field({
      _id: true,
      nickname: true,
      avatar: true,
      score: true,
      'social_stats.friends_count': true
    })
    .limit(limit)
    .get()
  
  return {
    code: 0,
    msg: '搜索成功',
    data: users.data
  }
}
```

#### 3.1.2 发送好友请求 (Send Friend Request)

```javascript
/**
 * 发送好友请求
 * @param {string} targetUid - 目标用户ID
 * @param {string} message - 请求附言（可选）
 * @returns {Object} 操作结果
 */
async sendRequest({ targetUid, message = '' }) {
  const currentUid = this.getUniIdToken().uid
  
  // 1. 验证：不能添加自己
  if (currentUid === targetUid) {
    return { code: 400, msg: '不能添加自己为好友' }
  }
  
  // 2. 验证：是否已经是好友
  const currentUser = await db.collection('uni-id-users')
    .doc(currentUid)
    .field({ friends: true })
    .get()
  
  const isFriend = currentUser.data[0].friends?.some(f => f.uid === targetUid)
  if (isFriend) {
    return { code: 400, msg: '已经是好友了' }
  }
  
  // 3. 验证：是否已发送过请求
  const hasSent = currentUser.data[0].sent_requests?.some(r => r.to_uid === targetUid && r.status === 'pending')
  if (hasSent) {
    return { code: 400, msg: '已发送过好友请求，请等待对方回应' }
  }
  
  // 4. 获取当前用户信息（用于快照）
  const myInfo = await db.collection('uni-id-users')
    .doc(currentUid)
    .field({ nickname: true, avatar: true, score: true })
    .get()
  
  // 5. 向目标用户添加好友请求
  await db.collection('uni-id-users')
    .doc(targetUid)
    .update({
      friend_requests: db.command.push({
        from_uid: currentUid,
        from_nickname: myInfo.data[0].nickname,
        from_avatar: myInfo.data[0].avatar,
        from_score: myInfo.data[0].score || 0,
        message: message,
        created_at: Date.now(),
        status: 'pending'
      })
    })
  
  // 6. 记录已发送的请求
  await db.collection('uni-id-users')
    .doc(currentUid)
    .update({
      sent_requests: db.command.push({
        to_uid: targetUid,
        to_nickname: '', // 可选：存储目标用户昵称
        created_at: Date.now(),
        status: 'pending'
      })
    })
  
  return {
    code: 0,
    msg: '好友请求已发送'
  }
}
```

#### 3.1.3 处理好友请求 (Handle Friend Request)

```javascript
/**
 * 处理好友请求（同意/拒绝）
 * @param {string} fromUid - 发送者用户ID
 * @param {string} action - 操作：'accept' 或 'reject'
 * @returns {Object} 操作结果
 */
async handleRequest({ fromUid, action }) {
  const currentUid = this.getUniIdToken().uid
  
  // 1. 验证操作类型
  if (!['accept', 'reject'].includes(action)) {
    return { code: 400, msg: '无效的操作类型' }
  }
  
  // 2. 查找请求
  const currentUser = await db.collection('uni-id-users')
    .doc(currentUid)
    .field({ friend_requests: true })
    .get()
  
  const request = currentUser.data[0].friend_requests?.find(
    r => r.from_uid === fromUid && r.status === 'pending'
  )
  
  if (!request) {
    return { code: 404, msg: '未找到该好友请求' }
  }
  
  // 3. 如果是同意，建立双向好友关系
  if (action === 'accept') {
    // 3.1 获取双方用户信息
    const [myInfo, friendInfo] = await Promise.all([
      db.collection('uni-id-users').doc(currentUid).field({ nickname: true, avatar: true, score: true }).get(),
      db.collection('uni-id-users').doc(fromUid).field({ nickname: true, avatar: true, score: true }).get()
    ])
    
    const now = Date.now()
    
    // 3.2 向我的好友列表添加对方
    await db.collection('uni-id-users')
      .doc(currentUid)
      .update({
        friends: db.command.push({
          uid: fromUid,
          nickname: friendInfo.data[0].nickname,
          avatar: friendInfo.data[0].avatar,
          score: friendInfo.data[0].score || 0,
          added_at: now,
          last_active: now
        }),
        'social_stats.friends_count': db.command.inc(1)
      })
    
    // 3.3 向对方的好友列表添加我
    await db.collection('uni-id-users')
      .doc(fromUid)
      .update({
        friends: db.command.push({
          uid: currentUid,
          nickname: myInfo.data[0].nickname,
          avatar: myInfo.data[0].avatar,
          score: myInfo.data[0].score || 0,
          added_at: now,
          last_active: now
        }),
        'social_stats.friends_count': db.command.inc(1)
      })
  }
  
  // 4. 更新请求状态（无论同意还是拒绝）
  await db.collection('uni-id-users')
    .doc(currentUid)
    .update({
      friend_requests: currentUser.data[0].friend_requests.map(r => 
        r.from_uid === fromUid ? { ...r, status: action === 'accept' ? 'accepted' : 'rejected' } : r
      )
    })
  
  // 5. 更新发送者的 sent_requests 状态
  const senderUser = await db.collection('uni-id-users')
    .doc(fromUid)
    .field({ sent_requests: true })
    .get()
  
  await db.collection('uni-id-users')
    .doc(fromUid)
    .update({
      sent_requests: senderUser.data[0].sent_requests?.map(r =>
        r.to_uid === currentUid ? { ...r, status: action === 'accept' ? 'accepted' : 'rejected' } : r
      )
    })
  
  return {
    code: 0,
    msg: action === 'accept' ? '已添加为好友' : '已拒绝好友请求'
  }
}
```

#### 3.1.4 获取好友列表 (Get Friend List)

```javascript
/**
 * 获取好友列表
 * @param {string} sortBy - 排序方式：'score'（分数）、'active'（活跃度）、'added'（添加时间）
 * @returns {Array} 好友列表
 */
async getFriendList({ sortBy = 'score' }) {
  const currentUid = this.getUniIdToken().uid
  
  // 1. 获取好友列表
  const user = await db.collection('uni-id-users')
    .doc(currentUid)
    .field({ friends: true })
    .get()
  
  let friends = user.data[0].friends || []
  
  // 2. 排序
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
```

#### 3.1.5 获取好友请求列表 (Get Friend Requests)

```javascript
/**
 * 获取好友请求列表（收到的请求）
 * @returns {Array} 好友请求列表
 */
async getFriendRequests() {
  const currentUid = this.getUniIdToken().uid
  
  const user = await db.collection('uni-id-users')
    .doc(currentUid)
    .field({ friend_requests: true })
    .get()
  
  // 只返回待处理的请求
  const pendingRequests = (user.data[0].friend_requests || [])
    .filter(r => r.status === 'pending')
    .sort((a, b) => b.created_at - a.created_at) // 按时间倒序
  
  return {
    code: 0,
    msg: '获取成功',
    data: pendingRequests
  }
}
```

#### 3.1.6 删除好友 (Remove Friend)

```javascript
/**
 * 删除好友
 * @param {string} friendUid - 好友用户ID
 * @returns {Object} 操作结果
 */
async removeFriend({ friendUid }) {
  const currentUid = this.getUniIdToken().uid
  
  // 1. 从我的好友列表中移除对方
  const myUser = await db.collection('uni-id-users')
    .doc(currentUid)
    .field({ friends: true })
    .get()
  
  const updatedFriends = myUser.data[0].friends?.filter(f => f.uid !== friendUid) || []
  
  await db.collection('uni-id-users')
    .doc(currentUid)
    .update({
      friends: updatedFriends,
      'social_stats.friends_count': db.command.inc(-1)
    })
  
  // 2. 从对方的好友列表中移除我
  const friendUser = await db.collection('uni-id-users')
    .doc(friendUid)
    .field({ friends: true })
    .get()
  
  const updatedFriendFriends = friendUser.data[0].friends?.filter(f => f.uid !== currentUid) || []
  
  await db.collection('uni-id-users')
    .doc(friendUid)
    .update({
      friends: updatedFriendFriends,
      'social_stats.friends_count': db.command.inc(-1)
    })
  
  return {
    code: 0,
    msg: '已删除好友'
  }
}
```

---

## 4. 前端服务封装 (Frontend Service)

### 4.1 创建 `socialService.js`

在 `src/services/` 目录下创建 `socialService.js`：

```javascript
import { lafService } from './lafService.js'

/**
 * 社交服务（Module 7）
 * 架构原则：Cloud First, Local Fallback
 */
export const socialService = {
  /**
   * 搜索用户
   */
  async searchUser(keyword) {
    try {
      const res = await lafService.socialService({
        action: 'search_user',
        keyword: keyword
      })
      return res
    } catch (err) {
      console.error('[Social] 搜索用户失败:', err)
      return { code: -1, msg: '搜索失败', data: [] }
    }
  },
  
  /**
   * 发送好友请求
   */
  async sendRequest(targetUid, message = '') {
    try {
      const res = await lafService.socialService({
        action: 'send_request',
        targetUid: targetUid,
        message: message
      })
      return res
    } catch (err) {
      console.error('[Social] 发送好友请求失败:', err)
      return { code: -1, msg: '发送失败' }
    }
  },
  
  /**
   * 处理好友请求
   */
  async handleRequest(fromUid, action) {
    try {
      const res = await lafService.socialService({
        action: 'handle_request',
        fromUid: fromUid,
        requestAction: action // 'accept' 或 'reject'
      })
      return res
    } catch (err) {
      console.error('[Social] 处理好友请求失败:', err)
      return { code: -1, msg: '操作失败' }
    }
  },
  
  /**
   * 获取好友列表（支持本地缓存）
   */
  async getFriendList(sortBy = 'score', useCache = true) {
    // 1. 尝试从本地缓存读取
    if (useCache) {
      const cached = uni.getStorageSync('friend_list_cache')
      const cacheTime = uni.getStorageSync('friend_list_cache_time')
      const now = Date.now()
      
      // 缓存有效期：5分钟
      if (cached && cacheTime && (now - cacheTime < 5 * 60 * 1000)) {
        console.log('[Social] 使用缓存的好友列表')
        return { code: 0, msg: '获取成功（缓存）', data: cached }
      }
    }
    
    // 2. 从云端获取
    try {
      const res = await lafService.socialService({
        action: 'get_friend_list',
        sortBy: sortBy
      })
      
      // 3. 更新本地缓存
      if (res.code === 0 && res.data) {
        uni.setStorageSync('friend_list_cache', res.data)
        uni.setStorageSync('friend_list_cache_time', Date.now())
      }
      
      return res
    } catch (err) {
      console.error('[Social] 获取好友列表失败:', err)
      
      // 4. 降级：返回缓存数据（即使过期）
      const cached = uni.getStorageSync('friend_list_cache')
      if (cached) {
        console.warn('[Social] 云端失败，使用过期缓存')
        return { code: 0, msg: '获取成功（降级缓存）', data: cached }
      }
      
      return { code: -1, msg: '获取失败', data: [] }
    }
  },
  
  /**
   * 获取好友请求列表
   */
  async getFriendRequests() {
    try {
      const res = await lafService.socialService({
        action: 'get_friend_requests'
      })
      return res
    } catch (err) {
      console.error('[Social] 获取好友请求失败:', err)
      return { code: -1, msg: '获取失败', data: [] }
    }
  },
  
  /**
   * 删除好友
   */
  async removeFriend(friendUid) {
    try {
      const res = await lafService.socialService({
        action: 'remove_friend',
        friendUid: friendUid
      })
      
      // 删除成功后清除缓存
      if (res.code === 0) {
        uni.removeStorageSync('friend_list_cache')
        uni.removeStorageSync('friend_list_cache_time')
      }
      
      return res
    } catch (err) {
      console.error('[Social] 删除好友失败:', err)
      return { code: -1, msg: '删除失败' }
    }
  },
  
  /**
   * 清除好友列表缓存
   */
  clearCache() {
    uni.removeStorageSync('friend_list_cache')
    uni.removeStorageSync('friend_list_cache_time')
    console.log('[Social] 已清除好友列表缓存')
  }
}
```

---

## 5. UI 页面规划

### 5.1 页面结构

```
src/pages/social/
├── friend-list.vue       # 好友列表页
├── friend-requests.vue   # 好友请求页
├── search-user.vue       # 搜索用户页
└── friend-profile.vue    # 好友资料页
```

### 5.2 页面路由配置 (pages.json)

```json
{
  "path": "pages/social/friend-list",
  "style": {
    "navigationBarTitleText": "我的好友",
    "enablePullDownRefresh": true
  }
},
{
  "path": "pages/social/friend-requests",
  "style": {
    "navigationBarTitleText": "好友请求"
  }
},
{
  "path": "pages/social/search-user",
  "style": {
    "navigationBarTitleText": "添加好友"
  }
},
{
  "path": "pages/social/friend-profile",
  "style": {
    "navigationBarTitleText": "好友资料"
  }
}
```

---

## 6. 开发优先级

### Phase 1: 数据层（本阶段）
- [x] 数据库 Schema 设计
- [x] 云对象接口设计
- [x] 前端服务封装
- [ ] Sealos 后端实现（需要在 Sealos 创建 `social-service` 云函数）

### Phase 2: UI 层
- [ ] 好友列表页（`friend-list.vue`）
- [ ] 搜索用户页（`search-user.vue`）
- [ ] 好友请求页（`friend-requests.vue`）
- [ ] 好友资料页（`friend-profile.vue`）

### Phase 3: 集成
- [ ] 与 Module 9（排行榜）集成：从排行榜添加好友
- [ ] 与 Module 10（PK 对战）集成：好友 PK 邀请
- [ ] 首页入口：显示好友请求红点提示

---

## 7. 测试计划

### 7.1 单元测试
- [ ] 搜索用户功能
- [ ] 发送好友请求
- [ ] 接受/拒绝好友请求
- [ ] 好友列表排序
- [ ] 删除好友

### 7.2 集成测试
- [ ] 双向好友关系验证
- [ ] 缓存机制验证
- [ ] 降级策略验证

### 7.3 边界测试
- [ ] 重复发送好友请求
- [ ] 添加自己为好友
- [ ] 网络异常处理

---

## 8. 注意事项

### 8.1 性能优化
- 好友列表使用本地缓存，减少云端请求
- 好友数量限制：建议 V1.0 限制为 100 人

### 8.2 安全考虑
- 所有接口需验证用户登录状态
- 防止恶意刷好友请求（限流）

### 8.3 数据一致性
- 好友关系必须是双向的
- 删除好友时需同步更新双方数据

---

## 9. 下一步行动

1. **立即执行**：在 Sealos 后端创建 `social-service` 云函数
2. **UI 开发**：搭建好友列表页面骨架
3. **集成测试**：与 Module 9 和 Module 10 联调

---

**文档状态**: ✅ 设计完成，等待实施  
**预计工作量**: 2-3 天（包含后端 + 前端 + 测试）
