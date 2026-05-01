# 工作区清理方案

> 更新日期：2026-04-30
> 目标：把发布前工作树收敛到可提交、可追溯、无冗余文档、无运行态污染的状态。

## 清理原则

1. 根目录只保留入口级 `README.md`；子项目可保留自身 `README.md`。
2. 项目文档统一进入 `docs/`，使用 `NN-KEBAB-CASE.md` 或 `NNA-KEBAB-CASE.md` 编号命名。
3. 当前事实只保留一份来源：发布状态看 `20-RELEASE-READINESS`，部署看 `09/09A/09B`，API 看 `04`，数据库看 `05`。
4. 旧审计长文、截图清单和一次性操作记录只合并成月份级修复记录。
5. 真实凭据、本地 env、网盘原始文件、PDF、AI 缓存、smoke token、构建产物、审计截图和大体积备份不进入 Git。

## 本轮执行范围

| 动作 | 处理方式 |
| --- | --- |
| 后端部署文档 | 从 `laf-backend/deployment-guide.md` 移入 `docs/09A-LAF-BACKEND-DEPLOYMENT.md` |
| 后端分仓迁移文档 | 从 `laf-backend/MIGRATION-GUIDE.md` 移入 `docs/09B-BACKEND-MIGRATION-GUIDE.md` |
| 旧审计报告 | 合并为 `docs/archive/2026-02-reset/REPAIR-RECORDS-2026-02.md` 与 `docs/archive/2026-03-review/REPAIR-RECORDS-2026-03.md` |
| 2026-04 重复审计草稿 | 删除归档副本，保留当前正式文档 `18` 与 `19` |
| 运行态报告 | `data/*.json` 发布/清洗报告加入忽略；只保留可复用 `.example.json` 模板 |
| 截图与二维码 | `output/`、`backups/`、临时登录 QR 加入忽略或清理，不作为提交内容 |

## 后续维护规则

- 新文档先判断是否能并入既有编号文档；不能并入时再新增编号。
- 发布证据写入 `docs/release/`，但截图、二维码和原始报告只记录路径、hash、结论，不提交原始产物。
- 百度网盘清洗数据默认在 `data/` 下运行；提交前仅允许 `.example.json` 模板进入版本控制。
- 每次提交前执行 `npm run audit:secrets:tracked`，并用 `git status --ignored` 确认敏感/运行态文件已被忽略。
