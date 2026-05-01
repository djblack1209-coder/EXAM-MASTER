# 题库资源采集与知识神经架构方案

> 状态：核心功能方案
> 更新日期：2026-04-30
> 优先级：最高
> 目标：围绕百度网盘 EXAM-MASTER 资源库，建立可增量同步、可清洗、可验证、可导航、可视化的公共课题库与知识神经系统

## 一、结论

本阶段采用“百度网盘 `/EXAM-MASTER` 全路径日扫 + 应用目录补充 + 分享链接/群组增强”的资源采集策略。群组 Source Manifest 是可选发现入口，不能串联成题库发布的必要前置条件；题库覆盖率、质量门禁和知识图谱建设必须继续依赖统一的 Source Manifest 层推进。

当前已落地的主链路是 `scripts/baidu/incremental_sync.py` 直接扫描当前 OAuth token 可见的 `/EXAM-MASTER/考研历年真题` 目录，生成 `data/source-manifest.json`；`scripts/baidu/cleaning_queue.py` 再把新增/变更文件转换为可执行清洗任务。分享链接模式仍由 `scripts/baidu/group_sync.py` 承担：管理员维护本地 `data/link-registry.json`，脚本自动解析分享链接、递归展开分享文件夹、过滤文档资源、转存到 `/apps/考研大师/raw-pdf/`，再产出 `data/group-export-latest.json` 交给 `incremental_sync.py --group-export` 合并。Cookie/BDUSS 内部 API 不进入生产主链路；官方群组服务在完成实名认证、商务开通特殊权益后，可作为另一个 collector 接入同一 manifest。

核心产品资产不是 16T 原始资料，而是：

- 去广告、去机构/老师名、去水印后的题目与答案。
- 可追溯的来源证据：文件、页码、题号、原文 hash、答案证据。
- 公共课知识神经图谱。
- 用户在知识图谱上的掌握状态。

## 二、目标范围

### 2.1 必须达标

| 目标                   | 达标标准                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| 公共课历年真题覆盖     | 政治、英语一、英语二、数学一、数学二、数学三均有年份清单、处理状态、缺失原因、证据完整度 |
| 本年度机构资料尽量覆盖 | 进入候选池并完成去品牌、去广告、去重、版权状态标记；默认不以机构资料名公开展示           |
| 网盘/群组资源增量自动化 | 支持每天定时发现新增/更新文件，生成 Source Manifest，并触发增量清洗队列                  |
| 知识神经架构           | 后端具备精细知识节点、边、题目映射、用户掌握状态；前端具备可视化入口                     |
| 刷题体验提升           | 多级导航、限时训练、速度评分、FSRS 复习、ELO/IRT 难度匹配、强反馈                        |

### 2.2 明确不做

- 不在小程序端持有百度网盘 access token、Cookie、BDUSS、API Key。
- 不直接公开机构名、老师名、广告词、群信息、二维码、水印。
- 不把未经答案证据校验的 AI 解析题发布给用户。
- 不把 16T 原始资料完整复制到项目仓库或小程序包。

## 三、总体架构

```text
资源采集层
  ├─ 百度网盘 /EXAM-MASTER 全路径日扫
  ├─ 百度网盘应用目录扫描
  ├─ 群组/分享链接增量采集器
  └─ 手动投递目录
          ↓
Source Manifest 源清单
  ├─ 文件身份: fs_id/path/size/mtime/hash
  ├─ 来源类型: official_paper / institution_candidate / ad / unknown
  ├─ 处理状态: discovered/downloaded/extracted/verified/published/rejected
  └─ 风险标签: copyright_risk / brand_leak / answer_missing / duplicate
          ↓
内容处理管线
  ├─ Cleaning Queue 增量任务
  ├─ 文件过滤与去广告
  ├─ PDF 文本层提取
  ├─ Apple OCR 兜底
  ├─ 版面/题号/答案证据抽取
  ├─ 低成本 AI 结构化解析
  ├─ 规则校验与人工复核队列
  └─ 题目去重与知识点挂接
          ↓
题库与知识神经后端
  ├─ Question
  ├─ AnswerEvidence
  ├─ SourceEvidence
  ├─ KnowledgeNode
  ├─ KnowledgeEdge
  ├─ QuestionKnowledgeEdge
  └─ UserKnowledgeState
          ↓
前端体验
  ├─ 小程序多级题库导航
  ├─ 小程序知识地图 Lite
  ├─ H5/App 3D 知识神经图
  └─ 限时刷题/复习/智能组题
```

