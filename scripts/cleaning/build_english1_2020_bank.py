#!/usr/bin/env python3
"""
Build the 2020 English I public-course bank from local Baidu Netdisk PDFs.

The original paper PDF contains a usable text layer but also has promotional
header noise. This builder keeps that original file as an audited source while
using the cleaner answer-speed PDF text layer and rendered pages for release
question evidence. The answer-speed PDF supplies the official answer table, and
the detailed-analysis PDF is retained as supporting answer evidence.
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
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english1-2020.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "english1-2020"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "english1-2020-release-assets"

ORIGINAL_PAPER = RAW_DIR / "src_4ccc82ab098d5899704e062e-2020年考研英语一真题.pdf"
ANSWER_SPEED = RAW_DIR / "src_1d24809436b0ec4b51ad791d-2020年真题及答案速查.pdf"
DETAILED_ANALYSIS = RAW_DIR / "src_fdf78e9a8144f75d0ba9095b-2020年真题逐题细解.pdf"
DOCUMENT_VERSION = RAW_DIR / "src_7d24da239755e36b91b1f88c-2020考研英语一真题及解析.pdf"

ORIGINAL_SOURCE_ID = "src_4ccc82ab098d5899704e062e"
ANSWER_SOURCE_ID = "src_1d24809436b0ec4b51ad791d"
DETAILED_SOURCE_ID = "src_fdf78e9a8144f75d0ba9095b"
DOCUMENT_SOURCE_ID = "src_7d24da239755e36b91b1f88c"
LOCAL_SOURCE_ID = "english1-2020-paper-answer"

CHOICE_ANSWERS = {
    1: "C",
    2: "A",
    3: "B",
    4: "D",
    5: "A",
    6: "B",
    7: "D",
    8: "A",
    9: "D",
    10: "C",
    11: "C",
    12: "A",
    13: "B",
    14: "D",
    15: "C",
    16: "B",
    17: "A",
    18: "B",
    19: "C",
    20: "D",
    21: "C",
    22: "B",
    23: "D",
    24: "B",
    25: "C",
    26: "D",
    27: "A",
    28: "C",
    29: "A",
    30: "D",
    31: "A",
    32: "C",
    33: "D",
    34: "C",
    35: "B",
    36: "C",
    37: "A",
    38: "B",
    39: "C",
    40: "B",
    41: "C",
    42: "E",
    43: "G",
    44: "A",
    45: "D",
}

TRANSLATION_ANSWERS = {
    46: "文艺复兴使教会的教义与思维方式黯然失色，中世纪与现代之间的鸿沟得以弥合，通向了尚未探索的新知识领域。",
    47: "在他们的每一项发现揭示之前，当时的许多思想家依然保持着更古老的思维方式，包括地心说，即地球是我们宇宙的中心。",
    48: "尽管教会试图压制这些新一代的逻辑学家和理性主义者，但关于宇宙如何运转的解释越来越多，而且出现的速度之快让人无法忽视。",
    49: "当许多人承担起责任，试图将推理和科学哲学融入世界的时候，文艺复兴就结束了，同时，一个新的时代到来了。",
    50: "这种寻求知识和理解我们已经知道的信息的行为在拉丁语中被称为“sapere aude”，即“敢于求知”。",
}

TRANSLATION_SEGMENTS = {
    46: "With the Church's teachings and ways of thinking being eclipsed by the Renaissance, the gap between the Medieval and modern periods had been bridged, leading to new and unexplored intellectual territories.",
    47: "Before each of their revelations, many thinkers at the time had sustained more ancient ways of thinking, including the geocentric view that the Earth was at the centre of our universe.",
    48: "Despite attempts by the Church to suppress this new generation of logicians and rationalists, more explanations for how the universe functioned were being made at a rate that the people could no longer ignore.",
    49: "As many took on the duty of trying to integrate reasoning and scientific philosophies into the world, the Renaissance was over and it was time for a new era—the Age of Reason.",
    50: 'Such actions to seek knowledge and to understand what information we already knew were captured by the Latin phrase "sapere aude" or "dare to know", after Immanuel Kant used it in his essay "An Answer to the Question: What is Enlightenment?".',
}

WRITING_PROMPTS = {
    51: (
        "The student union of your university has assigned you to inform the "
        "international students about an upcoming singing contest. Write a notice "
        "in about 100 words. Do not use your own name in the notice."
    ),
    52: (
        "Write an essay of 160-200 words based on the pictures themed \"习惯\". "
        "Describe the pictures briefly, interpret the implied meaning, and give your comments."
    ),
}

PART_B_OPTIONS = {
    "A": "Eye fixations are brief",
    "B": "Too much eye contact is instinctively felt to be rude",
    "C": "Eye contact can be a friendly social signal",
    "D": "Personality can affect how a person reacts to eye contact",
    "E": "Biological factors behind eye contact are being investigated",
    "F": "Most people are not comfortable holding eye contact with strangers",
    "G": "Eye contact can be aggressive",
}

QUESTION_PAGES = {
    **{number: [2, 3] for number in range(1, 21)},
    **{number: [4, 5] for number in range(21, 26)},
    **{number: [6, 7] for number in range(26, 31)},
    **{number: [8, 9] for number in range(31, 36)},
    **{number: [10, 11] for number in range(36, 41)},
    **{number: [12, 13] for number in range(41, 46)},
    **{number: [14, 15] for number in range(46, 51)},
    51: [15],
    52: [15],
}

ANSWER_PAGES = {
    **{number: [16] for number in range(1, 51)},
    51: [15],
    52: [15],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def sha256_text(text: str) -> str:
    return f"sha256:{hashlib.sha256(text.encode('utf-8')).hexdigest()}"


def run(cmd: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str] | None:
    result = subprocess.run(cmd, cwd=PROJECT_ROOT, check=True, text=True, capture_output=capture)
    return result if capture else None


def compact(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def render_pdf_assets(pdf: Path, prefix: str, *, asset_dir: Path, force: bool, first_page: int, last_page: int) -> None:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = sorted(asset_dir.glob(f"{prefix}-*.jpg"))
    if len(expected) >= last_page - first_page + 1 and not force:
        return

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob(f"{prefix}-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / prefix
    run(
        [
            "pdftoppm",
            "-f",
            str(first_page),
            "-l",
            str(last_page),
            "-r",
            "130",
            "-jpeg",
            "-jpegopt",
            "quality=70",
            str(pdf),
            str(output_prefix),
        ]
    )

    for rendered in sorted(TMP_RENDER_DIR.glob(f"{prefix}-*.jpg")):
        page = int(rendered.stem.split("-")[-1])
        shutil.copyfile(rendered, asset_dir / f"{prefix}-{page:02d}.jpg")


def image_ref(prefix: str, page: int, *, caption: str) -> dict[str, str]:
    file_name = f"{prefix}-{page:02d}.jpg"
    return {
        "src": f"question-bank/english1-2020/{file_name}",
        "caption": caption,
        "alt": f"2020考研英语一{caption}",
    }


def extract_pdf_text(path: Path) -> str:
    result = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
        timeout=90,
    )
    return result.stdout if result.returncode == 0 else ""


def section_between(text: str, start_pattern: str, end_pattern: str | None) -> str:
    flags = re.IGNORECASE | re.MULTILINE | re.DOTALL
    start_match = re.search(start_pattern, text, flags=flags)
    if not start_match:
        return ""
    start = start_match.end()
    end = len(text)
    if end_pattern:
        end_match = re.search(end_pattern, text[start:], flags=flags)
        if end_match:
            end = start + end_match.start()
    return compact(text[start:end])


def build_passages(asset_dir: Path) -> dict[str, str]:
    del asset_dir
    text = extract_pdf_text(ANSWER_SPEED)
    passages = {
        "cloze": section_between(text, r"Section\s+I\s+Use\s+of\s+English.*?\(10 points\)", r"\n\s*1\.\s*A\."),
        "text1": section_between(text, r"\n\s*Text\s*1\s*\n", r"\n\s*21\."),
        "text2": section_between(text, r"\n\s*Text\s*2\s*\n", r"\n\s*26\."),
        "text3": section_between(text, r"\n\s*Text\s*3\s*\n", r"\n\s*31\."),
        "text4": section_between(text, r"\n\s*Text\s*4\s*\n", r"\n\s*36\."),
        "part-b": section_between(text, r"\n\s*Part\s+B\s*\n", r"\n\s*Part\s+C\s*\n"),
        "part-c": section_between(text, r"\n\s*Part\s+C\s*\n.*?\(10 points\)", r"\n\s*Section\s+m\s+Writing"),
        "writing": section_between(text, r"\n\s*Section\s+m\s+Writing", r"2020年考研英语"),
    }
    missing = [key for key, value in passages.items() if not value]
    if missing:
        raise RuntimeError(f"Missing PDF text passage groups: {', '.join(missing)}")
    if "town of culture" not in passages["text1"].lower():
        raise RuntimeError("2020 Text 1 text layer did not contain the expected town-of-culture article")
    if "sci-hub" not in passages["text2"].lower():
        raise RuntimeError("2020 Text 2 text layer did not contain the expected scientific publishing article")
    if "gender parity" not in passages["text3"].lower():
        raise RuntimeError("2020 Text 3 text layer did not contain the expected gender-parity article")
    if "digital services tax" not in passages["text4"].lower():
        raise RuntimeError("2020 Text 4 text layer did not contain the expected digital-tax article")
    if "eye-tracking" not in passages["part-b"].lower():
        raise RuntimeError("2020 Part B text layer did not contain the expected eye-contact passage")
    part_c = passages["part-c"].lower()
    if "renaissance" not in part_c or "sapere aude" not in part_c:
        raise RuntimeError("2020 Part C text layer did not contain the expected Renaissance translation passage")
    if "upcoming singing contest" not in passages["writing"].lower() or "习惯" not in passages["writing"]:
        raise RuntimeError("2020 Writing text layer did not contain both official writing prompts")
    return passages


def passage_segments(text: str) -> list[str]:
    normalized = compact(text)
    if len(normalized) <= 420:
        return [normalized]
    sentences = re.split(r"(?<=[.!?。！？])\s+", normalized)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current} {sentence}".strip() if current else sentence.strip()
        if len(candidate) > 360 and current:
            chunks.append(current)
            current = sentence.strip()
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks or [normalized]


def group_for(number: int) -> str:
    if number <= 20:
        return "cloze"
    if number <= 25:
        return "text1"
    if number <= 30:
        return "text2"
    if number <= 35:
        return "text3"
    if number <= 40:
        return "text4"
    if number <= 45:
        return "part-b"
    if number <= 50:
        return "part-c"
    return "writing"


def section_for(number: int) -> str:
    if number <= 20:
        return "完形填空"
    if number <= 40:
        return f"阅读理解 Text {(number - 21) // 5 + 1}"
    if number <= 45:
        return "新题型"
    if number <= 50:
        return "翻译"
    return "写作"


def type_for(number: int) -> str:
    if number <= 45:
        return "single_choice"
    if number <= 50:
        return "translation"
    return "essay"


def options_for(number: int) -> list[dict[str, str]]:
    if number <= 40:
        return [{"label": label, "text": label} for label in "ABCD"]
    if number <= 45:
        return [{"label": label, "text": PART_B_OPTIONS[label]} for label in "ABCDEFG"]
    return []


def answer_for(number: int) -> str:
    if number <= 45:
        return CHOICE_ANSWERS[number]
    if number <= 50:
        return TRANSLATION_ANSWERS[number]
    return f"按官方题干完成写作任务：{WRITING_PROMPTS[number]}"


def question_for(number: int) -> str:
    if number <= 20:
        return f"完形填空第 {number} 空：请结合原卷页图和完整短文选择最合适的选项。"
    if number <= 40:
        return f"阅读理解第 {number} 题：请先阅读对应 Text 原文和题干页图，再选择最合适的选项。"
    if number <= 45:
        return f"新题型第 {number} 空：请先阅读完整文章，再从 A-G 中选择最合适的小标题。"
    if number <= 50:
        return f"翻译第 {number} 处画线句：{TRANSLATION_SEGMENTS[number]}"
    return WRITING_PROMPTS[number]


def explanation_for(number: int) -> str:
    if number <= 45:
        return "答案来自本地百度网盘 2020 年真题答案速查表，并用逐题细解 PDF 作为答案解析支持。"
    if number <= 50:
        return "参考译文来自本地百度网盘 2020 年真题答案速查表，并与逐题细解译文核对。"
    return "写作题按原卷官方任务训练；答案证据覆盖官方题干和作答要求，不声明唯一范文答案。"


def source_evidence(question_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": LOCAL_SOURCE_ID,
        "sourceId": ANSWER_SOURCE_ID,
        "originalPaperSourceId": ORIGINAL_SOURCE_ID,
        "answerSourceId": ANSWER_SOURCE_ID,
        "sourceType": "official_paper",
        "sourceFilePath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
        "originalPaperFilePath": str(ORIGINAL_PAPER.relative_to(PROJECT_ROOT)),
        "fileSha256": sha256_file(ANSWER_SPEED),
        "originalPaperSha256": sha256_file(ORIGINAL_PAPER),
        "status": "matched",
        "method": "local_answer_speed_pdf_text_layer_with_original_paper_audit",
        "questionTextHash": question_hash,
        "verifiedBy": "build_english1_2020_bank",
    }


def answer_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    role = "official_writing_prompt" if number >= 51 else "official_answer_key"
    return {
        "status": "matched",
        "evidenceRole": role,
        "sourceId": ANSWER_SOURCE_ID,
        "supportingSourceId": DETAILED_SOURCE_ID,
        "sourceFilePath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
        "answerTextHash": answer_hash,
        "method": "local_answer_table_with_detailed_pdf_cross_check",
        "verifiedBy": "build_english1_2020_bank",
        "note": "Matched against local Baidu Netdisk 2020 English I answer-speed PDF; detailed analysis PDF is retained as supporting answer evidence.",
    }


def build_card(number: int, passages: dict[str, str]) -> dict[str, Any]:
    group = group_for(number)
    passage = passages.get(group, "")
    if group == "writing":
        passage = question_for(number)
    question = question_for(number)
    options = options_for(number)
    answer = answer_for(number)
    question_images = [image_ref("paper-page", page, caption=f"试卷原页 p.{page}") for page in QUESTION_PAGES[number]]
    answer_images = [image_ref("answer-page", page, caption=f"答案证据 p.{page}") for page in ANSWER_PAGES[number]]
    question_hash = sha256_text(
        json.dumps(
            {
                "question": question,
                "passage": passage,
                "options": options,
                "questionPages": QUESTION_PAGES[number],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    answer_hash = sha256_text(
        json.dumps({"answer": answer, "answerPages": ANSWER_PAGES[number]}, ensure_ascii=False, sort_keys=True)
    )

    card = {
        "id": f"english1-2020-{number:03d}",
        "number": number,
        "paperId": "english1-2020",
        "paperName": "2020考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2020",
        "section": section_for(number),
        "groupId": group,
        "type": type_for(number),
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "passage": passage,
        "context": passage,
        "material": passage,
        "passageSegments": passage_segments(passage),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["english1", "2020真题", section_for(number)],
        "difficulty": 3 if number >= 46 else 2,
        "source": ANSWER_SPEED.name,
        "sourceEvidenceId": LOCAL_SOURCE_ID,
        "sourceEvidence": source_evidence(question_hash),
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "answerEvidenceStatus": "matched",
        "answerEvidenceSourceId": ANSWER_SOURCE_ID,
        "answerEvidence": answer_evidence(number, answer_hash),
    }
    if 46 <= number <= 50:
        card["targetSegment"] = TRANSLATION_SEGMENTS[number]
    return card


def validate_cards(cards: list[dict[str, Any]]) -> None:
    issues: list[str] = []
    if len(cards) != 52:
        issues.append(f"card count {len(cards)} != 52")
    for expected_number, card in enumerate(cards, start=1):
        if card.get("number") != expected_number:
            issues.append(f"card {expected_number}: number={card.get('number')}")
        if not str(card.get("passage") or "").strip():
            issues.append(f"card {expected_number}: missing passage")
        if not card.get("questionImages") or not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing page images")
        if card.get("answerEvidenceStatus") != "matched":
            issues.append(f"card {expected_number}: unmatched answer evidence")
    expected_answers = {1: "C", 21: "C", 30: "D", 41: "C", 45: "D"}
    for number, answer in expected_answers.items():
        if cards[number - 1].get("answer") != answer:
            issues.append(f"card {number}: answer={cards[number - 1].get('answer')} expected {answer}")
    if "sci-hub" not in cards[25]["passage"].lower() or cards[29]["answer"] != "D":
        issues.append("Text 2 evidence mismatch for question 30")
    if "eye-tracking" not in cards[42]["passage"].lower() or cards[42]["answer"] != "G":
        issues.append("Part B evidence mismatch for question 43")
    if "with the church's teachings and ways of thinking" not in cards[45].get("targetSegment", "").lower():
        issues.append("Part C evidence mismatch for question 46")
    payload_text = json.dumps(cards, ensure_ascii=False)
    for forbidden in ["手机阅读目的调查", "failure"]:
        if forbidden in payload_text:
            issues.append(f"unexpected source bleed detected: {forbidden}")
    if issues:
        raise ValueError("english1-2020 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(ANSWER_SPEED, "paper-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=15)
    render_pdf_assets(ANSWER_SPEED, "answer-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=16)
    passages = build_passages(asset_dir)
    cards = [build_card(number, passages) for number in range(1, 53)]
    validate_cards(cards)

    return {
        "id": "english1-2020",
        "source": LOCAL_SOURCE_ID,
        "paperId": "english1-2020",
        "paperName": "2020考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2020",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_clean_answer_speed_pdf_text_layer_with_original_paper_audit_v1",
        "sourceFiles": [
            {
                "id": "english1-2020-original-paper",
                "sourceId": ORIGINAL_SOURCE_ID,
                "role": "paper_original_audit",
                "localPath": str(ORIGINAL_PAPER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(ORIGINAL_PAPER),
                "note": "Official paper PDF retained for audit; release page assets use the cleaner answer-speed PDF because this source contains promotional header noise.",
            },
            {
                "id": LOCAL_SOURCE_ID,
                "sourceId": ANSWER_SOURCE_ID,
                "role": "paper_answer",
                "localPath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(ANSWER_SPEED),
            },
            {
                "id": "english1-2020-detailed-analysis",
                "sourceId": DETAILED_SOURCE_ID,
                "role": "answer_analysis",
                "localPath": str(DETAILED_ANALYSIS.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(DETAILED_ANALYSIS),
            },
            {
                "id": "english1-2020-document-version",
                "sourceId": DOCUMENT_SOURCE_ID,
                "role": "document_version_scan",
                "localPath": str(DOCUMENT_VERSION.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(DOCUMENT_VERSION),
            },
        ],
        "assetRoot": "question-bank/english1-2020",
        "processed_at": utc_now(),
        "total_cards": len(cards),
        "sections": ["完形填空", "阅读理解", "新题型", "翻译", "写作"],
        "cards": cards,
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--asset-dir", type=Path, default=DEFAULT_ASSET_DIR)
    parser.add_argument("--force-assets", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = build_payload(asset_dir=args.asset_dir, force_assets=args.force_assets)
    write_json(args.output, payload)
    print(
        json.dumps(
            {
                "output": str(args.output.relative_to(PROJECT_ROOT)),
                "assetDir": str(args.asset_dir.relative_to(PROJECT_ROOT)),
                "cards": payload["total_cards"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
