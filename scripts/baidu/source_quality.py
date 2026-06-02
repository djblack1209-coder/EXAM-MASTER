#!/usr/bin/env python3
"""
Known source-quality overrides for Baidu public-course ingestion.

These rules cover sources whose filename/path metadata looked release-useful
but whose rendered content was manually inspected and found unsafe to publish
as the advertised track/year.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any


SOURCE_CONTENT_MISMATCH_FLAG = "source_content_mismatch"
SOURCE_QUALITY_MANUAL_REVIEW_FLAGS = {
    SOURCE_CONTENT_MISMATCH_FLAG,
    "manual_review_required",
}


KNOWN_SOURCE_QUALITY_OVERRIDES = [
    {
        "sourceIds": {"src_97fdbcbd12d0815374fbe91f"},
        "contentHashes": {
            "5347d192as7e7e3d20fdf8d7db3fdd68",
            "6fd3ad9e10d9fc6043a5dea007843f8ea2fb06ff6dc7e9e6ffb970fe202633e5",
        },
        "remotePathContains": [
            "/【完整版】数学二真题答案解析/2016考研数学二真题 .pdf",
        ],
        "riskFlags": [SOURCE_CONTENT_MISMATCH_FLAG, "manual_review_required"],
        "blockReason": "source_content_mismatch",
        "reviewNote": (
            "Rendered/OCR inspection on 2026-06-02 found the advertised math2:2016 "
            "source contains the already published 2014 Math II question set with "
            "same-page explanations, so it cannot satisfy math2:2016 release evidence."
        ),
    }
]


def _text(value: Any) -> str:
    return str(value or "").strip()


def _source_hashes(item: dict[str, Any]) -> set[str]:
    return {
        _text(item.get(key))
        for key in ("contentHash", "sha256", "fileSha256", "sourceHash", "hash")
        if _text(item.get(key))
    }


def source_quality_override_for_item(item: dict[str, Any]) -> dict[str, Any] | None:
    source_id = _text(item.get("sourceId") or item.get("id"))
    remote_path = _text(item.get("remotePath") or item.get("path") or item.get("server_path"))
    source_hashes = _source_hashes(item)

    for override in KNOWN_SOURCE_QUALITY_OVERRIDES:
        if source_id and source_id in override.get("sourceIds", set()):
            return override
        if source_hashes.intersection(set(override.get("contentHashes", set()))):
            return override
        if remote_path and any(fragment in remote_path for fragment in override.get("remotePathContains", [])):
            return override

    return None


def apply_source_quality_overrides(item: dict[str, Any]) -> dict[str, Any]:
    override = source_quality_override_for_item(item)
    if not override:
        return item

    updated = deepcopy(item)
    risk_flags = set(updated.get("riskFlags") or [])
    risk_flags.update(str(flag) for flag in override.get("riskFlags", []) if str(flag))
    updated["riskFlags"] = sorted(risk_flags)

    legal_review = dict(updated.get("legalReview") or {})
    legal_review["publishBlocked"] = True
    legal_review["sourceQualityReviewRequired"] = True
    updated["legalReview"] = legal_review

    source_quality = dict(updated.get("sourceQuality") or {})
    source_quality.update(
        {
            "status": "blocked",
            "blockReason": override.get("blockReason", SOURCE_CONTENT_MISMATCH_FLAG),
            "reviewNote": override.get("reviewNote", ""),
        }
    )
    updated["sourceQuality"] = source_quality
    return updated


def source_quality_requires_manual_review(item: dict[str, Any]) -> bool:
    updated = apply_source_quality_overrides(item)
    risk_flags = set(updated.get("riskFlags") or [])
    return bool(
        risk_flags.intersection(SOURCE_QUALITY_MANUAL_REVIEW_FLAGS)
        or updated.get("legalReview", {}).get("sourceQualityReviewRequired")
    )
