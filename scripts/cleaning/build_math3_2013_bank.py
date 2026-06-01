#!/usr/bin/env python3
"""
Build the 2013 Math III public-course bank from the local Baidu Netdisk PDF.

The source is a scanned paper-answer PDF without a usable text layer. Its
answers and explanations appear immediately after each question, so question
evidence is generated from per-question cropped page images.
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math3-2013.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math3-2013"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math3-2013-release-assets"

PAPER_ANSWER = RAW_DIR / "src_b4cf0b63525b94f4333b545e-2013年考研数学三真题及解析.pdf"

SOURCE_IDS = {
    "paper_answer": "math3-2013-paper-answer",
}

PAPER_SOURCE_ID = "src_b4cf0b63525b94f4333b545e"

CHOICE_ANSWERS = {
    1: "D",
    2: "C",
    3: "B",
    4: "D",
    5: "B",
    6: "B",
    7: "A",
    8: "C",
}

FILL_ANSWERS = {
    9: "-2",
    10: "2 - 2 ln 2",
    11: "ln 2",
    12: "y = (C1 + C2 x)e^(x/2)",
    13: "-1",
    14: "2e^2",
}

SHORT_ANSWERS = {
    15: "a=7，n=2。",
    16: "a=7sqrt(7)。",
    17: "二重积分值为 416/3。",
    18: "边际利润为 40 - Q/500；P=50 时边际利润为 20；最大利润定价 P=40。",
    19: "证明结论见答案原页。",
    20: "a=-1，b=0；满足 AC-CA=B 的矩阵 C 见答案原页。",
    21: "二次型对应矩阵为 2aa^T + bb^T；正交变换下标准形为 2y1^2 + y2^2。",
    22: "联合概率密度与 Y 的边缘概率密度见答案原页。",
    23: "theta 的矩估计量与极大似然估计量见答案原页。",
}

QUESTION_CROPS: dict[str, tuple[int, int, int]] = {
    "01": (1, 300, 220),
    "02": (1, 645, 115),
    "03": (1, 1130, 150),
    "04": (2, 395, 270),
    "05": (2, 935, 135),
    "06-a": (2, 1305, 145),
    "06-b": (3, 150, 145),
    "07": (3, 595, 190),
    "08-a": (3, 1195, 240),
    "08-b": (4, 145, 135),
    "09": (4, 520, 90),
    "10": (4, 775, 80),
    "11": (4, 1025, 80),
    "12": (4, 1305, 95),
    "13": (5, 250, 100),
    "14": (5, 625, 80),
    "15": (5, 1065, 105),
    "16": (6, 305, 130),
    "17": (6, 690, 105),
    "18": (6, 895, 210),
    "19": (7, 140, 210),
    "20": (7, 625, 130),
    "21": (8, 550, 235),
    "22": (9, 540, 285),
    "23": (9, 1190, 180),
    "23-b": (10, 145, 190),
}

QUESTION_IMAGES: dict[int, list[str]] = {
    1: ["01"],
    2: ["02"],
    3: ["03"],
    4: ["04"],
    5: ["05"],
    6: ["06-a", "06-b"],
    7: ["07"],
    8: ["08-a", "08-b"],
    9: ["09"],
    10: ["10"],
    11: ["11"],
    12: ["12"],
    13: ["13"],
    14: ["14"],
    15: ["15"],
    16: ["16"],
    17: ["17"],
    18: ["18"],
    19: ["19"],
    20: ["20"],
    21: ["21"],
    22: ["22"],
    23: ["23", "23-b"],
}

ANSWER_PAGES = {
    1: [1],
    2: [1],
    3: [1, 2],
    4: [2],
    5: [2],
    6: [2, 3],
    7: [3],
    8: [3, 4],
    9: [4],
    10: [4],
    11: [4],
    12: [4, 5],
    13: [5],
    14: [5],
    15: [5, 6],
    16: [6],
    17: [6],
    18: [6],
    19: [7],
    20: [7, 8],
    21: [8, 9],
    22: [9],
    23: [9, 10],
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
                f"crop=iw:{height}:0:{y_offset}",
                str(target),
            ]
        )


def question_image_ref(crop_id: str) -> dict[str, str]:
    return {
        "src": f"question-bank/math3-2013/question-{crop_id}.jpg",
        "caption": f"题面裁切图 q{crop_id}",
        "alt": f"2013考研数学三第{crop_id.split('-')[0]}题题面裁切图",
    }


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/math3-2013/answer-page-{page:02d}.jpg",
        "caption": f"答案解析 p.{page}",
        "alt": f"2013考研数学三答案解析 p.{page}",
    }


def section_for(number: int) -> str:
    if number <= 8:
        return "选择题"
    if number <= 14:
        return "填空题"
    return "解答题"


def type_for(number: int) -> str:
    if number <= 8:
        return "single_choice"
    return "short_answer"


def answer_for(number: int) -> str:
    if number in CHOICE_ANSWERS:
        return CHOICE_ANSWERS[number]
    if number in FILL_ANSWERS:
        return FILL_ANSWERS[number]
    return SHORT_ANSWERS[number]


def question_anchor(number: int) -> str:
    return f"2013考研数学三第{number}题（{section_for(number)}）。题干、公式和图形以题面裁切图为准。"


def explanation_for(number: int) -> str:
    if number <= 8:
        return "答案来自本地百度网盘 2013 数学三真题及解析 PDF；选择题解析见答案原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2013 数学三真题及解析 PDF；完整题干、公式和解析见原页图。"
    return "答案来自本地百度网盘 2013 数学三真题及解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math3-2013-q{number:02d}",
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
        "id": f"math3-2013-{number:03d}",
        "number": number,
        "paperId": "math3-2013",
        "paperName": "2013考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2013",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": [question_image_ref(crop_id) for crop_id in QUESTION_IMAGES[number]],
        "answerImages": [answer_image_ref(page) for page in ANSWER_PAGES[number]],
        "tags": ["math3", "2013", section_for(number)],
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
    for expected_number, card in enumerate(cards, start=1):
        if card.get("number") != expected_number:
            issues.append(f"card {expected_number}: number={card.get('number')}")
        card_type = str(card.get("type") or "")
        counts[card_type] = counts.get(card_type, 0) + 1
        if not str(card.get("question") or "").strip():
            issues.append(f"card {expected_number}: missing question")
        if not str(card.get("answer") or "").strip():
            issues.append(f"card {expected_number}: missing answer")
        if not card.get("questionImages"):
            issues.append(f"card {expected_number}: missing question images")
        if not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing answer images")
        for image in [*card.get("questionImages", []), *card.get("answerImages", [])]:
            relative = str(image.get("src", "")).removeprefix("question-bank/math3-2013/")
            if relative and not (asset_dir / relative).exists():
                issues.append(f"card {expected_number}: missing asset {relative}")
        if card_type == "single_choice":
            labels = [option.get("label") for option in card.get("options", [])]
            if labels != ["A", "B", "C", "D"]:
                issues.append(f"card {expected_number}: invalid options {labels}")
    expected_counts = {"single_choice": 8, "short_answer": 15}
    if len(cards) != 23:
        issues.append(f"card count {len(cards)} != 23")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if issues:
        raise ValueError("math3-2013 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 11)))
    crop_question_assets(asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards, asset_dir=asset_dir)

    return {
        "id": "math3-2013",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math3-2013",
        "paperName": "2013考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2013",
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
            },
        ],
        "assetRoot": "question-bank/math3-2013",
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
