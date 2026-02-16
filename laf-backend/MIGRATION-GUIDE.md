# 前后端分仓迁移指南

> 本文档记录将 `laf-backend/` 从 EXAM-MASTER 主仓库拆分为独立仓库的操作步骤。

## 前置条件

- 已在 GitHub 创建新仓库 `EXAM-MASTER-BACKEND`
- 当前 `laf-backend/` 目录已包含独立运行所需的全部文件

## 迁移步骤

### 1. 从主仓库提取后端历史（保留 git 历史）

```bash
# 在主仓库目录执行
cd /path/to/EXAM-MASTER

# 使用 git subtree split 提取 laf-backend 目录的完整历史
git subtree split -P laf-backend -b backend-split

# 创建临时目录，初始化新仓库
mkdir /tmp/exam-master-backend
cd /tmp/exam-master-backend
git init
git pull /path/to/EXAM-MASTER backend-split

# 关联远程仓库并推送
git remote add origin git@github.com:djblack1209-coder/EXAM-MASTER-BACKEND.git
git push -u origin main
```

### 2. 验证新仓库

```bash
cd /tmp/exam-master-backend

# 确认目录结构
ls -la
# 应包含: functions/ deploy/ scripts/ data/ database/ database-schema/
#         types/ utils/ triggers/ .github/ package.json tsconfig.json README.md

# 确认 git 历史
git log --oneline | head -20
```

### 3. 清理主仓库

```bash
cd /path/to/EXAM-MASTER

# 删除已迁移的后端目录
git rm -r laf-backend/

# 删除已迁移到后端的根目录资源
git rm -r data/
git rm -r database/
git rm -r scripts/crawlers/
git rm -r scripts/data-sync/
git rm scripts/test/load-test-50qps.js
git rm scripts/test/load-test.ts
git rm scripts/test/pk-atomicity-test.js
git rm scripts/test/security-audit.js
git rm scripts/test/test-ai-service.js
git rm scripts/test/test-ai-upgrade.js
git rm scripts/test/test-cot-verification.js

# 提交
git commit -m "chore: 移除已迁移至独立仓库的后端代码"
```

### 4. 更新前端 CI/CD

主仓库的 `.github/workflows/ci-cd.yml` 需要移除后端构建步骤：
- 删除 `Build and push backend image` step
- 删除 staging/production 部署中的 backend 相关 kubectl 命令
- 保留前端专属的 lint → test → build → deploy 流程

### 5. 更新 .gitignore

移除主仓库 `.gitignore` 中的后端相关条目：
```
# 删除这些行
laf-backend/.app.yaml
laf-backend/.env*
```

### 6. 更新文档引用

以下文档中引用了 `laf-backend/` 路径，需要更新为新仓库地址：
- `docs/API.md`
- `docs/SCRIPTS.md`
- `deploy/docs/DEPLOYMENT-GUIDE.md`
- `deploy/docs/EMERGENCY-RESPONSE.md`

### 7. 更新 Docker 构建上下文

`deploy/docker/Dockerfile` 中的 `COPY laf-backend/ ./` 需要删除（后端已有独立 Dockerfile）。
`deploy/docker/docker-compose.yml` 中的 backend service 需要改为引用外部镜像或删除。

## 分仓后的目录结构

### 前端仓库 (EXAM-MASTER)
```
EXAM-MASTER/
├── src/                    # 前端源码
├── common/                 # 公共样式
├── static/                 # 静态资源
├── scripts/                # 前端构建/修复脚本
│   ├── build/
│   ├── fix/
│   ├── optimize/
│   ├── refactor/
│   └── test/               # 前端测试脚本
├── tests/                  # 单元/视觉测试
├── deploy/                 # 前端部署配置
├── docs/                   # 项目文档
├── .github/workflows/      # 前端 CI/CD
├── package.json
└── vite.config.js
```

### 后端仓库 (EXAM-MASTER-BACKEND)
```
EXAM-MASTER-BACKEND/
├── functions/              # 云函数（API）
│   └── _shared/
├── database-schema/        # 数据库 Schema
├── database/               # SQL Schema
├── data/                   # 静态数据
├── triggers/               # 数据库触发器
├── types/                  # TypeScript 类型
├── utils/                  # 工具函数
├── scripts/                # 后端脚本
│   ├── crawlers/
│   ├── data-sync/
│   └── test/
├── deploy/                 # 后端部署配置
│   ├── docker/
│   ├── k8s/
│   └── monitoring/
├── .github/workflows/      # 后端 CI/CD
├── package.json
└── tsconfig.json
```
