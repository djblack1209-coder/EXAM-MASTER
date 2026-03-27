# Document Update Protocol

> 定义何时、更新哪些文档的触发规则

## Trigger Matrix

| When you...                                      | Update these docs                                      |
| ------------------------------------------------ | ------------------------------------------------------ |
| Change frontend page (`src/pages/`)              | `modules/frontend-pages.md` + CHANGE-LOG               |
| Change component (`src/components/`)             | `modules/frontend-components.md` + CHANGE-LOG          |
| Change service (`src/services/`)                 | `modules/frontend-services.md` + CHANGE-LOG            |
| Change store (`src/stores/`)                     | `modules/frontend-stores.md` + CHANGE-LOG              |
| Change cloud function (`laf-backend/functions/`) | `modules/backend-functions.md` + CHANGE-LOG            |
| Change DB schema                                 | `modules/backend-schemas.md` + CHANGE-LOG              |
| Change API contract                              | `modules/api-documentation.md` + CHANGE-LOG            |
| Add/remove dependency                            | `PROJECT-BRIEF.md` + CHANGE-LOG                        |
| Change build/deploy config                       | `ARCHITECTURE.md` + CHANGE-LOG                         |
| Discover a bug                                   | `docs/status/HEALTH.md` → Active Issues                |
| Fix a bug                                        | `docs/status/HEALTH.md` → move to Resolved             |
| Identify tech debt                               | `docs/status/HEALTH.md` → Tech Debt                    |
| Change styles/theme                              | `modules/styling-system.md` + CHANGE-LOG               |
| Change test infra                                | `modules/testing-infra.md` + CHANGE-LOG                |
| Add new LLM provider                             | `modules/backend-functions.md` (号池章节) + CHANGE-LOG |
| Change server config                             | CHANGE-LOG (scope: `deploy` or `infra`)                |

## CHANGE-LOG Entry Format

```markdown
## [YYYY-MM-DD] Brief Title

- **Scope**: [frontend|backend|ai-pool|deploy|auth|database|docs|infra]
- **Files Changed**: list of files
- **Summary**: what was done and why
- **Breaking Changes**: any API/behavior changes (or "None")
```

### Scope Tags

| Tag        | When to use                                     |
| ---------- | ----------------------------------------------- |
| `frontend` | Vue pages, components, stores, services, styles |
| `backend`  | Cloud functions, shared modules, DB operations  |
| `ai-pool`  | LLM provider changes, API keys, model updates   |
| `deploy`   | Server config, Nginx, PM2, Docker, CF Worker    |
| `auth`     | JWT, login, password, admin auth                |
| `database` | Schema changes, indexes, migrations             |
| `docs`     | Documentation-only changes                      |
| `infra`    | CI/CD, monitoring, backup, security             |

## Bug Lifecycle in HEALTH.md

```
发现 Bug
  → 记录到 HEALTH.md「Active Issues」
  → 分配 ID: H{NNN}
  → 标注严重度: 🔴 Blocker | 🟠 Important | 🟡 Normal | 🔵 Low
  → 标注领域: frontend | backend | deploy | auth | database | infra

修复 Bug
  → 移至「Recently Resolved」
  → 标注解决方案 + 日期
  → ID 改为 R{NNN}

识别深层问题
  → 记入「Tech Debt」
  → ID: D{NNN}
  → 评估优先级和影响
```
