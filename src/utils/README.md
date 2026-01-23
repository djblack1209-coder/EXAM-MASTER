# Utils 工具函数目录

> **归档日期**：2025-01-22  
> **说明**：工具函数已按功能分类归档

---

## 📁 目录结构

```
utils/
├── core/              # 核心工具函数
│   ├── date.js        # 日期时间工具
│   ├── system.js      # 系统信息工具
│   ├── theme.js       # 主题管理工具
│   ├── jwt.js         # JWT 工具（智谱AI鉴权）
│   └── index.js       # 工具函数入口
├── debug/             # 调试工具
│   └── qa.js          # QA 日志工具
└── helpers/           # 业务辅助工具
    ├── clearChatData.js  # 清除聊天数据工具
    └── useNavbar.js      # 导航栏工具
```

---

## 📋 文件说明

### 🔧 核心工具 (core/)

**基础工具函数，提供通用的功能支持**

- **date.js** - 日期时间格式化、问候语等功能
- **system.js** - 系统信息获取（状态栏高度、设备信息等）
- **theme.js** - 主题管理（深色模式、护眼模式等）
- **jwt.js** - JWT 生成工具（用于智谱AI API鉴权）
- **index.js** - 工具函数统一导出入口

### 🐛 调试工具 (debug/)

**开发调试相关工具，主要用于日志收集和问题排查**

- **qa.js** - QA 测试日志工具（拦截网络请求、setData等）

**注意**：Console 日志复制工具已移除，请使用 Raycast 或其他外部工具复制日志

### 🛠️ 业务辅助工具 (helpers/)

**业务相关的辅助函数**

- **clearChatData.js** - 清除聊天数据工具
- **useNavbar.js** - 导航栏工具（高度计算、样式管理等）

---

## 🔍 快速查找

### 需要日期格式化？
→ `core/date.js`

### 需要系统信息？
→ `core/system.js`

### 需要主题管理？
→ `core/theme.js`

### 需要复制 Console 日志？
→ 使用 Raycast 或其他外部工具（推荐使用 Raycast）

### 需要清除聊天数据？
→ `helpers/clearChatData.js`

---

## 📝 更新说明

所有工具函数已从 `utils/` 根目录移动到对应的子目录，便于管理和查找。

**注意**：如果代码中有直接引用这些文件，需要更新导入路径：
- `@/utils/date.js` → `@/utils/core/date.js`
- `@/utils/qa.js` → `@/utils/debug/qa.js`
- 等等...
