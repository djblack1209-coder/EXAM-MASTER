#!/usr/bin/env python3
"""
Build the incremental cleaning queue for EXAM-MASTER source files.

The queue is the handoff from Baidu Pan/source manifest scanning to the
download, text extraction, AI structuring, answer-evidence matching, and
publish-review pipeline. It stores no credentials and only references AI
providers through environment variables.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from scripts.baidu.source_quality import apply_source_quality_overrides
except ModuleNotFoundError:  # pragma: no cover - direct script execution path.
    from source_quality import apply_source_quality_overrides


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = PROJECT_ROOT / "data" / "source-manifest.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "cleaning-queue.json"
DEFAULT_RAW_INBOX = PROJECT_ROOT / "data" / "raw-inbox"
DEFAULT_RELEASE_BACKLOG = PROJECT_ROOT / "data" / "release-blocker-backlog.json"

SUPPORTED_SOURCE_CHANNELS = {"app_dir", "netdisk_full_path", "group_service", "group_file_index"}
DIRECT_DOWNLOAD_CHANNELS = {"app_dir", "netdisk_full_path"}
SUPPORTED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md", ".json", ".html", ".htm"}
PROCESSABLE_STATUS = {"discovered", "missing"}
AUTOMATION_READY_ACTIONS = {"download_and_extract"}
MANUAL_BLOCKED_ACTIONS = {"manual_review", "manual_ingest"}
TRANSFER_BLOCKED_ACTIONS = {"transfer_or_direct_download"}
MANUAL_REVIEW_FLAGS = {
    "answer_missing",
    "brand_leak",
    "copyright_review_required",
    "manual_review_required",
    "source_content_mismatch",
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


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def safe_file_name(value: str) -> str:
    name = Path(value or "resource.pdf").name
    name = re.sub(r"[\\/:*?\"<>|]+", "_", name).strip()
    return name or "resource.pdf"


def source_fingerprint(item: dict[str, Any]) -> str:
    return str(
        item.get("fingerprint")
        or item.get("contentHash")
        or item.get("sha256")
        or item.get("fileSha256")
        or item.get("sourceHash")
        or stable_hash(
            "|".join(
                [
                    str(item.get("sourceId", "")),
                    str(item.get("remotePath", "")),
                    str(item.get("size", "")),
                    str(item.get("mtime", "")),
                ]
            )
        )
    )


def is_supported_source(item: dict[str, Any]) -> bool:
    if not item.get("eligible"):
        return False
    if item.get("status") not in PROCESSABLE_STATUS:
        return False
    if item.get("sourceChannel") not in SUPPORTED_SOURCE_CHANNELS:
        return False
    extension = str(item.get("extension") or Path(str(item.get("fileName", ""))).suffix).lower()
    if extension not in SUPPORTED_EXTENSIONS:
        return False
    return True


def needs_manual_review(item: dict[str, Any]) -> bool:
    risk_flags = set(item.get("riskFlags", []))
    if risk_flags.intersection(MANUAL_REVIEW_FLAGS):
        return True
    legal_review = item.get("legalReview") or {}
    return bool(legal_review.get("publishBlocked") or legal_review.get("copyrightReviewRequired"))


def task_action(item: dict[str, Any]) -> str:
    if item.get("status") == "missing":
        return "manual_review"
    if needs_manual_review(item):
        return "manual_review"
    source_channel = item.get("sourceChannel")
    if source_channel in DIRECT_DOWNLOAD_CHANNELS and item.get("fsId") and item.get("remotePath"):
        return "download_and_extract"
    if source_channel in {"group_service", "group_file_index"}:
        return "transfer_or_direct_download"
    return "manual_ingest"


def task_stage(action: str) -> str:
    return {
        "download_and_extract": "download",
        "transfer_or_direct_download": "transfer",
        "manual_review": "review",
        "manual_ingest": "ingest",
    }.get(action, "ingest")


def task_status_reason(item: dict[str, Any], action: str, previous_for_source: dict[str, Any] | None) -> str:
    if previous_for_source and previous_for_source.get("fingerprint") != source_fingerprint(item):
        return "source_changed"
    if item.get("status") == "missing":
        return "source_missing"
    if action == "manual_review":
        return "legal_or_quality_review_required"
    if previous_for_source:
        return "source_requeued"
    return "new_source"


def build_task(
    item: dict[str, Any],
    *,
    raw_inbox_dir: Path,
    previous_for_source: dict[str, Any] | None,
    now: str,
) -> dict[str, Any]:
    action = task_action(item)
    fingerprint = source_fingerprint(item)
    source_id = str(item.get("sourceId"))
    file_name = safe_file_name(item.get("safeDisplayName") or item.get("fileName") or source_id)
    task_id = "clean_" + stable_hash(f"{source_id}|{fingerprint}|{action}")[:24]
    return {
        "taskId": task_id,
        "sourceId": source_id,
        "fingerprint": fingerprint,
        "remotePath": item.get("remotePath"),
        "fsId": item.get("fsId"),
        "fileName": item.get("fileName"),
        "safeDisplayName": item.get("safeDisplayName") or item.get("fileName"),
        "extension": item.get("extension") or Path(str(item.get("fileName", ""))).suffix.lower(),
        "sourceChannel": item.get("sourceChannel"),
        "groupName": item.get("groupName"),
        "examCycle": item.get("examCycle"),
        "collectionRoot": item.get("collectionRoot"),
        "courseCategory": item.get("courseCategory"),
        "institutionName": item.get("institutionName"),
        "institutionKey": item.get("institutionKey"),
        "direction": item.get("direction"),
        "targetDirectory": item.get("targetDirectory"),
        "approvalRequired": item.get("approvalRequired"),
        "sourceType": item.get("sourceType"),
        "track": item.get("track"),
        "subject": item.get("subject"),
        "year": item.get("year"),
        "priority": int(item.get("priority") or 0),
        "riskFlags": item.get("riskFlags", []),
        "action": action,
        "stage": task_stage(action),
        "status": "pending",
        "statusReason": task_status_reason(item, action, previous_for_source),
        "attempts": 0,
        "updatedAt": now,
        "contentHash": item.get("contentHash") or item.get("sha256") or item.get("fileSha256") or item.get("sourceHash"),
        "expectedLocalPath": str(raw_inbox_dir / f"{source_id}-{file_name}"),
    }


def public_course_slot_key(track: Any, year: Any) -> str:
    track_text = str(track or "").strip()
    year_text = str(year or "").strip()
    if not track_text or not year_text:
        return ""
    return f"{track_text}:{year_text}"


def build_release_backlog_lookup(release_backlog: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not isinstance(release_backlog, dict):
        return {}

    candidates: list[dict[str, Any]] = []
    for key in ("nextBalancedPublicCourseSlots", "publicCourseSlotBacklog"):
        items = release_backlog.get(key)
        if isinstance(items, list):
            candidates.extend(item for item in items if isinstance(item, dict))

    lookup: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(candidates):
        slot_key = str(item.get("slotKey") or public_course_slot_key(item.get("track"), item.get("year"))).strip()
        if not slot_key or slot_key in lookup:
            continue
        lookup[slot_key] = {
            "rank": index,
            "slotKey": slot_key,
            "blockerCode": item.get("blockerCode") or "",
            "sourceEvidenceStatus": item.get("sourceEvidenceStatus") or "",
            "slotStatus": item.get("slotStatus") or "",
        }

    return lookup


def attach_release_backlog_metadata(task: dict[str, Any], lookup: dict[str, dict[str, Any]]) -> None:
    slot_key = public_course_slot_key(task.get("track"), task.get("year"))
    if not slot_key:
        return

    release_item = lookup.get(slot_key)
    if not release_item:
        return

    task["releaseBacklogSlot"] = release_item["slotKey"]
    task["releaseBacklogRank"] = release_item["rank"]
    task["releaseBlockerCode"] = release_item["blockerCode"]
    task["releaseSourceEvidenceStatus"] = release_item["sourceEvidenceStatus"]
    task["releaseSlotStatus"] = release_item["slotStatus"]


def merge_previous_task(task: dict[str, Any], previous_task: dict[str, Any] | None, *, now: str) -> tuple[dict[str, Any], bool]:
    if not previous_task:
        return task, False

    preserved = dict(task)
    for key in (
        "status",
        "attempts",
        "claimedBy",
        "claimedAt",
        "completedAt",
        "failedAt",
        "lastError",
        "outputPath",
        "questionCount",
        "answerEvidenceStatus",
    ):
        if key in previous_task:
            preserved[key] = previous_task[key]
    preserved["updatedAt"] = now
    preserved["statusReason"] = previous_task.get("statusReason", "unchanged_source")
    return preserved, True


def summarize_tasks(tasks: list[dict[str, Any]], *, preserved: int, changed: int) -> dict[str, Any]:
    pending_tasks = [task for task in tasks if task.get("status") == "pending"]
    release_tasks = [task for task in tasks if task.get("releaseBacklogSlot")]
    pending_release_tasks = [task for task in release_tasks if task.get("status") == "pending"]
    return {
        "totalTasks": len(tasks),
        "pendingTasks": len(pending_tasks),
        "completedTasks": sum(1 for task in tasks if task.get("status") == "completed"),
        "failedTasks": sum(1 for task in tasks if task.get("status") == "failed"),
        "manualReviewTasks": sum(1 for task in tasks if task.get("action") == "manual_review"),
        "autoDownloadTasks": sum(1 for task in tasks if task.get("action") == "download_and_extract"),
        "transferTasks": sum(1 for task in tasks if task.get("action") == "transfer_or_direct_download"),
        "automationActionablePendingTasks": sum(
            1 for task in pending_tasks if task.get("action") in AUTOMATION_READY_ACTIONS
        ),
        "manualBlockedPendingTasks": sum(1 for task in pending_tasks if task.get("action") in MANUAL_BLOCKED_ACTIONS),
        "transferBlockedPendingTasks": sum(
            1 for task in pending_tasks if task.get("action") in TRANSFER_BLOCKED_ACTIONS
        ),
        "releaseBacklogTasks": len(release_tasks),
        "releaseBacklogPendingTasks": len(pending_release_tasks),
        "releaseBacklogAutomationActionablePendingTasks": sum(
            1 for task in pending_release_tasks if task.get("action") in AUTOMATION_READY_ACTIONS
        ),
        "releaseBacklogManualBlockedPendingTasks": sum(
            1 for task in pending_release_tasks if task.get("action") in MANUAL_BLOCKED_ACTIONS
        ),
        "releaseBacklogTransferBlockedPendingTasks": sum(
            1 for task in pending_release_tasks if task.get("action") in TRANSFER_BLOCKED_ACTIONS
        ),
        "preservedTasks": preserved,
        "newOrChangedTasks": len(tasks) - preserved,
        "changedSourceTasks": changed,
    }


def build_cleaning_queue(
    manifest: dict[str, Any],
    *,
    previous_queue: dict[str, Any] | None = None,
    release_backlog: dict[str, Any] | None = None,
    raw_inbox_dir: Path = DEFAULT_RAW_INBOX,
    now: str | None = None,
    limit: int = 0,
) -> dict[str, Any]:
    now = now or utc_now()
    previous_tasks = [
        task for task in (previous_queue or {}).get("tasks", [])
        if isinstance(task, dict) and task.get("sourceId")
    ]
    previous_by_key = {
        (task.get("sourceId"), task.get("fingerprint"), task.get("action")): task
        for task in previous_tasks
    }
    previous_by_source = {task.get("sourceId"): task for task in previous_tasks}
    release_backlog_lookup = build_release_backlog_lookup(release_backlog)

    tasks: list[dict[str, Any]] = []
    preserved_count = 0
    changed_count = 0
    for item in manifest.get("items", []):
        if not isinstance(item, dict) or not is_supported_source(item):
            continue
        item = apply_source_quality_overrides(item)
        source_id = str(item.get("sourceId"))
        previous_for_source = previous_by_source.get(source_id)
        task = build_task(item, raw_inbox_dir=raw_inbox_dir, previous_for_source=previous_for_source, now=now)
        previous_task = previous_by_key.get((task["sourceId"], task["fingerprint"], task["action"]))
        task, preserved = merge_previous_task(task, previous_task, now=now)
        attach_release_backlog_metadata(task, release_backlog_lookup)
        if preserved:
            preserved_count += 1
            task["_queuePreserved"] = True
        elif previous_for_source:
            changed_count += 1
            task["_queueChangedSource"] = True
        tasks.append(task)

    tasks.sort(
        key=lambda row: (
            1 if row.get("status") == "completed" else 0,
            int(row.get("releaseBacklogRank")) if row.get("releaseBacklogRank") is not None else 999_999,
            -int(row.get("priority") or 0),
            str(row.get("track") or ""),
            str(row.get("year") or ""),
            str(row.get("safeDisplayName") or row.get("fileName") or ""),
        )
    )
    if limit > 0:
        tasks = tasks[:limit]

    preserved_count = sum(1 for task in tasks if task.pop("_queuePreserved", False))
    changed_count = sum(1 for task in tasks if task.pop("_queueChangedSource", False))

    return {
        "version": 1,
        "generatedAt": now,
        "sourceManifestUpdatedAt": manifest.get("updatedAt"),
        "aiProvider": {
            "mode": "openai_compatible_env",
            "baseUrlEnv": "LLM_BASE_URL",
            "apiKeyEnv": "LLM_API_KEY",
            "modelEnv": "LLM_MODEL",
            "dailyRequestLimitEnv": "LLM_DAILY_REQUEST_LIMIT",
            "dailyCharLimitEnv": "LLM_DAILY_CHAR_LIMIT",
            "notes": "Use free or low-cost OpenAI-compatible models; never store keys in queue artifacts.",
        },
        "summary": summarize_tasks(tasks, preserved=preserved_count, changed=changed_count),
        "tasks": tasks,
    }


def run_self_test() -> None:
    manifest = {
        "items": [
            {
                "sourceId": "src_self",
                "fingerprint": "fp1",
                "eligible": True,
                "status": "discovered",
                "sourceChannel": "netdisk_full_path",
                "fsId": 1,
                "remotePath": "/EXAM-MASTER/2018英语一.pdf",
                "fileName": "2018英语一.pdf",
                "extension": ".pdf",
                "sourceType": "official_paper",
                "track": "english1",
                "year": 2018,
                "priority": 100,
                "riskFlags": [],
            }
        ]
    }
    queue = build_cleaning_queue(manifest, now="2026-04-30T00:00:00Z")
    assert queue["summary"]["totalTasks"] == 1
    assert queue["tasks"][0]["action"] == "download_and_extract"
    print("[cleaning-queue] self-test passed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build an incremental Baidu source cleaning queue.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--previous-queue", type=Path)
    parser.add_argument("--release-backlog", type=Path, default=DEFAULT_RELEASE_BACKLOG)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--raw-inbox-dir", type=Path, default=DEFAULT_RAW_INBOX)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return

    manifest = read_json(args.manifest, {"items": []})
    release_backlog = read_json(args.release_backlog, None)
    previous_path = args.previous_queue or args.output
    previous_queue = read_json(previous_path, None)
    queue = build_cleaning_queue(
        manifest,
        previous_queue=previous_queue,
        release_backlog=release_backlog,
        raw_inbox_dir=args.raw_inbox_dir,
        limit=args.limit,
    )

    summary = queue["summary"]
    print("[cleaning-queue] " + " ".join(f"{key}={value}" for key, value in summary.items()))
    if args.dry_run:
        print("[cleaning-queue] dry-run, queue not written")
        return

    write_json(args.output, queue)
    print(f"[cleaning-queue] wrote {args.output}")


if __name__ == "__main__":
    main()
