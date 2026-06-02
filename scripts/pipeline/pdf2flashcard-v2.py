"""
考研大师 — PDF→闪卡 AI加工管线 v2
流程：PDF → OCR提取 → 清洗匿名化 → AI结构化解析 → 去重 → 输出JSON

v2 升级点：
- 用 LLM (OpenAI-compatible API) 替代正则做题目结构化解析
- AI 自动分离题干/选项/答案/解析
- AI 自动区分单选/多选/分析题
- AI 自动清除 OCR 伪影（页码、水印等）
- 分批处理 + 重试机制
- 兼容多种 LLM 后端 (OpenAI / DeepSeek / 智谱 等)

依赖：pip install ocrmac pymupdf openai
仅限macOS（OCR使用苹果原生引擎）
"""

from __future__ import annotations

import fitz  # pymupdf
try:
    from ocrmac import ocrmac
except Exception:  # noqa: BLE001 - allow text-layer PDFs to run without macOS OCR.
    ocrmac = None
import json, re, hashlib, os, time, sys
from pathlib import Path
from openai import OpenAI

# ============================================================
# 配置
# ============================================================
def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


def env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError:
        return default


OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "flashcards"
HASH_DB_PATH = Path(__file__).parent / ".card-hashes.json"
AI_CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "ai-cache"
LLM_CACHE_PATH = AI_CACHE_DIR / "pdf2flashcard-cache.json"
LLM_USAGE_PATH = AI_CACHE_DIR / "pdf2flashcard-usage.json"

# LLM 配置 — 通过环境变量覆盖
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
LLM_DAILY_REQUEST_LIMIT = env_int("LLM_DAILY_REQUEST_LIMIT", 200)
LLM_DAILY_CHAR_LIMIT = env_int("LLM_DAILY_CHAR_LIMIT", 1200000)
LLM_REQUEST_TIMEOUT_SECONDS = max(1.0, env_float("LLM_REQUEST_TIMEOUT_SECONDS", 20.0))
LLM_MAX_RETRIES = max(1, env_int("LLM_MAX_RETRIES", 3))
LLM_MAX_TOKENS = max(512, env_int("LLM_MAX_TOKENS", 8192))
LLM_ALLOW_PAID_FALLBACKS = os.environ.get("LLM_ALLOW_PAID_FALLBACKS", "false").lower() in ("1", "true", "yes")
ALLOW_EMPTY_LLM_CACHE = os.environ.get("PDF2FLASHCARD_ALLOW_EMPTY_CACHE", "false").lower() in ("1", "true", "yes")