## 四、资源采集方案

### 4.1 四种采集源

| 采集源               | 用途                 | 实现方式                                                       | 风险                           |
| -------------------- | -------------------- | -------------------------------------------------------------- | ------------------------------ |
| 百度网盘全路径目录     | 稳定主链路           | 官方 OAuth + `/EXAM-MASTER` 全路径扫描，默认每天定时运行          | 需要管理员授权和 access token 可见目标目录 |
| 百度网盘应用目录       | 补充投递链路         | 官方 OAuth + `/apps/考研大师/` 应用目录扫描                       | 适合小批量转存/人工投递 |
| 分享链接同步器       | 当前群组增强链路     | `data/link-registry.json` 注册永久分享链接，脚本解析、过滤、转存 | 需要管理员维护链接和提取码     |
| 百度网盘官方群组服务 | 未来最优群组链路     | 特权服务开通后读取群组列表、文件库、分享文件列表、批量转存状态 | 需要实名认证和商务开通         |
| 浏览器/人工导出      | 最后兜底             | 浏览器导出的群文件 JSON 或手动投递目录进入 manifest             | 人工成本高，稳定性取决于页面   |

推荐优先级：`/EXAM-MASTER` 全路径日扫 > 应用目录补充 > 分享链接同步器 > 官方群组服务未来接入 > 浏览器/人工导出兜底。

### 4.2 群组文件增量自动化

群组自动化不直接进入题库，先进入 `source_manifest`。本仓库落地脚本：

- `scripts/baidu/group_sync.py`：当前生产可用的分享链接同步器，支持 `--dry-run`、`--link-id`、递归分享文件夹展开、增量去重和 `group-export` 生成。
- `scripts/baidu/source_manifest.py`：把百度应用目录、官方群组服务、浏览器导出的文件清单统一标准化为 Source Manifest。
- `scripts/baidu/incremental_sync.py`：扫描 `/apps/考研大师/raw-pdf/` 或绝对网盘路径如 `/EXAM-MASTER/考研历年真题/01.考研政治`；支持多个 `--scan-dir` 一次合并，避免分批扫描时把其他目录误标为 missing；可合并 `--group-export` 导出的群文件清单，并生成增量处理计划。
- `scripts/baidu/cleaning_queue.py`：读取 Source Manifest，保留已完成任务状态，只对新增或 fingerprint 变化的文件重新置为 `pending`；输出 `data/cleaning-queue.json`，区分 `download_and_extract`、`manual_review`、`transfer_or_direct_download` 等动作。
- `scripts/baidu/run_cleaning_queue.py`：小批量消费 `download_and_extract` 任务，下载文件到 `raw-inbox`，再调用 `scripts/pipeline/pdf2flashcard-v2.py`；没有配置 `LLM_API_KEY`/`OPENAI_API_KEY` 时不执行真实清洗，避免定时任务无预算失控；未知轨道/答案解析类文件使用 `*-support-<sourceId>` 隔离输出，避免覆盖正式题面文件。
- `scripts/baidu/answer_evidence_repair.py`：按年份 + 题号从 companion 答案/解析清洗产物补缺失答案，生成 `data/answer-evidence-repair*.json` 报告，并把 companion 标记为 `supportingEvidenceOnly`；补出的答案只标记为 `candidate_matched`，不能直接公开发布。
- `scripts/baidu/manifest_quality.py`：输出公共课年份覆盖缺口、风险文件统计和下一步处理队列，作为题库发布门禁。
- `scripts/baidu/public_course_candidate_coverage.py`：输出 `data/public-course-netdisk-candidate-coverage.json`，用于区分“网盘原始候选资源是否覆盖”和“是否已达到可发布题库证据标准”。
- `scripts/baidu/pan.py`：递归文件列表已补充分页能力，避免目录超过 1000 条时漏扫。

