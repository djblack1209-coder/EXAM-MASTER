# GVA 教研运营底座规划

## 背景
目前 EXAM-MASTER 后端依赖 Serverless Laf 进行 C 端 API 支持。
为了保障考研题目的严谨性，必须有一套供教研团队操作的管理后台（审核 AI 题目、管理知识图谱）。
基于全局规划“能复用绝不手搓”，我们将引入 `flipped-aurora/gin-vue-admin` 作为 B 端教研底座。

## 执行路径 (Future Phases)
1. **Repository Linkage**：在本项目根目录或同级目录初始化 GVA 后端，配置 MongoDB / MySQL（主业务表同步或中台同步）。
2. **定制化插件**：
   - AI 题库审核工作台：监听 Laf AI 自动生成的错题/推荐题，进行二次人工审核（RBAC 分配教研员）。
   - FSRS 监控大盘：全景展示用户的记忆留存曲线。
3. **隔离部署**：与 C 端的小程序解耦，B 端直接部署至内网或独立的服务器。
