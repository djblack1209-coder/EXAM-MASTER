"""
考研大师 — 百度网盘→闪卡 完整管线编排

自动化流程：
  1. 从百度网盘 /apps/考研大师/raw-pdf/ 扫描新 PDF
  2. 过滤广告文件（<50KB / 文件名含广告词）
  3. 下载 PDF 到本地临时目录
  4. 调用 pdf2flashcard-v2.py 进行 AI 加工
  5. 生成的闪卡 JSON 保存到 data/flashcards/
  6. 输出处理报告

用法：
  python3 scripts/baidu/pipeline.py                      # 处理所有新 PDF
  python3 scripts/baidu/pipeline.py --dir raw-pdf/政治    # 指定子目录
  python3 scripts/baidu/pipeline.py --dry-run             # 仅扫描不处理
  python3 scripts/baidu/pipeline.py --reprocess           # 重新处理已处理过的

网盘目录规范：
  /apps/考研大师/
    ├── raw-pdf/              ← 原始 PDF（baidu-autosave 转存到这里）
    │   ├── 政治/
    │   │   ├── 2025-真题.pdf
    │   │   └── 2024-真题.pdf
    │   ├── 英语/
    │   └── 数学/
    └── processed/            ← 已处理标记（避免重复处理）

依赖：pip install requests python-dotenv ocrmac pymupdf openai
"""

import os, sys, json, time, re, shutil
from pathlib import Path
from datetime import datetime

# 将项目根目录加入 path，以便导入 pan 和 pdf2flashcard
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts" / "baidu"))
sys.path.insert(0, str(PROJECT_ROOT / "scripts" / "pipeline"))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

from pan import BaiduPan, normalize_path, format_size

# pdf2flashcard-v2.py 文件名含连字符，需要 importlib 导入
import importlib.util
_v2_spec = importlib.util.spec_from_file_location(
    "pdf2flashcard_v2",
    str(PROJECT_ROOT / "scripts" / "pipeline" / "pdf2flashcard-v2.py"),
)
_v2_mod = importlib.util.module_from_spec(_v2_spec)
_v2_spec.loader.exec_module(_v2_mod)
process_pdf = _v2_mod.process_pdf

# ============================================================
# 配置
# ============================================================
RAW_PDF_DIR = "raw-pdf"            # 网盘上的 PDF 源目录
PROCESSED_LOG = PROJECT_ROOT / "data" / ".processed-pdfs.json"
LOCAL_TEMP_DIR = PROJECT_ROOT / "data" / "raw-pdf"   # 本地临时下载目录
FLASHCARD_DIR = PROJECT_ROOT / "data" / "flashcards"

# 文件名→科目 的映射规则
SUBJECT_PATTERNS = {
    r"政治|马原|毛中特|思修|史纲|形势": "政治",
    r"英语|English|阅读理解|完形填空": "英语",
    r"数学|高数|线代|概率|数一|数二|数三": "数学",
    r"管综|逻辑|写作|管理类联考": "管综",
}

# 年份提取正则
YEAR_PATTERN = re.compile(r"20[1-3]\d")

# 广告文件名关键词
AD_KEYWORDS = ["报名", "咨询", "加群", "优惠", "客服", "答疑", "课程", "网课",
               "招生", "目录", "封面", "广告"]

# 最小 PDF 大小（小于此值跳过，单位字节）
MIN_PDF_SIZE = 50 * 1024  # 50KB


# ============================================================
# 辅助函数
# ============================================================
def load_processed_log() -> dict:
    """加载已处理记录"""
    if PROCESSED_LOG.exists():
        with open(PROCESSED_LOG, "r") as f:
            return json.load(f)
    return {}


def save_processed_log(log: dict):
    """保存已处理记录"""
    PROCESSED_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(PROCESSED_LOG, "w") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


def guess_subject(filename: str, path: str) -> str:
    """从文件名或路径推测科目"""
    text = f"{path}/{filename}"
    for pattern, subject in SUBJECT_PATTERNS.items():
        if re.search(pattern, text):
            return subject
    return "未知"


def guess_year(filename: str) -> str:
    """从文件名提取年份"""
    match = YEAR_PATTERN.search(filename)
    return match.group(0) if match else str(datetime.now().year)


def is_ad_file(filename: str, size: int) -> tuple:
    """检查是否为广告文件，返回 (is_ad, reason)"""
    if size < MIN_PDF_SIZE:
        return True, f"文件过小 ({format_size(size)} < 50KB)"

    for kw in AD_KEYWORDS:
        if kw in filename:
            return True, f"文件名含广告关键词 '{kw}'"

    return False, ""


