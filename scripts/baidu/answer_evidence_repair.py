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
CHOICE_TYPES = {"single_choice", "multi_choice"}
CHOICE_OPTION_LABELS = {"A", "B", "C", "D"}
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


def normalize_answer(answer: Any, card_type: str = "") -> str:
    text = normalize_text(answer)
    if not text:
        return ""
    if card_type in CHOICE_TYPES:
        compact = re.sub(r"[^A-Da-d]", "", text).upper()
        return compact if re.fullmatch(r"[A-D]{1,4}", compact or "") else ""
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


def source_id_for_path(path: Path, output_source_map: dict[str, str]) -> str:
    try:
        return output_source_map.get(str(path.expanduser().resolve()), "")
    except OSError:
        return output_source_map.get(str(path), "")


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


def read_companion_source_text(task: dict[str, Any]) -> str:
    source_path = first_non_empty(task.get("localPath"), task.get("expectedLocalPath"))
    if not source_path:
        return ""
    path = Path(source_path)
    if not path.exists() or not path.is_file():
        return ""
    if path.suffix.lower() == ".pdf":
        return extract_pdf_text(path)
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


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
        if any(answer not in CHOICE_OPTION_LABELS for answer in answers):
            candidates[str(start)] = "".join(answers[:expected_count])
            continue
        for offset, answer in enumerate(answers[:expected_count]):
            candidates[str(start + offset)] = answer
    return candidates


def collect_answer_candidates(
    companion_paths: list[Path],
    *,
    output_source_map: dict[str, str],
    output_task_map: dict[str, dict[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, int]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    stats = {"structuredCandidates": 0, "answerKeyTextCandidates": 0}
    for companion_path in companion_paths:
        payload = read_json(companion_path, {})
        source_id = source_id_for_path(companion_path, output_source_map)
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
            answer_key_text = read_companion_source_text(task)
            for number, answer in parse_answer_key_ranges(answer_key_text).items():
                key = answer_key(year, number)
                buckets.setdefault(key, []).append(
                    {
                        "answer": answer,
                        "explanation": "",
                        "cardId": f"answer-key-{year}-{number}",
                        "filePath": relative_path(Path(first_non_empty(task.get("localPath"), companion_path))),
                        "sourceId": source_id,
                        "method": "companion_answer_key_text",
                    }
                )
                stats["answerKeyTextCandidates"] += 1

    candidates: dict[str, dict[str, Any]] = {}
    conflicts: dict[str, list[dict[str, Any]]] = {}
    for key, items in buckets.items():
        answers = {item["answer"] for item in items}
        if len(answers) == 1:
            candidates[key] = items[0]
        else:
            conflicts[key] = items
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
            "questionEvidenceMaterialized": question_evidence_count,
            "answerEvidenceMaterialized": answer_evidence_count,
            "supportingCompanionsMarked": 0,
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