SILICONFLOW_DS_KEY_ENVS = [f"SILICONFLOW_DS_KEY_{i}" for i in range(1, 11)]
LLM_PROVIDER_CONFIGS = [
    {
        "name": "iflow",
        "base_url": "https://apis.iflow.cn/v1",
        "model": "TBStars2-200B-A13B",
        "key_envs": ["IFLOW_API_KEY"],
        "model_env": "IFLOW_MODEL",
        "base_url_env": "IFLOW_BASE_URL",
    },
    {
        "name": "nvidia",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "model": "meta/llama-3.3-70b-instruct",
        "key_envs": ["NVIDIA_API_KEY"],
        "model_env": "NVIDIA_MODEL",
    },
    {
        "name": "groq",
        "base_url": "https://api.groq.com/openai/v1",
        "model": "llama-3.1-8b-instant",
        "key_envs": ["GROQ_API_KEY"],
        "model_env": "GROQ_MODEL",
    },
    {
        "name": "gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.5-flash-lite",
        "key_envs": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "model_env": "GEMINI_MODEL",
    },
    {
        "name": "cerebras",
        "base_url": "https://api.cerebras.ai/v1",
        "model": "qwen-3-32b",
        "key_envs": ["CEREBRAS_API_KEY"],
        "model_env": "CEREBRAS_MODEL",
    },
    {
        "name": "openrouter",
        "base_url": "https://openrouter.ai/api/v1",
        "model": "openrouter/free",
        "key_envs": ["OPENROUTER_API_KEY"],
        "model_env": "OPENROUTER_MODEL",
        "headers": {
            "HTTP-Referer": os.environ.get("OPENROUTER_SITE_URL", "https://exam-master.local"),
            "X-Title": os.environ.get("OPENROUTER_APP_NAME", "Exam-Master"),
        },
    },
    {
        "name": "mistral",
        "base_url": "https://api.mistral.ai/v1",
        "model": "mistral-small-latest",
        "key_envs": ["MISTRAL_API_KEY"],
        "model_env": "MISTRAL_MODEL",
    },
    {
        "name": "github_models",
        "base_url": "https://models.github.ai/inference",
        "model": "openai/gpt-4.1-mini",
        "key_envs": ["GITHUB_MODELS_TOKEN"],
        "model_env": "GITHUB_MODELS_MODEL",
        "headers": {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
    },
    {
        "name": "huggingface",
        "base_url": "https://router.huggingface.co/v1",
        "model": "Qwen/Qwen2.5-7B-Instruct",
        "key_envs": ["HF_TOKEN", "HUGGINGFACE_API_KEY"],
        "model_env": "HF_MODEL",
    },
    {
        "name": "gpt_api_free",
        "base_url": "https://api.chatanywhere.tech/v1",
        "model": "gpt-3.5-turbo",
        "key_envs": ["GPT_API_FREE_KEY"],
        "model_env": "GPT_API_FREE_MODEL",
    },
    {
        "name": "siliconflow_ds",
        "base_url": "https://api.siliconflow.cn/v1",
        "model": "deepseek-ai/DeepSeek-V3",
        "key_envs": SILICONFLOW_DS_KEY_ENVS,
        "model_env": "SILICONFLOW_DS_MODEL",
        "base_url_env": "SILICONFLOW_API_URL",
    },
    {
        "name": "siliconflow_official",
        "base_url": "https://api.siliconflow.cn/v1",
        "model": "Qwen/Qwen2.5-7B-Instruct",
        "key_envs": ["SILICONFLOW_OFFICIAL_API_KEY", "SILICONFLOW_API_KEY_1"],
        "model_env": "SILICONFLOW_MODEL",
        "base_url_env": "SILICONFLOW_API_URL",
    },
    {
        "name": "vercel_ai_gateway",
        "base_url": "https://ai-gateway.vercel.sh/v1",
        "model": "openai/gpt-4o-mini",
        "key_envs": ["VERCEL_AI_GATEWAY_API_KEY"],
        "model_env": "VERCEL_AI_GATEWAY_MODEL",
    },
    {
        "name": "zhipu",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-4-flash",
        "key_envs": ["ZHIPU_API_KEY"],
        "model_env": "ZHIPU_MODEL",
        "paid": True,
    },
]

# 每批发给 AI 的 OCR 文本最大字符数（避免超出上下文窗口）
BATCH_CHAR_LIMIT = max(500, env_int("PDF2FLASHCARD_BATCH_CHAR_LIMIT", 6000))
MIN_QUESTION_LIKE_BATCH_CHARS = max(100, env_int("PDF2FLASHCARD_MIN_QUESTION_LIKE_BATCH_CHARS", 200))
PDF_TEXT_LAYER_FIRST = os.environ.get("PDF_TEXT_LAYER_FIRST", "true").lower() not in ("0", "false", "no")
PDF_TEXT_MIN_CHARS_PER_PAGE = int(os.environ.get("PDF_TEXT_MIN_CHARS_PER_PAGE", "60"))

# 机构/老师/广告 黑名单关键词
BRAND_KEYWORDS = [
    # 老师名
    "肖秀荣", "徐涛", "腿姐", "陆寓丰", "唐迟", "田静", "刘晓艳",
    "李永乐", "王式安", "汤家凤", "张宇", "李林", "武忠祥",
    "何凯文", "王江涛", "潘赟", "颉斌斌", "米鹏", "蒋中挺",
    # 机构名
    "新东方", "文都", "中公", "粉笔", "考虫", "有道", "跨考",
    "启航", "海天", "海文", "万学", "恩波", "觉晓",
    # 社交/广告
    "微信公众号", "公众号", "微博", "B站", "bilibili", "抖音",
    "QQ群", "微信群", "加群", "报名", "咨询", "客服", "优惠",
    "扫码", "二维码", "关注", "转发", "点赞",
    "@", "NYC", "考研全程班", "网课",
    # 水印
    "正版扫描件", "清爽版", "背诵清单",
]

# 整行删除的正则模式
LINE_DELETE_PATTERNS = [
    r"^肖四.*?清单.*",
    r".*微信公众号.*",
    r".*@我从来没去过.*",
    r".*考研全程班.*",
    r"^--- PAGE \d+ ---$",
]

# 品牌替换
BRAND_REPLACEMENTS = {
    "全国硕士研究生招生考试": "考研",
    "全国硕士研究生入学统一考试": "考研",
}


# ============================================================
# AI 结构化解析 Prompt
# ============================================================
SYSTEM_PROMPT = """你是考研真题结构化解析专家。你的任务是将 OCR 提取的考研真题原始文本解析为结构化 JSON 数据。

## 输入
用户会给你一段从考研真题 PDF 中 OCR 提取的原始文本。文本可能包含：
- 选择题（单选/多选）
- 分析题（主观大题）
- OCR 错误和伪影（如页码"•52025年考研（政治）参考答案"、乱码等）
- 答案和解析可能混在选项文本中
- 题目可能跨页断裂

## 输出要求
返回一个 JSON 数组，每个元素代表一道题。严格按以下格式输出，不要输出任何其他内容：

```json
[
  {
    "number": 1,
    "type": "single_choice",
    "question": "完整的题干文本（清除所有OCR伪影）",
    "options": [
      {"label": "A", "text": "选项A的纯文本（不含解析）"},
      {"label": "B", "text": "选项B的纯文本"},
      {"label": "C", "text": "选项C的纯文本"},
      {"label": "D", "text": "选项D的纯文本"}
    ],
    "answer": "C",
    "explanation": "完整的答案解析文本"
  }
]
```

## 关键规则

1. **题型判断**：
   - `single_choice`：只有一个正确答案的选择题（通常题号 1-16）
   - `multi_choice`：有两个及以上正确答案的选择题（通常题号 17-33，题干常含"有（）"等表述）
   - `analysis`：主观分析题（无选项，需要文字作答）

2. **答案提取**：
   - 答案信息通常混在最后一个选项的文本中，或者在单独的答案解析段落中
   - 选择题的 answer 是字母组合，如 "A"、"CD"、"ABD"
   - 分析题的 answer 填入参考答案全文

3. **选项清洗**：
   - 每个选项只保留选项本身的文本内容
   - 将混入选项中的答案解析提取到 explanation 字段
   - 删除所有 OCR 页码伪影（如 "•52025年考研（政治）参考答案"）

4. **OCR 伪影清除**：
   - 删除所有形如 "X2025年考研（政治）参考答案" 的页码标记
   - 删除 "= 数字"、"• 数字" 等页码残留
   - 修复明显的 OCR 错别字

5. **分析题处理**：
   - 如果原文中题目和【参考答案】是分开的，合并为一条记录
   - question 字段放题目材料+问题
   - answer 字段放参考答案全文
   - options 为空数组

6. **不要遗漏任何题目**，确保输出中包含输入文本中的所有题目。"""


PARSE_USER_PROMPT = """请解析以下 OCR 文本中的考研真题，输出结构化 JSON 数组。

科目：{subject}
年份：{year}

--- OCR 原始文本 ---
{text}
--- 文本结束 ---

请输出 JSON 数组（不要包含 markdown 代码块标记）："""


# ============================================================
# 数据清洗模块
# ============================================================
def sanitize_text(text: str) -> str:
    """清洗文本：删除广告行、替换品牌名、匿名化"""
    lines = text.split("\n")
    cleaned = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 整行删除匹配
        skip = False
        for pattern in LINE_DELETE_PATTERNS:
            if re.match(pattern, line):
                skip = True
                break
        if skip:
            continue

        # 检查是否含广告关键词
        has_ad = False
        for kw in ["微信公众号", "QQ群", "微信群", "加群", "报名", "扫码", "二维码", "关注我"]:
            if kw in line:
                has_ad = True
                break
        if has_ad:
            continue

        # 品牌名替换
        for old, new in BRAND_REPLACEMENTS.items():
            line = line.replace(old, new)

        cleaned.append(line)

    return "\n".join(cleaned)


def anonymize_card(card: dict) -> dict:
    """对单张闪卡做最终匿名化"""
    for field in ["question", "explanation", "answer"]:
        val = card.get(field, "")
        if isinstance(val, str):
            for kw in BRAND_KEYWORDS:
                val = val.replace(kw, "")
            val = re.sub(r"\s{2,}", " ", val).strip()
            card[field] = val

    for opt in card.get("options", []):
        t = opt.get("text", "")
        for kw in BRAND_KEYWORDS:
            t = t.replace(kw, "")
        opt["text"] = t.strip()

    return card


def normalize_exam_card_type(card: dict, subject: str) -> dict:
    """Apply fixed exam structures after LLM parsing where the format is deterministic."""
    try:
        number = int(card.get("number") or 0)
    except (TypeError, ValueError):
        return card

    normalized_subject = str(subject).lower()
    if normalized_subject == "politics":
        if 1 <= number <= 16:
            card["type"] = "single_choice"
        elif 17 <= number <= 33:
            card["type"] = "multi_choice"
        elif 34 <= number <= 38:
            card["type"] = "analysis"
            card["options"] = []
    elif normalized_subject in {"english1", "english2"}:
        if 1 <= number <= 45:
            card["type"] = "single_choice"
        elif 46 <= number <= 50:
            card["type"] = "translation"
            card["options"] = []
        elif number in {51, 52}:
            card["type"] = "essay"
            card["options"] = []
    return card


# ============================================================
# 去重模块
# ============================================================
def load_hash_db() -> set:
    if HASH_DB_PATH.exists():
        with open(HASH_DB_PATH, "r") as f:
            return set(json.load(f))
    return set()


def save_hash_db(hashes: set):
    HASH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HASH_DB_PATH, "w") as f:
        json.dump(list(hashes), f)


