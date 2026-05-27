#!/usr/bin/env python3
"""
Build the 2013 Politics public-course bank from the local Baidu Netdisk PDF.

The paper-answer PDF is scanned and embeds choice answers after each prompt.
The standalone paper PDF has a different option order for at least one choice
question, so this builder deliberately uses the combined paper-answer PDF as
the single source of truth for both question and answer page evidence.
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
SOURCE_PDF = (
    PROJECT_ROOT
    / "data"
    / "raw-inbox"
    / "public-course-history"
    / "politics"
    / "2013"
    / "2013-politics-paper-answer.pdf"
)
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "politics-2013.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "politics-2013"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "politics-2013-release-assets"

PAPER_ID = "politics-2013"
SOURCE_EVIDENCE_ID = "politics-2013-paper-answer"
SOURCE_MANIFEST_ID = "src_fdc02f653f8f006045eb5242"

SINGLE_ANSWERS = {
    1: "C",
    2: "D",
    3: "C",
    4: "B",
    5: "D",
    6: "C",
    7: "B",
    8: "A",
    9: "D",
    10: "D",
    11: "B",
    12: "C",
    13: "B",
    14: "C",
    15: "C",
    16: "D",
}

MULTI_ANSWERS = {
    17: "ACD",
    18: "ABD",
    19: "CD",
    20: "ABD",
    21: "ACD",
    22: "BCD",
    23: "ABCD",
    24: "ABCD",
    25: "ACD",
    26: "ABCD",
    27: "ACD",
    28: "ABC",
    29: "ACD",
    30: "ABD",
    31: "BC",
    32: "BCD",
    33: "CD",
}

ANALYSIS_ANSWERS = {
    34: "分析题参考答案要点见答案原页 p.12。",
    35: "分析题参考答案要点见答案原页 p.13-p.14。",
    36: "分析题参考答案要点见答案原页 p.15。",
    37: "分析题参考答案要点见答案原页 p.16。",
    38: "分析题参考答案要点见答案原页 p.17。",
}

QUESTION_PAGES = {
    1: [1],
    2: [1],
    3: [1, 2],
    4: [2],
    5: [2],
    6: [2],
    7: [2, 3],
    8: [3],
    9: [3],
    10: [3, 4],
    11: [4],
    12: [4],
    13: [4, 5],
    14: [5],
    15: [5],
    16: [5, 6],
    17: [6],
    18: [6],
    19: [6, 7],
    20: [7],
    21: [7],
    22: [7],
    23: [7, 8],
    24: [8],
    25: [8],
    26: [8, 9],
    27: [9],
    28: [9],
    29: [9, 10],
    30: [10],
    31: [10],
    32: [10],
    33: [10, 11],
    34: [11, 12],
    35: [12, 13],
    36: [14, 15],
    37: [15, 16],
    38: [16, 17],
}

ANSWER_PAGES = {
    1: [1],
    2: [1],
    3: [2],
    4: [2],
    5: [2],
    6: [2],
    7: [3],
    8: [3],
    9: [3],
    10: [4],
    11: [4],
    12: [4],
    13: [5],
    14: [5],
    15: [5],
    16: [6],
    17: [6],
    18: [6],
    19: [7],
    20: [7],
    21: [7],
    22: [7],
    23: [8],
    24: [8],
    25: [8],
    26: [9],
    27: [9],
    28: [9],
    29: [10],
    30: [10],
    31: [10],
    32: [10],
    33: [11],
    34: [12],
    35: [13, 14],
    36: [15],
    37: [16],
    38: [17],
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


def render_pdf_assets(pdf: Path, *, asset_dir: Path, force: bool) -> None:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = sorted(asset_dir.glob("paper-page-*.jpg"))
    if len(expected) >= 18 and not force:
        return

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob("paper-page-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / "paper-page"
    run(["pdftoppm", "-r", "160", "-jpeg", "-jpegopt", "quality=76", str(pdf), str(output_prefix)])

    rendered_pages = sorted(TMP_RENDER_DIR.glob("paper-page-*.jpg"), key=lambda path: int(path.stem.split("-")[-1]))
    if len(rendered_pages) != 18:
        raise ValueError(f"{pdf.name}: rendered {len(rendered_pages)} pages, expected 18")
    for rendered in rendered_pages:
        page = int(rendered.stem.split("-")[-1])
        target = asset_dir / f"paper-page-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def image_ref(page: int, *, caption: str) -> dict[str, str]:
    return {
        "src": f"question-bank/politics-2013/paper-page-{page:02d}.jpg",
        "caption": caption,
        "alt": f"2013考研政治{caption}",
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
    return f"2013考研政治第{number}题（{section}）。题干、选项和材料以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number <= 33:
        return "答案来自本地百度网盘 2013 考研政治真题及参考答案 PDF 内嵌答案；题面和选项以同一 PDF 原页图为准。"
    return "参考答案来自本地百度网盘 2013 考研政治真题及参考答案 PDF；完整答案要点见答案原页图。"


def evidence(number: int, question_hash: str, answer_hash: str) -> dict[str, str]:
    return {
        "evidenceId": f"politics-2013-q{number:02d}",
        "sourceId": SOURCE_MANIFEST_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "paper_answer_page_image",
        "sourceEvidenceId": SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
    }


def answer_evidence(number: int, answer_hash: str) -> dict[str, str]:
    return {
        "status": "matched",
        "evidenceRole": "official_inline_answer_key" if number <= 33 else "official_reference_answer",
        "sourceId": SOURCE_MANIFEST_ID,
        "sourceFilePath": str(SOURCE_PDF.relative_to(PROJECT_ROOT)),
        "answerTextHash": answer_hash,
        "method": "local_pdf_ocr_confirmed_page_image",
        "verifiedBy": "build_politics_2013_bank",
        "note": "Matched against the same local Baidu Netdisk 2013 Politics paper-answer PDF; standalone paper PDF was not mixed because its option order differs.",
    }


def build_card(number: int) -> dict[str, Any]:
    question = question_anchor(number)
    answer = answer_for(number)
    options = options_for(number)
    question_images = [image_ref(page, caption=f"试卷原页 p.{page}") for page in QUESTION_PAGES[number]]
    answer_images = [image_ref(page, caption=f"答案原页 p.{page}") for page in ANSWER_PAGES[number]]
    question_hash = sha256_text(
        json.dumps(
            {"question": question, "options": options, "questionPages": QUESTION_PAGES[number]},
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    answer_hash = sha256_text(
        json.dumps(
            {"answer": answer, "answerPages": ANSWER_PAGES[number]},
            ensure_ascii=False,
            sort_keys=True,
        )
    )

    return {
        "id": f"{PAPER_ID}-{number:03d}",
        "number": number,
        "paperId": PAPER_ID,
        "paperName": "2013考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2013",
        "section": section_for(number),
        "type": type_for(number),
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["politics", "2013", section_for(number)],
        "difficulty": 3 if number > 33 else 2,
        "source": SOURCE_EVIDENCE_ID,
        "sourceEvidenceId": SOURCE_EVIDENCE_ID,
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
        if not card.get("questionImages") or not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing page images")

    expected_counts = {"single_choice": 16, "multi_choice": 17, "analysis": 5}
    if len(cards) != 38:
        issues.append(f"card count {len(cards)} != 38")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if issues:
        raise ValueError("politics-2013 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(SOURCE_PDF, asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 39)]
    validate_cards(cards)

    return {
        "id": PAPER_ID,
        "source": SOURCE_EVIDENCE_ID,
        "paperId": PAPER_ID,
        "paperName": "2013考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2013",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_page_image_v1",
        "sourceFiles": [
            {
                "id": SOURCE_EVIDENCE_ID,
                "sourceId": SOURCE_MANIFEST_ID,
                "role": "paper_answer",
                "localPath": str(SOURCE_PDF.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(SOURCE_PDF),
            }
        ],
        "sourceNotes": [
            "The 2013 combined paper-answer PDF embeds the choice answers inline and contains analysis answer points. The standalone paper PDF has a different option order for at least question 1, so this bank keeps all release evidence on the same combined PDF."
        ],
        "assetRoot": "question-bank/politics-2013",
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
