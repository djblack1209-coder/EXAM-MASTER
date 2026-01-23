# 📁 .vscode 目录说明

本目录包含 VSCode 专用的自动化配置和工具脚本，用于 EXAM-MASTER 项目的 UI 全自动更新和质量监控。

---

## 📋 文件清单

### 配置文件
- **`tasks.json`** - VSCode 任务配置
  - 🚀 UI全自动更新
  - 📊 查看状态面板
  - 🧪 Console审计
  - 🏗️ 构建验证
  - 📈 生成质量报告

- **`settings.json`** - 项目特定设置
  - Vue/JavaScript 格式化配置
  - 文件排除规则
  - 终端环境变量

### 自动化脚本
- **`auto-update.sh`** ⭐ - 主执行脚本
  - 环境验证
  - Console.log 审计
  - 硬编码配置扫描
  - 构建验证
  - 后端依赖识别
  - 生成实时报告

- **`generate-report.sh`** - 质量报告生成器
  - 代码统计
  - 质量指标分析
  - 技术债务评分

### 报告文件
- **`update-status.md`** - 实时状态监控面板
- **`manual-tasks.md`** - 待人工处理清单
- **`backend-required.yml`** - 后端依赖清单
- **`console-audit.log`** - Console.log 审计日志
- **`auto-update-*.log`** - 执行日志（带时间戳）
- **`build.log`** - 构建日志

### 归档目录
- **`deprecated/`** - 废弃文件归档

---

## 🚀 快速开始

### 方法1: VSCode 任务面板（推荐）
1. 按 `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`)
2. 输入 "Tasks: Run Task"
3. 选择 "🚀 UI全自动更新"

### 方法2: 终端命令
```bash
# 执行完整更新流程
bash .vscode/auto-update.sh

# 生成质量报告
bash .vscode/generate-report.sh

# 仅执行 Console 审计
grep -r 'console\.log' src/ --include='*.vue' --include='*.js' | tee .vscode/console-audit.log
```

### 方法3: VSCode 快捷键
- 默认构建任务: `Ctrl+Shift+B` (Mac: `Cmd+Shift+B`)

---

## 📊 执行流程

```
启动 auto-update.sh
    ↓
阶段1: 环境验证
    ├─ Node.js/npm 版本检查
    ├─ Git 状态检查
    └─ 依赖完整性验证
    ↓
阶段2: Console.log 审计
    ├─ 统计开发环境 console.log
    ├─ 生成详细审计报告
    └─ 验证生产环境配置
    ↓
阶段3: 硬编码配置审计
    ├─ 扫描微信 AppID
    └─ 扫描 Sealos URL
    ↓
阶段4: 构建验证
    ├─ 执行 npm run build:mp-weixin
    └─ 验证构建产物无 console 残留
    ↓
阶段5: 后端依赖识别
    ├─ 扫描 lafService 调用
    ├─ 扫描 storageService 调用
    └─ 生成后端依赖清单
    ↓
阶段6: 生成实时状态报告
    └─ 创建 update-status.md
    ↓
阶段7: 生成待人工处理清单
    └─ 创建 manual-tasks.md
    ↓
完成 ✅
```

---

## 📈 输出报告说明

### update-status.md
**实时状态监控面板**
- ✅ 已完成任务
- ⏸️ 等待后端（智能跳过）
- 📝 待人工处理
- 📊 质量指标
- 🎯 下一步行动

### manual-tasks.md
**待人工处理清单**
- 🔴 高优先级（建议处理）
- 🟡 中优先级（可选处理）
- 🟢 低优先级（长期优化）
- ✅ 已完成项

### backend-required.yml
**后端依赖清单**
- AI功能测试
- 错题本云端同步
- 社交功能
- 排行榜功能
- PK对战功能

---

## 🎯 使用场景

### 场景1: 日常开发后的质量检查
```bash
# 完成一天的开发后
bash .vscode/auto-update.sh

# 查看状态面板
code .vscode/update-status.md
```

### 场景2: 发布前的全面检查
```bash
# 执行完整检查
bash .vscode/auto-update.sh

# 生成质量报告
bash .vscode/generate-report.sh

# 审查待办清单
code .vscode/manual-tasks.md
```

### 场景3: 快速 Console 审计
```bash
# 在 VSCode 中按 Ctrl+Shift+P
# 输入 "Tasks: Run Task"
# 选择 "🧪 Console审计"
```

---

## ⚙️ 配置说明

### 环境变量
脚本会自动检测以下环境：
- `NODE_VERSION` - Node.js 版本
- `NPM_VERSION` - npm 版本
- `GIT_BRANCH` - 当前 Git 分支
- `GIT_COMMIT` - 当前 Git 提交

### 自定义配置
可以在 `settings.json` 中修改：
- 文件排除规则
- 格式化配置
- 终端环境变量

---

## 🔧 故障排除

### 问题1: 脚本执行权限不足
```bash
chmod +x .vscode/auto-update.sh
chmod +x .vscode/generate-report.sh
```

### 问题2: 构建失败
```bash
# 查看详细日志
cat .vscode/build.log

# 清理后重新构建
rm -rf dist node_modules
npm ci
npm run build:mp-weixin
```

### 问题3: Git 状态异常
```bash
# 查看 Git 状态
git status

# 提交未保存的更改
git add -A
git commit -m "chore: 保存工作进度"
```

---

## 📝 维护说明

### 更新脚本
修改 `auto-update.sh` 或 `generate-report.sh` 后：
```bash
# 测试执行
bash .vscode/auto-update.sh

# 提交更改
git add .vscode/
git commit -m "chore: 更新自动化脚本"
```

### 清理日志
```bash
# 删除旧日志（保留最近3个）
ls -t .vscode/auto-update-*.log | tail -n +4 | xargs rm -f
```

---

## 🎉 特性

- ✅ **完全自动化** - 无需手动干预
- 🚫 **智能跳过** - 自动识别并跳过后端依赖
- 📊 **实时监控** - 生成详细的状态报告
- 📝 **完整记录** - 所有操作可追溯
- 💡 **人工清单** - 明确标注需要人工处理的任务

---

## 📚 相关文档

- [PROJECT_MEMORY_CRYSTAL.md](../PROJECT_MEMORY_CRYSTAL.md) - 项目记忆晶体
- [project-dna.json](../project-dna.json) - 项目DNA配置
- [.env.example](../.env.example) - 环境变量模板

---

**最后更新**: 2026-01-23  
**维护者**: Cline AI Assistant  
**项目**: EXAM-MASTER (UniApp微信小程序)
