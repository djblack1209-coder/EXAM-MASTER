#!/usr/bin/env python3
"""
Repair missing answers in AI-cleaned flashcard files from companion answer files.

The script is intentionally conservative: by default it marks repaired answers
as candidate evidence, not publishable matched evidence. Public promotion still
depends on the flashcard quality gate and verified source evidence.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_QUEUE = PROJECT_ROOT / "data" / "cleaning-queue.json"
DEFAULT_SOURCE_MANIFEST = PROJECT_ROOT / "data" / "source-manifest.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "answer-evidence-repair-report.json"
DEFAULT_RAW_INBOX = PROJECT_ROOT / "data" / "raw-inbox"
CHOICE_TYPES = {"single_choice", "multi_choice"}
CHOICE_OPTION_LABELS = set("ABCDEFG")
ANSWER_CANDIDATE_METHOD_PRIORITY = {
    "companion_answer_key_text": 30,
    "companion_answer_key_range_text": 30,
    "companion_numbered_answer_text": 30,
    "year_number_companion_cleaned_json": 10,
}
ANSWER_PLACEHOLDERS = {
    "完整的参考答案全文",
    "完整的答案解析文本",
    "参考答案全文",
    "答案解析文本",
}


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


def load_cards(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        cards = payload.get("cards") if isinstance(payload.get("cards"), list) else payload.get("questions")
        return [card for card in (cards or []) if isinstance(card, dict)]
    if isinstance(payload, list):
        return [card for card in payload if isinstance(card, dict)]
    return []


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def hash_text(value: Any) -> str:
    normalized = normalize_text(value)
    if not normalized:
        return ""
    return "sha256:" + hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def first_non_empty(*values: Any) -> str:
    for value in values:
        text = normalize_text(value)
        if text:
            return text
    return ""


def card_id(card: dict[str, Any], index: int) -> str:
    return first_non_empty(card.get("id"), card.get("questionId"), card.get("question_id"), card.get("number")) or (
        f"card-{index + 1}"
    )


def card_year(card: dict[str, Any], payload: Any) -> str:
    if isinstance(payload, dict):
        return first_non_empty(card.get("year"), payload.get("year"))
    return first_non_empty(card.get("year"))


def card_number(card: dict[str, Any]) -> str:
    value = card.get("number")
    if value is None:
        value = card.get("questionNumber") or card.get("question_no")
    text = first_non_empty(value)
    if not text:
        return ""
    try:
        return str(int(float(text)))
    except ValueError:
        return text


def answer_key(year: str, number: str) -> str:
    return f"{year}:{number}"


def answer_range_key(year: str, number: str) -> str:
    return f"{year}:{number}:range"


def normalize_answer(answer: Any, card_type: str = "") -> str:
    text = normalize_text(answer)
    if not text:
        return ""
    normalized_type = str(card_type or "").strip()
    if normalized_type == "single_choice":
        compact = re.sub(r"[^A-Ga-g]", "", text).upper()
        return compact if re.fullmatch(r"[A-G]", compact or "") else ""
    if normalized_type in CHOICE_TYPES:
        compact = re.sub(r"[^A-Ga-g]", "", text).upper()
        return compact if re.fullmatch(r"[A-G]{1,7}", compact or "") else ""
    return text


def is_missing_answer(card: dict[str, Any]) -> bool:
    answer = normalize_text(card.get("answer"))
    return not answer or answer in ANSWER_PLACEHOLDERS


def load_queue_output_source_map(queue_path: Path | None) -> dict[str, str]:
    payload = read_json(queue_path, {}) if queue_path else {}
    tasks = payload.get("tasks") if isinstance(payload, dict) else []
    mapping: dict[str, str] = {}
    for task in tasks or []:
        if not isinstance(task, dict):
            continue
        output_path = first_non_empty(task.get("outputPath"))
        source_id = first_non_empty(task.get("sourceId"))
        if not output_path or not source_id:
            continue
        try:
            key = str(Path(output_path).expanduser().resolve())
        except OSError:
            key = output_path
        mapping[key] = source_id
    return mapping


def load_queue_output_task_map(queue_path: Path | None) -> dict[str, dict[str, Any]]:
    payload = read_json(queue_path, {}) if queue_path else {}
    tasks = payload.get("tasks") if isinstance(payload, dict) else []
    mapping: dict[str, dict[str, Any]] = {}
    for task in tasks or []:
        if not isinstance(task, dict):
            continue
        output_path = first_non_empty(task.get("outputPath"))
        if not output_path:
            continue
        try:
            key = str(Path(output_path).expanduser().resolve())
        except OSError:
            key = output_path
        mapping[key] = task
    return mapping


def resolved_path_key(path: Path | str) -> str:
    try:
        return str(Path(path).expanduser().resolve())
    except OSError:
        return str(path)


def update_queue_repair_status(
    queue_path: Path | None,
    target_path: Path,
    *,
    missing_answer_count: int,
    now: str,
) -> bool:
    if not queue_path or not queue_path.exists():
        return False

    payload = read_json(queue_path, {})
    tasks = payload.get("tasks") if isinstance(payload, dict) else []
    if not isinstance(tasks, list):
        return False

    target_key = resolved_path_key(target_path)
    changed = False
    for task in tasks:
        if not isinstance(task, dict):
            continue
        output_path = first_non_empty(task.get("outputPath"))
        if not output_path or resolved_path_key(output_path) != target_key:
            continue
        task["missingAnswerCount"] = missing_answer_count
        task["answerEvidenceStatus"] = "candidate_repaired" if missing_answer_count == 0 else "missing_answers"
        task["answerEvidenceRepairedAt"] = now
        task["updatedAt"] = now
        changed = True

    if changed:
        payload["lastAnswerEvidenceRepairAt"] = now
        write_json(queue_path, payload)
    return changed


def source_id_for_path(path: Path, output_source_map: dict[str, str]) -> str:
    try:
        return output_source_map.get(str(path.expanduser().resolve()), "")
    except OSError:
        return output_source_map.get(str(path), "")


def source_id_from_payload(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    source = first_non_empty(payload.get("source"), payload.get("sourcePath"), payload.get("fileName"))
    match = re.search(r"(src_[A-Za-z0-9]+)", source)
    return match.group(1) if match else ""


def queue_task_for_path(path: Path, output_task_map: dict[str, dict[str, Any]]) -> dict[str, Any]:
    try:
        return output_task_map.get(str(path.expanduser().resolve()), {})
    except OSError:
        return output_task_map.get(str(path), {})


def load_source_manifest(source_manifest_path: Path | None) -> dict[str, dict[str, Any]]:
    payload = read_json(source_manifest_path, {}) if source_manifest_path else {}
    items = payload.get("items") if isinstance(payload, dict) else []
    return {
        str(item.get("sourceId")): item
        for item in (items or [])
        if isinstance(item, dict) and first_non_empty(item.get("sourceId"))
    }


def source_evidence_snapshot(source_id: str, source_manifest: dict[str, dict[str, Any]]) -> dict[str, Any]:
    item = source_manifest.get(source_id, {})
    return {
        "sourceId": source_id,
        "sourceType": item.get("sourceType", ""),
        "contentHash": first_non_empty(item.get("contentHash"), item.get("sha256"), item.get("fileSha256")),
        "remotePath": first_non_empty(item.get("remotePath"), item.get("sourceUrl"), item.get("provenanceUrl")),
    }


def materialize_question_evidence(
    card: dict[str, Any],
    *,
    source_id: str,
    source_manifest: dict[str, dict[str, Any]],
) -> bool:
    if not source_id:
        return False

    changed = False
    question_hash = hash_text(first_non_empty(card.get("question"), card.get("stem")))
    if source_id and not first_non_empty(card.get("sourceEvidenceId"), card.get("source_evidence_id")):
        card["sourceEvidenceId"] = source_id
        changed = True
    if question_hash and not first_non_empty(card.get("questionTextHash"), card.get("question_text_hash")):
        card["questionTextHash"] = question_hash
        changed = True

    evidence = card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
    snapshot = source_evidence_snapshot(source_id, source_manifest)
    next_evidence = {
        **evidence,
        "evidenceId": first_non_empty(evidence.get("evidenceId"), source_id),
        "sourceId": first_non_empty(evidence.get("sourceId"), source_id),
        "sourceType": first_non_empty(evidence.get("sourceType"), snapshot.get("sourceType")),
        "contentHash": first_non_empty(evidence.get("contentHash"), snapshot.get("contentHash")),
        "remotePath": first_non_empty(evidence.get("remotePath"), snapshot.get("remotePath")),
        "questionTextHash": first_non_empty(evidence.get("questionTextHash"), card.get("questionTextHash")),
        "status": first_non_empty(evidence.get("status"), "candidate"),
        "method": first_non_empty(evidence.get("method"), "cleaned_question_text_hash"),
    }
    if next_evidence != evidence:
        card["sourceEvidence"] = next_evidence
        changed = True

    return changed


def materialize_existing_answer_evidence(card: dict[str, Any]) -> bool:
    if is_missing_answer(card):
        return False

    answer = first_non_empty(card.get("answer"))
    if not answer:
        return False

    changed = False
    answer_hash = hash_text(answer)
    if answer_hash and not first_non_empty(card.get("answerTextHash"), card.get("answer_text_hash")):
        card["answerTextHash"] = answer_hash
        changed = True
    if not first_non_empty(card.get("answerEvidenceStatus"), card.get("answer_evidence_status")):
        card["answerEvidenceStatus"] = "candidate_existing_answer"
        changed = True
    return changed


def extract_pdf_text(path: Path) -> str:
    pdftotext = shutil.which("pdftotext")
    if pdftotext:
        result = subprocess.run(
            [pdftotext, "-layout", str(path), "-"],
            text=True,
            capture_output=True,
            check=False,
            timeout=90,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout

    try:
        import fitz  # type: ignore[import-not-found]
    except Exception:  # noqa: BLE001 - optional fallback when poppler is unavailable.
        return ""

    text_parts: list[str] = []
    with fitz.open(path) as doc:
        for page in doc:
            text_parts.append(page.get_text("text"))
    return "\n".join(text_parts)


def resolve_companion_source_path(task: dict[str, Any], companion_path: Path, payload: Any) -> Path | None:
    candidates = [
        first_non_empty(task.get("localPath")),
        first_non_empty(task.get("expectedLocalPath")),
    ]
    if isinstance(payload, dict):
        source_name = first_non_empty(payload.get("source"), payload.get("sourcePath"), payload.get("fileName"))
        if source_name:
            source_path = Path(source_name)
            candidates.extend(
                [
                    str(source_path),
                    str(companion_path.parent / source_path.name),
                    str(DEFAULT_RAW_INBOX / source_path.name),
                ]
            )

    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).expanduser()
        if path.exists() and path.is_file():
            return path

    return None


def read_source_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return extract_pdf_text(path)
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def read_companion_source_text(task: dict[str, Any], companion_path: Path, payload: Any) -> tuple[str, Path | None]:
    path = resolve_companion_source_path(task, companion_path, payload)
    if not path:
        return "", None
    return read_source_text(path), path


def parse_answer_key_ranges(text: str) -> dict[str, str]:
    candidates: dict[str, str] = {}
    for match in re.finditer(r"(?<!\d)(\d{1,3})\s*[-~～]\s*(\d{1,3})\s*([A-Ga-g](?:\s*[A-Ga-g]){0,20})", text):
        start = int(match.group(1))
        end = int(match.group(2))
        if end < start or end - start > 20:
            continue
        answers = re.findall(r"[A-Ga-g]", match.group(3).upper())
        expected_count = end - start + 1
        if len(answers) < expected_count:
            continue
        for offset, answer in enumerate(answers[:expected_count]):
            candidates[str(start + offset)] = answer
    return candidates


def parse_answer_key_range_groups(text: str) -> dict[str, str]:
    groups: dict[str, str] = {}
    for match in re.finditer(r"(?<!\d)(\d{1,3})\s*[-~～]\s*(\d{1,3})\s*([A-Ga-g](?:\s*[A-Ga-g]){0,20})", text):
        start = int(match.group(1))
        end = int(match.group(2))
        if end < start or end - start > 20:
            continue
        answers = re.findall(r"[A-Ga-g]", match.group(3).upper())
        expected_count = end - start + 1
        if len(answers) < expected_count:
            continue
        groups[str(start)] = "".join(answers[:expected_count])
    return groups


def compact_numbered_answer_text(text: str) -> str:
    text = re.sub(r"\f", "\n", text or "")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n\s*(?=[\u4e00-\u9fff，。；、：“”‘’（）《》])", "", text)
    text = re.sub(r"(?<=[\u4e00-\u9fff，。；、：“”‘’（）《》])\s*\n", "", text)
    return normalize_text(text)


def parse_numbered_answer_text(text: str, *, min_number: int = 46, max_number: int = 80) -> dict[str, str]:
    answers: dict[str, str] = {}
    if not text:
        return answers

    sections = re.split(r"答案速查表", text)
    if len(sections) <= 1:
        return answers

    stop_pattern = (
        r"(?=^\s*\d{1,3}\s*[.．]\s*)"
        r"|(?=^\s*英语[（(]?\s*[一二]\s*[）)]?\s*试题)"
        r"|(?=^\s*资料不管用不用)"
        r"|(?=\f)"
        r"|\Z"
    )
    entry_pattern = re.compile(
        rf"(?ms)^\s*(\d{{1,3}})\s*[.．]\s*(.+?)({stop_pattern})",
    )

    for section in sections[1:]:
        for match in entry_pattern.finditer(section):
            number = int(match.group(1))
            if number < min_number or number > max_number:
                continue
            answer = compact_numbered_answer_text(match.group(2))
            if answer:
                answers[str(number)] = answer
    return answers


def parse_numbered_answer_point_sections(text: str, *, min_number: int = 1, max_number: int = 120) -> dict[str, str]:
    answers: dict[str, str] = {}
    if not text:
        return answers

    normalized = re.sub(r"\r\n?", "\n", text)
    entry_pattern = re.compile(
        r"(?ms)^\s*(\d{1,3})\s*[.．、]\s*【?\s*(?:答案要点|参考答案)\s*】?\s*"
        r"(.+?)"
        r"(?=^\s*\d{1,3}\s*[.．、]\s*【?\s*(?:答案要点|参考答案)\s*】?\s*|\Z)"
    )
    for match in entry_pattern.finditer(normalized):
        number = int(match.group(1))
        if number < min_number or number > max_number:
            continue
        answer = compact_numbered_answer_text(match.group(2))
        if answer:
            answers[str(number)] = answer
    return answers


def candidate_priority(item: dict[str, Any]) -> int:
    return ANSWER_CANDIDATE_METHOD_PRIORITY.get(str(item.get("method") or ""), 0)


def resolve_answer_candidate_bucket(items: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    answers = {item["answer"] for item in items}
    if len(answers) == 1:
        return items[0], []

    ranked = sorted(items, key=candidate_priority, reverse=True)
    top_priority = candidate_priority(ranked[0])
    top_answers = {item["answer"] for item in ranked if candidate_priority(item) == top_priority}
    if top_priority > 0 and len(top_answers) == 1:
        chosen = dict(ranked[0])
        chosen["conflictCandidates"] = items
        chosen["conflictResolution"] = "preferred_original_answer_key" if top_priority >= 30 else "preferred_candidate_priority"
        return chosen, []

    return None, items


def collect_answer_candidates(
    companion_paths: list[Path],
    *,
    output_source_map: dict[str, str],
    output_task_map: dict[str, dict[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, int]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    stats = {
        "structuredCandidates": 0,
        "answerKeyTextCandidates": 0,
        "answerKeyGroupCandidates": 0,
        "numberedAnswerTextCandidates": 0,
    }
    for companion_path in companion_paths:
        payload = read_json(companion_path, {})
        source_id = source_id_for_path(companion_path, output_source_map) or source_id_from_payload(payload)
        task = queue_task_for_path(companion_path, output_task_map or {})
        for index, card in enumerate(load_cards(payload)):
            year = card_year(card, payload)
            number = card_number(card)
            if not year or not number:
                continue
            answer = normalize_answer(card.get("answer"), str(card.get("type") or ""))
            if not answer or normalize_text(card.get("answer")) in ANSWER_PLACEHOLDERS:
                continue
            key = answer_key(year, number)
            buckets.setdefault(key, []).append(
                {
                    "answer": answer,
                    "explanation": first_non_empty(card.get("explanation"), card.get("analysis")),
                    "cardId": card_id(card, index),
                    "filePath": relative_path(companion_path),
                    "sourceId": source_id,
                    "method": "year_number_companion_cleaned_json",
                }
            )
            stats["structuredCandidates"] += 1

        year = first_non_empty(payload.get("year") if isinstance(payload, dict) else "", task.get("year"))
        if year:
            answer_key_text, answer_key_path = read_companion_source_text(task, companion_path, payload)
            for number, answer in parse_answer_key_ranges(answer_key_text).items():
                key = answer_key(year, number)
                buckets.setdefault(key, []).append(
                    {
                        "answer": answer,
                        "explanation": "",
                        "cardId": f"answer-key-{year}-{number}",
                        "filePath": relative_path(answer_key_path or companion_path),
                        "sourceId": source_id,
                        "method": "companion_answer_key_text",
                    }
                )
                stats["answerKeyTextCandidates"] += 1
            for number, answer in parse_answer_key_range_groups(answer_key_text).items():
                key = answer_range_key(year, number)
                buckets.setdefault(key, []).append(
                    {
                        "answer": answer,
                        "explanation": "",
                        "cardId": f"answer-key-range-{year}-{number}",
                        "filePath": relative_path(answer_key_path or companion_path),
                        "sourceId": source_id,
                        "method": "companion_answer_key_range_text",
                    }
                )
                stats["answerKeyGroupCandidates"] += 1
            for number, answer in parse_numbered_answer_text(answer_key_text).items():
                key = answer_key(year, number)
                buckets.setdefault(key, []).append(
                    {
                        "answer": answer,
                        "explanation": "",
                        "cardId": f"numbered-answer-{year}-{number}",
                        "filePath": relative_path(answer_key_path or companion_path),
                        "sourceId": source_id,
                        "method": "companion_numbered_answer_text",
                    }
                )
                stats["numberedAnswerTextCandidates"] += 1
            for number, answer in parse_numbered_answer_point_sections(answer_key_text).items():
                key = answer_key(year, number)
                buckets.setdefault(key, []).append(
                    {
                        "answer": answer,
                        "explanation": "",
                        "cardId": f"numbered-answer-point-{year}-{number}",
                        "filePath": relative_path(answer_key_path or companion_path),
                        "sourceId": source_id,
                        "method": "companion_numbered_answer_text",
                    }
                )
                stats["numberedAnswerTextCandidates"] += 1

    candidates: dict[str, dict[str, Any]] = {}
    conflicts: dict[str, list[dict[str, Any]]] = {}
    for key, items in buckets.items():
        candidate, conflict = resolve_answer_candidate_bucket(items)
        if candidate:
            candidates[key] = candidate
        else:
            conflicts[key] = conflict
    return candidates, conflicts, stats


def repair_bank(
    target_path: Path,
    companion_paths: list[Path],
    *,
    queue_path: Path | None = DEFAULT_QUEUE,
    source_manifest_path: Path | None = DEFAULT_SOURCE_MANIFEST,
    write: bool = False,
    mark_companions_supporting: bool = False,
    now: str | None = None,
) -> dict[str, Any]:
    now = now or utc_now()
    original_payload = read_json(target_path, {})
    payload = copy.deepcopy(original_payload)
    cards = load_cards(payload)
    output_source_map = load_queue_output_source_map(queue_path)
    output_task_map = load_queue_output_task_map(queue_path)
    source_manifest = load_source_manifest(source_manifest_path)
    target_source_id = source_id_for_path(target_path, output_source_map)
    answer_candidates, answer_conflicts, candidate_stats = collect_answer_candidates(
        companion_paths,
        output_source_map=output_source_map,
        output_task_map=output_task_map,
    )

    details: list[dict[str, Any]] = []
    repaired_answers = 0
    question_evidence_count = 0
    answer_evidence_count = 0
    skipped_no_candidate = 0

    for index, card in enumerate(cards):
        if materialize_question_evidence(card, source_id=target_source_id, source_manifest=source_manifest):
            question_evidence_count += 1

        if materialize_existing_answer_evidence(card):
            answer_evidence_count += 1

        if not is_missing_answer(card):
            continue

        year = card_year(card, payload)
        number = card_number(card)
        key = answer_key(year, number) if year and number else ""
        current_id = card_id(card, index)

        if key in answer_conflicts:
            details.append(
                {
                    "cardId": current_id,
                    "status": "skipped_conflict",
                    "key": key,
                    "candidates": answer_conflicts[key],
                }
            )
            continue

        card_type = str(card.get("type") or "")
        range_key = answer_range_key(year, number) if year and number else ""
        if key in answer_conflicts or (card_type not in CHOICE_TYPES and range_key in answer_conflicts):
            conflict_key = key if key in answer_conflicts else range_key
            conflict_candidates = answer_conflicts[conflict_key]
            details.append(
                {
                    "cardId": current_id,
                    "status": "skipped_conflict",
                    "key": conflict_key,
                    "candidates": conflict_candidates,
                }
            )
            continue

        candidate = None
        if card_type not in CHOICE_TYPES and range_key:
            candidate = answer_candidates.get(range_key)
        if not candidate:
            candidate = answer_candidates.get(key)
        if not candidate:
            skipped_no_candidate += 1
            details.append({"cardId": current_id, "status": "skipped_no_candidate", "key": key})
            continue

        card["answer"] = candidate["answer"]
        if candidate.get("explanation") and not first_non_empty(card.get("explanation")):
            card["explanation"] = candidate["explanation"]
        card["answerEvidenceStatus"] = "candidate_matched"
        card["answerEvidenceSourceId"] = candidate.get("sourceId", "")
        card["answerTextHash"] = hash_text(candidate["answer"])
        card["answerEvidence"] = {
            "status": "candidate_matched",
            "sourceId": candidate.get("sourceId", ""),
            "sourceCardId": candidate.get("cardId", ""),
            "sourceFilePath": candidate.get("filePath", ""),
            "answerTextHash": card["answerTextHash"],
            "method": candidate.get("method") or "year_number_companion_cleaned_json",
            "verifiedAt": "",
            "verifiedBy": "",
            "note": "Candidate answer repaired from a cleaned companion answer file; not publishable until verified.",
        }
        if candidate.get("conflictCandidates"):
            card["answerEvidence"]["conflictCandidates"] = candidate.get("conflictCandidates")
            card["answerEvidence"]["conflictResolution"] = candidate.get("conflictResolution", "")
        repaired_answers += 1
        answer_evidence_count += 1
        details.append(
            {
                "cardId": current_id,
                "status": "repaired_candidate",
                "key": key,
                "answer": candidate["answer"],
                "candidate": candidate,
            }
        )

    remaining_missing = sum(1 for card in cards if is_missing_answer(card))
    report = {
        "version": 1,
        "generatedAt": now,
        "write": write,
        "targetFile": relative_path(target_path),
        "companionFiles": [relative_path(path) for path in companion_paths],
        "targetSourceId": target_source_id,
        "summary": {
            "cardCount": len(cards),
            "repairedAnswers": repaired_answers,
            "remainingMissingAnswers": remaining_missing,
            "skippedNoCandidate": skipped_no_candidate,
            "conflictCount": len(answer_conflicts),
            "structuredCandidates": candidate_stats["structuredCandidates"],
            "answerKeyTextCandidates": candidate_stats["answerKeyTextCandidates"],
            "answerKeyGroupCandidates": candidate_stats["answerKeyGroupCandidates"],
            "numberedAnswerTextCandidates": candidate_stats["numberedAnswerTextCandidates"],
            "questionEvidenceMaterialized": question_evidence_count,
            "answerEvidenceMaterialized": answer_evidence_count,
            "supportingCompanionsMarked": 0,
            "queueUpdated": False,
        },
        "releaseReadiness": {
            "canPromoteToPublic": False,
            "reason": "Repaired answers are candidate evidence until source slices are manually or automatically verified.",
        },
        "details": details,
    }

    if write:
        if isinstance(payload, dict):
            payload["total_cards"] = len(cards)
            payload["answerEvidenceRepairedAt"] = now
        write_json(target_path, payload)
        report["summary"]["queueUpdated"] = update_queue_repair_status(
            queue_path,
            target_path,
            missing_answer_count=remaining_missing,
            now=now,
        )
        if mark_companions_supporting:
            marked = 0
            for companion_path in companion_paths:
                companion_payload = read_json(companion_path, {})
                if not isinstance(companion_payload, dict):
                    continue
                companion_payload["supportingEvidenceOnly"] = True
                companion_payload["supportingEvidenceMarkedAt"] = now
                companion_payload["supportingEvidenceUsedBy"] = str(target_path)
                write_json(companion_path, companion_payload)
                marked += 1
            report["summary"]["supportingCompanionsMarked"] = marked

    return report


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Repair missing flashcard answers from companion cleaned files.")
    parser.add_argument("--target", type=Path, required=True, help="Target flashcard JSON to repair.")
    parser.add_argument(
        "--companion",
        type=Path,
        action="append",
        default=[],
        help="Companion answer/analysis flashcard JSON. Can be repeated.",
    )
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--source-manifest", type=Path, default=DEFAULT_SOURCE_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--write", action="store_true", help="Write repairs to --target. Without this, report only.")
    parser.add_argument(
        "--mark-companions-supporting",
        action="store_true",
        help="When --write is set, mark companion files as supporting evidence so promotion gates skip them.",
    )
    args = parser.parse_args(argv)

    report = repair_bank(
        args.target,
        args.companion,
        queue_path=args.queue,
        source_manifest_path=args.source_manifest,
        write=args.write,
        mark_companions_supporting=args.mark_companions_supporting,
    )
    write_json(args.output, report)
    print(
        "[answer-evidence-repair] "
        f"write={args.write} "
        f"repaired={report['summary']['repairedAnswers']} "
        f"remainingMissing={report['summary']['remainingMissingAnswers']} "
        f"conflicts={report['summary']['conflictCount']} "
        f"report={args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
