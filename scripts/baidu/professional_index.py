#!/usr/bin/env python3
"""Build compact professional-course source indexes for the mini program."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = PROJECT_ROOT / "data" / "professional-source-manifest.json"
DEFAULT_DATA_OUTPUT = PROJECT_ROOT / "data" / "professional-source-index.json"
DEFAULT_MINI_OUTPUT = PROJECT_ROOT / "src" / "config" / "professional-source-index.json"
DEFAULT_MINI_LIMIT = 600

SCHOOL_PATTERN = re.compile(r"(?P<school>[\u4e00-\u9fa5A-Za-z0-9（）()·]{2,40}?(?:大学|学院|研究院|学校))")
COURSE_CODE_PATTERN = re.compile(r"(?<!\d)(?P<code>[1-9]\d{2,3})(?!\d)")
ANSWER_HINT_RE = re.compile(r"答案|解析|详解|详析|参考答案", re.I)
INSTITUTION_NAME_RE = re.compile(
    r"新东方|文都|中公|粉笔|考虫|有道|跨考|启航|海天|海文|万学|研途|高途|橙啦|社科赛斯|"
    r"肖秀荣|徐涛|腿姐|陆寓丰|唐迟|田静|刘晓艳|李永乐|王式安|汤家凤|张宇|李林|武忠祥|"
    r"黄皮书|红宝书|圣才|凯程|勤思|聚创|爱启航|文加考研",
    re.I,
)
TRACK_DIRECTION_LABELS = {
    "english": "公共英语",
    "english1": "英语一",
    "english2": "英语二",
    "politics": "公共政治",
    "math": "公共数学",
    "math1": "数学一",
    "math2": "数学二",
    "math3": "数学三",
    "unknown": "",
}
RISK_FLAG_LABELS = {
    "ad_or_promo": "广告/引流",
    "brand_leak": "品牌/教师名待脱敏",
    "copyright_review_required": "版权复核",
    "institution_candidate": "机构候选",
    "too_small": "文件过小",
    "unsupported_extension": "格式不支持",
    "unsupported_media": "媒体文件",
}
PRIORITY_LABELS = {
    "T0": "优先清洗",
    "T1": "可清洗",
    "T2": "先复核",
    "T3": "暂缓",
}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_text(value: object) -> str:
    return str(value or "").strip()


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def display_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def infer_bucket(remote_path: str) -> str:
    match = re.search(r"全国专业课真题[/\\]([^/\\]+)", remote_path)
    if match:
        return match.group(1)
    parts = [part for part in re.split(r"[/\\]+", remote_path) if part]
    return parts[-2] if len(parts) >= 2 else "未分类"


def infer_school(text: str) -> str:
    match = SCHOOL_PATTERN.search(text)
    if not match:
        return "未识别院校"
    school = match.group("school")
    school = re.sub(r"^[0-9、.．\s]+", "", school)
    return school[:40]


def infer_course_code(text: str) -> str:
    for match in COURSE_CODE_PATTERN.finditer(text):
        code = match.group("code")
        try:
            numeric = int(code)
        except ValueError:
            numeric = 0
        if 1990 <= numeric <= 2035:
            continue
        return code
    return ""


def infer_source_institution(text: str) -> str:
    match = INSTITUTION_NAME_RE.search(text)
    if not match:
        return "官方/院校资料"
    return match.group(0)


def infer_direction(item: dict, display_name: str) -> str:
    track = safe_text(item.get("track"))
    subject = safe_text(item.get("subject"))
    if TRACK_DIRECTION_LABELS.get(track):
        return TRACK_DIRECTION_LABELS[track]
    if track and track != "unknown":
        return track
    if TRACK_DIRECTION_LABELS.get(subject):
        return TRACK_DIRECTION_LABELS[subject]
    if subject and subject != "unknown":
        return subject

    if "计算机" in display_name or "数据结构" in display_name or "408" in display_name:
        return "计算机"
    if "金融" in display_name or "经济" in display_name or "396" in display_name:
        return "经济金融"
    if "法律" in display_name or "法学" in display_name:
        return "法学"
    if "教育" in display_name or "心理" in display_name:
        return "教育心理"
    if "管理" in display_name or "公共管理" in display_name:
        return "管理学"
    if "新闻" in display_name or "传播" in display_name:
        return "新闻传播"
    if "护理" in display_name or "医学" in display_name or "药学" in display_name:
        return "医学护理"
    if "马理论" in display_name or "马克思" in display_name:
        return "马克思主义理论"
    return "其他专业"


def duplicate_key(item: dict) -> str:
    if item.get("contentHash"):
        return f"hash:{item['contentHash']}"
    text = " ".join(
        [
            safe_text(item.get("school")),
            safe_text(item.get("direction")),
            safe_text(item.get("courseCode")),
            safe_text(item.get("year")),
            safe_text(item.get("fileName")),
        ]
    )
    normalized = re.sub(r"[\s_、，,。.\-—【】\[\]()（）《》<>]+", "", text.lower())
    normalized = re.sub(r"(真题|试题|试卷|答案|解析|详解|汇编|历年|考研|硕士|研究生)+", "", normalized)
    return f"text:{stable_hash(normalized)[:20]}"


def risk_labels(flags: list[str]) -> list[str]:
    return [RISK_FLAG_LABELS.get(flag, flag) for flag in flags]


def compute_priority(item: dict) -> tuple[int, str, str]:
    risk_flags = item.get("riskFlags") if isinstance(item.get("riskFlags"), list) else []
    score = 0

    if item.get("sourceType") == "official_paper":
        score += 55
    elif item.get("sourceType") == "institution_candidate":
        score += 25

    if item.get("school") and item.get("school") != "未识别院校":
        score += 12
    if item.get("courseCode"):
        score += 12
    if item.get("year"):
        score += 8
    if ANSWER_HINT_RE.search(safe_text(item.get("fileName"))):
        score += 8
    if item.get("contentHash"):
        score += 5

    if "copyright_review_required" in risk_flags:
        score -= 22
    if "brand_leak" in risk_flags:
        score -= 14
    if "too_small" in risk_flags:
        score -= 20

    score = max(0, min(100, score))

    if item.get("sourceType") == "institution_candidate":
        return score, "T2", PRIORITY_LABELS["T2"]
    if score >= 78:
        return score, "T0", PRIORITY_LABELS["T0"]
    if score >= 60:
        return score, "T1", PRIORITY_LABELS["T1"]
    return score, "T3", PRIORITY_LABELS["T3"]


def normalize_item(item: dict) -> dict:
    remote_path = safe_text(item.get("remotePath") or item.get("sourceUrl") or item.get("provenanceUrl"))
    display_name = safe_text(item.get("safeDisplayName") or item.get("fileName") or Path(remote_path).name)
    source_id = safe_text(item.get("sourceId") or item.get("id") or item.get("canonicalKey"))
    text_for_infer = f"{remote_path} {display_name}"
    risk_flags = item.get("riskFlags") if isinstance(item.get("riskFlags"), list) else []
    legal_review = item.get("legalReview") if isinstance(item.get("legalReview"), dict) else {}

    normalized = {
        "sourceId": source_id,
        "school": infer_school(text_for_infer),
        "direction": infer_direction(item, display_name),
        "courseCode": infer_course_code(display_name),
        "year": item.get("year") or "",
        "sourceInstitution": infer_source_institution(text_for_infer),
        "sourceType": safe_text(item.get("sourceType") or "unknown"),
        "status": safe_text(item.get("status") or "unknown"),
        "eligible": bool(item.get("eligible")),
        "fileName": display_name,
        "remotePath": remote_path,
        "bucket": infer_bucket(remote_path),
        "extension": safe_text(item.get("extension")),
        "contentHash": safe_text(item.get("contentHash")),
        "riskFlags": risk_flags,
        "riskLabels": risk_labels(risk_flags),
        "copyrightReviewRequired": bool(
            legal_review.get("copyrightReviewRequired")
            or "copyright_review_required" in risk_flags
            or safe_text(item.get("sourceType")) == "institution_candidate"
        ),
        "publishBlocked": bool(legal_review.get("publishBlocked") or "copyright_review_required" in risk_flags),
    }
    priority_score, priority_tier, priority_label = compute_priority(normalized)
    normalized.update(
        {
            "priorityScore": priority_score,
            "priorityTier": priority_tier,
            "priorityLabel": priority_label,
            "duplicateKey": duplicate_key(normalized),
            "cleaningStatus": "review_required" if normalized["copyrightReviewRequired"] else "triage_ready",
        }
    )
    return normalized


def should_include(item: dict) -> bool:
    if not item.get("eligible"):
        return False
    if item.get("sourceType") not in {"official_paper", "institution_candidate"}:
        return False
    if "ad_or_promo" in item.get("riskFlags", []):
        return False
    return bool(item.get("remotePath") and item.get("fileName"))


def build_index(manifest_path: Path, mini_limit: int) -> tuple[dict, dict]:
    manifest = read_json(manifest_path)
    raw_items = manifest.get("items") if isinstance(manifest, dict) else []
    if not isinstance(raw_items, list):
        raw_items = []

    items = [normalize_item(item) for item in raw_items]
    eligible_items = [item for item in items if should_include(item)]
    duplicates = defaultdict(list)
    for item in eligible_items:
        duplicates[item["duplicateKey"]].append(item)

    duplicate_group_count = 0
    for key, rows in duplicates.items():
        if len(rows) <= 1:
            for row in rows:
                row["duplicateGroupId"] = ""
                row["duplicateGroupSize"] = 1
                row["duplicateRank"] = 1
            continue
        duplicate_group_count += 1
        group_id = f"dup_{stable_hash(key)[:16]}"
        rows.sort(
            key=lambda item: (
                -int(item["priorityScore"]),
                item["sourceType"] != "official_paper",
                item["school"] == "未识别院校",
                item["fileName"],
            )
        )
        for index, row in enumerate(rows, 1):
            row["duplicateGroupId"] = group_id
            row["duplicateGroupSize"] = len(rows)
            row["duplicateRank"] = index
            if index > 1 and row["priorityTier"] in {"T0", "T1"}:
                row["priorityTier"] = "T3"
                row["priorityLabel"] = PRIORITY_LABELS["T3"]
                row["cleaningStatus"] = "duplicate_hold"

    eligible_items.sort(
        key=lambda item: (
            item["priorityTier"] not in {"T0", "T1"},
            -int(item["priorityScore"]),
            item["duplicateRank"],
            item["school"] == "未识别院校",
            item["school"],
            item["courseCode"] or "9999",
            item["fileName"],
        )
    )

    direction_counts = Counter(item["direction"] for item in eligible_items)
    school_counts = Counter(item["school"] for item in eligible_items)
    priority_counts = Counter(item["priorityTier"] for item in eligible_items)
    institution_counts = Counter(item["sourceInstitution"] for item in eligible_items)
    type_counts = Counter(item["sourceType"] for item in items)
    status_counts = Counter(item["status"] for item in items)

    grouped = defaultdict(list)
    for item in eligible_items:
        grouped[item["direction"]].append(item)

    now = datetime.now(timezone.utc).isoformat()
    full_payload = {
        "version": 1,
        "generatedAt": now,
        "source": display_path(manifest_path),
        "summary": {
            "totalSources": len(items),
            "eligibleIndexSources": len(eligible_items),
            "officialPaperSources": sum(1 for item in eligible_items if item["sourceType"] == "official_paper"),
            "institutionCandidateSources": sum(
                1 for item in eligible_items if item["sourceType"] == "institution_candidate"
            ),
            "reviewRequiredSources": sum(1 for item in eligible_items if item["copyrightReviewRequired"]),
            "duplicateGroupCount": duplicate_group_count,
            "directionCount": len(direction_counts),
            "schoolCount": len(school_counts),
            "priorityCounts": dict(priority_counts.most_common()),
            "statusCounts": dict(status_counts.most_common()),
            "sourceTypeCounts": dict(type_counts.most_common()),
            "topSourceInstitutions": dict(institution_counts.most_common(12)),
        },
        "directions": [
            {
                "name": direction,
                "count": count,
                "priorityCounts": dict(Counter(i["priorityTier"] for i in grouped[direction]).most_common()),
                "sampleSchools": [
                    school for school, _count in Counter(i["school"] for i in grouped[direction]).most_common(8)
                ],
            }
            for direction, count in direction_counts.most_common()
        ],
        "items": eligible_items,
    }

    mini_items = eligible_items[:mini_limit]
    mini_payload = {
        "version": 1,
        "generatedAt": now,
        "source": display_path(manifest_path),
        "summary": {
            **full_payload["summary"],
            "embeddedItems": len(mini_items),
            "fullIndexPath": display_path(DEFAULT_DATA_OUTPUT),
            "publicationMode": "index_only",
        },
        "directions": full_payload["directions"][:24],
        "items": mini_items,
    }
    return full_payload, mini_payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Build professional-course source indexes.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_DATA_OUTPUT)
    parser.add_argument("--mini-output", type=Path, default=DEFAULT_MINI_OUTPUT)
    parser.add_argument("--mini-limit", type=int, default=DEFAULT_MINI_LIMIT)
    args = parser.parse_args()

    full_payload, mini_payload = build_index(args.manifest, args.mini_limit)
    write_json(args.output, full_payload)
    write_json(args.mini_output, mini_payload)
    print(
        "[professional-index] "
        f"full={display_path(args.output)} "
        f"mini={display_path(args.mini_output)} "
        f"items={full_payload['summary']['eligibleIndexSources']} "
        f"embedded={mini_payload['summary']['embeddedItems']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
