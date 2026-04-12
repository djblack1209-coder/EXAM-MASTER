你是 EXAM-MASTER 项目的夜间自动审计 AI，正在执行**阶段6：文件治理 + 文档同步审计**。

## 背景

项目经历了快速迭代的零碎化开发，文件/文档可能不一致。需要整理项目结构，对齐颗粒度。

## 本阶段任务

### 1. 文件结构治理

#### 1.1 重复文件检测

- 对 `src/` 目录进行内容相似度扫描
- 特别关注 `utils/` 和 `composables/` 中可能的重复实现
- 已知处理过的：`src/pages/plan/utils/learning-analytics.js`（已删除重复）

#### 1.2 文件命名规范

- 页面文件：`kebab-case/index.vue`
- 组件文件：`PascalCase.vue`
- Store 文件：`kebab-case.js`
- API 文件：`kebab-case.api.js`
- Composable 文件：`useXxx.js`（camelCase 带 use 前缀）
- 检查所有文件是否遵循命名规范

#### 1.3 空目录清理

- 搜索 `src/` 下是否有空目录
- 搜索 `tests/` 下是否有空测试文件

#### 1.4 临时文件清理

- 搜索根目录及 `src/` 下的 `.bak`、`.tmp`、`.old`、`.copy` 文件
- 搜索 `visual-*.png` 等临时截图（确认在 `.gitignore` 中）
- 检查是否有被注释掉的大段代码（超过 20 行的连续注释块）

### 2. 文档体系审计

#### 2.1 核心文档检查

检查以下文档是否存在、内容是否与代码一致：

| 文档                          | 检查项                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `CLAUDE.md`                   | 项目规模数字是否准确（页面/组件/Store/Composable/云函数数量） |
| `README.md`                   | 是否反映当前项目状态                                          |
| `docs/status/HEALTH.md`       | 活跃问题是否仍然有效，已解决项是否标记                        |
| `docs/sop/CHANGE-LOG.md`      | 最近变更是否记录                                              |
| `docs/AI-SOP/MODULE-INDEX.md` | 模块索引是否与实际文件结构一致                                |

#### 2.2 数字一致性

实际统计并更新 CLAUDE.md 中的数字：

```bash
# 页面数量
find src/pages -name "*.vue" | wc -l

# 组件数量
find src/components -name "*.vue" | wc -l

# Store 数量
find src/stores/modules -name "*.js" | wc -l

# Composable 数量
find src/composables -name "*.js" | wc -l

# 云函数数量
find laf-backend/functions -maxdepth 1 -name "*.ts" | wc -l

# 测试文件/用例
npm test 2>&1 | tail -5
```

如果数字不一致，更新 CLAUDE.md。

#### 2.3 冗余文档检查

- 检查 `docs/` 目录下是否有过时的文档
- 检查是否有 `.md` 文件内容与其他文档重复
- 根目录只允许 `README.md` + `CLAUDE.md`，其他 .md 应在 `docs/` 下

### 3. 配置文件一致性

#### 3.1 构建配置

- `vite.config.js` 中的配置是否与当前项目结构匹配
- `vitest.config.js` 的测试路径是否正确覆盖
- `eslint.config.js` 规则是否与编码规范一致

#### 3.2 项目配置

- `project.config.json`（微信小程序配置）是否有效
- `manifest.json`（uni-app 配置）是否包含正确的 appid 和版本
- `electron-builder.config.json`（Electron 打包配置）是否有效

#### 3.3 CI/CD 配置

- `.github/workflows/` 下的 GitHub Actions 是否与当前构建命令一致
- Husky hooks (`.husky/`) 是否正确配置

### 4. HEALTH.md 更新

基于本轮审计的所有发现，更新 `docs/status/HEALTH.md`：

- 新发现的问题添加到 Active Issues
- 已修复的问题标记为已解决
- 更新 Last Updated 日期

### 5. CHANGE-LOG.md 更新

在 `docs/sop/CHANGE-LOG.md` 追加本次夜间审计的变更记录：

```
## YYYY-MM-DD (夜间自动审计)

### 阶段6：文件治理 + 文档同步
- [列出所有变更]
```

## 修复规则

- 重复文件 → 保留一份，其他改为 import
- 命名不规范 → 重命名并更新所有引用
- 文档数字不一致 → 更新文档
- 冗余文档 → 合并或删除
- 修复后必须通过 `npm run lint && npm test && npm run build:h5`

## 输出

```
=== 阶段6：文件治理 + 文档同步 ===
重复文件: N处 (已清理M处)
命名违规: N处 (已修复M处)
文档更新: N个文件
配置一致性: ✅/❌ [详情]
修复: [列出所有修复]
遗留: [无法自动修复的问题]
```

如果做了修改：`git add -A && git commit -m "audit: 阶段6：文件治理+文档同步自动修复"`
