# 考研大师 (EXAM-MASTER)

> 考研备考小程序 - AI助力，一战成硕

[![Tests](https://img.shields.io/badge/tests-1235%20passed-brightgreen)]()
[![UI Quality](https://img.shields.io/badge/UI%20quality-99%2F100-brightgreen)]()
[![Version](https://img.shields.io/badge/version-2.2.0-blue)]()

---

## 📖 项目简介

**EXAM-MASTER** 是基于真题资料库的考研公共课刷题工具。核心功能包括：

- 📚 完整的考研公共课真题库 (政治/英语/数学)
- 🎯 智能刷题与错题复练
- 🧠 FSRS 间隔复习算法
- 📊 学习进度跟踪与数据分析
- 🤖 AI 辅助学习 (智谱 GLM-4-Plus)

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm 或 pnpm

### 安装依赖

```bash
npm install --legacy-peer-deps
```

### 开发运行

```bash
# H5 开发模式
npm run dev:h5

# 微信小程序开发模式
npm run dev:mp-weixin

# 运行测试
npm test
```

## 🏗️ 基础设施

**前端托管:** 腾讯云 2GB (exam.245334.xyz)  
**后端API:** Laf云函数 (api.245334.xyz)  
**代理服务:** sing-box 1.14.0  
**内核:** Linux BBR v3 优化  
**网络:** Cloudflare Tunnel + CDN优选(陕西电信)  

**架构优势:**
- Serverless后端自动扩容
- BBR3降低API延迟
- CDN优选提升用户体验

### 构建生产版本

```bash
# 构建 H5 版本
npm run build

# 构建微信小程序
npm run build:mp-weixin
```

## 📂 项目结构

```
exam-master/
├── src/                    # 前端源码 (Vue 3 + uni-app)
│   ├── pages/             # 页面组件
│   ├── components/        # 通用组件
│   ├── stores/            # Pinia 状态管理
│   ├── utils/             # 工具函数
│   └── config/            # 配置文件与题库注册表
├── laf-backend/           # Laf 云函数后端
│   ├── functions/         # 云函数源码
│   └── database/          # 数据库 schema
├── docs/                  # 项目文档 (18 个核心文档)
├── tests/                 # 测试文件
├── scripts/               # 构建与题库处理脚本
├── data/                  # 题库数据与质量报告
├── cdn-assets/            # CDN 图片资源
└── deploy/                # 部署配置

```

## 📚 完整文档

详细文档位于 `docs/` 目录，核心文档索引：

| 文档 | 说明 |
|------|------|
| [00-INDEX.md](./docs/00-INDEX.md) | 文档总索引与快速开始 |
| [01-PRODUCT-VISION.md](./docs/01-PRODUCT-VISION.md) | 产品愿景与商业模式 |
| [02-ARCHITECTURE.md](./docs/02-ARCHITECTURE.md) | 系统架构与技术栈 |
| [09-DEPLOYMENT-GUIDE.md](./docs/09-DEPLOYMENT-GUIDE.md) | 部署运维指南 |
| [10-DEV-RULES.md](./docs/10-DEV-RULES.md) | 开发规范与变更流程 |

**推荐阅读顺序**:  
新手 → `00-INDEX.md` → `01-PRODUCT-VISION.md` → `10-DEV-RULES.md`  
开发 → `02-ARCHITECTURE.md` → `06-FRONTEND-REFERENCE.md` → `08-TESTING-INFRA.md`  
部署 → `09-DEPLOYMENT-GUIDE.md` → `09A-LAF-BACKEND-DEPLOYMENT.md`

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | uni-app 3.x + Vue 3 + Vite |
| 状态管理 | Pinia |
| UI 组件 | wot-design-uni + 自研主题系统 |
| 后端 | Laf 云函数 (TypeScript) |
| 数据库 | MongoDB |
| 测试 | Vitest (161 测试文件 / 1235 个测试) |
| 算法 | FSRS 间隔复习 + 掌握度模型 |
| AI | 智谱 GLM-4-Plus |

## 🏗️ 生产部署

**当前生产环境**: 腾讯云单机部署

- **前端**: Nginx 提供 H5/PWA 静态资源
- **后端**: Node.js 独立服务 (PM2 托管)
- **域名**: https://exam.245334.xyz
- **健康检查**: 每 5 分钟自动执行

详见 [部署运维指南](./docs/09-DEPLOYMENT-GUIDE.md)。

旧 H5 发布入口已关闭生产写入；无参数调用返回非零状态。使用
`bash deploy/tencent/scripts/deploy-h5.sh --build-only` 仅构建本地候选，不上传文件、不覆盖 Nginx。
恢复发布须先由所属事务验证本地备份可恢复、前态匹配、原子应用、独立自动回滚和真实业务后检。
当前生产 MongoDB 不可用，题库查询失败；首页或健康接口的 HTTP 200 不代表核心业务健康，
本地构建通过也不能解除该数据阻塞。

## ✅ 质量保证

### 测试覆盖

```bash
npm test
```

- ✅ 161 测试文件
- ✅ 1235 个测试用例
- ✅ 100% 通过率

### 代码质量

```bash
# UI 质量审计 (99/100 分)
npm run audit:ui-quality

# 敏感信息检查
npm run audit:secrets:tracked

# 深度扫描
npm run audit:deep-scan
```

### 发布门禁

```bash
# 题库质量门禁
npm run audit:question-bank:report

# 外部依赖审计
npm run audit:release:external:report

# 发布阻塞项清单
npm run audit:release:backlog
```

## 🤝 开发规范

1. **分支管理**: `main` 分支受保护，功能开发使用 feature 分支
2. **提交信息**: 遵循 Conventional Commits 规范
3. **代码审查**: 所有 PR 需要通过测试和审查
4. **测试优先**: 新功能需配套单元测试

详见 [开发规范](./docs/10-DEV-RULES.md)。

## 📊 项目状态

- **版本**: 2.2.0
- **代码规模**: ~3562 个跟踪文件
- **提交历史**: 485+ commits (2026 年)
- **最后更新**: 2026-08-31
- **生产状态**: ✅ 正常运行
- **公开发布状态**: 🔒 BLOCKED (题库内容完整性待补充)

## 📝 变更日志

查看 [CHANGELOG.md](./docs/12-CHANGELOG.md) 和 [RELEASE-NOTES.md](./docs/11-RELEASE-NOTES.md)。

## 📄 License

本项目为私有项目。

## 👥 维护者

DevOps Team

---

**快速链接**:  
[📖 完整文档](./docs/00-INDEX.md) | [🚀 部署指南](./docs/09-DEPLOYMENT-GUIDE.md) | [🐛 问题反馈](https://github.com/djblack1209-coder/EXAM-MASTER/issues)