def card_hash(card: dict) -> str:
    q = re.sub(r"\s+", "", card.get("question", ""))[:100]
    return hashlib.md5(q.encode("utf-8")).hexdigest()


def scoped_card_hash(card: dict, subject: str, year: str) -> str:
    """Record a paper-scoped hash for audit without suppressing other papers."""
    raw_hash = card_hash(card)
    return hashlib.md5(f"{subject}:{year}:{raw_hash}".encode("utf-8")).hexdigest()


def card_dedupe_key(card: dict) -> str:
    number = str(card.get("number") or "").strip()
    if number:
        return f"number:{number}"
    return f"question:{card_hash(card)}"


def dedupe_cards_for_current_paper(cards: list[dict]) -> tuple[list[dict], int]:
    """Deduplicate repeated batch output within one paper only.

    The same or similar question text can legitimately appear in different
    years. Cross-paper hash suppression makes a full historical bank incomplete.
    """
    seen: set[str] = set()
    unique_cards: list[dict] = []
    for card in cards:
        key = card_dedupe_key(card)
        if key in seen:
            continue
        seen.add(key)
        unique_cards.append(card)
    return unique_cards, len(cards) - len(unique_cards)


def record_processed_hashes(cards: list[dict], subject: str, year: str) -> None:
    hashes = load_hash_db()
    for card in cards:
        hashes.add(scoped_card_hash(card, subject, year))
    save_hash_db(hashes)


