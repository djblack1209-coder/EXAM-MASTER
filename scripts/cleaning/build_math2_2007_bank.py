#!/usr/bin/env python3
"""
Build the 2007 Math II public-course bank from the local Baidu Netdisk PDF.

The source is a scanned paper-answer PDF without a reliable text layer. The
generated cards keep question and answer evidence as rendered PDF page images.
OCR is only used outside this builder to confirm answer keys and page anchors.
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
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-history" / "math2" / "2007"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math2-2007.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math2-2007"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math2-2007-release-assets"

PAPER_ANSWER = RAW_DIR / "2007-math2-paper-answer.pdf"

SOURCE_IDS = {
    "paper_answer": "math2-2007-paper-answer",
}

PAPER_SOURCE_ID = "src_f0f8160e46a5244d4ee0b125"

CHOICE_ANSWERS = {
    1: "B",
    2: "A",
    3: "C",
    4: "D",
    5: "D",
    6: "D",
    7: "C",
    8: "B",
    9: "A",
    10: "B",
}

FILL_ANSWERS = {
    11: "-1/6",
    12: "1 + sqrt(2)",
    13: "(-1)^n 2^n n! / 3^(n+1)",
    14: "C1e^x + C2e^{3x} - 2e^{2x}",
    15: "2(-y/x f'_1 + x/y f'_2)",
    16: "1",
}

SHORT_ANSWERS = {
    17: "f(x)=ln|sin x + cos x|，x in [0, pi/3]。",
    18: "V(a)=pi a/(ln a)^2；a=e 时体积最小，最小值为 pi e。",
    19: "满足初始条件的特解为 y = 2/3 x^(3/2) + 1/3。",
    20: "z_x|_(0,1)=0，z_xx|_(0,1)=1。",
    21: "令 phi(x)=f(x)-g(x)，由最大值条件与 Rolle 定理证明存在 xi 使 f''(xi)=g''(xi)。",
    22: "二重积分值为 1/7 + 2sqrt(2) ln(3+2sqrt(2))。",
    23: "a=1 时公共解为 k(1,0,-1)^T；a=2 时公共解为 (0,1,-1)^T。",
    24: "B 的特征值为 -2,1,1；矩阵 B 的具体结果见答案原页。",
}

QUESTION_PAGES = {
    **{number: [1] for number in range(1, 5)},
    **{number: [2] for number in range(5, 11)},
    **{number: [3] for number in range(11, 17)},
    17: [3],
    18: [3],
    19: [3],
    20: [3, 4],
    21: [4],
    22: [4],
    23: [4],
    24: [4],
}

ANSWER_PAGES = {
    1: [5],
    2: [6],
    3: [6],
    4: [7],
    5: [7, 8],
    6: [8],
    7: [8, 9],
    8: [9],
    9: [9, 10, 11],
    10: [11],
    11: [12],
    12: [12],
    13: [12],
    14: [12, 13],
    15: [13],
    16: [13],
    17: [14],
    18: [14],
    19: [14, 15],
    20: [15, 16],
    21: [16, 17],
    22: [17],
    23: [18, 19],
    24: [19, 20, 21, 22],
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


def image_ref(kind: str, page: int, *, caption: str) -> dict[str, str]:
    file_name = f"{kind}-{page:02d}.jpg"
    return {
        "src": f"question-bank/math2-2007/{file_name}",
        "caption": caption,
        "alt": f"2007考研数学二{caption}",
    }


def section_for(number: int) -> str:
    if number <= 10:
        return "选择题"
    if number <= 16:
        return "填空题"
    return "解答题"


def type_for(number: int) -> str:
    if 1 <= number <= 10:
        return "single_choice"
    return "short_answer"


def answer_for(number: int) -> str:
    if number in FILL_ANSWERS:
        return FILL_ANSWERS[number]
    if number in CHOICE_ANSWERS:
        return CHOICE_ANSWERS[number]
    return SHORT_ANSWERS[number]


def question_anchor(number: int) -> str:
    return f"2007考研数学二第{number}题（{section_for(number)}）。题干、公式和图形以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number <= 10:
        return "答案来自本地百度网盘 2007 数学二真题及解析 PDF；选择题解析见答案原页图。"
    if number <= 16:
        return "答案来自本地百度网盘 2007 数学二真题及解析 PDF；完整题干和公式见试卷原页图。"
    return "答案来自本地百度网盘 2007 数学二真题及解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math2-2007-q{number:02d}",
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

    question_images = [image_ref("paper-page", page, caption=f"试卷原页 p.{page}") for page in QUESTION_PAGES[number]]
    answer_images = [image_ref("answer-page", page, caption=f"答案解析 p.{page}") for page in ANSWER_PAGES[number]]

    return {
        "id": f"math2-2007-{number:03d}",
        "number": number,
        "paperId": "math2-2007",
        "paperName": "2007考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2007",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["math2", "2007", section_for(number)],
        "difficulty": 3 if number >= 17 else 2,
        "sourceEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": source_evidence(number, answer_hash),
    }


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "paper-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 5)))
    render_pdf_assets(PAPER_ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets, pages=set(range(5, 23)))
    cards = [build_card(number) for number in range(1, 25)]

    return {
        "id": "math2-2007",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math2-2007",
        "paperName": "2007考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2007",
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
            }
        ],
        "assetRoot": "question-bank/math2-2007",
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
