#!/usr/bin/env python3
"""
Build the 2018 English I public-course bank from local Baidu Netdisk PDFs.

The original paper PDF has no usable text layer, so this builder keeps rendered
original-paper pages as visual evidence and uses the cleaner answer-speed PDF
text layer for release question material and the official answer table. The
document-version PDF is retained as a supporting scan source. Page 16 of the
answer-speed PDF is promotional material and is intentionally not rendered or
referenced by the published bank.
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english1-2018.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "english1-2018"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "english1-2018-release-assets"

ORIGINAL_PAPER = RAW_DIR / "src_65e38afdd4cb892710781e4f-2018年考研英语一真题.pdf"
ANSWER_SPEED = RAW_DIR / "src_c2b2d9106a7394b9ebf94bb2-2018年真题及答案速查.pdf"
DOCUMENT_VERSION = RAW_DIR / "src_7fc9c83e38b149770e57c209-2018考研英语一真题及解析.pdf"

ORIGINAL_SOURCE_ID = "src_65e38afdd4cb892710781e4f"
ANSWER_SOURCE_ID = "src_c2b2d9106a7394b9ebf94bb2"
DOCUMENT_SOURCE_ID = "src_7fc9c83e38b149770e57c209"
LOCAL_SOURCE_ID = "english1-2018-paper-answer"

CHOICE_ANSWERS = {
    1: "C",
    2: "A",
    3: "D",
    4: "B",
    5: "D",
    6: "B",
    7: "C",
    8: "D",
    9: "B",
    10: "A",
    11: "B",
    12: "B",
    13: "A",
    14: "C",
    15: "D",
    16: "A",
    17: "C",
    18: "B",
    19: "A",
    20: "C",
    21: "D",
    22: "C",
    23: "A",
    24: "D",
    25: "B",
    26: "D",
    27: "A",
    28: "B",
    29: "C",
    30: "A",
    31: "B",
    32: "C",
    33: "D",
    34: "D",
    35: "B",
    36: "B",
    37: "A",
    38: "A",
    39: "C",
    40: "D",
    41: "E",
    42: "G",
    43: "A",
    44: "B",
    45: "D",
}

TRANSLATION_ANSWERS = {
    46: "他出生时，欧洲的宗教戏剧正在消亡，同时在古典悲剧和喜剧的推动下，新戏剧形式应运而生。",
    47: "每位在文法学校就读的少年不会不知道戏剧这种文学形式曾为希腊和罗马带来荣耀，也可能会为英格兰带来荣耀。",
    48: "然而，专业剧团在它们固定的剧院中蓬勃发展，大学里拥有文学抱负的人士迅速投奔这些剧院，将其视为一种谋生的手段。",
    49: "一种本土文学戏剧已经诞生，而且已经与公共剧院结成联盟，至少这种戏剧的一些伟大传统已经开始萌芽。",
    50: "为了充分了解当时的戏剧活动是何等繁荣，我们还必须牢记：大量戏剧作品已经失传，可能没有哪位著名作家的全部作品会被保留至今。",
}

TRANSLATION_SEGMENTS = {
    46: "By the date of his birth Europe was witnessing the passing of the religious drama, and the creation of new forms under the incentive of classical tragedy and comedy.",
    47: "No boy who went to a grammar school could be ignorant that the drama was a form of literature which gave glory to Greece and Rome and might yet bring honor to England.",
    48: "But the professional companies prospered in their permanent theaters, and university men with literary ambitions were quick to turn to these theaters as offering a means of livelihood.",
    49: "A native literary drama had been created, its alliance with the public playhouses established, and at least some of its great traditions had been begun.",
    50: "To realize how great was the dramatic activity, we must remember further that hosts of plays have been lost, and that probably there is no author of note whose entire work has survived.",
}

WRITING_PROMPTS = {
    51: (
        "Write an email to all international experts on campus, inviting them to "
        "attend the graduation ceremony. Include the time, place and other relevant "
        'information about the ceremony. Use "Li Ming" instead.'
    ),
    52: (
        "Write an essay of 160-200 words based on the picture themed \"选课进行时\". "
        "Describe the picture briefly, interpret the meaning, and give your comments."
    ),
}

PART_B_OPTIONS = {
    "A": "Congress selected Alfred Mullett's French Second Empire style design for a new building to house the State, War, and Navy Departments.",
    "B": "The State Department's south wing and the Navy Department's east wing were occupied with elaborate interior decoration.",
    "C": "The State, War, and Navy Building housed the three departments central to foreign policy as the United States emerged as an international power.",
    "D": "Many celebrated national figures and historic events have been associated with the EEOB's granite walls.",
    "E": "The Eisenhower Executive Office Building holds a unique place in national history and architectural heritage.",
    "F": "Construction took 17 years and produced the largest office building in Washington at the time.",
    "G": "The history of the EEOB began before its foundations, with earlier executive offices, fires, overcrowding, and Treasury Building expansion.",
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
    value = str(text or "")
    replacements = {
        "\u3000": " ",
        "\u00ad": "",
        "word( s)": "word(s)",
        "Section U": "Section II",
        "Section HI": "Section III",
        "Section m": "Section III",
        "President Trump5s": "President Trump's",
        "author5s": "author's",
        "author5s view": "author's view",
        "Optimists5": "Optimists'",
        "patients5": "patients'",
        "readers5": "readers'",
        "journalists5": "journalists'",
        "author9s": "author's",
        "St. PauFs": "St. Paul's",
        "WiJJiam": "William",
        "ia their": "in their",
        "remembeq": "remember",
        "ne哪-filtering": "news-filtering",
        "tecb giants": "tech giants",
        "joumalists": "journalists",
        "u distributed trust\"": '"distributed trust"',
        "udistributed trustn": '"distributed trust"',
        "public stage. Plays": "public stage. Plays",
    }
    for original, replacement in replacements.items():
        value = value.replace(original, replacement)
    value = re.sub(r"\s+", " ", value).strip()
    return value


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
        "src": f"question-bank/english1-2018/{file_name}",
        "caption": caption,
        "alt": f"2018考研英语一{caption}",
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
        "writing": section_between(text, r"\n\s*Section\s+H?I+\s+Writing", r"2018年考研英语"),
    }
    missing = [key for key, value in passages.items() if not value]
    if missing:
        raise RuntimeError(f"Missing PDF text passage groups: {', '.join(missing)}")

    expected_markers = {
        "cloze": ["Trust is a tricky business", "oxytocin"],
        "text1": ["automation", "middle-class workers"],
        "text2": ["Harvard University", "Twitter"],
        "text3": ["DeepMind", "NHS"],
        "text4": ["Postal Service", "red ink"],
        "part-b": ["Eisenhower Executive Office Building", "French Second Empire"],
        "part-c": ["Shakespeare", "religious drama"],
        "writing": ["graduation ceremony", "选课进行时"],
    }
    for key, markers in expected_markers.items():
        if not all(marker.lower() in passages[key].lower() for marker in markers):
            raise RuntimeError(f"2018 {key} text layer did not contain expected markers: {markers}")

    for forbidden in ["考研词汇用闪过", "手机阅读目的调查"]:
        if forbidden in json.dumps(passages, ensure_ascii=False):
            raise RuntimeError(f"Promotional or cross-source text leaked into passages: {forbidden}")
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
        return "答案来自本地百度网盘 2018 年英语一真题答案速查表，并用原卷页图复核题面。"
    if number <= 50:
        return "参考译文来自本地百度网盘 2018 年英语一真题答案速查表。"
    return "写作题按原卷官方任务训练；答案证据覆盖官方题干和作答要求，不声明唯一范文答案。"


def source_evidence(question_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": LOCAL_SOURCE_ID,
        "sourceId": ANSWER_SOURCE_ID,
        "originalPaperSourceId": ORIGINAL_SOURCE_ID,
        "supportingDocumentSourceId": DOCUMENT_SOURCE_ID,
        "sourceType": "official_paper",
        "sourceFilePath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
        "originalPaperFilePath": str(ORIGINAL_PAPER.relative_to(PROJECT_ROOT)),
        "fileSha256": sha256_file(ANSWER_SPEED),
        "originalPaperSha256": sha256_file(ORIGINAL_PAPER),
        "status": "matched",
        "method": "local_answer_speed_pdf_text_layer_with_original_paper_page_image",
        "questionTextHash": question_hash,
        "verifiedBy": "build_english1_2018_bank",
    }


def answer_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    role = "official_writing_prompt" if number >= 51 else "official_answer_key"
    return {
        "status": "matched",
        "evidenceRole": role,
        "sourceId": ANSWER_SOURCE_ID,
        "sourceFilePath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
        "answerTextHash": answer_hash,
        "method": "local_answer_speed_table_match",
        "verifiedBy": "build_english1_2018_bank",
        "note": "Matched against local Baidu Netdisk 2018 English I answer-speed PDF; page 16 promotional material is excluded from released evidence.",
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
        "id": f"english1-2018-{number:03d}",
        "number": number,
        "paperId": "english1-2018",
        "paperName": "2018考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2018",
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
        "tags": ["english1", "2018真题", section_for(number)],
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

    expected_answers = {1: "C", 21: "D", 26: "D", 30: "A", 41: "E", 45: "D"}
    for number, answer in expected_answers.items():
        if cards[number - 1].get("answer") != answer:
            issues.append(f"card {number}: answer={cards[number - 1].get('answer')} expected {answer}")
    if "A new survey by Harvard University" in str(cards[25].get("answer")):
        issues.append("question 26 answer is polluted by passage text")
    if "Shakespeare" not in cards[45].get("passage", ""):
        issues.append("Part C passage missing Shakespeare marker")
    if "By the date of his birth Europe was witnessing the passing of the religious drama" not in cards[45].get(
        "targetSegment", ""
    ):
        issues.append("Part C evidence mismatch for question 46")
    if "graduation ceremony" not in cards[50].get("question", ""):
        issues.append("writing Part A prompt missing graduation ceremony marker")
    if "选课进行时" not in cards[51].get("question", ""):
        issues.append("writing Part B prompt missing source picture label")
    payload_text = json.dumps(cards, ensure_ascii=False)
    for forbidden in ["手机阅读目的调查", "failure", "考研词汇用闪过"]:
        if forbidden in payload_text:
            issues.append(f"unexpected source bleed detected: {forbidden}")
    if issues:
        raise ValueError("english1-2018 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(ORIGINAL_PAPER, "paper-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=15)
    render_pdf_assets(ANSWER_SPEED, "answer-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=15)
    passages = build_passages(asset_dir)
    cards = [build_card(number, passages) for number in range(1, 53)]
    validate_cards(cards)

    return {
        "id": "english1-2018",
        "source": LOCAL_SOURCE_ID,
        "paperId": "english1-2018",
        "paperName": "2018考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2018",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_answer_speed_text_layer_with_original_paper_page_image_v1",
        "sourceFiles": [
            {
                "id": "english1-2018-original-paper",
                "sourceId": ORIGINAL_SOURCE_ID,
                "role": "paper_original_audit",
                "localPath": str(ORIGINAL_PAPER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(ORIGINAL_PAPER),
                "note": "Original paper PDF retained for visual audit; it has no usable text layer.",
            },
            {
                "id": LOCAL_SOURCE_ID,
                "sourceId": ANSWER_SOURCE_ID,
                "role": "paper_answer",
                "localPath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(ANSWER_SPEED),
                "note": "Text-layer source for released material and official answer table; page 16 promotional material is excluded.",
            },
            {
                "id": "english1-2018-document-version",
                "sourceId": DOCUMENT_SOURCE_ID,
                "role": "document_version_scan",
                "localPath": str(DOCUMENT_VERSION.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(DOCUMENT_VERSION),
            },
        ],
        "assetRoot": "question-bank/english1-2018",
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
