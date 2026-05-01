# 发布就绪清单

> 更新日期：2026-04-30
> 状态：本地构建、测试、腾讯云 H5 部署、Nginx reload、微信构建产物、微信待提审版本上传、Laf Free LLM Provider 号池云函数更新、腾讯云远端备份恢复、轻量 health 监控、严格云端 smoke、百度 `/EXAM-MASTER` 资源扫描、增量清洗队列、答案候选修复与 support 证据隔离已收口；题库全量清洗发布和微信发布态真机验收仍未达到正式公开发布标准

## 当前结论

离“可公开上线发布使用”还剩 **2 个任务**。当前产物已经上传微信待提审版本，可进入人工提审准备和小范围体验验证；但不建议按“公开可商用发布”口径放量。

- **P0 阻断任务：2 个**。不完成不建议正式公开发布。
- **P1 发布前任务：0 个**。百度资源入口已从“待提供分享链接”改为“已可由当前 OAuth token 直接扫描 `/EXAM-MASTER`”。
- **P2 增强任务：0 个**。小程序端知识地图已切换为发布级 2D/2.5D 版本，完整 3D 留给 H5/App 后续承载。

## 已通过门禁

| 门禁 | 当前结果 |
| --- | --- |
| 全量单测 | `84 files / 1016 tests passed` |
| ESLint | 0 error / 0 warning |
| Prettier | all matched files pass |
| H5 构建 | passed；PWA manifest 图标复制到 `dist/build/h5/static/pwa-icons/`，浏览器请求返回 200 |
| 微信小程序构建 + 主包引用审计 | passed |
| Laf 函数源码 strict 审计 | passed |
| tracked secret 扫描 | passed |
| 分包副本同步 | passed |
| 百度 Source Manifest 自检 | passed |
| 公开题库答案证据保护 | 未匹配 SourceEvidence 的静态题库均进入清洗队列，不再进入可加载题库 |
| 知识地图 Lite | 刷题中心 `knowledge_graph` 模式已改为移动端 2D/2.5D 学习地图，展示“公共课轨道 → 模块 → 专题 → 掌握状态”；H5 同构页面桌面与 375px 移动视口均无横向溢出 |
| 生产依赖审计 | `npm audit --omit=dev` 0 vulnerabilities |
| Vite 6.4.2 构建回归 | H5 与微信小程序 CLI 构建均 passed；`npm ci --dry-run --ignore-scripts` passed |
| 公开云端 smoke（严格） | `npm run test:cloud:smoke:release -- --env-file data/smoke-token.env --output data/cloud-smoke-release.json` 为 `12 passed / 0 failed / 0 skipped`；公开 health、首页数据、题库 random/getByIds、无效 token 保护和认证态用户端点全部通过 |
| Laf 云函数部署 | 新 Laf PAT 登录成功，`_shared/ai-providers/provider-factory`、`provider-health`、`smart-study-engine` 已通过 `laf func push` 推送；`AbortSignal.timeout` 运行时兼容已补齐，OpenAI-compatible `choices=null` 响应现在会报错并触发降级；`2026-04-30 17:04 MDT` 推送后严格云端 smoke 仍为 `12 passed / 0 failed / 0 skipped` |
| Provider 健康检查 | `provider-health` 管理鉴权返回 200；`summary: total=1, ok=1, warning=0, error=0`；SiliconFlow 官方余额 0 元 key 已通过 `AI_PROVIDER_DISABLED_LIST=siliconflow_official` 与 `AI_PROVIDER_DISABLED_KEYS` 摘出自动池，余额检查按“已禁用”跳过 |
| H5 PWA 控制台洁净度 | 已补充标准 `mobile-web-app-capable` meta；浏览器复测 0 error / 0 warning |
| 腾讯云 H5 部署 | `bash deploy/tencent/scripts/deploy-h5.sh` 已重新构建并同步 `dist/build/h5` 到 `101.43.41.96:/opt/apps/exam-master/h5`；修复 Nginx `exam_api` 未定义限流 zone，改用全局 `global_api`；`nginx -t && systemctl reload nginx` passed；`http://101.43.41.96:8080/` 与 `/health` 均返回 200 |
| 线上 H5 浏览器冒烟 | Playwright 打开 `http://101.43.41.96:8080/` 自动跳转到 onboarding；页面标题 `开始使用`；console 0 error / 0 warning |
| 刷题中心发布保护态 | 未发布任何官方真题时，页面展示“题库校验中 / 官方真题题库暂未公开”，保留公共课导航、知识地图和清洗队列，不暴露无证据题库 |
| 微信开发者工具导入/预览/上传 | `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 已登录并成功打开 `dist/build/mp-weixin`；DevTools 问题计数 0；预览码刷新成功，保存在 `output/wechat-preview/preview-20260430T213408Z.png`；微信待提审版本 `2.2.0` 已上传，上传信息归档在 `output/wechat-upload/upload-info-retry.json` |
| 腾讯云远端发布产物备份恢复 | 本地 `backups/release-drill-20260430T200006Z/` 与远端 `/opt/apps/exam-master/release-ops/backups/release-drill-20260430T200006Z/` 已完成 `mp-weixin` 产物、预览码、审计报告、网盘候选覆盖报告和 Source Manifest 报告归档；远端 `sha256sum -c` 与恢复目录校验通过 |
| 腾讯云轻量 health 监控 | `exam-master-health.timer` 已启用，每 5 分钟 POST `https://nf98ia8qnt.sealosbja.site/health-check`；`2026-04-30T18:56:14Z` health 返回 `{"code":0,"status":"ok"}`，测试告警写入 `/opt/apps/exam-master/release-ops/logs/alerts.log` 与 journald |
| 百度 `/EXAM-MASTER` 真实扫描 | 当前 OAuth token 可直接读取普通网盘目录 `/EXAM-MASTER`，不需要额外分享链接；`data/source-manifest.json` 已合并 `/EXAM-MASTER/考研历年真题/01.考研政治`、`02.考研英语`、`03.考研数学`：扫描 2441 个文件，1617 个 eligible，1608 个外部门禁有效同步证据 |
| 公共课网盘候选覆盖 | `data/public-course-netdisk-candidate-coverage.json` 显示政治、英一、英二、数一、数二、数三在 2010-2026 均有候选文件；多数年份存在答案/解析命名证据。该报告只证明“原始资源足够覆盖”，不等于可直接公开发布题库 |
| 百度增量清洗队列 | `npm run baidu:cleaning:queue` 已生成 `data/cleaning-queue.json`：当前 `download_and_extract:completed=5`、`download_and_extract:failed=3`、`download_and_extract:pending=422`、`manual_review:pending=1178`；后续每日扫描只会把新增或 fingerprint 变化的文件重新置为 pending |
| 清洗执行器 | `scripts/baidu/run_cleaning_queue.py` 已能小批量消费 `download_and_extract` 任务，并安全加载 `.env` / `laf-backend/.env` 中的多 provider 号池；系统 `python3` 缺少 Baidu 依赖时会自动切到 `.venv-baidu/bin/python`；未知轨道/答案解析/support 类任务已改为 `*-support-<sourceId>` 隔离输出，避免覆盖正式题面文件；`pdf2flashcard-v2.py` 已防止“解析到题但去重后 0 新增”覆盖已有清洗产物；本轮真实跑通英语 2000、英语一 2001、英语一 2010 题面和对应答案解析/答案速查 support 文件 |
| 清洗产物答案修复 | 新增 `npm run baidu:flashcards:repair:answers`，可按年份 + 题号从答案/解析 companion JSON 或 `21-25 BADAB` 类答案速查表补缺失答案，并把 companion 标记为 `supportingEvidenceOnly`；已修复英语 2000 的 10 个缺答案、英语一 2001 的 11 个缺答案、英语一 2010 的 10 个缺答案，并把 2010 第 41 题占位答案替换为 `BFDGA`，全部保持 `answerEvidenceStatus=candidate_matched`，未伪装成可发布 `matched` |
| 清洗产物质量门禁 | `npm run baidu:flashcards:quality` / `npm run baidu:flashcards:quality:release` 已接入 `release:gate:report` / `release:gate`；当前 `canPromoteToPublic=false`、晋级候选 `files=3`、`cards=117`、`missingAnswers=0`、`sourceEvidenceBlockers=117`、`gradingBlockers=0`，另有 4 个 support 证据文件被隔离跳过 |
| 线上题库基础种子 | 已通过 `question-bank?action=seed_preset` 管理员路径导入 15 道政治/英语/数学基础题，线上 `question-bank random` 与 `getByIds` 严格 smoke 均通过；这只解决线上刷题链路可用性，不等同于历年真题全量发布 |
| 官方考试大纲证据 | 已从中国教育考试网下载并登记 5 条 `official_syllabus` Source Manifest 记录：政治 2022、英语二 2022、数学一/二/三 2022；用于知识框架证据，不计入历年真题 `official_paper` 覆盖 |
| 研招网官方门户题源证据 | 已归档研招网“中国研究生招生信息网”来源的政治 2010-2013 页面：2013 题目与参考答案解析同源，计为 1 条 `publishable official_paper`；2010-2012 只登记为 `official_question_paper`，因答案解析链接来源为机构，不计入可发布 official paper |
| 生产配置本地门禁 | `REQUEST_SIGN_SALT` 已本地轮换到 64 字符；`npm run audit:release:external:report` 中 `productionConfig=passed` |
| 题源证据工具 | 新增 `npm run baidu:sources:verified` 与 `npm run baidu:sources:merge`，只有 verified/published、带 provenance、带文件 hash、`answerEvidenceStatus=matched` 的官方卷才计入覆盖 |
| 认证 smoke 令牌工具 | 新增 `npm run smoke:jwt -- --user-id <existing-smoke-user-id> --output data/smoke-token.env`，用于生成严格 cloud smoke 可用的短期 JWT；当前发布 smoke token 已绑定真实线上用户，认证态资料、收藏、统计端点均已通过严格 smoke |
| 外部证据门禁收紧 | 微信真机、备份恢复、监控告警证据不再只认 `Status: passed`，必须填完各自必填字段 |
| 百度分享链接策略 | 分享链接只用于当前 OAuth token 读不到的外部账号/群资源；当前公共课资源已在 `/EXAM-MASTER` 可见，因此不需要用户再提供百度分享链接 |
| 免费/低价 AI 清洗策略 | 已支持 OpenAI-compatible 单入口和多 provider 降级：`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` 可作为 primary，同时自动读取 NVIDIA/Groq/Gemini/Cerebras/OpenRouter/Mistral/HF/GPT_API_free/SiliconFlow DS/Vercel 等 env；当前队列生成和风险分类由本仓库脚本完成，AI 只在结构化抽取、低置信知识点挂接、答案冲突复核时按需调用 |
| Free LLM API 号池 | `provider-factory.ts` 已补齐 `iflow`、NVIDIA/Groq/Gemini/Cerebras/OpenRouter/Mistral/GitHub Models/HF/GPT_API_free/SiliconFlow DS/Vercel AI Gateway 降级池；真实 key 只通过后端环境变量配置；心流当前功能 smoke 返回 `status=435, msg=Model not support`，本地清洗先用 `LLM_DISABLED_PROVIDERS=llm_primary,iflow` 走 NVIDIA 等免费降级；低余额 SiliconFlow 官方 key 已用禁用名单摘除 |

