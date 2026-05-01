# EXAM-MASTER 敏感信息泄露审计报告

> 最后更新：2026-04-28
> 范围：当前工作树、已跟踪文件、Git 全历史、忽略文件、构建产物、文档、部署示例、Laf 后端配置。
> 原则：报告仅记录文件路径、类型、行号和处置动作，不记录任何密钥原文。

## 结论

- 当前可提交文件未发现常见高危密钥、私钥或 GitHub token 明文命中；`npm run audit:secrets:tracked` 已通过。
- 本地忽略文件中存在真实运行凭据，集中在 `.env`、`.env.local`、`.env.development`、`.env.production`、`laf-backend/.env`、`laf-backend/.app.yaml`。这些文件不应提交，且已由 `.gitignore` 明确保护。
- Git 历史已完成本地与远端清洗；清洗前存在 15 条 `gitleaks` 脱敏命中，涉及旧部署文档、旧调试文档和历史临时构建产物。由于仓库曾公开，相关凭据仍应按已暴露处理并完成轮换。
- 当前本地 `dist/` 构建产物曾包含前端环境配置命中，已删除；`.claude/worktrees/` 重复工作树和 `asset-inbox/` 中间产物也已删除。
- 当前 Git 历史已重写并强推远端；仍需通知协作者重新 clone，并完成凭据轮换。

## 扫描工具

| 工具 | 范围 | 输出 |
|------|------|------|
| `gitleaks 8.30.1` | 当前工作树、Git 全历史 | `output/security/gitleaks-*-redacted.json` |
| `trufflehog` | 当前工作树、Git 全历史 | `output/security/trufflehog-*-redacted.json` |
| `git grep` | 已跟踪文件 | 终端校验 |
| 自定义 Node 扫描器 | 忽略文件、构建产物、文档、`.claude` 等异常位置 | `output/security/custom-worktree-scan-redacted.json` |
| `npm run audit:secrets:tracked` | CI 可复用的已跟踪文件扫描 | 已加固并通过 |

## 当前工作树结果

| 位置 | 类型 | 状态 | 处置 |
|------|------|------|------|
| `.env` | Sealos、Laf、百度网盘相关本地凭据 | 本地忽略文件 | 保留本地运行用途，禁止提交 |
| `.env.local` | GitHub token 与本地配置 | 本地忽略文件 | 保留本地运行用途，建议轮换 token |
| `.env.development` / `.env.production` | 前端环境变量和混淆盐 | 本地忽略文件 | 已由 `.env*` 规则保护 |
| `laf-backend/.env` | AI 服务、微信/QQ、腾讯云、SMTP、管理 token 等后端凭据 | 本地忽略文件 | 保留本地运行用途，必须按服务逐项轮换 |
| `laf-backend/.app.yaml` | Laf 开发 token | 本地忽略文件 | 已由 `laf-backend/.gitignore` 保护，建议轮换 |
| `dist/` | 构建产物带出环境配置 | 本地冗余产物 | 已删除 |
| `.claude/worktrees/` | 重复工作树，包含重复文档和配置 | 本地冗余产物 | 已删除 |
| `asset-inbox/` | AI 图片生成中间产物 | 本地冗余产物 | 已删除 |

## Git 历史结果

`gitleaks` 在历史中发现 15 条脱敏命中：

| 文件 | 类型 | 关联提交 |
|------|------|----------|
| `docs/CLINE_DEBUG_GUIDE.md` | generic API key / curl auth header | `7f0f6c2` |
| `docs/09-DEPLOYMENT-GUIDE.md` | curl auth header | `949c932` |
| `deploy/docs/DEPLOY-SMART-STUDY-ENGINE.md` | curl auth header | `3d11271` |
| `docs/09A-LAF-BACKEND-DEPLOYMENT.md` | curl auth header | `ffd7836` |
| `tmp/app-nohtml-build/assets/index-BlKnrEql.js` | generic API key | `fc4c7a9` |
| `tmp/sanity-app-build/assets/index-BlKnrEql.js` | generic API key | `fc4c7a9` |
| `tmp/plain-vite-build/static/js/index-BeCJjIh_.js` | generic API key | `fc4c7a9` |
| `laf-backend/README.md` | generic API key | `cf52857` |
| `docs/setup/SETUP_WX_LOGIN.md` | generic API key | `6d789bd` |
| `docs/security/API_KEY_SECURITY_FIX.md` | generic API key | `6d789bd` |

`trufflehog` 对 Git 历史的复扫未确认历史中仍有可验证的有效密钥，但存在示例连接串类未知命中。由于仓库已经公开，历史中的任何疑似凭据都应按已泄露处理。

