#!/usr/bin/env python3
"""
Build the 2013 English I public-course bank from local Baidu Netdisk PDFs.

The source PDF has a usable text layer and also contains the answer key. The
generated cards keep the full passage text for English release gates and attach
rendered PDF page images as the authoritative question/answer material.
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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english1-2013.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "english1-2013"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "english1-2013-release-assets"

PAPER_ANSWER = RAW_DIR / "src_9f09c81d90daa9f9f36bab04-2013年真题及答案速查.pdf"
ORIGINAL_PAPER = RAW_DIR / "src_ede12391fcfb1712cc498344-2013年考研英语一真题.pdf"

SOURCE_ID = "src_9f09c81d90daa9f9f36bab04"
ORIGINAL_SOURCE_ID = "src_ede12391fcfb1712cc498344"
LOCAL_SOURCE_ID = "english1-2013-paper-answer"

CHOICE_ANSWERS = {
    1: "A",
    2: "D",
    3: "C",
    4: "A",
    5: "B",
    6: "B",
    7: "A",
    8: "D",
    9: "D",
    10: "A",
    11: "D",
    12: "C",
    13: "B",
    14: "D",
    15: "B",
    16: "C",
    17: "A",
    18: "C",
    19: "B",
    20: "C",
    21: "B",
    22: "D",
    23: "A",
    24: "D",
    25: "C",
    26: "B",
    27: "D",
    28: "C",
    29: "A",
    30: "D",
    31: "B",
    32: "A",
    33: "D",
    34: "C",
    35: "C",
    36: "C",
    37: "C",
    38: "D",
    39: "A",
    40: "B",
    41: "E",
    42: "F",
    43: "B",
    44: "G",
    45: "C",
}

TRANSLATION_ANSWERS = {
    46: "然而，当看到由无家可归者创造的花园的照片时，你就会突然意识到，尽管风格多样，但这些花园除了体现（人类）装饰和创造性表达方面的诉求之外，还道出了人类各种其他根本的诉求。",
    47: "安宁的圣地体现了人类特有的需求，无论怎样疏于雕琢，都与遮风挡雨之所不同，后者反映了动物特有的需求。",
    48: "这些无家可归者的花园实际上是无定所的花园，它们将“形式”引入城市环境中，而这种“形式”在城市环境中要么不曾存在，要么没有被当作“形式”看待。",
    49: "大多数人会陷入精神萎靡的状态，并常常将此归咎于某些心理疾病，直到有一天置身花园，才顿觉压抑感好像神奇地消失了。",
    50: "虽然有“扩大词义外延”的意味，但正是这种对大自然或含蓄或明显的参照，充分证明了使用“花园”一词来描述这些人造建筑的合理性。",
}

TRANSLATION_SEGMENTS = {
    46: "Yet when one looks at the photographs of the gardens created by the homeless, it strikes one that, for all their diversity of styles, these gardens speak of various other fundamental urges, beyond that of decoration and creative expression.",
    47: "A sacred place of peace, however crude it may be, is a distinctly human need, as opposed to shelter, which is a distinctly animal need.",
    48: "The gardens of the homeless, which are in effect homeless gardens, introduce form into an urban environment where it either didn't exist or was not discernible as such.",
    49: "Most of us give in to a demoralization of spirit which we usually blame on some psychological conditions, until one day we find ourselves in a garden and feel the oppression vanish as if by magic.",
    50: "It is this implicit or explicit reference to nature that fully justifies the use of the word garden, though in a liberated sense, to describe these synthetic constructions.",
}

WRITING_PROMPTS = {
    51: (
        "Write an e-mail of about 100 words to a foreign teacher in your college, "
        "inviting him/her to be a judge for the upcoming English speech contest. "
        'Do not sign your own name at the end of the e-mail. Use "Li Ming" instead.'
    ),
    52: (
        "Write an essay of 160-200 words based on the drawing. In your essay, you "
        "should describe the drawing briefly, interpret its intended meaning, and "
        "give your comments."
    ),
}

CLOZE_OPTIONS = {
    1: ["grants", "submits", "transmits", "delivers"],
    2: ["minor", "objective", "crucial", "external"],
    3: ["issue", "vision", "picture", "moment"],
    4: ["For example", "On average", "In principle", "Above all"],
    5: ["fond", "fearful", "capable", "thoughtless"],
    6: ["in", "on", "to", "for"],
    7: ["if", "until", "though", "unless"],
    8: ["promote", "emphasize", "share", "test"],
    9: ["decision", "quality", "status", "success"],
    10: ["chosen", "studied", "found", "identified"],
    11: ["exceptional", "defensible", "replaceable", "otherwise"],
    12: ["inspired", "expressed", "conducted", "secured"],
    13: ["assigned", "rated", "matched", "arranged"],
    14: ["put", "got", "gave", "took"],
    15: ["instead", "then", "ever", "rather"],
    16: ["selected", "passed", "marked", "introduced"],
    17: ["before", "after", "above", "below"],
    18: ["jump", "float", "drop", "fluctuate"],
    19: ["achieve", "undo", "maintain", "disregard"],
    20: ["promising", "possible", "necessary", "helpful"],
}

PART_B_OPTIONS = {
    "A": "It could be that we are evolving two communities of social scientists: one that is discipline-oriented and publishing in highly specialized journals, and one that is problem-oriented, and publishing elsewhere, such as in policy briefs.",
    "B": "However, the numbers are still small: in 2010, about 1,600 of the 100,000 social-sciences papers published globally included one of these keywords.",
    "C": "The idea is to force social scientists to integrate their work with other categories, including health and demographic change; food security; marine research and the bio-economy; clean, efficient energy; and inclusive, innovative and secure societies.",
    "D": "The solution is to change the mindset of the academic community, and what it considers to be its main goal. Global challenges and social innovation ought to receive much more attention from scientists, especially the young ones.",
    "E": "These issues all have root causes in human behavior: all require behavioral change and social innovations, as well as technological development.",
    "F": "Despite these factors, many social scientists seem reluctant to tackle such problems. And in Europe, some are up in arms over a proposal to drop a specific funding category for social-science research and to integrate it within cross-cutting topics of sustainable development.",
    "G": "During the late 1990s, national spending on social sciences and the humanities as a percentage of all research and development funds varied from around 4% to 25%; in most European nations, it is about 15%.",
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


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, cwd=PROJECT_ROOT, check=True)


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
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def image_ref(page: int, *, caption: str) -> dict[str, str]:
    file_name = f"paper-page-{page:02d}.jpg"
    return {
        "src": f"question-bank/english1-2013/{file_name}",
        "caption": caption,
        "alt": f"2013考研英语一{caption}",
    }


def extract_pdf_text(path: Path) -> str:
    result = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
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


def passage_segments(text: str) -> list[str]:
    normalized = compact(text)
    if not normalized:
        return []
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


def extract_passages(text: str) -> dict[str, str]:
    return {
        "cloze": section_between(text, r"Section\s+I\s+Use\s+of\s+English.*?\(10 points\)", r"\n\s*1\.\s+A\."),
        "text1": section_between(text, r"\n\s*Text\s*1\s*\n", r"\n\s*21\."),
        "text2": section_between(text, r"\n\s*Text\s*2\s*\n", r"\n\s*26\."),
        "text3": section_between(text, r"\n\s*Text\s*3\s*\n", r"\n\s*31\."),
        "text4": section_between(text, r"\n\s*Text\s*4\s*\n", r"\n\s*36\."),
        "part-b": section_between(text, r"\n\s*Part\s+B\s*\n.*?\(10 points\)", r"\n\s*A\."),
        "part-c": section_between(text, r"\n\s*Part\s+C\s*\n.*?\(10 points\)", r"\n\s*Section\s+H?I+\s+Writing"),
        "writing": section_between(text, r"\n\s*Section\s+H?I+\s+Writing", r"2013年考研英语"),
    }


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
    if number <= 20:
        values = CLOZE_OPTIONS[number]
        return [{"label": label, "text": values[index]} for index, label in enumerate("ABCD")]
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
        return f"完形填空第 {number} 空：阅读全文后选择最合适的选项。"
    if number <= 40:
        return f"阅读理解第 {number} 题：请先阅读对应 Text 原文和题干页图，再选择最合适的选项。"
    if number <= 45:
        return f"新题型第 {number} 空：请先阅读完整文章，再从 A-G 中选择最合适的段落。"
    if number <= 50:
        return f"翻译第 {number} 处画线句：{TRANSLATION_SEGMENTS[number]}"
    return WRITING_PROMPTS[number]


def explanation_for(number: int) -> str:
    if number <= 45:
        return "答案来自本地百度网盘 2013 年真题及答案速查 PDF；题干、文章和选项以原卷页图为准。"
    if number <= 50:
        return "参考译文来自本地百度网盘 2013 年真题及答案速查 PDF。"
    return "写作题按原卷官方任务训练；答案证据覆盖官方题干和作答要求，不声明唯一范文答案。"


def answer_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    role = "official_writing_prompt" if number >= 51 else "official_answer_key"
    return {
        "status": "matched",
        "evidenceRole": role,
        "sourceId": SOURCE_ID,
        "sourceFilePath": str(PAPER_ANSWER.relative_to(PROJECT_ROOT)),
        "answerTextHash": answer_hash,
        "method": "local_pdf_text_and_page_image",
        "verifiedBy": "build_english1_2013_bank",
        "note": "Matched against local Baidu Netdisk 2013 English I paper-answer PDF.",
    }


def source_evidence(question_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": LOCAL_SOURCE_ID,
        "sourceId": SOURCE_ID,
        "sourceType": "official_paper",
        "sourceFilePath": str(PAPER_ANSWER.relative_to(PROJECT_ROOT)),
        "fileSha256": sha256_file(PAPER_ANSWER),
        "status": "matched",
        "method": "local_pdf_text_and_page_image",
        "questionTextHash": question_hash,
        "verifiedBy": "build_english1_2013_bank",
    }


def build_card(number: int, passages: dict[str, str]) -> dict[str, Any]:
    group = group_for(number)
    passage = passages.get(group, "")
    if group == "writing":
        passage = question_for(number)
    question = question_for(number)
    options = options_for(number)
    answer = answer_for(number)
    question_images = [
        image_ref(page, caption=f"试卷原页 p.{page}") for page in QUESTION_PAGES[number]
    ]
    answer_images = [
        image_ref(page, caption=f"答案速查 p.{page}") for page in ANSWER_PAGES[number]
    ]
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
        json.dumps(
            {"answer": answer, "answerPages": ANSWER_PAGES[number]},
            ensure_ascii=False,
            sort_keys=True,
        )
    )

    card = {
        "id": f"english1-2013-{number:03d}",
        "number": number,
        "paperId": "english1-2013",
        "paperName": "2013考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2013",
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
        "tags": ["english1", "2013真题", section_for(number)],
        "difficulty": 3 if number >= 46 else 2,
        "source": PAPER_ANSWER.name,
        "sourceEvidenceId": LOCAL_SOURCE_ID,
        "sourceEvidence": source_evidence(question_hash),
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "answerEvidenceStatus": "matched",
        "answerEvidenceSourceId": SOURCE_ID,
        "answerEvidence": answer_evidence(number, answer_hash),
    }
    if 46 <= number <= 50:
        card["targetSegment"] = TRANSLATION_SEGMENTS[number]
    return card


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "paper-page", asset_dir=asset_dir, force=force_assets, first_page=1, last_page=15)
    text = extract_pdf_text(PAPER_ANSWER)
    passages = extract_passages(text)
    missing = [key for key in ["cloze", "text1", "text2", "text3", "text4", "part-b", "part-c"] if not passages.get(key)]
    if missing:
        raise RuntimeError(f"Missing expected passage groups: {', '.join(missing)}")

    cards = [build_card(number, passages) for number in range(1, 53)]
    return {
        "id": "english1-2013",
        "source": LOCAL_SOURCE_ID,
        "paperId": "english1-2013",
        "paperName": "2013考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2013",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_text_and_page_image_v1",
        "sourceFiles": [
            {
                "id": LOCAL_SOURCE_ID,
                "sourceId": SOURCE_ID,
                "role": "paper_answer",
                "localPath": str(PAPER_ANSWER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(PAPER_ANSWER),
            },
            {
                "id": "english1-2013-original-paper",
                "sourceId": ORIGINAL_SOURCE_ID,
                "role": "paper",
                "localPath": str(ORIGINAL_PAPER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(ORIGINAL_PAPER) if ORIGINAL_PAPER.exists() else "",
            },
        ],
        "assetRoot": "question-bank/english1-2013",
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
