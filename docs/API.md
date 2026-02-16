# Exam-Master 后端 API 文档

> 基础地址: `https://nf98ia8qnt.sealosbja.site`
> 认证方式: JWT Token（通过 `body.token` 或 `Authorization` header 传递）
> 请求格式: `POST` JSON，所有接口通过 `action` 字段分发

---

## 一、认证服务

### login.ts — 用户登录

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `wechat` | `code` | 否 | 微信小程序登录（code 换 openid） |
| `wechat_h5` | `code` | 否 | 微信 H5 OAuth 登录（公众号授权） |
| `email_code` | `email`, `code` | 否 | 邮箱验证码登录 |
| `email_password` | `email`, `password` | 否 | 邮箱密码登录 |
| `register` | `email`, `password`, `code`, `nickname` | 否 | 邮箱注册（需验证码，密码强度校验） |

返回: `{ code, token, userInfo, isNewUser }`

### send-email-code.js — 发送邮箱验证码

| 参数 | 说明 |
|------|------|
| `email` | 目标邮箱，1 分钟频率限制 |

### upload-avatar.ts — 头像上传

- 方式: `multipart/form-data`，字段 `file`
- 认证: JWT（Authorization header）
- 返回: `{ url }` 头像永久 URL

---

## 二、练习服务

### question-bank.js — 题库查询

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `get` | `category?`, `sub_category?`, `difficulty?`, `type?`, `tags?`, `keyword?`, `page?`, `pageSize?` | 否 | 分页查询题目 |
| `random` | `category?`, `difficulty?`, `count?` | 否 | 随机抽题 |
| `getByIds` | `ids[]` | 否 | 按 ID 批量获取 |

### mistake-manager.ts — 错题管理

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `add` | `data: { question_id, content, answer, user_answer, category, error_type }` | JWT | 添加错题（内容哈希去重） |
| ta: { page?, pageSize?, is_mastered?, category?, error_type? }` | JWT | 分页查询错题 |
| `update` | `data: { id, ...fields }` | JWT | 更新错题信息 |
| `remove` | `data: { id }` | JWT | 删除错题 |
| `batchSync` | `data: { mistakes[] }` | JWT | 批量同步（并行 5 条/批） |
| `getCategories` | — | JWT | 获取错题分类统计 |
| `manageTags` | `data: { action: 'add'|'remove'|'rename'|'list', mistakeId?, tags?, oldTag?, newTag? }` | JWT | 标签管理 |
| `getByTags` | `data: { tags[], page?, pageSize? }` | JWT | 按标签筛选 |

### answer-submit.ts — 答题提交

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `s `data: { question_id, answer, is_correct, practice_mode, time_spent }`, `idempotencyKey` | 否 | 提交答题记录（幂等） |
| `getRecords` | `data: { category?, is_correct?, page?, pageSize? }` | 否 | 查询答题记录 |

### favorite-manager.ts — 收藏管理

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `add` | `data: { question_id, category?, source? }` | 否 | 添加收藏 |
| `remove` | `data: { id? \| question_id? }` | 否 | 取消收藏 |
| `get` | `data: { category?, source?, page?, pageSize? }` | 否 | 查询收藏列表 |
| `check` | `data: { question_id }` | 否 | 检查是否已收藏 |

### material-manager.js — 用户资料管理

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `save_upload_record` | `data: { filename, type, size }` | JWT | 保存上传记录 |
| `get_upload_records` | — | JWT | 获取上传记录 |
| `delete_upload_record` | `data: { id }` | JWT | 删除上传记录 |
| `save_questions` | `data: { questions[], materialId? }` | JWT | 保存解析题目 |
| `get_questions` | `data: { materialId?, tags?, difficulty? }` | JWT | 查询题目 |
| `delete_questions` | `data: { ids[] }` | JWT | 删除题目 |
| `sync_questions` | `data: { questions[] }` | JWT | 同步题目 |
| `get_stats` | — | JWT | 获取资料统计 |

---

## 三、学习服务

### learning-goal.ts — 学习目标

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `create` | `data: { type, target, deadline? }` | JWT | 创建目标 |
| `get` | `data: { status?, type? }` | JWT | 查询目标列表 |
| `update` | `data: { id, ...fields }` | JWT | 更新目标 |
| `remove` | `data: { id }` | JWT | 删除目标 |
| `getTodayProgress` | — | JWT | 获取今日进度 |
| `recordProgress` | `data: { type, value }` | JWT | 记录进度增量 |

