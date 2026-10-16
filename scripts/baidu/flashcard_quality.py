#!/usr/bin/env python3
"""
Quality gate for AI-cleaned flashcard JSON files.

This gate audits intermediate files under data/flashcards before they are
promoted into the public mini-program question bank. It does not mutate cards;
it only reports whether the cleaned output is safe to publish.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import tempfile
import sys
from functools import lru_cache
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
DEFAULT_FLASHCARD_DIR = PROJECT_ROOT / "data" / "flashcards"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "flashcard-quality-report.json"
VALID_TYPES = {
    "single_choice",
    "multi_choice",
    "analysis",
    "short_answer",
    "essay",
    "translation",
    "cloze",
}
CHOICE_TYPES = {"single_choice", "multi_choice"}
PUBLICATION_BLOCKED_QUALITY = {
    "draft",
    "needs_review",
    "needs_passage",
    "needs_cleaning",
    "source_missing",
}
ENGLISH_SUBJECT_HINTS = {"english", "英语"}
ANSWER_PLACEHOLDERS = {
    "完整的参考答案全文",
    "完整的答案解析文本",
    "参考答案全文",
    "答案解析文本",
}


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


def first_non_empty(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def answer_evidence_status(card: dict[str, Any]) -> str:
    return first_non_empty(card.get("answerEvidenceStatus"), card.get("answer_evidence_status"))


def source_evidence_id(card: dict[str, Any]) -> str:
    source_evidence = (
        card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
    )
    return first_non_empty(
        card.get("sourceEvidenceId"),
        card.get("source_evidence_id"),
        source_evidence.get("evidenceId"),
    )


def question_text_hash(card: dict[str, Any]) -> str:
    source_evidence = (
        card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
    )
    return first_non_empty(
        card.get("questionTextHash"),
        card.get("question_text_hash"),
        source_evidence.get("questionTextHash"),
    )


def answer_text_hash(card: dict[str, Any]) -> str:
    source_evidence = (
        card.get("sourceEvidence") if isinstance(card.get("sourceEvidence"), dict) else {}
    )
    return first_non_empty(
        card.get("answerTextHash"),
        card.get("answer_text_hash"),
        source_evidence.get("answerTextHash"),
    )


# Frozen profiles from existing source builders; no caller-selected codec.
LEGACY_CONTENT_HASH_GROUPS = {
    "english_material": [
        "english1-2024",
        "english2-2010",
        "english2-2011",
        "english2-2012",
        "english2-2013",
        "english2-2014",
        "english2-2015",
        "english2-2016",
        "english2-2017",
        "english2-2018",
        "english2-2019",
        "english2-2020",
        "english2-2021",
        "english2-2022",
        "english2-2023",
        "english2-2024",
    ],
    "english_pages": [
        "english1-2013",
        "english1-2014",
        "english1-2015",
        "english1-2016",
        "english1-2017",
        "english1-2018",
        "english1-2019",
        "english1-2020",
    ],
    "english_text": ["english1-2022", "english1-2023"],
    "math_crops": [
        "math2-2015",
        "math2-2017",
        "math2-2018",
        "math2-2019",
        "math2-2020",
        "math3-2011",
        "math3-2012",
        "math3-2013",
        "math3-2014",
        "math3-2015",
        "math3-2016",
        "math3-2017",
        "math3-2018",
        "math3-2019",
        "math3-2020",
    ],
    "math_history": [
        "math1-2005",
        "math1-2006",
        "math1-2007",
        "math1-2008",
        "math1-2009",
        "math1-2010",
        "math1-2011",
        "math1-2012",
        "math1-2013",
        "math1-2014",
        "math1-2015",
        "math1-2016",
        "math1-2017",
        "math1-2018",
        "math1-2019",
        "math1-2020",
        "math1-2021",
        "math1-2022",
        "math1-2023",
        "math1-2024",
    ],
    "math_pages": [
        "math2-2005",
        "math2-2006",
        "math2-2007",
        "math2-2008",
        "math2-2009",
        "math2-2010",
        "math2-2011",
        "math2-2012",
        "math2-2013",
        "math2-2014",
        "math2-2024",
        "math2-2025",
        "math3-2005",
        "math3-2006",
        "math3-2007",
        "math3-2008",
        "math3-2009",
        "math3-2010",
        "math3-2024",
        "math3-2025",
    ],
    "math_pages_detail": ["math1-2025"],
    "politics_2022": ["politics-2022"],
    "politics_2024": ["politics-2024"],
    "politics_2025": ["politics-2025"],
    "politics_pages": [
        "politics-2005",
        "politics-2006",
        "politics-2007",
        "politics-2008",
        "politics-2009",
        "politics-2010",
        "politics-2011",
        "politics-2012",
        "politics-2013",
        "politics-2014",
        "politics-2015",
        "politics-2016",
        "politics-2017",
        "politics-2018",
        "politics-2019",
        "politics-2020",
        "politics-2021",
    ],
}
LEGACY_CONTENT_HASH_PROFILES = {
    bank_id: kind for kind, ids in LEGACY_CONTENT_HASH_GROUPS.items() for bank_id in ids
}


def cleaned_text_hash(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    text = re.sub(r"\s+", " ", value).strip()
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest() if text else ""


@lru_cache(maxsize=32)
def legacy_text_normalizer(bank_id: str):
    if LEGACY_CONTENT_HASH_PROFILES.get(bank_id) not in {"english_material", "english_text"}:
        raise ValueError("Unregistered text normalizer")
    source = PROJECT_ROOT / "scripts/cleaning" / ("build_" + bank_id.replace("-", "_") + "_bank.py")
    if (
        source.is_symlink()
        or source.resolve().parent != (PROJECT_ROOT / "scripts/cleaning").resolve()
    ):
        raise ValueError("Invalid normalizer source")
    tree = ast.parse(source.read_text(encoding="utf-8"))
    normalizer = next(
        node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "compact"
    )
    # Only the trusted builder's pure text function; never its module or writes.
    namespace = {"__builtins__": {"str": str}, "re": re, "Any": Any}
    exec(compile(ast.Module(body=[normalizer], type_ignores=[]), str(source), "exec"), namespace)
    return namespace["compact"]


def legacy_text_digest(bank_id: str, text: str) -> str:
    return (
        "sha256:"
        + hashlib.sha256(legacy_text_normalizer(bank_id)(text).encode("utf-8")).hexdigest()
    )


def image_references(
    images: Any,
    bank_id: str,
    mode: str = "pages",
    allow_question_crop: bool = False,
    allow_empty: bool = False,
) -> list[int | str]:
    if not isinstance(images, list) or (not images and not allow_empty) or len(images) > 64:
        raise ValueError("Missing page binding")
    refs: list[int | str] = []
    prefix = f"question-bank/{bank_id}/"
    for image in images:
        src = image.get("src") if isinstance(image, dict) else None
        if not isinstance(src, str) or not src.startswith(prefix):
            raise ValueError("Wrong bank image")
        name = src[len(prefix) :]
        page = re.fullmatch(r"(?:paper|answer)-page-(\d{1,3})\.jpg", name)
        masked_page = re.fullmatch(r"paper-page-(\d{1,3})-question-crop\.jpg", name)
        crop = re.fullmatch(r"question-(\d{2}(?:[a-z]|-[a-z0-9]+)?)\.jpg", name)
        if page and mode != "crops" and int(page[1]) > 0:
            refs.append(int(page[1]))
        elif masked_page and allow_question_crop and mode == "pages" and int(masked_page[1]) > 0:
            refs.append(masked_page[1] + "-question-crop")
        elif crop and mode == "crops":
            refs.append(crop[1])
        elif crop and mode == "history":
            refs.append("q" + crop[1])
        else:
            raise ValueError("Unknown page reference")
    return refs


def card_content_hashes(card: dict[str, Any], bank_id: str) -> dict[str, str | None]:
    kind = LEGACY_CONTENT_HASH_PROFILES.get(bank_id)
    if not kind:
        return {
            "questionTextHash": cleaned_text_hash(card.get("question") or card.get("stem") or ""),
            "answerTextHash": cleaned_text_hash(card.get("answer")),
        }
    try:
        question, answer = card.get("question"), card.get("answer")
        if (
            card.get("paperId") != bank_id
            or not isinstance(question, str)
            or not isinstance(answer, str)
        ):
            raise ValueError("Wrong content identity")

        def digest(text: str, normalized: bool = False) -> str:
            return (
                legacy_text_digest(bank_id, text)
                if normalized
                else "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
            )

        def encoded(payload: Any, normalized: bool = False, sorted_keys: bool = True) -> str:
            return digest(
                json.dumps(payload, ensure_ascii=False, sort_keys=sorted_keys, allow_nan=False),
                normalized,
            )

        def refs(key: str, mode: str = "pages") -> list[int | str]:
            return image_references(
                card.get(key),
                bank_id,
                mode,
                key == "questionImages" and kind.startswith("math_"),
                key == "questionImages" and kind == "politics_pages",
            )

        if kind.startswith("math_"):
            options = card.get("options")
            if isinstance(options, list) and any(
                not isinstance(option, dict)
                or option.get("label") not in {"A", "B", "C", "D"}
                or option.get("text") != option.get("label")
                for option in options
            ):
                raise ValueError("Changed image-choice labels")
            mode = (
                "crops"
                if kind == "math_crops"
                else "history"
                if kind == "math_history"
                else "pages"
            )
            label = (
                "crops"
                if kind == "math_crops"
                else "question-pages"
                if kind == "math_history"
                else "pages"
            )
            question_hash = digest(f"{question}|{label}:{refs('questionImages', mode)}")
            if kind == "math_pages_detail":
                images = card.get("answerImages")
                if not isinstance(images, list):
                    raise ValueError("Missing answer roles")
                speed = [
                    image
                    for image in images
                    if str(image.get("caption", "")).startswith("答案速查")
                ]
                detail = [
                    image
                    for image in images
                    if str(image.get("caption", "")).startswith("答案解析")
                ]
                if len(speed) + len(detail) != len(images):
                    raise ValueError("Missing answer roles")
                answer_hash = digest(
                    f"{answer}|answer-pages:{image_references(speed, bank_id)}|detail-pages:{image_references(detail, bank_id)}"
                )
            else:
                answer_hash = digest(f"{answer}|answer-pages:{refs('answerImages')}")
        elif kind in {"english_pages", "politics_pages"}:
            payload = {
                "question": question,
                "options": card.get("options", []),
                "questionPages": refs("questionImages"),
            }
            if kind == "english_pages":
                payload["passage"] = card.get("passage", "")
            question_hash = encoded(payload)
            answer_hash = encoded({"answer": answer, "answerPages": refs("answerImages")})
        elif kind in {"english_material", "english_text"}:
            payload = {
                "question": question,
                "passage": card.get("passage"),
                "options": card.get("options", []),
            }
            if kind == "english_material":
                payload["material"] = card.get("material", "")
            role = card.get("answerEvidence", {}).get("evidenceRole")
            if not isinstance(role, str) or not role:
                raise ValueError("Missing answer role")
            question_hash = encoded(payload, True)
            answer_hash = encoded({"answer": answer, "role": role}, True)
        elif kind == "politics_2022":
            choice = card.get("type") in {"single_choice", "multi_choice"}
            question_hash = (
                encoded({"question": question, "options": card.get("options", [])})
                if choice
                else digest(question)
            )
            payload = {"answer": answer, "answerPages": refs("answerImages")}
            if choice:
                payload["explanation"] = card.get("explanation", "")
            answer_hash = encoded(payload, sorted_keys=False)
        elif kind == "politics_2024":
            choice = card.get("type") in {"single_choice", "multi_choice"}
            question_hash = (
                digest(
                    question
                    + "|"
                    + json.dumps(
                        card.get("options", []), ensure_ascii=False, sort_keys=True, allow_nan=False
                    )
                )
                if choice
                else digest(question)
            )
            answer_hash = (
                digest(answer + "|" + card.get("explanation", "")) if choice else digest(answer)
            )
        elif kind == "politics_2025":
            options = card.get("options", [])
            if not isinstance(options, list) or any(
                not isinstance(option, dict) for option in options
            ):
                raise ValueError("Invalid choices")
            text = "|".join(
                f"{option.get('label', '')}:{option.get('text', '')}" for option in options
            )
            question_hash = digest(question + "|" + text)
            answer_hash = digest(answer + "|" + card.get("explanation", ""))
        else:
            raise ValueError("Unknown content contract")
        return {"questionTextHash": question_hash, "answerTextHash": answer_hash}
    except (ValueError, TypeError, KeyError, AttributeError):
        return {"questionTextHash": None, "answerTextHash": None}


def declared_text_hashes_match(card: dict[str, Any], field: str, expected: str | None) -> bool:
    snake_field = "question_text_hash" if field == "questionTextHash" else "answer_text_hash"
    evidence = card.get("sourceEvidence")
    evidence = evidence if isinstance(evidence, dict) else {}
    values = [card.get(field), card.get(snake_field), evidence.get(field)]
    answer_evidence = card.get("answerEvidence")
    if field == "answerTextHash" and isinstance(answer_evidence, dict):
        values.append(answer_evidence.get(field))
    declared = [value for value in values if value is not None and str(value).strip()]
    return expected is not None and all(
        isinstance(value, str) and value.strip() == expected for value in declared
    )


def cloze_source_proof_matches(card: dict[str, Any], bank_id: str) -> bool:
    number = card.get("number")
    id_match = re.search(r"-(\d{3})$", str(card.get("id", "")))
    id_number = int(id_match[1]) if id_match else -1
    section = (
        bank_id == "english1-2007"
        and (
            (type(number) is int and 46 <= number <= 50)
            or 46 <= id_number <= 50
            or card.get("groupId") == "part-c"
        )
    ) or (
        bank_id == "english1-2010"
        and (
            (type(number) is int and 41 <= number <= 50)
            or 41 <= id_number <= 50
            or card.get("groupId") in {"part-b", "part-c"}
        )
    )
    if not section and (
        bank_id not in {"english1-2006", "english1-2007", "english1-2010"}
        or not (
            (isinstance(number, int) and number <= 20)
            or 1 <= id_number <= 20
            or card.get("groupId") == "cloze"
            or "完形填空第" in str(card.get("question", ""))
        )
    ):
        return True
    try:
        proof = card["sourceEvidence"]["questionProof"]
        keys = {
            "contract",
            "bankId",
            "sourceId",
            "sourceFilePath",
            "sourceFileSha256",
            "sourceType",
            "contentHash",
        }
        if (
            not isinstance(proof, dict)
            or set(proof) != keys
            or proof["contract"] != ("english-section-source-v1" if section else "cloze-source-v1")
            or proof["bankId"] != bank_id
            or proof["sourceType"] != "paper_answer_pdf"
        ):
            return False
        if (
            type(number) is not int
            or (section and not (46 if bank_id == "english1-2007" else 41) <= number <= 50)
            or (not section and not 1 <= number <= 20)
            or card.get("id") != f"{bank_id}-{number:03d}"
        ):
            return False
        prompt = (
            f"完形填空第 {number} 空：阅读全文后选择最合适的选项。"
            if not section
            else (
                f"翻译第 {number} 处画线句：请先阅读 Part C 全文，再翻译该标注片段。"
                if number >= 46
                else f"新题型第 {number} 空：请先阅读完整文章，再从 A-G 中选择最合适的段落。"
            )
        )
        if card.get("question") != prompt:
            return False
        if not section and re.findall(r"\[(\d+)\]", str(card.get("passage", ""))) != [
            str(i) for i in range(1, 21)
        ]:
            return False
        profiles = {
            "english1-2006": (
                "src_9ec7d1d38e6f1d22108b63ac",
                "sha256:0bf28e07ed34cbc33af0b79f620ac31c8897e91859a70748c3a55de3e5e9e9d4",
            ),
            "english1-2007": (
                "src_e148ece4fffe3713d05b40f8",
                "sha256:44d08043b1e76a0fe935d1d46ffc3ccfeec36bff3e73091a55246975c6dc6a53",
            ),
            "english1-2010": (
                "src_bff66c7d8434bb36d89117d9",
                "sha256:75eb0f30f453a0c518b2731ba33894f59af2dd808d227168762ebf919bdd5bbc",
            ),
        }
        if (proof["sourceId"], proof["sourceFileSha256"]) != profiles[bank_id]:
            return False
        if section:
            profile = (
                (
                    "src_e148ece4fffe3713d05b40f8",
                    "sha256:44d08043b1e76a0fe935d1d46ffc3ccfeec36bff3e73091a55246975c6dc6a53",
                )
                if bank_id == "english1-2007"
                else (
                    "src_bff66c7d8434bb36d89117d9",
                    "sha256:75eb0f30f453a0c518b2731ba33894f59af2dd808d227168762ebf919bdd5bbc",
                )
            )
            if (proof["sourceId"], proof["sourceFileSha256"]) != profile:
                return False
            if number >= 46:
                passage, segment = card.get("passage", ""), card.get("targetSegment", "")
                if (
                    card.get("type") != "translation"
                    or card.get("targetSegmentNumber") != number
                    or not segment
                    or segment not in passage
                    or re.search(r"Writing|[\u4e00-\u9fff]", passage)
                ):
                    return False
            elif (
                card.get("fixedSequence") != ["41", "42", "43", "44", "E", "45"]
                or card.get("fixedParagraphs") != ["E"]
                or len(card.get("options", [])) != 7
            ):
                return False
        if not re.fullmatch(r"src_[a-f0-9]{24}", proof["sourceId"]) or not re.fullmatch(
            r"sha256:[a-f0-9]{64}", proof["sourceFileSha256"]
        ):
            return False
        value = proof["sourceFilePath"]
        prefix = "data/raw-inbox/" + proof["sourceId"] + "-"
        if not isinstance(value, str) or not value.startswith(prefix) or not value.endswith(".pdf"):
            return False
        name = value[len("data/raw-inbox/") :]
        if "/" in name or "\\" in name or bank_id.split("-")[1] not in name:
            return False
        source = PROJECT_ROOT / value
        stat = source.lstat()
        if (
            source.is_symlink()
            or not source.is_file()
            or source.resolve() != source
            or stat.st_size > 16 * 1024 * 1024
        ):
            return False
        raw = source.read_bytes()
        after = source.stat()
        if not raw.startswith(b"%PDF-") or (stat.st_ino, stat.st_size, stat.st_mtime_ns) != (
            after.st_ino,
            after.st_size,
            after.st_mtime_ns,
        ):
            return False
        if "sha256:" + hashlib.sha256(raw).hexdigest() != proof["sourceFileSha256"]:
            return False
        fields = [
            "id",
            "number",
            "question",
            "passage",
            "context",
            "material",
            "options",
            "passageSegments",
            "answer",
        ]
        if section:
            fields += ["targetSegment", "targetSegmentNumber", "fixedSequence", "fixedParagraphs"]
        payload = {key: card.get(key) for key in fields} | {
            key: proof[key] for key in keys if key != "contentHash"
        }
        return (
            cleaned_text_hash(json.dumps(payload, ensure_ascii=False, sort_keys=True))
            == proof["contentHash"]
        )
    except (KeyError, TypeError, ValueError, OSError):
        return False


def restored_question_assets_match(card: dict[str, Any], bank_id: str) -> bool:
    if bank_id != "math3-2007" or card.get("number") != 24:
        return True
    try:
        names = [
            f"question-bank/{bank_id}/paper-page-{page}-question-crop.jpg" for page in [12, 13]
        ]
        hashes = card["sourceEvidence"]["questionAssetHashes"]
        images = card["questionImages"]
        if not isinstance(hashes, dict) or set(hashes) != set(names) or len(images) != 2:
            return False
        for index, name in enumerate(names):
            if images[index].get("src") != name or not re.fullmatch(
                r"sha256:[a-f0-9]{64}", hashes[name]
            ):
                return False
            file = PROJECT_ROOT / "cdn-assets" / name
            if (
                file.is_symlink()
                or file.resolve() != file
                or not file.is_file()
                or file.stat().st_size > 200 * 1024
            ):
                return False
            raw = file.read_bytes()
            if (
                not raw.startswith(b"\xff\xd8")
                or "sha256:" + hashlib.sha256(raw).hexdigest() != hashes[name]
            ):
                return False
        return True
    except (KeyError, TypeError, ValueError, OSError, AttributeError):
        return False


@lru_cache(maxsize=4)
def registered_politics_reference_rows(
    root: str, identities: tuple, supplemented: bool = False
) -> tuple:
    from scripts.baidu.answer_evidence_repair import (
        POLITICS_REFERENCE_SOURCES,
        POLITICS_SUPPLEMENT_SOURCE,
        read_politics_reference_sources,
    )

    paths = [
        Path(root) / "data/raw-inbox" / POLITICS_REFERENCE_SOURCES[role][0]
        for role in ["question", "answer"]
    ]
    # identities are part of the cache key; a changed source is re-read and
    # checked against the frozen file hashes rather than using stale rows.
    supplement = (
        Path(root) / "data/raw-inbox" / POLITICS_SUPPLEMENT_SOURCE[0] if supplemented else None
    )
    return read_politics_reference_sources(*paths, supplement)


def politics_reference_proof_matches(card: dict[str, Any], bank_id: str) -> bool:
    if bank_id != "politics-2023":
        return True
    try:
        from scripts.baidu.answer_evidence_repair import (
            POLITICS_REFERENCE_SOURCES,
            POLITICS_SUPPLEMENT_SOURCE,
            politics_reference_payload,
            politics_row_reference_proof,
        )

        proof = card["answerEvidence"]["referenceProof"]
        if not isinstance(proof, dict) or proof.get("scoringAuthority") is not False:
            return False
        identities = []
        supplemented = "supplementProof" in proof
        files = [POLITICS_REFERENCE_SOURCES[role][0] for role in ["question", "answer"]]
        if supplemented:
            files.append(POLITICS_SUPPLEMENT_SOURCE[0])
        for name in files:
            file = PROJECT_ROOT / "data/raw-inbox" / name
            stat = file.lstat()
            if (
                file.is_symlink()
                or file.resolve() != file
                or not file.is_file()
                or stat.st_size > 32 * 1024 * 1024
            ):
                return False
            identities.append(
                (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)
            )
        rows, source = registered_politics_reference_rows(
            str(PROJECT_ROOT), tuple(identities), supplemented
        )
        number = card.get("number")
        if type(number) is not int or not 1 <= number <= 38:
            return False
        row = rows[number - 1]
        missing = row["answer"] is None
        fields = ["id", "number", "type", "question", "options"] + (
            [] if missing else ["answer", "explanation"]
        )
        if any(card.get(key) != row[key] for key in fields):
            return False
        if supplemented != ("supplementProof" in row):
            return False
        expected = politics_row_reference_proof(row, source)
        expected["contentHash"] = cleaned_text_hash(
            json.dumps(
                politics_reference_payload(card, expected), ensure_ascii=False, sort_keys=True
            )
        )
        supplement = row.get("supplementProof")
        reference_id = supplement["sourceId"] if supplement else expected["answerSourceId"]
        if supplement and (
            card["answerEvidence"].get("sourceId") != reference_id
            or card["answerEvidence"].get("sourceFilePath") != supplement["filePath"]
            or card["answerEvidence"].get("sourceCardId") != f"reference-2023-{number}"
            or card["answerEvidence"].get("status") != "candidate_matched"
            or card["answerEvidence"].get("method")
            != "registered_supplement_pdf_reviewed_question_mapping"
        ):
            return False
        return (
            proof == expected
            and card.get("sourceEvidenceId") == expected["questionSourceId"]
            and card.get("answerEvidenceSourceId") == reference_id
            and card.get("answerEvidenceStatus")
            == ("candidate_existing_answer" if missing else "candidate_matched")
        )
    except (KeyError, TypeError, ValueError, OSError, RuntimeError, ImportError, AttributeError):
        return False


def has_usable_answer(card: dict[str, Any]) -> bool:
    answer = first_non_empty(card.get("answer"))
    return bool(answer) and answer not in ANSWER_PLACEHOLDERS


def card_id(card: dict[str, Any], index: int) -> str:
    return first_non_empty(
        card.get("id"),
        card.get("questionId"),
        card.get("question_id"),
        card.get("number"),
    ) or (f"card-{index + 1}")


def option_labels(card: dict[str, Any]) -> list[str]:
    options = card.get("options")
    if not isinstance(options, list):
        return []
    labels = []
    for option in options:
        if isinstance(option, dict):
            label = str(option.get("label") or "").strip().upper()
            text = str(option.get("text") or "").strip()
            if label and text:
                labels.append(label)
    return labels


def expected_option_labels(card: dict[str, Any]) -> list[str]:
    options = card.get("options")
    if not isinstance(options, list) or not options:
        return []
    option_count = len(options)
    if option_count < 4 or option_count > 8:
        return []
    return [chr(ord("A") + index) for index in range(option_count)]


def has_passage_material(card: dict[str, Any]) -> bool:
    return bool(
        first_non_empty(
            card.get("passage"),
            card.get("context"),
            card.get("material"),
            card.get("article"),
        )
    )


def is_english_payload(payload: Any, path: Path) -> bool:
    values: list[Any] = [path.stem]
    if isinstance(payload, dict):
        values.extend(
            [
                payload.get("subject"),
                payload.get("subjectKey"),
                payload.get("track"),
                payload.get("paperId"),
            ]
        )
    return any(
        str(value or "").strip().lower() in ENGLISH_SUBJECT_HINTS
        or "english" in str(value or "").lower()
        for value in values
    )


def audit_card(
    card: dict[str, Any],
    index: int,
    seen_ids: set[str],
    *,
    requires_passage: bool = False,
    bank_id: str = "",
) -> dict[str, Any]:
    missing_fields: list[str] = []
    hashes = card_content_hashes(card, bank_id)
    current_id = card_id(card, index)
    card_type = str(card.get("type") or "").strip()

    if current_id in seen_ids:
        missing_fields.append("uniqueId")
    seen_ids.add(current_id)

    if card_type not in VALID_TYPES:
        missing_fields.append("type")
    if not first_non_empty(card.get("question"), card.get("stem")):
        missing_fields.append("question")
    if not has_usable_answer(card):
        missing_fields.append("answer")
    if card_type in CHOICE_TYPES:
        expected_labels = expected_option_labels(card)
        if not expected_labels or sorted(option_labels(card)) != expected_labels:
            missing_fields.append("options=A-D-or-A-G")
    if (
        requires_passage
        and card_type not in {"analysis", "essay", "translation", "short_answer"}
        and not has_passage_material(card)
    ):
        missing_fields.append("passage")
    if not source_evidence_id(card):
        missing_fields.append("sourceEvidenceId")
    if answer_evidence_status(card) != "matched":
        missing_fields.append("answerEvidenceStatus=matched")
    if not question_text_hash(card):
        missing_fields.append("questionTextHash")
    if not answer_text_hash(card):
        missing_fields.append("answerTextHash")
    if not declared_text_hashes_match(card, "questionTextHash", hashes["questionTextHash"]):
        missing_fields.append("questionTextHash=content_mismatch")
    if not declared_text_hashes_match(card, "answerTextHash", hashes["answerTextHash"]):
        missing_fields.append("answerTextHash=content_mismatch")
    if not cloze_source_proof_matches(card, bank_id):
        missing_fields.append("questionTextHash=source_payload_mismatch")
    if not restored_question_assets_match(card, bank_id):
        missing_fields.append("questionTextHash=asset_payload_mismatch")
    if bank_id == "politics-2023":
        missing_fields.append("answerTextHash=reference_only_authority")
        if not politics_reference_proof_matches(card, bank_id):
            missing_fields.append("answerTextHash=reference_payload_mismatch")

    return {
        "cardId": current_id,
        "missingFields": missing_fields,
    }


def load_cards(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        cards = (
            payload.get("cards")
            if isinstance(payload.get("cards"), list)
            else payload.get("questions")
        )
        return [card for card in (cards or []) if isinstance(card, dict)]
    if isinstance(payload, list):
        return [card for card in payload if isinstance(card, dict)]
    return []


def publication_status(payload: Any) -> tuple[str, list[str]]:
    if not isinstance(payload, dict):
        return "", []

    status = first_non_empty(payload.get("publicationStatus"), payload.get("status"))
    quality = first_non_empty(payload.get("quality"), payload.get("paperQuality"))
    blockers = payload.get("publicationBlockers")
    blocker_list = [str(item) for item in blockers] if isinstance(blockers, list) else []

    if status in {"draft", "pending_review", "blocked"}:
        blocker_list.append(f"publicationStatus={status}")
    if quality in PUBLICATION_BLOCKED_QUALITY:
        blocker_list.append(f"quality={quality}")

    return status, blocker_list


def supporting_evidence_reason(path: Path, payload: Any) -> str:
    if isinstance(payload, dict) and payload.get("supportingEvidenceOnly") is True:
        return "supportingEvidenceOnly"
    if "-support-" in path.stem:
        return "supportFileName"
    return ""


def infer_year(path: Path, payload: Any) -> int | None:
    values = []
    if isinstance(payload, dict):
        values.extend([payload.get("year"), payload.get("paperYear")])
    values.append(path.stem)
    for value in values:
        match = re.search(r"(19|20)\d{2}", str(value or ""))
        if match:
            return int(match.group(0))
    return None


def release_scope_skip_reason(path: Path, payload: Any, *, min_year: int, max_year: int) -> str:
    year = infer_year(path, payload)
    if year is None:
        return ""
    if year < min_year or year > max_year:
        return f"outsideReleaseYear:{year}"
    return ""


def audit_flashcard_file(path: Path, payload: Any | None = None) -> dict[str, Any]:
    payload = read_json(path) if payload is None else payload
    cards = load_cards(payload)
    seen_ids: set[str] = set()
    blocked_cards = []
    status, publication_blockers = publication_status(payload)
    raw_cards = (
        payload.get("cards", payload.get("questions")) if isinstance(payload, dict) else payload
    )
    if not isinstance(raw_cards, list):
        publication_blockers.append("cards=invalid_shape")
    elif not raw_cards:
        publication_blockers.append("cards=empty")
    elif any(not isinstance(card, dict) for card in raw_cards):
        publication_blockers.append("cards=invalid_entries")
    requires_passage = is_english_payload(payload, path)

    for index, card in enumerate(cards):
        card_report = audit_card(
            card, index, seen_ids, requires_passage=requires_passage, bank_id=path.stem
        )
        if card_report["missingFields"]:
            blocked_cards.append(card_report)

    missing_answer_count = sum(1 for card in cards if not has_usable_answer(card))
    source_evidence_blocker_count = sum(
        1
        for blocked in blocked_cards
        if any(
            field in {"sourceEvidenceId", "answerEvidenceStatus=matched"}
            or field.startswith(("questionTextHash", "answerTextHash"))
            for field in blocked["missingFields"]
        )
    )
    grading_blocker_count = sum(
        1
        for blocked in blocked_cards
        if any(
            field
            in {
                "question",
                "answer",
                "options=A-D",
                "options=A-D-or-A-G",
                "type",
                "uniqueId",
            }
            or field == "passage"
            for field in blocked["missingFields"]
        )
    )

    return {
        "filePath": str(
            path.relative_to(PROJECT_ROOT) if path.is_relative_to(PROJECT_ROOT) else path
        ),
        "status": "blocked" if blocked_cards or publication_blockers else "passed",
        "publicationStatus": status,
        "publicationBlockers": publication_blockers,
        "cardCount": len(cards),
        "missingAnswerCount": missing_answer_count,
        "sourceEvidenceBlockerCount": source_evidence_blocker_count,
        "gradingBlockerCount": grading_blocker_count,
        "blockedCards": blocked_cards,
    }


def build_quality_report(
    flashcard_dir: Path = DEFAULT_FLASHCARD_DIR,
    *,
    min_year: int = 2005,
    max_year: int = 2026,
) -> dict[str, Any]:
    files = []
    if flashcard_dir.exists():
        files = sorted(path for path in flashcard_dir.glob("*.json") if path.is_file())

    file_reports = []
    skipped_files = []
    for path in files:
        payload = read_json(path)
        skip_reason = supporting_evidence_reason(path, payload)
        if skip_reason:
            skipped_files.append(
                {
                    "filePath": str(
                        path.relative_to(PROJECT_ROOT)
                        if path.is_relative_to(PROJECT_ROOT)
                        else path
                    ),
                    "reason": skip_reason,
                }
            )
            continue
        skip_reason = release_scope_skip_reason(path, payload, min_year=min_year, max_year=max_year)
        if skip_reason:
            skipped_files.append(
                {
                    "filePath": str(
                        path.relative_to(PROJECT_ROOT)
                        if path.is_relative_to(PROJECT_ROOT)
                        else path
                    ),
                    "reason": skip_reason,
                }
            )
            continue
        file_reports.append(audit_flashcard_file(path, payload))
    missing_answer_count = sum(item["missingAnswerCount"] for item in file_reports)
    source_evidence_blocker_count = sum(item["sourceEvidenceBlockerCount"] for item in file_reports)
    grading_blocker_count = sum(item["gradingBlockerCount"] for item in file_reports)
    blocker_count = sum(len(item["blockedCards"]) for item in file_reports)
    publication_blocker_count = sum(
        len(item.get("publicationBlockers", [])) for item in file_reports
    )
    empty_scope_blocker_count = int(not file_reports)

    return {
        "version": 1,
        "generatedAt": utc_now(),
        "scope": {
            "minYear": min_year,
            "maxYear": max_year,
        },
        "flashcardDir": str(
            flashcard_dir.relative_to(PROJECT_ROOT)
            if flashcard_dir.is_relative_to(PROJECT_ROOT)
            else flashcard_dir
        ),
        "summary": {
            "fileCount": len(file_reports),
            "skippedFileCount": len(skipped_files),
            "cardCount": sum(item["cardCount"] for item in file_reports),
            "missingAnswerCount": missing_answer_count,
            "sourceEvidenceBlockerCount": source_evidence_blocker_count,
            "gradingBlockerCount": grading_blocker_count,
            "publicationBlockerCount": publication_blocker_count,
            "emptyScopeBlockerCount": empty_scope_blocker_count,
            "blockerCount": blocker_count,
        },
        "skippedFiles": skipped_files,
        "files": file_reports,
        "releaseReadiness": {
            "canPromoteToPublic": blocker_count == 0
            and publication_blocker_count == 0
            and empty_scope_blocker_count == 0,
            "blockers": {
                "missingAnswers": missing_answer_count,
                "sourceEvidence": source_evidence_blocker_count,
                "grading": grading_blocker_count,
                "publication": publication_blocker_count,
                "emptyScope": empty_scope_blocker_count,
            },
        },
    }


def print_help() -> None:
    print(
        """Usage:
  python3 scripts/baidu/flashcard_quality.py [options]

