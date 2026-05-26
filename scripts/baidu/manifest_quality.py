#!/usr/bin/env python3
"""
Quality gate for EXAM-MASTER Source Manifest.

It answers three release-critical questions:
1. Which public-course tracks and years are covered by verified source files?
2. Which files require legal/brand/answer-evidence review?
3. What should the next processing queue do for each eligible source?
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = PROJECT_ROOT / "data" / "source-manifest.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "source-manifest-quality.json"
PUBLIC_TRACKS = ["politics", "english1", "english2", "math1", "math2", "math3"]


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


def is_public_track(item: dict[str, Any], tracks: list[str]) -> bool:
    track = item.get("track")
    if track in tracks:
        return True
    subject = item.get("subject")
    return subject in tracks


def is_publishable_source(item: dict[str, Any]) -> bool:
    if not item.get("eligible"):
        return False
    if item.get("status") not in {"verified", "published"}:
        return False
    if item.get("sourceType") != "official_paper":
        return False
    source_role = str(item.get("sourceRole") or item.get("source_role") or "").strip()
    if source_role and source_role not in {"paper", "paper_answer"}:
        return False
    blocking_flags = {"answer_missing", "brand_leak", "copyright_review_required", "ad_or_promo"}
    if blocking_flags.intersection(set(item.get("riskFlags", []))):
        return False
    if item.get("legalReview", {}).get("publishBlocked"):
        return False
    if item.get("answerEvidenceStatus") != "matched":
        return False
    if not (item.get("contentHash") or item.get("sha256") or item.get("fileSha256") or item.get("sourceHash")):
        return False
    if not (item.get("remotePath") or item.get("sourceUrl") or item.get("provenanceUrl")):
        return False
    return True


def queue_action(item: dict[str, Any]) -> str:
    if not item.get("eligible"):
        return "skip"
    if item.get("status") in {"verified", "published"}:
        return "already_processed"
    if item.get("riskFlags"):
        return "manual_review"
    if item.get("sourceChannel") == "app_dir" and item.get("fsId"):
        return "download"
    if item.get("sourceChannel") == "group_service":
        return "transfer_or_direct_download"
    return "manual_ingest"


def build_processing_queue(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    queue = []
    for item in items:
        action = queue_action(item)
        if action in {"skip", "already_processed"}:
            continue
        queue.append(
            {
                "sourceId": item.get("sourceId"),
                "action": action,
                "priority": item.get("priority", 0),
                "sourceType": item.get("sourceType"),
                "track": item.get("track"),
                "year": item.get("year"),
                "fileName": item.get("safeDisplayName") or item.get("fileName"),
                "remotePath": item.get("remotePath"),
                "riskFlags": item.get("riskFlags", []),
            }
        )

    return sorted(queue, key=lambda row: (-int(row.get("priority") or 0), str(row.get("track")), str(row.get("year"))))


def safe_display_name(item: dict[str, Any]) -> str:
    return item.get("safeDisplayName") or item.get("fileName") or "未命名资料"


def build_cleaning_plan(
    items: list[dict[str, Any]],
    *,
    coverage: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    coverage_backlog = [
        {
            "track": track,
            "missingYears": value.get("missingYears", []),
            "action": "source_gap_fill",
        }
        for track, value in coverage.items()
        if value.get("missingYears")
    ]

    institution_review_queue = [
        {
            "sourceId": item.get("sourceId"),
            "safeDisplayName": safe_display_name(item),
            "track": item.get("track"),
            "year": item.get("year"),
            "riskFlags": item.get("riskFlags", []),
            "action": "sanitize_brand_then_extract_questions",
        }
        for item in items
        if item.get("eligible") and item.get("sourceType") == "institution_candidate"
    ]

    publish_blocked_sources = [
        {
            "sourceId": item.get("sourceId"),
            "safeDisplayName": safe_display_name(item),
            "track": item.get("track"),
            "year": item.get("year"),
            "status": item.get("status"),
            "riskFlags": item.get("riskFlags", []),
            "reason": "answer_evidence_or_legal_review_required",
        }
        for item in items
        if item.get("eligible") and not is_publishable_source(item)
    ]

    return {
        "coverageBacklog": coverage_backlog,
        "institutionReviewQueue": institution_review_queue,
        "publishBlockedSources": publish_blocked_sources,
    }


def analyze_manifest(
    manifest: dict[str, Any],
    *,
    tracks: list[str],
    years: list[int],
) -> dict[str, Any]:
    items = [item for item in manifest.get("items", []) if isinstance(item, dict)]
    coverage: dict[str, dict[str, Any]] = {}

    for track in tracks:
        present = sorted(
            {
                int(item.get("year"))
                for item in items
                if is_publishable_source(item)
                and is_public_track(item, [track])
                and isinstance(item.get("year"), int)
            }
        )
        missing = [year for year in years if year not in present]
        coverage[track] = {
            "presentYears": present,
            "missingYears": missing,
            "coverageRate": round((len(years) - len(missing)) / len(years), 4) if years else 1,
        }

    risk_counts: dict[str, int] = {}
    for item in items:
        for flag in item.get("riskFlags", []):
            risk_counts[flag] = risk_counts.get(flag, 0) + 1

    queue = build_processing_queue(items)
    blocking_gaps = {
        track: value["missingYears"]
        for track, value in coverage.items()
        if value["missingYears"]
    }
    cleaning_plan = build_cleaning_plan(items, coverage=coverage)
    can_publish = (
        sum(len(value) for value in blocking_gaps.values()) == 0
        and not cleaning_plan["publishBlockedSources"]
    )

    return {
        "version": 1,
        "sourceManifestUpdatedAt": manifest.get("updatedAt"),
        "scope": {
            "tracks": tracks,
            "years": years,
        },
        "summary": {
            "totalSources": len(items),
            "eligibleSources": sum(1 for item in items if item.get("eligible")),
            "publishableOfficialPapers": sum(1 for item in items if is_publishable_source(item)),
            "queueSize": len(queue),
            "blockingGapCount": sum(len(value) for value in blocking_gaps.values()),
        },
        "coverage": coverage,
        "blockingGaps": blocking_gaps,
        "riskCounts": dict(sorted(risk_counts.items())),
        "processingQueue": queue,
        "cleaningPlan": cleaning_plan,
        "releaseReadiness": {
            "canPublish": can_publish,
            "blockers": {
                "coverageGaps": sum(len(value) for value in blocking_gaps.values()),
                "publishBlockedSources": len(cleaning_plan["publishBlockedSources"]),
            },
        },
    }


def run_self_test() -> None:
    manifest = {
        "updatedAt": "2026-04-28T00:00:00Z",
        "items": [
            {
                "sourceId": "src_1",
                "eligible": True,
                "status": "verified",
                "sourceType": "official_paper",
                "sourceChannel": "app_dir",
                "fsId": 1,
                "track": "english1",
                "year": 2024,
                "remotePath": "/apps/考研大师/raw-pdf/2024英语一真题.pdf",
                "contentHash": "sha256:verified-source-hash",
                "answerEvidenceStatus": "matched",
                "fileName": "2024英语一真题.pdf",
                "riskFlags": [],
                "priority": 100,
            },
            {
                "sourceId": "src_answer_only",
                "eligible": True,
                "status": "verified",
                "sourceType": "official_paper",
                "sourceChannel": "verified_registry",
                "track": "english1",
                "year": 2025,
                "remotePath": "/apps/考研大师/raw-pdf/2025英语一答案.pdf",
                "contentHash": "sha256:answer-only-source",
                "answerEvidenceStatus": "matched",
                "sourceRole": "answer",
                "fileName": "2025英语一答案.pdf",
                "riskFlags": [],
                "priority": 100,
            },
            {
                "sourceId": "src_unmatched_answer",
                "eligible": True,
                "status": "verified",
                "sourceType": "official_paper",
                "sourceChannel": "app_dir",
                "fsId": 2,
                "track": "english1",
                "year": 2025,
                "remotePath": "/apps/考研大师/raw-pdf/2025英语一真题.pdf",
                "contentHash": "sha256:unmatched-answer-source",
                "answerEvidenceStatus": "manual_review",
                "fileName": "2025英语一真题.pdf",
                "riskFlags": [],
                "priority": 100,
            },
            {
                "sourceId": "src_2",
                "eligible": True,
                "status": "discovered",
                "sourceType": "institution_candidate",
                "sourceChannel": "group_service",
                "track": "english1",
                "year": 2026,
                "fileName": "强化资料.pdf",
                "safeDisplayName": "强化资料.pdf",
                "riskFlags": ["copyright_review_required"],
                "priority": 70,
            },
            {
                "sourceId": "src_3",
                "eligible": False,
                "status": "rejected",
                "sourceType": "ad",
                "track": "english1",
                "fileName": "扫码加群.pdf",
                "riskFlags": ["ad_or_promo"],
            },
        ],
    }
    report = analyze_manifest(manifest, tracks=["english1"], years=[2024, 2025])
    assert report["coverage"]["english1"]["presentYears"] == [2024]
    assert report["coverage"]["english1"]["missingYears"] == [2025]
    assert report["summary"]["publishableOfficialPapers"] == 1
    assert report["summary"]["blockingGapCount"] == 1
    assert report["processingQueue"][0]["action"] == "manual_review"
    assert report["cleaningPlan"]["coverageBacklog"][0]["track"] == "english1"
    assert report["cleaningPlan"]["institutionReviewQueue"][0]["safeDisplayName"] == "强化资料.pdf"
    assert report["releaseReadiness"]["canPublish"] is False
    print("[manifest-quality] self-test passed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze Source Manifest coverage and processing queue.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--tracks", default=",".join(PUBLIC_TRACKS))
    parser.add_argument("--min-year", type=int, default=2005)
    parser.add_argument("--max-year", type=int, default=2026)
    parser.add_argument("--fail-on-missing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return

    manifest = read_json(args.manifest)
    report = analyze_manifest(
        manifest,
        tracks=parse_tracks(args.tracks),
        years=required_years(args.min_year, args.max_year),
    )

    summary = report["summary"]
    print(
        "[manifest-quality] "
        + " ".join(f"{key}={value}" for key, value in summary.items())
    )

    if args.dry_run:
        print("[manifest-quality] dry-run, report not written")
    else:
        write_json(args.output, report)
        print(f"[manifest-quality] wrote {args.output}")

    if args.fail_on_missing and summary["blockingGapCount"] > 0:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
