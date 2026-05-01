#!/usr/bin/env python3
"""
Incremental resource collector for EXAM-MASTER.

Primary path:
  Baidu official app directory -> Source Manifest -> optional download queue

Group path:
  Official group-service export / browser-export JSON -> Source Manifest

This script does not store cookies, BDUSS, API keys, or access tokens. Baidu
OAuth tokens are read by scripts/baidu/pan.py from the local environment.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BAIDU_DIR = PROJECT_ROOT / "scripts" / "baidu"
sys.path.insert(0, str(BAIDU_DIR))

from pan import BaiduPan, format_size  # noqa: E402
from source_manifest import (  # noqa: E402
    DEFAULT_MANIFEST,
    build_manifest_from_payload,
    load_manifest,
    utc_now,
    write_json,
)


DEFAULT_DOWNLOAD_DIR = PROJECT_ROOT / "data" / "raw-inbox"
DEFAULT_REPORT = PROJECT_ROOT / "data" / "source-manifest-report.json"
DOWNLOADABLE_SOURCE_CHANNELS = {"app_dir", "netdisk_full_path"}


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def scan_app_directory(scan_dir: str, *, recursive: bool) -> list[dict[str, Any]]:
    pan = BaiduPan(allow_full_path=scan_dir.startswith("/"))
    if recursive and hasattr(pan, "list_all_files"):
        return pan.list_all_files(scan_dir)
    return pan.list_files(scan_dir, recursive=recursive)


def source_channel_for_scan_dirs(scan_dirs: list[str]) -> str:
    has_full_path = any(scan_dir.startswith("/") for scan_dir in scan_dirs)
    has_app_path = any(not scan_dir.startswith("/") for scan_dir in scan_dirs)
    if has_full_path and has_app_path:
        raise ValueError("do not mix full netdisk paths and app-directory paths in one scan")
    return "netdisk_full_path" if has_full_path else "app_dir"


def merge_sources(
    *,
    app_files: list[dict[str, Any]],
    group_export_path: Path | None,
    manifest_path: Path,
    app_source_channel: str = "app_dir",
) -> tuple[dict[str, Any], dict[str, Any]]:
    report: dict[str, Any] = {
        "runAt": utc_now(),
        "inputs": {
            "appFiles": len(app_files),
            "groupFiles": 0,
        },
        "summaries": {},
    }

    app_payload = {"items": app_files}
    app_manifest, app_summary = build_manifest_from_payload(
        app_payload,
        provider="baidu_pan",
        source_channel=app_source_channel,
        existing_path=manifest_path,
    )
    report["summaries"][app_source_channel] = app_summary

    if not group_export_path:
        return app_manifest, report

    group_payload = read_json(group_export_path)
    group_items = group_payload.get("items") if isinstance(group_payload, dict) else group_payload
    report["inputs"]["groupFiles"] = len(group_items or [])

    temp_path = PROJECT_ROOT / "data" / ".source-manifest-app-stage.json"
    write_json(temp_path, app_manifest)
    group_manifest, group_summary = build_manifest_from_payload(
        group_payload,
        provider="baidu_pan",
        source_channel="group_service",
        existing_path=temp_path,
    )
    try:
        temp_path.unlink()
    except FileNotFoundError:
        pass

    report["summaries"]["group_service"] = group_summary
    return group_manifest, report


def select_download_candidates(manifest: dict[str, Any], *, limit: int = 0) -> list[dict[str, Any]]:
    candidates = []
    for item in manifest.get("items", []):
        if not item.get("eligible"):
            continue
        if item.get("status") not in {"discovered", "missing"}:
            continue
        if item.get("sourceChannel") not in DOWNLOADABLE_SOURCE_CHANNELS:
            continue
        if not item.get("fsId"):
            continue
        candidates.append(item)

    candidates.sort(key=lambda row: (-int(row.get("priority", 0)), str(row.get("fileName", ""))))
    return candidates[:limit] if limit > 0 else candidates


def download_candidates(candidates: list[dict[str, Any]], download_dir: Path, *, dry_run: bool) -> dict[str, Any]:
    result = {"planned": len(candidates), "downloaded": 0, "failed": []}
    if not candidates:
        return result

    if dry_run:
        for item in candidates[:20]:
            print(f"[baidu-sync] plan download {item['fileName']} {format_size(item.get('size', 0))}")
        if len(candidates) > 20:
            print(f"[baidu-sync] ... {len(candidates) - 20} more")
        return result

    allow_full_path = any(
        item.get("sourceChannel") == "netdisk_full_path"
        or str(item.get("remotePath") or "").startswith("/EXAM-MASTER/")
        for item in candidates
    )
    pan = BaiduPan(allow_full_path=allow_full_path)
    download_dir.mkdir(parents=True, exist_ok=True)

    for item in candidates:
        safe_name = item["fileName"].replace("/", "_")
        target_path = download_dir / safe_name
        try:
            if target_path.exists() and target_path.stat().st_size == int(item.get("size") or 0):
                result["downloaded"] += 1
                continue
            pan.download(item["remotePath"], str(target_path), overwrite=True)
            result["downloaded"] += 1
        except Exception as exc:  # noqa: BLE001 - CLI should keep processing batch.
            result["failed"].append({"sourceId": item["sourceId"], "fileName": item["fileName"], "error": str(exc)})

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Incrementally scan Baidu Pan resources into Source Manifest.")
    parser.add_argument(
        "--scan-dir",
        action="append",
        dest="scan_dirs",
        help="Baidu scan path. Relative paths scan under /apps/考研大师; absolute paths scan the full netdisk path.",
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--group-export", type=Path, help="JSON export from official group service or browser collector.")
    parser.add_argument("--download-dir", type=Path, default=DEFAULT_DOWNLOAD_DIR)
    parser.add_argument("--download", action="store_true", help="Download eligible app-directory documents after manifest merge.")
    parser.add_argument("--download-limit", type=int, default=0)
    parser.add_argument("--no-recursive", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    scan_dirs = args.scan_dirs or ["raw-pdf"]
    source_channel = source_channel_for_scan_dirs(scan_dirs)
    app_files = []
    scan_stats = []
    for scan_dir in scan_dirs:
        print(f"[baidu-sync] scan dir={scan_dir}")
        scanned = scan_app_directory(scan_dir, recursive=not args.no_recursive)
        app_files.extend(scanned)
        scan_stats.append({"scanDir": scan_dir, "files": len(scanned)})

    manifest, report = merge_sources(
        app_files=app_files,
        group_export_path=args.group_export,
        manifest_path=args.manifest,
        app_source_channel=source_channel,
    )
    report["scanDirs"] = scan_stats

    candidates = select_download_candidates(manifest, limit=args.download_limit)
    report["download"] = {"enabled": args.download, "candidates": len(candidates)}

    if args.download:
        report["download"].update(download_candidates(candidates, args.download_dir, dry_run=args.dry_run))

    print(
        "[baidu-sync] manifest "
        + " ".join(f"{key}={value}" for key, value in manifest.get("summary", {}).items())
    )

    if args.dry_run:
        print("[baidu-sync] dry-run, manifest/report not written")
        return

    write_json(args.manifest, manifest)
    write_json(args.report, report)
    print(f"[baidu-sync] wrote {args.manifest}")
    print(f"[baidu-sync] wrote {args.report}")


if __name__ == "__main__":
    main()