def load_existing_output(out_file: Path) -> dict | None:
    if not out_file.exists():
        return None
    with open(out_file, "r", encoding="utf-8") as f:
        payload = json.load(f)
    cards = payload.get("cards") if isinstance(payload, dict) else None
    return payload if isinstance(cards, list) and cards else None


# ============================================================
# AI 缓存与预算
# ============================================================
def load_json_cache(path: Path, default):
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json_cache(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def today_key() -> str:
    return time.strftime("%Y-%m-%d", time.localtime())


def llm_cache_key(text: str, subject: str, year: str, base_url: str | None = None, model: str | None = None) -> str:
    payload = "\n".join([base_url or LLM_BASE_URL, model or LLM_MODEL, subject, str(year), SYSTEM_PROMPT, text])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_cached_cards(cache_key: str):
    cache = load_json_cache(LLM_CACHE_PATH, {})
    item = cache.get(cache_key)
    if item and isinstance(item.get("cards"), list):
        return item["cards"]
    return None


def save_cached_cards(cache_key: str, cards: list, text_len: int):
    cache = load_json_cache(LLM_CACHE_PATH, {})
    cache[cache_key] = {
        "model": LLM_MODEL,
        "baseUrl": LLM_BASE_URL,
        "textLen": text_len,
        "createdAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        "cards": cards,
    }
    save_json_cache(LLM_CACHE_PATH, cache)


def can_spend_llm_budget(char_count: int) -> tuple[bool, str]:
    usage = load_json_cache(LLM_USAGE_PATH, {})
    day = today_key()
    current = usage.get(day, {"requests": 0, "chars": 0})

    if LLM_DAILY_REQUEST_LIMIT > 0 and current["requests"] + 1 > LLM_DAILY_REQUEST_LIMIT:
        return False, f"日请求上限 {LLM_DAILY_REQUEST_LIMIT} 已达到"
    if LLM_DAILY_CHAR_LIMIT > 0 and current["chars"] + char_count > LLM_DAILY_CHAR_LIMIT:
        return False, f"日字符上限 {LLM_DAILY_CHAR_LIMIT} 已达到"
    return True, ""


def record_llm_usage(char_count: int):
    usage = load_json_cache(LLM_USAGE_PATH, {})
    day = today_key()
    current = usage.get(day, {"requests": 0, "chars": 0})
    current["requests"] += 1
    current["chars"] += char_count
    usage[day] = current
    save_json_cache(LLM_USAGE_PATH, usage)


# ============================================================
# OCR 模块
# ============================================================
def extract_pdf_text_layer(pdf_path: str, max_pages: int = 0) -> str:
    """优先读取 PDF 文本层；可用时避免逐页 OCR。"""
    doc = fitz.open(pdf_path)
    total = doc.page_count if max_pages == 0 else min(doc.page_count, max_pages)
    pages = []
    usable_pages = 0

    for i in range(total):
        text = doc[i].get_text("text").strip()
        compact_len = len(re.sub(r"\s+", "", text))
        if compact_len >= PDF_TEXT_MIN_CHARS_PER_PAGE:
            usable_pages += 1
        pages.append(f"\n--- PAGE {i+1} ---\n{text}\n")

    doc.close()
    if total == 0:
        return ""

    ratio = usable_pages / total
    full_text = "".join(pages)
    compact_total = len(re.sub(r"\s+", "", full_text))
    if ratio >= 0.6 and compact_total >= max(300, total * PDF_TEXT_MIN_CHARS_PER_PAGE):
        print(f"  PDF文本层可用: {usable_pages}/{total}页, {compact_total}字符，跳过OCR")
        return full_text

    print(f"  PDF文本层不足: {usable_pages}/{total}页可用，进入Apple OCR")
    return ""


def ocr_pdf(pdf_path: str, max_pages: int = 0) -> str:
    """对PDF进行OCR，返回全文文本"""
    if PDF_TEXT_LAYER_FIRST:
        text_layer = extract_pdf_text_layer(pdf_path, max_pages=max_pages)
        if text_layer:
            return text_layer

    if ocrmac is None:
        raise RuntimeError("ocrmac 未安装或当前环境不可用，且 PDF 文本层不足")

    doc = fitz.open(pdf_path)
    total = doc.page_count if max_pages == 0 else min(doc.page_count, max_pages)
    print(f"  OCR处理: {os.path.basename(pdf_path)} ({total}页)")

    all_text = ""
    start = time.time()

    for i in range(total):
        page = doc[i]
        pix = page.get_pixmap(dpi=250)
        img_path = f"/tmp/ocr-pipeline-{i}.png"
        pix.save(img_path)

        try:
            anns = ocrmac.OCR(img_path, language_preference=["zh-Hans", "en-US"]).recognize()
            sorted_anns = sorted(anns, key=lambda x: (1 - x[2][1], x[2][0]))
            page_text = "\n".join([a[0] for a in sorted_anns if a[0].strip()])
            all_text += f"\n--- PAGE {i+1} ---\n{page_text}\n"
        except Exception as e:
            print(f"    第{i+1}页OCR失败: {e}")
        finally:
            if os.path.exists(img_path):
                os.remove(img_path)

        if (i + 1) % 10 == 0:
            print(f"    进度: {i+1}/{total}")

    elapsed = time.time() - start
    doc.close()
    print(f"  完成: {total}页, {elapsed:.1f}秒, {len(all_text)}字符")
    return all_text


# ============================================================
# AI 解析模块
# ============================================================
def parse_csv_set(value: str | None) -> set:
    return {item.strip().lower() for item in (value or "").split(",") if item.strip()}


def normalize_openai_base_url(url: str) -> str:
    trimmed = str(url or "").strip().rstrip("/")
    if trimmed.endswith("/chat/completions"):
        return trimmed[: -len("/chat/completions")]
    return trimmed


def provider_disabled(name: str, key_env: str) -> bool:
    disabled = parse_csv_set(os.environ.get("AI_PROVIDER_DISABLED_LIST")) | parse_csv_set(
        os.environ.get("LLM_DISABLED_PROVIDERS")
    )
    disabled_keys = parse_csv_set(
        os.environ.get("AI_PROVIDER_DISABLED_KEYS")
    ) | parse_csv_set(os.environ.get("AI_PROVIDER_DISABLED_KEY_ENVS")) | parse_csv_set(
        os.environ.get("LLM_DISABLED_KEYS")
    )
    return name.lower() in disabled or key_env.lower() in disabled_keys


def add_llm_backend(backends: list, seen: set, name: str, base_url: str, model: str, key_env: str, headers=None):
    if provider_disabled(name, key_env):
        return
    api_key = os.environ.get(key_env, "")
    if not api_key:
        return
    normalized_url = normalize_openai_base_url(base_url)
    backend_id = (name, normalized_url, model, key_env)
    if backend_id in seen:
        return
    client_kwargs = {"base_url": normalized_url, "api_key": api_key, "timeout": LLM_REQUEST_TIMEOUT_SECONDS}
    if headers:
        client_kwargs["default_headers"] = headers
    backends.append(
        {
            "name": name,
            "base_url": normalized_url,
            "model": model,
            "key_env": key_env,
            "client": OpenAI(**client_kwargs),
        }
    )
    seen.add(backend_id)


def create_llm_client() -> OpenAI:
    """创建 LLM 客户端"""
    if not LLM_API_KEY:
        print("错误: 请设置环境变量 LLM_API_KEY 或 OPENAI_API_KEY")
        sys.exit(1)

    return OpenAI(
        base_url=normalize_openai_base_url(LLM_BASE_URL),
        api_key=LLM_API_KEY,
        timeout=LLM_REQUEST_TIMEOUT_SECONDS,
    )


def create_llm_backends() -> list:
    """创建按优先级排列的 LLM 后端列表，支持免费号池降级。"""
    backends = []
    seen = set()

    if LLM_API_KEY:
        add_llm_backend(
            backends,
            seen,
            "llm_primary",
            LLM_BASE_URL,
            LLM_MODEL,
            "LLM_API_KEY" if os.environ.get("LLM_API_KEY") else "OPENAI_API_KEY",
        )

    for config in LLM_PROVIDER_CONFIGS:
        if config.get("paid") and not LLM_ALLOW_PAID_FALLBACKS:
            continue
        model = os.environ.get(config.get("model_env", ""), "") or config["model"]
        if config["name"] == "siliconflow_ds" and model.lower().startswith("pro/"):
            model = "deepseek-ai/DeepSeek-V3"
        base_url = os.environ.get(config.get("base_url_env", ""), "") or config["base_url"]
        for key_env in config["key_envs"]:
            add_llm_backend(backends, seen, config["name"], base_url, model, key_env, config.get("headers"))

    return backends


def split_text_into_batches(text: str, limit: int = BATCH_CHAR_LIMIT) -> list:
    """将 OCR 文本按题目边界分批，避免截断单道题"""
    lines = text.split("\n")
    batches = []
    current_batch = []
    current_len = 0

    def flush_batch() -> None:
        nonlocal current_batch, current_len
        if current_batch:
            batches.append("\n".join(current_batch))
            current_batch = []
            current_len = 0

    def split_long_line(line: str) -> list[str]:
        if len(line) + 1 <= limit:
            return [line]
        parts = []
        start = 0
        chunk_size = max(1, limit - 1)
        while start < len(line):
            end = min(len(line), start + chunk_size)
            parts.append(line[start:end])
            start = end
        return parts

    for line in lines:
        line_parts = split_long_line(line)
        for part_index, part in enumerate(line_parts):
            part_text = part if part_index == 0 else part
            part_len = len(part_text) + 1
            is_question_start = bool(re.match(r"^\d{1,2}[\.、．]\s*", part_text))
            if current_batch and (current_len + part_len > limit or (is_question_start and current_len > limit * 0.6)):
                flush_batch()
            current_batch.append(part_text)
            current_len += part_len
            if len(part_text) + 1 >= limit:
                flush_batch()

    flush_batch()

    return batches


def llm_batch_text_limit(limit: int = BATCH_CHAR_LIMIT) -> int:
    """Reserve prompt headroom so the user batch stays below provider limits."""
    return max(500, int(limit * 0.6))


def batch_should_have_cards(text: str) -> bool:
    compact = re.sub(r"\s+", "", text or "")
    if len(compact) < MIN_QUESTION_LIKE_BATCH_CHARS:
        return False
    return bool(
        re.search(r"(?m)^\s*\d{1,2}[\.、．]\s*", text or "")
        or re.search(r"(?m)^\s*[（(]\d+[）)]", text or "")
        or re.search(r"(分析题|材料\d+|回答下列问题|结合材料)", text or "")
    )


def cards_have_new_number(cards: list, seen_numbers: set) -> bool:
    for card in cards or []:
        if not isinstance(card, dict):
            continue
        number = card.get("number")
        if number and number not in seen_numbers:
            return True
    return False


def response_payload(response) -> dict:
    """Return a plain response payload for diagnostics without secrets."""
    if hasattr(response, "model_dump"):
        dumped = response.model_dump()
        return dumped if isinstance(dumped, dict) else {}
    if isinstance(response, dict):
        return response
    return {
        name: getattr(response, name)
        for name in ("choices", "status", "code", "msg", "message", "error", "model")
        if hasattr(response, name)
    }


def summarize_llm_response_error(payload: dict) -> str:
    parts = []
    for key in ("status", "code", "msg", "message"):
        value = payload.get(key)
        if value:
            parts.append(f"{key}={value}")
    error = payload.get("error")
    if isinstance(error, dict):
        error_text = error.get("message") or error.get("msg") or error.get("code")
        if error_text:
            parts.append(f"error={error_text}")
    elif error:
        parts.append(f"error={error}")
    return ", ".join(str(part) for part in parts) or "missing choices"


def extract_llm_content(response) -> str:
    payload = response_payload(response)
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError(f"LLM response missing choices: {summarize_llm_response_error(payload)}")

    first = choices[0]
    message = first.get("message") if isinstance(first, dict) else getattr(first, "message", None)
    content = message.get("content") if isinstance(message, dict) else getattr(message, "content", None)
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError(f"LLM response missing message content: {summarize_llm_response_error(payload)}")
    return content.strip()


def is_stable_backend_error(error: Exception) -> bool:
    message = str(error).lower()
    stable_markers = (
        "model not support",
        "model_not_found",
        "model not found",
        "unsupported model",
        "invalid model",
        "does not exist",
        "permission denied",
        "unauthorized",
        "invalid api key",
        "access denied",
        "identity verification",
        "customer_verification_required",
        "credit card",
        "user not found",
        "request too large",
        "tokens per minute",
        "free accounts is limited",
    )
    return any(marker in message for marker in stable_markers)


def ai_parse_batch(client: OpenAI, text: str, subject: str, year: str,
                   max_retries: int | None = None, model: str | None = None,
                   base_url: str | None = None, provider_name: str = "llm") -> list:
    """用 AI 解析一批 OCR 文本为结构化闪卡"""
    selected_model = model or LLM_MODEL
    selected_base_url = base_url or LLM_BASE_URL
    max_retries = max(1, int(max_retries or LLM_MAX_RETRIES))
    cache_key = llm_cache_key(text, subject, year, selected_base_url, selected_model)
    cached = get_cached_cards(cache_key)
    if cached is not None:
        if cached or ALLOW_EMPTY_LLM_CACHE or not batch_should_have_cards(text):
            print(" cache", end="", flush=True)
            return cached
        print(" empty-cache-miss", end="", flush=True)

    ok, reason = can_spend_llm_budget(len(text))
    if not ok:
        print(f" budget-skip({reason})", end="", flush=True)
        return []

    user_msg = PARSE_USER_PROMPT.format(subject=subject, year=year, text=text)
    last_error = None

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=selected_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.1,  # 低温度保证确定性
                max_tokens=LLM_MAX_TOKENS,
                timeout=LLM_REQUEST_TIMEOUT_SECONDS,
            )

            content = extract_llm_content(response)

            # 清除可能的 markdown 代码块标记
            content = re.sub(r"^```json\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

            cards = json.loads(content)
            if isinstance(cards, list):
                record_llm_usage(len(text))
                save_cached_cards(cache_key, cards, len(text))
                return cards
            elif isinstance(cards, dict) and "cards" in cards:
                parsed_cards = cards["cards"]
                record_llm_usage(len(text))
                save_cached_cards(cache_key, parsed_cards, len(text))
                return parsed_cards
            else:
                print(f"    警告: AI 返回了非数组结果，重试 ({attempt+1}/{max_retries})")
                last_error = RuntimeError("AI 返回了非数组结果")

        except json.JSONDecodeError as e:
            last_error = e
            print(f"    {provider_name} JSON解析失败 ({attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
        except Exception as e:
            last_error = e
            print(f"    {provider_name} AI请求失败 ({attempt+1}/{max_retries}): {e}")
            if is_stable_backend_error(e):
                raise RuntimeError(f"{provider_name} AI 解析失败: {last_error}") from e
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)

    raise RuntimeError(f"{provider_name} AI 解析失败: {last_error}")


def ai_parse_text(text: str, subject: str, year: str) -> list:
    """将完整 OCR 文本分批发给 AI 解析"""
    backends = create_llm_backends()
    if not backends:
        print("错误: 未配置可用 LLM 后端")
        sys.exit(1)

    batches = split_text_into_batches(text, limit=llm_batch_text_limit())
    print(f"  AI解析: 分{len(batches)}批处理, 可用后端{len(backends)}个")

    all_cards = []
    seen_numbers = set()
    disabled_backend_ids: set[tuple[str, str, str]] = set()

    for i, batch in enumerate(batches):
        print(f"    批次 {i+1}/{len(batches)} ({len(batch)}字符)...", end="", flush=True)
        cards = []
        errors = []
        for backend in backends:
            backend_id = (backend["name"], backend["base_url"], backend["model"])
            if backend_id in disabled_backend_ids:
                continue
            try:
                print(f" [{backend['name']}]", end="", flush=True)
                cards = ai_parse_batch(
                    backend["client"],
                    batch,
                    subject,
                    year,
                    model=backend["model"],
                    base_url=backend["base_url"],
                    provider_name=backend["name"],
                )
                if not cards and batch_should_have_cards(batch):
                    raise RuntimeError(f"{backend['name']} returned 0 cards for a question-like batch")
                if cards and batch_should_have_cards(batch) and not cards_have_new_number(cards, seen_numbers):
                    raise RuntimeError(f"{backend['name']} returned only duplicate cards for a question-like batch")
                break
            except Exception as exc:
                errors.append(f"{backend['name']}: {exc}")
                if is_stable_backend_error(exc):
                    disabled_backend_ids.add(backend_id)
                    print(" disabled", end="", flush=True)
                print(" fallback", end="", flush=True)

        if errors and not cards:
            raise RuntimeError("所有 LLM 后端均解析失败: " + " | ".join(errors[-3:]))

        # 去重（按题号）
        new_count = 0
        for card in cards:
            num = card.get("number")
            if num and num not in seen_numbers:
                seen_numbers.add(num)
                all_cards.append(card)
                new_count += 1

        print(f" {new_count}题")

        # 批次间短暂间隔，避免 rate limit
        if i < len(batches) - 1:
            time.sleep(1)

    # 按题号排序
    all_cards.sort(key=lambda c: c.get("number", 0))
    return all_cards


# ============================================================
# 主管线
# ============================================================
def process_pdf(pdf_path: str, subject: str, year: str, source: str = "") -> dict:
    """处理单个PDF：OCR → 清洗 → AI解析 → 匿名化 → 去重 → 输出"""
    print(f"\n{'='*60}")
    print(f"处理: {os.path.basename(pdf_path)}")
    print(f"科目: {subject}  年份: {year}")
    print(f"模型: {LLM_MODEL} @ {LLM_BASE_URL}")
    print(f"{'='*60}")

    # 1. OCR
    raw_text = ocr_pdf(pdf_path)

    # 2. 文本清洗（删除广告，替换品牌名）
    clean = sanitize_text(raw_text)
    print(f"  清洗完成: {len(raw_text)}字 -> {len(clean)}字 (删除{len(raw_text)-len(clean)}字)")

    # 3. AI 结构化解析
    cards = ai_parse_text(clean, subject, year)
    print(f"  AI解析出 {len(cards)} 道题")
    if len(clean) >= 200 and not cards:
        raise RuntimeError("AI parsing produced 0 questions from non-empty OCR text")

    # 4. 补充元数据 + 匿名化
    src = source or os.path.basename(pdf_path)
    for card in cards:
        num = card.get("number", 0)
        card["id"] = f"{subject}-{year}-{num:03d}"
        card["subject"] = subject
        card["year"] = year
        card["source"] = src
        card["tags"] = [subject, f"{year}真题"]
        # 确保字段完整
        card.setdefault("options", [])
        card.setdefault("answer", "")
        card.setdefault("explanation", "")
        card = normalize_exam_card_type(card, subject)
        card = anonymize_card(card)

    # 5. 卷内去重。不要跨年份/跨试卷过滤，否则会吞掉历史真题。
    paper_cards, dup_count = dedupe_cards_for_current_paper(cards)
    record_processed_hashes(paper_cards, subject, year)
    print(f"  卷内去重: {dup_count}张重复, {len(paper_cards)}张保留")

    # 6. 输出
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = OUTPUT_DIR / f"{subject}-{year}.json"
    existing_output = load_existing_output(out_file)
    if cards and not paper_cards and existing_output:
        print(f"  跳过输出: 解析结果均为重复题，保留已有 {out_file}")
        return existing_output

    result = {
        "source": src,
        "subject": subject,
        "year": year,
        "processed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_cards": len(paper_cards),
        "cards": paper_cards,
    }

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"  输出: {out_file} ({os.path.getsize(out_file)/1024:.1f}KB)")

    # 7. 质量报告
    print(f"\n  质量检查:")
    empty_answers = [c["id"] for c in paper_cards if not c.get("answer")]
    choice_cards = [c for c in paper_cards if c["type"] in ("single_choice", "multi_choice")]
    wrong_opts = [c["id"] for c in choice_cards if len(c.get("options", [])) != 4]

    if empty_answers:
        print(f"    警告: {len(empty_answers)}张卡片缺少答案: {empty_answers[:5]}")
    else:
        print(f"    OK: 所有{len(paper_cards)}张卡片都有答案")

    if wrong_opts:
        print(f"    警告: {len(wrong_opts)}张选择题选项数不为4: {wrong_opts[:5]}")
    else:
        print(f"    OK: 所有{len(choice_cards)}张选择题均有4个选项")

    type_counts = {}
    for c in paper_cards:
        t = c.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"    题型分布: {type_counts}")

    return result


