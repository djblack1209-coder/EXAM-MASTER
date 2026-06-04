#!/usr/bin/env python3
"""
Build the 2015 Math II public-course bank from the local Baidu Netdisk PDF.

The source is a 14-page scanned question-analysis PDF with no usable text
layer. Questions and answer analysis are interleaved, so the builder publishes
pre-answer question crops plus trimmed page images for answer evidence. The
published answer pages crop out the recurring page header/footer promotion.
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math2-2015.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math2-2015"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math2-2015-release-assets"

PAPER_ANSWER = RAW_DIR / "src_a37ec1fa555f79f247286bf4-2015考研数学二真题.pdf"

SOURCE_IDS = {
    "paper_answer": "math2-2015-paper-answer",
}

PAPER_SOURCE_ID = "src_a37ec1fa555f79f247286bf4"

CHOICE_ANSWERS = {
    1: "D",
    2: "B",
    3: "A",
    4: "C",
    5: "D",
    6: "B",
    7: "D",
    8: "A",
}

FILL_ANSWERS = {
    9: "48",
    10: "n(n-1)(ln2)^(n-2)",
    11: "2",
    12: "e^(-2x)+2e^x",
    13: "-1/3(dx+2dy)",
    14: "21",
}

SHORT_ANSWERS = {
    15: "a=-1,k=-1/3,b=-1/2。",
    16: "A=8/π。",
    17: "极小值 f(0,-1)=-1。",
    18: "二重积分值为 π/4-2/5。",
    19: "f(x) 的零点个数为 2。",
    20: "30min",
    21: "切线与 x 轴交点 x0 满足 a<x0<b；完整证明见答案原页。",
    22: "a=0；X=[[3,1,-2],[1,1,-1],[2,1,-1]]。",
    23: "a=4,b=5；可取 P=[[2,-3,-1],[1,0,-1],[0,1,1]]，P^(-1)AP=diag(1,1,5)。",
}

# crop_id -> (trimmed answer page, y offset, height), measured on 130dpi
# answer-page renders after crop=950:1340:60:105.
QUESTION_CROPS: dict[str, tuple[int, int, int]] = {
    "01": (1, 160, 370),
    "02": (1, 710, 170),
    "03": (1, 1060, 240),
    "04": (2, 555, 475),
    "05": (3, 20, 315),
    "06": (3, 650, 520),
    "07": (4, 300, 280),
    "08": (4, 900, 240),
    "09": (5, 435, 85),
    "10": (5, 850, 95),
    "11": (5, 1185, 75),
    "12": (6, 185, 110),
    "13": (6, 430, 95),
    "14": (6, 910, 140),
    "15": (7, 70, 205),
    "16": (8, 745, 240),
    "17": (9, 60, 165),
    "18": (10, 120, 140),
    "19": (10, 660, 105),
    "20": (11, 470, 150),
    "21": (11, 900, 220),
    "22": (12, 690, 210),
    "23": (13, 760, 290),
}

QUESTION_IMAGES: dict[int, list[str]] = {number: [f"{number:02d}"] for number in range(1, 24)}

ANSWER_PAGES = {
    1: [1],
    2: [1],
    3: [1, 2],
    4: [2],
    5: [3],
    6: [3, 4],
    7: [4],
    8: [4, 5],
    9: [5],
    10: [5],
    11: [5, 6],
    12: [6],
    13: [6],
    14: [6],
    15: [7, 8],
    16: [8, 9],
    17: [9, 10],
    18: [10],
    19: [10, 11],
    20: [11],
    21: [11, 12],
    22: [12, 13],
    23: [13, 14],
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


def render_pdf_assets(pdf: Path, prefix: str, *, asset_dir: Path, force: bool, pages: set[int]) -> None:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = [asset_dir / f"{prefix}-{page:02d}.jpg" for page in sorted(pages)]
    if all(path.exists() for path in expected) and not force:
        return
    if force:
        for item in asset_dir.glob(f"{prefix}-*.jpg"):
            item.unlink()

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob(f"{prefix}-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / prefix
    run(["pdftoppm", "-r", "130", "-jpeg", "-jpegopt", "quality=70", str(pdf), str(output_prefix)])

    for page in sorted(pages):
        rendered = TMP_RENDER_DIR / f"{prefix}-{page:02d}.jpg"
        if not rendered.exists():
            raise FileNotFoundError(rendered)
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def crop_assets(*, asset_dir: Path, force: bool) -> None:
    asset_dir.mkdir(parents=True, exist_ok=True)
    if force:
        for stale in asset_dir.glob("answer-page-*.jpg"):
            stale.unlink()
        for stale in asset_dir.glob("question-*.jpg"):
            stale.unlink()

    for page in range(1, 15):
        source = asset_dir / f"paper-page-{page:02d}.jpg"
        target = asset_dir / f"answer-page-{page:02d}.jpg"
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
                "crop=950:1340:60:105",
                str(target),
            ]
        )

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
        "src": f"question-bank/math2-2015/question-{crop_id}.jpg",
        "caption": f"题面裁切图 q{crop_id}",
        "alt": f"2015考研数学二第{crop_id.split('-')[0]}题题面裁切图",
    }


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/math2-2015/answer-page-{page:02d}.jpg",
        "caption": f"答案解析 p.{page}",
        "alt": f"2015考研数学二答案解析 p.{page}",
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
    return f"2015考研数学二第{number}题（{section_for(number)}）。题干、公式和图形以题面裁切图为准。"


def explanation_for(number: int) -> str:
    if number <= 8:
        return "答案来自本地百度网盘 2015 数学二真题解析 PDF；选择题解析见答案原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2015 数学二真题解析 PDF；完整题干、公式和解析见原页图。"
    return "答案来自本地百度网盘 2015 数学二真题解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math2-2015-q{number:02d}",
        "sourceId": PAPER_SOURCE_ID,
        "answerSourceId": PAPER_SOURCE_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "question_crop_and_trimmed_answer_page_image",
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
        "id": f"math2-2015-{number:03d}",
        "number": number,
        "paperId": "math2-2015",
        "paperName": "2015考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2015",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": [question_image_ref(crop_id) for crop_id in QUESTION_IMAGES[number]],
        "answerImages": [answer_image_ref(page) for page in ANSWER_PAGES[number]],
        "tags": ["math2", "2015", section_for(number)],
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
            relative = str(image.get("src", "")).removeprefix("question-bank/math2-2015/")
            if relative and not (asset_dir / relative).exists():
                issues.append(f"card {expected_number}: missing asset {relative}")
            if "paper-page" in relative:
                issues.append(f"card {expected_number}: raw paper page referenced {relative}")
        if card_type == "single_choice":
            labels = [option.get("label") for option in card.get("options", [])]
            if labels != ["A", "B", "C", "D"]:
                issues.append(f"card {expected_number}: invalid options {labels}")
    expected_counts = {"single_choice": 8, "short_answer": 15}
    expected_section_counts = {"选择题": 8, "填空题": 6, "解答题": 9}
    if len(cards) != 23:
        issues.append(f"card count {len(cards)} != 23")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if section_counts != expected_section_counts:
        issues.append(f"section counts {section_counts} != {expected_section_counts}")
    if issues:
        raise ValueError("math2-2015 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "paper-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 15)))
    crop_assets(asset_dir=asset_dir, force=force_assets)
    for raw_page in asset_dir.glob("paper-page-*.jpg"):
        raw_page.unlink()
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards, asset_dir=asset_dir)

    return {
        "id": "math2-2015",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math2-2015",
        "paperName": "2015考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2015",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_question_crop_trimmed_answer_page_image_v1",
        "sourceFiles": [
            {
                "id": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": str(PAPER_ANSWER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(PAPER_ANSWER),
                "sourceId": PAPER_SOURCE_ID,
                "evidenceNote": (
                    "The 14-page scanned source interleaves prompts with answer analysis. "
                    "Published question crops stop before answer labels; answer pages are "
                    "trimmed to remove recurring page header/footer promotion. For q22, "
                    "the matrix answer follows the worked derivation on page 13."
                ),
            },
        ],
        "assetRoot": "question-bank/math2-2015",
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