## 已落地但当前阻断的发布门禁

| 门禁 | 当前结果 | 说明 |
| --- | --- | --- |
| 题库发布门禁 | `canPublish=false; coverageGaps=98; sourceEvidenceGaps=101; answerEvidenceBlockers=0; gradingBlockers=0` | `npm run audit:question-bank:report` 已能按 2010-2026 正式范围生成机器报告，并显式读取 `data/source-manifest.json` 作为真实题源证据；当前有 2453 条 Source Manifest 记录、1617 条 eligible、1 条 publishable official paper。网盘候选资源足够，且已有 `1608` 条增量清洗任务；本轮已把英语 2000 与英语一 2001 的清洗样本缺答案修为 0，但仍停留在 `candidate_*` 证据状态，未完成 SourceEvidence 原文切片/答案证据 `matched` 校验，不能进入公开发布题库 |
| 外部发布门禁 | `canPublish=false; blockers=1` | `npm run audit:release:external:report -- --env-file data/smoke-token.env --output data/release-external-audit-with-smoke-token.json` 已消除 credentials、opsEvidence、百度同步、Laf 部署 blockers；百度同步当前 `sourceManifestSourceCount=2453`、`sourceManifestValidSourceCount=1608`；剩余 blocker 仅为微信发布态真机证据 |

