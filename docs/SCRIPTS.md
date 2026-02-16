# EXAM-MASTER 脚本文档

> 版本: 1.0.0  
> 更新日期: 2026-02-06

## 目录

1. [UI 质量门禁扫描](#ui-质量门禁扫描)
2. [文件清理脚本](#文件清理脚本)
3. [构建脚本](#构建脚本)

---

## UI 质量门禁扫描

**文件**: `scripts/build/ui-quality-gate.js`

**描述**: 自动化 UI 代码质量检查工具，用于确保代码符合项目规范。

### 功能

1. **加载状态检查** - 检查异步操作是否有对应的加载状态和 UI 反馈
2. **错误处理检查** - 检查是否有 try-catch 和用户友好的错误提示
3. **CSS 性能检查** - 检查是否使用 GPU 加速和优化的动画
4. **无障碍访问检查** - 检查图片 alt 属性、按钮 aria-label 等
5. **代码规范检查** - 检查 console.log 使用、硬编码颜色等

### 使用方法

```bash
# 运行质量检查
node scripts/ui-quality-gate.js

# 在 CI/CD 中使用（失败时退出码为 1）
node scripts/ui-quality-gate.js || exit 1
```

### 输出示例

```
🔍 开始 UI 质量门禁扫描...
   扫描目录: /path/to/src
   发现 120 个文件

╔════════════════════════════════════════════════════════════╗
║              UI 质量门禁扫描报告                           ║
╚════════════════════════════════════════════════════════════╝

📊 扫描统计:
   总文件数: 120
   Vue 组件: 85
   JS 文件: 35
   加载状态实现: 42
   错误处理覆盖: 56
   GPU 加速组件: 28

✅ 通过项 (45):
   index.vue: 加载状态实现完整
   chat.vue: 错误处理完整
   ...

⚠️  警告项 (12):
   profile.vue: 有异步操作但缺少加载状态
   ...

═══════════════════════════════════════════════════════════════
📈 质量评分: 78/100
👍 良好，但仍有改进空间
═══════════════════════════════════════════════════════════════
```

### 配置选项

在脚本开头的 `CONFIG` 对象中可以修改：

```javascript
const CONFIG = {
  srcDir: path.join(__dirname, '../src'),      // 扫描目录
  pagesDir: path.join(__dirname, '../src/pages'),
  componentsDir: path.join(__dirname, '../src/components'),
  extensions: ['.vue', '.js'],                  // 扫描的文件类型
  ignorePatterns: ['node_modules', 'dist']      // 忽略的目录
};
```

### 检查规则详解

#### 1. 加载状态检查

检测条件：
- 文件中包含 `async`、`.then(`、`await`、`uni.request`、`lafService.` 等异步操作
- 应该有 `isLoading`、`loading` 等状态变量
- 应该有 `v-if="loading"`、`uni.showLoading` 等 UI 反馈

#### 2. 错误处理检查

检测条件：
- 有 `try-catch` 或 `.catch()` 错误捕获
- 有 `uni.showToast` 或 `uni.showModal` 用户提示
- 或使用了全局错误处理器 `globalErrorHandler`

#### 3. CSS 性能检查

检测条件：
- 使用 `transform` 代替 `top/left` 动画
- 使用 `will-change`、`translateZ(0)`、`backface-visibility` 启用 GPU 加速
- 使用 `backdrop-filter` 等需要 GPU 的属性

#### 4. 无障碍访问检查

检测条件：
- `<image>` 标签应有 `mode` 或 `alt` 属性
- 空按钮应有 `aria-label` 属性

#### 5. 代码规范检查

检测条件：
- 应使用 `logger` 代替 `console.log`
- 应使用 CSS 变量代替硬编码颜色值

---

## 文件清理脚本

**文件**: `scripts/fix/delete-chat-files.sh`

**描述**: 清理聊天相关的临时文件和缓存。

### 使用方法

```bash
# 添加执行权限
chmod +x scripts/delete-chat-files.sh

# 运行清理
./scripts/delete-chat-files.sh
```

### 清理内容

- 聊天记录缓存文件
- 临时上传文件
- 过期的会话数据

---

## 构建脚本

项目使用 npm scripts 进行构建，定义在 `package.json` 中：

### 开发命令

```bash
# H5 开发模式
npm run dev:h5

# 微信小程序开发模式
npm run dev:mp-weixin

# QQ 小程序开发模式
npm run qq
```

### 构建命令

```bash
# H5 生产构建
npm run build:h5

# 微信小程序生产构建
npm run build:mp-weixin

# QQ 小程序生产构建
npm run build:mp-qq
```

### 测试命令

```bash
# 运行单元测试
npm run test

# 运行单元测试（单次）
npm run test:run

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行视觉回归测试
npm run test:visual

# 更新视觉测试快照
npm run test:visual:update

# 打开视觉测试 UI
npm run test:visual:ui
```

### 代码检查命令

```bash
# 运行 ESLint 检查
npm run lint

# 运行 ESLint 并自动修复
npm run lint:fix
```

---

## 自定义脚本开发指南

### 创建新脚本

1. 在 `scripts/` 目录下创建脚本文件
2. 添加文件头注释说明用途
3. 如果是脚本，添加 shebang: `#!/usr/bin/env node`
4. 如果是 Shell 脚本，添加 shebang: `#!/bin/bash`

### 脚本模板

**Node.js 脚本模板**:

```javascript
#!/usr/bin/env node
/**
 * 脚本名称
 * 
 * 功能描述：
 * 1. 功能1
 * 2. 功能2
 * 
 * 使用方法：
 * node scripts/script-name.js [options]
 * 
 * 参数说明：
 * --option1  选项1说明
 * --option2  选项2说明
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // ...
};

// 主函数
function main() {
  console.log('开始执行...');
  // 脚本逻辑
}

// 运行
main();
```

**Shell 脚本模板**:

```bash
#!/bin/bash
#
# 脚本名称
#
# 功能描述：
# 1. 功能1
# 2. 功能2
#
# 使用方法：
# ./scripts/script-n [options]
#

set -e  # 遇到错误立即退出

# 配置
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 主逻辑
echo "开始执行..."
# 脚本逻辑

echo "完成！"
```

### 最佳实践

1. **错误处理**: 使用 `set -e`（Shell）或 try-catch（Node.js）
2. **日志输出**: 使用清晰的日志格式，包含时间戳和级别
3. **参数验证**: 检查必要参数是否提供
4. **退出码**: 成功返回 0，失败返回非 0
5. **文档**: 在脚本开头添加详细的使用说明

---

## CI/CD 集成

脚本可以集成到 GitHub Actions 工作流中：

```yaml
# .github/workflows/ci.yml
jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actietup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: node scripts/ui-quality-gate.js
```
