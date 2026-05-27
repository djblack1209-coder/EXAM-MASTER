#!/usr/bin/env python3
"""
Build the 2018 Politics public-course bank from local Baidu Netdisk PDFs.

The standalone paper PDF has a usable text layer for locating question-page
ranges. The paper-answer PDF is scanned, so release evidence stays as rendered
PDF page images; OCR is used only to locate answers and answer pages. Because
the paper-answer PDF reorders options for some questions, the answer keys below
are mapped back to the standalone paper PDF option letters.
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
    / "2018"
    / "2018-politics-paper.pdf"
)
SOURCE_ANSWER_PDF = (
    PROJECT_ROOT
    / "data"
    / "raw-inbox"
    / "public-course-history"
    / "politics"
    / "2018"
    / "2018-politics-paper-answer.pdf"
)
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "politics-2018.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "politics-2018"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "politics-2018-release-assets"

PAPER_ID = "politics-2018"
PAPER_SOURCE_EVIDENCE_ID = "politics-2018-paper"
ANSWER_SOURCE_EVIDENCE_ID = "politics-2018-paper-answer"
PAPER_SOURCE_MANIFEST_ID = "src_66334b84f72c4147576c82ff"
ANSWER_SOURCE_MANIFEST_ID = "src_7e0fba1015bed2480cf32fef"

SINGLE_ANSWERS = {
    1: "C",
    2: "A",
    3: "B",
    4: "C",
    5: "B",
    6: "B",
    7: "C",
    8: "A",
    9: "D",
    10: "B",
    11: "A",
    12: "A",
    13: "D",
    14: "C",
    15: "D",
    16: "B",
}

MULTI_ANSWERS = {
    17: "ACD",
    18: "ABC",
    19: "ABCD",
    20: "ABD",
    21: "ABD",
    22: "ABD",
    23: "ABCD",
    24: "ABC",
    25: "BCD",
    26: "AC",
    27: "ABC",
    28: "AB",
    29: "ABCD",
    30: "ABCD",
    31: "ABCD",
    32: "ACD",
    33: "BCD",
}

ANALYSIS_ANSWERS = {
    34: "分析题参考答案要点见答案原页 p.13。",
    35: "分析题参考答案要点见答案原页 p.13-p.14。",
    36: "分析题参考答案要点见答案原页 p.14-p.16。",
    37: "分析题参考答案要点见答案原页 p.16。",
    38: "分析题参考答案要点见答案原页 p.16-p.17。",
}

QUESTION_PAGES = {
    **{number: [1] for number in range(1, 6)},
    6: [1, 2],
    **{number: [2] for number in range(7, 13)},
    **{number: [3] for number in range(13, 18)},
    18: [3, 4],
    **{number: [4] for number in range(19, 24)},
    **{number: [5] for number in range(24, 28)},
    28: [6],
    **{number: [6] for number in range(29, 33)},
    33: [7],
    34: [7, 8],
    35: [8, 9],
    36: [9, 10],
    37: [10, 11],
    38: [12],
}

ANSWER_PAGES = {
    **{number: [1] for number in range(1, 3)},
    **{number: [2] for number in range(3, 6)},
    **{number: [3] for number in range(6, 9)},
    **{number: [4] for number in range(9, 12)},
    **{number: [5] for number in range(12, 15)},
    **{number: [6] for number in range(15, 18)},
    **{number: [7] for number in range(18, 21)},
    **{number: [8] for number in range(21, 23)},
    **{number: [9] for number in range(23, 26)},
    **{number: [10] for number in range(26, 29)},
    **{number: [11] for number in range(29, 31)},
    **{number: [12] for number in range(31, 33)},
    33: [12, 13],
    34: [13],
    35: [13, 14],
    36: [14, 15, 16],
    37: [16],
    38: [16, 17],
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
    render_pdf_assets(SOURCE_PAPER_PDF, asset_dir=asset_dir, prefix="paper-page", expected_pages=12, force=force)
    render_pdf_assets(SOURCE_ANSWER_PDF, asset_dir=asset_dir, prefix="answer-page", expected_pages=17, force=force)


def image_ref(page: int, *, prefix: str, caption: str) -> dict[str, str]:
    return {
        "src": f"question-bank/politics-2018/{prefix}-{page:02d}.jpg",
        "caption": caption,
        "alt": f"2018考研政治{caption}",
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
    return f"2018考研政治第{number}题（{section}）。题干、选项和材料以试卷原页图为准。"


def explanation_for(number: int) -> str:
    if number == 24:
        return (
            "答案来自本地百度网盘 2018 考研政治真题及参考答案 PDF 第 9 页；"
            "该页标题答案行与解析结论不一致，解析文字排除“部门职责分散交叉”的干扰项，"
            "题库按解析结论映射回试卷原页选项。"
        )
    if number <= 33:
        return (
            "答案来自本地百度网盘 2018 考研政治真题及参考答案 PDF 第 1-13 页逐题解析；"
            "部分解析页选项顺序与试卷 PDF 不一致，题库已按选项内容映射回试卷原页字母。"
        )
    return "参考答案来自本地百度网盘 2018 考研政治真题及参考答案 PDF；完整答案要点见答案原页图。"


def evidence(number: int, question_hash: str, answer_hash: str) -> dict[str, str]:
    return {
        "evidenceId": f"politics-2018-q{number:02d}",
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
    note = (
        "Matched against local Baidu Netdisk 2018 Politics paper-answer PDF and mapped to the "
        "standalone paper PDF option order when the answer PDF reordered options."
    )
    if number == 24:
        note = (
            "Matched to answer-page 9 in the local Baidu Netdisk 2018 Politics paper-answer PDF. "
            "The page has an internal conflict between the visible answer line and explanation conclusion; "
            "the bank follows the explanation conclusion and maps it to the standalone paper PDF option order."
        )
    return {
        "status": "matched",
        "evidenceRole": "official_answer_key" if number <= 33 else "official_reference_answer",
        "sourceId": ANSWER_SOURCE_MANIFEST_ID,
        "sourceFilePath": str(SOURCE_ANSWER_PDF.relative_to(PROJECT_ROOT)),
        "answerTextHash": answer_hash,
        "method": "local_pdf_ocr_located_page_image_with_option_order_mapping",
        "verifiedBy": "build_politics_2018_bank",
        "note": note,
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
        "paperName": "2018考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2018",
        "section": section_for(number),
        "type": type_for(number),
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["politics", "2018", section_for(number)],
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
        raise ValueError("politics-2018 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_all_assets(asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 39)]
    validate_cards(cards)

    return {
        "id": PAPER_ID,
        "source": ANSWER_SOURCE_EVIDENCE_ID,
        "paperId": PAPER_ID,
        "paperName": "2018考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2018",
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
            "The 2018 standalone paper PDF provides the release question pages and user-visible option order. The scanned paper-answer PDF contains per-question choice answers on pages 1-13 and analysis answer points on pages 13-17; OCR was used only to locate those pages while final release evidence remains rendered PDF page images. Several answer-PDF choice blocks reorder options relative to the standalone paper, so choice answers were mapped by option content back to the paper PDF letters.",
        ],
        "assetRoot": "question-bank/politics-2018",
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
