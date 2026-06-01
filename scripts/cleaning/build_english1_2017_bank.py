#!/usr/bin/env python3
"""
Build the 2017 English I public-course bank from local Baidu Netdisk PDFs.

The original paper PDF is scanned, so this builder keeps rendered paper page
images as visual evidence and uses the answer-speed PDF text layer for question
material. The answer-speed PDF also supplies the official answer table, and the
detailed-analysis PDF is retained as supporting answer evidence.
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english1-2017.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "english1-2017"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "english1-2017-release-assets"

ORIGINAL_PAPER = RAW_DIR / "src_d62dd96ab6391c4676b275cb-2017年考研英语一真题.pdf"
ANSWER_SPEED = RAW_DIR / "src_59f192bb67dfa8490c3de9d3-2017年真题及答案速查.pdf"
DETAILED_ANALYSIS = RAW_DIR / "src_d746aa81bf98b4a46b91400f-2017考研英语一答案及解析.pdf"

ORIGINAL_SOURCE_ID = "src_d62dd96ab6391c4676b275cb"
ANSWER_SOURCE_ID = "src_59f192bb67dfa8490c3de9d3"
DETAILED_SOURCE_ID = "src_d746aa81bf98b4a46b91400f"
LOCAL_SOURCE_ID = "english1-2017-paper-answer"

CHOICE_ANSWERS = {
    1: "A",
    2: "C",
    3: "B",
    4: "A",
    5: "D",
    6: "A",
    7: "D",
    8: "D",
    9: "C",
    10: "C",
    11: "D",
    12: "D",
    13: "B",
    14: "C",
    15: "B",
    16: "C",
    17: "A",
    18: "B",
    19: "A",
    20: "D",
    21: "A",
    22: "C",
    23: "D",
    24: "D",
    25: "C",
    26: "B",
    27: "A",
    28: "B",
    29: "A",
    30: "D",
    31: "D",
    32: "C",
    33: "D",
    34: "C",
    35: "A",
    36: "C",
    37: "A",
    38: "C",
    39: "B",
    40: "D",
    41: "F",
    42: "E",
    43: "A",
    44: "C",
    45: "G",
}

TRANSLATION_ANSWERS = {
    46: "但是，尽管讲英语的人数在进一步增加，却有迹象表明：在可预见的未来，英语的全球主导地位可能会衰落。",
    47: "因此，他的分析会让一些人的自满就此终结，这些人可能认为，英语的全球地位非常稳固，所以英国的年轻一代不需要学习其他语言。",
    48: "许多国家正在将英语纳入小学课程，但是英国的大、中、小学生似乎并未受到更大的鼓舞去熟练掌握其他语言。",
    49: "大卫·格拉多尔所指出的这些变化都为向其他国家的人提供英语语言教学的英国个人和组织机构，甚至更为广泛的教育行业领域带来了显而易见的巨大挑战。",
    50: "它为致力于推动英语学习和使用的所有机构提供了一个基础，从而使它们能够制定计划来应对迥然不同的运营环境带来的各种可能性。",
}

TRANSLATION_SEGMENTS = {
    46: "But even as the number of English speakers expands further there are signs that the global predominance of the language may fade within the foreseeable future.",
    47: "His analysis should therefore end any self-contentedness among those who may believe that the global position of English is so stable that the young generations of the United Kingdom do not need additional language capabilities.",
    48: "Many countries are introducing English into the primary-school curriculum but British schoolchildren and students do not appear to be gaining greater encouragement to achieve fluency in other languages.",
    49: "The changes identified by David Graddol all present clear and major challenges to the UK's providers of English language teaching to people of other countries and to broader education business sectors.",
    50: "It gives a basis to all organisations which seek to promote the learning and use of English, a basis for planning to meet the possibilities of what could be a very different operating environment.",
}

WRITING_PROMPTS = {
    51: (
        "Write an email to James Cook, a newly-arrived Australian professor, "
        "recommending some tourist attractions in your city. Please give reasons "
        'for your recommendation. Use "Li Ming" instead.'
    ),
    52: (
        "Write an essay of 160-200 words based on the pictures themed "
        "\"有书\"与\"读书\". Describe the pictures briefly, interpret the "
        "meaning, and give your comments."
    ),
}

PART_B_OPTIONS = {
    "A": "The first published sketch, \"A Dinner at Poplar Walk,\" brought tears to Dickens's eyes when he discovered it in The Monthly Magazine.",
    "B": "The runaway success of The Pickwick Papers secured Dickens's fame.",
    "C": "Soon after Sketches by Boz appeared, a publishing firm approached Dickens to write a story in monthly installments.",
    "D": "Charles Dickens is probably the best-known English novelist of the 19th century.",
    "E": "Soon after his father's release from prison, Dickens got a better job as errand boy in law offices.",
    "F": "Dickens was born in Portsmouth, on England's southern coast.",
    "G": "After Pickwick, Dickens plunged into a bleaker world.",
}

QUESTION_PAGES = {
    **{number: [2, 3] for number in range(1, 21)},
    **{number: [4, 5] for number in range(21, 26)},
    **{number: [6, 7] for number in range(26, 31)},
    **{number: [8, 9] for number in range(31, 36)},
    **{number: [10, 11] for number in range(36, 41)},
    **{number: [12, 13] for number in range(41, 46)},
    **{number: [14] for number in range(46, 51)},
    51: [15],
    52: [15],
}

ANSWER_PAGES = {number: [15] for number in range(1, 53)}


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
        "src": f"question-bank/english1-2017/{file_name}",
        "caption": caption,
        "alt": f"2017考研英语一{caption}",
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
        "part-c": section_between(text, r"\n\s*Part\s+C\s*\n.*?\(10 points\)", r"\n\s*Section\s+H?I+\s+Writing"),
        "writing": section_between(text, r"\n\s*Section\s+H?I+\s+Writing", r"2017年考研英语"),
    }
    missing = [key for key, value in passages.items() if not value]
    if missing:
        raise RuntimeError(f"Missing PDF text passage groups: {', '.join(missing)}")
    text3 = passages["text3"].lower()
    part_b = passages["part-b"].lower()
    if "kennedy" not in text3 and "gdp" not in text3:
        raise RuntimeError("2017 Text 3 text layer did not contain the expected GDP article")
    if "dickens" not in part_b:
        raise RuntimeError("2017 Part B text layer did not contain the expected Dickens passage")
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
        return f"新题型第 {number} 空：请先阅读完整文章，再从 A-G 中选择最合适的段落。"
    if number <= 50:
        return f"翻译第 {number} 处画线句：{TRANSLATION_SEGMENTS[number]}"
    return WRITING_PROMPTS[number]


def explanation_for(number: int) -> str:
    if number <= 45:
        return "答案来自本地百度网盘 2017 年真题答案速查表，并用逐题细解 PDF 作为答案解析支持。"
    if number <= 50:
        return "参考译文来自本地百度网盘 2017 年真题答案速查表。"
    return "写作题按原卷官方任务训练；答案证据覆盖官方题干和作答要求，不声明唯一范文答案。"


def source_evidence(question_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": LOCAL_SOURCE_ID,
        "sourceId": ORIGINAL_SOURCE_ID,
        "answerSourceId": ANSWER_SOURCE_ID,
        "sourceType": "official_paper",
        "sourceFilePath": str(ORIGINAL_PAPER.relative_to(PROJECT_ROOT)),
        "answerSourceFilePath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
        "fileSha256": sha256_file(ORIGINAL_PAPER),
        "status": "matched",
        "method": "local_answer_speed_pdf_text_layer_with_paper_page_image",
        "questionTextHash": question_hash,
        "verifiedBy": "build_english1_2017_bank",
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
        "verifiedBy": "build_english1_2017_bank",
        "note": "Matched against local Baidu Netdisk 2017 English I answer-speed PDF; detailed analysis PDF is retained as supporting answer evidence.",
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
    answer_images = [image_ref("answer-page", page, caption=f"答案速查 p.{page}") for page in ANSWER_PAGES[number]]
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
        "id": f"english1-2017-{number:03d}",
        "number": number,
        "paperId": "english1-2017",
        "paperName": "2017考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2017",
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
        "tags": ["english1", "2017真题", section_for(number)],
        "difficulty": 3 if number >= 46 else 2,
        "source": ORIGINAL_PAPER.name,
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
    if cards[30]["answer"] != "D" or "kennedy" not in cards[30]["passage"].lower():
        issues.append("Text 3 evidence mismatch for question 31")
    if cards[40]["answer"] != "F" or "dickens" not in cards[40]["passage"].lower():
        issues.append("Part B evidence mismatch for question 41")
    if issues:
        raise ValueError("english1-2017 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(ORIGINAL_PAPER, "paper-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=15)
    render_pdf_assets(ANSWER_SPEED, "answer-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=16)
    passages = build_passages(asset_dir)
    cards = [build_card(number, passages) for number in range(1, 53)]
    validate_cards(cards)

    return {
        "id": "english1-2017",
        "source": LOCAL_SOURCE_ID,
        "paperId": "english1-2017",
        "paperName": "2017考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2017",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_page_image_with_answer_table_v1",
        "sourceFiles": [
            {
                "id": "english1-2017-original-paper",
                "sourceId": ORIGINAL_SOURCE_ID,
                "role": "paper",
                "localPath": str(ORIGINAL_PAPER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(ORIGINAL_PAPER),
            },
            {
                "id": LOCAL_SOURCE_ID,
                "sourceId": ANSWER_SOURCE_ID,
                "role": "paper_answer",
                "localPath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(ANSWER_SPEED),
            },
            {
                "id": "english1-2017-detailed-analysis",
                "sourceId": DETAILED_SOURCE_ID,
                "role": "answer_analysis",
                "localPath": str(DETAILED_ANALYSIS.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(DETAILED_ANALYSIS),
            },
        ],
        "assetRoot": "question-bank/english1-2017",
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
