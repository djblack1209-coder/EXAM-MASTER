# Laf Backend Deployment Guide (Current)

更新时间: 2026-02-28
应用 ID: `nf98ia8qnt`
调用域名: `https://nf98ia8qnt.sealosbja.site`

---

## 1. 当前部署基线

- 已部署云函数: `40`（业务函数 35 + `_shared` 5）
- `question-bank` 最新修复已上线（含 JWT 鉴权逻辑修复）
- 关键函数均已可调用（见“验证结果”）
- 函数入口采用 **TS-only** 策略（`laf-backend/functions/*.ts`），不再维护同名 `.js` 入口

建议把本文件与 `docs/BASELINE-START-2026-02-28.md`、`docs/BACKUP-STATUS-2026-02-28.md` 作为当前交付文档来源。

---

## 2. 常用命令

在目录 `laf-backend/` 执行：

```bash
# 查看当前云端函数清单
/Users/blackdj/.npm-global/bin/laf func list

# 发布单个函数
/Users/blackdj/.npm-global/bin/laf func push <function-name>

# 发布全部函数
/Users/blackdj/.npm-global/bin/laf func push
```

在仓库根目录执行（线上 smoke）：

```bash
# 公开接口 smoke（默认重试 8 次）
npm run test:cloud:smoke

# 带真实账号鉴权 smoke（可选）
SMOKE_EMAIL="<email>" SMOKE_PASSWORD="<password>" npm run test:cloud:smoke

# Laf 函数源码一致性审计（建议发布前执行 strict）
npm run audit:laf:function-sources -- --strict
```

---

## 3. 发布后最小验证清单

### 3.1 基础可用性

```bash
curl -sS "https://nf98ia8qnt.sealosbja.site/health-check"
```

预期包含: `{"code":0,"status":"ok"}`

### 3.2 关键业务验证

1. 登录签发 token（邮箱登录）

```bash
curl -sS "https://nf98ia8qnt.sealosbja.site/login" \
  -H "Content-Type: application/json" \
  -d '{"type":"email","email":"<email>","password":"<password>"}'
```

2. 携带 token 调用受保护接口（以 `doc-convert` 为例）

```bash
curl -sS "https://nf98ia8qnt.sealosbja.site/doc-convert" \
  -H "Content-Type: application/json" \
  -H "Authorization: ${AUTH_HEADER}" \
  -d '{"action":"get_types"}'
```

3. `question-bank` 鉴权分支验证

```bash
# 公共 action（无 token）
curl -sS "https://nf98ia8qnt.sealosbja.site/question-bank" \
  -H "Content-Type: application/json" \
  -d '{"action":"random","data":{"count":1}}'

# 非法 token
curl -sS "https://nf98ia8qnt.sealosbja.site/question-bank" \
  -H "Content-Type: application/json" \
  -H "Authorization: ${AUTH_HEADER}" \
  -d '{"action":"random"}'
```

---

## 4. 已完成的线上验证（摘要）

- `proxy-ai` `health_check` 正常
- `npm run test:cloud:smoke` 可复用脚本已落地（含 `Function Not Found` 重试策略）
- `question-bank` 修复后鉴权行为符合预期（401/403/400 分支正常）
- `login`（email/password）可签发 JWT
- `login` 已新增 `type=qq` 分支（H5/App/QQ小程序）
- `doc-convert`、`user-profile`、`favorite-manager`、`mistake-manager` 的带 token 调用通过
- `group-service`、`material-manager`、`study-stats`、`ai-friend-memory`、`school-query(get_favorites)` 的带 token 调用通过
- `id-photo-segment-base64`、`photo-bg` 基础链路可调用
- `send-email-code` 在 Gmail SMTP 配置后线上返回 `code:0`

---

## 5. 已知平台现象

- Sealos 网关偶发首次请求 `Function Not Found`
- 同一请求重试后通常恢复正常

建议：

- 验证脚本统一增加 2-3 次短间隔重试
- 关键监控以连续失败率为准，不以单次失败判定故障

---

## 6. 仍需补齐项

- QQ OAuth 仍需在 QQ 平台后台确认回调域与上线审核
- 前端端到端（真机/浏览器）全流程回归尚未完成
- 生产环境备份恢复演练记录需补齐（参考 `docs/BACKUP-STATUS-2026-02-28.md`）

---

## 7. 管理员密钥说明

- 管理员接口依赖环境变量 `ADMIN_SECRET`（如 `school-query sync_from_chsi`、`db-create-indexes`）
- 查看位置：Sealos/Laf 控制台 -> 当前应用 -> Environment Variables
- 若未配置，建议生成高强度随机值后写入 `ADMIN_SECRET`，并同步到团队密钥管理工具

---

## 8. 安全与文档规范

- 不要在文档中记录 PAT、API Key、Secret 明文
- 仅在 `.env` / 平台环境变量中维护密钥
- 每次发布后更新：
  - `docs/BASELINE-START-2026-02-28.md`
  - `docs/BACKUP-STATUS-2026-02-28.md`
  - 本文件（若部署基线或验证结论发生变化）
