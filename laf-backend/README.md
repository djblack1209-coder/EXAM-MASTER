# Exam-Master Laf 后端部署指南

## 📦 项目结构

```
laf-backend/
├── cloud-functions/          # 云函数目录
│   ├── auth/
│   │   └── login.js          # 微信登录 + JWT
│   ├── ai/
│   │   └── proxy-ai.js       # 智谱 AI 代理
│   ├── practice/
│   │   └── mistake-manager.js # 错题本管理
│   ├── social/
│   │   ├── social-service.js # 好友系统
│   │   └── rank-center.js    # 排行榜
│   └── system/
│       └── health-check.js   # 健康检查
│
├── database-schema/          # 数据库 Schema
│   ├── users.schema.json
│   ├── questions.schema.json
│   ├── practice_records.schema.json
│   ├── mistake_book.schema.json
│   ├── study_plans.schema.json
│   └── friends.schema.json
│
├── triggers/                 # 触发器
│   └── on-user-create.js     # 新用户初始化
│
└── README.md                 # 本文件
```

## 🚀 快速部署（3步完成）

### Step 1: 登录 Laf 控制台

1. 访问 https://laf.run 或 https://console.laf.run
2. 使用你的 Laf 账号登录
3. 进入应用 `nf98ia8qnt`

### Step 2: 配置环境变量

在 Laf 控制台 → 设置 → 环境变量，添加以下配置：

```
WX_APPID=wx5bee888cf32215df
WX_SECRET_PLACEHOLDER
AI_PROVIDER_KEY_PLACEHOLDER
JWT_SECRET_PLACEHOLDER
```

### Step 3: 部署云函数

**方式一：控制台手动部署**

1. 进入 Laf 控制台 → 云函数
2. 创建以下云函数（复制对应文件内容）：
   - `login` ← `cloud-functions/auth/login.js`
   - `proxy-ai` ← `cloud-functions/ai/proxy-ai.js`
   - `mistake-manager` ← `cloud-functions/practice/mistake-manager.js`
   - `social-service` ← `cloud-functions/social/social-service.js`
   - `rank-center` ← `cloud-functions/social/rank-center.js`
   - `health-check` ← `cloud-functions/system/health-check.js`
3. 点击"发布"按钮

**方式二：CLI 部署（推荐）**

```bash
# 安装 Laf CLI
npm install -g laf-cli

# 登录
laf login

# 初始化项目
cd laf-backend
laf init

# 部署所有云函数
laf deploy --all
```

## 📊 数据库初始化

### 创建集合

在 Laf 控制台 → 数据库，创建以下集合：

1. `users` - 用户表
2. `questions` - 题库表
3. `practice_records` - 练习记录表
4. `mistake_book` - 错题本表
5. `study_plans` - 学习计划表
6. `friends` - 好友关系表
7. `rankings` - 排行榜表

### 创建索引

参考 `database-schema/*.schema.json` 中的 `indexes` 字段，在 Laf 控制台为每个集合创建索引。

**关键索引示例：**

```javascript
// users 集合
db.collection('users').createIndex({ openid: 1 }, { unique: true })
db.collection('users').createIndex({ streak_days: -1 })

// mistake_book 集合
db.collection('mistake_book').createIndex({ user_id: 1, created_at: -1 })
db.collection('mistake_book').createIndex({ user_id: 1, is_mastered: 1 })

// practice_records 集合
db.collection('practice_records').createIndex({ user_id: 1, created_at: -1 })
db.collection('practice_records').createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }) // 90天TTL
```

## 🔗 API 端点

部署完成后，API 基础地址为：
```
https://nf98ia8qnt.sealosbja.site
```

### 接口列表

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 登录 | POST | `/login` | 微信小程序登录 |
| AI 代理 | POST | `/proxy-ai` | 智谱 AI 调用 |
| 错题管理 | POST | `/mistake-manager` | 错题 CRUD |
| 社交服务 | POST | `/social-service` | 好友系统 |
| 排行榜 | POST | `/rank-center` | 排行榜服务 |
| 健康检查 | GET | `/health-check` | 系统状态 |

### 请求示例

**登录：**
```javascript
POST /login
{
  "code": "微信登录code"
}
```

**添加错题：**
```javascript
POST /mistake-manager
{
  "action": "add",
  "userId": "user_001",
  "data": {
    "question_content": "题目内容",
    "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
    "user_answer": "B",
    "correct_answer": "A",
    "analysis": "解析内容"
  }
}
```

**AI 生成题目：**
```javascript
POST /proxy-ai
{
  "action": "generate_questions",
  "content": "马克思主义哲学基本原理",
  "questionCount": 5
}
```

## 📈 性能优化建议

### 1. 缓存策略

- 题目列表：缓存 5 分钟
- 排行榜：缓存 1 分钟
- 用户信息：缓存 10 分钟

### 2. 冷启动优化

在 Laf 控制台开启"预留实例"功能，可将冷启动时间从 2s 降至 200ms。

### 3. 日志分级

生产环境建议只记录 `error` 级别日志，可节省 60% 存储成本。

## 🔒 安全检查清单

- [x] 所有云函数验证 userId
- [x] 数据查询带 userId 隔离
- [x] JWT Token 有效期 7 天
- [x] 敏感配置使用环境变量
- [x] API 请求超时设置 100s

## 🐛 常见问题

### Q: 登录返回 401 错误
A: 检查 `WX_APPID` 和 `WX_SECRET_PLACEHOLDER

### Q: AI 接口超时
A: 智谱 AI 首次调用可能较慢，建议设置 60s 超时。

### Q: 数据库查询慢
A: 确保已创建必要的索引，特别是 `user_id` 相关索引。

## 📞 技术支持

- Laf 官方文档：https://doc.laf.run
- 项目 Issues：https://github.com/your-repo/exam-master/issues