## 剩余任务

| 优先级 | 任务 | 当前证据 | 完成标准 |
| --- | --- | --- | --- |
| P0 | 公共课历年真题清洗发布 | 网盘候选覆盖已达成：6 条公共课轨道在 2010-2026 均有候选文件；题库发布门禁仍显示 `coverageGaps=98`、`sourceEvidenceGaps=101`，因为候选文件尚未转换成 verified/published、hash 完整、`answerEvidenceStatus=matched` 的可发布题库；线上已临时导入 15 道基础种子题用于刷题链路验收 | `buildPublicCourseCoverage()` 对 6 条公共课轨道返回完整或明确可解释的灰度范围，且 Source Manifest 有可追溯官方真题题源；静态/服务端题库只公开已完成答案证据匹配的题目 |
| P0 | 微信发布态真机验收 | DevTools 本地导入已通过、问题计数 0、预览码已生成；微信待提审版本 `2.2.0` 已上传；最终验收必须在上传后的体验版或审核通过后的发布版完成 | 真实微信发布态完成冒烟，截图/版本号/体验版或线上版本证据归档 |

## 下一步执行顺序

1. 你在微信后台把已上传的 `2.2.0` 设置为体验版/提交审核后，用真机完成发布态冒烟，并把截图/版本号/设备信息写入 `docs/release/wechat-device-smoke.md`。
2. 继续消费 `data/cleaning-queue.json` 中的 `download_and_extract` 样本：抽取题面/答案、生成 Source Evidence hash，未完成答案证据匹配的题库继续保持不可公开加载。
3. 完成以上外部证据后，再考虑 WebGL 版知识图谱、更多增长体验和机构资料年度覆盖。
