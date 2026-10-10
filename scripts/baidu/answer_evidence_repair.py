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
import os
import re
import shutil
import subprocess
import tempfile
import time
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
MIN_CHOICE_OPTION_COUNT = 4
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
        cards = (
            payload.get("cards")
            if isinstance(payload.get("cards"), list)
            else payload.get("questions")
        )
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


def safe_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def queue_output_task_rank(task: dict[str, Any]) -> tuple[int, int, int, int, int]:
    quality_issues = (
        task.get("qualityIssues") if isinstance(task.get("qualityIssues"), list) else []
    )
    status_score = 1 if str(task.get("status") or "") == "completed" else 0
    return (
        safe_int(task.get("questionCount")),
        -len(quality_issues),
        -safe_int(task.get("missingAnswerCount")),
        status_score,
        -safe_int(task.get("attempts")),
    )


def choose_better_queue_output_task(
    current: dict[str, Any] | None, candidate: dict[str, Any]
) -> dict[str, Any]:
    if not current:
        return candidate
    return (
        candidate
        if queue_output_task_rank(candidate) > queue_output_task_rank(current)
        else current
    )


def card_id(card: dict[str, Any], index: int) -> str:
    return first_non_empty(
        card.get("id"),
        card.get("questionId"),
        card.get("question_id"),
        card.get("number"),
    ) or (f"card-{index + 1}")


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


def normalize_option_label(value: Any, fallback: str = "") -> str:
    label = normalize_text(value).upper()
    if label in CHOICE_OPTION_LABELS:
        return label
    fallback = normalize_text(fallback).upper()
    return fallback if fallback in CHOICE_OPTION_LABELS else ""


def normalize_option_text(value: Any, label: str) -> str:
    text = normalize_text(value)
    if label:
        text = re.sub(rf"^{re.escape(label)}\s*[.．、)]\s*", "", text, flags=re.IGNORECASE)
    return text


def normalize_choice_options(options: Any) -> list[dict[str, str]]:
    if not isinstance(options, list):
        return []

    normalized: list[dict[str, str]] = []
    seen_labels: set[str] = set()
    for index, option in enumerate(options):
        if not isinstance(option, dict):
            continue
        fallback_label = chr(ord("A") + index) if index < len(CHOICE_OPTION_LABELS) else ""
        label = normalize_option_label(option.get("label"), fallback_label)
        text = normalize_option_text(
            first_non_empty(option.get("text"), option.get("content"), option.get("value")),
            label,
        )
        if not label or label in seen_labels or not text:
            continue
        normalized.append({"label": label, "text": text})
        seen_labels.add(label)

    normalized.sort(key=lambda item: item["label"])
    return normalized


OPTION_MARK_PATTERN = re.compile(r"(?m)^\s*[［\[]\s*([A-Ga-g])\s*[］\]]\s*")
DOTTED_OPTION_MARK_PATTERN = re.compile(r"(?<![A-Za-z])([A-Ga-g])\s*[.．]\s+")


def clean_source_option_text(text: str) -> str:
    text = re.split(r"(?m)^\s*(?:\d{1,3}\s*[.．]|Part\s+[A-Z]\b|Section\s+\S+\b)", text)[0]
    text = re.sub(r"(?m)^---\s*PAGE\s+\d+\s*---$", " ", text)
    text = re.sub(r"(?m)^英语[（(].*?共\s*\d+\s*页.*$", " ", text)
    text = re.sub(r"(?m)^全年免费分享各类资源$", " ", text)
    return normalize_text(text)


def parse_labeled_source_options(text: str) -> list[dict[str, str]]:
    raw_matches = list(OPTION_MARK_PATTERN.finditer(text or "")) + list(
        DOTTED_OPTION_MARK_PATTERN.finditer(text or "")
    )
    matches = sorted(raw_matches, key=lambda item: item.start())
    options: list[dict[str, str]] = []
    seen_labels: set[str] = set()
    for index, match in enumerate(matches):
        label = normalize_option_label(match.group(1))
        if not label or label in seen_labels:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        option_text = clean_source_option_text(text[match.end() : end])
        if not option_text:
            continue
        options.append({"label": label, "text": option_text})
        seen_labels.add(label)
    options.sort(key=lambda item: item["label"])
    return options


def parse_numbered_choice_options(text: str) -> dict[str, list[dict[str, str]]]:
    options_by_number: dict[str, list[dict[str, str]]] = {}
    if not text:
        return options_by_number

    question_matches = list(re.finditer(r"(?m)^\s*(\d{1,3})\s*[.．]\s+", text))
    for index, match in enumerate(question_matches):
        number = int(match.group(1))
        if number < 1 or number > 80:
            continue
        end = (
            question_matches[index + 1].start() if index + 1 < len(question_matches) else len(text)
        )
        block = text[match.start() : end]
        options = parse_labeled_source_options(block)
        if len(options) >= MIN_CHOICE_OPTION_COUNT:
            options_by_number[str(number)] = options
    return options_by_number


