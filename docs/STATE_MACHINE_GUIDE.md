# 🤖 状态机自动化开发指南

## 📋 目录

1. [概述](#概述)
2. [角色矩阵](#角色矩阵)
3. [状态流转](#状态流转)
4. [使用方法](#使用方法)
5. [文件系统](#文件系统)
6. [决策逻辑](#决策逻辑)
7. [故障排查](#故障排查)
8. [最佳实践](#最佳实践)

---

## 概述

EXAM-MASTER 项目采用**5角色状态机**自动化开发模式，实现从需求分析到代码部署的全流程自动化。

### 核心特性

- ✅ **完全自动化**：无需人工干预，自动循环迭代
- ✅ **角色沉浸**：5个专家角色各司其职
- ✅ **质量保障**：QA评分机制确保代码质量
- ✅ **智能熔断**：自动识别致命错误并停止
- ✅ **增量扫描**：只关注变更文件，提升效率

### 系统架构

```
用户输入 [自动化]
    ↓
状态A: PM (价值规划) → logs/pm-plan.json
    ↓
状态B: Architect (设计) → logs/arch-design.json
    ↓
状态C: Dev (构建) → 代码文件 + logs/dev-implementation.log
    ↓
状态D: QA (验收) → logs/test-report.md
    ↓
状态E: DevOps (决策)
    ├─ 评分≥95% → Git提交 → 新循环 (回到状态A)
    ├─ 80%≤评分<95% → 重试 (回到状态C)
    └─ 评分<80% → 熔断 (STOP)
```

---

## 角色矩阵

### 🧐 产品经理 (PM) - 价值定义者

**职责**：
- 从 `docs/PRD_Auto.md` 和 `TODO.md` 中选定 1 个 MVP 功能
- 拆解用户故事，制定验收标准
- 基于用户价值排序优先级

**输出**：`logs/pm-plan.json`

**示例输出**：
```json
{
  "cycle_id": "v5.1-iter1",
  "selected_feature": "优化上传题库体验",
  "user_stories": [
    {
      "id": "US-001",
      "as_a": "作为考研学生",
      "i_want": "我想要看到上传进度",
      "so_that": "以便于知道上传是否成功",
      "acceptance_criteria": [
        "显示实时进度条",
        "上传成功后有明确提示"
      ]
    }
  ],
  "priority": "P0",
  "estimated_hours": 4
}
```

---

### 🏗️ 架构师 (Architect) - 技术决策者

**职责**：
- 分析 PM 计划，识别技术债务
- 增量扫描变更文件（只关注 git diff）
- 制定重构方案和实施计划

**输出**：`logs/arch-design.json`

**示例输出**：
```json
{
  "cycle_id": "v5.1-iter1",
  "impact_analysis": {
    "affected_files": ["src/pages/practice/import-data.vue"],
    "affected_components": ["EnhancedProgress"],
    "affected_services": ["lafService"]
  },
  "design_decisions": [
    {
      "decision": "添加实时进度条",
      "rationale": "提升用户感知，降低焦虑",
      "implementation": "使用 uni.uploadFile 的 onProgressUpdate"
    }
  ],
  "refactor_plan": {
    "files_to_modify": ["src/pages/practice/import-data.vue"],
    "files_to_create": [],
    "estimated_loc": 150
  }
}
```

---

### 💻 全栈工程师 (Dev) - 核心执行者

**职责**：
- 根据架构设计实现前端 UI
- 开发后端云函数（如需要）
- 防御性编程：错误处理、边界检查

**输出**：
- 实际代码文件（前端 + 后端）
- `logs/dev-implementation.log`

**示例输出**：
```json
{
  "cycle_id": "v5.1-iter1",
  "files_modified": [
    {
      "path": "src/pages/practice/import-data.vue",
      "lines_added": 45,
      "lines_deleted": 12,
      "changes": ["添加进度条", "优化错误提示"]
    }
  ],
  "self_check": {
    "lint_passed": true,
    "build_passed": true,
    "manual_test": "已测试上传1MB/10MB/50MB文件"
  }
}
```

---

### 🛡️ 质量保障 (QA) - 守门员

**职责**：
- 运行构建和测试脚本
- 对照 PM 的验收标准逐条核对
- 性能测试和回归验证

**输出**：`logs/test-report.md`

**示例输出**：
```markdown
# QA 测试报告 - v5.1-iter1

## 验收结果
- ✅ US-001: 上传进度实时显示 (通过)
- ✅ US-002: 错误提示友好 (通过)

## 性能指标
- 构建时间: 45s (正常)
- 包体积: 2.3MB (增加50KB，可接受)
- 加载时间: 1.2s (优化前1.8s，提升33%)

## 遗留风险
- 🟡 中风险: 100MB以上文件可能超时

## 价值评分
- 功能完整度: 95%
- 用户体验提升: +40%
- 技术债务: 无新增
- **总分**: 95/100
```

---

### 🚀 DevOps 工程师 - 发布官

**职责**：
- 读取 QA 测试报告
- 根据评分自动决策（继续/重试/停止）
- Git 提交和分支管理

**输出**：
- Git Commit Log
- `logs/progress.log`

**决策逻辑**：
```
IF (评分 >= 95% AND 无P0错误):
  → Git 提交 + 推送
  → 写入 "START_NEW_CYCLE"
  → 启动新循环

ELSE IF (评分 >= 80% AND 重试次数 < 3):
  → 写入 "RETRY_CYCLE_{N}"
  → 回到状态C重试

ELSE:
  → 写入 "CRITICAL_FAILURE"
  → 停止循环
```

---

## 状态流转

### 状态转移图

```
┌─────────────────────────────────────────────────────────┐
│                    自动化循环                            │
│                                                          │
│  A (PM) → B (Architect) → C (Dev) → D (QA) → E (DevOps) │
│    ↑                                              │      │
│    │                                              ↓      │
│    └──────────────── 评分≥95% ────────────────────┘      │
│                                                          │
│                      ↓ 80%≤评分<95%                      │
│                      C (Dev) ← 重试                      │
│                                                          │
│                      ↓ 评分<80%                          │
│                      STOP (熔断)                         │
└─────────────────────────────────────────────────────────┘
```

### 强制出口规则

每个状态必须以**工具调用**结束，确保状态转移的确定性：

| 状态 | 强制出口工具 | 目的 |
|------|-------------|------|
| A (PM) | `read_file('logs/pm-plan.json')` | 将计划传给 Architect |
| B (Architect) | `read_file('logs/arch-design.json')` | 将设计传给 Dev |
| C (Dev) | `execute_command('npm run build:mp-weixin')` | 触发构建，传给 QA |
| D (QA) | `read_file('logs/test-report.md')` | 将报告传给 DevOps |
| E (DevOps) | `write_to_file('logs/progress.log', ...)` | 标记循环状态 |

---

## 使用方法

### 1. 手动触发自动化

在 Cline 中输入：

```
[自动化]
```

系统将：
1. 初始化 `logs/progress.log` 为 `"START_NEW_CYCLE"`
2. 进入状态 A (PM)
3. 开始自动循环

### 2. 监控循环状态

```bash
# 查看当前状态
cat logs/progress.log

# 查看最新评分
tail -n 20 logs/test-report.md | grep "总分"

# 查看错误日志
cat logs/error_log.txt
```

### 3. 测试状态机

```bash
# 测试完美通过场景（评分95）
node scripts/test-state-machine.js full 95

# 测试重试场景（评分85）
node scripts/test-state-machine.js full 85

# 测试熔断场景（评分70）
node scripts/test-state-machine.js full 70

# 清理测试文件
node scripts/test-state-machine.js clean
```

---

## 文件系统

### 日志目录结构

```
logs/
├── progress.log              # 循环状态标记
├── pm-plan.json              # PM 输出
├── arch-design.json          # Architect 输出
├── dev-implementation.log    # Dev 输出
├── test-report.md            # QA 输出
├── error_log.txt             # 错误日志
├── CRITICAL_FAILURE.md       # 熔断标记
└── v5.1/                     # 版本归档
    ├── pm-plan-iter1.json
    ├── arch-design-iter1.json
    ├── dev-implementation-iter1.log
    ├── test-report-iter1.md
    └── ...
```

### 文件命名规范

- **循环ID格式**：`v{版本号}-iter{迭代次数}`
  - 示例：`v5.1-iter1`, `v5.1-iter2`
- **时间戳格式**：`YYYY-MM-DD HH:mm:ss`
- **归档规则**：每次循环结束后，将日志文件复制到版本目录

---

## 决策逻辑

### DevOps 决策树

```
读取 test-report.md
    ↓
提取评分
    ↓
┌─────────────────────────────────────┐
│ 评分 >= 95% AND 无P0错误？          │
├─────────────────────────────────────┤
│ YES → 场景1: 完美通过                │
│   1. git add .                      │
│   2. git commit -m "auto: ..."     │
│   3. git push origin main          │
│   4. write "START_NEW_CYCLE"       │
│   5. 回到状态A                      │
└─────────────────────────────────────┘
    ↓ NO
┌─────────────────────────────────────┐
│ 80% <= 评分 < 95% AND 重试<3次？    │
├─────────────────────────────────────┤
│ YES → 场景2: 需要重试                │
│   1. read progress.log             │
│   2. write "RETRY_CYCLE_{N}"       │
│   3. write error_log.txt           │
│   4. 回到状态C                      │
└─────────────────────────────────────┘
    ↓ NO
┌─────────────────────────────────────┐
│ 场景3: 致命错误/熔断                 │
├─────────────────────────────────────┤
│   1. write CRITICAL_FAILURE.md     │
│   2. echo "SYSTEM HALTED"          │
│   3. STOP                          │
└─────────────────────────────────────┘
```

### 评分标准

| 评分范围 | 决策 | 动作 |
|---------|------|------|
| 95-100 | ✅ 完美通过 | Git提交 → 新循环 |
| 80-94 | ⚠️ 需要重试 | 回到状态C（最多3次） |
| 0-79 | ❌ 致命错误 | 熔断停止 |

---

## 故障排查

### 常见问题

#### 1. 状态机卡住不动

**症状**：循环停在某个状态，长时间无响应

**排查步骤**：
```bash
# 1. 检查当前状态
cat logs/progress.log

# 2. 检查最后生成的文件
ls -lt logs/ | head -n 5

# 3. 检查错误日志
cat logs/error_log.txt
```

**解决方案**：
- 如果超过30分钟，手动触发熔断
- 检查文件权限是否正确
- 确认 Git 状态是否干净

#### 2. 重试次数超限

**症状**：`logs/progress.log` 显示 `RETRY_CYCLE_3`

**排查步骤**：
```bash
# 查看测试报告
cat logs/test-report.md

# 查看开发日志
cat logs/dev-implementation.log
```

**解决方案**：
- 人工检查代码质量
- 修复 QA 报告中的问题
- 清理日志后重新启动：`[自动化]`

#### 3. 熔断后无法恢复

**症状**：`logs/CRITICAL_FAILURE.md` 存在

**排查步骤**：
```bash
# 查看熔断原因
cat logs/CRITICAL_FAILURE.md

# 查看 Git 状态
git status
```

**解决方案**：
1. 根据熔断原因修复问题
2. 删除熔断标记：`rm logs/CRITICAL_FAILURE.md`
3. 清理日志：`node scripts/test-state-machine.js clean`
4. 重新启动：`[自动化]`

---

## 最佳实践

### 1. 准备工作

在启动自动化前，确保：

- ✅ `docs/PRD_Auto.md` 已更新
- ✅ `TODO.md` 包含待办任务
- ✅ Git 工作区干净（`git status` 无未提交文件）
- ✅ 依赖已安装（`npm install`）

### 2. 监控建议

- 每次循环后检查 `logs/test-report.md` 的评分
- 定期归档日志到 `logs/v{版本号}/`
- 关注 `error_log.txt` 中的警告信息

### 3. 性能优化

- **增量扫描**：Architect 只扫描最近7天修改的文件
- **并行开发**：Dev 同时处理前端和后端
- **缓存复用**：避免重复读取相同文件

### 4. 质量保障

- PM 选择功能时优先考虑用户价值
- Architect 避免过度设计（YAGNI原则）
- Dev 必须添加错误处理和边界检查
- QA 必须对照验收标准逐条核对

### 5. 安全规范

- ❌ 禁止删除代码文件（使用 `_TRASH_BIN/`）
- ❌ 禁止硬编码敏感信息（使用环境变量）
- ✅ 大规模变更前运行 `git status`
- ✅ 每次循环后自动 Git 提交

---

## 附录

### A. 循环ID命名规范

```
v{主版本}.{次版本}-iter{迭代次数}

示例：
- v5.1-iter1  # 第1次迭代
- v5.1-iter2  # 第2次迭代
- v5.2-iter1  # 版本升级后的第1次迭代
```

### B. Git 提交规范

```bash
git commit -m "auto(v5.1-iter1): 功能描述 - 评分XX%

- 变更点1
- 变更点2
- 变更点3

QA评分: XX/100
遗留风险: X个中风险
"
```

### C. 相关文档

- [`.clinerules`](../.clinerules) - 完整规则定义
- [`_PROJECT_MEMORY_CORE.md`](../_PROJECT_MEMORY_CORE.md) - 项目记忆
- [`scripts/test-state-machine.js`](../scripts/test-state-machine.js) - 测试脚本

---

**系统就绪。请指示："[自动化]" 启动状态机！**