Options:
  --flashcard-dir <path>   Directory containing AI-cleaned flashcard JSON files
  --min-year <year>        First release-scope year to audit
  --max-year <year>        Last release-scope year to audit
  --output <path>          JSON report path
  --fail-on-blockers       Exit 2 when any cleaned card cannot be promoted
  --self-test              Run built-in flashcard quality assertions
"""
    )


def run_self_test() -> None:
    passing_payload = {
        "paperId": "english1-2025",
        "subjectKey": "english",
        "year": 2025,
        "cards": [
            {
                "id": "e1-2025-1",
                "type": "single_choice",
                "question": "What is the best title for the passage?",
                "passage": "A verified passage excerpt used for self-test.",
                "options": [
                    {"label": "A", "text": "Option A"},
                    {"label": "B", "text": "Option B"},
                    {"label": "C", "text": "Option C"},
                    {"label": "D", "text": "Option D"},
                ],
                "answer": "A",
                "sourceEvidenceId": "src_self_test",
                "answerEvidenceStatus": "matched",
                "questionTextHash": cleaned_text_hash("What is the best title for the passage?"),
                "answerTextHash": cleaned_text_hash("A"),
            },
            {
                "id": "e1-2025-translation",
                "type": "translation",
                "question": "Translate the underlined sentence.",
                "answer": "A verified translation answer.",
                "sourceEvidenceId": "src_self_test_translation",
                "answerEvidenceStatus": "matched",
                "questionTextHash": cleaned_text_hash("Translate the underlined sentence."),
                "answerTextHash": cleaned_text_hash("A verified translation answer."),
            },
        ],
    }

    passed = audit_flashcard_file(
        PROJECT_ROOT / "data/flashcards/english1-2025-self-test.json", passing_payload
    )
    assert passed["status"] == "passed"
    assert passed["cardCount"] == 2
    assert passed["blockedCards"] == []

    blocked_payload = {
        "paperId": "english1-2025",
        "subjectKey": "english",
        "publicationStatus": "draft",
        "quality": "needs_passage",
        "cards": [
            {
                "id": "duplicate",
                "type": "single_choice",
                "question": "Missing passage and usable evidence.",
                "options": [
                    {"label": "A", "text": "Option A"},
                    {"label": "B", "text": "Option B"},
                    {"label": "C", "text": "Option C"},
                ],
                "answer": "完整的参考答案全文",
            },
            {
                "id": "duplicate",
                "type": "single_choice",
                "question": "Duplicate id should be blocked.",
                "passage": "Passage is present on the duplicate card.",
                "options": [
                    {"label": "A", "text": "Option A"},
                    {"label": "B", "text": "Option B"},
                    {"label": "C", "text": "Option C"},
                    {"label": "D", "text": "Option D"},
                ],
                "answer": "B",
                "sourceEvidenceId": "src_duplicate",
                "answerEvidenceStatus": "matched",
                "questionTextHash": cleaned_text_hash("Duplicate id should be blocked."),
                "answerTextHash": cleaned_text_hash("B"),
            },
        ],
    }
    blocked = audit_flashcard_file(
        PROJECT_ROOT / "data/flashcards/english1-2025-blocked-self-test.json",
        blocked_payload,
    )
    assert blocked["status"] == "blocked"
    assert blocked["missingAnswerCount"] == 1
    assert blocked["sourceEvidenceBlockerCount"] == 1
    assert "publicationStatus=draft" in blocked["publicationBlockers"]
    assert "quality=needs_passage" in blocked["publicationBlockers"]
    assert set(blocked["blockedCards"][0]["missingFields"]) == {
        "answer",
        "options=A-D-or-A-G",
        "passage",
        "sourceEvidenceId",
        "answerEvidenceStatus=matched",
        "questionTextHash",
        "answerTextHash",
    }
    assert blocked["blockedCards"][1]["missingFields"] == ["uniqueId"]

    support_payload = {"supportingEvidenceOnly": True, "cards": [{"id": "support"}]}
    outside_scope_payload = {
        "paperId": "english1-2030",
        "year": 2030,
        "cards": [{"id": "future"}],
    }
    with tempfile.TemporaryDirectory(prefix="yozi-ai-flashcard-quality-") as temp_dir:
        flashcard_dir = Path(temp_dir)
        write_json(flashcard_dir / "english1-2025.json", passing_payload)
        write_json(flashcard_dir / "english1-2025-support.json", support_payload)
        write_json(flashcard_dir / "english1-2030.json", outside_scope_payload)
        report = build_quality_report(flashcard_dir, min_year=2005, max_year=2026)

    assert report["summary"]["fileCount"] == 1
    assert report["summary"]["skippedFileCount"] == 2
    assert report["releaseReadiness"]["canPromoteToPublic"] is True
    assert {item["reason"] for item in report["skippedFiles"]} == {
        "supportingEvidenceOnly",
        "outsideReleaseYear:2030",
    }
    print("[flashcard-quality] self-test passed")


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit cleaned flashcard JSON files before public promotion."
    )
    parser.add_argument("--flashcard-dir", type=Path, default=DEFAULT_FLASHCARD_DIR)
    parser.add_argument("--min-year", type=int, default=2005)
    parser.add_argument("--max-year", type=int, default=2026)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--fail-on-blockers", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--legacy-hash-batch", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)

    if args.legacy_hash_batch:
        raw = sys.stdin.buffer.read(8 * 1024 * 1024 + 1)
        if len(raw) > 8 * 1024 * 1024:
            raise ValueError("Content digest batch exceeds limit")
        rows = json.loads(raw.decode("utf-8"))
        if (
            not isinstance(rows, list)
            or len(rows) > 2048
            or any(
                not isinstance(row, dict)
                or set(row) != {"bankId", "text"}
                or not isinstance(row["text"], str)
                or len(row["text"]) > 65536
                or not isinstance(row["bankId"], str)
                or LEGACY_CONTENT_HASH_PROFILES.get(row["bankId"])
                not in {"english_material", "english_text"}
                for row in rows
            )
        ):
            raise ValueError("Invalid registered digest batch")
        print(json.dumps([legacy_text_digest(row["bankId"], row["text"]) for row in rows]))
        return 0

    if args.self_test:
        run_self_test()
        return 0

    if args.min_year > args.max_year:
        raise SystemExit("--min-year must be <= --max-year")

    report = build_quality_report(
        args.flashcard_dir, min_year=args.min_year, max_year=args.max_year
    )
    write_json(args.output, report)
    print(
        "[flashcard-quality] "
        f"canPromoteToPublic={report['releaseReadiness']['canPromoteToPublic']} "
        f"files={report['summary']['fileCount']} "
        f"cards={report['summary']['cardCount']} "
        f"blockers={report['summary']['blockerCount']} "
        f"report={args.output}"
    )

    return (
        2 if args.fail_on_blockers and not report["releaseReadiness"]["canPromoteToPublic"] else 0
    )


if __name__ == "__main__":
    raise SystemExit(run())
