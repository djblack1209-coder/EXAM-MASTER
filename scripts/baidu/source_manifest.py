#!/usr/bin/env python3
"""
Source Manifest builder for EXAM-MASTER question-bank ingestion.

The manifest is the stable handoff between Baidu Pan / group collectors and
the PDF-to-question cleaning pipeline. It deliberately stores metadata and
processing state only, not raw secrets or downloaded files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = PROJECT_ROOT / "data" / "source-manifest.json"

DOC_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md", ".json", ".html", ".htm"}
SECONDARY_EXTENSIONS = {".ppt", ".pptx"}
SKIP_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".m4v",
    ".avi",
    ".mkv",
    ".mp3",
    ".m4a",
    ".wav",
    ".zip",
    ".rar",
    ".7z",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
}

AD_KEYWORDS = [
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

BRAND_KEYWORDS = [
    "肖秀荣",
    "徐涛",
    "腿姐",
    "陆寓丰",
    "唐迟",
    "田静",
    "刘晓艳",
    "李永乐",
    "王式安",
    "汤家凤",
    "张宇",
    "李林",
    "武忠祥",
    "新东方",
    "文都",
    "中公",
    "粉笔",
    "考虫",
    "有道",
    "跨考",
    "启航",
    "海天",
    "海文",
    "万学",
    "黄皮书",
    "红宝书",
]

SUBJECT_RULES = [
    ("politics", re.compile(r"政治|马原|毛中特|思修|史纲|形势", re.I)),
    ("english", re.compile(r"英语|english|阅读|完形|翻译|作文", re.I)),
    ("math", re.compile(r"数学|高数|线代|概率|数一|数二|数三", re.I)),
]

TRACK_RULES = [
    ("english1", re.compile(r"英语\s*[（(]?\s*一\s*[）)]?|英一|(?<!\d)201(?![\d-])", re.I)),
    ("english2", re.compile(r"英语\s*[（(]?\s*二\s*[）)]?|英二|(?<!\d)204(?![\d-])", re.I)),
    ("math1", re.compile(r"数学\s*[（(]?\s*一\s*[）)]?|数一|(?<!\d)301(?![\d-])", re.I)),
    ("math2", re.compile(r"数学\s*[（(]?\s*二\s*[）)]?|数二|(?<!\d)302(?![\d-])", re.I)),
    ("math3", re.compile(r"数学\s*[（(]?\s*三\s*[）)]?|数三|(?<!\d)303(?![\d-])", re.I)),
    ("politics", re.compile(r"政治|(?<!\d)101(?![\d-])", re.I)),
]

OFFICIAL_PAPER_RE = re.compile(r"真题|历年|试题|试卷|答案|解析", re.I)
INSTITUTION_RE = re.compile(
    r"讲义|课程|强化|冲刺|押题|密训|模拟|题库|资料|预测|背诵|做题本|每日一句|句句真言|试看|有偿|本店精品|词汇|串记|自测|1000题|精缩|配套练习|基础30讲",
    re.I,
)
YEAR_RE = re.compile(r"(19|20)\d{2}")
SUBJECT_LABELS = {
    "politics": "政治",
    "english": "英语",
    "math": "数学",
}
HUMAN_VERIFICATION_REQUIRED_FLAG = "human_verification_required"
HUMAN_VERIFICATION_FIELDS = ("sourceUrl", "verifiedBy", "evidenceNote")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_size(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def normalize_mtime(value: Any) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


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


def get_raw_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("items", "list", "files", "records"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    raise ValueError("input JSON must be a list or contain items/list/files/records")


def pick_text(raw: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = raw.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def guess_subject(text: str) -> str:
    for subject, pattern in SUBJECT_RULES:
        if pattern.search(text):
            return subject
    return "unknown"


def guess_track(text: str, subject: str) -> str:
    for track, pattern in TRACK_RULES:
        if pattern.search(text):
            return track
    return subject if subject in {"politics"} else "unknown"


def guess_year(text: str) -> int | None:
    matches = [int(match.group(0)) for match in YEAR_RE.finditer(text)]
    candidates = [year for year in matches if 1980 <= year <= 2035]
    return candidates[0] if candidates else None


def normalize_year(value: Any, fallback_text: str, preferred_text: str = "") -> int | None:
    preferred_year = guess_year(preferred_text)
    if preferred_year:
        return preferred_year
    try:
        year = int(value)
        if 1980 <= year <= 2035:
            return year
    except (TypeError, ValueError):
        pass
    return guess_year(fallback_text)


def classify_source(text: str, extension: str, size: int) -> tuple[str, bool, list[str], int]:
    risk_flags: list[str] = []

    if extension in SKIP_EXTENSIONS:
        return "unsupported_media", False, ["unsupported_media"], 0

    if size and size < 50 * 1024 and extension == ".pdf":
        risk_flags.append("too_small")

    if any(keyword in text for keyword in AD_KEYWORDS):
        risk_flags.append("ad_or_promo")

    if any(keyword in text for keyword in BRAND_KEYWORDS):
        risk_flags.append("brand_leak")

    is_doc = extension in DOC_EXTENSIONS
    is_secondary = extension in SECONDARY_EXTENSIONS

    if "ad_or_promo" in risk_flags:
        return "ad", False, risk_flags, 0

    if (is_doc or is_secondary) and ("brand_leak" in risk_flags or INSTITUTION_RE.search(text)):
        risk_flags.extend(["institution_candidate", "copyright_review_required"])
        return "institution_candidate", True, sorted(set(risk_flags)), 70

    if is_doc and OFFICIAL_PAPER_RE.search(text):
        return "official_paper", True, risk_flags, 100

    if (is_doc or is_secondary) and INSTITUTION_RE.search(text):
        risk_flags.extend(["institution_candidate", "copyright_review_required"])
        return "institution_candidate", True, sorted(set(risk_flags)), 70

    if is_doc:
        return "unknown_document", True, risk_flags, 50

    if is_secondary:
        return "secondary_document", False, ["manual_review_required", *risk_flags], 20

    return "unsupported", False, ["unsupported_extension", *risk_flags], 0


def sanitize_display_name(file_name: str, subject: str, source_type: str) -> tuple[str, bool]:
    """Return a user-safe file label with teacher/institution words removed."""

    extension = Path(file_name).suffix
    stem = Path(file_name).stem or file_name
    original = stem

    for keyword in BRAND_KEYWORDS:
        stem = stem.replace(keyword, "")
    for keyword in AD_KEYWORDS:
        stem = stem.replace(keyword, "")

    stem = re.sub(r"[\[\]【】（）()]+", " ", stem)
    stem = re.sub(r"[_\-—]+", " ", stem)
    stem = re.sub(r"\s+", "", stem).strip()

    subject_label = SUBJECT_LABELS.get(subject, "")
    if source_type == "institution_candidate" and subject_label and subject_label not in stem:
        stem = f"{subject_label}{stem}"

    if not stem:
        stem = subject_label or "待清洗资料"

    return f"{stem}{extension}", stem != original


def build_legal_review(risk_flags: list[str], *, brand_sanitized: bool, source_type: str) -> dict[str, Any]:
    return {
        "brandSanitized": brand_sanitized or "brand_leak" in risk_flags,
        "copyrightReviewRequired": "copyright_review_required" in risk_flags or source_type == "institution_candidate",
        "adRejected": source_type == "ad" or "ad_or_promo" in risk_flags,
        "publishBlocked": bool(
            set(risk_flags)
            & {
                "brand_leak",
                "copyright_review_required",
                "answer_missing",
                HUMAN_VERIFICATION_REQUIRED_FLAG,
            }
        ),
    }


def list_text_values(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def human_field_value(raw: dict[str, Any], field: str) -> str:
    aliases = {
        "sourceUrl": ("sourceUrl", "source_url", "officialUrl", "url"),
        "verifiedBy": ("verifiedBy", "verified_by"),
        "evidenceNote": ("evidenceNote", "evidence_note"),
    }
    return pick_text(raw, *aliases[field])


def missing_human_verification_fields(raw: dict[str, Any], *, requested_status: str) -> list[str]:
    missing_fields = set(list_text_values(raw.get("missingHumanFields") or raw.get("missing_human_fields")))
    draft_status = pick_text(raw, "draftStatus", "draft_status")
    human_field_status = pick_text(raw, "humanFieldStatus", "human_field_status")
    requires_human_input = (
        draft_status == "requires_human_verification"
        or human_field_status == "requires_human_input"
        or bool(missing_fields)
        or requested_status in {"verified", "published"}
    )

    if not requires_human_input:
        return []

    for field in HUMAN_VERIFICATION_FIELDS:
        value = human_field_value(raw, field)
        if not value or (field == "evidenceNote" and value.startswith("DRAFT:")):
            missing_fields.add(field)

    return sorted(missing_fields)


def normalize_record(
    raw: dict[str, Any],
    *,
    provider: str,
    source_channel: str,
    now: str,
) -> dict[str, Any]:
    file_name = pick_text(raw, "server_filename", "fileName", "filename", "name")
    remote_path = pick_text(raw, "path", "remotePath", "server_path")
    if not file_name and remote_path:
        file_name = Path(remote_path).name
    if not remote_path:
        remote_path = file_name

    extension = Path(file_name).suffix.lower()
    size = normalize_size(raw.get("size") or raw.get("fileSize"))
    mtime = normalize_mtime(
        raw.get("server_mtime")
        or raw.get("mtime")
        or raw.get("modifiedTime")
        or raw.get("updatedAt")
    )
    remote_id = pick_text(raw, "fs_id", "fsId", "remoteId", "id", "shareId")
    content_hash = pick_text(raw, "sha256", "fileSha256", "sourceHash", "md5", "contentHash", "hash")
    text_for_rules = f"{remote_path}/{file_name}"
    subject = pick_text(raw, "subject", "courseSubject") or guess_subject(text_for_rules)
    track = pick_text(raw, "track", "courseTrack", "examTrack") or guess_track(text_for_rules, subject)
    year = normalize_year(raw.get("year"), text_for_rules, file_name)
    source_type, eligible, risk_flags, priority = classify_source(text_for_rules, extension, size)
    explicit_source_type = pick_text(raw, "sourceType", "source_type")
    if explicit_source_type in {
        "official_paper",
        "official_question_paper",
        "official_syllabus",
        "institution_candidate",
        "unknown_document",
    } and source_type not in {
        "ad",
        "unsupported",
        "unsupported_media",
    }:
        source_type = explicit_source_type
        if explicit_source_type == "official_paper":
            eligible = True
            priority = max(priority, 100)
        elif explicit_source_type == "official_question_paper":
            eligible = True
            priority = max(priority, 95)
            if pick_text(raw, "answerEvidenceStatus", "answer_evidence_status") != "matched":
                risk_flags.append("answer_missing")
        elif explicit_source_type == "institution_candidate":
            eligible = True
            priority = max(priority, 70)
        elif explicit_source_type == "official_syllabus":
            eligible = True
            priority = max(priority, 90)
    safe_display_name, brand_sanitized = sanitize_display_name(file_name, subject, source_type)
    requested_status = pick_text(raw, "status", "sourceStatus")
    draft_status = pick_text(raw, "draftStatus", "draft_status")
    human_field_status = pick_text(raw, "humanFieldStatus", "human_field_status")
    missing_human_fields = missing_human_verification_fields(raw, requested_status=requested_status)
    human_verification_required = (
        draft_status == "requires_human_verification"
        or human_field_status == "requires_human_input"
        or bool(missing_human_fields)
    )
    if human_verification_required:
        risk_flags.append(HUMAN_VERIFICATION_REQUIRED_FLAG)

    status = "discovered" if eligible else "rejected"
    if requested_status in {"verified", "published"} and eligible and not human_verification_required:
        status = requested_status
    elif requested_status in {"discovered", "missing", "rejected"}:
        status = requested_status if eligible else "rejected"
    identity = sha256_text(f"{provider}|{source_channel}|{remote_id or remote_path}|{remote_path}|{file_name}")
    fingerprint = sha256_text(f"{provider}|{source_channel}|{remote_id}|{remote_path}|{size}|{mtime}|{content_hash}")
    canonical_track = track if track != "unknown" else subject
    canonical_year = str(year) if year else "unknown"

    record = {
        "sourceId": f"src_{identity[:24]}",
        "fingerprint": fingerprint,
        "provider": provider,
        "sourceChannel": source_channel,
        "groupName": pick_text(raw, "groupName", "group_name", "source_label"),
        "examCycle": raw.get("examCycle") or raw.get("exam_cycle") or raw.get("collectionYear"),
        "collectionRoot": pick_text(raw, "collectionRoot", "collection_root"),
        "courseCategory": pick_text(raw, "courseCategory", "course_category"),
        "institutionName": pick_text(raw, "institutionName", "institution_name", "institution"),
        "institutionKey": pick_text(raw, "institutionKey", "institution_key"),
        "direction": pick_text(raw, "direction", "major", "discipline"),
        "targetDirectory": pick_text(raw, "targetDirectory", "target_directory"),
        "approvalRequired": bool(raw.get("approvalRequired") or raw.get("approval_required")),
        "remoteId": remote_id,
        "fsId": raw.get("fs_id") or raw.get("fsId"),
        "remotePath": remote_path,
        "fileName": file_name,
        "safeDisplayName": safe_display_name,
        "extension": extension,
        "size": size,
        "mtime": mtime,
        "contentHash": content_hash,
        "sourceUrl": pick_text(raw, "sourceUrl", "source_url", "officialUrl", "url"),
        "provenanceUrl": pick_text(raw, "provenanceUrl", "provenance_url"),
        "licenseStatus": pick_text(raw, "licenseStatus", "license_status"),
        "answerEvidenceStatus": pick_text(raw, "answerEvidenceStatus", "answer_evidence_status"),
        "sourceRole": pick_text(raw, "sourceRole", "source_role"),
        "questionTextHash": pick_text(raw, "questionTextHash", "question_text_hash"),
        "answerTextHash": pick_text(raw, "answerTextHash", "answer_text_hash"),
        "rawTextSlicePath": pick_text(raw, "rawTextSlicePath", "raw_text_slice_path"),
        "evidenceNote": pick_text(raw, "evidenceNote", "evidence_note"),
        "verifiedAt": pick_text(raw, "verifiedAt", "verified_at"),
        "verifiedBy": pick_text(raw, "verifiedBy", "verified_by"),
        "subject": subject,
        "track": track,
        "year": year,
        "sourceType": source_type,
        "canonicalKey": f"{canonical_track}:{canonical_year}:{source_type}:{safe_display_name}",
        "eligible": eligible,
        "priority": priority,
        "status": status,
        "riskFlags": sorted(set(risk_flags)),
        "legalReview": build_legal_review(risk_flags, brand_sanitized=brand_sanitized, source_type=source_type),
        "firstSeenAt": now,
        "lastSeenAt": now,
        "changedAt": now,
        "processing": {
            "downloaded": False,
            "extracted": False,
            "verified": False,
            "published": False,
        },
    }

    if draft_status:
        record["draftStatus"] = draft_status
    if human_field_status:
        record["humanFieldStatus"] = human_field_status
    if missing_human_fields or raw.get("missingHumanFields") is not None or raw.get("missing_human_fields") is not None:
        record["missingHumanFields"] = missing_human_fields

    return record


def load_manifest(path: Path) -> dict[str, Any]:
    payload = read_json(path, {"version": 1, "items": []})
    if "items" not in payload or not isinstance(payload["items"], list):
        payload["items"] = []
    payload.setdefault("version", 1)
    return payload


def merge_manifest(existing: dict[str, Any], discovered: list[dict[str, Any]], now: str) -> tuple[dict[str, Any], dict[str, int]]:
    by_id = {item["sourceId"]: item for item in existing.get("items", []) if item.get("sourceId")}
    seen_ids: set[str] = set()
    summary = {"new": 0, "changed": 0, "unchanged": 0, "missing": 0, "eligible": 0, "rejected": 0}

    def refreshed_status(old_status: str | None, new_status: str) -> str:
        if old_status in {"verified", "published"}:
            return old_status
        if old_status == "missing":
            return new_status
        return old_status or new_status

    for item in discovered:
        source_id = item["sourceId"]
        seen_ids.add(source_id)
        old = by_id.get(source_id)

        if not old:
            by_id[source_id] = item
            summary["new"] += 1
        else:
            if old.get("fingerprint") != item.get("fingerprint"):
                preserved_processing = old.get("processing", {})
                preserved_status = old.get("status", "discovered")
                item["firstSeenAt"] = old.get("firstSeenAt", item["firstSeenAt"])
                item["processing"] = preserved_processing
                item["status"] = refreshed_status(preserved_status, item["status"])
                item.pop("missingSince", None)
                by_id[source_id] = item
                summary["changed"] += 1
            else:
                preserved_first_seen = old.get("firstSeenAt", item["firstSeenAt"])
                preserved_processing = old.get("processing", item["processing"])
                preserved_status = old.get("status", item["status"])
                old.update(item)
                old.pop("missingSince", None)
                old.update({
                    "firstSeenAt": preserved_first_seen,
                    "lastSeenAt": now,
                    "processing": preserved_processing,
                    "status": refreshed_status(preserved_status, item["status"]),
                })
                summary["unchanged"] += 1

    for source_id, item in by_id.items():
        if source_id not in seen_ids:
            item["missingSince"] = item.get("missingSince") or now
            if item.get("status") not in {"published", "verified"}:
                item["status"] = "missing"
            summary["missing"] += 1

    items = sorted(
        by_id.values(),
        key=lambda row: (-int(row.get("priority", 0)), str(row.get("subject", "")), str(row.get("track", "")), str(row.get("fileName", ""))),
    )
    summary["eligible"] = sum(1 for item in items if item.get("eligible"))
    summary["rejected"] = sum(1 for item in items if not item.get("eligible"))

    merged = {
        "version": 1,
        "updatedAt": now,
        "summary": summary,
        "items": items,
    }
    return merged, summary


def build_manifest_from_payload(
    payload: Any,
    *,
    provider: str,
    source_channel: str,
    existing_path: Path,
) -> tuple[dict[str, Any], dict[str, int]]:
    now = utc_now()
    existing = load_manifest(existing_path)
    raw_items = get_raw_items(payload)
    discovered = [
        normalize_record(raw, provider=provider, source_channel=source_channel, now=now)
        for raw in raw_items
    ]
    return merge_manifest(existing, discovered, now)


def run_self_test() -> None:
    now = "2026-04-28T00:00:00Z"
    raw = [
        {"fs_id": 1, "path": "/apps/考研大师/raw-pdf/英语一/2018英语一真题.pdf", "server_filename": "2018英语一真题.pdf", "size": 200000, "server_mtime": 1},
        {"fs_id": 2, "path": "/apps/考研大师/raw-pdf/数学/张宇强化讲义.pdf", "server_filename": "张宇强化讲义.pdf", "size": 300000, "server_mtime": 2},
        {"fs_id": 3, "path": "/apps/考研大师/raw-pdf/扫码加群.pdf", "server_filename": "扫码加群.pdf", "size": 10000, "server_mtime": 3},
        {
            "fs_id": 4,
            "path": "/verified-sources/official-2024-paper.pdf",
            "server_filename": "official-2024-paper.pdf",
            "size": 250000,
            "server_mtime": 4,
            "sha256": "sha256:official-paper-hash",
            "sourceUrl": "https://example.edu.cn/2024-english2.pdf",
            "subject": "english",
            "track": "english2",
            "year": 2024,
            "sourceType": "official_paper",
            "status": "verified",
            "answerEvidenceStatus": "matched",
            "sourceRole": "paper",
            "verifiedAt": now,
            "verifiedBy": "release-operator",
            "evidenceNote": "Human verified against the listed official source URL and local SHA-256.",
        },
        {
            "fs_id": 5,
            "path": "/verified-sources/2022-math-syllabus.html",
            "server_filename": "2022-math-syllabus.html",
            "size": 25000,
            "server_mtime": 5,
            "sha256": "sha256:official-syllabus-hash",
            "sourceUrl": "https://yankao.neea.edu.cn/html1/report/21115/5103-1.htm",
            "subject": "math",
            "track": "math1",
            "year": 2022,
            "sourceType": "official_syllabus",
            "status": "verified",
            "answerEvidenceStatus": "not_applicable",
            "verifiedAt": now,
            "verifiedBy": "release-operator",
            "evidenceNote": "Human verified against the listed official syllabus source URL.",
        },
        {
            "fs_id": 6,
            "path": "/verified-sources/2012-politics-question-paper.html",
            "server_filename": "2012-politics-question-paper.html",
            "size": 30000,
            "server_mtime": 6,
            "sha256": "sha256:official-question-source-hash",
            "sourceUrl": "https://yz.chsi.com.cn/kyzx/politics/200908/20090813/30056540-8.html",
            "subject": "politics",
            "track": "politics",
            "year": 2012,
            "sourceType": "official_question_paper",
            "status": "verified",
            "answerEvidenceStatus": "answer_missing",
            "verifiedAt": now,
            "verifiedBy": "release-operator",
            "evidenceNote": "Human verified as question-paper-only evidence; answer evidence is absent.",
        },
    ]
    discovered = [normalize_record(item, provider="baidu_pan", source_channel="self_test", now=now) for item in raw]
    merged, summary = merge_manifest({"version": 1, "items": []}, discovered, now)
    items = merged["items"]
    assert summary["new"] == 6
    assert summary["eligible"] == 5
    assert any(item["sourceType"] == "official_paper" and item["track"] == "english1" for item in items)
    verified = next(item for item in items if item["track"] == "english2")
    assert verified["contentHash"] == "sha256:official-paper-hash"
    assert verified["sourceUrl"] == "https://example.edu.cn/2024-english2.pdf"
    assert verified["status"] == "verified"
    assert verified["answerEvidenceStatus"] == "matched"
    assert verified["sourceRole"] == "paper"
    assert verified["verifiedBy"] == "release-operator"
    syllabus = next(item for item in items if item["sourceType"] == "official_syllabus")
    assert syllabus["track"] == "math1"
    assert syllabus["contentHash"] == "sha256:official-syllabus-hash"
    assert syllabus["status"] == "verified"
    question_source = next(item for item in items if item["sourceType"] == "official_question_paper")
    assert question_source["track"] == "politics"
    assert question_source["contentHash"] == "sha256:official-question-source-hash"
    assert "answer_missing" in question_source["riskFlags"]
    assert question_source["legalReview"]["publishBlocked"] is True
    branded = next(item for item in items if "brand_leak" in item["riskFlags"])
    assert branded["safeDisplayName"] == "数学强化讲义.pdf"
    assert branded["legalReview"]["brandSanitized"] is True
    assert branded["canonicalKey"] == "math:unknown:institution_candidate:数学强化讲义.pdf"
    assert any(item["sourceType"] == "ad" and not item["eligible"] for item in items)
    print("[source-manifest] self-test passed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build or merge EXAM-MASTER source manifest.")
    parser.add_argument("--input", type=Path, help="JSON export from Baidu Pan/group collector.")
    parser.add_argument("--existing", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--provider", default="baidu_pan")
    parser.add_argument("--source-channel", default="app_dir")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return

    if not args.input:
        raise SystemExit("--input is required unless --self-test is used")

    payload = read_json(args.input, None)
    manifest, summary = build_manifest_from_payload(
        payload,
        provider=args.provider,
        source_channel=args.source_channel,
        existing_path=args.existing,
    )

    print(
        "[source-manifest] "
        + " ".join(f"{key}={value}" for key, value in summary.items())
    )
    if args.dry_run:
        print("[source-manifest] dry-run, manifest not written")
        return

    write_json(args.output, manifest)
    print(f"[source-manifest] wrote {args.output}")


if __name__ == "__main__":
    main()
