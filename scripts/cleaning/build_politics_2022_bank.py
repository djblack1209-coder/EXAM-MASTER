#!/usr/bin/env python3
"""
Build the 2022 Politics public-course bank from local Baidu Netdisk PDFs.

The standalone paper PDF is a scanned source whose visible pages already contain
choice-answer marks, so it is retained as source evidence but is not shown before
the learner answers. User-facing questions and options are extracted from the
paper-answer PDF text layer; answer page images remain available after answering.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
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
    / "2022"
    / "2022-politics-paper.pdf"
)
SOURCE_ANSWER_PDF = (
    PROJECT_ROOT
    / "data"
    / "raw-inbox"
    / "public-course-history"
    / "politics"
    / "2022"
    / "2022-politics-paper-answer.pdf"
)
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "politics-2022.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "politics-2022"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "politics-2022-release-assets"

PAPER_ID = "politics-2022"
PAPER_SOURCE_EVIDENCE_ID = "politics-2022-paper"
ANSWER_SOURCE_EVIDENCE_ID = "politics-2022-paper-answer"
PAPER_SOURCE_MANIFEST_ID = "src_d0653e7428e5fcd6e29e38bf"
ANSWER_SOURCE_MANIFEST_ID = "src_c887b7ca6fd29fcba40841c8"

EXPECTED_ANSWERS = {
    1: "C",
    2: "B",
    3: "D",
    4: "A",
    5: "B",
    6: "A",
    7: "D",
    8: "D",
    9: "A",
    10: "D",
    11: "C",
    12: "C",
    13: "C",
    14: "B",
    15: "A",
    16: "D",
    17: "BCD",
    18: "CD",
    19: "ABD",
    20: "AB",
    21: "AB",
    22: "ABD",
    23: "BCD",
    24: "ABCD",
    25: "ACD",
    26: "ABCD",
    27: "BCD",
    28: "ABD",
    29: "AC",
    30: "ACD",
    31: "ABC",
    32: "ABCD",
    33: "ABC",
}

ANSWER_PAGES = {
    1: [1],
    2: [1, 2],
    3: [2],
    4: [3],
    5: [3],
    6: [4],
    7: [4],
    8: [5],
    9: [5, 6],
    10: [6],
    11: [6, 7],
    12: [7],
    13: [7, 8],
    14: [8],
    15: [8, 9],
    16: [9],
    17: [9, 10],
    18: [10],
    19: [11],
    20: [11, 12],
    21: [12],
    22: [13],
    23: [13, 14],
    24: [14],
    25: [15],
    26: [15, 16],
    27: [16, 17],
    28: [17],
    29: [17],
    30: [18],
    31: [18, 19],
    32: [19],
    33: [19],
    34: [20, 21],
    35: [21, 22, 23],
    36: [24, 25, 26],
    37: [26, 27, 28],
    38: [29, 30, 31],
}

QUESTION_START_RE = re.compile(r"(?m)^\s*(\d{1,2})\.\s*")
ANSWER_LINE_RE = re.compile(r"【(?:正确答案|答案)】\s*([A-D]+)")
OPTION_START_RE = re.compile(r"(?:(?<=^)|(?<=[\n\s（(]))([A-D])\s*(?:[.．、]|(?=\s*[\u4e00-\u9fff]))", re.M)


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


def run_cmd(cmd: list[str]) -> None:
    subprocess.run(cmd, cwd=PROJECT_ROOT, check=True)


def extract_pdf_text(pdf: Path) -> str:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    with tempfile.NamedTemporaryFile(prefix="politics-2022-", suffix=".txt", delete=False) as temp_file:
        temp_path = Path(temp_file.name)
    try:
        run_cmd(["pdftotext", "-layout", str(pdf), str(temp_path)])
        return temp_path.read_text(encoding="utf-8")
    finally:
        temp_path.unlink(missing_ok=True)


def render_answer_assets(*, asset_dir: Path, force: bool) -> None:
    if not SOURCE_ANSWER_PDF.exists():
        raise FileNotFoundError(SOURCE_ANSWER_PDF)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = sorted(asset_dir.glob("answer-page-*.jpg"))
    if len(expected) >= 31 and not force:
        return

    render_dir = TMP_RENDER_DIR / "answer-page"
    render_dir.mkdir(parents=True, exist_ok=True)
    for item in render_dir.glob("page-*.jpg"):
        item.unlink()

    output_prefix = render_dir / "page"
    run_cmd(["pdftoppm", "-r", "160", "-jpeg", "-jpegopt", "quality=76", str(SOURCE_ANSWER_PDF), str(output_prefix)])
    rendered_pages = sorted(render_dir.glob("page-*.jpg"), key=lambda path: int(path.stem.split("-")[-1]))
    if len(rendered_pages) != 31:
        raise ValueError(f"{SOURCE_ANSWER_PDF.name}: rendered {len(rendered_pages)} pages, expected 31")
    for index, rendered in enumerate(rendered_pages, start=1):
        shutil.copyfile(rendered, asset_dir / f"answer-page-{index:02d}.jpg")


def clean_text(value: str) -> str:
    text = value.replace("\x0c", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_option_text(value: str) -> str:
    return clean_text(value).lstrip(".．、。:：;；,， ").strip()


def split_blocks(text: str) -> dict[int, str]:
    normalized = text.replace("\x0c", "\n")
    starts = [(int(match.group(1)), match.start()) for match in QUESTION_START_RE.finditer(normalized)]
    starts = [(number, start) for number, start in starts if 1 <= number <= 38]
    numbers = [number for number, _ in starts]
    if numbers != list(range(1, 39)):
        raise ValueError(f"unexpected 2022 politics question starts: {numbers}")

    blocks: dict[int, str] = {}
    for index, (number, start) in enumerate(starts):
        end = starts[index + 1][1] if index + 1 < len(starts) else len(normalized)
        blocks[number] = normalized[start:end]
    return blocks


def strip_question_number(text: str, number: int) -> str:
    return clean_text(re.sub(rf"^\s*{number}\.\s*", "", text, count=1))


def extract_options(question_part: str) -> tuple[str, list[dict[str, str]]]:
    first_by_label: dict[str, re.Match[str]] = {}
    for match in OPTION_START_RE.finditer(question_part):
        first_by_label.setdefault(match.group(1), match)

    option_matches = [first_by_label.get(label) for label in "ABCD"]
    if any(match is None for match in option_matches):
        found = [label for label, match in zip("ABCD", option_matches) if match is not None]
        raise ValueError(f"expected A-D options, found {found}: {clean_text(question_part)[:160]}")

    typed_matches = [match for match in option_matches if match is not None]
    stem = question_part[: typed_matches[0].start()]
    options: list[dict[str, str]] = []
    for index, match in enumerate(typed_matches):
        end = typed_matches[index + 1].start() if index + 1 < len(typed_matches) else len(question_part)
        options.append({"label": match.group(1), "text": clean_option_text(question_part[match.end() : end])})
    return clean_text(stem), options


def split_answer_line(block: str, number: int) -> tuple[str, str, str]:
    marker = ANSWER_LINE_RE.search(block)
    if not marker:
        raise ValueError(f"question {number}: missing answer line")
    question_part = block[: marker.start()]
    answer = marker.group(1).strip()
    explanation = block[marker.end() :]
    explanation = re.sub(r"^\s*【答案解析】", "", explanation)
    explanation = re.sub(r"^\s*【解析】", "", explanation)
    explanation = clean_text(explanation) or "答案来自本地百度网盘 2022 考研政治真题及答案解析 PDF。"
    return question_part, answer, explanation


def split_analysis_answer(block: str, number: int) -> tuple[str, str]:
    marker = re.search(r"【答案要点】", block)
    if not marker:
        raise ValueError(f"question {number}: missing analysis answer marker")
    question = strip_question_number(block[: marker.start()], number)
    answer = clean_text(block[marker.end() :])
    if not answer:
        raise ValueError(f"question {number}: missing analysis answer")
    return question, answer


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


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/politics-2022/answer-page-{page:02d}.jpg",
        "caption": f"答案原页 p.{page}",
        "alt": f"2022考研政治答案原页 p.{page}",
    }


def evidence(number: int, question_hash: str, answer_hash: str) -> dict[str, str]:
    return {
        "evidenceId": f"politics-2022-q{number:02d}",
        "sourceId": ANSWER_SOURCE_MANIFEST_ID,
        "paperSourceId": PAPER_SOURCE_MANIFEST_ID,
        "sourceType": "baidu_netdisk_official_paper_answer_pdf_text_layer",
        "evidenceRole": "paper_answer_text_and_answer_page_image",
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
        "method": "local_pdf_text_layer_and_rendered_page_image",
        "verifiedBy": "build_politics_2022_bank",
        "note": (
            "Questions and answers were extracted from the local Baidu Netdisk 2022 Politics paper-answer PDF. "
            "The standalone paper PDF is retained as source evidence but is not shown before answering because "
            "its scanned pages include visible choice-answer marks."
        ),
    }


def build_choice_card(number: int, block: str) -> dict[str, Any]:
    question_part, answer, explanation = split_answer_line(block, number)
    if EXPECTED_ANSWERS[number] != answer:
        raise ValueError(f"question {number}: answer {answer} != expected {EXPECTED_ANSWERS[number]}")
    question_text, options = extract_options(question_part)
    question = strip_question_number(question_text, number)
    answer_pages = ANSWER_PAGES[number]
    question_hash = sha256_text(
        json.dumps({"question": question, "options": options}, ensure_ascii=False, sort_keys=True)
    )
    answer_hash = sha256_text(
        json.dumps({"answer": answer, "answerPages": answer_pages, "explanation": explanation}, ensure_ascii=False)
    )

    return {
        "id": f"{PAPER_ID}-{number:03d}",
        "number": number,
        "paperId": PAPER_ID,
        "paperName": "2022考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2022",
        "section": section_for(number),
        "type": type_for(number),
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation,
        "questionImages": [],
        "answerImages": [answer_image_ref(page) for page in answer_pages],
        "tags": ["politics", "2022", section_for(number)],
        "difficulty": 2,
        "source": ANSWER_SOURCE_EVIDENCE_ID,
        "sourceEvidenceId": ANSWER_SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": evidence(number, question_hash, answer_hash),
        "answerEvidence": answer_evidence(number, answer_hash),
    }


def build_analysis_card(number: int, block: str) -> dict[str, Any]:
    question, answer = split_analysis_answer(block, number)
    answer_pages = ANSWER_PAGES[number]
    question_hash = sha256_text(question)
    answer_hash = sha256_text(json.dumps({"answer": answer, "answerPages": answer_pages}, ensure_ascii=False))

    return {
        "id": f"{PAPER_ID}-{number:03d}",
        "number": number,
        "paperId": PAPER_ID,
        "paperName": "2022考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2022",
        "section": section_for(number),
        "type": "analysis",
        "question": question,
        "options": [],
        "answer": answer,
        "explanation": "答案来自本地百度网盘 2022 考研政治真题及答案解析 PDF 参考答案要点。",
        "questionImages": [],
        "answerImages": [answer_image_ref(page) for page in answer_pages],
        "tags": ["politics", "2022", section_for(number)],
        "difficulty": 3,
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
        if card.get("questionImages"):
            issues.append(f"card {expected_number}: questionImages must be empty to avoid pre-answer leakage")
        if not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing answer page images")

    expected_counts = {"single_choice": 16, "multi_choice": 17, "analysis": 5}
    if len(cards) != 38:
        issues.append(f"card count {len(cards)} != 38")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if issues:
        raise ValueError("politics-2022 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_answer_assets(asset_dir=asset_dir, force=force_assets)
    blocks = split_blocks(extract_pdf_text(SOURCE_ANSWER_PDF))
    cards = [
        build_choice_card(number, blocks[number]) if number <= 33 else build_analysis_card(number, blocks[number])
        for number in range(1, 39)
    ]
    validate_cards(cards)

    return {
        "id": PAPER_ID,
        "source": ANSWER_SOURCE_EVIDENCE_ID,
        "paperId": PAPER_ID,
        "paperName": "2022考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2022",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_answer_pdf_text_layer_v1",
        "sourceFiles": [
            {
                "id": PAPER_SOURCE_EVIDENCE_ID,
                "sourceId": PAPER_SOURCE_MANIFEST_ID,
                "role": "paper",
                "localPath": str(SOURCE_PAPER_PDF.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(SOURCE_PAPER_PDF),
                "displayPolicy": "not_shown_before_answer",
                "displayPolicyReason": "The scanned paper PDF has visible choice-answer marks.",
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
            "The 2022 standalone paper PDF is retained as source evidence but is not shown before answering because the scanned question pages include visible answer marks. User-facing question text, options, official choice keys, and analysis answer points are extracted from the local Baidu Netdisk paper-answer PDF text layer; rendered answer PDF pages are attached as post-answer evidence.",
        ],
        "assetRoot": "question-bank/politics-2022",
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
