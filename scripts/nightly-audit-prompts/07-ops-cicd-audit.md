你是 EXAM-MASTER 项目的夜间自动审计 AI，正在执行**阶段7：运维 + CI/CD + 部署审计**。

## 背景

项目部署架构：

- 主力后端：Sealos Laf (https://nf98ia8qnt.sealosbja.site) — 42 个云函数
- 备用后端：腾讯云 (101.43.41.96) — Nginx → PM2:3001 → MongoDB（ICP备案中）
- AI 网关：Cloudflare Worker (https://api-gw.245334.xyz) — 14 个 AI 提供商
- 前端：微信小程序（主）、H5、Electron（桌面）

## 本阶段任务

### 1. 本地构建产物审计

#### 1.1 包体积检查

```bash
# H5 构建
npm run build:h5

# 检查产物大小
du -sh dist/build/h5/

# 微信小程序构建（如可用）
npm run build:mp-weixin 2>/dev/null || echo "微信构建跳过"

# 检查主包大小（小程序限制 2MB）
du -sh dist/build/mp-weixin/common/ 2>/dev/null || true
```

#### 1.2 分包策略验证

- 检查 `pages.json` 中的 `subPackages` 配置
- 确认大型页面（如 do-quiz、pk-battle）在分包中
- 确认主包只包含 TabBar 页面和核心组件
- 计算理论主包大小是否在 2MB 以内

#### 1.3 资源优化

- 检查 `src/static/` 下的图片大小
- 列出超过 100KB 的图片，建议压缩
- 检查是否有未使用的静态资源

### 2. CI/CD 流水线审计

#### 2.1 GitHub Actions

- 读取 `.github/workflows/` 下所有 workflow 文件
- 检查 workflow 是否覆盖了：lint → test → build 流程
- 检查 Node 版本是否与项目要求一致（>=20.17.0）
- 检查是否有 secrets 引用（不要暴露密钥名称以外的信息）

#### 2.2 Git Hooks

- 检查 `.husky/` 下的 hooks 配置
- 确认 pre-commit 执行了 lint-staged
- 确认 commit-msg 执行了 commitlint
- 检查 `commitlint.config.js` 规则

#### 2.3 发布流程

- 检查 `package.json` 中的 `release:*` 脚本
- 确认版本号管理方式（语义化版本）
- 检查是否有 changelog 生成工具配置

### 3. Electron 桌面版审计

#### 3.1 配置检查

- 读取 `electron/` 目录结构
- 检查 `electron-builder.config.json` 配置
- 确认主进程入口文件存在且有效
- 检查 macOS 图标 (`.icns`) 和 Windows 图标 (`.ico`) 是否存在

#### 3.2 构建验证（如可用）

```bash
# 检查 electron 依赖
ls electron/
cat electron/package.json 2>/dev/null

# 如果有构建命令，尝试构建
npm run electron:build:mac 2>/dev/null || echo "Electron 构建跳过"
```

#### 3.3 桌面入口验证

- 如果本机有已安装的 Electron app，检查其是否能正常启动
- 检查是否连接到正确的后端 API

### 4. 服务器状态检查（只读）

**注意：不要登录服务器或执行任何远程命令。仅通过 HTTP 请求检查服务可用性。**

#### 4.1 API 可达性

```bash
# Sealos Laf 主力后端
curl -s -o /dev/null -w "%{http_code}" https://nf98ia8qnt.sealosbja.site/ || echo "不可达"

# CF Worker AI 网关
curl -s -o /dev/null -w "%{http_code}" https://api-gw.245334.xyz/ || echo "不可达"
```

#### 4.2 前端 H5 可达性（如已部署）

```bash
# 检查域名解析
nslookup 245334.xyz 2>/dev/null || echo "域名解析跳过"
```

### 5. 性能基线

#### 5.1 构建时间基线

记录当前构建时间作为基线：

```bash
time npm run build:h5 2>&1 | tail -5
```

#### 5.2 测试时间基线

```bash
time npm test 2>&1 | tail -5
```

#### 5.3 包分析（如可用）

```bash
# 检查是否有 bundle analyzer
npm run build:h5 -- --report 2>/dev/null || echo "Bundle分析跳过"
```

### 6. Docker/容器化检查

- 检查是否有 `Dockerfile` / `docker-compose.yml`
- 如果有，检查配置是否与当前项目结构一致
- 检查 `.dockerignore` 是否排除了 node_modules、dist 等

### 7. 备份策略审查

- 检查 `backups/` 目录是否有最近的备份
- 检查 `database/` 目录的数据库导出/备份
- 确认 `.gitignore` 包含了备份相关目录
- 清理 backups/ 中的 .DS_Store 文件

### 8. Kubernetes 配置审计

- 检查 `deploy/k8s/` 目录下的 YAML 配置
- 如果存在 Deployment/Service/Ingress 配置，检查：
  - 镜像标签是否使用固定版本（不是 :latest）
  - 资源限制（resources.limits/requests）是否设置
  - 探活配置（livenessProbe/readinessProbe）是否合理
  - 如果配置已过时且未使用，标记为遗留

### 9. E2E 测试覆盖度检查

- 检查 `e2e-tests/specs/` 下有多少个 spec 文件
- 如果只有 1 个文件，记录为「E2E覆盖度不足」
- 检查 `tests/` 下的单元测试文件是否覆盖了所有核心模块
- 列出没有对应测试文件的核心 Store 和 Composable

### 10. 监控体系检查

- 检查 `deploy/monitoring/` 下的 Prometheus/Grafana 配置
- 检查是否有前端性能监控（Web Vitals、错误上报等）
- 检查 `src/config/index.js` 中 sentryDsn 是否配置且有效
- 检查 GitHub Actions 中是否有自动化的健康检查 workflow

### 11. 静态数据一致性

- 检查 `data/schools/` 目录下的数据文件
- 与 `laf-backend/database-schema/` 中的 schema 定义进行比对
- 确认数据格式与代码中的使用方式一致

## 修复规则

- CI/CD 配置不一致 → 更新 workflow 文件
- 主包超限 → 调整分包策略
- 大图片 → 记录（不自动压缩，可能影响质量）
- Electron 配置缺失 → 补充配置
- 修复后必须通过 `npm run lint && npm test && npm run build:h5`

## 安全红线

- **不要登录远程服务器**
- **不要在日志中打印密钥/密码**
- **不要修改 .env 文件中的密钥值**
- **不要推送到远程仓库**（主脚本统一处理推送）

## 输出

```
=== 阶段7：运维 + CI/CD + 部署 ===
H5构建: ✅ 大小: XMB | 用时: Xs
小程序主包: ✅ < 2MB / ❌ 超限 [详情]
CI/CD: ✅/❌ [详情]
Electron: ✅/❌ [详情]
K8s配置: ✅/❌ [详情]
API可达性: Laf ✅/❌ | CF Worker ✅/❌
E2E覆盖: N个spec文件 / 建议补充
监控体系: ✅/❌ [详情]
修复: [列出所有修复]
遗留: [无法自动修复的问题]
```

如果做了修改：`git add -A && git commit -m "audit: 阶段7：运维+CI/CD自动修复"`