1. 管理员将可靠的群组资源整理为永久分享链接，写入本地 `data/link-registry.json`。
2. 定时任务运行 `npm run baidu:group:registry:check` 和 `npm run baidu:group:sync`；干跑验证用 `npm run baidu:group:sync:dry`。
3. 脚本读取分享链接，自动验证提取码、递归展开分享文件夹，并对候选文件生成指纹。
4. 与 `data/transferred-links.json` 比对，只处理未转存过的 `fs_id`。
5. 对候选文件进行规则过滤：
   - 保留：`.pdf`、`.doc`、`.docx`、`.txt`、`.md`、`.json`。
   - 降级：`.ppt`、`.pptx` 仅当含真题/讲义关键词时处理。
   - 跳过：视频、音频、压缩包、二维码、广告、课程宣传图。
6. 命中文档资源后转存到 `/apps/考研大师/raw-pdf/<subject>/<year>/`，生成 `data/group-export-latest.json` 和 `data/group-sync-report.json`。单个链接失效只记录为 failed，不阻断后续链接。
7. 调用 `incremental_sync.py --group-export data/group-export-latest.json` 合并进入 Source Manifest。若未配置分享链接，主链路仍可通过 `/apps/考研大师/raw-pdf/` 或当前 token 可见的 `/EXAM-MASTER` 全路径扫描继续推进。
8. 调用 `scripts/baidu/cleaning_queue.py` 生成增量清洗任务。后续每日扫描时，sourceId + fingerprint + action 不变的任务保留原状态；PDF 文件大小、mtime、hash 或路径身份变化时自动回到 `pending`。
9. 处理完成后：
   - 原始大文件可删除或移入冷备目录。
   - 保留题目 JSON、OCR 文本切片、来源证据、处理报告。

### 4.3 不撑爆 16T 的策略

- 不镜像整个群组，只拉取命中规则的文档类文件。
- 原始文件进入 `raw-inbox` 后设置生命周期：处理成功且证据切片完整时可删除。
- 对同名同大小同 hash 文件去重。
- 对机构资料只保留清洗后的结构化题目和必要证据片段，不保留全量讲义。

### 4.4 低成本/免费 AI 策略

当前不是把资源“外包给某个昂贵 AI 一次性清洗”。已落地部分由本仓库脚本完成：网盘扫描、文件分类、风险标记、增量队列、发布门禁。AI 只在 PDF/OCR 文本抽取后的结构化、低置信度知识点挂接、答案冲突复核中按需调用。

| 步骤               | 默认方式               | AI 介入                    |
| ------------------ | ---------------------- | -------------------------- |
| 文本提取           | PDF 文本层 + Apple OCR | 不用 AI                    |
| 广告/品牌清洗      | 黑名单 + 正则 + 相似度 | 不用 AI                    |
| 题号/选项/答案定位 | 规则优先               | 失败片段才调用 AI          |
| 题目结构化         | 模板/规则优先          | 按页块批处理调用免费 token |
| 知识点挂接         | 规则 + 课程大纲词典    | 低置信度才调用 AI          |
| 质量复核           | 自动校验               | 只对冲突/缺失答案调用 AI   |

