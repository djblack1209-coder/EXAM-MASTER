# Exam-Master 备份状态更新（2026-02-28）

更新时间: 2026-02-28
范围: 备份流程可用性、交付证据路径、待补齐项

---

## 1. 当前备份能力基线

- GitHub Actions 备份工作流: `.github/workflows/backup.yml`
- 本地/容器备份脚本: `deploy/scripts/backup-mongodb.sh`
- 策略: preflight 检查 `KUBE_CONFIG_PROD` 与 `MONGODB_URI`，缺失时跳过并输出 notice
- 产物保留: 工作流 Artifact 保留 30 天

---

## 2. 本轮状态结论

- 备份机制代码层面已就绪（工作流 + 脚本双路径）
- 仓库内 `backups/` 目录不纳入版本控制（已在 `.gitignore` 忽略）
- 交付文档以本文件、`docs/archive/2026-02-reset/BASELINE-START-2026-02-28.md`、`laf-backend/DEPLOYMENT_GUIDE.md` 为准

---

## 3. 待补齐的运维证据（生产前）

1. 在目标环境执行一次全量备份（workflow_dispatch 或运维脚本）
2. 执行一次恢复演练并抽样校验关键集合
3. 归档以下证据到交付系统（不入库敏感信息）:
   - 备份日志
   - 恢复日志
   - 校验截图/结果摘要

---

## 4. 相关命令（供值班/交付复核）

```bash
# 手动触发备份工作流（GitHub CLI）
gh workflow run "Database Backup" -f backup_type=full

# 查看最近备份运行
gh run list --workflow "Database Backup" --limit 5

# 本地执行全量备份（需配置 MONGODB_URI）
./deploy/scripts/backup-mongodb.sh full
```

---

## 5. 本次执行记录（2026-02-28 21:47）

- 已执行本地全量备份尝试：
  `BACKUP_DIR=/Users/blackdj/Desktop/EXAM-MASTER/backups/backup-20260228-2148 MONGODB_URI=mongodb://localhost:27017/exam-master ./deploy/scripts/backup-mongodb.sh full`
- 结果：流程已进入依赖检查阶段并按预期失败，阻断原因为 `mongodump 未安装`。
- 证据日志：`backups/backup-20260228-2148/logs/backup_20260228.log`
- 远端工作流状态：`gh auth status` 显示当前环境未登录 GitHub，暂无法直接触发 `Database Backup` workflow。
- 远端触发验证：执行 `gh workflow run "Database Backup" -f backup_type=full` 返回 `gh auth login / GH_TOKEN` 要求，当前环境凭据缺失。

本轮修复：

- 已修复脚本早期日志目录未创建导致的启动失败问题（`tee .../logs/*.log: No such file or directory`）。
- 修复文件：`deploy/scripts/backup-mongodb.sh`（在 `log()` 中补充日志目录创建）。

当时待办（状态）：

1. [x] 在执行节点安装 MongoDB Database Tools（含 `mongodump`）。
2. [x] 重新执行全量备份并校验产物（archive + sha256）。
3. [x] 补充恢复演练证据并更新本文件状态为可交付。

---

## 6. 二次执行闭环（2026-02-28 21:57）

- 已安装 MongoDB 备份依赖：
  - `mongodb-database-tools`（提供 `mongodump`）
  - `mongodb-community`（本地验证实例）
- 已启动本地 MongoDB 服务：`brew services start mongodb/brew/mongodb-community`
- 已成功执行本地全量备份：
  `BACKUP_DIR=/Users/blackdj/Desktop/EXAM-MASTER/backups/backup-20260228-2202 MONGODB_URI=mongodb://localhost:27017/exam-master ./deploy/scripts/backup-mongodb.sh full`
- 备份产物（已生成并通过校验）：
  - `backups/backup-20260228-2202/full/exam-master-full-20260228_215722.archive`
  - `backups/backup-20260228-2202/full/exam-master-full-20260228_215722.archive.sha256`
- 执行日志：`backups/backup-20260228-2202/logs/backup_20260228.log`
- 恢复演练样本备份产物（含 1 条探针数据，便于恢复校验）：
  - `backups/backup-20260228-220046/full/exam-master-full-20260228_220047.archive`（404 bytes）
  - `backups/backup-20260228-220046/full/exam-master-full-20260228_220047.archive.sha256`
- 已完成本地恢复演练（restore drill）：
  - 备份源：`backups/backup-20260228-220046/full/exam-master-full-20260228_220047.archive`
  - 恢复目标库：`exam-master-restore-drill`
  - 抽样校验：`backup_drill_probe` 中 `runId=20260228-220046`，`restored_count=1`
  - 恢复日志：`backups/backup-20260228-220046/logs/restore-drill-20260228-2201.log`

本轮脚本加固（已落地）：

- `deploy/scripts/backup-mongodb.sh` 支持日志目录自动创建，避免首次写日志失败。
- `deploy/scripts/backup-mongodb.sh` 增加跨平台 SHA256 兼容（`sha256sum`/`shasum` 自动适配）。
- `deploy/scripts/backup-mongodb.sh` 全量备份改为直接输出 `.archive`，修复空库场景 `tar` 打包不稳定问题。

当前剩余待办（交付前）：

1. [x] 登录 GitHub CLI 后触发一次远端 `Database Backup` workflow 并归档运行证据。

---

## 7. 远端工作流触发闭环（2026-02-28 22:19 UTC+8）

- 已通过 `gh workflow run "Database Backup" -f backup_type=full` 成功触发远端备份工作流。
- Run ID: `22522472147`
- 状态: `completed / success`
- 触发方式: `workflow_dispatch`
- 结果: Preflight Check 通过，但实际备份被跳过。
- 原因: 仓库 Settings > Secrets 中未配置 `KUBE_CONFIG_PROD` 和 `MONGODB_URI`。
- Annotation: `Backup skipped - KUBE_CONFIG_PROD or MONGODB_URI secrets not configured.`
- 链接: https://github.com/djblack1209-coder/EXAM-MASTER/actions/runs/22522472147

结论：工作流代码路径正确，preflight 安全门按预期工作。要在远端执行实际备份，需在 GitHub 仓库 Settings > Secrets and variables > Actions 中配置：

1. `KUBE_CONFIG_PROD`（base64 编码的 kubeconfig）
2. `MONGODB_URI`（生产 MongoDB 连接字符串）
