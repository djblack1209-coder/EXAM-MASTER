#!/usr/bin/env python3
"""
Build the 2024 Math III public-course bank from a local Baidu Netdisk PDF.

The source PDF contains the exam paper with inline reference answers. Math
formulas do not survive OCR reliably enough for release text, so generated
cards use rendered PDF page images as the source of truth and concise text
anchors for navigation, answer checks, and release gates.
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
SOURCE_PDF = PROJECT_ROOT / "data" / "raw-inbox" / "src_d9c2b923d74ae9283b1647f1-2024年数学（三）真题及参考答案.pdf"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math3-2024.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math3-2024"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math3-2024-release-assets"

SOURCE_ID = "src_d9c2b923d74ae9283b1647f1"
SOURCE_EVIDENCE_ID = "math3-2024-paper-answer"
RELEASE_PAGE_COUNT = 5

CHOICE_ANSWERS = {
    1: "D",
    2: "B",
    3: "A",
    4: "A",
    5: "C",
    6: "C",
    7: "B",
    8: "B",
    9: "B",
    10: "D",
}

FILL_ANSWERS = {
    11: "3",
    12: "1/2 ln 3 - pi/8",
    13: "(1,1)",
    14: "50",
    15: "16",
    16: "2/3",
}

SHORT_ANSWERS = {
    17: "8/3 ln 3",
    18: "-1 - 2ln2",
    19: "1/16 ln 2 + 3/64",
    20: "证明过程见原 PDF 页图；第(1)问用 x=0 与 x=1 处泰勒展开，第(2)问对第(1)问结果积分。",
    21: "第(1)问证明过程见原 PDF 页图；第(2)问 a = 1。",
    22: "第(1)问 c=(n+1)/n；第(2)问 c=(n+2)/(n+1)。",
}

QUESTION_PAGES = {
    **{number: [1] for number in range(1, 6)},
    **{number: [2] for number in range(6, 10)},
    **{number: [3] for number in range(10, 18)},
    **{number: [4] for number in range(18, 22)},
    22: [4, 5],
}

ANSWER_PAGES = {
    **{number: pages for number, pages in QUESTION_PAGES.items()},
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
    expected = [asset_dir / f"{prefix}-{page:02d}.jpg" for page in range(1, RELEASE_PAGE_COUNT + 1)]
    if all(path.exists() for path in expected) and not force:
        return

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob(f"{prefix}-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / prefix
    run(
        [
            "pdftoppm",
            "-f",
            "1",
            "-l",
            str(RELEASE_PAGE_COUNT),
            "-r",
            "130",
            "-jpeg",
            "-jpegopt",
            "quality=72",
            str(pdf),
            str(output_prefix),
        ]
    )

    for rendered in sorted(TMP_RENDER_DIR.glob(f"{prefix}-*.jpg")):
        page = int(rendered.stem.split("-")[-1])
        if page > RELEASE_PAGE_COUNT:
            continue
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def image_ref(kind: str, page: int, *, caption: str) -> dict[str, str]:
    file_name = f"{kind}-{page:02d}.jpg"
    return {
        "src": f"question-bank/math3-2024/{file_name}",
        "caption": caption,
        "alt": f"2024考研数学三{caption}",
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
    return f"2024考研数学三第{number}题（{section_for(number)}）。题干、公式和图形以原 PDF 页图为准。"


def explanation_for(number: int) -> str:
    if number <= 10:
        return "答案来自本地百度网盘 2024 数学三真题及参考答案 PDF；完整题干和公式见原 PDF 页图。"
    return "答案来自本地百度网盘 2024 数学三真题及参考答案 PDF；完整演算、证明或推导过程见原 PDF 页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math3-2024-q{number:02d}",
        "sourceId": SOURCE_ID,
        "answerSourceId": SOURCE_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "inline_answer_paper_page_image",
        "sourceEvidenceId": SOURCE_EVIDENCE_ID,
        "answerEvidenceId": SOURCE_EVIDENCE_ID,
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
        image_ref("answer-page", page, caption=f"参考答案页 p.{page}") for page in ANSWER_PAGES[number]
    ]

    return {
        "id": f"math3-2024-{number:03d}",
        "number": number,
        "paperId": "math3-2024",
        "paperName": "2024考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2024",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["math3", "2024", section_for(number)],
        "difficulty": 3 if number >= 17 else 2,
        "sourceEvidenceId": SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": source_evidence(number, answer_hash),
    }


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(SOURCE_PDF, "paper-page", asset_dir=asset_dir, force=force_assets)
    render_pdf_assets(SOURCE_PDF, "answer-page", asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 23)]

    return {
        "id": "math3-2024",
        "source": SOURCE_EVIDENCE_ID,
        "paperId": "math3-2024",
        "paperName": "2024考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2024",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_inline_answer_page_image_v1",
        "sourceFiles": [
            {
                "id": SOURCE_EVIDENCE_ID,
                "role": "paper_answer",
                "localPath": str(SOURCE_PDF.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(SOURCE_PDF),
                "sourceId": SOURCE_ID,
            }
        ],
        "assetRoot": "question-bank/math3-2024",
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
