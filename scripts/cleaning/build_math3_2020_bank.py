#!/usr/bin/env python3
"""
Build the 2020 Math III public-course bank from the local Baidu Netdisk PDF.

The source is a scanned PDF: pages 1-5 are the paper and pages 6-18 are answer
analysis. The builder renders page images and crops question prompts from the
paper pages so learners never see answer analysis before reviewing a card.
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math3-2020.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math3-2020"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math3-2020-release-assets"

PAPER_ANSWER = RAW_DIR / "src_5b15e18fa7b78e9d43c07840-2020年考研数学三真题及解析.pdf"

SOURCE_IDS = {
    "paper_answer": "math3-2020-paper-answer",
}

PAPER_SOURCE_ID = "src_5b15e18fa7b78e9d43c07840"

CHOICE_ANSWERS = {
    1: "B",
    2: "C",
    3: "A",
    4: "C",
    5: "C",
    6: "D",
    7: "D",
    8: "C",
}

FILL_ANSWERS = {
    9: "(π - 1)dx - dy",
    10: "y=x-1",
    11: "8",
    12: "π ln 2 - π/3",
    13: "a^4 - 4a^2",
    14: "8/7",
}

SHORT_ANSWERS = {
    15: "a=1，b=-e/2。",
    16: "极小点为 (1/6, 1/12)，极小值为 -1/216；(0,0) 不是极值点。",
    17: "f(x)=e^(-x)cos2x；sum a_n = 1/[5(e^π-1)]。",
    18: "∫∫_D x f(x,y) dxdy = 3π^2/128。",
    19: "两项证明命题均成立；完整拉格朗日中值定理与积分估计证明见答案原页。",
    20: "a=4，b=1；Q=1/5[[4,-3],[-3,-4]]。",
    21: "P 可逆；P^(-1)AP=[[0,6],[1,-1]]；A 可相似对角化。",
    22: "联合分布 P(0,0)=1/4，P(0,1)=1/2，P(1,0)=0，P(1,1)=1/4；相关系数为 1/3。",
    23: "P{T>t}=exp[-(t/θ)^m]；P{T>s+t|T>s}=exp[-((s+t)^m-s^m)/θ^m]；θ_hat=(n^-1 sum(t_i^m))^(1/m)。",
}

QUESTION_CROPS: dict[str, tuple[str, int, int, int]] = {
    "01": ("paper", 2, 205, 205),
    "02": ("paper", 2, 410, 180),
    "03": ("paper", 2, 575, 350),
    "04": ("paper", 2, 925, 225),
    "05": ("paper", 2, 1145, 255),
    "06-a": ("paper", 2, 1360, 90),
    "06-b": ("paper", 3, 100, 250),
    "07": ("paper", 3, 350, 245),
    "08": ("paper", 3, 625, 305),
    "09": ("paper", 3, 930, 80),
    "10": ("paper", 3, 1010, 80),
    "11": ("paper", 3, 1090, 175),
    "12": ("paper", 3, 1265, 185),
    "13": ("paper", 4, 145, 235),
    "14": ("paper", 4, 410, 165),
    "15": ("paper", 4, 605, 95),
    "16": ("paper", 4, 700, 70),
    "17": ("paper", 4, 770, 200),
    "18": ("paper", 4, 975, 250),
    "19": ("paper", 4, 965, 210),
    "20": ("paper", 4, 1165, 360),
    "21": ("paper", 5, 135, 280),
    "22": ("paper", 5, 415, 315),
    "23": ("paper", 5, 730, 335),
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
    2: [1, 2],
    3: [2],
    4: [2],
    5: [3],
    6: [3],
    7: [4],
    8: [4, 5],
    9: [5],
    10: [5],
    11: [5],
    12: [6],
    13: [6],
    14: [6, 7],
    15: [7],
    16: [7],
    17: [8],
    18: [8, 9],
    19: [9, 10],
    20: [10],
    21: [10, 11],
    22: [11, 12],
    23: [12, 13],
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

    for source_page, target_index in sorted(pages_map(prefix).items()):
        if target_index not in pages:
            continue
        rendered = TMP_RENDER_DIR / f"{prefix}-{source_page:02d}.jpg"
        if not rendered.exists():
            raise FileNotFoundError(rendered)
        target = asset_dir / f"{prefix}-{target_index:02d}.jpg"
        shutil.copyfile(rendered, target)


def pages_map(prefix: str) -> dict[int, int]:
    if prefix == "paper-page":
        return {page: page for page in range(1, 6)}
    if prefix == "answer-page":
        return {source_page: source_page - 5 for source_page in range(6, 19)}
    raise ValueError(f"unsupported prefix: {prefix}")


def crop_question_assets(*, asset_dir: Path, force: bool) -> None:
    asset_dir.mkdir(parents=True, exist_ok=True)
    if force:
        for stale in asset_dir.glob("question-*.jpg"):
            stale.unlink()
    for crop_id, (source_kind, page, y_offset, height) in QUESTION_CROPS.items():
        source = asset_dir / f"{source_kind}-page-{page:02d}.jpg"
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
        "src": f"question-bank/math3-2020/question-{crop_id}.jpg",
        "caption": f"题面裁切图 q{crop_id}",
        "alt": f"2020考研数学三第{crop_id.split('-')[0]}题题面裁切图",
    }


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/math3-2020/answer-page-{page:02d}.jpg",
        "caption": f"答案解析 p.{page}",
        "alt": f"2020考研数学三答案解析 p.{page}",
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
    return f"2020考研数学三第{number}题（{section_for(number)}）。题干、公式和图形以题面裁切图为准。"


def explanation_for(number: int) -> str:
    if number <= 8:
        return "答案来自本地百度网盘 2020 数学三真题及解析 PDF；选择题解析见答案原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2020 数学三真题及解析 PDF；完整题干、公式和解析见原页图。"
    return "答案来自本地百度网盘 2020 数学三真题及解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math3-2020-q{number:02d}",
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
        "id": f"math3-2020-{number:03d}",
        "number": number,
        "paperId": "math3-2020",
        "paperName": "2020考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2020",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": [question_image_ref(crop_id) for crop_id in QUESTION_IMAGES[number]],
        "answerImages": [answer_image_ref(page) for page in ANSWER_PAGES[number]],
        "tags": ["math3", "2020", section_for(number)],
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
            relative = str(image.get("src", "")).removeprefix("question-bank/math3-2020/")
            if relative and not (asset_dir / relative).exists():
                issues.append(f"card {expected_number}: missing asset {relative}")
            if relative.startswith("paper-page"):
                issues.append(f"card {expected_number}: paper-page referenced as review evidence {relative}")
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
        raise ValueError("math3-2020 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "paper-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 6)))
    render_pdf_assets(PAPER_ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 14)))
    crop_question_assets(asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards, asset_dir=asset_dir)

    return {
        "id": "math3-2020",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math3-2020",
        "paperName": "2020考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2020",
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
                "evidenceNote": "The 18-page source has paper pages 1-5 and answer-analysis pages 6-18; question prompts are cropped from paper pages only.",
            },
        ],
        "assetRoot": "question-bank/math3-2020",
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
