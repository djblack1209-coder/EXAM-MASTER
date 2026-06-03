#!/usr/bin/env python3
"""
Build the 2016 Math III public-course bank from the local Baidu Netdisk PDF.

The source is a scanned paper-answer PDF without a usable text layer. Pages 1-4
are the original paper, pages 5-19 are answer analysis, and pages 20-24 are
promotional noise. The generated bank uses audited question crops for the
pre-answer view and answer-analysis page images as grading evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math3-2016.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math3-2016"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math3-2016-release-assets"

PAPER_ANSWER = RAW_DIR / "src_fb595cd0da81efa6da3993c7-2016年考研数学三真题及解析.pdf"

SOURCE_IDS = {
    "paper_answer": "math3-2016-paper-answer",
}

PAPER_SOURCE_ID = "src_fb595cd0da81efa6da3993c7"

FILL_ANSWERS = {
    1: "a=1，b=-4。",
    2: "-g'(v) / g^2(v)。",
    3: "-1/2",
    4: "2",
    5: "1/e",
    6: "sigma^2",
}

CHOICE_ANSWERS = {
    7: "A",
    8: "D",
    9: "C",
    10: "B",
    11: "D",
    12: "D",
    13: "B",
    14: "C",
}

SHORT_ANSWERS = {
    15: "极限为 4/3。",
    16: "二重积分值为 16/9(3π-2)。",
    17: "积分不等式证明见答案原页。",
    18: "需求弹性、收益导数与价格区间结论见答案原页。",
    19: "和函数 S(x) 满足的一阶微分方程及表达式见答案原页。",
    20: "a、b 的分类讨论和 beta 的线性表示结论见答案原页。",
    21: "A 的特征值、特征向量和可逆矩阵 P 见答案原页。",
    22: "(X,Y) 的概率分布、相关系数和 Z 的概率分布见答案原页。",
    23: "参数 alpha、beta 的矩估计与最大似然估计见答案原页。",
}

QUESTION_CROPS: dict[str, tuple[int, int, int]] = {
    "01": (1, 150, 190),
    "02": (1, 350, 170),
    "03": (1, 505, 150),
    "04": (1, 665, 100),
    "05": (1, 780, 80),
    "06": (1, 895, 250),
    "07": (1, 1180, 115),
    "08": (1, 1320, 170),
    "09": (1, 1490, 155),
    "10-a": (1, 1640, 185),
    "10-b": (2, 95, 285),
    "11": (2, 385, 180),
    "12": (2, 650, 170),
    "13": (2, 830, 220),
    "14": (2, 1070, 180),
    "15": (2, 1275, 165),
    "16": (3, 95, 185),
    "17": (3, 375, 250),
    "18": (3, 620, 285),
    "19": (3, 905, 285),
    "20-a": (3, 720, 65),
    "20-b": (3, 785, 85),
    "20-c": (3, 870, 45),
    "20-d": (3, 910, 60),
    "21-a": (3, 910, 105),
    "21-b": (4, 95, 190),
    "22": (4, 345, 390),
    "23": (4, 690, 560),
}

QUESTION_MASKS: dict[str, list[tuple[int, int, int, int]]] = {
    # The source paper page has [D] printed beside question 11. Hide it from the
    # pre-answer crop while keeping the original analysis page as answer evidence.
    "11": [(500, 120, 190, 75)],
}

QUESTION_IMAGES: dict[int, list[str]] = {
    1: ["01"],
    2: ["02"],
    3: ["03"],
    4: ["04"],
    5: ["05"],
    6: ["06"],
    7: ["07"],
    8: ["08"],
    9: ["09"],
    10: ["10-a", "10-b"],
    11: ["11"],
    12: ["12"],
    13: ["13"],
    14: ["14"],
    15: ["15"],
    16: ["16"],
    17: ["17"],
    18: ["18"],
    19: ["19"],
    20: ["20-a", "20-b", "20-c", "20-d"],
    21: ["21-a", "21-b"],
    22: ["22"],
    23: ["23"],
}

ANSWER_PAGES = {
    1: [5],
    2: [5],
    3: [5, 6],
    4: [6],
    5: [6],
    6: [6, 7],
    7: [7],
    8: [7, 8],
    9: [8],
    10: [8, 9],
    11: [9],
    12: [9],
    13: [10],
    14: [10],
    15: [10, 11],
    16: [11],
    17: [11, 12],
    18: [12],
    19: [12, 13],
    20: [13, 14],
    21: [15, 16, 17],
    22: [17, 18],
    23: [18, 19],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def sha256_text(text: str) -> str:
    return f"sha256:{hashlib.sha256(text.encode('utf-8')).hexdigest()}"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, cwd=PROJECT_ROOT, check=True)


def render_pdf_assets(pdf: Path, prefix: str, *, asset_dir: Path, force: bool, pages: set[int] | None = None) -> None:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = sorted(asset_dir.glob(f"{prefix}-*.jpg"))
    if expected and not force:
        return
    if force:
        for item in expected:
            item.unlink()

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob(f"{prefix}-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / prefix
    run(["pdftoppm", "-r", "130", "-jpeg", "-jpegopt", "quality=70", str(pdf), str(output_prefix)])

    for rendered in sorted(TMP_RENDER_DIR.glob(f"{prefix}-*.jpg")):
        page = int(rendered.stem.split("-")[-1])
        if pages is not None and page not in pages:
            continue
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def scale(value: int) -> int:
    return round(value * 1.3)


def crop_filter(crop_id: str, y_offset: int, height: int) -> str:
    filters = [f"crop=iw:{scale(height)}:0:{scale(y_offset)}"]
    for x, y, width, mask_height in QUESTION_MASKS.get(crop_id, []):
        filters.append(f"drawbox=x={scale(x)}:y={scale(y)}:w={scale(width)}:h={scale(mask_height)}:color=white:t=fill")
    return ",".join(filters)


def crop_question_assets(*, asset_dir: Path, force: bool) -> None:
    asset_dir.mkdir(parents=True, exist_ok=True)
    if force:
        for stale in asset_dir.glob("question-*.jpg"):
            stale.unlink()
    for crop_id, (page, y_offset, height) in QUESTION_CROPS.items():
        source = asset_dir / f"answer-page-{page:02d}.jpg"
        target = asset_dir / f"question-{crop_id}.jpg"
        if target.exists() and not force:
            continue
        if not source.exists():
            raise FileNotFoundError(source)
        run(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(source),
                "-vf",
                crop_filter(crop_id, y_offset, height),
                str(target),
            ]
        )


def question_image_ref(crop_id: str) -> dict[str, str]:
    return {
        "src": f"question-bank/math3-2016/question-{crop_id}.jpg",
        "caption": f"题面裁切图 q{crop_id}",
        "alt": f"2016考研数学三第{crop_id.split('-')[0]}题题面裁切图",
    }


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/math3-2016/answer-page-{page:02d}.jpg",
        "caption": f"答案解析 p.{page}",
        "alt": f"2016考研数学三答案解析 p.{page}",
    }


def section_for(number: int) -> str:
    if number <= 6:
        return "填空题"
    if number <= 14:
        return "选择题"
    return "解答题"


def type_for(number: int) -> str:
    if 7 <= number <= 14:
        return "single_choice"
    return "short_answer"


def answer_for(number: int) -> str:
    if number in FILL_ANSWERS:
        return FILL_ANSWERS[number]
    if number in CHOICE_ANSWERS:
        return CHOICE_ANSWERS[number]
    return SHORT_ANSWERS[number]


def question_anchor(number: int) -> str:
    return f"2016考研数学三第{number}题（{section_for(number)}）。题干、公式和图形以题面裁切图为准。"


def explanation_for(number: int) -> str:
    if number <= 6:
        return "答案来自本地百度网盘 2016 数学三真题及解析 PDF；填空题完整解析见答案原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2016 数学三真题及解析 PDF；选择题解析见答案原页图。"
    return "答案来自本地百度网盘 2016 数学三真题及解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math3-2016-q{number:02d}",
        "sourceId": PAPER_SOURCE_ID,
        "answerSourceId": PAPER_SOURCE_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "question_crop_and_answer_page_image",
        "sourceEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceStatus": "matched",
        "answerTextHash": answer_hash,
    }


def build_card(number: int) -> dict[str, Any]:
    question = question_anchor(number)
    answer = answer_for(number)
    question_hash = sha256_text(f"{question}|crops:{QUESTION_IMAGES[number]}")
    answer_hash = sha256_text(f"{answer}|answer-pages:{ANSWER_PAGES[number]}")
    card_type = type_for(number)
    options = (
        [
            {"label": "A", "text": "A"},
            {"label": "B", "text": "B"},
            {"label": "C", "text": "C"},
            {"label": "D", "text": "D"},
        ]
        if card_type == "single_choice"
        else []
    )

    return {
        "id": f"math3-2016-{number:03d}",
        "number": number,
        "paperId": "math3-2016",
        "paperName": "2016考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2016",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": [question_image_ref(crop_id) for crop_id in QUESTION_IMAGES[number]],
        "answerImages": [answer_image_ref(page) for page in ANSWER_PAGES[number]],
        "tags": ["math3", "2016", section_for(number)],
        "difficulty": 3 if number >= 15 else 2,
        "sourceEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": source_evidence(number, answer_hash),
    }


def validate_cards(cards: list[dict[str, Any]], *, asset_dir: Path) -> None:
    issues: list[str] = []
    counts: dict[str, int] = {}
    section_counts: dict[str, int] = {}
    for expected_number, card in enumerate(cards, start=1):
        if card.get("number") != expected_number:
            issues.append(f"card {expected_number}: number={card.get('number')}")
        card_type = str(card.get("type") or "")
        section = str(card.get("section") or "")
        counts[card_type] = counts.get(card_type, 0) + 1
        section_counts[section] = section_counts.get(section, 0) + 1
        if not str(card.get("question") or "").strip():
            issues.append(f"card {expected_number}: missing question")
        if not str(card.get("answer") or "").strip():
            issues.append(f"card {expected_number}: missing answer")
        if not card.get("questionImages"):
            issues.append(f"card {expected_number}: missing question images")
        if not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing answer images")
        for image in [*card.get("questionImages", []), *card.get("answerImages", [])]:
            relative = str(image.get("src", "")).removeprefix("question-bank/math3-2016/")
            if relative and not (asset_dir / relative).exists():
                issues.append(f"card {expected_number}: missing asset {relative}")
            if "answer-page-2" in relative:
                issues.append(f"card {expected_number}: promo page referenced {relative}")
        if card_type == "single_choice":
            labels = [option.get("label") for option in card.get("options", [])]
            if labels != ["A", "B", "C", "D"]:
                issues.append(f"card {expected_number}: invalid options {labels}")
    expected_counts = {"short_answer": 15, "single_choice": 8}
    expected_section_counts = {"填空题": 6, "选择题": 8, "解答题": 9}
    if len(cards) != 23:
        issues.append(f"card count {len(cards)} != 23")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if section_counts != expected_section_counts:
        issues.append(f"section counts {section_counts} != {expected_section_counts}")
    if issues:
        raise ValueError("math3-2016 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 20)))
    crop_question_assets(asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards, asset_dir=asset_dir)

    return {
        "id": "math3-2016",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math3-2016",
        "paperName": "2016考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2016",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_question_crop_answer_page_image_v1",
        "sourceFiles": [
            {
                "id": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": str(PAPER_ANSWER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(PAPER_ANSWER),
                "sourceId": PAPER_SOURCE_ID,
                "evidenceNote": "PDF pages 20-24 are promotional noise and are excluded from question/answer evidence.",
            },
        ],
        "assetRoot": "question-bank/math3-2016",
        "processed_at": utc_now(),
        "total_cards": len(cards),
        "cards": cards,
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--asset-dir", type=Path, default=DEFAULT_ASSET_DIR)
    parser.add_argument("--force-assets", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = build_payload(asset_dir=args.asset_dir, force_assets=args.force_assets)
    write_json(args.output, payload)
    print(
        json.dumps(
            {
                "output": str(args.output.relative_to(PROJECT_ROOT)),
                "assetDir": str(args.asset_dir.relative_to(PROJECT_ROOT)),
                "cards": payload["total_cards"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
