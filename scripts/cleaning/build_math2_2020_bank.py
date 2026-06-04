#!/usr/bin/env python3
"""
Build the 2020 Math II public-course bank from the local Baidu Netdisk PDF.

The source is a 16-page scanned PDF without a usable text layer. Page 1 is the
cover/instructions, pages 2-5 are the official question pages, and pages 6-16
are answer-analysis pages. The builder publishes cropped question images and
content-trimmed answer page images so formulas and proof work remain tied to
the source pages while page header/footer promotion is kept out of app assets.
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math2-2020.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math2-2020"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math2-2020-release-assets"

PAPER_ANSWER = RAW_DIR / "src_d6fc5e2745b7a1ad6320a099-2020考研数学二真题.pdf"

SOURCE_IDS = {
    "paper_answer": "math2-2020-paper-answer",
}

PAPER_SOURCE_ID = "src_d6fc5e2745b7a1ad6320a099"

CHOICE_ANSWERS = {
    1: "D",
    2: "C",
    3: "A",
    4: "A",
    5: "B",
    6: "B",
    7: "C",
    8: "D",
}

FILL_ANSWERS = {
    9: "-1/2",
    10: "2(√2-1)",
    11: "(x-y)dx-dy",
    12: "1/3ρga^3",
    13: "1",
    14: "a^4-4a^2",
}

SHORT_ANSWERS = {
    15: "斜渐近线方程为 y=x/e+1/(2e)。",
    16: "g'(x)=∫_0^1 tf'(xt)dt，且 g'(x) 在 x=0 处连续。",
    17: "极值点包括 (0,0) 和 (1/3,-1/3)；完整极值判定见答案原页。",
    18: "f(x)=x/sqrt(1+x^2)，旋转体体积为 π^2/6。",
    19: "二重积分值为 3√2/4+3/4 ln(√2+1)。",
    20: "存在 ξ∈(1,2) 使 f(ξ)=(2-ξ)e^(ξ^2)；存在 η∈(1,2) 使 f(2)=ln2·ηe^(η^2)。",
    21: "曲线方程为 y=Cx^(3/2)，C>0。",
    22: "a=-4；可逆矩阵 P 的构造见答案原页。",
    23: "P 可逆；P^(-1)AP 的矩阵见答案原页，A 的特征值为 2 和 -3，因此 A 可相似对角化。",
}

# crop_id -> (source page, x offset, y offset, width, height), measured on 130dpi renders.
QUESTION_CROPS: dict[str, tuple[int, int, int, int, int]] = {
    "01": (2, 130, 170, 820, 250),
    "02": (2, 130, 420, 820, 200),
    "03": (2, 130, 610, 820, 220),
    "04": (2, 130, 830, 820, 200),
    "05-a": (2, 130, 1015, 820, 360),
    "05-b": (3, 130, 130, 820, 240),
    "06": (3, 130, 360, 820, 185),
    "07": (3, 130, 545, 820, 280),
    "08": (3, 130, 815, 820, 250),
    "09": (3, 130, 1070, 820, 130),
    "10": (3, 130, 1205, 820, 105),
    "11": (3, 130, 1315, 820, 115),
    "12": (4, 130, 130, 820, 110),
    "13": (4, 130, 240, 820, 100),
    "14": (4, 130, 340, 820, 175),
    "15": (4, 130, 535, 820, 120),
    "16": (4, 130, 655, 820, 110),
    "17": (4, 130, 770, 820, 85),
    "18": (4, 130, 855, 820, 65),
    "19": (4, 130, 925, 820, 95),
    "20": (4, 130, 1010, 820, 165),
    "21": (4, 130, 1015, 820, 110),
    "22": (4, 130, 1090, 820, 260),
    "23-a": (4, 130, 1360, 820, 50),
    "23-b": (5, 130, 120, 820, 165),
}

QUESTION_IMAGES: dict[int, list[str]] = {
    1: ["01"],
    2: ["02"],
    3: ["03"],
    4: ["04"],
    5: ["05-a", "05-b"],
    6: ["06"],
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
    23: ["23-a", "23-b"],
}

ANSWER_PAGES = {
    1: [6],
    2: [6, 7],
    3: [7],
    4: [7],
    5: [8],
    6: [8],
    7: [9],
    8: [9],
    9: [9],
    10: [10],
    11: [10],
    12: [10],
    13: [10, 11],
    14: [11],
    15: [11],
    16: [11, 12],
    17: [12],
    18: [13],
    19: [13],
    20: [13, 14],
    21: [14],
    22: [15],
    23: [16],
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
            rendered = TMP_RENDER_DIR / f"{prefix}-{page}.jpg"
        if not rendered.exists():
            raise FileNotFoundError(rendered)
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def crop_assets(*, asset_dir: Path, force: bool) -> None:
    asset_dir.mkdir(parents=True, exist_ok=True)
    if force:
        for stale in asset_dir.glob("question-*.jpg"):
            stale.unlink()
        for stale in asset_dir.glob("answer-page-*.jpg"):
            stale.unlink()

    for crop_id, (page, x_offset, y_offset, width, height) in QUESTION_CROPS.items():
        source = asset_dir / f"paper-page-{page:02d}.jpg"
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
                f"crop={width}:{height}:{x_offset}:{y_offset}",
                str(target),
            ]
        )

    for page in range(6, 17):
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
                "crop=950:1280:60:105",
                str(target),
            ]
        )


def question_image_ref(crop_id: str) -> dict[str, str]:
    return {
        "src": f"question-bank/math2-2020/question-{crop_id}.jpg",
        "caption": f"题面裁切图 q{crop_id}",
        "alt": f"2020考研数学二第{crop_id.split('-')[0]}题题面裁切图",
    }


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/math2-2020/answer-page-{page:02d}.jpg",
        "caption": f"答案解析 p.{page}",
        "alt": f"2020考研数学二答案解析 p.{page}",
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
    return f"2020考研数学二第{number}题（{section_for(number)}）。题干、公式和图形以题面裁切图为准。"


def explanation_for(number: int) -> str:
    if number <= 8:
        return "答案来自本地百度网盘 2020 数学二真题 PDF；选择题解析见答案原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2020 数学二真题 PDF；完整题干、公式和解析见原页图。"
    return "答案来自本地百度网盘 2020 数学二真题 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math2-2020-q{number:02d}",
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
        "id": f"math2-2020-{number:03d}",
        "number": number,
        "paperId": "math2-2020",
        "paperName": "2020考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2020",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": [question_image_ref(crop_id) for crop_id in QUESTION_IMAGES[number]],
        "answerImages": [answer_image_ref(page) for page in ANSWER_PAGES[number]],
        "tags": ["math2", "2020", section_for(number)],
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
            relative = str(image.get("src", "")).removeprefix("question-bank/math2-2020/")
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
        raise ValueError("math2-2020 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "paper-page", asset_dir=asset_dir, force=force_assets, pages=set(range(2, 17)))
    crop_assets(asset_dir=asset_dir, force=force_assets)
    for raw_page in asset_dir.glob("paper-page-*.jpg"):
        raw_page.unlink()
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards, asset_dir=asset_dir)

    return {
        "id": "math2-2020",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math2-2020",
        "paperName": "2020考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2020",
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
                "evidenceNote": "The 16-page scanned source has no usable text layer. Page 1 is cover/instructions, pages 2-5 are question pages, and pages 6-16 are answer-analysis pages. Published assets crop out the recurring page header/footer promotion while preserving question and answer evidence.",
            },
        ],
        "assetRoot": "question-bank/math2-2020",
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