# ============================================================
# CLI 入口
# ============================================================
def print_usage():
    print("考研大师 — PDF→闪卡 AI加工管线 v2")
    print()
    print("用法: python3 pdf2flashcard-v2.py <pdf路径> <科目> <年份>")
    print()
    print("示例:")
    print("  python3 pdf2flashcard-v2.py /tmp/politics-2025.pdf 政治 2025")
    print("  python3 pdf2flashcard-v2.py /tmp/english-2025.pdf 英语 2025")
    print()
    print("环境变量:")
    print(f"  LLM_API_KEY   = API密钥 (当前: {'已设置' if LLM_API_KEY else '未设置'})")
    print(f"  LLM_BASE_URL  = API地址 (当前: {LLM_BASE_URL})")
    print(f"  LLM_MODEL     = 模型名   (当前: {LLM_MODEL})")
    print(f"  LLM_REQUEST_TIMEOUT_SECONDS = 单请求超时秒数 (当前: {LLM_REQUEST_TIMEOUT_SECONDS})")
    print(f"  LLM_MAX_RETRIES = 单后端最大重试次数 (当前: {LLM_MAX_RETRIES})")
    print(f"  LLM_MAX_TOKENS = 单次输出 token 上限 (当前: {LLM_MAX_TOKENS})")
    print(f"  LLM_DAILY_REQUEST_LIMIT = 日请求上限 (当前: {LLM_DAILY_REQUEST_LIMIT})")
    print(f"  LLM_DAILY_CHAR_LIMIT    = 日字符上限 (当前: {LLM_DAILY_CHAR_LIMIT})")
    print(f"  PDF2FLASHCARD_BATCH_CHAR_LIMIT = 每批文本字符上限 (当前: {BATCH_CHAR_LIMIT})")
    print(f"  PDF_TEXT_LAYER_FIRST    = 优先文本层提取 (当前: {PDF_TEXT_LAYER_FIRST})")
    print()
    print("支持的 LLM 后端:")
    print("  OpenAI:   LLM_BASE_URL=https://api.openai.com/v1  LLM_MODEL=gpt-4o-mini")
    print("  DeepSeek: LLM_BASE_URL=https://api.deepseek.com   LLM_MODEL=deepseek-chat")
    print("  智谱:     LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4  LLM_MODEL=glm-4-flash")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print_usage()
        sys.exit(1)

    pdf_path = sys.argv[1]
    subject = sys.argv[2]
    year = sys.argv[3]

    if not os.path.exists(pdf_path):
        print(f"文件不存在: {pdf_path}")
        sys.exit(1)

    result = process_pdf(pdf_path, subject, year)
    print(f"\n完成！生成 {result['total_cards']} 张闪卡")
