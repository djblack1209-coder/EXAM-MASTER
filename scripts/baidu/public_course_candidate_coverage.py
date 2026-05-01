#!/usr/bin/env python3
"""
Summarize raw Baidu Netdisk candidate coverage for public-course past papers.

This report is intentionally weaker than the release gate: it answers whether
raw source files exist in the user's Netdisk, not whether they are already
verified, legally sanitized, answer-matched, and publishable.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = PROJECT_ROOT / "data" / "source-manifest.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "public-course-netdisk-candidate-coverage.json"
PUBLIC_TRACKS = ["politics", "english1", "english2", "math1", "math2", "math3"]
CANDIDATE_SOURCE_TYPES = {"official_paper", "official_question_paper", "institution_candidate", "unknown_document"}
ANSWER_RE = re.compile(r"答案|解析|参考答案|answer", re.I)
BLOCKING_RISK_FLAGS = {"brand_leak", "copyright_review_required", "ad_or_promo", "answer_missing"}


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


def parse_tracks(value: str) -> list[str]:
    tracks = [item.strip() for item in value.split(",") if item.strip()]
    return tracks or PUBLIC_TRACKS


def required_years(min_year: int, max_year: int) -> list[int]:
    if min_year > max_year:
        raise ValueError("--min-year cannot be greater than --max-year")
    return list(range(min_year, max_year + 1))


def as_int(value: Any) -> int | None:
    try:
        year = int(value)
    except (TypeError, ValueError):
        return None
    return year


def item_text(item: dict[str, Any]) -> str:
    return f"{item.get('fileName', '')} {item.get('safeDisplayName', '')} {item.get('remotePath', '')}"


def is_candidate_item(item: dict[str, Any], *, track: str, year: int, source_channel: str) -> bool:
    if source_channel and item.get("sourceChannel") != source_channel:
        return False
    if not item.get("eligible"):
        return False
    if item.get("sourceType") not in CANDIDATE_SOURCE_TYPES:
        return False
    if item.get("track") != track and item.get("subject") != track:
        return False
    return as_int(item.get("year")) == year


def is_clean_candidate(item: dict[str, Any]) -> bool:
    if item.get("sourceType") not in {"official_paper", "official_question_paper"}:
        return False
    risk_flags = set(item.get("riskFlags") or [])
    if risk_flags.intersection(BLOCKING_RISK_FLAGS):
        return False
    if item.get("legalReview", {}).get("publishBlocked"):
        return False
    return True


def has_answer_name(item: dict[str, Any]) -> bool:
    return bool(ANSWER_RE.search(item_text(item)))


def sample_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceId": item.get("sourceId"),
        "sourceType": item.get("sourceType"),
        "fileName": item.get("safeDisplayName") or item.get("fileName"),
        "remotePath": item.get("remotePath"),
        "riskFlags": item.get("riskFlags", []),
    }


def analyze_candidate_coverage(
    manifest: dict[str, Any],
    *,
    tracks: list[str],
    years: list[int],
    source_channel: str = "netdisk_full_path",
) -> dict[str, Any]:
    items = [item for item in manifest.get("items", []) if isinstance(item, dict)]
    summary: dict[str, Any] = {}
    matrix: dict[str, Any] = {}

    for track in tracks:
        track_matrix: dict[str, Any] = {}
        present_years: list[int] = []
        clean_years: list[int] = []
        answer_named_years: list[int] = []

        for year in years:
            candidates = [
                item
                for item in items
                if is_candidate_item(item, track=track, year=year, source_channel=source_channel)
            ]
            clean_candidates = [item for item in candidates if is_clean_candidate(item)]
            answer_named = [item for item in candidates if has_answer_name(item)]

            if candidates:
                present_years.append(year)
            if clean_candidates:
                clean_years.append(year)
            if answer_named:
                answer_named_years.append(year)

            sorted_candidates = sorted(
                candidates,
                key=lambda item: (
                    0 if is_clean_candidate(item) else 1,
                    -int(item.get("priority") or 0),
                    str(item.get("fileName") or ""),
                ),
            )
            track_matrix[str(year)] = {
                "candidateCount": len(candidates),
                "cleanCandidateCount": len(clean_candidates),
                "answerNamedCount": len(answer_named),
                "samples": [sample_item(item) for item in sorted_candidates[:3]],
            }

        missing_years = [year for year in years if year not in set(present_years)]
        summary[track] = {
            "presentYears": present_years,
            "missingYears": missing_years,
            "cleanYears": clean_years,
            "answerNamedYears": answer_named_years,
        }
        matrix[track] = track_matrix

    return {
        "version": 1,
        "generatedAt": utc_now(),
        "source": str(DEFAULT_MANIFEST.relative_to(PROJECT_ROOT)),
        "sourceChannel": source_channel,
        "scope": {
            "tracks": tracks,
            "years": years,
        },
        "summary": summary,
        "matrix": matrix,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build raw public-course candidate coverage from Source Manifest.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source-channel", default="netdisk_full_path")
    parser.add_argument("--tracks", default=",".join(PUBLIC_TRACKS))
    parser.add_argument("--min-year", type=int, default=2010)
    parser.add_argument("--max-year", type=int, default=2026)
    args = parser.parse_args()

    report = analyze_candidate_coverage(
        read_json(args.manifest),
        tracks=parse_tracks(args.tracks),
        years=required_years(args.min_year, args.max_year),
        source_channel=args.source_channel,
    )
    write_json(args.output, report)
    covered = {track: len(value["presentYears"]) for track, value in report["summary"].items()}
    print(
        "[candidate-coverage] "
        + " ".join(f"{track}={count}" for track, count in covered.items())
        + f" report={args.output.relative_to(PROJECT_ROOT)}"
    )


if __name__ == "__main__":
    main()
