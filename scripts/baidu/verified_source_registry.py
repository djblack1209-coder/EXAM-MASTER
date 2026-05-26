#!/usr/bin/env python3
"""
Build a Source Manifest import from manually verified official source files.

This script is deliberately strict: release-ready official-paper evidence must
include a local file, a provenance URL, a public-course track/year, and matched
answer evidence. It emits metadata only; raw files stay in the operator's local
or object-storage workspace.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY = PROJECT_ROOT / "data" / "verified-source-registry.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "verified-source-export.json"
PUBLIC_TRACKS = {"politics", "english1", "english2", "math1", "math2", "math3"}
SUPPORTED_SOURCE_TYPES = {"official_paper", "official_question_paper", "official_syllabus"}


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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def normalize_sha256(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text if text.startswith("sha256:") else f"sha256:{text}"


def get_sources(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict) and isinstance(payload.get("sources"), list):
        return [item for item in payload["sources"] if isinstance(item, dict)]
    raise ValueError("verified source registry must be a list or contain sources[]")


def resolve_local_path(raw_path: str, *, registry_path: Path) -> Path:
    path = Path(str(raw_path or "").strip()).expanduser()
    if path.is_absolute():
        return path

    registry_relative = (registry_path.parent / path).resolve()
    if registry_relative.exists():
        return registry_relative
    return (PROJECT_ROOT / path).resolve()


def as_int(value: Any, field_name: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be an integer") from exc


def require_text(source: dict[str, Any], field_name: str) -> str:
    value = str(source.get(field_name) or "").strip()
    if not value:
        raise ValueError(f"{field_name} is required")
    return value


def require_human_verified_fields(source: dict[str, Any]) -> tuple[str, str]:
    draft_status = str(source.get("draftStatus") or "").strip()
    if draft_status == "requires_human_verification":
        raise ValueError("draftStatus requires human verification; remove draft handoff fields after verification")

    human_field_status = str(source.get("humanFieldStatus") or "").strip()
    if human_field_status == "requires_human_input":
        raise ValueError("humanFieldStatus requires human input; fill the verified source registry draft first")

    missing_human_fields = source.get("missingHumanFields")
    if isinstance(missing_human_fields, list):
        missing = [str(item).strip() for item in missing_human_fields if str(item).strip()]
        if missing:
            raise ValueError(f"missingHumanFields must be empty before export: {', '.join(missing)}")

    verified_by = require_text(source, "verifiedBy")
    evidence_note = require_text(source, "evidenceNote")
    if evidence_note.startswith("DRAFT:"):
        raise ValueError("evidenceNote must be replaced with a human verification note before export")

    return verified_by, evidence_note


def normalize_source(source: dict[str, Any], *, registry_path: Path, now: str) -> dict[str, Any]:
    local_path = resolve_local_path(require_text(source, "localPath"), registry_path=registry_path)
    if not local_path.exists() or not local_path.is_file():
        raise ValueError(f"localPath does not exist: {local_path}")

    source_url = require_text(source, "sourceUrl")
    track = require_text(source, "track")
    if track not in PUBLIC_TRACKS:
        raise ValueError(f"track must be one of: {', '.join(sorted(PUBLIC_TRACKS))}")

    year = as_int(source.get("year"), "year")
    source_type = str(source.get("sourceType") or "official_paper")
    if source_type not in SUPPORTED_SOURCE_TYPES:
        raise ValueError(f"sourceType must be one of: {', '.join(sorted(SUPPORTED_SOURCE_TYPES))}")

    answer_status = str(source.get("answerEvidenceStatus") or "").strip()
    if source_type == "official_syllabus" and not answer_status:
        answer_status = "not_applicable"
    if source_type == "official_question_paper" and not answer_status:
        answer_status = "answer_missing"
    if source_type == "official_paper" and answer_status != "matched":
        raise ValueError("answerEvidenceStatus must be matched for release-ready verified sources")

    stat = local_path.stat()
    computed_sha256 = sha256_file(local_path)
    expected_sha256 = normalize_sha256(source.get("expectedSha256") or source.get("sha256"))
    if expected_sha256 and expected_sha256 != computed_sha256:
        raise ValueError(f"expectedSha256 mismatch for {local_path}: expected {expected_sha256}, got {computed_sha256}")
    subject = str(source.get("subject") or ("english" if track.startswith("english") else "math" if track.startswith("math") else track))
    verified_by, evidence_note = require_human_verified_fields(source)

    return {
        "id": str(source.get("id") or f"{track}_{year}_{local_path.stem}"),
        "path": str(source.get("remotePath") or local_path),
        "localPath": str(local_path),
        "server_filename": local_path.name,
        "size": stat.st_size,
        "server_mtime": int(stat.st_mtime),
        "sha256": computed_sha256,
        "sourceRole": str(source.get("sourceRole") or ""),
        "sourceUrl": source_url,
        "subject": subject,
        "track": track,
        "year": year,
        "sourceType": source_type,
        "status": str(source.get("status") or "verified"),
        "answerEvidenceStatus": answer_status,
        "verifiedAt": str(source.get("verifiedAt") or now),
        "verifiedBy": verified_by,
        "evidenceNote": evidence_note,
    }


def build_verified_source_export(registry_path: Path | str = DEFAULT_REGISTRY) -> dict[str, Any]:
    registry_path = Path(registry_path)
    payload = read_json(registry_path)
    now = utc_now()
    files = [normalize_source(source, registry_path=registry_path, now=now) for source in get_sources(payload)]

    return {
        "version": 1,
        "generatedAt": now,
        "source": "verified_source_registry",
        "files": files,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a verified official source export for Source Manifest.")
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    export = build_verified_source_export(args.registry)
    print(f"[verified-source-registry] sources={len(export['files'])} output={args.output}")
    if args.dry_run:
        return
    write_json(args.output, export)


if __name__ == "__main__":
    main()
