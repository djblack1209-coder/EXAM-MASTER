# 工作流剧本 & 参考手册

> 本文件包含 CLAUDE.md 的详细执行流程和参考信息。
> AI 在识别任务类型后按需加载本文件，不必每次会话全部阅读。

---

## 流程 A: 新功能开发（产品经理+工程师+QA 协作）

```
1. 理解意图 → 用大白话和客户确认："您是想要...对吗？"
2. 可行性评估 → 30秒说清楚方案（用类比解释），评估对现有架构的影响
3. 搜索开源 → 检查 GitHub 上是否有成熟的高 Star 项目可以直接搬运/集成
   - 有成熟方案 → 直接搬运，去除无关依赖，适配本项目风格
   - 无成熟方案 → 自己实现，但参考同类项目的设计思路
4. 影响分析 → 读 docs/sop/CHANGE-IMPACT-ANALYSIS.md，填写影响报告模板
5. 拆分任务 → TodoWrite 列出步骤（颗粒度到单个文件级别）
6. 逐步实施 → 每完成一步标记完成 + 汇报进度（"一共5步，做到第3步"）
7. 截图展示 → Playwright 截图给客户看效果
8. 质量关卡 → npm run lint + npm test + npm run build:h5（三个全过才算完）
9. 回归测试 → 按 docs/sop/REGRESSION-TEST-STRATEGY.md 执行对应级别测试
10. 验收 → 按 docs/sop/ACCEPTANCE-CHECKLIST.md 对照相关功能条目
11. 决策记录 → 重大决策写入 docs/sop/AI-DECISION-LOG.md
12. 收尾 → 更新 CHANGE-LOG + HEALTH.md
```

## 流程 B: UI/UX改进（设计师角色）

```
1. 截图当前状态 → Playwright 截图
2. 分析问题 → 按现代UI规范给出改进方案（圆角、间距、配色、响应式）
3. 实施修改 → 直接改，不追问
4. 截图对比 → 修改前 vs 修改后
5. 大白话说明 → "改了哪里、为什么这样改"
6. 质量关卡 → npm run lint + npm test + npm run build:h5
```

## 流程 C: Bug修复（QA+工程师协作）

```
1. 一句话告诉客户 → "哪里坏了"
2. 根因调查 → 使用 systematic-debugging skill
3. 影响分析 → 读 docs/sop/CHANGE-IMPACT-ANALYSIS.md 确认修复范围
4. 修复 → 直接修
5. 验证 → 跑相关测试/截图证明
6. 回归测试 → 按 docs/sop/REGRESSION-TEST-STRATEGY.md 执行
7. 告诉客户 → "修好了，原因是...（类比解释）"
```

## 流程 D: 部署运维（DevOps 角色）

```
1. 构建前端 → npm run build:h5 / build:mp-weixin
2. 编译后端 → cd laf-backend && npx tsc --project tsconfig.standalone.json
3. 上传服务器 → scp + ssh pm2 restart（服务器信息见 .env.server）
4. 验证 → curl health-check 确认在线
5. 告诉客户 → "已上线，你可以打开看看"
```

## 流程 E: 状态查询

```
1. 读 docs/status/HEALTH.md
2. SSH 检查服务器状态
3. 用大白话汇报：系统状态、最近变更、待处理问题
```

## 流程 F: 质量审计

```
1. npm run lint + npm test + npm run build:h5（前端三道关卡）
2. 后端 TS 编译检查
3. 服务器 health-check + pm2 + SSL 检查
4. 按 docs/sop/ACCEPTANCE-CHECKLIST.md 逐一验证核心功能
5. 汇报发现的问题并逐一修复
6. 更新 HEALTH.md
```

## 流程 G: 技术咨询

```
1. 理解用户想法
2. 从技术可行性、开发成本、维护难度三个维度分析
3. 用大白话给出建议，附带类比说明
4. 如果用户确认要做 → 自动切换到流程A
```

