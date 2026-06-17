#!/usr/bin/env python3
"""
Repair English paper flashcards with full passage material from the source PDF.

The script is conservative: it enriches existing cards with passage, section,
and group metadata. It only rewrites Part B option structures when the source
paper itself exposes A-G candidate paragraphs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "reports" / "english-passage-repair-report.json"
PDF_TEXT_MIN_COMPACT_CHARS = 500
OCR_LANGUAGE_PREFERENCE = ["zh-Hans", "en-US"]
CHOICE_LABELS = "ABCDEFG"
TRANSLATION_NUMBERS_BY_SUBJECT = {
    "english1": set(range(46, 51)),
    "english2": {46},
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


def relative_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def infer_english_subject(payload: Any, path: Path) -> str:
    candidates = []
    if isinstance(payload, dict):
        candidates.extend(
            [
                payload.get("subject"),
                payload.get("track"),
                payload.get("bankId"),
                payload.get("id"),
                payload.get("paperId"),
            ]
        )
    candidates.append(path.stem)
    joined = " ".join(str(candidate or "").lower() for candidate in candidates)
    if "english2" in joined or "english-2" in joined or "英语二" in joined or "英语（二）" in joined:
        return "english2"
    return "english1"


def translation_numbers_for_subject(subject: str) -> set[int]:
    return TRANSLATION_NUMBERS_BY_SUBJECT.get(subject, TRANSLATION_NUMBERS_BY_SUBJECT["english1"])


def extract_pdf_text(path: Path) -> str:
    if path.suffix.lower() != ".pdf":
        try:
            return path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            return ""

    pdftotext = shutil.which("pdftotext")
    if pdftotext:
        result = subprocess.run(
            [pdftotext, "-layout", str(path), "-"],
            text=True,
            capture_output=True,
            check=False,
            timeout=90,
        )
        if result.returncode == 0 and compact_len(result.stdout) >= PDF_TEXT_MIN_COMPACT_CHARS:
            return result.stdout

    try:
        import fitz  # type: ignore[import-not-found]
    except Exception:  # noqa: BLE001
        return ""

    try:
        with fitz.open(path) as doc:
            text_layer = "\n".join(page.get_text("text") for page in doc)
            if compact_len(text_layer) >= PDF_TEXT_MIN_COMPACT_CHARS:
                return text_layer
    except Exception:  # noqa: BLE001 - callers still need a report for failed extraction.
        return ""

    return ocr_pdf_with_apple_vision(path)


def compact_len(text: str) -> int:
    return len(re.sub(r"\s+", "", text or ""))


def ocr_pdf_with_apple_vision(path: Path) -> str:
    try:
        import fitz  # type: ignore[import-not-found]
        from ocrmac import ocrmac  # type: ignore[import-not-found]
    except Exception:  # noqa: BLE001 - OCR is optional outside macOS.
        return ""

    text_parts: list[str] = []
    try:
        with fitz.open(path) as doc:
            for index, page in enumerate(doc):
                image_path = Path("/tmp") / f"english-passage-repair-{index}.png"
                try:
                    page.get_pixmap(dpi=250).save(str(image_path))
                    annotations = ocrmac.OCR(
                        str(image_path),
                        language_preference=OCR_LANGUAGE_PREFERENCE,
                    ).recognize()
                    sorted_annotations = sorted(annotations, key=lambda row: (1 - row[2][1], row[2][0]))
                    page_text = "\n".join(row[0] for row in sorted_annotations if str(row[0]).strip())
                    text_parts.append(f"\n--- PAGE {index + 1} ---\n{page_text}\n")
                finally:
                    image_path.unlink(missing_ok=True)
    except Exception:  # noqa: BLE001 - callers use the report to see missing passage groups.
        return ""
    return "".join(text_parts)


def clean_text(text: str) -> str:
    text = text.replace("\f", "\n")
    text = text.replace("；", ";")
    text = (
        text.replace("［", "[")
        .replace("］", "]")
        .replace("【", "[")
        .replace("】", "]")
        .replace("」", "]")
        .replace("｣", "]")
    )
    text = re.sub(r"^\s*---\s*PAGE\s+\d+\s*---\s*$", "", text, flags=re.MULTILINE | re.IGNORECASE)
    text = re.sub(r"^.*(?:微信|QQ|公众号|二维码|扫码|全年免费分享|研池大叔).*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"英语[（(]?\s*[一二]\s*[）)]?试题\.\s*\d+\s*\.\s*[（(]共\d+页[）)]", "", text)
    text = re.sub(r"^\s*[（(]共\s*\d+\s*页[）)]\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*英语试题\s*[,.，。]?\s*\d*\s*[,.，。]?\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def compact(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def clean_inline_artifact_text(text: str) -> str:
    text = compact(text)
    text = re.sub(r"\s*英语[（(]?\s*[一二]?\s*[）)]?试题\s*[,.，。]?\s*\d*\s*[,.，。]?\s*$", "", text)
    text = re.sub(r"\s*[.。]?\s*\d+\s*[.。]\s*[（(]\s*共\s*\d+\s*页\s*[）)]\s*$", "", text)
    text = re.sub(r"\s*[（(]\s*共\s*\d+\s*页\s*[）)]\s*$", "", text)
    return text.strip()


def hash_text(text: Any) -> str:
    normalized = compact(str(text or ""))
    if not normalized:
        return ""
    return "sha256:" + hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def refresh_question_hash(card: dict[str, Any]) -> bool:
    question_hash = hash_text(card.get("question") or card.get("stem"))
    if not question_hash:
        return False

    changed = False
    if card.get("questionTextHash") != question_hash:
        card["questionTextHash"] = question_hash
        changed = True

    source_evidence = card.get("sourceEvidence")
    if isinstance(source_evidence, dict) and source_evidence.get("questionTextHash") != question_hash:
        source_evidence["questionTextHash"] = question_hash
        changed = True

    return changed


def first_match(text: str, pattern: str, start: int = 0) -> re.Match[str] | None:
    return re.search(pattern, text[start:], flags=re.IGNORECASE | re.MULTILINE)


def section_between_patterns(text: str, start_pattern: str, end_pattern: str | None, *, start: int = 0) -> str:
    start_match = first_match(text, start_pattern, start)
    if not start_match:
        return ""
    absolute_start = start + start_match.start()
    search_from = start + start_match.end()
    end_index = len(text)
    if end_pattern:
        end_match = first_match(text, end_pattern, search_from)
        if end_match:
            end_index = search_from + end_match.start()
    return text[absolute_start:end_index]


def strip_heading(text: str, heading_pattern: str) -> str:
    return re.sub(rf"^\s*{heading_pattern}\s*", "", text.strip(), count=1, flags=re.IGNORECASE)


def strip_leading_directions(text: str) -> str:
    stripped = text.strip()
    stripped = re.sub(
        r"^.*?Directions[:：].*?(?:\(\s*\d+\s*points\s*\)|（\s*\d+\s*points\s*）)\s*",
        "",
        stripped,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return stripped.strip()


def option_label_matches(text: str) -> list[re.Match[str]]:
    return list(
        re.finditer(
            r"(?:^|\n|[ \t])\s*\[([A-G])\s*(?:\]|J)?\s*|(?:^|\n)\s*([A-G])\s*[.．]\s*",
            text,
            flags=re.IGNORECASE,
        )
    )


def question_start_pattern(number: int) -> str:
    return rf"\n\s*{number}\s*[.．]\s*"


def passage_segments(passage: str) -> list[str]:
    paragraphs = [compact(item) for item in re.split(r"\n\s*\n+", passage) if compact(item)]
    if len(paragraphs) > 1:
        return paragraphs
    text = compact(passage)
    if not text:
        return []
    if len(text) <= 420:
        return [text]
    sentences = re.split(r"(?<=[.!?。！？])\s+", text)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) > 360 and current:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks or [text]


def parse_cloze_options(options_text: str) -> dict[int, list[dict[str, str]]]:
    options_by_number: dict[int, list[dict[str, str]]] = {}
    number_matches = list(re.finditer(r"(?m)^\s*(\d{1,2})\s*[.．]\s*", options_text or ""))
    for index, match in enumerate(number_matches):
        number = int(match.group(1))
        if number < 1 or number > 20:
            continue
        start = match.end()
        end = number_matches[index + 1].start() if index + 1 < len(number_matches) else len(options_text)
        chunk = options_text[start:end]
        label_matches = list(
            re.finditer(
                r"\[\s*([A-D])\s*(?:\]|J)?\s*|(?<!\S)([A-D])\s*[.．,，・•]\s*",
                chunk,
                flags=re.IGNORECASE | re.MULTILINE,
            )
        )
        parsed: dict[str, str] = {}
        for label_index, label_match in enumerate(label_matches):
            label = (label_match.group(1) or label_match.group(2) or "").upper()
            label_start = label_match.end()
            label_end = label_matches[label_index + 1].start() if label_index + 1 < len(label_matches) else len(chunk)
            text = compact(chunk[label_start:label_end])
            text = re.sub(r"^[J\]\s]+", "", text).strip()
            if label in "ABCD" and text:
                parsed[label] = text
        if set(parsed) == set("ABCD"):
            options_by_number[number] = [{"label": label, "text": parsed[label]} for label in "ABCD"]
    return options_by_number


def parse_labelled_option_segments(text: str) -> dict[str, str]:
    matches = list(
        re.finditer(
            r"\[\s*([A-D])\s*(?:\]|J)?\s*|(?<!\w)([A-D])\]\s*",
            text or "",
            flags=re.IGNORECASE,
        )
    )
    parsed: dict[str, str] = {}
    for index, match in enumerate(matches):
        label = (match.group(1) or match.group(2) or "").upper()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        value = compact(text[start:end])
        value = re.sub(r"^\d{1,2}\s*[.．]\s*", "", value).strip()
        if label in "ABCD" and value:
            parsed[label] = value
    return parsed


def row_groups_from_ocr_annotations(annotations: list[Any], *, y_tolerance: float = 0.009) -> list[list[Any]]:
    positioned = [
        row for row in annotations
        if isinstance(row, (tuple, list))
        and len(row) >= 3
        and isinstance(row[2], (tuple, list))
        and len(row[2]) >= 2
        and str(row[0]).strip()
    ]
    positioned.sort(key=lambda row: (-float(row[2][1]), float(row[2][0])))

    groups: list[list[Any]] = []
    for item in positioned:
        y = float(item[2][1])
        if not groups:
            groups.append([item])
            continue
        current_y = sum(float(row[2][1]) for row in groups[-1]) / len(groups[-1])
        if abs(current_y - y) <= y_tolerance:
            groups[-1].append(item)
        else:
            groups.append([item])

    for group in groups:
        group.sort(key=lambda row: float(row[2][0]))
    return groups


def extract_cloze_options_from_pdf_geometry(source_pdf: Path) -> dict[int, list[dict[str, str]]]:
    if source_pdf.suffix.lower() != ".pdf":
        return {}
    try:
        import fitz  # type: ignore[import-not-found]
        from ocrmac import ocrmac  # type: ignore[import-not-found]
    except Exception:  # noqa: BLE001 - geometry fallback is optional outside macOS.
        return {}

    options_by_number: dict[int, dict[str, str]] = {}
    current_number: int | None = None
    seen_options = False

    try:
        with fitz.open(source_pdf) as doc:
            for page_index, page in enumerate(doc):
                image_path = Path("/tmp") / f"english-cloze-options-{page_index}.png"
                try:
                    page.get_pixmap(dpi=250).save(str(image_path))
                    annotations = ocrmac.OCR(
                        str(image_path),
                        language_preference=["en-US", "zh-Hans"],
                    ).recognize()
                finally:
                    image_path.unlink(missing_ok=True)

                for group in row_groups_from_ocr_annotations(annotations):
                    row_text = compact(" ".join(str(item[0]).strip() for item in group))
                    if not row_text:
                        continue
                    if re.search(r"Section\s+II\s+Reading\s+Comprehension", row_text, flags=re.IGNORECASE):
                        return {
                            number: [{"label": label, "text": values[label]} for label in "ABCD"]
                            for number, values in sorted(options_by_number.items())
                            if set(values) == set("ABCD")
                        }
                    number_match = re.match(r"^\s*(\d{1,2})\s*[.．]\s*", row_text)
                    labelled = parse_labelled_option_segments(row_text)
                    if number_match:
                        number = int(number_match.group(1))
                        if 1 <= number <= 20:
                            current_number = number
                            if labelled:
                                seen_options = True
                                options_by_number.setdefault(number, {}).update(labelled)
                            continue
                    if seen_options and current_number and labelled:
                        options_by_number.setdefault(current_number, {}).update(labelled)
    except Exception:  # noqa: BLE001 - callers still use text extraction reports.
        return {}

    return {
        number: [{"label": label, "text": values[label]} for label in "ABCD"]
        for number, values in sorted(options_by_number.items())
        if set(values) == set("ABCD")
    }


def parse_ag_options(part_b_text: str) -> list[dict[str, str]]:
    options: list[dict[str, str]] = []
    matches = option_label_matches(part_b_text)
    for index, match in enumerate(matches):
        label = (match.group(1) or match.group(2) or "").upper()
        if label not in CHOICE_LABELS:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(part_b_text)
        text = clean_inline_artifact_text(part_b_text[start:end])
        if text:
            options.append({"label": label, "text": text})
    expected = [chr(ord("A") + index) for index in range(len(options))]
    if [option["label"] for option in options] != expected or len(options) < 5:
        return []
    return options


def parse_translation_segments(part_c_passage: str) -> dict[int, str]:
    segments: dict[int, str] = {}
    matches = list(
        re.finditer(
            r"[\(（]\s*(4[6-9]|50)\s*(?:[\)）]|\s+(?=[A-Z\"“'‘]))\s*",
            part_c_passage or "",
        )
    )
    for index, match in enumerate(matches):
        number = int(match.group(1))
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(part_c_passage)
        segment = compact(part_c_passage[start:end])
        if segment:
            segments[number] = segment
    return segments


def part_b_article(part_b_text: str) -> str:
    matches = option_label_matches(part_b_text)
    if not matches:
        return compact(strip_leading_directions(part_b_text))

    prefix = strip_leading_directions(part_b_text[: matches[0].start()])
    if compact(prefix):
        return compact(prefix)

    last_start = matches[-1].end()
    line_end = part_b_text.find("\n", last_start)
    article = part_b_text[line_end + 1 :] if line_end != -1 else ""
    return compact(strip_leading_directions(article))


def extract_english_passages(paper_text: str) -> dict[str, dict[str, Any]]:
    cleaned = clean_text(paper_text)
    passages: dict[str, dict[str, str]] = {}

    cloze = section_between_patterns(
        cleaned,
        r"Section\s+I\s+Use\s+of\s+English|Section\s+I\s*\n\s*Use\s+of\s+English",
        r"\n\s*1\s*[.．]\s*(?:\[|[A-D][.．])",
    )
    if cloze:
        cloze = strip_leading_directions(cloze)
        cloze_options = section_between_patterns(
            cleaned,
            r"\n\s*1\s*[.．]\s*(?:\[|[A-D][.．])",
            r"\n\s*Section\s+(?:II|I{1,2}|H|Ⅱ)\s+Reading\s+Comprehension",
        )
        passages["cloze"] = {
            "section": "完形填空",
            "passage": compact(cloze),
            "optionsByNumber": parse_cloze_options(cloze_options),
        }

    for index in range(1, 5):
        start_pattern = rf"\n\s*Text\s*{index}\s*\n"
        end_pattern = question_start_pattern(16 + index * 5) if index < 4 else r"\n\s*Part\s+B\s*\n"
        text_section = section_between_patterns(cleaned, start_pattern, end_pattern)
        if text_section:
            passages[f"text{index}"] = {
                "section": f"阅读理解 Text {index}",
                "passage": compact(strip_heading(text_section, rf"Text\s*{index}")),
            }

    part_b = section_between_patterns(cleaned, r"\n\s*Part\s+B\s*\n", r"\n\s*Part\s+C\s*\n")
    if part_b:
        passages["part-b"] = {
            "section": "新题型",
            "passage": part_b_article(part_b),
            "options": parse_ag_options(part_b),
        }

    part_c = section_between_patterns(cleaned, r"\n\s*Part\s+C\s*\n", r"\n\s*Section\s+(?:III|ID)\s+Writing")
    if not part_c:
        part_c = section_between_patterns(
            cleaned,
            r"\n\s*Section\s+(?:III|ID)\s+Translation\s*\n",
            r"\n\s*Section\s+(?:IV|III|ID)\s+Writing",
        )
    if part_c:
        passages["part-c"] = {"section": "翻译", "passage": compact(strip_leading_directions(part_c))}

    return passages


def group_for_number(number: int, subject: str = "english1") -> str:
    if 1 <= number <= 20:
        return "cloze"
    if 21 <= number <= 25:
        return "text1"
    if 26 <= number <= 30:
        return "text2"
    if 31 <= number <= 35:
        return "text3"
    if 36 <= number <= 40:
        return "text4"
    if 41 <= number <= 45:
        return "part-b"
    if number in translation_numbers_for_subject(subject):
        return "part-c"
    return ""


def card_number(card: dict[str, Any]) -> int:
    try:
        return int(float(card.get("number") or 0))
    except (TypeError, ValueError):
        match = re.search(r"-(\d{3})$", str(card.get("id") or ""))
        return int(match.group(1)) if match else 0


def reset_answer_evidence(card: dict[str, Any]) -> None:
    for key in ["answerEvidenceStatus", "answerEvidenceSourceId", "answerTextHash", "answerEvidence"]:
        card.pop(key, None)


def build_cloze_card(
    existing: dict[str, Any] | None,
    *,
    payload: dict[str, Any],
    number: int,
    passage_info: dict[str, Any],
    reset_answer: bool,
) -> dict[str, Any]:
    card = dict(existing or {})
    year = payload.get("year") or card.get("year") or ""
    subject = card.get("subject") or payload.get("subject") or ""
    prefix = str(payload.get("id") or payload.get("paperId") or f"english1-{year}").strip("-")
    card["id"] = card.get("id") or f"{prefix}-{number:03d}"
    card["number"] = number
    card["year"] = card.get("year") or year
    card["subject"] = subject
    card["type"] = "single_choice"
    card["question"] = f"完形填空第 {number} 空：阅读全文后选择最合适的选项。"
    card["options"] = passage_info.get("optionsByNumber", {}).get(number, card.get("options", []))
    card["groupId"] = "cloze"
    card["section"] = passage_info["section"]
    card["passage"] = passage_info["passage"]
    card["context"] = passage_info["passage"]
    card["material"] = passage_info["passage"]
    card["passageSegments"] = passage_segments(passage_info["passage"])
    if reset_answer:
        card["answer"] = ""
        reset_answer_evidence(card)
    return card


def build_translation_card(
    existing: dict[str, Any] | None,
    *,
    payload: dict[str, Any],
    number: int,
    passage_info: dict[str, Any],
    segment: str,
    reset_answer: bool,
) -> dict[str, Any]:
    card = dict(existing or {})
    year = payload.get("year") or card.get("year") or ""
    subject = card.get("subject") or payload.get("subject") or ""
    prefix = str(payload.get("id") or payload.get("paperId") or f"english1-{year}").strip("-")
    card["id"] = card.get("id") or f"{prefix}-{number:03d}"
    card["number"] = number
    card["year"] = card.get("year") or year
    card["subject"] = subject
    card["type"] = "translation"
    card["question"] = f"翻译第 {number} 处画线句：请先阅读 Part C 全文，再翻译该标注片段。"
    card["targetSegment"] = segment
    card["options"] = []
    card["groupId"] = "part-c"
    card["section"] = passage_info["section"]
    card["passage"] = passage_info["passage"]
    card["context"] = passage_info["passage"]
    card["material"] = passage_info["passage"]
    card["passageSegments"] = passage_segments(passage_info["passage"])
    if reset_answer:
        card["answer"] = ""
        reset_answer_evidence(card)
    elif re.fullmatch(r"[A-G]{1,7}", compact(card.get("answer"))):
        card["answer"] = ""
        reset_answer_evidence(card)
    return card


def build_part_b_card(
    existing: dict[str, Any] | None,
    *,
    payload: dict[str, Any],
    number: int,
    passage_info: dict[str, Any],
    reset_answer: bool,
) -> dict[str, Any]:
    card = dict(existing or {})
    year = payload.get("year") or card.get("year") or ""
    subject = card.get("subject") or payload.get("subject") or ""
    prefix = str(payload.get("id") or payload.get("paperId") or f"english1-{year}").strip("-")
    card["id"] = card.get("id") or f"{prefix}-{number:03d}"
    card["number"] = number
    card["year"] = card.get("year") or year
    card["subject"] = subject
    card["type"] = "single_choice"
    card["question"] = f"新题型第 {number} 空：请先阅读完整文章，再从 A-G 中选择最合适的段落。"
    card["options"] = passage_info.get("options", card.get("options", []))
    card["groupId"] = "part-b"
    card["section"] = passage_info["section"]
    card["passage"] = passage_info["passage"]
    card["context"] = passage_info["passage"]
    card["material"] = passage_info["passage"]
    card["passageSegments"] = passage_segments(passage_info["passage"])
    if reset_answer:
        card["answer"] = ""
        reset_answer_evidence(card)
    return card


def repair_english_passages(
    target_path: Path,
    source_pdf: Path,
    *,
    write: bool = False,
    repair_cloze_cards: bool = False,
    reset_cloze_answers: bool = False,
    repair_part_b_cards: bool = False,
    reset_part_b_answers: bool = False,
    repair_translation_cards: bool = False,
    reset_translation_answers: bool = False,
    now: str | None = None,
) -> dict[str, Any]:
    now = now or utc_now()
    payload = read_json(target_path, {})
    cards = payload.get("cards") if isinstance(payload, dict) and isinstance(payload.get("cards"), list) else []
    english_subject = infer_english_subject(payload, target_path)
    translation_numbers = translation_numbers_for_subject(english_subject)
    passages = extract_english_passages(extract_pdf_text(source_pdf))
    if (
        passages.get("cloze")
        and len(passages.get("cloze", {}).get("optionsByNumber", {}) or {}) < 20
    ):
        geometry_options = extract_cloze_options_from_pdf_geometry(source_pdf)
        if len(geometry_options) > len(passages["cloze"].get("optionsByNumber", {}) or {}):
            passages["cloze"]["optionsByNumber"] = geometry_options
    repaired_cards: list[str] = []
    missing_groups: dict[str, int] = {}
    cloze_added_count = 0
    cloze_rebuilt_count = 0
    translation_added_count = 0
    translation_rebuilt_count = 0

    if repair_cloze_cards and isinstance(payload, dict) and passages.get("cloze"):
        cloze_info = passages["cloze"]
        options_by_number = cloze_info.get("optionsByNumber") if isinstance(cloze_info.get("optionsByNumber"), dict) else {}
        existing_by_number = {card_number(card): card for card in cards if isinstance(card, dict) and 1 <= card_number(card) <= 20}
        rebuilt_cloze_cards: list[dict[str, Any]] = []
        for number in range(1, 21):
            if number not in options_by_number:
                continue
            existing = existing_by_number.get(number)
            rebuilt = build_cloze_card(
                existing,
                payload=payload,
                number=number,
                passage_info=cloze_info,
                reset_answer=reset_cloze_answers,
            )
            rebuilt_cloze_cards.append(rebuilt)
            cloze_rebuilt_count += 1
            if existing is None:
                cloze_added_count += 1

        if rebuilt_cloze_cards:
            non_cloze_cards = [card for card in cards if not (isinstance(card, dict) and 1 <= card_number(card) <= 20)]
            cards = sorted(rebuilt_cloze_cards + non_cloze_cards, key=card_number)
            payload["cards"] = cards

    if repair_part_b_cards and isinstance(payload, dict) and passages.get("part-b", {}).get("options"):
        part_b_info = passages["part-b"]
        existing_by_number = {card_number(card): card for card in cards if isinstance(card, dict) and 41 <= card_number(card) <= 45}
        rebuilt_part_b_cards: list[dict[str, Any]] = []
        for number in range(41, 46):
            rebuilt_part_b_cards.append(
                build_part_b_card(
                    existing_by_number.get(number),
                    payload=payload,
                    number=number,
                    passage_info=part_b_info,
                    reset_answer=reset_part_b_answers,
                )
            )
        non_part_b_cards = [card for card in cards if not (isinstance(card, dict) and 41 <= card_number(card) <= 45)]
        cards = sorted(non_part_b_cards + rebuilt_part_b_cards, key=card_number)
        payload["cards"] = cards

    if repair_translation_cards and isinstance(payload, dict) and passages.get("part-c"):
        part_c_info = passages["part-c"]
        segments = parse_translation_segments(part_c_info.get("passage", ""))
        existing_by_number = {
            card_number(card): card
            for card in cards
            if isinstance(card, dict) and card_number(card) in translation_numbers
        }
        rebuilt_translation_cards: list[dict[str, Any]] = []
        for number in sorted(translation_numbers):
            segment = segments.get(number)
            if not segment:
                continue
            existing = existing_by_number.get(number)
            rebuilt = build_translation_card(
                existing,
                payload=payload,
                number=number,
                passage_info=part_c_info,
                segment=segment,
                reset_answer=reset_translation_answers,
            )
            rebuilt_translation_cards.append(rebuilt)
            translation_rebuilt_count += 1
            if existing is None:
                translation_added_count += 1

        if rebuilt_translation_cards:
            non_translation_cards = [
                card
                for card in cards
                if not (isinstance(card, dict) and card_number(card) in translation_numbers)
            ]
            cards = sorted(non_translation_cards + rebuilt_translation_cards, key=card_number)
            payload["cards"] = cards

    for card in cards:
        if not isinstance(card, dict):
            continue
        number = card_number(card)
        group_id = group_for_number(number, english_subject)
        if not group_id:
            continue
        passage_info = passages.get(group_id)
        if not passage_info or not passage_info.get("passage"):
            missing_groups[group_id] = missing_groups.get(group_id, 0) + 1
            continue

        card["groupId"] = card.get("groupId") or group_id
        card["section"] = card.get("section") or passage_info["section"]
        card["passage"] = passage_info["passage"]
        card["context"] = card.get("context") or passage_info["passage"]
        card["material"] = card.get("material") or passage_info["passage"]
        card["passageSegments"] = passage_segments(passage_info["passage"])
        if group_id in {"text1", "text2", "text3", "text4"} and card.get("options"):
            card["type"] = "single_choice"
        if group_id == "part-b" and passage_info.get("options"):
            card["options"] = passage_info["options"]
            card["type"] = "single_choice"
            if reset_part_b_answers:
                card["answer"] = ""
                reset_answer_evidence(card)
        refresh_question_hash(card)
        repaired_cards.append(str(card.get("id") or number))

    if write and isinstance(payload, dict):
        payload["total_cards"] = len(cards)
        payload["passageRepairedAt"] = now
        payload["passageSourceFilePath"] = relative_path(source_pdf)
        write_json(target_path, payload)

    return {
        "version": 1,
        "generatedAt": now,
        "write": write,
        "targetFile": relative_path(target_path),
        "sourcePdf": relative_path(source_pdf),
        "subject": english_subject,
        "summary": {
            "cardCount": len(cards),
            "passageGroupCount": len(passages),
            "repairedCardCount": len(repaired_cards),
            "missingGroupCount": len(missing_groups),
            "clozeOptionNumberCount": len(passages.get("cloze", {}).get("optionsByNumber", {}) or {}),
            "clozeRebuiltCount": cloze_rebuilt_count,
            "clozeAddedCount": cloze_added_count,
            "translationSegmentCount": len(parse_translation_segments(passages.get("part-c", {}).get("passage", ""))),
            "translationRebuiltCount": translation_rebuilt_count,
            "translationAddedCount": translation_added_count,
        },
        "passageGroups": {
            key: {
                "section": value["section"],
                "length": len(value["passage"]),
                "optionCount": len(value.get("options") or []),
                "optionNumberCount": len(value.get("optionsByNumber", {}) or {}),
            }
            for key, value in passages.items()
        },
        "missingGroups": missing_groups,
        "repairedCards": repaired_cards,
    }


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Repair English flashcards with source passage material.")
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--source-pdf", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--write", action="store_true")
    parser.add_argument(
        "--repair-cloze-cards",
        action="store_true",
        help="Rebuild English cloze 1-20 cards from source options when the cleaned bank missed or merged them.",
    )
    parser.add_argument(
        "--reset-cloze-answers",
        action="store_true",
        help="Clear rebuilt cloze answers so answer_evidence_repair can refill them from the answer key.",
    )
    parser.add_argument(
        "--repair-part-b-cards",
        action="store_true",
        help="Build or rebuild English Part B cards 41-45 from source A-G options.",
    )
    parser.add_argument(
        "--reset-part-b-answers",
        action="store_true",
        help="Clear rebuilt Part B answers so answer_evidence_repair can refill them from the answer key.",
    )
    parser.add_argument(
        "--repair-translation-cards",
        action="store_true",
        help="Build English Part C translation cards 46-50 from source segment markers.",
    )
    parser.add_argument(
        "--reset-translation-answers",
        action="store_true",
        help="Clear rebuilt translation answers so answer_evidence_repair can refill them from the answer key.",
    )
    args = parser.parse_args(argv)

    report = repair_english_passages(
        args.target,
        args.source_pdf,
        write=args.write,
        repair_cloze_cards=args.repair_cloze_cards,
        reset_cloze_answers=args.reset_cloze_answers,
        repair_part_b_cards=args.repair_part_b_cards,
        reset_part_b_answers=args.reset_part_b_answers,
        repair_translation_cards=args.repair_translation_cards,
        reset_translation_answers=args.reset_translation_answers,
    )
    write_json(args.output, report)
    print(
        "[english-passage-repair] "
        f"write={args.write} "
        f"repaired={report['summary']['repairedCardCount']} "
        f"groups={report['summary']['passageGroupCount']} "
        f"missingGroups={report['summary']['missingGroupCount']} "
        f"report={args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