def parse_english_new_type_options(text: str) -> dict[str, list[dict[str, str]]]:
    if not text:
        return {}

    match = re.search(
        r"(?ims)(?:Part\s+B\b.*?)?For\s+Questions\s+41\s*[-~～]\s*45\b.+?(?=^\s*Part\s+C\b|\Z)",
        text,
    )
    if not match:
        return {}

    options = parse_labeled_source_options(match.group(0))
    labels = {option["label"] for option in options}
    if not set("ABCDEFG").issubset(labels):
        return {}
    return {str(number): copy.deepcopy(options) for number in range(41, 46)}


def has_incomplete_choice_options(card: dict[str, Any]) -> bool:
    if str(card.get("type") or "") not in CHOICE_TYPES:
        return False
    return len(normalize_choice_options(card.get("options"))) < MIN_CHOICE_OPTION_COUNT


def is_missing_answer(card: dict[str, Any]) -> bool:
    answer = normalize_text(card.get("answer"))
    return not answer or answer in ANSWER_PLACEHOLDERS


def load_queue_output_source_map(queue_path: Path | None) -> dict[str, str]:
    payload = read_json(queue_path, {}) if queue_path else {}
    tasks = payload.get("tasks") if isinstance(payload, dict) else []
    task_mapping: dict[str, dict[str, Any]] = {}
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
        task_mapping[key] = choose_better_queue_output_task(task_mapping.get(key), task)
    return {key: first_non_empty(task.get("sourceId")) for key, task in task_mapping.items()}


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
        mapping[key] = choose_better_queue_output_task(mapping.get(key), task)
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
        task["answerEvidenceStatus"] = (
            "candidate_repaired" if missing_answer_count == 0 else "missing_answers"
        )
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
    explicit_source_id = first_non_empty(payload.get("sourceId"), payload.get("source_id"))
    if explicit_source_id:
        return explicit_source_id
    source = first_non_empty(
        payload.get("source"), payload.get("sourcePath"), payload.get("fileName")
    )
    match = re.search(r"(src_[A-Za-z0-9]+)", source)
    return match.group(1) if match else ""


def queue_task_for_path(path: Path, output_task_map: dict[str, dict[str, Any]]) -> dict[str, Any]:
    try:
        return output_task_map.get(str(path.expanduser().resolve()), {})
    except OSError:
        return output_task_map.get(str(path), {})


def load_source_manifest(
    source_manifest_path: Path | None,
) -> dict[str, dict[str, Any]]:
    payload = read_json(source_manifest_path, {}) if source_manifest_path else {}
    items = payload.get("items") if isinstance(payload, dict) else []
    return {
        str(item.get("sourceId")): item
        for item in (items or [])
        if isinstance(item, dict) and first_non_empty(item.get("sourceId"))
    }


