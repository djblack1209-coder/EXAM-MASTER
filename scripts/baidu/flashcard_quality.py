#!/usr/bin/env python3
"""
Quality gate for AI-cleaned flashcard JSON files.

This gate audits intermediate files under data/flashcards before they are
promoted into the public mini-program question bank. It does not mutate cards;
it only reports whether the cleaned output is safe to publish.
"""

from __future__ import annotations

import argparse
import json
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FLASHCARD_DIR = PROJECT_ROOT / "data" / "flashcards"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "flashcard-quality-report.json"
VALID_TYPES = {"single_choice", "multi_choice", "analysis", "short_answer", "essay", "translation", "cloze"}
CHOICE_TYPES = {"single_choice", "multi_choice"}
PUBLICATION_BLOCKED_QUALITY = {"draft", "needs_review", "needs_passage", "needs_cleaning", "source_missing"}
ENGLISH_SUBJECT_HINTS = {"english", "英语"}
ANSWER_PLACEHOLDERS = {
    "完整的参考答案全文",
    "完整的答案解析文本",
    "参考答案全文",
    "答案解析文本",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def first_non_empty(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def answer_evidence_status(card: dict[str, Any]) -> str:
    return first_non_empty(card.get("answerEvidenceStatus"), card.get("answer_evidence_status"))


def source_evidence_id(card: dict[str, Any]) -> str:
    source_evidence = card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
    return first_non_empty(card.get("sourceEvidenceId"), card.get("source_evidence_id"), source_evidence.get("evidenceId"))


def question_text_hash(card: dict[str, Any]) -> str:
    source_evidence = card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
    return first_non_empty(
        card.get("questionTextHash"),
        card.get("question_text_hash"),
        source_evidence.get("questionTextHash"),
    )


def answer_text_hash(card: dict[str, Any]) -> str:
    source_evidence = card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
    return first_non_empty(
        card.get("answerTextHash"),
        card.get("answer_text_hash"),
        source_evidence.get("answerTextHash"),
    )


def has_usable_answer(card: dict[str, Any]) -> bool:
    answer = first_non_empty(card.get("answer"))
    return bool(answer) and answer not in ANSWER_PLACEHOLDERS


def card_id(card: dict[str, Any], index: int) -> str:
    return first_non_empty(card.get("id"), card.get("questionId"), card.get("question_id"), card.get("number")) or (
        f"card-{index + 1}"
    )


def option_labels(card: dict[str, Any]) -> list[str]:
    options = card.get("options")
    if not isinstance(options, list):
        return []
    labels = []
    for option in options:
        if isinstance(option, dict):
            label = str(option.get("label") or "").strip().upper()
            text = str(option.get("text") or "").strip()
            if label and text:
                labels.append(label)
    return labels


def expected_option_labels(card: dict[str, Any]) -> list[str]:
    options = card.get("options")
    if not isinstance(options, list) or not options:
        return []
    option_count = len(options)
    if option_count < 4 or option_count > 7:
        return []
    return [chr(ord("A") + index) for index in range(option_count)]


def has_passage_material(card: dict[str, Any]) -> bool:
    return bool(first_non_empty(card.get("passage"), card.get("context"), card.get("material"), card.get("article")))


def is_english_payload(payload: Any, path: Path) -> bool:
    values: list[Any] = [path.stem]
    if isinstance(payload, dict):
        values.extend([payload.get("subject"), payload.get("subjectKey"), payload.get("track"), payload.get("paperId")])
    return any(str(value or "").strip().lower() in ENGLISH_SUBJECT_HINTS or "english" in str(value or "").lower() for value in values)


def audit_card(card: dict[str, Any], index: int, seen_ids: set[str], *, requires_passage: bool = False) -> dict[str, Any]:
    missing_fields: list[str] = []
    current_id = card_id(card, index)
    card_type = str(card.get("type") or "").strip()

    if current_id in seen_ids:
        missing_fields.append("uniqueId")
    seen_ids.add(current_id)

    if card_type not in VALID_TYPES:
        missing_fields.append("type")
    if not first_non_empty(card.get("question"), card.get("stem")):
        missing_fields.append("question")
    if not has_usable_answer(card):
        missing_fields.append("answer")
    if card_type in CHOICE_TYPES:
        expected_labels = expected_option_labels(card)
        if not expected_labels or sorted(option_labels(card)) != expected_labels:
            missing_fields.append("options=A-D-or-A-G")
    if requires_passage and card_type not in {"analysis", "essay", "translation", "short_answer"} and not has_passage_material(card):
        missing_fields.append("passage")
    if not source_evidence_id(card):
        missing_fields.append("sourceEvidenceId")
    if answer_evidence_status(card) != "matched":
        missing_fields.append("answerEvidenceStatus=matched")
    if not question_text_hash(card):
        missing_fields.append("questionTextHash")
    if not answer_text_hash(card):
        missing_fields.append("answerTextHash")

    return {
        "cardId": current_id,
        "missingFields": missing_fields,
    }


def load_cards(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        cards = payload.get("cards") if isinstance(payload.get("cards"), list) else payload.get("questions")
        return [card for card in (cards or []) if isinstance(card, dict)]
    if isinstance(payload, list):
        return [card for card in payload if isinstance(card, dict)]
    return []


def publication_status(payload: Any) -> tuple[str, list[str]]:
    if not isinstance(payload, dict):
        return "", []

    status = first_non_empty(payload.get("publicationStatus"), payload.get("status"))
    quality = first_non_empty(payload.get("quality"), payload.get("paperQuality"))
    blockers = payload.get("publicationBlockers")
    blocker_list = [str(item) for item in blockers] if isinstance(blockers, list) else []

    if status in {"draft", "pending_review", "blocked"}:
        blocker_list.append(f"publicationStatus={status}")
    if quality in PUBLICATION_BLOCKED_QUALITY:
        blocker_list.append(f"quality={quality}")

    return status, blocker_list


def supporting_evidence_reason(path: Path, payload: Any) -> str:
    if isinstance(payload, dict) and payload.get("supportingEvidenceOnly") is True:
        return "supportingEvidenceOnly"
    if "-support-" in path.stem:
        return "supportFileName"
    return ""


def infer_year(path: Path, payload: Any) -> int | None:
    values = []
    if isinstance(payload, dict):
        values.extend([payload.get("year"), payload.get("paperYear")])
    values.append(path.stem)
    for value in values:
        match = re.search(r"(19|20)\d{2}", str(value or ""))
        if match:
            return int(match.group(0))
    return None


def release_scope_skip_reason(path: Path, payload: Any, *, min_year: int, max_year: int) -> str:
    year = infer_year(path, payload)
    if year is None:
        return ""
    if year < min_year or year > max_year:
        return f"outsideReleaseYear:{year}"
    return ""


def audit_flashcard_file(path: Path, payload: Any | None = None) -> dict[str, Any]:
    payload = read_json(path) if payload is None else payload
    cards = load_cards(payload)
    seen_ids: set[str] = set()
    blocked_cards = []
    status, publication_blockers = publication_status(payload)
    requires_passage = is_english_payload(payload, path)

    for index, card in enumerate(cards):
        card_report = audit_card(card, index, seen_ids, requires_passage=requires_passage)
        if card_report["missingFields"]:
            blocked_cards.append(card_report)

    missing_answer_count = sum(1 for card in cards if not has_usable_answer(card))
    source_evidence_blocker_count = sum(
        1
        for card in cards
        if not source_evidence_id(card)
        or answer_evidence_status(card) != "matched"
        or not question_text_hash(card)
        or not answer_text_hash(card)
    )
    grading_blocker_count = sum(
        1
        for blocked in blocked_cards
        if any(
                field in {"question", "answer", "options=A-D", "options=A-D-or-A-G", "type", "uniqueId"}
                or field == "passage"
                for field in blocked["missingFields"]
            )
    )

    return {
        "filePath": str(path.relative_to(PROJECT_ROOT) if path.is_relative_to(PROJECT_ROOT) else path),
        "status": "blocked" if blocked_cards or publication_blockers else "passed",
        "publicationStatus": status,
        "publicationBlockers": publication_blockers,
        "cardCount": len(cards),
        "missingAnswerCount": missing_answer_count,
        "sourceEvidenceBlockerCount": source_evidence_blocker_count,
        "gradingBlockerCount": grading_blocker_count,
        "blockedCards": blocked_cards,
    }


def build_quality_report(
    flashcard_dir: Path = DEFAULT_FLASHCARD_DIR,
    *,
    min_year: int = 2005,
    max_year: int = 2026,
) -> dict[str, Any]:
    files = []
    if flashcard_dir.exists():
        files = sorted(path for path in flashcard_dir.glob("*.json") if path.is_file())

    file_reports = []
    skipped_files = []
    for path in files:
        payload = read_json(path)
        skip_reason = supporting_evidence_reason(path, payload)
        if skip_reason:
            skipped_files.append(
                {
                    "filePath": str(path.relative_to(PROJECT_ROOT) if path.is_relative_to(PROJECT_ROOT) else path),
                    "reason": skip_reason,
                }
            )
            continue
        skip_reason = release_scope_skip_reason(path, payload, min_year=min_year, max_year=max_year)
        if skip_reason:
            skipped_files.append(
                {
                    "filePath": str(path.relative_to(PROJECT_ROOT) if path.is_relative_to(PROJECT_ROOT) else path),
                    "reason": skip_reason,
                }
            )
            continue
        file_reports.append(audit_flashcard_file(path, payload))
    missing_answer_count = sum(item["missingAnswerCount"] for item in file_reports)
    source_evidence_blocker_count = sum(item["sourceEvidenceBlockerCount"] for item in file_reports)
    grading_blocker_count = sum(item["gradingBlockerCount"] for item in file_reports)
    blocker_count = sum(len(item["blockedCards"]) for item in file_reports)
    publication_blocker_count = sum(len(item.get("publicationBlockers", [])) for item in file_reports)

    return {
        "version": 1,
        "generatedAt": utc_now(),
        "scope": {
            "minYear": min_year,
            "maxYear": max_year,
        },
        "flashcardDir": str(
            flashcard_dir.relative_to(PROJECT_ROOT) if flashcard_dir.is_relative_to(PROJECT_ROOT) else flashcard_dir
        ),
        "summary": {
            "fileCount": len(file_reports),
            "skippedFileCount": len(skipped_files),
            "cardCount": sum(item["cardCount"] for item in file_reports),
            "missingAnswerCount": missing_answer_count,
            "sourceEvidenceBlockerCount": source_evidence_blocker_count,
            "gradingBlockerCount": grading_blocker_count,
            "publicationBlockerCount": publication_blocker_count,
            "blockerCount": blocker_count,
        },
        "skippedFiles": skipped_files,
        "files": file_reports,
        "releaseReadiness": {
            "canPromoteToPublic": blocker_count == 0 and publication_blocker_count == 0,
            "blockers": {
                "missingAnswers": missing_answer_count,
                "sourceEvidence": source_evidence_blocker_count,
                "grading": grading_blocker_count,
                "publication": publication_blocker_count,
            },
        },
    }


def print_help() -> None:
    print(
        """Usage:
  python3 scripts/baidu/flashcard_quality.py [options]

Options:
  --flashcard-dir <path>   Directory containing AI-cleaned flashcard JSON files
  --min-year <year>        First release-scope year to audit
  --max-year <year>        Last release-scope year to audit
  --output <path>          JSON report path
  --fail-on-blockers       Exit 2 when any cleaned card cannot be promoted
  --self-test              Run built-in flashcard quality assertions
"""
    )


def run_self_test() -> None:
    passing_payload = {
        "paperId": "english1-2025",
        "subjectKey": "english",
        "year": 2025,
        "cards": [
            {
                "id": "e1-2025-1",
                "type": "single_choice",
                "question": "What is the best title for the passage?",
                "passage": "A verified passage excerpt used for self-test.",
                "options": [
                    {"label": "A", "text": "Option A"},
                    {"label": "B", "text": "Option B"},
                    {"label": "C", "text": "Option C"},
                    {"label": "D", "text": "Option D"},
                ],
                "answer": "A",
                "sourceEvidenceId": "src_self_test",
                "answerEvidenceStatus": "matched",
                "questionTextHash": "sha256:question",
                "answerTextHash": "sha256:answer",
            },
            {
                "id": "e1-2025-translation",
                "type": "translation",
                "question": "Translate the underlined sentence.",
                "answer": "A verified translation answer.",
                "sourceEvidenceId": "src_self_test_translation",
                "answerEvidenceStatus": "matched",
                "questionTextHash": "sha256:translation-question",
                "answerTextHash": "sha256:translation-answer",
            },
        ],
    }

    passed = audit_flashcard_file(PROJECT_ROOT / "data/flashcards/english1-2025-self-test.json", passing_payload)
    assert passed["status"] == "passed"
    assert passed["cardCount"] == 2
    assert passed["blockedCards"] == []

    blocked_payload = {
        "paperId": "english1-2025",
        "subjectKey": "english",
        "publicationStatus": "draft",
        "quality": "needs_passage",
        "cards": [
            {
                "id": "duplicate",
                "type": "single_choice",
                "question": "Missing passage and usable evidence.",
                "options": [
                    {"label": "A", "text": "Option A"},
                    {"label": "B", "text": "Option B"},
                    {"label": "C", "text": "Option C"},
                ],
                "answer": "完整的参考答案全文",
            },
            {
                "id": "duplicate",
                "type": "single_choice",
                "question": "Duplicate id should be blocked.",
                "passage": "Passage is present on the duplicate card.",
                "options": [
                    {"label": "A", "text": "Option A"},
                    {"label": "B", "text": "Option B"},
                    {"label": "C", "text": "Option C"},
                    {"label": "D", "text": "Option D"},
                ],
                "answer": "B",
                "sourceEvidenceId": "src_duplicate",
                "answerEvidenceStatus": "matched",
                "questionTextHash": "sha256:duplicate-question",
                "answerTextHash": "sha256:duplicate-answer",
            },
        ],
    }
    blocked = audit_flashcard_file(PROJECT_ROOT / "data/flashcards/english1-2025-blocked-self-test.json", blocked_payload)
    assert blocked["status"] == "blocked"
    assert blocked["missingAnswerCount"] == 1
    assert blocked["sourceEvidenceBlockerCount"] == 1
    assert "publicationStatus=draft" in blocked["publicationBlockers"]
    assert "quality=needs_passage" in blocked["publicationBlockers"]
    assert set(blocked["blockedCards"][0]["missingFields"]) == {
        "answer",
        "options=A-D-or-A-G",
        "passage",
        "sourceEvidenceId",
        "answerEvidenceStatus=matched",
        "questionTextHash",
        "answerTextHash",
    }
    assert blocked["blockedCards"][1]["missingFields"] == ["uniqueId"]

    support_payload = {"supportingEvidenceOnly": True, "cards": [{"id": "support"}]}
    outside_scope_payload = {"paperId": "english1-2030", "year": 2030, "cards": [{"id": "future"}]}
    with tempfile.TemporaryDirectory(prefix="exam-master-flashcard-quality-") as temp_dir:
        flashcard_dir = Path(temp_dir)
        write_json(flashcard_dir / "english1-2025.json", passing_payload)
        write_json(flashcard_dir / "english1-2025-support.json", support_payload)
        write_json(flashcard_dir / "english1-2030.json", outside_scope_payload)
        report = build_quality_report(flashcard_dir, min_year=2005, max_year=2026)

    assert report["summary"]["fileCount"] == 1
    assert report["summary"]["skippedFileCount"] == 2
    assert report["releaseReadiness"]["canPromoteToPublic"] is True
    assert {item["reason"] for item in report["skippedFiles"]} == {"supportingEvidenceOnly", "outsideReleaseYear:2030"}
    print("[flashcard-quality] self-test passed")


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit cleaned flashcard JSON files before public promotion.")
    parser.add_argument("--flashcard-dir", type=Path, default=DEFAULT_FLASHCARD_DIR)
    parser.add_argument("--min-year", type=int, default=2005)
    parser.add_argument("--max-year", type=int, default=2026)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--fail-on-blockers", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)

    if args.self_test:
        run_self_test()
        return 0

    if args.min_year > args.max_year:
        raise SystemExit("--min-year must be <= --max-year")

    report = build_quality_report(args.flashcard_dir, min_year=args.min_year, max_year=args.max_year)
    write_json(args.output, report)
    print(
        "[flashcard-quality] "
        f"canPromoteToPublic={report['releaseReadiness']['canPromoteToPublic']} "
        f"files={report['summary']['fileCount']} "
        f"cards={report['summary']['cardCount']} "
        f"blockers={report['summary']['blockerCount']} "
        f"report={args.output}"
    )

    return 2 if args.fail_on_blockers and not report["releaseReadiness"]["canPromoteToPublic"] else 0


if __name__ == "__main__":
    raise SystemExit(run())
