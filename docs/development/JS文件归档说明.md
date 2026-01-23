# JS 文件归档说明

> **归档日期**：2025-01-22  
> **说明**：项目中的 JS 文件已按内容和作用分类归档

---

## 📁 归档结构

### 根目录文件（保留，不移动）

- **main.js** - 应用入口文件（Vue 应用初始化）
- **vite.config.js** - Vite 构建配置文件

### 配置相关（common/ - 已存在）

- **common/config.js** - 全局配置文件（API Key、URL 等）
- **common/zhipu.js** - 智谱AI 配置和封装

### 服务层（services/ - 已存在）

- **services/ai.js** - AI 服务封装
- **services/http.js** - HTTP 请求封装
- **services/lafService.js** - Sealos 后端服务封装
- **services/storageService.js** - 统一存储服务（本地+云端）
- **services/zhipuService.js** - 智谱AI 服务类

### 状态管理（stores/ - 已存在）

- **stores/index.js** - Pinia Store 入口
- **stores/modules/app.js** - 应用全局状态
- **stores/modules/school.js** - 择校功能状态
- **stores/modules/study.js** - 学习数据状态
- **stores/modules/todo.js** - 待办事项状态
- **stores/modules/user.js** - 用户状态管理

### 工具函数（utils/ - 已分类归档）

#### 🔧 核心工具 (utils/core/)
- **date.js** - 日期时间工具（格式化、问候语等）
- **system.js** - 系统信息工具（状态栏高度、设备信息等）
- **theme.js** - 主题管理工具（深色模式、护眼模式等）
- **jwt.js** - JWT 工具（智谱AI API 鉴权）
- **index.js** - 工具函数统一导出入口

#### 🐛 调试工具 (utils/debug/)
- **qa.js** - QA 测试日志工具（拦截网络请求、setData 等）

**注意**：Console 日志复制工具已移除，请使用 Raycast 或其他外部工具复制日志

#### 🛠️ 业务辅助工具 (utils/helpers/)
- **clearChatData.js** - 清除聊天数据工具
- **useNavbar.js** - 导航栏工具（高度计算、样式管理等）

### 测试脚本（test/ - 已存在）

- **test/audit.js** - 自动化测试脚本（小程序自动化测试）

### 备份文件（docs/backup/ - 已归档）

- **docs/backup/uniCloud-aliyun.backup/** - 阿里云 uniCloud 备份文件

---

## ⚠️ 引用路径更新

以下文件的引用路径已更新：

### 已更新的文件

1. **App.vue**
   - `@/utils/qa.js` → `@/utils/debug/qa.js`
   - ~~`./utils/consoleHelper.js`~~ → 已删除（Console 日志复制工具已移除）

2. **pages/index/index.vue**
   - `@/utils/date` → `@/utils/core/date`
   - `@/utils/system` → `@/utils/core/system`

3. **pages/settings/index.vue**
   - `@/utils/theme.js` → `@/utils/core/theme.js`

4. **components/HomeNavbar.vue**
   - `@/utils/useNavbar` → `@/utils/helpers/useNavbar`

5. **services/zhipuService.js**
   - `../utils/jwt.js` → `../utils/core/jwt.js`

### 需要检查的文件

如果以下文件中有直接引用这些工具函数，需要手动更新：

- `pages/**/*.vue`
- `components/**/*.vue`
- `services/**/*.js`
- `stores/**/*.js`

**更新规则**：
- `@/utils/date` → `@/utils/core/date`
- `@/utils/system` → `@/utils/core/system`
- `@/utils/theme` → `@/utils/core/theme`
- `@/utils/jwt` → `@/utils/core/jwt`
- `@/utils/qa` → `@/utils/debug/qa`
- ~~`@/utils/consoleHelper`~~ → 已删除（Console 日志复制工具已移除）
- `@/utils/useNavbar` → `@/utils/helpers/useNavbar`
- `@/utils/clearChatData` → `@/utils/helpers/clearChatData`

---

## 📋 归档统计

- **核心工具**：5 个文件
- **调试工具**：1 个文件（Console 日志复制工具已移除，请使用 Raycast）
- **业务辅助工具**：2 个文件
- **总计**：8 个工具文件已分类归档

---

## 🔍 快速查找

### 需要日期格式化？
→ `utils/core/date.js`

### 需要系统信息？
→ `utils/core/system.js`

### 需要主题管理？
→ `utils/core/theme.js`

### 需要复制 Console 日志？
→ 使用 Raycast 或其他外部工具（详见 `docs/setup/Raycast日志复制使用指南.md`）

### 需要清除聊天数据？
→ `utils/helpers/clearChatData.js`

---

## 📝 注意事项

1. **编译产物**：`unpackage/` 目录中的编译产物会自动更新，无需手动修改
2. **系统模块**：`uni_modules/` 目录中的文件是 uni-app 系统模块，不移动
3. **备份文件**：`docs/backup/` 中的文件是历史备份，保留用于参考

---

**提示**：如果编译时出现模块找不到的错误，请检查并更新相应的导入路径。
