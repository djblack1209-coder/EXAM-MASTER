#!/usr/bin/env python3
"""Build a read-only Baidu group-file index and transfer approval queue.

This script is deliberately non-mutating: it never clicks Baidu UI, transfers
cloud files, downloads files, or uploads anything to a server. It turns an
operator/browser/Computer Use export of a group file list into:

- a full metadata index;
- an approval-required transfer queue for document-like resources;
- an optional Source Manifest handoff payload for later pipeline steps.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "group-file-export.json"
DEFAULT_INDEX_OUTPUT = PROJECT_ROOT / "data" / "group-file-index.json"
DEFAULT_QUEUE_OUTPUT = PROJECT_ROOT / "data" / "group-transfer-queue.json"
DEFAULT_SOURCE_EXPORT = PROJECT_ROOT / "data" / "group-file-source-export.json"
DEFAULT_DEST_ROOT = "/apps/考研大师/raw-pdf"
PUBLIC_TRACKS = {"politics", "english1", "english2", "math1", "math2", "math3"}
INDEXABLE_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md", ".json", ".html", ".htm", ".ppt", ".pptx"}
TEXT_DATE_RE = re.compile(r"(?<!\d)(?:20)?\d{2}[-/.]\d{1,2}[-/.]\d{1,2}(?!\d)")
EXAM_CYCLE_RE = re.compile(r"(?<!\d)((?:20)?\d{2})\s*考研")
PUBLIC_CATEGORY_RE = re.compile(r"公共课|政治|英语|数学|英一|英二|数一|数二|数三")
PROFESSIONAL_CATEGORY_RE = re.compile(r"专业课|院校|复试|408|333|自命题")
COURSE_CATEGORY_DIRS = {
    "public_course": "public-course",
    "professional_course": "professional-course",
}
TRACK_COMPONENT_RE = re.compile(r"公共课|专业课|政治|英语|数学|英一|英二|数一|数二|数三|101|201|204|301|302|303")


try:
    from source_manifest import (  # type: ignore
        classify_source,
        guess_subject,
        guess_track,
        normalize_year,
        sanitize_display_name,
    )
except ModuleNotFoundError:  # pragma: no cover - supports import from project root.
    from scripts.baidu.source_manifest import (  # type: ignore
        classify_source,
        guess_subject,
        guess_track,
        normalize_year,
        sanitize_display_name,
    )


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def safe_text(value: Any) -> str:
    return str(value or "").strip()


def as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return fallback


def pick_text(raw: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = raw.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def parse_input(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(
            f"Group file export not found: {path}. "
            "Export the Baidu group file list to JSON or Computer Use snapshot text first, "
            "then pass it with --input."
        )
    content = read_text(path)
    try:
        payload = json.loads(content)
        return extract_json_items(payload), {"inputFormat": "json"}
    except json.JSONDecodeError:
        records = parse_accessibility_text(content)
        return records, {"inputFormat": "accessibility_text"}


def extract_json_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        raise ValueError("input JSON must be an object or array")

    for key in ("items", "files", "records", "rows", "list"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]

    # Support light Computer Use snapshots serialized as {"app_state": "..."}.
    for key in ("app_state", "text", "snapshot"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return parse_accessibility_text(value)

    raise ValueError("input JSON must contain items/files/records/rows/list or app_state text")


def parse_accessibility_text(content: str) -> list[dict[str, Any]]:
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    records: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    def flush() -> None:
        nonlocal current
        if current and current.get("fileName"):
            records.append(current)
        current = None

    for line in lines:
        link_match = re.search(r"(?:^|\s)(?:链接|link)\s+(.+)$", line, re.I)
        if link_match:
            flush()
            name = re.sub(r"\s+", " ", link_match.group(1)).strip()
            current = {"fileName": name, "sourceLine": line}
            continue

        if current is None:
            continue

        sharer_match = re.search(r"分享人[:：]\s*([^\s]+)", line)
        if sharer_match and not current.get("sharer"):
            current["sharer"] = sharer_match.group(1)

        date_match = TEXT_DATE_RE.search(line)
        if date_match and not current.get("shareTime"):
            current["shareTime"] = date_match.group(0)

    flush()
    return records


def is_directory(raw: dict[str, Any], file_name: str) -> bool:
    if str(raw.get("type") or "").lower() in {"folder", "dir", "directory"}:
        return True
    if as_int(raw.get("isdir"), 0) == 1:
        return True
    if safe_text(raw.get("kind")).lower() in {"folder", "dir", "directory"}:
        return True
    return not Path(file_name).suffix and not raw.get("size")


def mask_sharer(value: str) -> str:
    value = safe_text(value)
    if not value:
        return ""
    if "*" in value:
        return value[:24]
    if len(value) <= 2:
        return "*" * len(value)
    return f"{value[0]}***{value[-1]}"


def safe_path_component(value: str) -> str:
    value = re.sub(r"[\\/:*?\"<>|]+", "_", safe_text(value))
    value = re.sub(r"\s+", "", value)
    return value[:60] or "unknown"


def split_path_components(*values: str) -> list[str]:
    components: list[str] = []
    for value in values:
        for component in re.split(r"[\\/]+", safe_text(value)):
            component = component.strip()
            if component and component not in components:
                components.append(component)
    return components


def normalize_exam_cycle_value(value: Any) -> int | None:
    text = safe_text(value)
    if not text:
        return None
    match = EXAM_CYCLE_RE.search(text)
    raw_year = match.group(1) if match else text
    try:
        year = int(raw_year)
    except ValueError:
        return None
    if 0 <= year < 100:
        year += 2000
    return year if 2020 <= year <= 2035 else None


def infer_exam_cycle(raw: dict[str, Any], *, group_name: str, components: list[str]) -> int | None:
    for key in ("examCycle", "exam_cycle", "collectionYear", "targetExamYear"):
        year = normalize_exam_cycle_value(raw.get(key))
        if year:
            return year
    for value in [*components, group_name]:
        year = normalize_exam_cycle_value(value)
        if year:
            return year
    return None


def infer_collection_root(components: list[str]) -> str:
    for component in components:
        year = normalize_exam_cycle_value(component)
        if year:
            return f"{year}考研"
    return ""


def infer_course_category(raw: dict[str, Any], *, text: str, subject: str, track: str) -> str:
    explicit = safe_text(raw.get("courseCategory") or raw.get("course_category") or raw.get("category"))
    aliases = {
        "public": "public_course",
        "public_course": "public_course",
        "公共课": "public_course",
        "professional": "professional_course",
        "professional_course": "professional_course",
        "专业课": "professional_course",
    }
    if explicit in aliases:
        return aliases[explicit]
    if PROFESSIONAL_CATEGORY_RE.search(text):
        return "professional_course"
    if PUBLIC_CATEGORY_RE.search(text) or track in PUBLIC_TRACKS or subject in {"politics", "english", "math"}:
        return "public_course"
    return "unknown"


def infer_institution_name(raw: dict[str, Any], *, components: list[str], course_category: str) -> str:
    explicit = safe_text(
        raw.get("institutionName")
        or raw.get("institution")
        or raw.get("providerName")
        or raw.get("orgName")
        or raw.get("schoolProvider")
    )
    if explicit:
        return explicit

    category_labels = {
        "public_course": {"公共课"},
        "professional_course": {"专业课", "院校专业课", "自命题"},
    }.get(course_category, set())
    for index, component in enumerate(components):
        if component not in category_labels:
            continue
        for candidate in components[index + 1 :]:
            if EXAM_CYCLE_RE.search(candidate) or TRACK_COMPONENT_RE.search(candidate):
                continue
            if Path(candidate).suffix:
                continue
            return candidate
    return ""


def infer_direction(raw: dict[str, Any], *, components: list[str], course_category: str, institution_name: str) -> str:
    explicit = safe_text(raw.get("direction") or raw.get("major") or raw.get("discipline"))
    if explicit:
        return explicit
    if course_category != "professional_course":
        return ""
    start_index = 0
    if institution_name in components:
        start_index = components.index(institution_name) + 1
    else:
        for label in ("专业课", "院校专业课", "自命题"):
            if label in components:
                start_index = components.index(label) + 1
                break
    skip = {"专业课", "院校专业课", "自命题", institution_name}
    for component in components[start_index:]:
        if component in skip or EXAM_CYCLE_RE.search(component) or Path(component).suffix:
            continue
        if re.search(r"专业课|院校|复试|自命题", component):
            continue
        return component
    return ""


def transfer_destination(record: dict[str, Any], dest_root: str) -> str:
    root = dest_root.rstrip("/")
    track = safe_text(record.get("track"))
    year = safe_text(record.get("year") or "unknown")
    collection_root = safe_text(record.get("collectionRoot"))
    course_category = safe_text(record.get("courseCategory"))
    if collection_root and course_category in COURSE_CATEGORY_DIRS:
        institution = safe_text(record.get("institutionKey")) or "unbucketed"
        category_dir = COURSE_CATEGORY_DIRS[course_category]
        if course_category == "public_course":
            track_dir = track if track in PUBLIC_TRACKS else safe_text(record.get("subject")) or "unknown"
            return f"{root}/{safe_path_component(collection_root)}/{category_dir}/{institution}/{track_dir}/{year}"

        direction = safe_text(record.get("direction")) or safe_text(record.get("subject")) or "professional"
        return f"{root}/{safe_path_component(collection_root)}/{category_dir}/{institution}/{safe_path_component(direction)}/{year}"

    if track in PUBLIC_TRACKS:
        return f"{root}/{track}/{year}"

    direction = safe_text(record.get("direction")) or safe_text(record.get("subject")) or "professional"
    return f"{root}/professional/{safe_path_component(direction)}/{year}"


def decision_for_record(record: dict[str, Any]) -> str:
    if record.get("isDirectory"):
        return "expand_folder_index"
    if record.get("sourceType") in {"ad", "unsupported", "unsupported_media"}:
        return "reject"
    if record.get("extension") not in INDEXABLE_EXTENSIONS:
        return "reject"
    if not record.get("eligible"):
        return "index_only"
    return "approval_required_transfer"


def normalize_record(raw: dict[str, Any], *, group_name: str, dest_root: str, now: str) -> dict[str, Any]:
    file_name = pick_text(raw, "fileName", "server_filename", "filename", "name", "title")
    remote_path = pick_text(raw, "remotePath", "path", "groupPath", "server_path")
    if not file_name and remote_path:
        file_name = Path(remote_path).name
    if not remote_path:
        remote_path = file_name

    file_name = file_name or "未命名资料"
    components = split_path_components(remote_path)
    directory = is_directory(raw, file_name)
    extension = Path(file_name).suffix.lower()
    size = as_int(raw.get("size") or raw.get("fileSize"))
    share_time = pick_text(raw, "shareTime", "sharedAt", "share_time", "mtime", "server_mtime")
    sharer = pick_text(raw, "sharer", "sharedBy", "shareUser", "owner")
    source_text = f"{group_name}/{remote_path}/{file_name}"

    if directory:
        subject = guess_subject(source_text)
        track = guess_track(source_text, subject)
        source_type, eligible, risk_flags, priority = ("folder", False, ["folder_requires_expansion"], 10)
        safe_display_name = file_name
        brand_sanitized = False
        year = normalize_year(raw.get("year"), source_text, file_name)
    else:
        subject = pick_text(raw, "subject") or guess_subject(source_text)
        track = pick_text(raw, "track") or guess_track(source_text, subject)
        year = normalize_year(raw.get("year"), source_text, file_name)
        source_type, eligible, risk_flags, priority = classify_source(source_text, extension, size)
        safe_display_name, brand_sanitized = sanitize_display_name(file_name, subject, source_type)

    exam_cycle = infer_exam_cycle(raw, group_name=group_name, components=components)
    collection_root = infer_collection_root(components)
    course_category = infer_course_category(raw, text=source_text, subject=subject, track=track)
    institution_name = infer_institution_name(raw, components=components, course_category=course_category)
    institution_key = safe_path_component(institution_name) if institution_name else ""
    direction = infer_direction(
        raw,
        components=components,
        course_category=course_category,
        institution_name=institution_name,
    )
    fingerprint = stable_hash("|".join([group_name, remote_path, file_name, str(size), share_time]))
    record = {
        "sourceId": f"grp_{fingerprint[:24]}",
        "fingerprint": fingerprint,
        "provider": "baidu_pan",
        "sourceChannel": "group_file_index",
        "groupName": group_name,
        "examCycle": exam_cycle,
        "collectionRoot": collection_root,
        "courseCategory": course_category,
        "institutionName": institution_name,
        "institutionKey": institution_key,
        "direction": direction,
        "remotePath": remote_path,
        "fileName": file_name,
        "safeDisplayName": safe_display_name,
        "extension": extension,
        "size": size,
        "shareTime": share_time,
        "sharerDisplay": mask_sharer(sharer),
        "sharerHash": stable_hash(sharer) if sharer else "",
        "isDirectory": directory,
        "subject": subject,
        "track": track,
        "year": year,
        "sourceType": source_type,
        "eligible": bool(eligible),
        "priority": priority,
        "riskFlags": sorted(set(risk_flags)),
        "brandSanitized": brand_sanitized,
        "indexedAt": now,
    }
    record["decision"] = decision_for_record(record)
    record["approvalRequired"] = record["decision"] == "approval_required_transfer"
    record["targetDirectory"] = transfer_destination(record, dest_root) if record["approvalRequired"] else ""
    return record


def build_index(raw_items: list[dict[str, Any]], *, group_name: str, dest_root: str, now: str | None = None) -> dict[str, Any]:
    now = now or utc_now()
    records = [normalize_record(item, group_name=group_name, dest_root=dest_root, now=now) for item in raw_items]
    decisions = Counter(record["decision"] for record in records)
    source_types = Counter(record["sourceType"] for record in records)
    tracks = Counter(record["track"] or record["subject"] or "unknown" for record in records)
    categories = Counter(record["courseCategory"] or "unknown" for record in records)
    exam_cycles = Counter(str(record["examCycle"] or "unknown") for record in records)
    institutions = Counter(record["institutionKey"] or "unbucketed" for record in records)
    return {
        "version": 1,
        "generatedAt": now,
        "mode": "read_only_index",
        "groupName": group_name,
        "summary": {
            "totalRecords": len(records),
            "folderRecords": sum(1 for record in records if record["isDirectory"]),
            "approvalRequiredTransfers": decisions.get("approval_required_transfer", 0),
            "rejectedRecords": decisions.get("reject", 0),
            "decisionCounts": dict(decisions.most_common()),
            "sourceTypeCounts": dict(source_types.most_common()),
            "trackCounts": dict(tracks.most_common()),
            "courseCategoryCounts": dict(categories.most_common()),
            "examCycleCounts": dict(exam_cycles.most_common()),
            "institutionCounts": dict(institutions.most_common()),
        },
        "items": records,
    }


def build_transfer_queue(index: dict[str, Any], *, dest_root: str) -> dict[str, Any]:
    queue_items = []
    for item in index.get("items", []):
        if item.get("decision") != "approval_required_transfer":
            continue
        queue_items.append(
            {
                "queueId": f"gq_{item['fingerprint'][:20]}",
                "sourceId": item["sourceId"],
                "status": "approval_required",
                "action": "cloud_transfer_then_manifest_scan",
                "approvalRequired": True,
                "groupName": item["groupName"],
                "examCycle": item.get("examCycle"),
                "collectionRoot": item.get("collectionRoot"),
                "courseCategory": item.get("courseCategory"),
                "institutionName": item.get("institutionName"),
                "institutionKey": item.get("institutionKey"),
                "direction": item.get("direction"),
                "remotePath": item["remotePath"],
                "fileName": item["fileName"],
                "safeDisplayName": item["safeDisplayName"],
                "extension": item["extension"],
                "size": item["size"],
                "subject": item["subject"],
                "track": item["track"],
                "year": item["year"],
                "sourceType": item["sourceType"],
                "priority": item["priority"],
                "riskFlags": item["riskFlags"],
                "targetDirectory": item.get("targetDirectory") or transfer_destination(item, dest_root),
                "notes": "Requires action-time confirmation before any Baidu cloud transfer/download.",
            }
        )

    queue_items.sort(
        key=lambda row: (
            -int(row.get("priority") or 0),
            str(row.get("track") or ""),
            str(row.get("year") or ""),
            str(row.get("safeDisplayName") or row.get("fileName") or ""),
        )
    )
    return {
        "version": 1,
        "generatedAt": index["generatedAt"],
        "mode": "approval_queue",
        "destRoot": dest_root.rstrip("/"),
        "summary": {
            "totalQueueItems": len(queue_items),
            "approvalRequired": len(queue_items),
        },
        "items": queue_items,
    }


def build_source_export(index: dict[str, Any]) -> dict[str, Any]:
    items = []
    for item in index.get("items", []):
        if item.get("decision") != "approval_required_transfer":
            continue
        items.append(
            {
                "path": item.get("remotePath"),
                "server_filename": item.get("fileName"),
                "size": item.get("size"),
                "server_mtime": as_int(item.get("shareTime"), 0),
                "source": "group_file_index",
                "source_label": item.get("groupName"),
                "groupName": item.get("groupName"),
                "examCycle": item.get("examCycle"),
                "collectionRoot": item.get("collectionRoot"),
                "courseCategory": item.get("courseCategory"),
                "institutionName": item.get("institutionName"),
                "institutionKey": item.get("institutionKey"),
                "direction": item.get("direction"),
                "targetDirectory": item.get("targetDirectory"),
                "approvalRequired": item.get("approvalRequired"),
                "subject": item.get("subject"),
                "track": item.get("track"),
                "year": item.get("year"),
                "sourceType": item.get("sourceType"),
                "status": "discovered",
            }
        )
    return {
        "version": 1,
        "source": "group_file_index",
        "generatedAt": index["generatedAt"],
        "items": items,
    }


def run_self_test() -> None:
    raw = [
        {"fileName": "2027考研课程【此文件夹自动更新-无需保存】", "type": "folder", "sharer": "131*****601"},
        {"fileName": "2018年考研英语一真题.pdf", "path": "/群文件/英语/2018年考研英语一真题.pdf", "size": 220_000},
        {"fileName": "扫码加群.pdf", "path": "/群文件/扫码加群.pdf", "size": 220_000},
        {"fileName": "课程视频.mp4", "path": "/群文件/课程视频.mp4", "size": 5_000_000},
    ]
    index = build_index(raw, group_name="必定上岸27考研159", dest_root=DEFAULT_DEST_ROOT, now="2026-05-22T00:00:00Z")
    queue = build_transfer_queue(index, dest_root=DEFAULT_DEST_ROOT)
    assert index["summary"]["totalRecords"] == 4
    assert index["summary"]["folderRecords"] == 1
    assert queue["summary"]["totalQueueItems"] == 1
    assert queue["items"][0]["track"] == "english1"
    assert queue["items"][0]["targetDirectory"] == "/apps/考研大师/raw-pdf/english1/2018"
    print("[group-file-index] self-test passed")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a read-only Baidu group-file index and transfer queue.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--group-name", default="必定上岸27考研159")
    parser.add_argument("--index-output", type=Path, default=DEFAULT_INDEX_OUTPUT)
    parser.add_argument("--queue-output", type=Path, default=DEFAULT_QUEUE_OUTPUT)
    parser.add_argument("--source-export-output", type=Path, default=DEFAULT_SOURCE_EXPORT)
    parser.add_argument("--dest-root", default=DEFAULT_DEST_ROOT)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return 0

    try:
        raw_items, meta = parse_input(args.input)
    except FileNotFoundError as error:
        print(f"[group-file-index] blocked: {error}")
        return 2

    index = build_index(raw_items, group_name=args.group_name, dest_root=args.dest_root)
    queue = build_transfer_queue(index, dest_root=args.dest_root)
    source_export = build_source_export(index)

    print(
        "[group-file-index] "
        f"format={meta['inputFormat']} "
        f"records={index['summary']['totalRecords']} "
        f"approvalRequired={queue['summary']['approvalRequired']} "
        f"rejected={index['summary']['rejectedRecords']}"
    )

    if args.dry_run:
        print("[group-file-index] dry-run, outputs not written")
        return 0

    write_json(args.index_output, index)
    write_json(args.queue_output, queue)
    write_json(args.source_export_output, source_export)
    print(f"[group-file-index] wrote {args.index_output}")
    print(f"[group-file-index] wrote {args.queue_output}")
    print(f"[group-file-index] wrote {args.source_export_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
