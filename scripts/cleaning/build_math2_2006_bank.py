#!/usr/bin/env python3
"""
Build the 2006 Math II public-course bank from the local Baidu Netdisk PDF.

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
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-history" / "math2" / "2006"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math2-2006.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math2-2006"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math2-2006-release-assets"

PAPER_ANSWER = RAW_DIR / "2006-math2-paper-answer.pdf"

SOURCE_IDS = {
    "paper_answer": "math2-2006-paper-answer",
}

PAPER_SOURCE_ID = "src_f49c2de9b3f582d17eea5654"

FILL_ANSWERS = {
    1: "y = 1/5",
    2: "a = 1/3",
    3: "1/2",
    4: "y = Cxe^{-x} (x != 0)",
    5: "-e",
    6: "2",
}

CHOICE_ANSWERS = {
    7: "A",
    8: "B",
    9: "C",
    10: "D",
    11: "C",
    12: "D",
    13: "A",
    14: "B",
}

SHORT_ANSWERS = {
    15: "A = 1/3, B = -2/3, C = 1/6.",
    16: "-e^{-x}arcsin(e^x) + 1/2 ln |(sqrt(1 - e^{2x}) - 1) / (sqrt(1 - e^{2x}) + 1)| + C.",
    17: "二重积分值为 pi ln 2 / 2。",
    18: "lim x_n = 0；lim (x_{n+1}/x_n)^{1/x_n^2} = e^{-1/6}。",
    19: "利用辅助函数证明不等式；完整证明见答案原页。",
    20: "f(u) = ln u。",
    21: "曲线 L 凸；切点为 (2,3)，切线方程为 y = x + 1，面积 S = 7/3。",
    22: "r(A)=2；a=2，b=-3；通解为 k1(-2,1,1,0)^T + k2(4,-5,0,1)^T + (2,-3,0,0)^T。",
    23: "特征值为 3,0,0；Q 的列向量可取 (1/sqrt(3),1/sqrt(3),1/sqrt(3))^T、(-1/sqrt(6),2/sqrt(6),-1/sqrt(6))^T、(-1/sqrt(2),0,1/sqrt(2))^T，对角矩阵为 diag(3,0,0)。",
}

QUESTION_PAGES = {
    1: [1],
    2: [1],
    3: [1],
    4: [1, 2],
    5: [2],
    6: [2],
    7: [2, 3],
    8: [3],
    9: [3],
    10: [3, 4],
    11: [4],
    12: [4, 5],
    13: [5],
    14: [5, 6],
    15: [6, 7],
    16: [7],
    17: [7, 8],
    18: [8, 9],
    19: [9],
    20: [9, 10],
    21: [10, 11],
    22: [11, 12, 13],
    23: [13, 14],
}

ANSWER_PAGES = {
    1: [1],
    2: [1],
    3: [1],
    4: [1, 2],
    5: [2],
    6: [2],
    7: [3],
    8: [3],
    9: [3],
    10: [4],
    11: [4],
    12: [5],
    13: [5],
    14: [6],
    15: [6, 7],
    16: [7],
    17: [7, 8],
    18: [8, 9],
    19: [9],
    20: [9, 10],
    21: [10, 11],
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
        "src": f"question-bank/math2-2006/{file_name}",
        "caption": caption,
        "alt": f"2006考研数学二{caption}",
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
    return f"2006考研数学二第{number}题（{section_for(number)}）。题干、公式和图形以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number <= 6:
        return "答案来自本地百度网盘 2006 数学二真题及解析 PDF；完整题干和公式见试卷原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2006 数学二真题及解析 PDF；选择题解析见答案原页图。"
    return "答案来自本地百度网盘 2006 数学二真题及解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math2-2006-q{number:02d}",
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
        "id": f"math2-2006-{number:03d}",
        "number": number,
        "paperId": "math2-2006",
        "paperName": "2006考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2006",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["math2", "2006", section_for(number)],
        "difficulty": 3 if number >= 15 else 2,
        "sourceEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": source_evidence(number, answer_hash),
    }


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "paper-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 15)))
    render_pdf_assets(PAPER_ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 15)))
    cards = [build_card(number) for number in range(1, 24)]

    return {
        "id": "math2-2006",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math2-2006",
        "paperName": "2006考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2006",
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
        "assetRoot": "question-bank/math2-2006",
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
