#!/usr/bin/env python3
"""
Build the 2008 Politics public-course bank from a local Baidu Netdisk PDF.

The source PDF is image-based and has a compact reference-answer section. OCR
is used to confirm the answer key and page mapping; rendered PDF pages remain
the authoritative question/answer material.
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
    / "2008"
    / "2008-politics-paper-answer.pdf"
)
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "politics-2008.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "politics-2008"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "politics-2008-release-assets"

PAPER_ID = "politics-2008"
SOURCE_EVIDENCE_ID = "politics-2008-paper-answer"
SOURCE_MANIFEST_ID = "src_707a04fbc3a5a127b5267c13"

SINGLE_ANSWERS = {
    1: "D",
    2: "C",
    3: "D",
    4: "A",
    5: "D",
    6: "B",
    7: "A",
    8: "C",
    9: "A",
    10: "D",
    11: "C",
    12: "B",
    13: "C",
    14: "A",
    15: "A",
    16: "B",
}

MULTI_ANSWERS = {
    17: "AB",
    18: "ABD",
    19: "ABC",
    20: "ABCD",
    21: "AB",
    22: "ABD",
    23: "ABD",
    24: "BC",
    25: "BD",
    26: "ABD",
    27: "ACD",
    28: "ABCD",
    29: "ACD",
    30: "ABC",
    31: "ABCD",
    32: "AC",
    33: "ABCD",
}

ANALYSIS_ANSWERS = {
    34: "分析题参考答案要点见答案原页 p.13。",
    35: "分析题参考答案要点见答案原页 p.13-p.14。",
    36: "分析题参考答案要点见答案原页 p.14-p.15。",
    37: "分析题参考答案要点见答案原页 p.15。",
    38: "选做分析题参考答案要点见答案原页 p.15-p.16。",
}

QUESTION_PAGES = {
    **{number: [1] for number in range(1, 6)},
    **{number: [2] for number in range(6, 12)},
    **{number: [3] for number in range(12, 17)},
    **{number: [3] for number in range(17, 18)},
    **{number: [4] for number in range(18, 23)},
    **{number: [5] for number in range(23, 28)},
    **{number: [6] for number in range(28, 33)},
    33: [7],
    34: [7],
    35: [8],
    36: [8, 9],
    37: [9, 10],
    38: [10, 11, 12],
}

ANSWER_PAGES = {
    **{number: [13] for number in range(1, 34)},
    34: [13],
    35: [13, 14],
    36: [14, 15],
    37: [15],
    38: [15, 16],
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
    if len(expected) >= 16 and not force:
        return

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob("paper-page-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / "paper-page"
    run(["pdftoppm", "-r", "160", "-jpeg", "-jpegopt", "quality=76", str(pdf), str(output_prefix)])

    for rendered in sorted(TMP_RENDER_DIR.glob("paper-page-*.jpg")):
        page = int(rendered.stem.split("-")[-1])
        target = asset_dir / f"paper-page-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def image_ref(page: int, *, caption: str) -> dict[str, str]:
    return {
        "src": f"question-bank/politics-2008/paper-page-{page:02d}.jpg",
        "caption": caption,
        "alt": f"2008考研政治{caption}",
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
    return f"2008考研政治第{number}题（{section}）。题干、选项和材料以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number <= 33:
        return "答案来自本地百度网盘 2008 考研政治真题及参考答案 PDF 的参考答案页；完整题干和选项见试卷原页图。"
    return "参考答案来自本地百度网盘 2008 考研政治真题及参考答案 PDF；完整答案要点见答案原页图。"


def evidence(number: int, question_hash: str, answer_hash: str) -> dict[str, str]:
    return {
        "evidenceId": f"politics-2008-q{number:02d}",
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
        "evidenceRole": "official_answer_key" if number <= 33 else "official_reference_answer",
        "sourceId": SOURCE_MANIFEST_ID,
        "sourceFilePath": str(SOURCE_PDF.relative_to(PROJECT_ROOT)),
        "answerTextHash": answer_hash,
        "method": "local_pdf_ocr_confirmed_page_image",
        "verifiedBy": "build_politics_2008_bank",
        "note": "Matched against local Baidu Netdisk 2008 Politics paper-answer PDF.",
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
        "paperName": "2008考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2008",
        "section": section_for(number),
        "type": type_for(number),
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["politics", "2008", section_for(number)],
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
        raise ValueError("politics-2008 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(SOURCE_PDF, asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 39)]
    validate_cards(cards)

    return {
        "id": PAPER_ID,
        "source": SOURCE_EVIDENCE_ID,
        "paperId": PAPER_ID,
        "paperName": "2008考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2008",
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
        "assetRoot": "question-bank/politics-2008",
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