本仓库 `scripts/pipeline/pdf2flashcard-v2.py` 已按“文本层优先、OCR 兜底、AI 最后介入”优化，并支持 OpenAI-compatible 运行时。可使用免费或低价模型：既可填入 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` 作为 primary，也可通过 `GROQ_API_KEY`、`GEMINI_API_KEY`、`NVIDIA_API_KEY`、`OPENROUTER_API_KEY`、`CEREBRAS_API_KEY`、`MISTRAL_API_KEY`、`SILICONFLOW_DS_KEY_1..10` 等 provider env 让清洗脚本自动降级。不得把密钥写入仓库、队列文件或小程序端。所有 AI 调用必须启用：

- 内容 hash 缓存：同一片段不重复调用。
- 日额度：按 token 和请求数双限制。
- 失败降级：进入人工复核队列，不阻塞其他文件。
- 批处理：按题组或页块合并，不逐题调用。

截至 2026-04-30，心流/iFlow 当前 key 对配置模型返回 `Model not support`，清洗任务先通过 `LLM_DISABLED_PROVIDERS=llm_primary,iflow` 摘除；NVIDIA 后端已完成英语 2000、英语一 2001 题面与答案解析 support 文件的真实抽取样本。抽取完成但缺答案的任务必须标记 `answerEvidenceStatus=missing_answers`，通过 companion 修复后也只能进入 `candidate_matched`，直到原文切片和答案来源校验完成。

## 五、题库数据模型

### 5.1 Source Manifest

```json
{
  "sourceId": "sha256:path-size-mtime",
  "sourceType": "official_paper",
  "provider": "baidu_pan",
  "remotePath": "/apps/考研大师/raw-pdf/英语一/2010.pdf",
  "fileName": "2010英语一真题.pdf",
  "size": 12345678,
  "mtime": 1710000000,
  "contentHash": "sha256...",
  "subject": "english",
  "track": "english1",
  "year": 2010,
  "status": "verified",
  "riskFlags": [],
  "processedAt": "2026-04-28T00:00:00Z"
}
```

### 5.2 Question

```json
{
  "questionId": "q_eng1_2010_reading_01",
  "subject": "english",
  "track": "english1",
  "year": 2010,
  "paperType": "past_exam",
  "section": "reading",
  "number": "21",
  "type": "single_choice",
  "stem": "题干",
  "options": [{ "label": "A", "text": "选项" }],
  "answer": "A",
  "explanation": "解析",
  "difficulty": 0.52,
  "publishStatus": "published",
  "sourceEvidenceId": "src_ev_..."
}
```

### 5.3 SourceEvidence

```json
{
  "evidenceId": "src_ev_...",
  "questionId": "q_eng1_2010_reading_01",
  "sourceId": "sha256:path-size-mtime",
  "pageStart": 8,
  "pageEnd": 9,
  "questionTextHash": "sha256...",
  "answerTextHash": "sha256...",
  "ocrConfidence": 0.96,
  "answerEvidenceStatus": "matched",
  "rawTextSlicePath": "evidence/eng1/2010/21.txt"
}
```

没有 `answerEvidenceStatus=matched` 的题不得进入公开题库。

## 六、多级导航方案

### 6.1 导航结构

```text
一级：考研政治 / 考研英语 / 考研数学
二级：
  政治：历年真题 / 专题训练 / 形势与政策 / 智能组题
  英语：英语一历年真题 / 英语二历年真题 / 阅读 / 完形 / 翻译 / 写作 / 智能组题
  数学：数学一 / 数学二 / 数学三 / 高数 / 线代 / 概率 / 智能组题
