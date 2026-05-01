# Free LLM API 号池与降级策略

> 更新日期：2026-04-30
> 原则：真实 key 只放后端环境变量/服务器密钥；仓库只保存变量名、优先级、限制说明和降级策略。

## 运行策略

- 默认入口：`AI_PREFERRED_PROVIDER=auto`。
- 自动池只加载已经配置 key 的 provider。
- 低余额、过期、触发限流或疑似不可用的 provider/key 不需要改代码，直接写入 `AI_PROVIDER_DISABLED_LIST` 或 `AI_PROVIDER_DISABLED_KEYS`。
- 自动池默认不启用付费兜底；需要临时兜底时设置 `AI_PROVIDER_ALLOW_PAID_FALLBACKS=true`。本地清洗脚本对应使用 `LLM_ALLOW_PAID_FALLBACKS=true`。
- `SILICONFLOW_DS_KEY_1..10` 会展开成独立 entry 轮转；默认模型为 `deepseek-ai/DeepSeek-V3`，禁止使用 `Pro/` 前缀模型。
- 云端状态：`_shared/ai-providers/provider-factory`、`provider-health`、`smart-study-engine` 已于 `2026-04-30 17:04 MDT` 推送到 Laf；`AbortSignal.timeout` 兼容已补齐，OpenAI-compatible `choices=null` 响应会触发错误和降级；推送后严格云端 smoke 为 `12 passed / 0 failed / 0 skipped`。
- 当前无余额摘除：SiliconFlow 官方余额 key 返回 0 元，已通过 `AI_PROVIDER_DISABLED_LIST=siliconflow_official` 与 `AI_PROVIDER_DISABLED_KEYS` 摘出自动池；余额健康检查返回 `ok=1, warning=0, error=0`。
- 当前功能异常摘除：iFlow/心流当前 chat smoke 返回 `status=435, msg=Model not support`；发布前清洗任务先通过 `LLM_DISABLED_PROVIDERS=llm_primary,iflow` 摘除，已验证 NVIDIA 后端可完成 PDF 结构化抽取。

## 当前优先级

