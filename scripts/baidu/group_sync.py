#!/usr/bin/env python3
"""
Baidu Pan group/share-link resource sync for EXAM-MASTER.

This module intentionally implements the stable share-link route first. Group
direct APIs remain an optional future collector and are not required by the
Source Manifest pipeline.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY = PROJECT_ROOT / "data" / "link-registry.json"
DEFAULT_STATE = PROJECT_ROOT / "data" / "transferred-links.json"
DEFAULT_EXPORT = PROJECT_ROOT / "data" / "group-export-latest.json"
DEFAULT_REPORT = PROJECT_ROOT / "data" / "group-sync-report.json"
DEFAULT_DEST_DIR = "/apps/考研大师/raw-pdf"
DEFAULT_USER_AGENT = "pan.baidu.com"


DEFAULT_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md", ".json"}
DEFAULT_EXCLUDE_KEYWORDS = [
    "报名",
    "咨询",
    "加群",
    "优惠",
    "客服",
    "答疑",
    "二维码",
    "扫码",
    "领取",
    "公众号",
    "微信群",
    "QQ群",
    "课程表",
    "购买",
]


try:
    from dotenv import load_dotenv

    load_dotenv(PROJECT_ROOT / ".env")
except Exception:
    pass


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def normalize_registry(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("link registry must be a JSON object")

    links = payload.get("links")
    if not isinstance(links, list):
        raise ValueError("link registry must contain a links array")

    normalized: list[dict[str, Any]] = []
    for index, link in enumerate(links):
        if not isinstance(link, dict):
            raise ValueError(f"registry link #{index + 1} must be an object")

        missing = [key for key in ("id", "url", "pwd") if not str(link.get(key) or "").strip()]
        if missing:
            raise ValueError(f"registry link #{index + 1} missing required field(s): {', '.join(missing)}")

        normalized.append({**link, "id": str(link["id"]).strip()})

    return {"version": int(payload.get("version") or 1), "links": normalized}


def validate_registry(payload: Any) -> dict[str, list[str]]:
    """Validate registry shape and operational hints without touching Baidu."""

    result = {"errors": [], "warnings": []}
    try:
        registry = normalize_registry(payload)
    except ValueError as exc:
        result["errors"].append(str(exc))
        return result

    seen_ids: set[str] = set()
    duplicate_ids: set[str] = set()
    for link in registry["links"]:
        link_id = str(link["id"])
        if link_id in seen_ids:
            duplicate_ids.add(link_id)
        seen_ids.add(link_id)

        if not str(link.get("subject") or "").strip() or not str(link.get("year") or "").strip():
            result["warnings"].append(f"link {link_id} has no subject/year; files will transfer to inbox")

    for link_id in sorted(duplicate_ids):
        result["errors"].append(f"duplicate link id: {link_id}")

    return result


def get_file_name(item: dict[str, Any]) -> str:
    return str(item.get("server_filename") or item.get("fileName") or item.get("filename") or item.get("name") or "")


def flatten_share_tree(
    root_files: list[dict[str, Any]],
    fetch_children: Callable[[str], list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Flatten a shared folder tree while preserving file discovery order."""

    flattened: list[dict[str, Any]] = []
    visited_dirs: set[str] = set()

    def visit(items: list[dict[str, Any]]) -> None:
        dirs: list[str] = []
        for item in items:
            is_dir = int(item.get("isdir") or 0) == 1
            if not is_dir:
                flattened.append(item)
                continue

            path = str(item.get("path") or "").strip()
            if not path or path in visited_dirs:
                continue

            visited_dirs.add(path)
            dirs.append(path)

        for path in dirs:
            visit(fetch_children(path))

    visit(root_files)
    return flattened