历史清洗后验收：

| 范围 | 结果 |
|------|------|
| 本地 Git 历史 `gitleaks` | 0 条命中 |
| 远端 GitHub `main` 镜像克隆后 `gitleaks` | 0 条命中 |
| 远端 `main` | 已由 `24c35757` 强制更新到 `007c83aa` |
| 远端历史标签 | 已强制更新到清洗后的对象 |

## 本轮修复

- `.gitignore` 改为默认忽略 `.env*`，仅放行 `.env.example`、`.env.test` 和明确的示例文件。
- `.gitignore` 增加 `.claude/`，避免本地 agent 运行状态、提示词缓存和重复工作树进入版本控制。
- `scripts/build/audit-tracked-secrets.sh` 扩展扫描规则，覆盖 OpenAI-compatible `sk-*`、GitHub token、Google API key、AWS key、HuggingFace token、Slack token、Laf token、私钥头等高危模式。
- `scripts/build/audit-tracked-secrets.sh` 输出改为脱敏，避免 CI 日志二次泄露。
- `docs/09-DEPLOYMENT-GUIDE.md` 与 `docs/09A-LAF-BACKEND-DEPLOYMENT.md` 的 curl 示例改为变量化 `AUTH_HEADER`，避免扫描器把示例 header 当作真实凭据。
- 客户端配置不再读取 `VITE_OBFUSCATION_KEY` / `VITE_REQUEST_SIGN_SALT`，小程序包内仅保留公开兼容种子；真正需要保密的签名盐统一放在后端 `REQUEST_SIGN_SALT`。
- 删除本地冗余构建产物和重复工作树：`dist/`、`unpackage/`、`.claude/worktrees/`、`asset-inbox/`。
- 使用 `git filter-repo` 清洗本地历史并强推 `origin/main` 与历史标签。

## 必须执行的安全动作

1. 立即轮换 `laf-backend/.env` 中的全部第三方服务凭据，优先级：GitHub token、微信/QQ secret、AI provider key、腾讯云 SecretId/SecretKey、SMTP 密码、Laf 管理 token、JWT/Admin/Cleanup/Internal key。
2. 轮换 `.env`、`.env.local`、`.env.development`、`.env.production` 中的 Sealos、百度网盘、前端混淆盐和签名盐。前端 `VITE_*` 变量不要放真正需要保密的值。
3. 要求所有协作者删除旧 clone 并重新 clone；GitHub 缓存、fork、已下载 clone 无法通过本仓库操作完全召回。
4. 在 GitHub 仓库开启 secret scanning / push protection，并把 `npm run audit:secrets:tracked` 接入 CI。

## 历史清洗建议命令

> 执行前必须确认所有成员暂停推送，并完成本地备份。清洗历史不会替代凭据轮换。

```bash
# 需要先安装 git-filter-repo
cat >/tmp/exam-master-replacements.txt <<'EOF'
regex:Authorization:[[:space:]]*Bearer[[:space:]]+[^[:space:]"']+==>Authorization: ${AUTH_HEADER}
regex:(api[_-]?key|API_KEY|secret|SECRET|token|TOKEN)[^[:space:]]*[:=][^[:space:]]+==><REDACTED_CONFIG>
EOF

git filter-repo --force \
  --replace-text /tmp/exam-master-replacements.txt \
  --path docs/CLINE_DEBUG_GUIDE.md \
  --path deploy/docs/DEPLOY-SMART-STUDY-ENGINE.md \
  --path tmp/app-nohtml-build/ \
  --path tmp/sanity-app-build/ \
  --path tmp/plain-vite-build/ \
  --invert-paths

git push --force-with-lease origin main
```

如果需要保留历史文档结构，应改用 `--replace-text` 对旧提交中的敏感片段做定向替换；但对于已经公开的 token，仍然必须轮换。

## 验收记录

| 检查 | 结果 |
|------|------|
| `npm run audit:secrets:tracked` | 通过 |
| `git grep` 高危 token / 私钥模式 | 无命中 |
| 本地 Git 历史 `gitleaks` 复扫 | 0 条命中 |
| 远端 GitHub `main` 镜像克隆后 `gitleaks` 复扫 | 0 条命中 |
| `gitleaks --no-git` 复扫 | 仅剩本地忽略凭据命中 |
| 特定已知 key 片段复扫 | 当前工作树和 Git 历史均无命中 |
| `.gitignore` 校验 | `.env*`、`laf-backend/.env`、`laf-backend/.app.yaml`、`output/` 已忽略 |