| 优先级 | Provider | Env | 默认模型 | 说明 |
|---:|---|---|---|---|
| 10 | iFlow / 心流 | `IFLOW_API_KEY` | `TBStars2-200B-A13B` | 当前 key/model 功能 smoke 为 `Model not support`，先禁用，待控制台确认支持模型后再恢复 |
| 20 | NVIDIA NIM | `NVIDIA_API_KEY` | `meta/llama-3.3-70b-instruct` | OpenAI 兼容入口，免费额度/限流以控制台为准 |
| 30 | Groq | `GROQ_API_KEY` | `llama-3.1-8b-instant` | 免费层按模型限流，吞吐优先 |
| 40 | Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash-lite` | Google AI Studio OpenAI 兼容入口 |
| 50 | Cerebras | `CEREBRAS_API_KEY` | `qwen-3-32b` | 高速结构化清洗备用 |
| 60 | OpenRouter | `OPENROUTER_API_KEY` | `openrouter/free` | 免费模型池会变化，生产可固定模型 |
| 70 | Mistral | `MISTRAL_API_KEY` | `mistral-small-latest` | free/trial 限额较严，放在中后段 |
| 80 | GitHub Models | `GITHUB_MODELS_TOKEN` | `openai/gpt-4.1-mini` | 低速率限制，适合低频兜底 |
| 90 | Hugging Face | `HF_TOKEN` | `Qwen/Qwen2.5-7B-Instruct` | Inference Providers 统一路由 |
| 100 | GPT_API_free | `GPT_API_FREE_KEY` | `gpt-3.5-turbo` | 社区免费接口，200 req/day/IP&key 级别，不承载批量清洗 |
| 110 | SiliconFlow DS 池 | `SILICONFLOW_DS_KEY_1..10` | `deepseek-ai/DeepSeek-V3` | 余额 key 轮转，禁止 Pro 模型 |
| 120 | SiliconFlow 官方 | `SILICONFLOW_OFFICIAL_API_KEY` | `Qwen/Qwen2.5-7B-Instruct` | 官方账户备用，余额低时摘除 |
| 130 | Vercel AI Gateway | `VERCEL_AI_GATEWAY_API_KEY` | `openai/gpt-4o-mini` | 统一网关，按账号额度/限流 |

付费兜底：`volcengine`、`zhipu` 仅在 `AI_PROVIDER_ALLOW_PAID_FALLBACKS=true` 时进入自动池。`manus` 因缺少稳定公开 OpenAI 兼容与限额文档，默认不进自动池。

## 不纳入文本 LLM 清洗池

这些 key/服务不是通用文本 LLM 清洗主链路，或需要专用适配器，暂不进入 `getConfiguredProviderPool()`：

- `fal.ai`、`Kling`：图像/视频生成，不适合题库文本清洗主链路。
- `Deepgram`：语音识别/语音 agent。
- `Mem0`：记忆服务。
- `CloudConvert`：文档转换。
- `SerpApi`、`Brave Search`：搜索服务。
- `Alpaca`：交易 API。
- `GitHub PAT`：仓库自动化，不等同于 GitHub Models token。
- `Cohere`：`/v2/chat` 请求/响应形状不同，不能继续用通用 OpenAI adapter 硬接；后续如需要应实现专用 adapter。

## 本地清洗运行时

`scripts/baidu/run_cleaning_queue.py` 默认安全加载 `.env` 与 `laf-backend/.env`，不再依赖 shell `source`，因此 env 文件里存在不兼容 shell 的行也不会阻断清洗。`scripts/pipeline/pdf2flashcard-v2.py` 会先尝试 `LLM_*` primary，再按免费/低价 provider 池降级，并用内容 hash 缓存避免重复扣量。

当前建议命令：

```bash
LLM_DISABLED_PROVIDERS=llm_primary,iflow AI_PROVIDER_DISABLED_LIST=iflow,siliconflow_official .venv-baidu/bin/python scripts/baidu/run_cleaning_queue.py --limit 1
```

本轮真实结果：英语 2000 与英语一 2001 题面 PDF、对应答案解析 support PDF 已通过 NVIDIA 后端完成结构化抽取；`scripts/baidu/run_cleaning_queue.py` 对未知轨道任务使用 `*-support-<sourceId>` 隔离输出，避免答案解析文件覆盖正式题面文件。

缺答案修复不再直接依赖额外付费模型：`scripts/baidu/answer_evidence_repair.py` 会按年份 + 题号从 companion 答案/解析 JSON 补答案，并把结果标记为 `candidate_matched`。当前英语 2000 的 10 个缺答案、英语一 2001 的 11 个缺答案已补齐；仍需做原文切片和答案来源 `matched` 校验后才能发布。

清洗后必须继续运行：

```bash
npm run baidu:flashcards:quality
```

当前 `data/flashcard-quality-report.json` 显示 `canPromoteToPublic=false`、晋级候选 `cards=80`、`missingAnswers=0`、`sourceEvidenceBlockers=80`；2 个 companion/support 文件已标记 `supportingEvidenceOnly` 并从晋级门禁中跳过。也就是说，AI 抽取和候选答案修复已跑通，但该批数据仍停留在清洗中间态，不能进入公开题库；下一步必须补原文切片、答案来源校验和 `answerEvidenceStatus=matched`。

## 官方/相关文档记录

- 核对结论：不要把任何第三方免费 key 当作“绝对无限”。Groq/Gemini/OpenRouter/Mistral/Cerebras 均存在组织级、模型级或账号级限制；Vercel AI Gateway 官方说明自身不加查询限流，但仍受上游 provider、账号额度和计费策略影响；iFlow 文档确认 OpenAI-compatible `chat/completions` 入口，限额仍以控制台/响应为准。因此生产策略必须保留 `auto` 降级、禁用列表和每日预算阈值。
- iFlow API: `https://platform.iflow.cn/docs/api-reference`
- Groq rate limits: `https://console.groq.com/docs/rate-limits`
- Gemini OpenAI compatibility: `https://ai.google.dev/gemini-api/docs/openai`
- Gemini quota: `https://ai.google.dev/gemini-api/docs/quota`
- OpenRouter limits: `https://openrouter.ai/docs/api-reference/limits`
- Cerebras Inference docs: `https://inference-docs.cerebras.ai/`
- Mistral rate limits: `https://docs.mistral.ai/getting-started/rate-limits/`
- GitHub Models inference API: `https://docs.github.com/en/rest/models/inference`
- Hugging Face chat completion: `https://huggingface.co/docs/inference-providers/tasks/chat-completion`
- NVIDIA NIM API docs: `https://docs.api.nvidia.com/nim/`
- Vercel AI Gateway: `https://vercel.com/docs/ai-gateway`

## GitHub free LLM API 项目补充结论

GitHub 上常见 free-LLM/API 列表主要补充的是聚合网关、GitHub Models、Hugging Face Inference Providers、Vercel AI Gateway、Cloudflare Workers AI、OpenRouter 免费模型和若干非官方中转。

本轮已补齐可直接 OpenAI 兼容接入且适合作为后端清洗兜底的 `github_models`、`huggingface`、`vercel_ai_gateway`。未接入 Cloudflare Workers AI 的原因是它需要账号 ID + 模型 run endpoint，响应形状不同，适合后续做专用 provider；未接入非官方中转的原因是限额、稳定性和合规风险不可控，不能作为公开小程序发布前主链路。
