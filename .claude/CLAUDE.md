# Exam-Master 补充规范

> 此文件仅包含根目录 CLAUDE.md 未覆盖的补充信息

## 目录结构速查

```
src/
├── pages/              # 页面（chat/practice/school/social 等）
├── components/         # 组件（base/business）
├── composables/        # 组合式函数
├── services/           # 服务层（lafService/storageService/auth-storage）
├── stores/modules/     # Pinia 状态管理（user/study/school 等）
├── utils/              # 工具函数
├── config/index.js     # 应用配置（VITE_* 环境变量）
└── styles/             # 全局样式/设计令牌
laf-backend/
├── functions/          # 46个云函数入口（proxy-ai/login/question-bank 等）
│   └── _shared/        # 共享模块
└── database-schema/    # 数据库 Schema
tests/                  # 测试用例
deploy/                 # 部署配置
```

## 编码规范补充

- 前端使用 Vue 3 Composition API + `<script setup>`
- Pinia Store 用 `defineStore('name', () => {...})` 组合式风格
- 路径别名 `@` → `src/`
- 前端无 TypeScript，用 JSDoc 类型注释；后端用 TypeScript
- 使用 `@/utils/logger.js` 统一日志（生产环境自动禁用）
