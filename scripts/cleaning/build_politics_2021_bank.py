#!/usr/bin/env python3
"""
Build the 2021 Politics public-course bank from local Baidu Netdisk PDFs.

The standalone paper PDF defines the user-visible question pages and option
order. The paper-answer PDF is scanned, so release evidence stays as rendered
PDF page images; OCR is used only to locate answer pages. Several answer-PDF
choice blocks reorder options, so answer keys below are mapped back to the
standalone paper PDF letters.
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
SOURCE_PAPER_PDF = (
    PROJECT_ROOT
    / "data"
    / "raw-inbox"
    / "public-course-history"
    / "politics"
    / "2021"
    / "2021-politics-paper.pdf"
)
SOURCE_ANSWER_PDF = (
    PROJECT_ROOT
    / "data"
    / "raw-inbox"
    / "public-course-history"
    / "politics"
    / "2021"
    / "2021-politics-paper-answer.pdf"
)
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "politics-2021.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "politics-2021"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "politics-2021-release-assets"

PAPER_ID = "politics-2021"
PAPER_SOURCE_EVIDENCE_ID = "politics-2021-paper"
ANSWER_SOURCE_EVIDENCE_ID = "politics-2021-paper-answer"
PAPER_SOURCE_MANIFEST_ID = "src_88c0d6500b6ecf15d237f76b"
ANSWER_SOURCE_MANIFEST_ID = "src_a6fd115071cc943f911cf82e"

SINGLE_ANSWERS = {
    1: "A",
    2: "B",
    3: "C",
    4: "B",
    5: "A",
    6: "C",
    7: "C",
    8: "A",
    9: "C",
    10: "D",
    11: "D",
    12: "C",
    13: "B",
    14: "C",
    15: "B",
    16: "D",
}

MULTI_ANSWERS = {
    17: "AD",
    18: "CD",
    19: "AB",
    20: "ACD",
    21: "ABCD",
    22: "BCD",
    23: "ABC",
    24: "ABCD",
    25: "ABC",
    26: "ABCD",
    27: "AC",
    28: "ABC",
    29: "ABCD",
    30: "ABCD",
    31: "ABC",
    32: "ABCD",
    33: "ACD",
}

ANALYSIS_ANSWERS = {
    34: "分析题参考答案要点见答案原页 p.14-p.15。",
    35: "分析题参考答案要点见答案原页 p.15-p.17。",
    36: "分析题参考答案要点见答案原页 p.17-p.18。",
    37: "分析题参考答案要点见答案原页 p.18-p.19。",
    38: "分析题参考答案要点见答案原页 p.19-p.20。",
}

QUESTION_PAGES = {
    **{number: [1] for number in range(1, 7)},
    **{number: [2] for number in range(7, 13)},
    **{number: [3] for number in range(13, 19)},
    **{number: [4] for number in range(19, 26)},
    **{number: [5] for number in range(26, 32)},
    **{number: [6] for number in range(32, 35)},
    35: [7],
    36: [8],
    37: [9],
    38: [10],
}

ANSWER_PAGES = {
    1: [1],
    2: [1],
    3: [2],
    4: [2],
    5: [2, 3],
    6: [3],
    7: [3],
    8: [3, 4],
    9: [4],
    10: [4],
    11: [4, 5],
    12: [5],
    13: [5, 6],
    14: [6],
    15: [6],
    16: [7],
    17: [7],
    18: [7, 8],
    19: [8],
    20: [8, 9],
    21: [9],
    22: [9],
    23: [9, 10],
    24: [10],
    25: [10, 11],
    26: [11],
    27: [11],
    28: [11, 12],
    29: [12],
    30: [12, 13],
    31: [13],
    32: [13, 14],
    33: [14],
    34: [14, 15],
    35: [15, 16, 17],
    36: [17, 18],
    37: [18, 19],
    38: [19, 20],
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


def render_pdf_assets(pdf: Path, *, asset_dir: Path, prefix: str, expected_pages: int, force: bool) -> None:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = sorted(asset_dir.glob(f"{prefix}-*.jpg"))
    if len(expected) >= expected_pages and not force:
        return

    render_dir = TMP_RENDER_DIR / prefix
    render_dir.mkdir(parents=True, exist_ok=True)
    for item in render_dir.glob("page-*.jpg"):
        item.unlink()

    output_prefix = render_dir / "page"
    run(["pdftoppm", "-r", "160", "-jpeg", "-jpegopt", "quality=76", str(pdf), str(output_prefix)])

    rendered_pages = sorted(render_dir.glob("page-*.jpg"), key=lambda path: int(path.stem.split("-")[-1]))
    if len(rendered_pages) != expected_pages:
        raise ValueError(f"{pdf.name}: rendered {len(rendered_pages)} pages, expected {expected_pages}")
    for index, rendered in enumerate(rendered_pages, start=1):
        target = asset_dir / f"{prefix}-{index:02d}.jpg"
        shutil.copyfile(rendered, target)


def render_all_assets(*, asset_dir: Path, force: bool) -> None:
    render_pdf_assets(SOURCE_PAPER_PDF, asset_dir=asset_dir, prefix="paper-page", expected_pages=10, force=force)
    render_pdf_assets(SOURCE_ANSWER_PDF, asset_dir=asset_dir, prefix="answer-page", expected_pages=20, force=force)


def image_ref(page: int, *, prefix: str, caption: str) -> dict[str, str]:
    return {
        "src": f"question-bank/politics-2021/{prefix}-{page:02d}.jpg",
        "caption": caption,
        "alt": f"2021考研政治{caption}",
    }


def section_for(number: int) -> str:
    if number <= 16:
        return "单项选择"
    if number <= 33:
        return "多项选择"
    return "分析题"


def type_for(number: int) -> str:
    if number <= 16:
        return "single_choice"
    if number <= 33:
        return "multi_choice"
    return "analysis"


def answer_for(number: int) -> str:
    if number in SINGLE_ANSWERS:
        return SINGLE_ANSWERS[number]
    if number in MULTI_ANSWERS:
        return MULTI_ANSWERS[number]
    return ANALYSIS_ANSWERS[number]


def options_for(number: int) -> list[dict[str, str]]:
    if number > 33:
        return []
    return [{"label": label, "text": label} for label in "ABCD"]


def question_anchor(number: int) -> str:
    section = section_for(number)
    return f"2021考研政治第{number}题（{section}）。题干、选项和材料以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number <= 33:
        return (
            "答案来自本地百度网盘 2021 考研政治真题及解析 PDF 第 1-14 页逐题解析；"
            "部分解析页选项顺序与试卷 PDF 不一致，题库已按选项内容映射回试卷原页字母。"
        )
    return "参考答案来自本地百度网盘 2021 考研政治真题及解析 PDF；完整答案要点见答案原页图。"


def evidence(number: int, question_hash: str, answer_hash: str) -> dict[str, str]:
    return {
        "evidenceId": f"politics-2021-q{number:02d}",
        "sourceId": PAPER_SOURCE_MANIFEST_ID,
        "answerSourceId": ANSWER_SOURCE_MANIFEST_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "paper_answer_page_image",
        "sourceEvidenceId": ANSWER_SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
    }


def answer_evidence(number: int, answer_hash: str) -> dict[str, str]:
    return {
        "status": "matched",
        "evidenceRole": "official_answer_key" if number <= 33 else "official_reference_answer",
        "sourceId": ANSWER_SOURCE_MANIFEST_ID,
        "sourceFilePath": str(SOURCE_ANSWER_PDF.relative_to(PROJECT_ROOT)),
        "answerTextHash": answer_hash,
        "method": "local_pdf_ocr_located_page_image_with_option_order_mapping",
        "verifiedBy": "build_politics_2021_bank",
        "note": (
            "Matched against local Baidu Netdisk 2021 Politics paper-answer PDF and mapped to the "
            "standalone paper PDF option order when the answer PDF reordered options."
        ),
    }


def build_card(number: int) -> dict[str, Any]:
    question = question_anchor(number)
    answer = answer_for(number)
    options = options_for(number)
    question_pages = QUESTION_PAGES[number]
    answer_pages = ANSWER_PAGES[number]
    question_images = [image_ref(page, prefix="paper-page", caption=f"试卷原页 p.{page}") for page in question_pages]
    answer_images = [image_ref(page, prefix="answer-page", caption=f"答案原页 p.{page}") for page in answer_pages]
    question_hash = sha256_text(
        json.dumps(
            {"question": question, "options": options, "questionPages": question_pages},
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    answer_hash = sha256_text(
        json.dumps(
            {"answer": answer, "answerPages": answer_pages},
            ensure_ascii=False,
            sort_keys=True,
        )
    )

    return {
        "id": f"{PAPER_ID}-{number:03d}",
        "number": number,
        "paperId": PAPER_ID,
        "paperName": "2021考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2021",
        "section": section_for(number),
        "type": type_for(number),
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["politics", "2021", section_for(number)],
        "difficulty": 3 if number > 33 else 2,
        "source": ANSWER_SOURCE_EVIDENCE_ID,
        "sourceEvidenceId": ANSWER_SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": evidence(number, question_hash, answer_hash),
        "answerEvidence": answer_evidence(number, answer_hash),
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
        if card_type in {"single_choice", "multi_choice"}:
            labels = [option.get("label") for option in card.get("options", [])]
            if labels != ["A", "B", "C", "D"]:
                issues.append(f"card {expected_number}: invalid options {labels}")
        if not card.get("questionImages"):
            issues.append(f"card {expected_number}: missing question page images")
        if not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing answer page images")

    expected_counts = {"single_choice": 16, "multi_choice": 17, "analysis": 5}
    if len(cards) != 38:
        issues.append(f"card count {len(cards)} != 38")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if issues:
        raise ValueError("politics-2021 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_all_assets(asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 39)]
    validate_cards(cards)

    return {
        "id": PAPER_ID,
        "source": ANSWER_SOURCE_EVIDENCE_ID,
        "paperId": PAPER_ID,
        "paperName": "2021考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2021",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_page_image_v1",
        "sourceFiles": [
            {
                "id": PAPER_SOURCE_EVIDENCE_ID,
                "sourceId": PAPER_SOURCE_MANIFEST_ID,
                "role": "paper",
                "localPath": str(SOURCE_PAPER_PDF.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(SOURCE_PAPER_PDF),
            },
            {
                "id": ANSWER_SOURCE_EVIDENCE_ID,
                "sourceId": ANSWER_SOURCE_MANIFEST_ID,
                "role": "paper_answer",
                "localPath": str(SOURCE_ANSWER_PDF.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(SOURCE_ANSWER_PDF),
            },
        ],
        "sourceNotes": [
            "The 2021 standalone paper PDF provides the release question pages and user-visible option order. The scanned paper-answer PDF contains per-question choice answers on pages 1-14 and analysis answer points on pages 14-20; OCR was used only to locate those pages while final release evidence remains rendered PDF page images. Several answer-PDF choice blocks reorder options relative to the standalone paper, so choice answers were mapped by option content back to the paper PDF letters.",
        ],
        "assetRoot": "question-bank/politics-2021",
        "processed_at": utc_now(),
        "total_cards": len(cards),
        "sections": ["单项选择", "多项选择", "分析题"],
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