三级：年份 / 模块 / 题型 / 知识点 / 难度
四级：题组 / 单题 / 错题强化 / 限时回合
```

### 6.2 UI 优化方向

小程序端不做传统长列表。采用玻璃卡片和横向分段：

- 顶部：考试组合卡，显示当前用户公共课组合。
- 中部：科目大卡，按学习状态着色。
- 下钻：年份轴 + 模块芯片 + 题型筛选。
- 底部：开始按钮、限时模式、弱点强化。

导航必须支持“回到上次刷题位置”和“从知识图谱节点进入题组”。

本仓库已新增轻量导航模型：

- `src/config/bank-registry.js`：`getPracticeNavigationTree(profile)` 输出“科目 → 公共课轨道 → 题库/训练模式”。
- `src/config/knowledge-graph.js`：`buildKnowledgeGraph(profile)` 按用户公共课组合裁剪小程序端知识图谱。

## 七、公共课分配方案

### 7.1 推荐机制

采用“自动建议 + 用户确认 + 后续可改”：

1. 用户选择目标院校、专业、年份。
2. 后端从研招网/招生目录缓存中提取考试科目文本。
3. 规则解析公共课组合：
   - `101` → 政治。
   - `201` → 英语一。
   - `204` → 英语二。
   - `301` → 数学一。
   - `302` → 数学二。
   - `303` → 数学三。
4. 如果解析置信度高于 0.9，前端默认勾选并提示用户确认。
5. 如果置信度低，要求用户手动选择。

### 7.2 提升点

- 每年招生目录会变化，公共课组合必须带 `year`。
- 同一专业不同院校可能不同，不能只按专业自动分配。
- 用户确认后的组合写入 `user_exam_profile`，用于题库导航、学习计划、知识图谱裁剪。

## 八、知识神经架构

### 8.1 后端节点颗粒度

知识图谱至少五层：

```text
Subject 科目
  └─ Track 细分：英语一/英语二/数一/数二/数三/政治
      └─ Module 模块：阅读/高数/马原等
          └─ Topic 课题：函数极限连续/唯物辩证法/主旨题等
              └─ MicroPoint 微知识点：夹逼准则、矛盾普遍性、态度题转折词等
