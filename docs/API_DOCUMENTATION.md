# EXAM-MASTER API 文档

> 版本: 2.0.0  
> 更新日期: 2026-02-06  
> 基础URL: `https://nf98ia8qnt.sealosbja.site`

## 目录

1. [通用说明](#通用说明)
2. [用户模块](#用户模块)
3. [练习模块](#练习模块)
4. [错题模块](#错题模块)
5. [收藏模块](#收藏模块)
6. [AI服务模块](#ai服务模块)
7. [社交模块](#社交模块)
8. [院校模块](#院校模块)
9. [学习资源模块](#学习资源模块)

---

## 通用说明

### 请求格式

所有API请求使用 `POST` 方法，请求体为 JSON 格式。

```http
POST /云函数名称
Content-Type: application/json
Authorization: Bearer <token>  // 需要认证的接口

{
  "action": "操作类型",
  "参数1": "值1",
  "参数2": "值2"
}
```

### 响应格式

所有API响应遵循统一格式：

```json
{
  "code": 0,           // 0=成功, 非0=失败
  "success": true,     // 是否成功
  "message": "success", // 提示信息
  "data": {},          // 返回数据
  "requestId": "req_xxx", // 请求ID（用于问题追踪）
  "duration": 123      // 处理耗时(ms)
}
```

### 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 400 | 参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
| 502 | 上游服务错误 |
| 503 | 服务暂时不可用 |

---

## 用户模块

### 1. 用户登录

**云函数**: `login`

#### 微信登录

```json
{
  "action": "wx_login",
  "code": "微信登录code"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "token": "jwt_token",
    "userId": "user_001",
    "isNewUser": false,
    "userInfo": {
      "nickname": "考研小王",
      "avatar_url": "https://...",
      "role": "user"
    }
  }
}
```

#### QQ登录

```json
{
  "action": "qq_login",
  "code": "QQ授权code",
  "redirect_uri": "回调地址"
}
```

### 2. 用户资料管理

**云函数**: `user-profile`

#### 获取用户资料

```json
{
  "action": "get",
  "userId": "user_001"
}
```

#### 更新用户资料

```json
{
  "action": "update",
  "userId": "user_001",
  "nickname": "新昵称",
  "avatar_url": "https://...",
  "target_school": "清华大学",
  "target_major": "计算机科学"
}
```

#### 上传头像

```json
{
  "action": "upload_avatar",
  "userId": "user_001",
  "avatar_base64": "base64编码的图片数据",
  "avatar_type": "image/jpeg"
}
```

#### 获取/更新练习配置

```json
{
  "action": "get_practice_config",
  "userId": "user_001"
}
```

```json
{
  "action": "update_practice_config",
  "userId": "user_001",
  "practice_config": {
    "default_mode": "normal",
    "question_count": 20,
    "time_limit": 30,
    "show_answer_immediately": true,
    "difficulty_preference": "adaptive"
  }
}
```

---

## 练习模块

### 1. 获取题目

**云函数**: `question-bank`

```json
{
  "action": "get_questions",
  "category": "政治",
  "sub_category": "马原",
  "difficulty": "medium",
  "count": 10,
  "excludeIds": ["q_001", "q_002"]
}
```

### 2. 提交答案

**云函数**: `answer-submit`

```json
{
  "action": "submit",
  "userId": "user_001",
  "questionId": "q_001",
  "userAnswer": "A",
  "duration": 45,
  "sessionId": "session_xxx"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "isCorrect": true,
    "correctAnswer": "A",
    "analysis": "解析内容...",
    "stats": {
      "totalAttempts": 100,
      "correctRate": 0.85
    }
  }
}
```

### 3. 获取练习记录

**云函数**: `practice-records`

```json
{
  "action": "get_history",
  "userId": "user_001",
  "page": 1,
  "limit": 20,
  "category": "政治"
}
```

---

## 错题模块

### 云函数: `mistake-manager`

### 1. 获取错题列表

```json
{
  "action": "get",
  "userId": "user_001",
  "page": 1,
  "limit": 20,
  "category": "政治",
  "is_mastered": false
}
```

### 2. 添加错题

```json
{
  "action": "add",
  "userId": "user_001",
  "questionId": "q_001",
  "question_content": "题目内容",
  "options": ["A. 选项1", "B. 选项2"],
  "user_answer": "B",
  "correct_answer": "A",
  "analysis": "解析",
  "category": "政治"
}
```

### 3. 更新错题状态

```json
{
  "action": "update",
  "userId": "user_001",
  "mistakeId": "m_001",
  "is_mastered": true,
  "notes": "用户笔记"
}
```

### 4. 删除错题

```json
{
  "action": "delete",
  "userId": "user_001",
  "mistakeId": "m_001"
}
```

### 5. 获取待复习错题

```json
{
  "action": "get_review_list",
  "userId": "user_001",
  "limit": 10
}
```

### 6. 获取错题统计

```json
{
  "action": "get_stats",
  "userId": "user_001"
}
```

---

## 收藏模块

### 云函数: `favorite-manager`

### 1. 添加收藏

```json
{
  "action": "add",
  "userId": "user_001",
  "questionId": "q_001",
  "question_content": "题目内容",
  "category": "政治",
  "tags": ["重点", "易错"]
}
```

### 2. 获取收藏列表

```json
{
  "action": "get",
  "userId": "user_001",
  "page": 1,
  "limit": 20,
  "category": "政治"
}
```

### 3. 移除收藏

```json
{
  "action": "remove",
  "userId": "user_001",
  "favoriteId": "fav_001"
}
```

### 4. 检查是否已收藏

```json
{
  "action": "check",
  "userId": "user_001",
  "questionId": "q_001"
}
```

### 5. 批量操作

```json
{
  "action": "batchAdd",
  "userId": "user_001",
  "questions": [
    { "questionId": "q_001", "question_content": "..." },
    { "questionId": "q_002", "question_content": "..." }
  ]
}
```

---

## AI服务模块

### 云函数: `proxy-ai`

### 1. 生成题目

```json
{
  "action": "generate_questions",
  "content": "知识点或内容描述",
  "questionCount": 5
}
```

### 2. 错题分析

```json
{
  "action": "analyze",
  "question": "题目内容",
  "userAnswer": "B",
  "correctAnswer": "A",
  "context": {
    "topicAccuracy": 60,
    "consecutiveErrors": 2
  }
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "errorType": {
      "primary": "concept_confusion",
      "confidence": 0.85
    },
    "analysis": {
      "surface": { "wrongChoice": "B", "correctChoice": "A", "gap": "..." },
      "middle": { "thinkingPath": "...", "breakPoint": "..." },
      "deep": { "knowledgeGap": "...", "prerequisite": "..." }
    },
    "improvement": {
      "immediate": { "action": "...", "timeNeeded": "30分钟" },
      "shortTerm": { "action": "...", "frequency": "每天" },
      "longTerm": { "action": "...", "habit": "..." }
    }
  }
}
```

### 3. AI聊天

```json
{
  "action": "chat",
  "content": "用户问题",
  "userId": "user_001"
}
```

### 4. AI好友对话

```json
{
  "action": "friend_chat",
  "content": "用户消息",
  "friendType": "yan-cong",
  "userId": "user_001",
  "emotion": "neutral",
  "context": {
    "conversationCount": 5,
    "studyState": "normal"
  }
}
```

**好友类型**:
- `yan-cong`: 研聪 - 清华学霸学长
- `yan-man`: 研漫 - 心理学硕士研友
- `yan-shi`: 研师 - 资深考研名师
- `yan-you`: 研友 - 同届考研伙伴

### 5. 智能组题

```json
{
  "action": "adaptive_pick",
  "content": "请求描述",
  "userProfile": {
    "targetSchool": "清华大学",
    "weakSubjects": ["数学"],
    "correctRate": 75
  },
  "mistakeStats": { "政治": 10, "数学": 25 },
  "recentPractice": {
    "consecutiveCorrect": 3,
    "avgDuration": 45
  }
}
```

### 6. 趋势预测

```json
{
  "action": "trend_predict",
  "content": "预测请求",
  "subject": "政治",
  "examYear": 2026,
  "historicalData": {}
}
```

---

## 拍照搜题

### 云函数: `ai-photo-search`

### 1. 图片识别搜题

```json
{
  "action": "search",
  "imageBase64": "base64编码的图片",
  "subject": "math",
  "userId": "user_001"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "recognition": {
      "questionText": "识别的题目文本",
      "questionType": "单选题",
      "options": ["A. ...", "B. ..."],
      "subject": "数学",
      "formulas": ["$x^2 + y^2 = r^2$"],
      "confidence": 0.95
    },
    "matchedQuestions": [
      {
        "_id": "q_001",
        "question": "相似题目",
        "similarity": 0.85
      }
    ],
    "aiSolution": {
      "answer": "A",
      "analysis": {
        "思路": "...",
        "步骤": ["步骤1", "步骤2"],
        "关键点": ["考点1", "考点2"]
      }
    }
  }
}
```

### 2. 生成解析

```json
{
  "action": "generate_solution",
  "questionText": "题目内容",
  "options": ["A. ...", "B. ..."],
  "subject": "math"
}
```

---

## 社交模块

### 云函数: `group-manager`

### 1. 创建学习小组

```json
{
  "action": "create",
  "userId": "user_001",
  "name": "清华计算机考研群",
  "description": "备考清华CS的同学交流",
  "tags": ["清华", "计算机"],
  "max_members": 50
}
```

### 2. 加入小组

```json
{
  "action": "join",
  "userId": "user_001",
  "groupId": "group_001"
}
```

### 3. 获取小组列表

```json
{
  "action": "list",
  "userId": "user_001",
  "page": 1,
  "limit": 20
}
```

### 4. 获取小组详情

```json
{
  "action": "detail",
  "groupId": "group_001"
}
```

### 5. 分享资源

```json
{
  "action": "share_resource",
  "userId": "user_001",
  "groupId": "group_001",
  "resource": {
    "type": "question",
    "title": "分享标题",
    "content": "内容"
  }
}
```

---

## 院校模块

### 云函数: `school-query`

### 1. 搜索院校

```json
{
  "action": "search",
  "keyword": "清华",
  "province": "北京",
  "type": "985",
  "page": 1,
  "limit": 20
}
```

### 2. 获取院校详情

```json
{
  "action": "detail",
  "schoolId": "school_001"
}
```

### 3. 获取专业信息

```json
{
  "action": "majors",
  "schoolId": "school_001",
  "keyword": "计算机"
}
```

### 4. AI院校咨询

```json
{
  "action": "consult",
  "question": "清华计算机专业考研难度如何？",
  "context": {
    "targetSchool": "清华大学",
    "targetMajor": "计算机科学"
  }
}
```

---

## 学习资源模块

### 云函数: `learning-resource`

### 1. 获取推荐资源

```json
{
  "action": "getRecommendations",
  "userId": "user_001",
  "category": "video",
  "subject": "政治",
  "limit": 10
}
```

### 2. 获取热门资源

```json
{
  "action": "getHotResources",
  "category": "video",
  "limit": 10
}
```

### 3. 搜索资源

```json
{
  "action": "search",
  "keyword": "马原",
  "category": "video",
  "page": 1,
  "limit": 20
}
```

### 4. 收藏资源

```json
{
  "action": "favorite",
  "userId": "user_001",
  "resourceId": "res_001"
}
```

### 5. 记录学习进度

```json
{
  "action": "recordProgress",
  "userId": "user_001",
  "resourceId": "res_001",
  "progress": 0.75,
  "duration": 1800
}
```

---

## 排行榜模块

### 云函数: `rank-center`

### 1. 获取排行榜

```json
{
  "action": "get_ranking",
  "type": "streak",
  "page": 1,
  "limit": 50
}
```

**排行榜类型**:
- `streak`: 连续学习天数
- `questions`: 做题数量
- `accuracy`: 正确率
- `study_time`: 学习时长

### 2. 获取用户排名

```json
{
  "action": "get_user_rank",
  "userId": "user_001",
  "type": "streak"
}
```

---

## PK对战模块

### 云函数: `pk-battle`

### 1. 创建对战

```json
{
  "action": "create",
  "userId": "user_001",
  "category": "政治",
  "questionCount": 10
}
```

### 2. 加入对战

```json
{
  "action": "join",
  "battleId": "battle_001",
  "userId": "user_002"
}
```

### 3. 提交答案

```json
{
  "action": "submit_answer",
  "battleId": "battle_001",
  "userId": "user_001",
  "questionIndex": 0,
  "answer": "A",
  "duration": 15
}
```

### 4. 获取对战结果

```json
{
  "action": "get_result",
  "battleId": "battle_001"
}
```

---

## 速率限制

以下API有速率限制：

| API | 限制 |
|-----|------|
| `proxy-ai` | 20次/分钟/用户 |
| `ai-photo-search` | 10次/分钟/用户 |
| `login` | 5次/分钟/IP |

超过限制返回 `429` 错误码。

---

## 安全说明

1. **认证**: 需要认证的接口必须在请求头携带 `Authorization: Bearer <token>`
2. **HTTPS**: 所有请求必须使用 HTTPS
3. **审计模式**: 部分AI功能在审计期间不可用，返回 `403` 错误
4. **数据隔离**: 用户只能访问自己的数据

---

## 更新日志

### v2.1.0 (2026-02-07)
- 修复社交服务数据验证（正则注入防护、参数类型/长度校验）
- 移除前端Mock数据降级（socialService、getStudyStats）
- 完善错误处理（401/403区分、网络错误细分、响应解析安全）
- 新增数据同步状态监控和冲突解决机制
- 补充实际已部署云函数列表和真实action参数

### 已部署云函数清单

| 云函数路径 | 对应API | 实际支持的action |
|-----------|---------|-----------------|
| `/login` | 用户登录 | type: `wechat` / `qq` / `email` |
| `/send-email-code` | 发送验证码 | 无action参数，直接传email |
| `/mistake-manager` | 错题管理 | `add` / `get` / `remove` / `updateStatus` / `batchSync` |
| `/social-service` | 社交服务 | `search_user` / `send_request` / `handle_request` / `get_friend_list` / `get_friend_requests` / `remove_friend` |
| `/rank-center` | 排行榜 | `update` / `get` / `getUserRank` |
| `/school-query` | 院校查询 | `list` / `detail` / `search` / `hot` / `majors` / `major_detail` / `score_lines` / `national_lines` / `admission_ratios` / `add_favorite` / `remove_favorite` / `get_favorites` / `stats` / `provinces` |
| `/proxy-ai` | AI代理 | `generate_questions` / `analyze` / `chat` / `friend_chat` / `adaptive_pick` / `material_understand` / `trend_predict` |
| `/ai-photo-search` | 拍照搜题 | `search` / `generate_solution` |
| `/material-manager` | 资料管理 | `save_upload_record` / `get_upload_records` / `delete_upload_record` / `save_questions` / `get_questions` / `delete_questions` / `sync_questions` / `get_stats` |
| `/health-check` | 健康检查 | 无action参数 |

### v2.0.0 (2026-02-06)
- 新增收藏模块 API
- 新增学习资源推荐 API
- 新增拍照搜题 API
- 增强错题分析功能
- 添加 AI 好友对话功能
- 统一 API 响应格式
- 添加速率限制

### v1.0.0 (2026-01-01)
- 初始版本发布
