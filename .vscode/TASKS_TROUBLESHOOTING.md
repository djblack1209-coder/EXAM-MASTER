# VSCode 任务故障排查完整指南

## 当前状态

✅ tasks.json 文件语法正确
✅ 工作区文件已创建 (EXAM-MASTER.code-workspace)
✅ 5个任务已配置

## 问题：任务仍然不显示

如果您已经：
1. ✅ 使用工作区文件打开项目
2. ✅ 重新加载了VSCode窗口
3. ❌ 但仍然看不到任务

这可能是VSCode的已知问题。以下是完整的解决方案。

---

## 解决方案A：使用 tasks.json 的绝对路径（最可靠）

VSCode有时无法正确解析相对路径。让我们使用绝对路径：

### 步骤1：确认当前路径
```bash
pwd
# 应该输出: /Users/blackdj/Desktop/EXAM-MASTER
```

### 步骤2：创建新的tasks配置
在VSCode中：
1. 按 `Cmd+Shift+P`
2. 输入 `Tasks: Configure Task`
3. 选择 `Create tasks.json file from template`
4. 选择 `Others`

这会创建一个新的tasks.json模板。

### 步骤3：手动添加任务
将以下内容复制到新创建的tasks.json中：

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "🚀 UI全自动更新",
      "type": "shell",
      "command": "bash",
      "args": [
        "${workspaceFolder}/.vscode/auto-update.sh"
      ],
      "problemMatcher": [],
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "dedicated",
        "showReuseMessage": false
      },
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "📊 查看状态面板",
      "type": "shell",
      "command": "code",
      "args": [
        "${workspaceFolder}/.vscode/update-status.md"
      ],
      "problemMatcher": []
    },
    {
      "label": "🧪 Console审计",
      "type": "shell",
      "command": "bash",
      "args": [
        "-c",
        "cd ${workspaceFolder} && grep -r 'console\\.log' src/ --include='*.vue' --include='*.js' | tee .vscode/console-audit.log && echo '✅ 审计完成'"
      ],
      "problemMatcher": []
    },
    {
      "label": "🏗️ 构建验证",
      "type": "shell",
      "command": "bash",
      "args": [
        "-c",
        "cd ${workspaceFolder} && npm run build:mp-weixin"
      ],
      "problemMatcher": []
    },
    {
      "label": "📈 生成质量报告",
      "type": "shell",
      "command": "bash",
      "args": [
        "${workspaceFolder}/.vscode/generate-report.sh"
      ],
      "problemMatcher": []
    }
  ]
}
```

---

## 解决方案B：检查VSCode设置

### 1. 检查是否禁用了任务自动检测

在VSCode中：
1. 按 `Cmd+,` 打开设置
2. 搜索 `task.autoDetect`
3. 确保它设置为 `on` 或至少包含 `gulp`、`npm` 等

### 2. 检查工作区信任

1. 按 `Cmd+Shift+P`
2. 输入 `Workspace: Manage Workspace Trust`
3. 确保工作区是受信任的

---

## 解决方案C：使用VSCode的内置任务运行器

如果自定义任务仍然不工作，使用npm scripts作为任务：

### 步骤1：在package.json中添加scripts

打开 `package.json`，在 `scripts` 部分添加：

```json
{
  "scripts": {
    "ui:update": "bash .vscode/auto-update.sh",
    "ui:quick": "bash .vscode/auto-update.sh --quick",
    "ui:status": "code .vscode/update-status.md",
    "ui:audit": "grep -r 'console\\.log' src/ --include='*.vue' --include='*.js' | tee .vscode/console-audit.log",
    "ui:report": "bash .vscode/generate-report.sh"
  }
}
```

### 步骤2：使用npm任务

1. 按 `Cmd+Shift+P`
2. 输入 `Tasks: Run Task`
3. 选择 `npm`
4. 现在应该能看到所有 `ui:*` 任务

---

## 解决方案D：终极方案 - 使用快捷键

如果以上都不行，创建键盘快捷键：

### 步骤1：打开键盘快捷键设置
1. 按 `Cmd+K Cmd+S`
2. 点击右上角的"打开键盘快捷键(JSON)"图标

### 步骤2：添加快捷键
```json
[
  {
    "key": "cmd+shift+u",
    "command": "workbench.action.terminal.sendSequence",
    "args": {
      "text": "bash .vscode/auto-update.sh\n"
    }
  }
]
```

现在按 `Cmd+Shift+U` 就会在终端中运行完整流水线。

---

## 验证步骤

### 方法1：检查VSCode是否识别了tasks.json

1. 打开 `.vscode/tasks.json` 文件
2. 查看左侧是否有"运行任务"的图标
3. 如果有，点击它应该能看到任务列表

### 方法2：使用命令面板

1. 按 `Cmd+Shift+P`
2. 输入 `Tasks: Run Build Task`
3. 应该直接运行"🚀 UI全自动更新"任务

### 方法3：使用快捷键

1. 按 `Cmd+Shift+B`（默认构建任务快捷键）
2. 应该运行"🚀 UI全自动更新"任务

---

## 最终替代方案：命令行别名

如果VSCode任务功能完全无法使用，在 `~/.zshrc` 或 `~/.bash_profile` 中添加别名：

```bash
# EXAM-MASTER 自动化别名
alias exam-update='cd /Users/blackdj/Desktop/EXAM-MASTER && bash .vscode/auto-update.sh'
alias exam-quick='cd /Users/blackdj/Desktop/EXAM-MASTER && bash .vscode/auto-update.sh --quick'
alias exam-status='cd /Users/blackdj/Desktop/EXAM-MASTER && code .vscode/update-status.md'
alias exam-audit='cd /Users/blackdj/Desktop/EXAM-MASTER && npm run audit:console'
alias exam-report='cd /Users/blackdj/Desktop/EXAM-MASTER && bash .vscode/generate-report.sh'
```

然后在任何终端中运行：
```bash
exam-update    # 完整流水线
exam-quick     # 快速检查
exam-status    # 查看状态
exam-audit     # Console审计
exam-report    # 生成报告
```

---

## 重要提示

### Git Hooks 仍然完全正常工作

无论VSCode任务是否工作，Git Hooks自动化都是完全独立的：

```bash
# 每次commit前自动执行快速检查
git add .
git commit -m "your message"
# → 自动触发 .husky/pre-commit

# 每次push前自动执行完整流水线  
git push origin main
# → 自动触发 .husky/pre-push
```

### 核心功能不受影响

自动化流水线的核心功能通过以下方式仍然可用：

1. **Git Hooks** - 自动触发（最重要）
2. **命令行** - 直接运行脚本
3. **npm scripts** - 通过package.json
4. **终端别名** - 快捷命令

VSCode任务只是一个便利的UI界面，不是必需的。

---

## 需要帮助？

如果以上所有方法都不工作，请提供以下信息：

1. VSCode版本：Help → About
2. 操作系统版本
3. VSCode输出面板的"Tasks"频道内容
4. 运行 `code --version` 的输出
5. 是否使用了VSCode的远程开发功能

---

## 成功标志

当任务正常工作时，您应该能够：

✅ 在命令面板中看到5个自定义任务
✅ 使用 `Cmd+Shift+B` 运行默认构建任务
✅ 在tasks.json文件中看到"运行任务"图标
✅ 任务执行时在终端面板中看到输出

如果仍然无法工作，请使用命令行替代方案，功能完全相同。
