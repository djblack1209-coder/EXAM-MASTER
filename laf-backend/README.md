# Exam-Master Backend

考研备考小程序后端云函数服务，基于 [Laf Cloud](https://laf.run) 平台。

## 技术栈

- **运行时:** Node.js >= 18.20（推荐 20.17 LTS）
- **语言:** TypeScript（函数入口采用 TS-only）
- **平台:** Laf Cloud (Sealos)
- **数据库:** MongoDB (Laf 内置)
- **AI:** 智谱 GLM-4-Plus / SiliconFlow

## 目录结构

```
laf-backend/
├── functions/          # 云函数（API 入口）
│   └── _shared/        # 函数间共享模块
├── database-schema/    # 数据库集合 Schema 定义
├── triggers/           # 数据库触发器
├── types/              # TypeScript 类型定义
├── utils/              # 工具函数（日志/校验/幂等）
├── scripts/            # 运维脚本
├── .env.example        # 环境变量模板
├── package.json
└── tsconfig.json
```

## 快速开始

```bash
# 1. 安装 Laf CLI
npm i -g laf-cli

# 2. 登录 Laf
laf login

# 3. 初始化应用连接
laf init <appid>

# 4. 复制环境变量
cp .env.example .env
# 编辑 .env 填入真实配置

# 5. 部署云函数
laf deploy
```

## 云函数列表

| 函数                      | 说明                        |
| ------------------------- | --------------------------- |
| `login`                   | 用户认证（微信/QQ/邮箱/H5） |
| `proxy-ai`                | AI 对话代理                 |
| `question-bank`           | 题库管理                    |
| `mistake-manager`         | 错题本管理                  |
| `answer-submit`           | 答题提交                    |
| `pk-battle`               | PK 对战                     |
| `rank-center`             | 排行榜                      |
| `social-service`          | 好友/社交                   |
| `school-query`            | 院校查询                    |
| `achievement-manager`     | 成就系统                    |
| `learning-goal`           | 学习目标                    |
| `learning-resource`       | 学习资源                    |
| `study-stats`             | 学习统计                    |
| `favorite-manager`        | 收藏管理                    |
| `material-manager`        | 资料管理 ⚠️ 未接入前端      |
| `send-email-code`         | 邮箱验证码                  |
| `job-bot-handoff-notify`  | Job Bot 接管邮件通知        |
| `upload-avatar`           | 头像上传                    |
| `ai-friend-memory`        | AI 好友记忆                 |
| `ai-photo-search`         | AI 拍照搜题                 |
| `photo-bg`                | 证件照换底色                |
| `id-photo-segment-base64` | 证件照抠图                  |
| `doc-convert`             | 文档转换                    |
| `voice-service`           | 语音识别/合成 ⚠️ 未接入前端 |
| `school-crawler-api`      | 院校数据爬虫                |
| `health-check`            | 健康检查                    |
| `data-cleanup`            | 数据清理（定时）            |
| `db-create-indexes`       | 数据库索引创建              |
| `db-migrate-timestamps`   | 数据迁移                    |

## 环境变量

详见 `.env.example`，包含：

- 微信/QQ OAuth 配置
- JWT 密钥
- AI 服务 API Keys（智谱/SiliconFlow）
- 腾讯云服务配置
- SMTP 邮件配置
- 安全与速率限制配置

## 数据库

Schema 定义位于 `database-schema/` 目录，索引通过 `db-create-indexes` 云函数创建。
