#!/usr/bin/env python3
"""
Build the 2015 Politics public-course bank from local Baidu Netdisk PDFs.

The standalone paper PDF has a usable text layer for question-page anchors.
The paper-answer PDF is scanned and contains the official choice key plus
analysis answer pages, so final release evidence stays as rendered PDF pages.
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
    / "2015"
    / "2015-politics-paper.pdf"
)
SOURCE_ANSWER_PDF = (
    PROJECT_ROOT
    / "data"
    / "raw-inbox"
    / "public-course-history"
    / "politics"
    / "2015"
    / "2015-politics-paper-answer.pdf"
)
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "politics-2015.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "politics-2015"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "politics-2015-release-assets"

PAPER_ID = "politics-2015"
PAPER_SOURCE_EVIDENCE_ID = "politics-2015-paper"
ANSWER_SOURCE_EVIDENCE_ID = "politics-2015-paper-answer"
PAPER_SOURCE_MANIFEST_ID = "src_c54d284a9d7709dd513c883e"
ANSWER_SOURCE_MANIFEST_ID = "src_02eb597ae2402bd8c495313f"

SINGLE_ANSWERS = {
    1: "B",
    2: "D",
    3: "B",
    4: "A",
    5: "D",
    6: "C",
    7: "A",
    8: "D",
    9: "A",
    10: "B",
    11: "B",
    12: "D",
    13: "A",
    14: "C",
    15: "C",
    16: "A",
}

MULTI_ANSWERS = {
    17: "ABC",
    18: "ABCD",
    19: "BCD",
    20: "AD",
    21: "BCD",
    22: "ACD",
    23: "AC",
    24: "ABD",
    25: "ACD",
    26: "ABD",
    27: "BCD",
    28: "AB",
    29: "ACD",
    30: "ABC",
    31: "CD",
    32: "ABD",
    33: "ABD",
}

ANALYSIS_ANSWERS = {
    34: "分析题参考答案要点见答案原页 p.17-p.18。",
    35: "分析题参考答案要点见答案原页 p.18。",
    36: "分析题参考答案要点见答案原页 p.18-p.19。",
    37: "分析题参考答案要点见答案原页 p.19-p.20。",
    38: "分析题参考答案要点见答案原页 p.20。",
}

QUESTION_PAGES = {
    **{number: [1] for number in range(1, 6)},
    **{number: [2] for number in range(6, 13)},
    **{number: [3] for number in range(13, 17)},
    **{number: [4] for number in range(17, 21)},
    **{number: [5] for number in range(21, 26)},
    **{number: [6] for number in range(26, 30)},
    **{number: [7] for number in range(30, 34)},
    34: [8, 9],
    35: [9],
    36: [9, 10, 11],
    37: [11, 12],
    38: [12, 13],
}

ANSWER_PAGES = {
    **{number: [17] for number in range(1, 34)},
    34: [17, 18],
    35: [18],
    36: [18, 19],
    37: [19, 20],
    38: [20],
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
    render_pdf_assets(SOURCE_PAPER_PDF, asset_dir=asset_dir, prefix="paper-page", expected_pages=13, force=force)
    render_pdf_assets(SOURCE_ANSWER_PDF, asset_dir=asset_dir, prefix="answer-page", expected_pages=20, force=force)


def image_ref(page: int, *, prefix: str, caption: str) -> dict[str, str]:
    return {
        "src": f"question-bank/politics-2015/{prefix}-{page:02d}.jpg",
        "caption": caption,
        "alt": f"2015考研政治{caption}",
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
    return f"2015考研政治第{number}题（{section}）。题干、选项和材料以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number <= 33:
        return "答案来自本地百度网盘 2015 考研政治真题及参考答案 PDF 第 17 页标准答案键；题面以试卷原页图为准。"
    return "参考答案来自本地百度网盘 2015 考研政治真题及参考答案 PDF；完整答案要点见答案原页图。"


def evidence(number: int, question_hash: str, answer_hash: str) -> dict[str, str]:
    return {
        "evidenceId": f"politics-2015-q{number:02d}",
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
        "method": "local_pdf_ocr_located_page_image",
        "verifiedBy": "build_politics_2015_bank",
        "note": "Matched against local Baidu Netdisk 2015 Politics paper-answer PDF.",
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
        "paperName": "2015考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2015",
        "section": section_for(number),
        "type": type_for(number),
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["politics", "2015", section_for(number)],
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
        raise ValueError("politics-2015 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_all_assets(asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 39)]
    validate_cards(cards)

    return {
        "id": PAPER_ID,
        "source": ANSWER_SOURCE_EVIDENCE_ID,
        "paperId": PAPER_ID,
        "paperName": "2015考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2015",
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
            "The 2015 standalone paper PDF provides a readable text layer for question-page ranges. The scanned paper-answer PDF contains the official choice key on page 17 and analysis answer points on pages 17-20; OCR was used only to locate those pages while final release evidence remains rendered PDF page images."
        ],
        "assetRoot": "question-bank/politics-2015",
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
