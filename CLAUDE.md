# CLAUDE.md - 项目核心真理文件

> **Project Guardian**: 本文件是项目的唯一真理来源。任何 AI（Claude, Cursor, Roo Code 等）在接手项目前必须先阅读此文件。

## 1. Project Context（项目核心）
- **身份定义**：Exam-Master 智能刷题小程序。
- **技术栈**：UniApp (Vue3) + Laf Cloud (AppID: `nf98ia8qnt`)。
- **总监模式**：用户不写代码。AI 负责所有代码编写、终端命令、Git 管理。**禁止 AI 要求用户手动修改代码。**

## 2. Trauma Registry（伤痛注册表 - 关键！）

### 历史修复复盘
1. **`process.env` 未定义错误** (2026-01)
   - **根本原因**：前端代码直接使用了 Node.js 的 `process.env` 环境变量，而微信小程序环境不支持。
   - **修复方案**：
     - `common/config.js`: 移除 `process.env`，直接硬编码 `appId`。
     - `uniCloud-aliyun/cloudfunctions/user-center/index.obj.js`: 仅在云函数中使用环境变量。
   - **红色警戒**：**前端代码（`src/` 下非云函数文件）严禁使用 `process.env`。**

2. **AI 诊断报告 JSON 解析错误**
   - **根本原因**：`drawReport` 方法尝试解析非 JSON 格式的 AI 返回文本。
   - **修复方案**：`pages/mistake/index.vue` 中 `prepareReport` 方法增加了对 AI 返回内容的校验和处理。

3. **文件管理数据不显示**
   - **根本原因**：数据读取方式不一致（`uni.setStorageSync` vs `storageService.get`）。
   - **修复方案**：`src/pages/practice/index.vue` 的 `refreshBankStatus()` 方法修改为同时支持两种读取方式。

### 红色警戒（绝对禁止触碰）
- **前端环境变量**：严禁在 `src/` 目录下的前端代码中使用 `process.env`。AppID 需硬编码，Secret 严禁出现在前端。
- **Laf 调用**：严禁使用 `uniCloud` API 调用后端，必须使用 `laf-client-sdk` 或项目封装的 `lafService.js`。
- **云函数同步**：云函数修改必须在本地 `/functions/` (或当前 `uniCloud-aliyun/cloudfunctions/`) 进行，禁止仅在网页端修改。

## 3. Current Roadmap（战况看板）
- [x] 功能 Mock 逻辑 (40%)
- [ ] 全局 UI 视觉重构 (Next Priority)
- [ ] Laf 云函数开发与数据库对接 (Next Priority)

## 4. Operational & Disaster Recovery（操作与灾难恢复）
- **启动命令**：`npm run dev:mp-weixin`
- **Laf 规范**：严禁使用 `uniCloud` API，必须使用 `laf-client-sdk`。
- **灾难恢复预案**：
    - **备份目录**：`/backup/` (已创建)。
    - **Schema 备份**：每次修改数据库结构前，必须先将 Schema 描述写入 `/backup/db_schema_latest.json`。
    - **云函数同步**：云函数必须同步在本地，严禁只在网页端修改。

## 5. Universal Wake-up Protocol（通用唤醒协议）
- **新 AI 接入第一步**：无论是在 IDE 还是网页端，AI 必须先读取本文件。
- **用户唤醒口令**：“先读 CLAUDE.md，复述第 2 节的修复逻辑。”
- **AI 响应模板**：“记忆已同步。我已知晓 Cursor 曾通过 [具体手段] 修复了编译问题。当前进度 40%，请下达指令。”
