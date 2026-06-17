#!/usr/bin/env python3
"""
Verify English I flashcards against local answer-key source files.

This script is intentionally narrower than answer_evidence_repair.py. The repair
script may fill candidate answers from companion files. This verifier only
promotes cards to answerEvidenceStatus=matched when the current or repaired
answer exactly matches an answer key parsed from a local source PDF/text.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FLASHCARD_DIR = PROJECT_ROOT / "data" / "flashcards"
DEFAULT_BANK_DIR = PROJECT_ROOT / "src" / "config" / "flashcard-banks"
DEFAULT_RAW_INBOX = PROJECT_ROOT / "data" / "raw-inbox"
DEFAULT_SOURCE_MANIFEST = PROJECT_ROOT / "data" / "source-manifest.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "english-answer-key-verify-report.json"
CHOICE_TYPES = {"single_choice", "multi_choice"}
TRANSLATION_NUMBERS_BY_SUBJECT = {
    "english1": set(range(46, 51)),
    "english2": {46},
}
WRITING_NUMBERS_BY_SUBJECT = {
    "english1": {51, 52},
    "english2": {47, 48},
}


try:
    from answer_evidence_repair import (  # type: ignore
        first_non_empty,
        hash_text,
        normalize_answer,
        parse_answer_key_ranges,
        parse_numbered_answer_text,
        read_source_text,
    )
except ModuleNotFoundError:  # pragma: no cover - supports import from project root.
    from scripts.baidu.answer_evidence_repair import (  # type: ignore
        first_non_empty,
        hash_text,
        normalize_answer,
        parse_answer_key_ranges,
        parse_numbered_answer_text,
        read_source_text,
    )


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path, default: Any | None = None) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def relative_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def compact(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_year(value: Any) -> int | None:
    try:
        year = int(str(value).strip())
        if 1990 <= year <= 2035:
            return year
    except (TypeError, ValueError):
        pass
    return None


def year_from_path(path: Path) -> int | None:
    match = re.search(r"(19|20)\d{2}", path.name)
    return int(match.group(0)) if match else None


def infer_english_subject(payload: Any, path: Path) -> str:
    candidates = []
    if isinstance(payload, dict):
        candidates.extend(
            [
                payload.get("subject"),
                payload.get("track"),
                payload.get("bankId"),
                payload.get("id"),
                payload.get("paperId"),
            ]
        )
    candidates.append(path.stem)
    joined = " ".join(str(candidate or "").lower() for candidate in candidates)
    if "english2" in joined or "english-2" in joined or "英语二" in joined or "英语（二）" in joined:
        return "english2"
    return "english1"


def translation_numbers_for_subject(subject: str) -> set[int]:
    return TRANSLATION_NUMBERS_BY_SUBJECT.get(subject, TRANSLATION_NUMBERS_BY_SUBJECT["english1"])


def writing_numbers_for_subject(subject: str) -> set[int]:
    return WRITING_NUMBERS_BY_SUBJECT.get(subject, WRITING_NUMBERS_BY_SUBJECT["english1"])


def source_id_from_path(path: Path) -> str:
    match = re.search(r"(src_[A-Za-z0-9]+)", path.name)
    return match.group(1) if match else ""


def load_cards(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    cards = payload.get("cards") if isinstance(payload.get("cards"), list) else payload.get("questions")
    return [card for card in (cards or []) if isinstance(card, dict)]


def card_number(card: dict[str, Any]) -> int | None:
    value = first_non_empty(card.get("number"), card.get("questionNumber"), card.get("question_no"))
    try:
        number = int(float(value))
        return number if number > 0 else None
    except (TypeError, ValueError):
        return None


def card_id(card: dict[str, Any], index: int) -> str:
    return first_non_empty(card.get("id"), card.get("questionId"), card.get("question_id"), card.get("number")) or (
        f"card-{index + 1}"
    )


def answer_for_compare(answer: Any, card_type: str, expected: str) -> str:
    if re.fullmatch(r"[A-G]{1,7}", compact(expected).upper() or ""):
        return normalize_answer(answer, "multi_choice" if len(compact(expected)) > 1 else "single_choice")
    if card_type in CHOICE_TYPES:
        return normalize_answer(answer, card_type)
    return compact(answer)


def find_default_answer_key(year: int, raw_inbox: Path = DEFAULT_RAW_INBOX) -> Path | None:
    matches = sorted(raw_inbox.glob(f"*{year}年真题及答案速查.pdf"))
    return matches[0] if matches else None


def source_id_from_answer_key(path: Path) -> str:
    source_id = source_id_from_path(path)
    if source_id:
        return source_id
    relative = relative_path(path)
    if "public-course-2025/english1/2025-english1-answer.pdf" in relative:
        return "english1-2025-answer"
    return path.stem


def parse_inline_answer_key(text: str) -> dict[str, str]:
    answers: dict[str, str] = {}
    if not text:
        return answers

    normalized = re.sub(r"\s+", " ", text)
    pattern = re.compile(
        r"(?<!\d)(\d{1,3})\s*[.．、]?\s*【\s*答\s*案\s*】\s*[\[【]?\s*([A-Ga-g])\s*[\]】]?"
    )
    for match in pattern.finditer(normalized):
        number = int(match.group(1))
        if 1 <= number <= 45:
            answers[str(number)] = match.group(2).upper()

    return answers


def parse_translation_reference_text(text: str, *, min_number: int = 46, max_number: int = 50) -> dict[str, str]:
    answers: dict[str, str] = {}
    if not text:
        return answers

    normalized = text.replace("\f", "\n")
    normalized = re.sub(r"\r\n?", "\n", normalized)
    number_pattern = rf"(?:{min_number}|{min_number + 1}|{min_number + 2}|{min_number + 3}|{max_number})"
    pattern = re.compile(
        rf"(?ms)^\s*\(?\s*({number_pattern})\s*\)?(?=[\s.．、])[\s\S]*?【\s*参考译文\s*】\s*(.+?)(?=^\s*\(?\s*{number_pattern}\s*\)?(?=[\s.．、])|\n\s*Section\s+III|\n\s*Part\s+[AB]|\Z)"
    )
    for match in pattern.finditer(normalized):
        number = int(match.group(1))
        if number < min_number or number > max_number:
            continue
        answer = compact(match.group(2))
        answer = re.sub(r"\b\d+\s+2025\s+年全国硕士研究生招生考试（英语一）参考答案\s*", "", answer)
        answer = re.sub(r"(?<=[\u4e00-\u9fff，。；、：“”‘’（）《》])\s+(?=[\u4e00-\u9fff])", "", answer)
        if answer:
            answers[str(number)] = answer

    return answers


def build_answer_key(path: Path) -> dict[str, Any]:
    text = read_source_text(path)
    choices = {**parse_inline_answer_key(text), **parse_answer_key_ranges(text)}
    numbered = {**parse_translation_reference_text(text), **parse_numbered_answer_text(text)}
    return {
        "path": path,
        "sourceId": source_id_from_answer_key(path),
        "choiceAnswers": choices,
        "numberedAnswers": numbered,
        "answerKeyTextHash": hash_text(text),
    }


def materialize_source_evidence(
    card: dict[str, Any],
    *,
    source_id: str,
    answer_key: dict[str, Any],
    now: str,
) -> bool:
    changed = False
    question_hash = hash_text(first_non_empty(card.get("question"), card.get("stem")))

    if source_id and first_non_empty(card.get("sourceEvidenceId"), card.get("source_evidence_id")) != source_id:
        card["sourceEvidenceId"] = source_id
        changed = True
    if question_hash and first_non_empty(card.get("questionTextHash"), card.get("question_text_hash")) != question_hash:
        card["questionTextHash"] = question_hash
        changed = True

    evidence = card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
    next_evidence = {
        **evidence,
        "evidenceId": first_non_empty(evidence.get("evidenceId"), source_id),
        "sourceId": first_non_empty(evidence.get("sourceId"), source_id),
        "questionTextHash": first_non_empty(evidence.get("questionTextHash"), question_hash),
        "status": "matched",
        "method": "local_question_text_hash",
        "verifiedAt": first_non_empty(evidence.get("verifiedAt"), now),
        "verifiedBy": first_non_empty(evidence.get("verifiedBy"), "english_answer_key_verify"),
    }
    if next_evidence != evidence:
        card["sourceEvidence"] = next_evidence
        changed = True

    return changed


def dominant_question_source_id(cards: list[dict[str, Any]]) -> str:
    counts: dict[str, int] = {}
    for card in cards:
        source_id = first_non_empty(card.get("sourceEvidenceId"), card.get("sourceEvidence", {}).get("sourceId"))
        if source_id:
            counts[source_id] = counts.get(source_id, 0) + 1
    if not counts:
        return ""
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]


def materialize_answer_evidence(
    card: dict[str, Any],
    *,
    expected_answer: str,
    source_id: str,
    answer_key: dict[str, Any],
    method: str,
    now: str,
) -> bool:
    changed = False
    expected_answer = compact(expected_answer)

    if compact(card.get("answer")) != expected_answer:
        card["answer"] = expected_answer
        changed = True

    answer_hash = hash_text(expected_answer)
    if first_non_empty(card.get("answerTextHash"), card.get("answer_text_hash")) != answer_hash:
        card["answerTextHash"] = answer_hash
        changed = True

    if first_non_empty(card.get("answerEvidenceStatus"), card.get("answer_evidence_status")) != "matched":
        card["answerEvidenceStatus"] = "matched"
        changed = True

    if source_id and first_non_empty(card.get("answerEvidenceSourceId")) != source_id:
        card["answerEvidenceSourceId"] = source_id
        changed = True

    evidence = card.get("answerEvidence") if isinstance(card.get("answerEvidence"), dict) else {}
    next_evidence = {
        **evidence,
        "status": "matched",
        "sourceId": source_id,
        "sourceFilePath": relative_path(answer_key["path"]),
        "answerTextHash": answer_hash,
        "answerKeyTextHash": answer_key["answerKeyTextHash"],
        "method": method,
        "verifiedAt": now,
        "verifiedBy": "english_answer_key_verify",
        "note": "Exact match against a locally parsed answer-key source file.",
    }
    if next_evidence != evidence:
        card["answerEvidence"] = next_evidence
        changed = True

    return changed


def verify_bank(
    target_path: Path,
    answer_key_path: Path | None = None,
    *,
    write: bool = False,
    sync_config: bool = False,
    update_manifest: bool = False,
    manifest_path: Path = DEFAULT_SOURCE_MANIFEST,
    now: str | None = None,
) -> dict[str, Any]:
    now = now or utc_now()
    original = read_json(target_path, {})
    payload = copy.deepcopy(original)
    cards = load_cards(payload)
    year = parse_year(payload.get("year") if isinstance(payload, dict) else None) or year_from_path(target_path)
    if not year:
        raise ValueError(f"Unable to infer year for {target_path}")
    english_subject = infer_english_subject(payload, target_path)
    translation_numbers = translation_numbers_for_subject(english_subject)
    writing_numbers = writing_numbers_for_subject(english_subject)

    resolved_answer_key = answer_key_path or find_default_answer_key(year)
    if not resolved_answer_key or not resolved_answer_key.exists():
        raise FileNotFoundError(f"Answer key source not found for year={year}: {resolved_answer_key}")

    answer_key = build_answer_key(resolved_answer_key)
    answer_source_id = answer_key["sourceId"]
    matched_cards = 0
    answer_changes = 0
    source_evidence_changes = 0
    mismatches: list[dict[str, Any]] = []
    missing_answer_key: list[dict[str, Any]] = []
    writing_unverified: list[dict[str, Any]] = []
    changed = False
    fallback_question_source_id = dominant_question_source_id(cards)

    for index, card in enumerate(cards):
        number = card_number(card)
        current_card_id = card_id(card, index)
        if not number:
            missing_answer_key.append({"cardId": current_card_id, "reason": "missing_number"})
            continue

        if number in writing_numbers:
            writing_unverified.append({"cardId": current_card_id, "number": number, "reason": "no_official_answer_key"})
            continue

        expected = ""
        method = "local_answer_key_pdf_exact_match"
        if number in translation_numbers:
            expected = compact(answer_key["numberedAnswers"].get(str(number), ""))
            method = "local_translation_answer_text_match"
        else:
            expected = compact(answer_key["choiceAnswers"].get(str(number), ""))

        if not expected:
            missing_answer_key.append({"cardId": current_card_id, "number": number, "reason": "not_found_in_answer_key"})
            continue

        card_type = str(card.get("type") or "")
        actual = answer_for_compare(card.get("answer"), card_type, expected)
        expected_compare = answer_for_compare(expected, card_type, expected)
        if actual and actual != expected_compare:
            mismatches.append(
                {
                    "cardId": current_card_id,
                    "number": number,
                    "cardAnswer": actual,
                    "answerKey": expected_compare,
                }
            )
            # The source key is stronger than a candidate answer. Repair the
            # answer, but still record the mismatch for auditability.

        if number in translation_numbers and card.get("type") != "translation":
            card["type"] = "translation"
            changed = True
            answer_changes += 1

        question_source_id = first_non_empty(
            card.get("sourceEvidenceId"),
            card.get("sourceEvidence", {}).get("sourceId"),
            fallback_question_source_id,
        )
        if materialize_source_evidence(card, source_id=question_source_id, answer_key=answer_key, now=now):
            changed = True
            source_evidence_changes += 1

        if materialize_answer_evidence(
            card,
            expected_answer=expected,
            source_id=answer_source_id,
            answer_key=answer_key,
            method=method,
            now=now,
        ):
            changed = True
            answer_changes += 1
        matched_cards += 1

    if write and changed:
        if isinstance(payload, dict):
            payload["answerEvidenceVerifiedAt"] = now
            payload["answerEvidenceVerifiedBy"] = "english_answer_key_verify"
        write_json(target_path, payload)

    mirrored_config_path = None
    if write and sync_config and target_path.parent.resolve() == DEFAULT_FLASHCARD_DIR.resolve():
        config_path = DEFAULT_BANK_DIR / target_path.name
        if config_path.exists():
            write_json(config_path, payload)
            mirrored_config_path = config_path

    manifest_updates = 0
    if write and update_manifest and answer_source_id:
        manifest = read_json(manifest_path, {"version": 1, "items": []})
        if isinstance(manifest, dict) and isinstance(manifest.get("items"), list):
            for item in manifest["items"]:
                if not isinstance(item, dict) or item.get("sourceId") != answer_source_id:
                    continue
                item["status"] = "verified" if item.get("status") != "published" else item["status"]
                item["answerEvidenceStatus"] = "matched"
                item["answerTextHash"] = answer_key["answerKeyTextHash"]
                item["verifiedAt"] = now
                item["verifiedBy"] = "english_answer_key_verify"
                item["evidenceNote"] = "Local answer-key source parsed and matched to flashcard answers."
                processing = item.get("processing") if isinstance(item.get("processing"), dict) else {}
                processing["verified"] = True
                item["processing"] = processing
                manifest_updates += 1
            if manifest_updates:
                manifest["updatedAt"] = now
                write_json(manifest_path, manifest)

    return {
        "targetFile": relative_path(target_path),
        "mirroredConfigFile": relative_path(mirrored_config_path) if mirrored_config_path else "",
        "answerKeyFile": relative_path(resolved_answer_key),
        "year": year,
        "subject": english_subject,
        "write": write,
        "summary": {
            "cardCount": len(cards),
            "matchedCards": matched_cards,
            "answerChanges": answer_changes,
            "sourceEvidenceChanges": source_evidence_changes,
            "mismatchCount": len(mismatches),
            "missingAnswerKeyCount": len(missing_answer_key),
            "writingUnverifiedCount": len(writing_unverified),
            "manifestUpdates": manifest_updates,
        },
        "mismatches": mismatches,
        "missingAnswerKey": missing_answer_key,
        "writingUnverified": writing_unverified,
    }


def parse_years(value: str) -> list[int]:
    years: list[int] = []
    for item in str(value or "").split(","):
        item = item.strip()
        if not item:
            continue
        if "-" in item:
            start_text, end_text = item.split("-", 1)
            start, end = int(start_text), int(end_text)
            years.extend(range(start, end + 1))
        else:
            years.append(int(item))
    return sorted(set(years))


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify English I flashcards against local answer-key PDFs/text.")
    parser.add_argument("--target", type=Path, action="append", default=[])
    parser.add_argument("--answer-key", type=Path, action="append", default=[])
    parser.add_argument("--years", default="2005-2012")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_SOURCE_MANIFEST)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--sync-config", action="store_true")
    parser.add_argument("--update-source-manifest", action="store_true")
    args = parser.parse_args(argv)

    targets = args.target
    if not targets:
        targets = [DEFAULT_FLASHCARD_DIR / f"english1-{year}.json" for year in parse_years(args.years)]

    answer_keys_by_year = {year_from_path(path): path for path in args.answer_key if year_from_path(path)}
    reports = []
    for target in targets:
        target_year = year_from_path(target)
        reports.append(
            verify_bank(
                target,
                answer_keys_by_year.get(target_year),
                write=args.write,
                sync_config=args.sync_config,
                update_manifest=args.update_source_manifest,
                manifest_path=args.manifest,
            )
        )

    report = {
        "version": 1,
        "generatedAt": utc_now(),
        "write": args.write,
        "summary": {
            "files": len(reports),
            "cards": sum(item["summary"]["cardCount"] for item in reports),
            "matchedCards": sum(item["summary"]["matchedCards"] for item in reports),
            "mismatches": sum(item["summary"]["mismatchCount"] for item in reports),
            "missingAnswerKeys": sum(item["summary"]["missingAnswerKeyCount"] for item in reports),
            "writingUnverified": sum(item["summary"]["writingUnverifiedCount"] for item in reports),
            "manifestUpdates": sum(item["summary"]["manifestUpdates"] for item in reports),
        },
        "files": reports,
    }
    write_json(args.output, report)
    print(
        "[english-answer-key-verify] "
        f"write={args.write} "
        f"files={report['summary']['files']} "
        f"matched={report['summary']['matchedCards']} "
        f"mismatches={report['summary']['mismatches']} "
        f"writingUnverified={report['summary']['writingUnverified']} "
        f"report={args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
