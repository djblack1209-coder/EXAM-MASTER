#!/usr/bin/env python3
"""
Build the 2010 Math III public-course bank from the local Baidu Netdisk PDF.

The source is a scanned paper-answer PDF without a usable text layer. Page 3
contains the tail of the paper and the start of the answers, so the generated
question evidence uses a cropped page image for questions 20-23.
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
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-history" / "math3" / "2010"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math3-2010.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math3-2010"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math3-2010-release-assets"

PAPER_ANSWER = RAW_DIR / "2010-math3-paper-answer.pdf"

SOURCE_IDS = {
    "paper_answer": "math3-2010-paper-answer",
}

PAPER_SOURCE_ID = "src_048d76159fa1b8887a9d78ba"

CHOICE_ANSWERS = {
    1: "C",
    2: "A",
    3: "B",
    4: "C",
    5: "A",
    6: "D",
    7: "C",
    8: "A",
}

FILL_ANSWERS = {
    9: "-1",
    10: "pi^2 / 4",
    11: "R(p) = p * e^((p^3 - 1) / 3)",
    12: "3",
    13: "3",
    14: "mu^2 + delta^2",
}

SHORT_ANSWERS = {
    15: "极限为 e^(-1)；完整指数化与等价无穷小计算见答案原页。",
    16: "二重积分值为 14/15。",
    17: "最大值为 5 sqrt(5)，最小值为 -5 sqrt(5)。",
    18: "积分大小比较与数列极限证明见答案原页；lim u_n = 0。",
    19: "存在性证明见答案原页。",
    20: "lambda = -1, a = -2；通解为 k(1,0,1)^T + (3/2,-1/2,0)^T。",
    21: "a = -1；正交矩阵 Q 与对角矩阵见答案原页。",
    22: "A = 1/pi；条件概率密度见答案原页。",
    23: "概率分布表见答案原页；Cov(X,Y) = -4/45。",
}

QUESTION_PAGES: dict[int, list[int | str]] = {
    **{number: [1] for number in range(1, 8)},
    **{number: [2] for number in range(8, 20)},
    **{number: ["03-question-crop"] for number in range(20, 24)},
}

ANSWER_PAGES = {
    1: [3],
    2: [3, 4],
    3: [4],
    4: [4, 5],
    5: [5],
    6: [5],
    7: [5],
    8: [5],
    9: [5, 6],
    10: [6],
    11: [6],
    12: [6],
    13: [6],
    14: [6, 7],
    15: [7],
    16: [7],
    17: [7, 8],
    18: [8, 9],
    19: [9],
    20: [9, 10],
    21: [10, 11],
    22: [11],
    23: [11, 12],
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


def crop_question_page_three(*, asset_dir: Path, force: bool) -> None:
    source = asset_dir / "paper-page-03.jpg"
    target = asset_dir / "paper-page-03-question-crop.jpg"
    if target.exists() and not force:
        return
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
            "crop=iw:940:0:0",
            str(target),
        ]
    )


def image_ref(kind: str, page: int | str, *, caption: str) -> dict[str, str]:
    file_name = f"{kind}-{page:02d}.jpg" if isinstance(page, int) else f"{kind}-{page}.jpg"
    return {
        "src": f"question-bank/math3-2010/{file_name}",
        "caption": caption,
        "alt": f"2010考研数学三{caption}",
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
    return f"2010考研数学三第{number}题（{section_for(number)}）。题干、公式和图形以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number <= 8:
        return "答案来自本地百度网盘 2010 数学三真题及解析 PDF；选择题解析见答案原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2010 数学三真题及解析 PDF；完整题干、公式和解析见原页图。"
    return "答案来自本地百度网盘 2010 数学三真题及解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math3-2010-q{number:02d}",
        "sourceId": PAPER_SOURCE_ID,
        "answerSourceId": PAPER_SOURCE_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "paper_answer_page_image",
        "sourceEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceStatus": "matched",
        "answerTextHash": answer_hash,
    }


def build_card(number: int) -> dict[str, Any]:
    question = question_anchor(number)
    answer = answer_for(number)
    question_hash = sha256_text(f"{question}|pages:{QUESTION_PAGES[number]}")
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

    question_images = [
        image_ref(
            "paper-page",
            page,
            caption="试卷原页 p.3（题面裁切）" if page == "03-question-crop" else f"试卷原页 p.{page}",
        )
        for page in QUESTION_PAGES[number]
    ]
    answer_images = [image_ref("answer-page", page, caption=f"答案解析 p.{page}") for page in ANSWER_PAGES[number]]

    return {
        "id": f"math3-2010-{number:03d}",
        "number": number,
        "paperId": "math3-2010",
        "paperName": "2010考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2010",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["math3", "2010", section_for(number)],
        "difficulty": 3 if number >= 15 else 2,
        "sourceEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": source_evidence(number, answer_hash),
    }


def validate_cards(cards: list[dict[str, Any]]) -> None:
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
        raise ValueError("math3-2010 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "paper-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 4)))
    crop_question_page_three(asset_dir=asset_dir, force=force_assets)
    render_pdf_assets(PAPER_ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets, pages=set(range(3, 13)))
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards)

    return {
        "id": "math3-2010",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math3-2010",
        "paperName": "2010考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2010",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_page_image_v1",
        "sourceFiles": [
            {
                "id": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": str(PAPER_ANSWER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(PAPER_ANSWER),
                "sourceId": PAPER_SOURCE_ID,
            },
        ],
        "assetRoot": "question-bank/math3-2010",
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