### achievement-manager.ts — 成就系统

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `getAll` | — | JWT | 获取全部成就定义 |
| `unlock` | `data: { achievementId }` | JWT | 解锁成就 |
| `check` | — | JWT | 自动检测并解锁满足条件的成就 |
| `getUnlocked` | — | JWT | 获取已解锁成就列表 |

### user-stats.ts — 用户统计

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `getOverview` | — | JWT | 获取学习概览 |
| `getDailyStats` | — | JWT | 获取每日统计 |
| `getTrend` | `data: { days? }` | JWT | 获取趋势数据 |
| `recordStudyTime` | `data: { duration }` | JWT | 记录学习时长 |
| `updateStreak` | — | JWT | 更新连续打卡 |
| `getRankInfo` | — | JWT | 获取排名信息 |

### study-stats.js — 学习统计（简版）

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `get` | — | JWT | 获取总体统计 |
| `daily` | — | JWT | 获取每日统计 |
| `weekly` | — | JWT | 获取每周统计 |

### user-profile.ts — 用户资料

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `get` | — | 否 | 获取用户资料 |
| `update` | `data: { nickname?, avatar?, ... }` | JWT | 更新资料 |
| `upload_avatar` | — | JWT | 上传头像 |
| `get_practice_config` | — | 否 | 获取练习配置 |
| `update_practice_config` | `data: { show_answer_immediately?, auto_next?, shuffle_options?, reminder_enabled? }` | JWT | 更新练习配置 |

### learning-resource.ts — 学习资源

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `getList` | `data: { subject?, category?, period?, page?, pageSize? }` | 否 | 资源列表 |
| `getDetail` | `data: { id }` | 否 | 资源详情 |
| `search` | `data: { keyword, subject?, category? }` | 否 | 搜索资源 |
| `favorite` | `data: { resourceId, action: 'add'|'remove' }` | 否 | 收藏/取消 |

---

## 四、社交服务

### social-service.ts — 好友系统

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `sendRequest` | `targetUserId` | 否 | 发送好友请求 |
| `acceptRequest` | `requestId` | 否 | 接受好友请求 |
| `rejectRequest` | `requestId` | 否 | 拒绝好友请求 |
| `getFriends` | `page?`, `pageSize?` | 否 | 获取好友列表 |
| `getRequests` | — | 否 | 获取待处理请求 |
| `removeFriend` | `friendId` | 否 | 删除好友 |

### group-service.js — 学习小组

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `create` | `name`, `description?`, `maxMembers?` | JWT | 创建小组 |
| `join` | `groupId` | JWT | 加入小组 |
| `leave` | `groupId` | JWT | 退出小组 |
| `getList` | `type?: 'joined'`, `page?`, `pageSize?` | JWT | 小组列表 |
| `getDetail` | `groupId` | JWT | 小组详情（含成员） |
| `getResources` | `groupId`, `type?`, `page?`, `pageSize?` | JWT | 小组资源 |
| `shareResource` | `groupId`, `resource` | JWT | 分享资源 |
| `dissolve` | `groupId` | JWT | 解散小组 |

### rank-center.ts — 排行榜

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `submit` | `uid`, `score`, `nickName?`, `avatarUrl?`, `rankType?` | 否 | 提交分数 |
| `getTop` | `rankType?`, `limit?` | 否 | 获取排行榜 |
| `getRank` | `uid`, `rankType?` | 否 | 获取个人排名 |

### pk-battle.ts — PK 对战

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `create` | `userId`, `mode?` | 否 | 创建对战 |
| `join` | `battleId`, `userId` | 否 | 加入对战 |
| `submit` | `battleId`, `userId`, `score`, `idempotencyKey` | 否 | 提交成绩（幂等+反作弊） |
| `getResult` | `battleId` | 否 | 获取对战结果 |
| `getHistory` | `userId`, `page?`, `pageSize?` | 否 | 对战历史 |

### ai-friend-memory.js — AI 好友记忆

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `get` | `friendType?` | JWT | 获取对话记忆 |
| `save` | `friendType`, `data: { messages }` | JWT | 保存对话记忆 |
| `clear` | `friendType?` | JWT | 清除记忆 |

---

## 五、AI 服务