```

每个节点字段：

```json
{
  "nodeId": "math1_gaoshu_limit_squeeze_theorem",
  "subject": "math",
  "track": ["math1", "math2", "math3"],
  "level": "micro_point",
  "name": "夹逼准则",
  "parentId": "math_gaoshu_limit",
  "examWeight": 0.73,
  "prerequisites": ["math_function_limit_definition"],
  "confusableWith": ["math_equivalent_infinitesimal"],
  "questionCount": 128
}
```

### 8.2 用户状态

```json
{
  "userId": "u_1",
  "nodeId": "math1_gaoshu_limit_squeeze_theorem",
  "attempts": 21,
  "correctRate": 0.91,
  "avgTimeMs": 18000,
  "recentCorrectStreak": 5,
  "fsrsRetrievability": 0.87,
  "abilityTheta": 0.42,
  "masteryLevel": "stable",
  "colorState": "green",
  "lastUpdatedAt": "2026-04-28T00:00:00Z"
}
```

颜色规则：

| 状态     | 条件                                | 颜色 |
| -------- | ----------------------------------- | ---- |
| 未学习   | attempts = 0                        | 灰色 |
| 初次掌握 | correctRate >= 90% 且 attempts 达标 | 白色 |
| 稳定掌握 | 近期同类题持续答对                  | 绿色 |
| 不稳     | 正确但耗时过长或间隔后遗忘          | 黄色 |
| 薄弱     | 近期答错、超时、连续遗忘            | 红色 |

### 8.3 可视化策略

| 平台       | 方案                                                         |
| ---------- | ------------------------------------------------------------ |
| 微信小程序 | 知识地图 Lite：2.5D 分层网络、节点卡片、局部展开、按科目裁剪 |
| H5/App     | 完整 3D 知识神经图：Three.js/WebGL、可旋转、可缩放、节点发光 |
| 后端       | 永远存完整图谱和用户状态，小程序只请求裁剪后的子图           |

小程序不常驻重型 3D。进入知识地图时按需加载，默认展示用户当前薄弱的 30-80 个节点，避免性能和包体风险。

本仓库已新增小程序端轻量种子图谱：

- `src/config/knowledge-graph.js`：公共课 Track、Module、Topic、MicroPoint 节点与视觉状态规则。
- `src/stores/modules/learning-trajectory-store.js`：记录题目答题结果并更新知识节点掌握状态。
- 当前小程序端以 Lite 图谱为主；完整 3D 神经图谱放在 H5/App 或后端可视化服务中承载，避免拖垮微信小程序包体与渲染性能。

## 九、刷题体验推进

### 9.1 模式

| 模式       | 目标                           |
| ---------- | ------------------------------ |
| 年份真题   | 完整还原某年真题，适合套卷训练 |
| 知识点训练 | 从某个知识节点进入题组         |
| 限时冲刺   | 总时间 + 单题时间，强化速度    |
| 肌肉记忆   | 高频易错点短回合，10-20 秒决策 |
| 弱点强化   | 知识图谱红/黄节点自动组题      |
| FSRS 复习  | 按记忆曲线安排复习             |

### 9.2 评分

评分优先级：正确性 > 难度 > 速度 > 连续性。

```text
score = correctnessBase * difficultyMultiplier * speedMultiplier + streakBonus
```

答错不因速度快获得正向奖励。答对但耗时明显超标，应进入“会但不熟”状态。

### 9.3 反馈

- 正确：轻振动、绿色玻璃反馈卡、XP 粒子。
- 错误：短促反馈、展示知识节点定位、推荐 1 个相邻基础节点。
- 超时：不羞辱用户，标记为“反应不稳”，进入速度训练。
- 完成回合：展示知识神经变化，而不是只展示总分。

## 十、实施优先级

### Phase 1：采集清单与安全边界

- 建立 `source_manifest`。
- 增强 `scripts/baidu/incremental_sync.py` 为 `/EXAM-MASTER` 全路径增量扫描。
- 建立 `scripts/baidu/cleaning_queue.py`，把新增/变更文件转为清洗任务。
- 文件过滤、广告识别、重复检测。
- 处理报告输出。

### Phase 2：公共课真题覆盖仪表盘

- 建立英语一/英语二/政治/数学一二三年份覆盖表。
- 标记每年：未发现、待处理、答案缺失、可发布。
- 当前小程序题库从静态 JSON 迁移到服务端索引。

### Phase 3：结构化清洗与证据校验

- PDF/OCR/AI 结构化管线，优先使用免费或低价 OpenAI-compatible 模型。
- 答案证据必须匹配。
- 机构资料只进候选池。

### Phase 4：知识图谱

- 构建公共课知识节点库。
- 题目挂接知识点。
- 用户答题更新 `UserKnowledgeState`。

### Phase 5：前端体验

- 小程序多级导航。
- 知识地图 Lite。
- H5/App 3D 知识神经图。
- 刷题模式和反馈升级。

## 十一、验收

- 全部公共课 track 都能展示覆盖率。
- 每道发布题都有答案证据。
- 机构/老师/广告词扫描为 0。
- 用户能从知识图谱节点进入刷题。
- 答题后知识节点颜色变化可解释、可回溯。
- 小程序端核心路径自动化无异常。

## 十二、2026-04-30 落地状态

### 12.1 题库清洗管线

- `scripts/baidu/source_manifest.py` 已新增 `safeDisplayName`、`canonicalKey`、`legalReview`，对文件名中的机构/老师/广告风险做前置标记，并用安全展示名进入后续队列。
- `scripts/baidu/manifest_quality.py` 已新增 `cleaningPlan` 与 `releaseReadiness`，把公共课覆盖缺口、品牌风险队列、答案证据缺失、发布阻断项集中输出。
- `scripts/baidu/cleaning_queue.py` 已新增可执行增量队列：当前 `data/source-manifest.json` 生成 `1608` 个待处理任务，其中 `430` 个可自动下载抽取，`1178` 个因机构/版权/品牌风险进入人工或规则复核。
- `scripts/baidu/run_cleaning_queue.py` 已新增小批量清洗执行器：`npm run baidu:cleaning:run:dry` 只预览任务，`npm run baidu:cleaning:run` 默认每次只跑 1 个任务，并强制要求外部 LLM 环境变量；未知轨道任务已用 sourceId 隔离输出，防止 support 文件覆盖正式题面。
- `scripts/baidu/answer_evidence_repair.py` 已新增答案候选修复器：`npm run baidu:flashcards:repair:answers -- --target <target.json> --companion <answer.json> --write --mark-companions-supporting` 会修补缺答案、写入 candidate hash，并把 companion 文件从晋级门禁中隔离。
- `scripts/baidu/flashcard_quality.py` 已新增清洗产物质量门禁：`npm run baidu:flashcards:quality` 生成 `data/flashcard-quality-report.json`，`npm run baidu:flashcards:quality:release` 在缺答案、选择题选项异常、`sourceEvidenceId`、`answerEvidenceStatus=matched`、`questionTextHash` 或 `answerTextHash` 缺失时失败。当前英语 2000 与英语一 2001 晋级候选共 80 题，缺答案已修为 0，但仍因 `answerEvidenceStatus` 只到 `candidate_*` 被阻断。
- `.github/workflows/baidu-group-sync.yml` 已扩展为每日百度资源增量同步，未提供分享链接时也会扫描 `/EXAM-MASTER/考研历年真题/01.考研政治`、`02.考研英语`、`03.考研数学`，并上传 Source Manifest、候选覆盖报告和 Cleaning Queue artifacts。
- `scripts/build/question-bank-release-gate.mjs` 已新增静态发布门禁，基于题库注册表和已发布 JSON 题目生成 `data/question-bank-release-audit.json`；`npm run audit:question-bank:release` 会在覆盖缺口或 `answerEvidenceStatus=matched` 缺失时失败。
- `src/config/bank-registry.js` 已将缺少 SourceEvidence/hash 的静态题库全部转入清洗队列，避免未校验题目被用户加载。
- 发布门禁保持不变：没有答案证据、存在品牌/广告泄露风险、来源类型不清晰的文件不得进入公开题库。

### 12.2 速度评分与 ELO 难度匹配

- `src/utils/quiz-elo.js` 已落地速度评分、用户 ELO、题目 ELO、题目排序和本地状态持久化。
- `src/pages/practice-sub/do-quiz.vue` 在用户作答后写入速度分与 ELO 更新结果，并同步到 `learning-trajectory-store`。
- 分析记录不再二次增加 `answeredQuestions`，避免完成进度、正确率和 ELO 统计被重复答题记录污染。

### 12.3 答题后知识点链路跳转

- 答题反馈卡已显示知识定位、掌握状态、速度分和知识链路。
- 点击反馈卡会保存 `practice_focus_knowledge_node`，携带节点、链路、公共课轨道和来源题目，并跳转回刷题中心。
- `src/pages/practice/index.vue` 已接入焦点知识节点卡，支持从该节点直接生成 `smart_review_ids` 并进入节点强化训练。
- 刷题中心 `knowledge_graph` 模式已从实验性 CSS 3D 图谱调整为小程序发布级 2D/2.5D 知识地图，展示当前公共课轨道下的模块、专题、微知识点数量和掌握状态。
- “知识神经”模式已绑定 `scroll-into-view` 地图锚点，H5 点击后知识地图进入首屏；完整 3D 神经图谱保留为 H5/App 后续增强，不进入小程序首发路径。

### 12.4 当前验证

- `npm test`
- `npx vitest run tests/unit/pwa-assets.spec.js tests/unit/practice-knowledge-graph-3d.spec.js`
- `python3 scripts/baidu/source_manifest.py --self-test`
- `python3 scripts/baidu/manifest_quality.py --self-test`
- `npm run audit:question-bank:report -- --min-year=2024 --max-year=2026`
- `npm run audit:secrets:tracked`
- `npm run release:gate:report`
- H5 浏览器复测：PWA 图标请求 200，控制台 0 error / 0 warning；知识地图桌面与 375px 移动视口均无横向溢出。
