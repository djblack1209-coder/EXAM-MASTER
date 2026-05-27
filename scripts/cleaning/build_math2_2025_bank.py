#!/usr/bin/env python3
"""
Build the 2025 Math II public-course bank from local Baidu Netdisk PDFs.

Math formulas do not survive OCR reliably enough for release text, so the
generated cards keep the official paper and answer material as rendered PDF
page images. Text fields are concise anchors for navigation, grading, and
release gates.
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
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-2025" / "math2"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math2-2025.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math2-2025"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math2-2025-release-assets"

PAPER = RAW_DIR / "2025-math2-paper.pdf"
ANSWER = RAW_DIR / "2025-math2-answer-updating.pdf"

SOURCE_IDS = {
    "paper": "math2-2025-paper",
    "answer": "math2-2025-answer-updating",
}

PAPER_SOURCE_ID = "src_0a75a8a0befda5abbef10b57"
ANSWER_SOURCE_ID = "src_02af377a05fcfcde975d764f"

CHOICE_ANSWERS = {
    1: "A",
    2: "B",
    3: "C",
    4: "C",
    5: "A",
    6: "B",
    7: "B",
    8: "D",
    9: "B",
    10: "D",
}

FILL_ANSWERS = {
    11: "a = 2",
    12: "y = x",
    13: "-1/4",
    14: "2e",
    15: "2xy - 3/2 x^2 - 5/2 y^2 + 2 = 0",
    16: "k(1,1,-1,-1)^T + (1,0,0,4)^T，k 为任意常数",
}

SHORT_ANSWERS = {
    17: "完整解答见答案原页。",
    18: "完整证明与 f'(0) 求解见答案原页。",
    19: "完整二重积分计算见答案原页。",
    20: "完整单调性证明见答案原页。",
    21: "完整矩阵秩与线性方程组求解见答案原页。",
    22: "(1) a = 4, k > 0；(2) k = 3 时的正交矩阵 Q 见答案原页。",
}

QUESTION_PAGES = {
    **{number: [1] for number in range(1, 6)},
    **{number: [2] for number in range(6, 10)},
    **{number: [3] for number in range(10, 18)},
    **{number: [4] for number in range(18, 23)},
}

ANSWER_PAGES = {
    **{number: [7] for number in range(1, 4)},
    **{number: [8] for number in range(4, 7)},
    **{number: [9] for number in range(7, 10)},
    **{number: [10] for number in range(10, 14)},
    14: [11],
    15: [11],
    16: [11],
    17: [11],
    18: [12],
    19: [12],
    20: [13],
    21: [13],
    22: [14],
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


def render_pdf_assets(pdf: Path, prefix: str, *, asset_dir: Path, force: bool) -> None:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = sorted(asset_dir.glob(f"{prefix}-*.jpg"))
    if expected and not force:
        return

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob(f"{prefix}-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / prefix
    run(["pdftoppm", "-r", "130", "-jpeg", "-jpegopt", "quality=70", str(pdf), str(output_prefix)])

    for rendered in sorted(TMP_RENDER_DIR.glob(f"{prefix}-*.jpg")):
        page = int(rendered.stem.split("-")[-1])
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def image_ref(kind: str, page: int, *, caption: str) -> dict[str, str]:
    file_name = f"{kind}-{page:02d}.jpg"
    return {
        "src": f"question-bank/math2-2025/{file_name}",
        "caption": caption,
        "alt": f"2025考研数学二{caption}",
    }


def section_for(number: int) -> str:
    if number <= 10:
        return "选择题"
    if number <= 16:
        return "填空题"
    return "解答题"


def type_for(number: int) -> str:
    if number <= 10:
        return "single_choice"
    return "short_answer"


def answer_for(number: int) -> str:
    if number in CHOICE_ANSWERS:
        return CHOICE_ANSWERS[number]
    if number in FILL_ANSWERS:
        return FILL_ANSWERS[number]
    return SHORT_ANSWERS[number]


def question_anchor(number: int) -> str:
    return f"2025考研数学二第{number}题（{section_for(number)}）。题干、公式和图形以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number <= 10:
        return "答案来自本地百度网盘数学二参考答案 PDF；完整题干和公式见试卷原页图。"
    return "答案来自本地百度网盘数学二参考答案 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math2-2025-q{number:02d}",
        "sourceId": PAPER_SOURCE_ID,
        "answerSourceId": ANSWER_SOURCE_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "paper_answer_page_image",
        "sourceEvidenceId": SOURCE_IDS["paper"],
        "answerEvidenceId": SOURCE_IDS["answer"],
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
        image_ref("paper-page", page, caption=f"试卷原页 p.{page}") for page in QUESTION_PAGES[number]
    ]
    answer_images = [
        image_ref("answer-page", page, caption=f"答案解析 p.{page}") for page in ANSWER_PAGES[number]
    ]

    return {
        "id": f"math2-2025-{number:03d}",
        "number": number,
        "paperId": "math2-2025",
        "paperName": "2025考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2025",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["math2", "2025", section_for(number)],
        "difficulty": 3 if number >= 17 else 2,
        "sourceEvidenceId": SOURCE_IDS["paper"],
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": source_evidence(number, answer_hash),
    }


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER, "paper-page", asset_dir=asset_dir, force=force_assets)
    render_pdf_assets(ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 23)]

    return {
        "id": "math2-2025",
        "source": SOURCE_IDS["paper"],
        "paperId": "math2-2025",
        "paperName": "2025考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2025",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_page_image_v1",
        "sourceFiles": [
            {
                "id": SOURCE_IDS["paper"],
                "role": "paper",
                "localPath": str(PAPER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(PAPER),
            },
            {
                "id": SOURCE_IDS["answer"],
                "role": "answer",
                "localPath": str(ANSWER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(ANSWER),
            },
        ],
        "assetRoot": "question-bank/math2-2025",
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
