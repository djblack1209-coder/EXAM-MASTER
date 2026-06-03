#!/usr/bin/env python3
"""
Build the 2017 Math II public-course bank from the local Baidu Netdisk PDF.

The source is a scanned question-analysis PDF with answers interleaved after
each prompt. The builder renders page images and crops each question prompt so
learners do not see answer analysis before reviewing a card. Page 11 contains
only promotional tail text after the final conclusion and is intentionally not
published as evidence.
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math2-2017.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math2-2017"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math2-2017-release-assets"

PAPER_ANSWER = RAW_DIR / "src_f91df4734f54ab6decaa093b-2017考研数学二真题.pdf"

SOURCE_IDS = {
    "paper_answer": "math2-2017-paper-answer",
}

PAPER_SOURCE_ID = "src_f91df4734f54ab6decaa093b"

CHOICE_ANSWERS = {
    1: "A",
    2: "B",
    3: "D",
    4: "C",
    5: "D",
    6: "C",
    7: "B",
    8: "B",
}

FILL_ANSWERS = {
    9: "y=x+2",
    10: "-1/8",
    11: "1",
    12: "xye^y",
    13: "-ln cos1",
    14: "-1",
}

SHORT_ANSWERS = {
    15: "极限为 2/3。",
    16: "dy/dx|_{x=0}=f_1'(1,1)；d^2y/dx^2|_{x=0}=f_11''(1,1)+f_1'(1,1)-f_2'(1,1)。",
    17: "极限为 1/4。",
    18: "极大值为 y(1)=1，极小值为 y(-1)=0。",
    19: "两项存在性命题证明见答案原页。",
    20: "二重积分值为 5π/4。",
    21: "曲线 L 满足的方程见答案原页。",
    22: "(I) r(A)=2；(II) Ax=β 的通解为 k(1,2,-1)^T+(1,1,1)^T，k∈R。",
    23: (
        "a=2；可取 Q=[[1/sqrt(3),-1/sqrt(2),1/sqrt(6)],"
        "[-1/sqrt(3),0,2/sqrt(6)],[1/sqrt(3),1/sqrt(2),1/sqrt(6)]]；"
        "标准型为 -3y_1^2+6y_2^2。"
    ),
}

# crop_id -> (source page, y offset, height), measured on 130dpi renders.
QUESTION_CROPS: dict[str, tuple[int, int, int]] = {
    "01": (1, 450, 175),
    "02": (1, 765, 120),
    "03": (1, 1115, 150),
    "04": (2, 220, 195),
    "05": (2, 680, 105),
    "06-a": (2, 1025, 385),
    "06-b": (3, 150, 70),
    "07": (3, 435, 135),
    "08": (3, 845, 235),
    "09": (4, 170, 150),
    "10": (4, 430, 195),
    "11": (4, 785, 190),
    "12": (4, 1120, 255),
    "13": (5, 470, 60),
    "14": (5, 690, 115),
    "15": (5, 1160, 120),
    "16": (6, 455, 100),
    "17": (6, 1120, 55),
    "18": (7, 135, 90),
    "19": (7, 770, 180),
    "20": (8, 445, 150),
    "21": (8, 735, 180),
    "22": (8, 1235, 260),
    "23": (9, 1005, 120),
}

QUESTION_IMAGES: dict[int, list[str]] = {
    1: ["01"],
    2: ["02"],
    3: ["03"],
    4: ["04"],
    5: ["05"],
    6: ["06-a", "06-b"],
    7: ["07"],
    8: ["08"],
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
    23: ["23"],
}

ANSWER_PAGES = {
    1: [1],
    2: [1],
    3: [1, 2],
    4: [2],
    5: [2],
    6: [3],
    7: [3],
    8: [3],
    9: [4],
    10: [4],
    11: [4],
    12: [4, 5],
    13: [5],
    14: [5],
    15: [5, 6],
    16: [6],
    17: [6],
    18: [7],
    19: [7, 8],
    20: [8],
    21: [8],
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
        "src": f"question-bank/math2-2017/question-{crop_id}.jpg",
        "caption": f"题面裁切图 q{crop_id}",
        "alt": f"2017考研数学二第{crop_id.split('-')[0]}题题面裁切图",
    }


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/math2-2017/answer-page-{page:02d}.jpg",
        "caption": f"答案解析 p.{page}",
        "alt": f"2017考研数学二答案解析 p.{page}",
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
    return f"2017考研数学二第{number}题（{section_for(number)}）。题干、公式和图形以题面裁切图为准。"


def explanation_for(number: int) -> str:
    if number <= 8:
        return "答案来自本地百度网盘 2017 数学二真题解析 PDF；选择题解析见答案原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2017 数学二真题解析 PDF；完整题干、公式和解析见原页图。"
    return "答案来自本地百度网盘 2017 数学二真题解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math2-2017-q{number:02d}",
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
        "id": f"math2-2017-{number:03d}",
        "number": number,
        "paperId": "math2-2017",
        "paperName": "2017考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2017",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": [question_image_ref(crop_id) for crop_id in QUESTION_IMAGES[number]],
        "answerImages": [answer_image_ref(page) for page in ANSWER_PAGES[number]],
        "tags": ["math2", "2017", section_for(number)],
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
            relative = str(image.get("src", "")).removeprefix("question-bank/math2-2017/")
            if relative and not (asset_dir / relative).exists():
                issues.append(f"card {expected_number}: missing asset {relative}")
            if "answer-page-11" in relative:
                issues.append(f"card {expected_number}: promotional page referenced {relative}")
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
        raise ValueError("math2-2017 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 11)))
    crop_question_assets(asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards, asset_dir=asset_dir)

    return {
        "id": "math2-2017",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math2-2017",
        "paperName": "2017考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2017",
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
                "evidenceNote": (
                    "The 11-page source interleaves each prompt with answer analysis; "
                    "question crops exclude answer blocks and page 11 promotional tail text is not referenced."
                ),
            },
        ],
        "assetRoot": "question-bank/math2-2017",
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
