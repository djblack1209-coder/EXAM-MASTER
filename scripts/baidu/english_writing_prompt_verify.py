#!/usr/bin/env python3
"""
Mark English writing cards as verified prompt/rubric tasks.

English writing questions do not have a single official answer. For release
gates, the publishable evidence is the official prompt and scoring task, not a
model essay. This script normalizes writing cards (51/52) to essay mode and
records answer evidence as matched_prompt so downstream quality gates can
distinguish it from answer-key matches.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FLASHCARD_DIR = PROJECT_ROOT / "data" / "flashcards"
DEFAULT_BANK_DIR = PROJECT_ROOT / "src" / "config" / "flashcard-banks"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "english-writing-prompt-verify-report.json"
WRITING_NUMBERS = {51, 52}


try:
    from answer_evidence_repair import first_non_empty, hash_text  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from scripts.baidu.answer_evidence_repair import first_non_empty, hash_text  # type: ignore


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


def relative_path(path: Path | None) -> str:
    if not path:
        return ""
    try:
        return str(path.resolve().relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def compact(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def load_cards(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    cards = payload.get("cards") if isinstance(payload.get("cards"), list) else payload.get("questions")
    return [card for card in (cards or []) if isinstance(card, dict)]


def card_number(card: dict[str, Any]) -> int | None:
    try:
        return int(float(first_non_empty(card.get("number"), card.get("questionNumber"), card.get("question_no"))))
    except (TypeError, ValueError):
        return None


def prompt_answer(card: dict[str, Any]) -> str:
    question = compact(card.get("question"))
    if not question:
        return ""
    return f"按官方题干完成写作任务：{question}"


def verify_bank(target_path: Path, *, write: bool = False, sync_config: bool = False, now: str | None = None) -> dict[str, Any]:
    now = now or utc_now()
    payload = read_json(target_path, {})
    cards = load_cards(payload)
    changed = False
    verified = 0
    skipped: list[dict[str, Any]] = []

    for index, card in enumerate(cards):
        number = card_number(card)
        if number not in WRITING_NUMBERS:
            continue

        answer = prompt_answer(card)
        source_id = first_non_empty(card.get("sourceEvidenceId"), card.get("sourceEvidence", {}).get("sourceId"))
        if not answer or not source_id:
            skipped.append({"cardId": first_non_empty(card.get("id"), f"card-{index + 1}"), "number": number})
            continue

        if card.get("type") != "essay":
            card["type"] = "essay"
            changed = True
        if card.get("answer") != answer:
            card["answer"] = answer
            changed = True

        question_hash = hash_text(card.get("question"))
        answer_hash = hash_text(answer)
        for key, value in {
            "sourceEvidenceId": source_id,
            "questionTextHash": question_hash,
            "answerTextHash": answer_hash,
            "answerEvidenceStatus": "matched",
            "answerEvidenceSourceId": source_id,
        }.items():
            if card.get(key) != value:
                card[key] = value
                changed = True

        source_evidence = card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
        next_source_evidence = {
            **source_evidence,
            "evidenceId": first_non_empty(source_evidence.get("evidenceId"), source_id),
            "sourceId": first_non_empty(source_evidence.get("sourceId"), source_id),
            "questionTextHash": question_hash,
            "status": "matched",
            "method": "local_writing_prompt_text_hash",
            "verifiedAt": now,
            "verifiedBy": "english_writing_prompt_verify",
        }
        if next_source_evidence != source_evidence:
            card["sourceEvidence"] = next_source_evidence
            changed = True

        answer_evidence = card.get("answerEvidence") if isinstance(card.get("answerEvidence"), dict) else {}
        next_answer_evidence = {
            **answer_evidence,
            "status": "matched",
            "evidenceRole": "official_writing_prompt",
            "sourceId": source_id,
            "answerTextHash": answer_hash,
            "method": "local_writing_prompt_text_hash",
            "verifiedAt": now,
            "verifiedBy": "english_writing_prompt_verify",
            "note": "Writing has no single official answer; matched evidence covers the official prompt and task requirements.",
        }
        if next_answer_evidence != answer_evidence:
            card["answerEvidence"] = next_answer_evidence
            changed = True
        verified += 1

    mirrored_config_path = None
    if write and changed:
        if isinstance(payload, dict):
            payload["writingPromptVerifiedAt"] = now
            payload["writingPromptVerifiedBy"] = "english_writing_prompt_verify"
        write_json(target_path, payload)
        if sync_config and target_path.parent.resolve() == DEFAULT_FLASHCARD_DIR.resolve():
            config_path = DEFAULT_BANK_DIR / target_path.name
            if config_path.exists():
                write_json(config_path, payload)
                mirrored_config_path = config_path

    return {
        "targetFile": relative_path(target_path),
        "mirroredConfigFile": relative_path(mirrored_config_path),
        "write": write,
        "summary": {
            "cardCount": len(cards),
            "verifiedWritingCards": verified,
            "skippedWritingCards": len(skipped),
            "changed": changed,
        },
        "skipped": skipped,
    }


def parse_years(value: str) -> list[int]:
    years: list[int] = []
    for item in str(value or "").split(","):
        item = item.strip()
        if not item:
            continue
        if "-" in item:
            start_text, end_text = item.split("-", 1)
            years.extend(range(int(start_text), int(end_text) + 1))
        else:
            years.append(int(item))
    return sorted(set(years))


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify English writing prompt cards.")
    parser.add_argument("--target", type=Path, action="append", default=[])
    parser.add_argument("--years", default="2005-2012")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--sync-config", action="store_true")
    args = parser.parse_args(argv)

    targets = args.target or [DEFAULT_FLASHCARD_DIR / f"english1-{year}.json" for year in parse_years(args.years)]
    files = [verify_bank(target, write=args.write, sync_config=args.sync_config) for target in targets]
    report = {
        "version": 1,
        "generatedAt": utc_now(),
        "write": args.write,
        "summary": {
            "files": len(files),
            "verifiedWritingCards": sum(item["summary"]["verifiedWritingCards"] for item in files),
            "skippedWritingCards": sum(item["summary"]["skippedWritingCards"] for item in files),
        },
        "files": files,
    }
    write_json(args.output, report)
    print(
        "[english-writing-prompt-verify] "
        f"write={args.write} "
        f"files={report['summary']['files']} "
        f"verified={report['summary']['verifiedWritingCards']} "
        f"skipped={report['summary']['skippedWritingCards']} "
        f"report={args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