## 流程 H: 性能优化

```
1. 使用 Playwright 测量页面加载时间
2. 分析瓶颈（网络请求、组件渲染、包体积）
3. 影响分析 → 读 docs/sop/CHANGE-IMPACT-ANALYSIS.md
4. 实施优化
5. 前后对比数据
6. 告诉客户 → "快了多少、怎么做到的"
```

---

## 常用命令

```bash
# 前端
npm run dev:h5                    # 本地开发
npm run build:h5                  # H5 正式构建
npm run build:mp-weixin           # 微信小程序构建

# 后端部署（腾讯云）
cd laf-backend && npx tsc --project tsconfig.standalone.json
scp -r dist/* root@101.43.41.96:/opt/apps/exam-master/backend/
ssh root@101.43.41.96 'cd /opt/apps/exam-master/backend && npm install && pm2 restart exam-master'

# Electron 桌面应用
npm run electron:dev              # 本地运行桌面版
npm run electron:build:mac        # 打包 macOS 版本

# 测试
npm test                          # 单元测试（90文件/1196用例）
npm run lint                      # 代码检查
npm run test:e2e:regression       # E2E 回归测试
npm run test:visual               # 可视化回归测试
npm run test:qa:full-regression   # 完整回归（含 E2E + 可视化）

# 服务器检查
ssh root@101.43.41.96 'pm2 list && curl -s http://localhost:3001/health-check'
```

## 服务器信息

⚠️ **敏感信息在 `.env.server`（不在版本控制中）**

| 项        | 值                                                      |
| --------- | ------------------------------------------------------- |
| IP        | 101.43.41.96                                            |
| 后端路径  | /opt/apps/exam-master/backend/                          |
| PM2进程名 | exam-master                                             |
| Nginx配置 | /etc/nginx/conf.d/exam-master.conf                      |
| MongoDB   | Docker容器 exam-master-mongo, 127.0.0.1:27017           |
| SSL证书   | /etc/letsencrypt/live/api.245334.xyz/（到期2026-06-20） |

SSH 登录方式：`ssh root@101.43.41.96`（密码见 `.env.server`）

## 已知陷阱

| 陷阱                              | 解法                                                |
| --------------------------------- | --------------------------------------------------- |
| 微信小程序包太大                  | `npm run build:mp-weixin` 检查，ECharts用自定义构建 |
| `@lafjs/cloud` 在独立服务器不存在 | 用 `cloud-shim.ts` 适配                             |
| SiliconFlow DS key 调用Pro模型    | key会永久死亡，只用标准模型                         |
| canvas-confetti 微信不支持        | 用 `mp-confetti.js` (CSS动画)                       |
| MongoDB `_.or()` 查询             | 必须用 `.where()` 顶层操作符                        |
| 首页底部内容被TabBar遮挡          | padding-bottom 至少 140px + safe-area               |
| Vite HMR 动态导入偶尔失败         | 重启 dev 服务器即可，生产构建不受影响               |
| Node 18 npm 版本警告              | 升级到 Node >= 20.17.0 可消除                       |

## 配置文件位置

| 配置         | 路径                                          |
| ------------ | --------------------------------------------- |
| 前端环境变量 | `.env.development`, `.env.production`         |
| 后端环境变量 | `laf-backend/.env`                            |
| 测试环境变量 | `.env.test`（同步 .env.example）              |
| 页面路由     | `src/pages.json`                              |
| Vite构建     | `vite.config.js`                              |
| uni-app配置  | `src/manifest.json`                           |
| 服务器凭证   | `.env.server`（不在版本控制中）               |
| Electron配置 | `electron-builder.config.json`                |
| ESLint       | `eslint.config.js`（v9 flat config）          |
| Prettier     | `.prettierrc`                                 |
| Git Hooks    | `.husky/`（pre-commit, commit-msg, pre-push） |
