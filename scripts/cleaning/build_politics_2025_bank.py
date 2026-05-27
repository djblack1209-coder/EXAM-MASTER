#!/usr/bin/env python3
"""
Promote the existing 2025 Politics public-course bank with local PDF evidence.

The source PDF comes from the Baidu Netdisk public-course archive. The card
structure was previously cleaned to the official 16/17/5 politics paper shape;
this builder makes the release evidence explicit and reproducible.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "politics-2025.json"
DEFAULT_OUTPUT = DEFAULT_INPUT
SOURCE_PDF = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-2025" / "politics" / "2025-politics-paper-answer-v2.pdf"

PAPER_ID = "politics-2025"
SOURCE_EVIDENCE_ID = "politics-2025-paper-answer-v2"
SOURCE_MANIFEST_ID = "src_0f5c57dff9924f4345751022"


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


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def normalized_option_text(card: dict[str, Any]) -> str:
    options = card.get("options")
    if not isinstance(options, list):
        return ""
    return "|".join(f"{item.get('label', '')}:{item.get('text', '')}" for item in options if isinstance(item, dict))


def validate_cards(cards: list[dict[str, Any]]) -> None:
    counts: dict[str, int] = {}
    issues: list[str] = []
    seen_ids: set[str] = set()

    for index, card in enumerate(cards, start=1):
        card_id = str(card.get("id") or "")
        if not card_id:
            issues.append(f"card {index}: missing id")
        if card_id in seen_ids:
            issues.append(f"card {index}: duplicate id {card_id}")
        seen_ids.add(card_id)

        number = int(card.get("number") or 0)
        if number != index:
            issues.append(f"card {index}: number={number}")
        card_type = str(card.get("type") or "")
        counts[card_type] = counts.get(card_type, 0) + 1
        if not str(card.get("question") or "").strip():
            issues.append(f"card {index}: missing question")
        if not str(card.get("answer") or "").strip():
            issues.append(f"card {index}: missing answer")
        if card_type in {"single_choice", "multi_choice"}:
            options = card.get("options")
            labels = [str(item.get("label") or "").strip() for item in options or [] if isinstance(item, dict)]
            if labels != ["A", "B", "C", "D"]:
                issues.append(f"card {index}: invalid option labels {labels}")

    expected_counts = {"single_choice": 16, "multi_choice": 17, "analysis": 5}
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if len(cards) != 38:
        issues.append(f"card count {len(cards)} != 38")
    if issues:
        raise ValueError("politics-2025 validation failed:\n" + "\n".join(issues))


def enrich_card(card: dict[str, Any]) -> dict[str, Any]:
    number = int(card["number"])
    card_type = str(card.get("type") or "")
    section = "单项选择" if card_type == "single_choice" else "多项选择" if card_type == "multi_choice" else "分析题"
    question_hash = sha256_text(f"{card.get('question', '')}|{normalized_option_text(card)}")
    answer_hash = sha256_text(f"{card.get('answer', '')}|{card.get('explanation', '')}")

    enriched = {
        **card,
        "id": f"{PAPER_ID}-{number:03d}",
        "paperId": PAPER_ID,
        "paperName": "2025考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2025",
        "section": section,
        "tags": ["politics", "2025", section],
        "source": SOURCE_EVIDENCE_ID,
        "sourceEvidenceId": SOURCE_EVIDENCE_ID,
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": {
            "evidenceId": f"politics-2025-q{number:02d}",
            "sourceId": SOURCE_MANIFEST_ID,
            "sourceType": "baidu_netdisk_official_paper_pdf",
            "evidenceRole": "paper_answer_pdf",
            "sourceEvidenceId": SOURCE_EVIDENCE_ID,
            "answerEvidenceStatus": "matched",
            "questionTextHash": question_hash,
            "answerTextHash": answer_hash,
        },
    }
    if "sourceEvidenceId" in enriched.get("sourceEvidence", {}):
        pass
    return enriched


def build_payload(input_path: Path) -> dict[str, Any]:
    if not SOURCE_PDF.exists():
        raise FileNotFoundError(SOURCE_PDF)
    payload = read_json(input_path)
    cards = payload.get("cards")
    if not isinstance(cards, list):
        raise ValueError("politics-2025 payload must contain cards[]")
    validate_cards(cards)
    enriched_cards = [enrich_card(card) for card in cards]
    validate_cards(enriched_cards)

    return {
        "id": PAPER_ID,
        "source": SOURCE_EVIDENCE_ID,
        "paperId": PAPER_ID,
        "paperName": "2025考研政治真题",
        "subject": "政治",
        "subjectKey": "politics",
        "track": "politics",
        "year": "2025",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_v1",
        "sourceFiles": [
            {
                "id": SOURCE_EVIDENCE_ID,
                "role": "paper_answer",
                "localPath": "data/raw-inbox/public-course-2025/politics/2025-politics-paper-answer-v2.pdf",
                "sha256": sha256_file(SOURCE_PDF),
                "sourceId": SOURCE_MANIFEST_ID,
            }
        ],
        "processed_at": utc_now(),
        "total_cards": len(enriched_cards),
        "cards": enriched_cards,
    }


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the release-ready 2025 politics bank.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)

    payload = build_payload(args.input)
    write_json(args.output, payload)
    print(f"[build-politics-2025] wrote {args.output} cards={payload['total_cards']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
