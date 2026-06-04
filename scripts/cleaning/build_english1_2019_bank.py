#!/usr/bin/env python3
"""
Build the 2019 English I public-course bank from local Baidu Netdisk PDFs.

The original paper PDF has no usable text layer, so this builder keeps rendered
original-paper pages as visual evidence and uses the cleaner answer-speed PDF
text layer for release question material and the official answer table. The
local answer-speed filename predates source-prefix normalization but matches the
manifest source size for src_e5870f592977fc243c04658d. Page 16 of the
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english1-2019.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "english1-2019"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "english1-2019-release-assets"

ORIGINAL_PAPER = RAW_DIR / "src_8de590b865dceaba46e1cf1f-2019年考研英语一真题.pdf"
ANSWER_SPEED = RAW_DIR / "2019年真题及答案速查.pdf"

ORIGINAL_SOURCE_ID = "src_8de590b865dceaba46e1cf1f"
ANSWER_SOURCE_ID = "src_e5870f592977fc243c04658d"
LOCAL_SOURCE_ID = "english1-2019-paper-answer"

CHOICE_ANSWERS = {
    1: "C",
    2: "C",
    3: "B",
    4: "D",
    5: "A",
    6: "B",
    7: "D",
    8: "C",
    9: "A",
    10: "D",
    11: "A",
    12: "B",
    13: "D",
    14: "C",
    15: "B",
    16: "D",
    17: "A",
    18: "A",
    19: "B",
    20: "C",
    21: "A",
    22: "D",
    23: "B",
    24: "C",
    25: "B",
    26: "D",
    27: "A",
    28: "A",
    29: "C",
    30: "B",
    31: "C",
    32: "D",
    33: "B",
    34: "A",
    35: "C",
    36: "C",
    37: "D",
    38: "C",
    39: "B",
    40: "A",
    41: "E",
    42: "D",
    43: "G",
    44: "B",
    45: "A",
}

TRANSLATION_ANSWERS = {
    46: "医学期刊中充斥着诸如此类的无稽之谈，一旦被电视台和外行新闻媒体报道，就会引发人们对健康问题的恐慌和短暂的饮食热潮。",
    47: "如今，任何申请某一研究职位的人必须发表的论文数量是10年前的两倍。",
    48: "人们已经做出努力来遏制这一趋势，比如，试着将某种质量和数量标准纳入对申请人论文的评估中。",
    49: "如果不是因为科学家们可以很容易在今后发表的论文中引用自己的论文，或给同行类似的好处就能让他们在今后发表的论文中也引用自己的论文，这一措施将是合理的。",
    50: "如果我们真的想确保科学是有意义且可复制的，就必须保证我们的制度能够激励这种科学的发展。",
}

TRANSLATION_SEGMENTS = {
    46: "There is a great deal of this kind of nonsense in the medical journals which, when taken up by broadcasters and the lay press, generates both health scares and shortlived dietary enthusiasms.",
    47: "nowadays anyone applying for a research post has to have published twice the number of papers that would have been required for the same post only 10 years ago.",
    48: "Attempts have been made to curb this tendency, for example, by trying to incorporate some measure of quality as well as quantity into the assessment of an applicant's papers,",
    49: "This would be reasonable if it were not for the fact that scientists can easily arrange to cite themselves in their future publications, or get associates to do so for them in return for similar favours.",
    50: "If we are serious about ensuring that our science is both meaningful and reproducible, we must ensure that our institutions encourage that kind of science.",
}

WRITING_PROMPTS = {
    51: (
        'Suppose you are working for the "Aiding Rural Primary Schools" project of '
        "your university. Write an email to answer the inquiry from an international "
        "student volunteer, specifying the details of the project. Use \"Li Ming\" instead."
    ),
    52: (
        "Write an essay of 160-200 words based on the picture below. In the picture, "
        "two hikers are on a mountain path; one says “别聊！休息一下再接着爬。” and the other "
        "says “累了，我不爬了。” Describe the picture briefly, interpret the implied meaning, "
        "and give your comments."
    ),
}

PART_B_OPTIONS = {
    "A": "These tools can help you win every argument by learning about the issues that divide people and working together with them.",
    "B": "Many discussions are not successful, so we need to evaluate opponents' arguments properly and apply the same standards to ourselves.",
    "C": "None of this will be easy, but you can start by formulating arguments, asking for reasons, and assessing strength impartially.",
    "D": "Carnegie would be right if arguments were fights, but thinking this way makes people avoid arguments about politics and religion.",
    "E": "Dale Carnegie's advice to avoid arguments depends on a mistaken view of arguments that misses the point of arguing.",
    "F": "Seeing arguments as fights or competitions undermines reason and encourages bad arguments or insults.",
    "G": "There is a better way to win arguments by exchanging reasonable reasons and understanding each other's positions.",
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
        "Section 口": "Section II",
        "Section HI": "Section III",
        "gMfUMe": "graduate",
        "consumers9": "consumers'",
        "students*": "students'",
        "colleges*": "colleges'",
        "Colleges5": "Colleges'",
        "Students5": "Students'",
        "states5": "states'",
        "uShort-termism": '"Short-termism',
        "ushort-termism": '"short-termism',
        "short-termism. \"": 'short-termism."',
        "M long-termismn": '"long-termism"',
        "Al": "AI",
        "Modem Prometheus": "Modern Prometheus",
        "Amazon, com": "Amazon.com",
        "individuaFs": "individual's",
        "shortlived": "short-lived",
        "ScienceM": 'Science"',
        "to be alignedM": '"to be aligned"',
        "retailers<": "retailers",
        "u Aiding Rural Primary Schoolsn": '"Aiding Rural Primary Schools"',
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
        "src": f"question-bank/english1-2019/{file_name}",
        "caption": caption,
        "alt": f"2019考研英语一{caption}",
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
        "writing": section_between(text, r"\n\s*Section\s+H?I+\s+Writing", r"2019年考研英语"),
    }
    missing = [key for key, value in passages.items() if not value]
    if missing:
        raise RuntimeError(f"Missing PDF text passage groups: {', '.join(missing)}")

    expected_markers = {
        "cloze": ["GPS systems", "follow the land"],
        "text1": ["clawback", "Andrew Haldane"],
        "text2": ["Grade inflation", "grade forgiveness"],
        "text3": ["Frankenstein", "artificial intelligence"],
        "text4": ["sales tax", "Supreme Court"],
        "part-b": ["Dale Carnegie", "How to Win Friends"],
        "part-c": ["medical journals", "Natural Selection of Bad Science"],
        "writing": ["Aiding Rural Primary Schools", "picture below"],
    }
    for key, markers in expected_markers.items():
        if not all(marker.lower() in passages[key].lower() for marker in markers):
            raise RuntimeError(f"2019 {key} text layer did not contain expected markers: {markers}")

    for forbidden in ["用“闪过”", "故事情节纯属虚构", "Museums", "手机阅读目的调查"]:
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
        return "答案来自本地百度网盘 2019 年英语一真题答案速查表，并用原卷页图复核题面。"
    if number <= 50:
        return "参考译文来自本地百度网盘 2019 年英语一真题答案速查表。"
    return "写作题按原卷官方任务训练；答案证据覆盖官方题干和作答要求，不声明唯一范文答案。"


def source_evidence(question_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": LOCAL_SOURCE_ID,
        "sourceId": ANSWER_SOURCE_ID,
        "originalPaperSourceId": ORIGINAL_SOURCE_ID,
        "sourceType": "official_paper",
        "sourceFilePath": str(ANSWER_SPEED.relative_to(PROJECT_ROOT)),
        "originalPaperFilePath": str(ORIGINAL_PAPER.relative_to(PROJECT_ROOT)),
        "fileSha256": sha256_file(ANSWER_SPEED),
        "originalPaperSha256": sha256_file(ORIGINAL_PAPER),
        "status": "matched",
        "method": "local_answer_speed_pdf_text_layer_with_original_paper_page_image",
        "questionTextHash": question_hash,
        "verifiedBy": "build_english1_2019_bank",
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
        "verifiedBy": "build_english1_2019_bank",
        "note": "Matched against local Baidu Netdisk 2019 English I answer-speed PDF; page 16 promotional material is excluded from released evidence.",
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
        "id": f"english1-2019-{number:03d}",
        "number": number,
        "paperId": "english1-2019",
        "paperName": "2019考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2019",
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
        "tags": ["english1", "2019真题", section_for(number)],
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

    expected_answers = {1: "C", 21: "A", 26: "D", 30: "B", 41: "E", 45: "A"}
    for number, answer in expected_answers.items():
        if cards[number - 1].get("answer") != answer:
            issues.append(f"card {number}: answer={cards[number - 1].get('answer')} expected {answer}")
    if "grade forgiveness" not in cards[25].get("passage", "").lower():
        issues.append("Text 2 evidence mismatch for question 26")
    if "frankenstein" not in cards[30].get("passage", "").lower():
        issues.append("Text 3 evidence mismatch for question 31")
    if "dale carnegie" not in cards[40].get("passage", "").lower() or cards[42].get("answer") != "G":
        issues.append("Part B evidence mismatch for question 43")
    if "there is a great deal of this kind of nonsense" not in cards[45].get("targetSegment", "").lower():
        issues.append("Part C evidence mismatch for question 46")
    if "Aiding Rural Primary Schools" not in cards[50].get("question", ""):
        issues.append("writing Part A prompt missing Aiding Rural Primary Schools marker")
    if "picture below" not in cards[51].get("question", ""):
        issues.append("writing Part B prompt missing official picture marker")
    payload_text = json.dumps(cards, ensure_ascii=False)
    for forbidden in ["用“闪过”", "故事情节纯属虚构", "Museums", "手机阅读目的调查", "failure"]:
        if forbidden in payload_text:
            issues.append(f"unexpected source bleed detected: {forbidden}")
    if issues:
        raise ValueError("english1-2019 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(ORIGINAL_PAPER, "paper-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=15)
    render_pdf_assets(ANSWER_SPEED, "answer-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=15)
    passages = build_passages(asset_dir)
    cards = [build_card(number, passages) for number in range(1, 53)]
    validate_cards(cards)

    return {
        "id": "english1-2019",
        "source": LOCAL_SOURCE_ID,
        "paperId": "english1-2019",
        "paperName": "2019考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2019",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_answer_speed_text_layer_with_original_paper_page_image_v1",
        "sourceFiles": [
            {
                "id": "english1-2019-original-paper",
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
                "note": "Text-layer source for released material and official answer table; page 16 promotional material is excluded. Local filename lacks the source-id prefix but matches the manifest file size for this source.",
            },
        ],
        "assetRoot": "question-bank/english1-2019",
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
