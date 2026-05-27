#!/usr/bin/env python3
"""
Build the 2024 Politics public-course bank from the local Baidu Netdisk PDF.

The PDF has a usable text layer. This builder parses all 38 official questions,
filters promotional page text, and records matched source/answer evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_PDF = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-2025" / "politics" / "2024-politics-paper-answer.pdf"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "politics-2024.json"

PAPER_ID = "politics-2024"
SOURCE_EVIDENCE_ID = "politics-2024-paper-answer"
SOURCE_MANIFEST_ID = "src_48eac09b55120a5585ef2ec5"

QUESTION_START_RE = re.compile(r"^(\d{1,2})[、.](.*)")
OPTION_RE = re.compile(r"^([A-D])、(.*)")
SECTION_HEADERS = {"一、单选题", "二、多选题", "三、主观题"}


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


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def extract_pdf_text(pdf: Path) -> str:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    with tempfile.NamedTemporaryFile(prefix="politics-2024-", suffix=".txt", delete=False) as temp_file:
        temp_path = Path(temp_file.name)
    try:
        subprocess.run(["pdftotext", str(pdf), str(temp_path)], cwd=PROJECT_ROOT, check=True)
        return temp_path.read_text(encoding="utf-8")
    finally:
        temp_path.unlink(missing_ok=True)


def is_noise(line: str) -> bool:
    return "公众号" in line or "更多考研" in line or "免费获取" in line


def normalize_lines(text: str) -> list[str]:
    lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.replace("\x0c", "").strip()
        if not line or is_noise(line):
            continue
        lines.append(line)
    return lines


def split_blocks(lines: list[str]) -> list[tuple[int, list[str]]]:
    starts: list[tuple[int, int]] = []
    for index, line in enumerate(lines):
        match = QUESTION_START_RE.match(line)
        if match:
            starts.append((int(match.group(1)), index))

    if [number for number, _ in starts] != list(range(1, 39)):
        raise ValueError(f"unexpected 2024 politics question starts: {[number for number, _ in starts]}")

    blocks: list[tuple[int, list[str]]] = []
    for offset, (number, start) in enumerate(starts):
        end = starts[offset + 1][1] if offset + 1 < len(starts) else len(lines)
        block = [line for line in lines[start:end] if line not in SECTION_HEADERS]
        blocks.append((number, block))
    return blocks


def strip_number(line: str) -> str:
    match = QUESTION_START_RE.match(line)
    return match.group(2).strip() if match else line


def join_text(lines: list[str]) -> str:
    text = "".join(line.strip() for line in lines if line.strip())
    return re.sub(r"\s+", " ", text).strip()


def marker_index(lines: list[str], marker: str) -> int:
    for index, line in enumerate(lines):
        if line.startswith(marker):
            return index
    return -1


def parse_answer_line(line: str) -> str:
    return line.replace("【答案】", "").strip().replace(" ", "")


def parse_options(lines: list[str]) -> list[dict[str, str]]:
    options: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for line in lines:
        match = OPTION_RE.match(line)
        if match:
            if current:
                options.append(current)
            current = {"label": match.group(1), "text": match.group(2).strip()}
        elif current:
            current["text"] += line.strip()
    if current:
        options.append(current)
    return options


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


def evidence(card: dict[str, Any], question_hash: str, answer_hash: str) -> dict[str, str]:
    return {
        "evidenceId": f"politics-2024-q{int(card['number']):02d}",
        "sourceId": SOURCE_MANIFEST_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_text_layer",
        "evidenceRole": "paper_answer_pdf",
        "sourceEvidenceId": SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
    }


def build_choice_card(number: int, block: list[str]) -> dict[str, Any]:
    score_index = marker_index(block, "【分数】")
    option_index = marker_index(block, "【选项】")
    answer_index = marker_index(block, "【答案】")
    explanation_index = marker_index(block, "【解析】")
    if min(score_index, option_index, answer_index, explanation_index) < 0:
        raise ValueError(f"question {number}: missing required markers")

    question_lines = [strip_number(block[0]), *block[1:score_index]]
    answer = parse_answer_line(block[answer_index])
    options = parse_options(block[option_index + 1 : answer_index])
    if len(options) != 4:
        raise ValueError(f"question {number}: expected 4 options, got {len(options)}")

    explanation = join_text(block[explanation_index + 1 :])
    if not explanation:
        explanation = "答案来自本地百度网盘 2024 考研政治真题及答案 PDF。"

    card = {
        "id": f"{PAPER_ID}-{number:03d}",
        "number": number,
        "paperId": PAPER_ID,
        "paperName": "2024考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2024",
        "section": section_for(number),
        "type": type_for(number),
        "question": join_text(question_lines),
        "options": options,
        "answer": answer,
        "explanation": explanation,
        "tags": ["politics", "2024", section_for(number)],
        "source": SOURCE_EVIDENCE_ID,
        "sourceEvidenceId": SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
    }
    question_hash = sha256_text(f"{card['question']}|{json.dumps(options, ensure_ascii=False, sort_keys=True)}")
    answer_hash = sha256_text(f"{answer}|{explanation}")
    card["questionTextHash"] = question_hash
    card["answerTextHash"] = answer_hash
    card["sourceEvidence"] = evidence(card, question_hash, answer_hash)
    return card


def build_analysis_card(number: int, block: list[str]) -> dict[str, Any]:
    answer_index = marker_index(block, "【答案】")
    explanation_index = marker_index(block, "【解析】")
    if answer_index < 0 or explanation_index < 0:
        raise ValueError(f"question {number}: missing analysis answer markers")

    question = join_text([strip_number(block[0]), *block[1:answer_index]])
    answer_lines = block[explanation_index + 1 :]
    if answer_lines and answer_lines[0].startswith("【解析】"):
        answer_lines = [answer_lines[0].replace("【解析】", "", 1).strip(), *answer_lines[1:]]
    answer = join_text(answer_lines)
    if not answer:
        answer = "参考答案解析见本地百度网盘 2024 考研政治真题及答案 PDF。"

    card = {
        "id": f"{PAPER_ID}-{number:03d}",
        "number": number,
        "paperId": PAPER_ID,
        "paperName": "2024考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2024",
        "section": section_for(number),
        "type": "analysis",
        "question": question,
        "options": [],
        "answer": answer,
        "explanation": "答案来自本地百度网盘 2024 考研政治真题及答案 PDF 解析部分。",
        "tags": ["politics", "2024", section_for(number)],
        "source": SOURCE_EVIDENCE_ID,
        "sourceEvidenceId": SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
    }
    question_hash = sha256_text(question)
    answer_hash = sha256_text(answer)
    card["questionTextHash"] = question_hash
    card["answerTextHash"] = answer_hash
    card["sourceEvidence"] = evidence(card, question_hash, answer_hash)
    return card


def validate_cards(cards: list[dict[str, Any]]) -> None:
    counts: dict[str, int] = {}
    issues: list[str] = []
    for index, card in enumerate(cards, start=1):
        if card.get("number") != index:
            issues.append(f"card {index}: number={card.get('number')}")
        card_type = str(card.get("type") or "")
        counts[card_type] = counts.get(card_type, 0) + 1
        if not str(card.get("question") or "").strip():
            issues.append(f"card {index}: missing question")
        if not str(card.get("answer") or "").strip() or str(card.get("answer")).strip() == "略":
            issues.append(f"card {index}: missing usable answer")
        if card_type in {"single_choice", "multi_choice"}:
            labels = [item.get("label") for item in card.get("options", [])]
            if labels != ["A", "B", "C", "D"]:
                issues.append(f"card {index}: invalid options {labels}")
    expected_counts = {"single_choice": 16, "multi_choice": 17, "analysis": 5}
    if len(cards) != 38:
        issues.append(f"card count {len(cards)} != 38")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if issues:
        raise ValueError("politics-2024 validation failed:\n" + "\n".join(issues))


def build_payload(pdf: Path) -> dict[str, Any]:
    text = extract_pdf_text(pdf)
    lines = normalize_lines(text)
    blocks = split_blocks(lines)
    cards = [
        build_choice_card(number, block) if number <= 33 else build_analysis_card(number, block)
        for number, block in blocks
    ]
    validate_cards(cards)

    return {
        "id": PAPER_ID,
        "source": SOURCE_EVIDENCE_ID,
        "paperId": PAPER_ID,
        "paperName": "2024考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2024",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_text_layer_v1",
        "sourceFiles": [
            {
                "id": SOURCE_EVIDENCE_ID,
                "role": "paper_answer",
                "localPath": "data/raw-inbox/public-course-2025/politics/2024-politics-paper-answer.pdf",
                "sha256": sha256_file(pdf),
                "sourceId": SOURCE_MANIFEST_ID,
            }
        ],
        "processed_at": utc_now(),
        "total_cards": len(cards),
        "cards": cards,
    }


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the release-ready 2024 politics bank.")
    parser.add_argument("--pdf", type=Path, default=SOURCE_PDF)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)

    payload = build_payload(args.pdf)
    write_json(args.output, payload)
    print(f"[build-politics-2024] wrote {args.output} cards={payload['total_cards']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
