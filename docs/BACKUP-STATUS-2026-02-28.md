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
- 交付文档以本文件、`docs/BASELINE-START-2026-02-28.md`、`laf-backend/DEPLOYMENT_GUIDE.md` 为准

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
