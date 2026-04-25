"""
考研大师 — PDF→闪卡 自动化加工管线
功能：下载PDF → OCR提取 → 清洗匿名化 → 结构化解析 → 去重 → 输出JSON
依赖：pip install ocrmac pymupdf
仅限macOS（使用苹果原生OCR引擎）
"""

import fitz  # pymupdf
from ocrmac import ocrmac
import json, re, hashlib, os, time, sys
from pathlib import Path


# ============================================================
# 配置
# ============================================================
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "flashcards"
HASH_DB_PATH = Path(__file__).parent / ".card-hashes.json"

# 机构/老师/广告 黑名单关键词（匹配到的行会被删除或替换）
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
    # 水印标识
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

# 替换规则（品牌名→匿名）
BRAND_REPLACEMENTS = {
    "全国硕士研究生招生考试": "考研",
    "全国硕士研究生入学统一考试": "考研",
}


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

        # 检查是否含广告关键词（整行删除）
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
    # 清洗题干
    q = card.get("question", "")
    for kw in BRAND_KEYWORDS:
        q = q.replace(kw, "")
    q = re.sub(r"\s{2,}", " ", q).strip()
    card["question"] = q

    # 清洗选项
    for opt in card.get("options", []):
        t = opt.get("text", "")
        for kw in BRAND_KEYWORDS:
            t = t.replace(kw, "")
        opt["text"] = t.strip()

    # 清洗解析
    exp = card.get("explanation", "")
    for kw in BRAND_KEYWORDS:
        exp = exp.replace(kw, "")
    card["explanation"] = exp.strip()

    return card


# ============================================================
# 去重模块
# ============================================================
def load_hash_db() -> set:
    """加载已有闪卡的hash集合"""
    if HASH_DB_PATH.exists():
        with open(HASH_DB_PATH, "r") as f:
            return set(json.load(f))
    return set()


def save_hash_db(hashes: set):
    """保存hash集合"""
    HASH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HASH_DB_PATH, "w") as f:
        json.dump(list(hashes), f)


def card_hash(card: dict) -> str:
    """计算闪卡的去重hash（基于题干前100字）"""
    # 只用题干前100个非空白字符做hash，避免格式差异导致误判
    q = re.sub(r"\s+", "", card.get("question", ""))[:100]
    return hashlib.md5(q.encode("utf-8")).hexdigest()


# ============================================================
# OCR模块
# ============================================================
def ocr_pdf(pdf_path: str, max_pages: int = 0) -> str:
    """对PDF进行OCR，返回全文文本"""
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
            # 按从上到下排序
            sorted_anns = sorted(anns, key=lambda x: (1 - x[2][1], x[2][0]))
            page_text = "\n".join([a[0] for a in sorted_anns if a[0].strip()])
            all_text += f"\n{page_text}\n"
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
# 解析模块：文本→结构化闪卡
# ============================================================
def parse_choice_questions(text: str, subject: str, year: str, source: str) -> list:
    """从OCR文本中解析选择题"""
    cards = []
    lines = text.split("\n")
    current_q = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 匹配题号
        m = re.match(r"^(\d{1,2})[\.、．]\s*(.+)", line)
        if m and 1 <= int(m.group(1)) <= 50:
            num = int(m.group(1))
            q_text = m.group(2).strip()

            # 跳过答案行
            if re.match(r"[\[【]?答案", q_text):
                # 提取答案
                ans_m = re.search(r"([A-D]+)", q_text)
                if ans_m:
                    for c in cards:
                        if c["number"] == num:
                            c["answer"] = ans_m.group(1)
                            break
                continue

            if current_q and current_q.get("question"):
                cards.append(current_q)

            current_q = {
                "id": f"{subject}-{year}-{num:03d}",
                "subject": subject,
                "year": year,
                "number": num,
                "question": q_text,
                "options": [],
                "answer": "",
                "explanation": "",
                "type": "choice" if num <= 33 else "analysis",
                "source": source,
                "tags": [subject, f"{year}真题"],
            }
            continue

        # 匹配选项
        opt_m = re.match(r"^[\[（(]*([A-D])[\]）)\.\s．](.+)", line)
        if opt_m and current_q:
            current_q["options"].append(
                {"label": opt_m.group(1), "text": opt_m.group(2).strip()}
            )
            continue

        # 匹配独立答案行
        ans_m = re.match(r"^(\d{1,2})[\.、．]\s*[\[【]?答案[\]】]?\s*([A-D]+)", line)
        if ans_m:
            num = int(ans_m.group(1))
            ans = ans_m.group(2)
            for c in cards:
                if c["number"] == num:
                    c["answer"] = ans
                    break
            continue

        # 匹配解析
        exp_m = re.match(r"[\[【]解析[\]】]\s*(.+)", line)
        if exp_m and cards:
            cards[-1]["explanation"] = exp_m.group(1).strip()
            continue

        # 续行追加
        if current_q and line:
            if current_q.get("options"):
                current_q["options"][-1]["text"] += line
            else:
                current_q["question"] += line

    if current_q and current_q.get("question"):
        cards.append(current_q)

    return cards


# ============================================================
# 主管线
# ============================================================
def process_pdf(pdf_path: str, subject: str, year: str, source: str = "") -> dict:
    """处理单个PDF：OCR → 清洗 → 解析 → 去重 → 输出"""
    print(f"\n{'='*60}")
    print(f"处理: {os.path.basename(pdf_path)}")
    print(f"科目: {subject}  年份: {year}")
    print(f"{'='*60}")

    # 1. OCR
    raw_text = ocr_pdf(pdf_path)

    # 2. 清洗
    clean_text = sanitize_text(raw_text)
    print(f"  清洗完成: {len(raw_text)}字 → {len(clean_text)}字 (删除{len(raw_text)-len(clean_text)}字)")

    # 3. 解析
    cards = parse_choice_questions(clean_text, subject, year, source or os.path.basename(pdf_path))
    print(f"  解析出 {len(cards)} 张闪卡")

    # 4. 匿名化
    cards = [anonymize_card(c) for c in cards]

    # 5. 去重
    existing_hashes = load_hash_db()
    new_cards = []
    dup_count = 0
    for c in cards:
        h = card_hash(c)
        if h not in existing_hashes:
            existing_hashes.add(h)
            new_cards.append(c)
        else:
            dup_count += 1
    save_hash_db(existing_hashes)
    print(f"  去重: {dup_count}张重复, {len(new_cards)}张新增")

    # 6. 输出
    result = {
        "source": source or os.path.basename(pdf_path),
        "subject": subject,
        "year": year,
        "processed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_cards": len(new_cards),
        "cards": new_cards,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = OUTPUT_DIR / f"{subject}-{year}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"  输出: {out_file} ({os.path.getsize(out_file)/1024:.1f}KB)")
    return result


# ============================================================
# CLI 入口
# ============================================================
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("用法: python3 pdf2flashcard.py <pdf路径> <科目> <年份>")
        print("示例: python3 pdf2flashcard.py /tmp/politics-2025.pdf 政治 2025")
        sys.exit(1)

    pdf_path = sys.argv[1]
    subject = sys.argv[2]
    year = sys.argv[3]

    if not os.path.exists(pdf_path):
        print(f"文件不存在: {pdf_path}")
        sys.exit(1)

    result = process_pdf(pdf_path, subject, year)
    print(f"\n完成！生成 {result['total_cards']} 张闪卡")