def source_evidence_snapshot(
    source_id: str, source_manifest: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    item = source_manifest.get(source_id, {})
    return {
        "sourceId": source_id,
        "sourceType": item.get("sourceType", ""),
        "contentHash": first_non_empty(
            item.get("contentHash"), item.get("sha256"), item.get("fileSha256")
        ),
        "remotePath": first_non_empty(
            item.get("remotePath"), item.get("sourceUrl"), item.get("provenanceUrl")
        ),
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
    if source_id and not first_non_empty(
        card.get("sourceEvidenceId"), card.get("source_evidence_id")
    ):
        card["sourceEvidenceId"] = source_id
        changed = True
    if question_hash and not first_non_empty(
        card.get("questionTextHash"), card.get("question_text_hash")
    ):
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
        "questionTextHash": first_non_empty(
            evidence.get("questionTextHash"), card.get("questionTextHash")
        ),
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
    if answer_hash and not first_non_empty(
        card.get("answerTextHash"), card.get("answer_text_hash")
    ):
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
    text = "\n".join(text_parts)
    if normalize_text(text):
        return text

    return extract_pdf_text_with_apple_ocr(path)


def extract_pdf_text_with_apple_ocr(path: Path) -> str:
    try:
        import fitz  # type: ignore[import-not-found]
        from ocrmac import ocrmac  # type: ignore[import-not-found]
    except Exception:  # noqa: BLE001 - OCR is an optional local fallback.
        return ""

    text_parts: list[str] = []
    start = time.time()
    with fitz.open(path) as doc:
        total = doc.page_count
        for index, page in enumerate(doc):
            pix = page.get_pixmap(dpi=250)
            image_path = Path(f"/tmp/answer-evidence-repair-ocr-{os.getpid()}-{index}.png")
            pix.save(str(image_path))
            try:
                anns = ocrmac.OCR(
                    str(image_path), language_preference=["zh-Hans", "en-US"]
                ).recognize()
                sorted_anns = sorted(anns, key=lambda item: (1 - item[2][1], item[2][0]))
                page_text = "\n".join(item[0] for item in sorted_anns if str(item[0]).strip())
                text_parts.append(f"\n--- PAGE {index + 1} ---\n{page_text}\n")
            finally:
                try:
                    image_path.unlink()
                except OSError:
                    pass
            if (index + 1) % 10 == 0:
                print(f"  OCR progress: {index + 1}/{total}")
    elapsed = time.time() - start
    text = "\n".join(text_parts)
    if text:
        print(
            f"  OCR completed: {path.name} pages={len(text_parts)} seconds={elapsed:.1f} chars={len(text)}"
        )
    return text


def resolve_companion_source_path(
    task: dict[str, Any], companion_path: Path, payload: Any
) -> Path | None:
    candidates = [
        first_non_empty(task.get("localPath")),
        first_non_empty(task.get("expectedLocalPath")),
    ]
    if isinstance(payload, dict):
        source_name = first_non_empty(
            payload.get("source"), payload.get("sourcePath"), payload.get("fileName")
        )
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


def read_companion_source_text(
    task: dict[str, Any], companion_path: Path, payload: Any
) -> tuple[str, Path | None]:
    path = resolve_companion_source_path(task, companion_path, payload)
    if not path:
        return "", None
    return read_source_text(path), path


def parse_answer_key_ranges(text: str) -> dict[str, str]:
    candidates: dict[str, str] = {}
    for match in re.finditer(
        r"(?<!\d)(\d{1,3})\s*[-~～]\s*(\d{1,3})\s*([A-Ga-g](?:\s*[A-Ga-g]){0,20})", text
    ):
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
    for match in re.finditer(
        r"(?<!\d)(\d{1,3})\s*[-~～]\s*(\d{1,3})\s*([A-Ga-g](?:\s*[A-Ga-g]){0,20})", text
    ):
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


def parse_numbered_answer_text(
    text: str, *, min_number: int = 46, max_number: int = 80
) -> dict[str, str]:
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


def parse_numbered_answer_point_sections(
    text: str, *, min_number: int = 1, max_number: int = 120
) -> dict[str, str]:
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


def resolve_answer_candidate_bucket(
    items: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    answers = {item["answer"] for item in items}
    if len(answers) == 1:
        return items[0], []

    ranked = sorted(items, key=candidate_priority, reverse=True)
    top_priority = candidate_priority(ranked[0])
    top_answers = {item["answer"] for item in ranked if candidate_priority(item) == top_priority}
    if top_priority > 0 and len(top_answers) == 1:
        chosen = dict(ranked[0])
        chosen["conflictCandidates"] = items
        chosen["conflictResolution"] = (
            "preferred_original_answer_key"
            if top_priority >= 30
            else "preferred_candidate_priority"
        )
        return chosen, []

    return None, items


def option_signature(options: list[dict[str, str]]) -> tuple[tuple[str, str], ...]:
    return tuple((option["label"], option["text"]) for option in options)


def resolve_option_candidate_bucket(
    items: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    signatures = {option_signature(item["options"]) for item in items}
    if len(signatures) == 1:
        return items[0], []
    return None, items


def collect_option_candidates(
    companion_paths: list[Path],
    *,
    output_source_map: dict[str, str],
) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, int]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    stats = {"structuredOptionCandidates": 0}
    for companion_path in companion_paths:
        payload = read_json(companion_path, {})
        source_id = source_id_for_path(companion_path, output_source_map) or source_id_from_payload(
            payload
        )
        for index, card in enumerate(load_cards(payload)):
            if str(card.get("type") or "") not in CHOICE_TYPES:
                continue
            year = card_year(card, payload)
            number = card_number(card)
            if not year or not number:
                continue
            options = normalize_choice_options(card.get("options"))
            if len(options) < MIN_CHOICE_OPTION_COUNT:
                continue
            key = answer_key(year, number)
            buckets.setdefault(key, []).append(
                {
                    "options": options,
                    "cardId": card_id(card, index),
                    "filePath": relative_path(companion_path),
                    "sourceId": source_id,
                    "method": "year_number_companion_cleaned_json",
                }
            )
            stats["structuredOptionCandidates"] += 1

    candidates: dict[str, dict[str, Any]] = {}
    conflicts: dict[str, list[dict[str, Any]]] = {}
    for key, items in buckets.items():
        candidate, conflict = resolve_option_candidate_bucket(items)
        if candidate:
            candidates[key] = candidate
        else:
            conflicts[key] = conflict
    return candidates, conflicts, stats


def collect_source_option_candidates(
    text: str,
    *,
    year: str,
    source_id: str,
    source_path: Path | None,
) -> tuple[dict[str, dict[str, Any]], dict[str, int]]:
    candidates: dict[str, dict[str, Any]] = {}
    stats = {"sourceOptionCandidates": 0}
    if not text or not year:
        return candidates, stats

    merged = parse_numbered_choice_options(text)
    merged.update(parse_english_new_type_options(text))
    for number, options in merged.items():
        key = answer_key(year, number)
        candidates[key] = {
            "options": options,
            "cardId": f"source-option-{year}-{number}",
            "filePath": relative_path(source_path) if source_path else "",
            "sourceId": source_id,
            "method": "target_source_option_text",
        }
        stats["sourceOptionCandidates"] += 1
    return candidates, stats


def collect_companion_source_option_candidates(
    companion_paths: list[Path],
    *,
    output_source_map: dict[str, str],
    output_task_map: dict[str, dict[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, int]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    stats = {"companionSourceOptionCandidates": 0}

    for companion_path in companion_paths:
        payload = read_json(companion_path, {})
        if not isinstance(payload, dict):
            continue
        task = queue_task_for_path(companion_path, output_task_map or {})
        source_text, source_path = read_companion_source_text(task, companion_path, payload)
        year = first_non_empty(payload.get("year"), task.get("year"))
        source_id = source_id_for_path(companion_path, output_source_map) or source_id_from_payload(
            payload
        )
        source_candidates, source_stats = collect_source_option_candidates(
            source_text,
            year=year,
            source_id=source_id,
            source_path=source_path,
        )
        stats["companionSourceOptionCandidates"] += source_stats["sourceOptionCandidates"]
        for key, candidate in source_candidates.items():
            candidate = dict(candidate)
            candidate["method"] = "companion_source_option_text"
            buckets.setdefault(key, []).append(candidate)

    candidates: dict[str, dict[str, Any]] = {}
    conflicts: dict[str, list[dict[str, Any]]] = {}
    for key, items in buckets.items():
        candidate, conflict = resolve_option_candidate_bucket(items)
        if candidate:
            candidates[key] = candidate
        else:
            conflicts[key] = conflict
    return candidates, conflicts, stats


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
        source_id = source_id_for_path(companion_path, output_source_map) or source_id_from_payload(
            payload
        )
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

        year = first_non_empty(
            payload.get("year") if isinstance(payload, dict) else "", task.get("year")
        )
        if year:
            answer_key_text, answer_key_path = read_companion_source_text(
                task, companion_path, payload
            )
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
    target_task = queue_task_for_path(target_path, output_task_map)
    target_source_text, target_source_path = read_companion_source_text(
        target_task, target_path, payload
    )
    target_year = first_non_empty(
        payload.get("year") if isinstance(payload, dict) else "",
        target_task.get("year"),
    )
    answer_candidates, answer_conflicts, candidate_stats = collect_answer_candidates(
        companion_paths,
        output_source_map=output_source_map,
        output_task_map=output_task_map,
    )
    option_candidates, option_conflicts, option_candidate_stats = collect_option_candidates(
        companion_paths,
        output_source_map=output_source_map,
    )
    (
        companion_source_option_candidates,
        companion_source_option_conflicts,
        companion_source_option_stats,
    ) = collect_companion_source_option_candidates(
        companion_paths,
        output_source_map=output_source_map,
        output_task_map=output_task_map,
    )
    source_option_candidates, source_option_stats = collect_source_option_candidates(
        target_source_text,
        year=target_year,
        source_id=target_source_id,
        source_path=target_source_path,
    )

    details: list[dict[str, Any]] = []
    repaired_answers = 0
    repaired_options = 0
    question_evidence_count = 0
    answer_evidence_count = 0
    skipped_no_candidate = 0

    for index, card in enumerate(cards):
        if materialize_question_evidence(
            card, source_id=target_source_id, source_manifest=source_manifest
        ):
            question_evidence_count += 1

        if materialize_existing_answer_evidence(card):
            answer_evidence_count += 1

        year = card_year(card, payload)
        number = card_number(card)
        key = answer_key(year, number) if year and number else ""
        current_id = card_id(card, index)

        if has_incomplete_choice_options(card) and key:
            if key in option_conflicts or key in companion_source_option_conflicts:
                conflicts = (
                    option_conflicts.get(key) or companion_source_option_conflicts.get(key) or []
                )
                details.append(
                    {
                        "cardId": current_id,
                        "status": "skipped_option_conflict",
                        "key": key,
                        "candidates": conflicts,
                    }
                )
            else:
                option_candidate = (
                    option_candidates.get(key)
                    or source_option_candidates.get(key)
                    or companion_source_option_candidates.get(key)
                )
                if option_candidate:
                    option_method = (
                        option_candidate.get("method") or "year_number_companion_cleaned_json"
                    )
                    option_note = (
                        "Candidate options repaired from target source text; not publishable until verified."
                        if option_method == "target_source_option_text"
                        else "Candidate options repaired from companion source text; not publishable until verified."
                        if option_method == "companion_source_option_text"
                        else "Candidate options repaired from a cleaned companion file; not publishable until verified."
                    )
                    card["options"] = copy.deepcopy(option_candidate["options"])
                    card["optionEvidence"] = {
                        "status": "candidate_matched",
                        "sourceId": option_candidate.get("sourceId", ""),
                        "sourceCardId": option_candidate.get("cardId", ""),
                        "sourceFilePath": option_candidate.get("filePath", ""),
                        "method": option_method,
                        "verifiedAt": "",
                        "verifiedBy": "",
                        "note": option_note,
                    }
                    repaired_options += 1
                    details.append(
                        {
                            "cardId": current_id,
                            "status": "repaired_options_candidate",
                            "key": key,
                            "candidate": option_candidate,
                        }
                    )

        if not is_missing_answer(card):
            continue

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
        if key in answer_conflicts or (
            card_type not in CHOICE_TYPES and range_key in answer_conflicts
        ):
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
            "repairedOptions": repaired_options,
            "remainingMissingAnswers": remaining_missing,
            "skippedNoCandidate": skipped_no_candidate,
            "conflictCount": len(answer_conflicts),
            "optionConflictCount": len(option_conflicts) + len(companion_source_option_conflicts),
            "structuredCandidates": candidate_stats["structuredCandidates"],
            "structuredOptionCandidates": option_candidate_stats["structuredOptionCandidates"],
            "sourceOptionCandidates": source_option_stats["sourceOptionCandidates"],
            "companionSourceOptionCandidates": companion_source_option_stats[
                "companionSourceOptionCandidates"
            ],
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


POLITICS_REFERENCE_SOURCES = {
    "question": (
        "src_94b2105814110617930cf327-2023考研政治真题.pdf",
        "4aef48bae3e0b375d189d322d972163baac142b1eaa39233d8ac9bcb3b659c19",
    ),
    "answer": (
        "src_6d757672897de533d4ff50b6-2023考研政治真题及答案解析.pdf",
        "0500287d65670a8443f011025da2bc0b3d594cb00e0c547d8f47504d3016552d",
    ),
}
POLITICS_REFERENCE_BLOCKER = "reference_rights_and_scoring_authority_not_verified"
POLITICS_SUPPLEMENT_SOURCE = (
    "src_c1f32165212f2a00169bb748-2023考研政治补充出版方参考.pdf",
    "c1f32165212f2a00169bb748f08082960c60420e7fa1edacca09e23f1bb99b04",
)
POLITICS_SUPPLEMENT_URL = "https://m.juyingonline.com/upload/202212/24/202212241934001128.pdf"
# Page 3 was visually reviewed. Its paraphrased stems and OCR differences must
# never replace the original paper; only these two reviewed answer mappings apply.
POLITICS_SUPPLEMENT_BLOCKS = {
    10: ("D", "d38108817e17c3dc448c550c0942c90706b9567ea2d85299cffad00d58c98649"),
    11: ("A", "51a1f69949a21f8ac6c35c10b9f2130630752d6e432dd2772ec22aa5c5f59630"),
}


def read_politics_supplement_source(path: Path) -> dict[int, dict[str, Any]]:
    import fitz

    expected_path = PROJECT_ROOT / "data/raw-inbox" / POLITICS_SUPPLEMENT_SOURCE[0]
    if path.is_symlink() or path.resolve() != expected_path or not path.is_file():
        raise ValueError("Unregistered politics supplement source path")
    st = path.stat()
    identity = (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)
    if st.st_size > 1024 * 1024:
        raise ValueError("Registered politics supplement exceeds limit")
    raw = path.read_bytes()
    if (
        not raw.startswith(b"%PDF-")
        or hashlib.sha256(raw).hexdigest() != POLITICS_SUPPLEMENT_SOURCE[1]
    ):
        raise ValueError("Registered politics supplement bytes mismatch")
    with fitz.open(stream=raw, filetype="pdf") as document:
        if len(document) != 10:
            raise ValueError("Politics supplement page count mismatch")
        text = document[2].get_text()
    marks = list(re.finditer(r"(?m)^(\d{1,2})\.", text))
    if [int(mark[1]) for mark in marks] != [9, 10, 11, 12, 13]:
        raise ValueError("Politics supplement question numbers mismatch")
    rows = {}
    for index, mark in enumerate(marks):
        number = int(mark[1])
        if number not in POLITICS_SUPPLEMENT_BLOCKS:
            continue
        block = text[mark.end() : marks[index + 1].start()]
        answer, expected_block_hash = POLITICS_SUPPLEMENT_BLOCKS[number]
        if hashlib.sha256(block.encode("utf-8")).hexdigest() != expected_block_hash:
            raise ValueError("Politics supplement reviewed text mismatch")
        question, reference = block.split("答案：", 1)
        options = list(re.finditer(r"(?m)^([A-D])\.", question))
        if [option[1] for option in options] != list("ABCD") or not reference.startswith(
            answer + "："
        ):
            raise ValueError("Politics supplement option or answer mismatch")
        rows[number] = {
            "answer": answer,
            "proof": {
                "sourceId": "src_c1f32165212f2a00169bb748",
                "filePath": relative_path(path),
                "fileSha256": "sha256:" + POLITICS_SUPPLEMENT_SOURCE[1],
                "sourceURL": POLITICS_SUPPLEMENT_URL,
                "page": 3,
                "number": number,
                "sourceBlockSha256": "sha256:" + expected_block_hash,
                "questionMapping": "visually_reviewed_paraphrase_with_same_option_order",
                "sourceRole": "publisher_reference",
                "scoringAuthority": False,
                "rightsStatus": "not_verified",
            },
        }
    st = path.stat()
    if identity != (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns):
        raise ValueError("Politics supplement changed during verification")
    return rows


def politics_row_reference_proof(row: dict[str, Any], identity: dict[str, Any]) -> dict[str, Any]:
    supplement = row.get("supplementProof")
    proof = {
        **identity["proof"],
        "answerState": "matched_supplement_reference"
        if supplement
        else "missing_reference"
        if row["answer"] is None
        else "matched_reference",
    }
    if supplement:
        proof["supplementProof"] = supplement
    return proof


def politics_reference_payload(card: dict[str, Any], proof: dict[str, Any]) -> dict[str, Any]:
    fields = ["id", "number", "type", "question", "options", "answer", "explanation"]
    return {key: card.get(key) for key in fields} | {
        key: value for key, value in proof.items() if key != "contentHash"
    }


def clean_politics_source_text(text: str) -> str:
    # Only remove the known page decoration; never strip arbitrary source lines.
    text = re.sub(r"(?m)^\s*公众号【研池大叔】，免费分享考研干货！\s*$", "", text)
    text = re.sub(r"(?m)^[ \t]*[•·-][ \t]*\d{1,2}[ \t]*[•·][ \t]*$", "", text)
    return text


def parse_politics_reference_texts(question_text: str, answer_text: str) -> list[dict[str, Any]]:
    question_text, answer_text = map(clean_politics_source_text, [question_text, answer_text])
    prefix = r"(?m)^[ \t]*\*?[ \t]*(\d{1,2})[ \t]*[.．,，、][ \t]*"
    questions = list(re.finditer(prefix, question_text))
    answers = list(re.finditer(prefix + r"\s*[【［\[](答案|答案要点)[】］\]][ \t]*", answer_text))
    expected_references = [n for n in range(1, 39) if n not in {10, 11}]
    if [int(m[1]) for m in questions] != list(range(1, 39)) or [
        int(m[1]) for m in answers
    ] != expected_references:
        raise ValueError("Incomplete, duplicate or reordered politics source numbers")
    answer_blocks = {
        int(m[1]): (
            m,
            answer_text[
                m.end() : answers[i + 1].start() if i + 1 < len(answers) else len(answer_text)
            ],
        )
        for i, m in enumerate(answers)
    }
    rows = []
    for index, qm in enumerate(questions):
        number = index + 1
        qb = question_text[
            qm.end() : questions[index + 1].start() if index < 37 else len(question_text)
        ]
        qb = re.split(r"(?m)^[ \t]*[一二三]、(?:单项|多项|分析)", qb, maxsplit=1)[0]
        am, ab = answer_blocks.get(number, (None, ""))
        options = []
        if number <= 33:
            marks = list(re.finditer(r"(?<![A-Za-z0-9])([A-D])[.．,，、][ \t]*", qb))
            if [m[1] for m in marks] != list("ABCD"):
                raise ValueError(f"Question {number}: incomplete or ambiguous option labels")
            question = normalize_text(qb[: marks[0].start()])
            for i, mark in enumerate(marks):
                value = normalize_text(qb[mark.end() : marks[i + 1].start() if i < 3 else len(qb)])
                if not value:
                    raise ValueError("Empty source option")
                options.append({"label": mark[1], "text": value})
            answer = normalize_text(ab.split("【", 1)[0]) if am else None
            if am and (
                am[2] != "答案"
                or not re.fullmatch(r"[A-D]{1,4}", answer)
                or len(set(answer)) != len(answer)
            ):
                raise ValueError("Invalid source choice answer")
            if am and ((number <= 16 and len(answer) != 1) or (number >= 17 and len(answer) < 2)):
                raise ValueError("Single/multiple choice source mismatch")
        else:
            question = normalize_text(qb)
            answer = normalize_text(ab.split("【", 1)[0])
            if am[2] != "答案要点" or len(answer) < 100:
                raise ValueError("Missing source reference points")
            for value in [question, answer]:
                if not {"1", "2"}.issubset(set(re.findall(r"[（(]\s*([12])\s*[）)]", value))):
                    raise ValueError("Incomplete two-part material or reference")
        if not question or "公众号" in question + (answer or "") or "【" in (answer or ""):
            raise ValueError("Contaminated source material")
        rows.append(
            {
                "id": f"politics-2023-{number:03d}",
                "number": number,
                "type": "single_choice"
                if number <= 16
                else "multi_choice"
                if number <= 33
                else "analysis",
                "question": question,
                "options": options,
                "answer": answer,
                "explanation": "",
            }
        )
    return rows


def read_politics_reference_sources(
    question_source: Path, answer_source: Path, supplement_source: Path | None = None
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    import fitz

    paths = {"question": question_source, "answer": answer_source}
    before = {}
    raw = {}
    for role, path in paths.items():
        name, expected = POLITICS_REFERENCE_SOURCES[role]
        if (
            path.is_symlink()
            or path.resolve() != PROJECT_ROOT / "data/raw-inbox" / name
            or not path.is_file()
        ):
            raise ValueError("Unregistered reference source path")
        st = path.stat()
        if st.st_size > 32 * 1024 * 1024:
            raise ValueError("Registered reference source exceeds limit")
        before[role] = (st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)
        raw[role] = path.read_bytes()
        if not raw[role].startswith(b"%PDF-") or hashlib.sha256(raw[role]).hexdigest() != expected:
            raise ValueError("Registered reference source bytes mismatch")
    pixels = []
    with (
        fitz.open(stream=raw["question"], filetype="pdf") as q,
        fitz.open(stream=raw["answer"], filetype="pdf") as a,
    ):
        if len(q) != 11 or len(a) != 27:
            raise ValueError("Reference paper page count mismatch")
        for index in range(11):
            if q[index].get_text() != a[index].get_text():
                raise ValueError("Reference question pages do not match")
            px, py = (
                q[index].get_pixmap(matrix=fitz.Matrix(1, 1)),
                a[index].get_pixmap(matrix=fitz.Matrix(1, 1)),
            )
            hx, hy = hashlib.sha256(px.samples).hexdigest(), hashlib.sha256(py.samples).hexdigest()
            if (px.width, px.height, px.n) != (py.width, py.height, py.n) or hx != hy:
                raise ValueError("Reference question page pixels differ")
            pixels.append({"page": index + 1, "width": px.width, "height": px.height, "sha256": hx})
        rows = parse_politics_reference_texts(
            "\n".join(page.get_text() for page in q),
            "\n".join(a[index].get_text() for index in range(11, 27)),
        )
    for role, path in paths.items():
        st = path.stat()
        if (st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns) != before[role]:
            raise ValueError("Reference sources changed during verification")
    proof = {
        "contract": "politics-reference-v1",
        "bankId": "politics-2023",
        "questionSourceId": "src_94b2105814110617930cf327",
        "questionFilePath": relative_path(question_source),
        "questionFileSha256": "sha256:" + POLITICS_REFERENCE_SOURCES["question"][1],
        "answerSourceId": "src_6d757672897de533d4ff50b6",
        "answerFilePath": relative_path(answer_source),
        "answerFileSha256": "sha256:" + POLITICS_REFERENCE_SOURCES["answer"][1],
        "sourceRole": "publisher_reference",
        "scoringAuthority": False,
        "rightsStatus": "not_verified",
    }
    identity = {"proof": proof, "pairedPages": pixels}
    if supplement_source is not None:
        supplement = read_politics_supplement_source(supplement_source)
        for number, reference in supplement.items():
            if rows[number - 1]["answer"] is not None:
                raise ValueError("Supplement cannot override a primary reference")
            rows[number - 1]["answer"] = reference["answer"]
            rows[number - 1]["supplementProof"] = reference["proof"]
        identity["supplement"] = {
            number: reference["proof"] for number, reference in supplement.items()
        }
    return rows, identity


def restore_politics_reference(
    target: Path,
    question_source: Path,
    answer_source: Path,
    *,
    supplement_source: Path | None = None,
    write: bool = False,
) -> dict[str, Any]:
    if target.is_symlink() or target.stem != "politics-2023":
        raise ValueError("Unregistered candidate target")
    original = target.read_bytes()
    payload = json.loads(original)
    rows, identity = read_politics_reference_sources(
        question_source, answer_source, supplement_source
    )
    if (
        not isinstance(payload, dict)
        or not isinstance(payload.get("cards"), list)
        or len(payload["cards"]) != 38
    ):
        raise ValueError("Incomplete candidate scope")
    if supplement_source is None and any(
        isinstance(card, dict)
        and isinstance(card.get("answerEvidence"), dict)
        and isinstance(card["answerEvidence"].get("referenceProof"), dict)
        and "supplementProof" in card["answerEvidence"]["referenceProof"]
        for card in payload["cards"]
    ):
        raise ValueError("Existing supplement evidence requires the registered supplement source")
    candidate = copy.deepcopy(payload)
    if not isinstance(candidate.get("publicationBlockers", []), list):
        raise ValueError("Malformed publication blockers")
    changed, answers_changed, questions_changed = 0, 0, 0
    for card, row in zip(candidate["cards"], rows):
        if (
            not isinstance(card, dict)
            or not isinstance(card.get("sourceEvidence"), dict)
            or not isinstance(card.get("answerEvidence", {}), dict)
            or not isinstance(card.get("referenceEvidenceHistory", []), list)
        ):
            raise ValueError("Malformed candidate evidence or history")
        if (
            card.get("id") != row["id"]
            or type(card.get("number")) is not int
            or card["number"] != row["number"]
            or card.get("type") != row["type"]
            or card.get("sourceEvidenceId") != identity["proof"]["questionSourceId"]
        ):
            raise ValueError("Candidate identity, type or original source mismatch")
        before = copy.deepcopy(card)
        missing_reference = row["answer"] is None
        rebuilt = {**card, **{key: value for key, value in row.items() if key != "supplementProof"}}
        if missing_reference:
            rebuilt["answer"] = card.get("answer", "")
            rebuilt["explanation"] = card.get("explanation", "")
        proof = politics_row_reference_proof(row, identity)
        proof["contentHash"] = hash_text(
            json.dumps(
                politics_reference_payload(rebuilt, proof), ensure_ascii=False, sort_keys=True
            )
        )
        if card.get("answerEvidence", {}).get("referenceProof") != proof:
            old = {
                key: copy.deepcopy(card.get(key))
                for key in [
                    "id",
                    "number",
                    "type",
                    "question",
                    "options",
                    "answer",
                    "explanation",
                    "sourceEvidence",
                    "questionTextHash",
                    "answerTextHash",
                    "answerEvidenceStatus",
                    "answerEvidence",
                ]
            }
            rebuilt.setdefault("referenceEvidenceHistory", []).append(old)
        rebuilt["questionTextHash"] = hash_text(row["question"])
        rebuilt["sourceEvidence"]["questionTextHash"] = rebuilt["questionTextHash"]
        rebuilt["answerTextHash"] = hash_text(rebuilt["answer"])
        rebuilt["answerEvidenceStatus"] = (
            "candidate_existing_answer" if missing_reference else "candidate_matched"
        )
        supplement = row.get("supplementProof")
        reference_id = supplement["sourceId"] if supplement else proof["answerSourceId"]
        reference_path = supplement["filePath"] if supplement else proof["answerFilePath"]
        rebuilt["answerEvidenceSourceId"] = reference_id
        rebuilt["answerEvidence"] = {
            "status": "missing_reference" if missing_reference else "candidate_matched",
            "sourceId": reference_id,
            "sourceCardId": "" if missing_reference else f"reference-2023-{row['number']}",
            "sourceFilePath": reference_path,
            "answerTextHash": rebuilt["answerTextHash"],
            "method": "source_reference_missing_preserved_unverified_candidate"
            if missing_reference
            else "registered_supplement_pdf_reviewed_question_mapping"
            if supplement
            else "registered_paired_reference_pdf_exact_text",
            "referenceProof": proof,
        }
        card.clear()
        card.update(rebuilt)
        changed += card != before
        answers_changed += card["answer"] != before.get("answer")
        questions_changed += card["question"] != before.get("question")
    candidate["publicationStatus"] = "blocked"
    blockers = candidate.setdefault("publicationBlockers", [])
    if POLITICS_REFERENCE_BLOCKER not in blockers:
        blockers.append(POLITICS_REFERENCE_BLOCKER)
    if target.read_bytes() != original:
        raise ValueError("Candidate changed during verification")
    for role, path in [("question", question_source), ("answer", answer_source)]:
        if hashlib.sha256(path.read_bytes()).hexdigest() != POLITICS_REFERENCE_SOURCES[role][1]:
            raise ValueError("Reference source changed before write")
    if supplement_source is not None and read_politics_supplement_source(supplement_source) != {
        row["number"]: {"answer": row["answer"], "proof": row["supplementProof"]}
        for row in rows
        if "supplementProof" in row
    }:
        raise ValueError("Politics supplement changed before write")
    if write and candidate != payload:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=target.parent,
            prefix=".politics-reference-",
            suffix=".json",
            delete=False,
        ) as handle:
            temp = Path(handle.name)
            json.dump(candidate, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.chmod(temp, target.stat().st_mode & 0o777)
            if target.read_bytes() != original:
                raise ValueError("Candidate changed before atomic replace")
            os.replace(temp, target)
        finally:
            temp.unlink(missing_ok=True)
    return {
        "targetFile": relative_path(target),
        "verifiedQuestions": 38,
        "verifiedReferenceAnswers": sum(row["answer"] is not None for row in rows),
        "missingReferenceNumbers": [row["number"] for row in rows if row["answer"] is None],
        "primaryMissingReferenceNumbers": [10, 11],
        "supplementReferenceNumbers": [row["number"] for row in rows if "supplementProof" in row],
        "changedCards": changed,
        "answersChanged": answers_changed,
        "questionsChanged": questions_changed,
        "write": write,
        "publicationStatus": "blocked",
        "scoringAuthority": False,
        "sourceIdentity": identity,
    }


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Repair missing flashcard answers from companion cleaned files."
    )
    parser.add_argument(
        "--target", type=Path, required=True, help="Target flashcard JSON to repair."
    )
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
    parser.add_argument("--restore-politics-reference", action="store_true")
    parser.add_argument("--question-source", type=Path)
    parser.add_argument("--answer-source", type=Path)
    parser.add_argument("--supplement-source", type=Path)
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write repairs to --target. Without this, report only.",
    )
    parser.add_argument(
        "--mark-companions-supporting",
        action="store_true",
        help="When --write is set, mark companion files as supporting evidence so promotion gates skip them.",
    )
    args = parser.parse_args(argv)

    if args.restore_politics_reference:
        if (
            not args.question_source
            or not args.answer_source
            or args.companion
            or args.mark_companions_supporting
        ):
            parser.error(
                "Registered reference restoration requires both source PDFs and no companion writes"
            )
        report = restore_politics_reference(
            args.target,
            args.question_source,
            args.answer_source,
            supplement_source=args.supplement_source,
            write=args.write,
        )
        write_json(args.output, report)
        print(
            f"[politics-reference] write={args.write} questions={report['verifiedQuestions']} references={report['verifiedReferenceAnswers']} missing={report['missingReferenceNumbers']} changed={report['changedCards']} publication=blocked"
        )
        return 0

    if args.supplement_source or args.question_source or args.answer_source:
        parser.error("Reference sources require --restore-politics-reference")
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
        f"repairedOptions={report['summary']['repairedOptions']} "
        f"remainingMissing={report['summary']['remainingMissingAnswers']} "
        f"conflicts={report['summary']['conflictCount']} "
        f"report={args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