# ============================================================
# 管线主流程
# ============================================================
def run_pipeline(scan_dir: str = RAW_PDF_DIR, dry_run: bool = False,
                 reprocess: bool = False):
    """
    执行完整管线

    Args:
        scan_dir: 网盘扫描目录
        dry_run: 仅扫描不处理
        reprocess: 重新处理已处理过的文件
    """
    print("="*60)
    print("考研大师 — 百度网盘→闪卡 自动化管线")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"模式: {'预览(dry-run)' if dry_run else '正式处理'}")
    print("="*60)

    # 1. 连接百度网盘
    print("\n[1/5] 连接百度网盘...")
    try:
        pan = BaiduPan()
    except Exception as e:
        print(f"  连接失败: {e}")
        sys.exit(1)

    # 2. 扫描 PDF 文件
    print(f"\n[2/5] 扫描 PDF 文件: {normalize_path(scan_dir)}")
    try:
        all_files = pan.search(".pdf", scan_dir)
    except Exception as e:
        print(f"  搜索失败: {e}")
        sys.exit(1)

    pdf_files = [f for f in all_files
                 if f.get("server_filename", "").lower().endswith(".pdf")
                 and f.get("isdir", 0) == 0]

    print(f"  找到 {len(pdf_files)} 个 PDF 文件")

    if not pdf_files:
        print("\n没有需要处理的文件")
        return

    # 3. 过滤 & 分类
    print(f"\n[3/5] 过滤与分类...")
    processed_log = load_processed_log()
    tasks = []  # [(remote_path, filename, subject, year, size)]
    skipped = {"ad": 0, "processed": 0}

    for f in pdf_files:
        fname = f["server_filename"]
        fpath = f.get("path", "")
        fsize = f.get("size", 0)
        fs_id = f.get("fs_id", 0)

        # 跳过广告
        is_ad, reason = is_ad_file(fname, fsize)
        if is_ad:
            print(f"  跳过: {fname} — {reason}")
            skipped["ad"] += 1
            continue

        # 跳过已处理
        file_key = f"{fpath}:{f.get('server_mtime', 0)}"
        if file_key in processed_log and not reprocess:
            print(f"  跳过: {fname} — 已处理过")
            skipped["processed"] += 1
            continue

        # 推测科目和年份
        subject = guess_subject(fname, fpath)
        year = guess_year(fname)

        tasks.append({
            "path": fpath,
            "filename": fname,
            "subject": subject,
            "year": year,
            "size": fsize,
            "fs_id": fs_id,
            "file_key": file_key,
        })
        print(f"  待处理: {fname} → 科目={subject} 年份={year} ({format_size(fsize)})")

    print(f"\n  汇总: {len(tasks)} 待处理, {skipped['ad']} 广告跳过, {skipped['processed']} 已处理跳过")

    if not tasks:
        print("\n没有新文件需要处理")
        return

    if dry_run:
        print("\n[dry-run] 预览完成，未实际处理任何文件")
        return

    # 4. 下载 & AI 加工
    print(f"\n[4/5] 下载 & AI 加工...")
    LOCAL_TEMP_DIR.mkdir(parents=True, exist_ok=True)
    FLASHCARD_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    for i, task in enumerate(tasks):
        print(f"\n{'─'*50}")
        print(f"[{i+1}/{len(tasks)}] {task['filename']}")
        print(f"  科目: {task['subject']}  年份: {task['year']}")

        try:
            # 4a. 下载
            local_path = str(LOCAL_TEMP_DIR / task["filename"])
            print(f"  下载中...")

            info = pan.file_info([task["fs_id"]])
            if not info or not info[0].get("dlink"):
                print(f"  错误: 无法获取下载链接")
                results.append({"file": task["filename"], "status": "下载失败", "cards": 0})
                continue

            dlink = info[0]["dlink"]
            download_url = f"{dlink}&access_token={pan.token}"

            resp = pan.session.get(
                download_url,
                headers={"User-Agent": "pan.baidu.com"},
                stream=True,
                timeout=300,
            )

            with open(local_path, "wb") as fp:
                for chunk in resp.iter_content(chunk_size=8192):
                    fp.write(chunk)

            actual_size = os.path.getsize(local_path)
            print(f"  已下载: {format_size(actual_size)}")

            # 4b. AI 加工
            result = process_pdf(local_path, task["subject"], task["year"])
            card_count = result.get("total_cards", 0)

            # 4c. 记录已处理
            processed_log[task["file_key"]] = {
                "processed_at": datetime.now().isoformat(),
                "subject": task["subject"],
                "year": task["year"],
                "cards": card_count,
            }
            save_processed_log(processed_log)

            results.append({
                "file": task["filename"],
                "status": "成功",
                "cards": card_count,
                "subject": task["subject"],
                "year": task["year"],
            })

            # 清理本地临时 PDF
            os.remove(local_path)
            print(f"  清理临时文件: {local_path}")

            # 批次间间隔（避免 API 频率限制）
            if i < len(tasks) - 1:
                print(f"  等待 3 秒...")
                time.sleep(3)

        except Exception as e:
            print(f"  处理失败: {e}")
            results.append({"file": task["filename"], "status": f"失败: {e}", "cards": 0})

    # 5. 报告
    print(f"\n{'='*60}")
    print("[5/5] 处理报告")
    print(f"{'='*60}")

    total_cards = 0
    success_count = 0
    for r in results:
        status_icon = "OK" if r["status"] == "成功" else "FAIL"
        print(f"  [{status_icon}] {r['file']}: {r['status']}, {r['cards']}张闪卡")
        total_cards += r.get("cards", 0)
        if r["status"] == "成功":
            success_count += 1

    print(f"\n  成功: {success_count}/{len(results)}")
    print(f"  总闪卡: {total_cards}张")
    print(f"  输出目录: {FLASHCARD_DIR}")

    # 生成报告 JSON
    report = {
        "run_at": datetime.now().isoformat(),
        "scan_dir": normalize_path(scan_dir),
        "total_files": len(pdf_files),
        "processed": len(tasks),
        "skipped_ad": skipped["ad"],
        "skipped_processed": skipped["processed"],
        "results": results,
        "total_cards": total_cards,
    }

    report_path = PROJECT_ROOT / "data" / "pipeline-report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"  报告: {report_path}")


# ============================================================
# CLI
# ============================================================
if __name__ == "__main__":
    scan_dir = RAW_PDF_DIR
    dry_run = "--dry-run" in sys.argv
    reprocess = "--reprocess" in sys.argv

    # 提取 --dir 参数
    for i, arg in enumerate(sys.argv):
        if arg == "--dir" and i + 1 < len(sys.argv):
            scan_dir = sys.argv[i + 1]

    run_pipeline(scan_dir=scan_dir, dry_run=dry_run, reprocess=reprocess)
