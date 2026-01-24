# VSCode 任务配置说明

## 问题：任务未显示在命令面板中

如果按 `Ctrl+Shift+P` → 输入 "Tasks: Run Task" 后看不到任务列表，请按以下步骤操作：

## 解决方案

### 方法1：重新加载VSCode窗口（推荐）
1. 按 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）
2. 输入 `Reload Window`
3. 选择 `Developer: Reload Window`
4. 等待窗口重新加载完成
5. 再次按 `Ctrl+Shift+P` → 输入 `Tasks: Run Task`
6. 现在应该能看到5个任务了

### 方法2：完全重启VSCode
1. 关闭VSCode
2. 重新打开项目文件夹
3. 按 `Ctrl+Shift+P` → 输入 `Tasks: Run Task`

### 方法3：手动验证任务配置
```bash
# 在终端中验证任务配置是否正确
cat .vscode/tasks.json | grep '"label"'
```

应该看到以下5个任务：
- 🚀 UI全自动更新
- 📊 查看状态面板
- 🧪 Console审计
- 🏗️ 构建验证
- 📈 生成质量报告

## 可用任务列表

### 1. 🚀 UI全自动更新
**快捷键**: `Ctrl+Shift+B`（默认构建任务）
**命令**: `bash .vscode/auto-update.sh`
**说明**: 执行完整的自动化流水线

### 2. 📊 查看状态面板
**命令**: `code .vscode/update-status.md`
**说明**: 打开实时状态监控面板

### 3. 🧪 Console审计
**命令**: 扫描所有console.log
**说明**: 生成console使用报告

### 4. 🏗️ 构建验证
**命令**: `npm run build:mp-weixin`
**说明**: 构建并验证生产环境代码

### 5. 📈 生成质量报告
**命令**: `bash .vscode/generate-report.sh`
**说明**: 生成完整的质量分析报告

## 替代方案：使用命令行

如果VSCode任务仍然无法使用，可以直接在终端中运行：

```bash
# 完整流水线
bash .vscode/auto-update.sh

# 快速检查
bash .vscode/auto-update.sh --quick

# 查看状态
code .vscode/update-status.md

# Console审计
npm run audit:console

# 构建验证
npm run build:mp-weixin

# 生成报告
bash .vscode/generate-report.sh
```

## 验证任务是否加载成功

重新加载窗口后，执行以下步骤验证：

1. 按 `Ctrl+Shift+P`
2. 输入 `task`
3. 应该看到以下选项：
   - Tasks: Run Task
   - Tasks: Run Build Task
   - Tasks: Configure Task
   - Tasks: Show Running Tasks
   等等

4. 选择 `Tasks: Run Task`
5. 应该看到5个任务列表

## 故障排查

### 如果重新加载后仍然看不到任务

1. **检查tasks.json语法**
   ```bash
   cat .vscode/tasks.json | python3 -m json.tool
   ```
   如果有语法错误会显示错误信息

2. **检查VSCode输出面板**
   - 按 `Ctrl+Shift+U` 打开输出面板
   - 选择 "Tasks" 频道
   - 查看是否有错误信息

3. **检查VSCode版本**
   - 确保使用的是最新版本的VSCode
   - 某些旧版本可能不支持某些任务配置

4. **检查工作区设置**
   - 确保在正确的工作区中
   - 任务配置只在项目根目录的 `.vscode/tasks.json` 中有效

## 成功标志

重新加载后，你应该能够：
- ✅ 在命令面板中看到5个任务
- ✅ 使用 `Ctrl+Shift+B` 快速运行默认构建任务
- ✅ 在终端面板中看到任务执行输出
- ✅ 任务执行完成后看到成功/失败状态

如果以上步骤都无法解决问题，请检查VSCode的扩展是否有冲突，或尝试在新的VSCode窗口中打开项目。