### proxy-ai.ts — AI 代理（20 次/分钟限流）

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `generate` / `generate_questions` | `content`, `count?`, `difficulty?` | JWT | AI 生成题目 |
| `analyze` | `content` | JWT | 错题分析 |
| `chat` | `content`, `context?` | JWT | AI 聊天 |
| `adaptive_pick` | `content` | JWT | 自适应选题 |
| `material_understand` | `content` | JWT | 资料理解 |
| `trend_predict` | `content` | JWT | 趋势预测 |
| `friend_chat` | `content`, `friendType`, `context?` | JWT | AI 好友对话 |
| `vision` | `content`, `imageBase64?` | JWT | 视觉识别 |
| `consult` | `content`, `context?` | JWT | 择校咨询 |

### ai-photo-search.ts — 拍照搜题

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `search` / `recognize` | `imageBase64` 或 `imageUrl` | 否 | OCR 识别 + 题目匹配 |
| `generate_solution` | `questionText`, `subject?` | 否 | 生成解题步骤 |
| `get_subjects` | — | 否 | 获取支持的学科列表 |

---

## 六、择校服务

### school-query.js — 院校查询

| Action | 参数 | 认证 | 说明 |
|--------|------|------|------|
| `list` | `data: { province?, level?, type?, tags?, page?, pageSize? }` | 否 | 院校列表 |
| `detail` | `data: { id }` | 否 | 院校详情 |
| `search` | `data: { keyword, page?, pageSize? }` | 否 | 搜索院校 |
| `hot` | `data: { limit? }` | 否 | 热门院校 |
| `majors` | `data: { schoolId }` | 否 | 专业列表 |
| `major_detail` | `data: { schoolId, majorId }` | 否 | 专业详情 |
| `score_lines` | `data: { schoolId, year? }` | 否 | 分数线 |
| `national_lines` | `data: { year? }` | 否 | 国家线（limit 200） |
| `admission_ratios` | `data: { schoolId }` | 否 | 报录比 |
| `provinces` | — | 否 | 省份列表 |
| `stats` | — | 否 | 统计数据 |
| `add_favorite` | `data: { schoolId }` | JWT | 收藏院校 |
| `remove_favorite` | `data: { schoolId }` | JWT | 取消收藏 |
| `get_favorites` | — | JWT | 收藏列表 |

### school-crawler-api.ts — 院校数据爬虫（管理接口）

| Action | 参数 | 说明 |
|--------|------|------|
| `list` | `data: { page?, pageSize? }` | 已爬取院校列表 |
| `refresh` | `data: { schoolId }` | 刷新单个院校 |
| `by_province` | `data: { province }` | 按省份查询 |
| `provinces` | — | 省份列表 |
| `status` | — | 爬虫状态 |
| `crawl_all` | — | 全量爬取 |

---

## 七、工具服务

### doc-convert.ts — 文档转换

| Action | 参数 | 说明 |
|--------|------|------|
| `convert` | `fileBase64`, `fromType`, `toType` | 文档格式转换 |
| `get_status` | `taskId` | 查询转换状态 |
| `get_types` | — | 支持的格式列表 |
| `get_result` | `taskId` | 获取转换结果 |

### photo-bg.ts — 证件照处理

| Action | 参数 | 说明 |
|--------|------|------|
| `remove_bg` | `imageBase64` | 去除背景 |
| `change_bg` | `imageBase64`, `color` | 更换背景色 |
| `process` / `beauty` | `imageBase64` | 美颜处理 |
| `get_sizes` | — | 证件照尺寸列表 |
| `get_colors` | — | 背景色列表 |

### voice-service.ts — 语音服务

| Action | 参数 | 说明 |
|--------|------|------|
| `speech_to_text` / `stt` | `audioBase64`, `format?` | 语音转文字 |
| `text_to_speech` / `tts` | `text`, `voice?` | 文字转语音 |
| `get_voices` | — | 可用语音列表 |

### id-photo-segment-base64.ts — 人像分割

- 输入: `imageBase64`
- 输出: 分割后的 Base64 图片

---

## 八、系统服务

### health-check.ts — 健康检查

- `GET /health` → `{ status: 'ok' }`

### data-cleanup.ts — 数据清理（管理接口）

- 支持清理: `users`, `questions`, `practice_records`, `mistake_book`, `idempotency_records`, `rankings`, `friends`

---

## 通用响应格式

```json
{
  "code": 0,
  "success": true,
  "message": "操作成功",
  "data": { ... },
  "requestId": "uuid"
}
```

错误码: `400` 参数错误, `401` 未授权, `403` 权限不足, `429` 请求过频, `500` 服务器错误