def filter_share_files(files: list[dict[str, Any]], filter_cfg: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Return share-link files that are worth transferring into the resource pipeline."""

    cfg = filter_cfg or {}
    extensions = {str(ext).lower() for ext in cfg.get("extensions", DEFAULT_EXTENSIONS)}
    min_size = int(cfg.get("min_size_kb", 50) or 0) * 1024
    exclude_keywords = [str(keyword) for keyword in cfg.get("exclude_keywords", DEFAULT_EXCLUDE_KEYWORDS)]

    selected: list[dict[str, Any]] = []
    for item in files:
        if int(item.get("isdir") or 0) == 1:
            continue

        name = get_file_name(item)
        extension = Path(name).suffix.lower()
        size = int(item.get("size") or 0)

        if extension not in extensions:
            continue
        if size < min_size:
            continue
        if any(keyword and keyword in name for keyword in exclude_keywords):
            continue

        selected.append(item)

    return selected


def build_group_export_records(
    files: list[dict[str, Any]],
    link: dict[str, Any],
    dest_dir: str,
) -> list[dict[str, Any]]:
    """Build Source Manifest-compatible records after share-link transfer."""

    clean_dest = dest_dir.rstrip("/")
    records: list[dict[str, Any]] = []

    for item in files:
        file_name = get_file_name(item)
        record = {
            "path": f"{clean_dest}/{file_name}",
            "server_filename": file_name,
            "fs_id": item.get("fs_id") or item.get("fsId"),
            "size": int(item.get("size") or 0),
            "server_mtime": int(item.get("server_mtime") or item.get("mtime") or 0),
            "md5": str(item.get("md5") or item.get("contentHash") or ""),
            "source": "sharelink",
            "source_label": str(link.get("label") or ""),
            "link_id": str(link.get("id") or ""),
            "subject": str(link.get("subject") or ""),
            "track": str(link.get("track") or ""),
            "year": link.get("year"),
        }
        records.append(record)

    return records


def get_file_id(item: dict[str, Any]) -> Any:
    return item.get("fs_id") or item.get("fsId") or item.get("id")


def build_dest_path(dest_dir: str, link: dict[str, Any]) -> str:
    base = dest_dir.rstrip("/")
    subject = str(link.get("subject") or "").strip()
    year = str(link.get("year") or "").strip()
    if subject and year:
        return f"{base}/{subject}/{year}"
    return f"{base}/inbox"


def run_incremental_sync(export_path: Path) -> None:
    subprocess.run(
        [
            sys.executable,
            str(PROJECT_ROOT / "scripts" / "baidu" / "incremental_sync.py"),
            "--group-export",
            str(export_path),
        ],
        check=False,
    )


def utc_timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def create_sync_report(*, dry_run: bool) -> dict[str, Any]:
    return {
        "version": 1,
        "run_at": utc_timestamp(),
        "dry_run": dry_run,
        "summary": {
            "links": 0,
            "total_files": 0,
            "eligible": 0,
            "new": 0,
            "transferred": 0,
            "failed": 0,
            "skipped": 0,
            "errors": 0,
        },
        "links": [],
    }


def append_report_row(report: dict[str, Any], row: dict[str, Any]) -> None:
    report["links"].append(row)
    summary = report["summary"]
    summary["links"] += 1
    for key in ("total_files", "eligible", "new", "transferred", "failed", "skipped", "errors"):
        summary[key] += int(row.get(key) or 0)


def sync_sharelinks(
    *,
    registry_path: Path = DEFAULT_REGISTRY,
    state_path: Path = DEFAULT_STATE,
    export_path: Path = DEFAULT_EXPORT,
    report_path: Path | None = None,
    dest_dir: str = DEFAULT_DEST_DIR,
    dry_run: bool = False,
    link_id: str | None = None,
    resolver: Callable[[str, str], dict[str, Any]] | None = None,
    transfer: Callable[[dict[str, Any], list[Any], str], dict[str, list[Any]]] | None = None,
    run_incremental: Callable[[Path], None] | None = run_incremental_sync,
) -> list[dict[str, Any]]:
    """Sync registered share links and return Source Manifest export records."""

    registry = normalize_registry(read_json(registry_path, {"version": 1, "links": []}))
    state = read_json(state_path, {"version": 1, "done": {}})
    if "done" not in state or not isinstance(state["done"], dict):
        state["done"] = {}

    resolve = resolver or resolve_share_link
    transfer_files_fn = transfer or transfer_files

    links = registry["links"]
    if link_id:
        links = [link for link in links if link["id"] == link_id]

    export_records: list[dict[str, Any]] = []
    report = create_sync_report(dry_run=dry_run)

    for link in links:
        row = {
            "id": link["id"],
            "label": str(link.get("label") or ""),
            "status": "skipped",
            "total_files": 0,
            "eligible": 0,
            "new": 0,
            "transferred": 0,
            "failed": 0,
            "skipped": 0,
            "errors": 0,
            "error": "",
        }

        try:
            share_info = resolve(str(link["url"]), str(link.get("pwd") or ""))
            all_files = share_info.get("files", [])
            candidates = filter_share_files(all_files, link.get("filter"))
            done_ids = set(str(value) for value in state["done"].get(link["id"], {}).get("fs_ids", []))
            new_files = [item for item in candidates if str(get_file_id(item)) not in done_ids]

            row["total_files"] = len(all_files)
            row["eligible"] = len(candidates)
            row["new"] = len(new_files)
            row["skipped"] = max(0, len(candidates) - len(new_files))

            if not new_files:
                append_report_row(report, row)
                continue

            dest_path = build_dest_path(dest_dir, link)

            if dry_run:
                row["status"] = "planned"
                row["transferred"] = len(new_files)
                export_records.extend(build_group_export_records(new_files, link, dest_path))
                append_report_row(report, row)
                continue

            file_ids = [get_file_id(item) for item in new_files if get_file_id(item) is not None]
            transfer_result = transfer_files_fn(share_info, file_ids, dest_path)
            success_ids = set(str(value) for value in transfer_result.get("success", []))
            successful_files = [item for item in new_files if str(get_file_id(item)) in success_ids]

            row["transferred"] = len(successful_files)
            row["failed"] = len(transfer_result.get("failed", []))
            row["status"] = "transferred" if successful_files else "failed"

            if not successful_files:
                append_report_row(report, row)
                continue

            link_state = state["done"].setdefault(link["id"], {"fs_ids": [], "last_sync": None})
            existing_ids = set(str(value) for value in link_state.get("fs_ids", []))
            for item in successful_files:
                fs_id = str(get_file_id(item))
                if fs_id not in existing_ids:
                    link_state["fs_ids"].append(fs_id)
                    existing_ids.add(fs_id)
            link_state["last_sync"] = utc_timestamp()

            export_records.extend(build_group_export_records(successful_files, link, dest_path))
            append_report_row(report, row)
        except Exception as exc:  # noqa: BLE001 - batch sync should isolate bad links.
            row["status"] = "failed"
            row["errors"] = 1
            row["error"] = str(exc)
            append_report_row(report, row)

    if dry_run:
        if report_path:
            write_json(report_path, report)
        return export_records

    if export_records:
        write_json(state_path, state)
        write_json(export_path, {"version": 1, "files": export_records})
        if run_incremental:
            run_incremental(export_path)

    if report_path:
        write_json(report_path, report)

    return export_records


def extract_surl(url: str) -> str:
    match = re.search(r"/s/1([A-Za-z0-9_-]+)", url)
    if match:
        return match.group(1)

    query_value = parse_qs(urlparse(url).query).get("surl", [""])[0]
    if query_value:
        return query_value

    raise ValueError(f"unable to parse Baidu share surl from {url}")


def resolve_share_link(share_url: str, pwd: str) -> dict[str, Any]:
    """Resolve a Baidu share link into transfer metadata and file list."""

    import requests

    session = requests.Session()
    headers = {"User-Agent": DEFAULT_USER_AGENT}
    response = session.get(share_url, headers=headers, allow_redirects=True, timeout=20)
    response.raise_for_status()

    surl = extract_surl(response.url)
    shareid_match = re.search(r'"shareid"\s*:\s*"?(\d+)"?', response.text)
    uk_match = re.search(r'"uk"\s*:\s*"?(\d+)"?', response.text)
    if not (shareid_match and uk_match):
        raise ValueError(f"unable to extract shareid/uk from {share_url}")

    verify_response = session.post(
        "https://pan.baidu.com/share/verify",
        params={
            "surl": surl,
            "t": int(time.time() * 1000),
            "channel": "chunlei",
            "web": "1",
            "clienttype": "0",
        },
        data={"pwd": pwd, "vcode": "", "vcode_str": ""},
        headers={**headers, "Referer": share_url},
        timeout=20,
    )
    verify_response.raise_for_status()
    verify_data = verify_response.json()
    if verify_data.get("errno") != 0:
        raise ValueError(f"share password verification failed: {verify_data}")

    sekey = verify_data.get("randsk", "")

    def fetch_list(dir_path: str | None = None) -> list[dict[str, Any]]:
        page = 1
        collected: list[dict[str, Any]] = []
        while True:
            params = {
                "shareid": shareid_match.group(1),
                "uk": uk_match.group(1),
                "root": "0" if dir_path else "1",
                "sekey": sekey,
                "channel": "chunlei",
                "web": "1",
                "clienttype": "0",
                "page": page,
                "num": 200,
            }
            if dir_path:
                params["dir"] = dir_path

            list_response = session.get(
                "https://pan.baidu.com/share/list",
                params=params,
                headers=headers,
                timeout=20,
            )
            list_response.raise_for_status()
            list_data = list_response.json()
            batch = list_data.get("list", [])
            collected.extend(batch)
            if len(batch) < 200 or not list_data.get("has_more"):
                break
            page += 1
        return collected

    root_files = fetch_list(None)
    files = flatten_share_tree(root_files, fetch_list)

    return {
        "shareid": shareid_match.group(1),
        "uk": uk_match.group(1),
        "sekey": sekey,
        "files": files,
    }


def transfer_files(
    share_info: dict[str, Any],
    file_ids: list[Any],
    dest_path: str,
    *,
    access_token: str | None = None,
    session: Any | None = None,
    sleep_fn: Callable[[float], None] = time.sleep,
    max_retries: int = 2,
    retry_delay: int = 60,
) -> dict[str, list[Any]]:
    """Transfer share-link files into the Baidu app directory."""

    if session is None:
        import requests

        session = requests.Session()

    token = access_token or os.environ.get("BAIDU_ACCESS_TOKEN", "")
    if not token:
        raise RuntimeError("BAIDU_ACCESS_TOKEN is required for share-link transfer")

    headers = {"User-Agent": DEFAULT_USER_AGENT}
    result = {"success": [], "failed": []}

    for start in range(0, len(file_ids), 100):
        batch = file_ids[start : start + 100]
        attempts = 0

        while True:
            response = session.post(
                "https://pan.baidu.com/share/transfer",
                params={
                    "shareid": share_info["shareid"],
                    "from": share_info["uk"],
                    "sekey": share_info["sekey"],
                    "ondup": "skip",
                    "async": "1",
                    "clienttype": "0",
                    "web": "1",
                    "access_token": token,
                },
                data={"filelist": json.dumps(batch, ensure_ascii=False), "path": dest_path},
                headers=headers,
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            errno = data.get("errno")

            if errno == 0:
                result["success"].extend(batch)
                break

            if errno == 12 and attempts < max_retries:
                attempts += 1
                sleep_fn(retry_delay)
                continue

            result["failed"].extend(batch)
            break

        if start + 100 < len(file_ids):
            sleep_fn(1)

    return result


def run_self_test() -> None:
    files = [
        {"fs_id": 1, "server_filename": "2018英语一真题.pdf", "size": 220_000},
        {"fs_id": 2, "server_filename": "扫码加群.pdf", "size": 220_000},
        {"fs_id": 3, "server_filename": "课程视频.mp4", "size": 5_000_000},
    ]
    selected = filter_share_files(files)
    assert [item["fs_id"] for item in selected] == [1]
    records = build_group_export_records(
        selected,
        {"id": "self", "label": "self", "subject": "english", "track": "english1", "year": 2018},
        "/apps/考研大师/raw-pdf/english/2018",
    )
    assert records[0]["path"].endswith("/2018英语一真题.pdf")
    print("[baidu-group-sync] self-test passed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Baidu Pan share links into EXAM-MASTER Source Manifest.")
    parser.add_argument("--mode", choices=["sharelink", "cookie", "both"], default="sharelink")
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--dest-dir", default=DEFAULT_DEST_DIR)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--link-id")
    parser.add_argument("--no-incremental-sync", action="store_true")
    parser.add_argument("--validate-registry", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return

    if args.validate_registry:
        result = validate_registry(read_json(args.registry, {"version": 1, "links": []}))
        for warning in result["warnings"]:
            print(f"[baidu-group-sync] warning: {warning}")
        for error in result["errors"]:
            print(f"[baidu-group-sync] error: {error}")
        if result["errors"]:
            raise SystemExit(1)
        print(f"[baidu-group-sync] registry ok warnings={len(result['warnings'])}")
        return

    if args.mode != "sharelink":
        raise SystemExit("Only --mode=sharelink is implemented. Cookie/group direct APIs remain optional future collectors.")

    records = sync_sharelinks(
        registry_path=args.registry,
        state_path=args.state,
        export_path=args.export,
        report_path=args.report,
        dest_dir=args.dest_dir,
        dry_run=args.dry_run,
        link_id=args.link_id,
        run_incremental=None if args.no_incremental_sync else run_incremental_sync,
    )

    print(f"[baidu-group-sync] processed={len(records)} dry_run={args.dry_run}")


if __name__ == "__main__":
    main()
