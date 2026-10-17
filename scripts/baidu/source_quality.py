#!/usr/bin/env python3
"""
Known source-quality overrides for Baidu public-course ingestion.

These rules cover sources whose filename/path metadata looked release-useful
but whose rendered content was inspected and found unsuitable for public
release, including mislabeled papers and branded reference copies.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import re
from typing import Any
from urllib.parse import urlsplit


SOURCE_CONTENT_MISMATCH_FLAG = "source_content_mismatch"
PUBLIC_USE_EVIDENCE_CONTRACT = "public-course-public-use-v1"


def public_use_evidence_errors(item: dict[str, Any]) -> list[str]:
    """Check declared public-use evidence, not the legal validity of its claim."""
    evidence = item.get("publicUseEvidence")
    if not isinstance(evidence, dict):
        return ["publicUseEvidence=missing"]
    errors = []
    if evidence.get("contract") != PUBLIC_USE_EVIDENCE_CONTRACT:
        errors.append("publicUseEvidence.contract=unsupported")
    if evidence.get("scope") != "public_course_redistribution":
        errors.append("publicUseEvidence.scope=not_public_redistribution")
    if evidence.get("basis") not in {"public_domain", "open_license", "permission"}:
        errors.append("publicUseEvidence.basis=unverified")
    file_hash = str(item.get("contentHash") or item.get("sha256") or "").strip()
    if (
        not re.fullmatch(r"sha256:[a-f0-9]{64}", file_hash)
        or evidence.get("sourceHash") != file_hash
    ):
        errors.append("publicUseEvidence.sourceHash=mismatch_or_missing")
    source_url = str(item.get("sourceUrl") or "").strip()
    if evidence.get("sourceUrl") != source_url:
        errors.append("publicUseEvidence.sourceUrl=mismatch")
    for field, value in (("sourceUrl", source_url), ("evidenceUrl", evidence.get("evidenceUrl"))):
        try:
            parsed = urlsplit(str(value or ""))
            valid = (
                parsed.scheme == "https"
                and parsed.hostname
                and not parsed.username
                and not parsed.password
            )
        except ValueError:
            valid = False
        if not valid:
            errors.append(f"publicUseEvidence.{field}=invalid")
    for field in ("verifiedBy", "note"):
        if not isinstance(evidence.get(field), str) or not evidence[field].strip():
            errors.append(f"publicUseEvidence.{field}=missing")
    try:
        verified_at = datetime.fromisoformat(
            str(evidence.get("verifiedAt") or "").replace("Z", "+00:00")
        )
        if verified_at.tzinfo is None:
            raise ValueError("timezone required")
    except ValueError:
        errors.append("publicUseEvidence.verifiedAt=invalid")
    return errors


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
    },
    {
        "sourceIds": {"src_1b0fd1f2d5c9741193305511"},
        "contentHashes": {
            "46f076305pf181eb53d3f3c01172fdd7",
            "a9db41a6703e349215044e39c980c99fecbb8386321bdf206ee002502e61c068",
            "sha256:a9db41a6703e349215044e39c980c99fecbb8386321bdf206ee002502e61c068",
        },
        "remotePathContains": [
            "/【完整版】数学二真题答案解析/2021考研数学二真题 .pdf",
        ],
        "riskFlags": ["brand_leak", "copyright_review_required", "manual_review_required"],
        "blockReason": "branded_reference_rights_unverified",
        "reviewNote": (
            "Rendered inspection on 2026-10-14 of PDF pages 1, 6, 7 and 14 "
            "found publisher watermarks/promotional headers and inline answer analysis. "
            "The registered copy has no verified public-use or official scoring authority; "
            "keep the original file and require a separately verified replacement. "
            "This blocks this source copy, not every math2:2021 source."
        ),
    },
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
        if remote_path and any(
            fragment in remote_path for fragment in override.get("remotePathContains", [])
        ):
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
    if "copyright_review_required" in risk_flags:
        legal_review["copyrightReviewRequired"] = True
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
