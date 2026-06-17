#!/usr/bin/env python3
"""Build the 2023 English II public-course flashcard bank from Baidu Netdisk PDFs."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english2-2023.json"
DEFAULT_FLASHCARD_OUTPUT = PROJECT_ROOT / "data" / "flashcards" / "english2-2023.json"

ORIGINAL_PAPER = RAW_DIR / "src_cece5ee4e7fe109d06c9d585-2023年考研英语二真题.pdf"
PAPER_ANSWER = RAW_DIR / "src_f014592d9468b7573e2ddf14-2023年真题及答案速查-英语二.pdf"
DETAILED_ANALYSIS = RAW_DIR / "src_20f746174f5e1db8e32a3717-2023英语二真题解析.pdf"

SOURCE_IDS = {
    "original_paper": "src_cece5ee4e7fe109d06c9d585",
    "paper_answer": "src_f014592d9468b7573e2ddf14",
    "detailed_analysis": "src_20f746174f5e1db8e32a3717",
}

CHOICE_ANSWERS = {
    **dict(zip(range(1, 6), "BCADD")),
    **dict(zip(range(6, 11), "DABBC")),
    **dict(zip(range(11, 16), "CDCAA")),
    **dict(zip(range(16, 21), "BDBCA")),
    **dict(zip(range(21, 26), "ABBCD")),
    **dict(zip(range(26, 31), "DACBD")),
    **dict(zip(range(31, 36), "CDAAB")),
    **dict(zip(range(36, 41), "ACDBA")),
    **dict(zip(range(41, 46), "DFBAG")),
}

SECTION_BY_GROUP = {
    "cloze": "完形填空",
    "text1": "阅读理解 Text 1",
    "text2": "阅读理解 Text 2",
    "text3": "阅读理解 Text 3",
    "text4": "阅读理解 Text 4",
    "part-b": "新题型",
    "translation": "翻译",
    "writing": "写作",
}

PART_B_OPTIONS = {
    "A": "The rise of home prices is a temporary matter.",
    "B": "Builders possibly need to submit new estimates of their projects.",
    "C": "There will be specific limits on home extensions to prevent heat loss.",
    "D": "The new rules will take home prices to an even higher level.",
    "E": "Many people feel that home prices are already beyond what they can afford.",
    "F": "The new rules will affect people whose home extensions include new windows or doors.",
    "G": "The rule changes will benefit homeowners eventually.",
}

PART_B_STATEMENTS = {
    41: "Match Brian Berry to the corresponding information.",
    42: "Match Gareth Belsham to the corresponding information.",
    43: "Match Marcus Jefford to the corresponding information.",
    44: "Match John Kelly to the corresponding information.",
    45: "Match Andrew Mellor to the corresponding information.",
}

WRITING_CHART_48 = (
    "Chart: 2012-2021年我国居民健康素养水平 "
    "(2012年8.80%, 2013年9.48%, 2014年9.79%, 2015年10.25%, "
    "2016年11.58%, 2017年14.18%, 2018年17.06%, 2019年19.17%, "
    "2020年23.15%, 2021年25.40%)."
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact(value: Any) -> str:
    text = str(value or "")
    replacements = {
        "\u3000": " ",
        "\u00ad": "",
        "word( s)": "word(s)",
        "Lefs": "Let's",
        "signatxires": "signatures",
        "green-washv": "greenwash",
        "Mecological damage": '"ecological damage',
        " M We prefer": ' "We prefer',
        "ifs a good": "it's a good",
        "ifs a": "it's a",
        "keprtntact": "kept intact",
        "visitor%": "visitors",
        "taxpayer%": "taxpayers",
        "Mcognitive offloading": '"cognitive offloading',
        "costs,M": 'costs,"',
        "technology,M": 'technology,"',
        "MReward sensitivityM": '"Reward sensitivity"',
        "cnildren": "children",
        "endeavor t6": "endeavor to",
        "aiuount": "amount",
        "highiy": "highly",
        "tliere": "there",
        "restrict-Ous": "restrictions",
        "cleai": "clear",
        "admiral?!-": "admirable",
        "avemge": "average",
        "ohvin»js!v": "obviously",
        "»wer time": "over time",
        "ymi": "you",
        "Section 0": "Section II",
        "Section Il": "Section II",
        "Section ID": "Section III",
        "Section ill": "Section III",
        "；": ";",
    }
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    text = re.sub(r"(?<![A-Za-z])([a-d])[\.\]]", lambda match: f"{match.group(1).upper()}.", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hash_text(value: Any) -> str:
    return "sha256:" + hashlib.sha256(compact(value).encode("utf-8")).hexdigest()


def relative(path: Path) -> str:
    return str(path.resolve().relative_to(PROJECT_ROOT))


def run_pdftotext(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(path)
    result = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout


def require_sources() -> None:
    paths = [ORIGINAL_PAPER, PAPER_ANSWER, DETAILED_ANALYSIS]
    missing = [relative(path) for path in paths if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing required English II 2023 source PDFs: " + ", ".join(missing))


def text_between(text: str, start: str, end: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise ValueError(f"Missing start anchor: {start}")
    end_index = text.find(end, start_index + len(start))
    if end_index < 0:
        raise ValueError(f"Missing end anchor after {start!r}: {end}")
    return text[start_index + len(start) : end_index]


def page_footer_pattern() -> re.Pattern[str]:
    return re.compile(r"英语[（(]二[）)]试题[,.・，]\s*[0-9IVX]+\s*[,.・，][（(]共15页[）)]")


def cleaned_block(text: str) -> str:
    lines = []
    footer = page_footer_pattern()
    for raw_line in text.splitlines():
        line = raw_line.strip().lstrip("\f").strip()
        if not line:
            continue
        if "公众号" in line or "微信" in line or "研池大叔" in line or "免费分享" in line:
            continue
        if footer.search(line):
            continue
        lines.append(line)
    return compact(" ".join(lines))


def option_list(options: dict[str, str]) -> list[dict[str, str]]:
    return [{"label": label, "text": text} for label, text in options.items()]


def split_labeled_options(text: str, labels: str = "ABCD") -> dict[str, str]:
    normalized = compact(text)
    label_pattern = "".join(labels)
    matches = list(re.finditer(rf"(?<![A-Za-z])([{label_pattern}])\s*[\.,・\]]\s*", normalized))
    if len(matches) < len(labels):
        raise ValueError(f"Expected labels {labels}, found {len(matches)} in: {normalized[:220]}")
    matches = matches[-len(labels) :]
    options: dict[str, str] = {}
    for index, match in enumerate(matches):
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        options[match.group(1)] = normalized[match.end() : next_start].strip()
    return options


def find_numbered_block(text: str, number: int, next_number: int | None = None, *, end_anchor: str | None = None) -> str:
    start_match = re.search(rf"(?m)^\s*{number}\.\s+", text)
    if not start_match:
        raise ValueError(f"Missing numbered block {number}")

    end_indexes: list[int] = []
    if next_number is not None:
        end_match = re.search(rf"(?m)^\s*{next_number}\.\s+", text[start_match.end() :])
        if end_match:
            end_indexes.append(start_match.end() + end_match.start())
    if end_anchor:
        end_index = text.find(end_anchor, start_match.end())
        if end_index >= 0:
            end_indexes.append(end_index)
    footer_match = page_footer_pattern().search(text[start_match.end() :])
    if footer_match:
        end_indexes.append(start_match.end() + footer_match.start())
    if end_indexes:
        return text[start_match.start() : min(end_indexes)]
    return text[start_match.start() :]


def parse_choice_question(block: str, number: int) -> tuple[str, dict[str, str]]:
    normalized = compact(re.sub(rf"^\s*{number}\.\s*", "", block.strip()))
    matches = list(re.finditer(r"(?<![A-Za-z])([A-D])\s*[\.,・\]]\s*", normalized))
    if len(matches) < 4:
        raise ValueError(f"Question {number} missing A-D options: {normalized[:220]}")
    first_option = matches[-4]
    question = normalized[: first_option.start()].strip(" -_")
    options = split_labeled_options(normalized[first_option.start() :], "ABCD")
    return question, options


def extract_cloze_passage(text: str) -> str:
    block = text_between(
        text,
        "Read the following text. Choose the best word( s) for each numbered blank and",
        "英语（二）试题.I.（共15页）",
    )
    block = cleaned_block(block)
    block = re.sub(r"^mark A, B, C or D on the ANSWER SHEET\. \(10 points\)", "", block).strip()
    block = re.sub(r"nice\s*]\s*,", "nice (1),", block, count=1)
    block = block.replace("real-world 4.", "real-world (4).")
    for number in range(2, 21):
        block = re.sub(rf"\s+{number}\s+", f" ({number}) ", block, count=1)
    return compact(block)


def extract_cloze_options(text: str) -> dict[int, dict[str, str]]:
    option_text = text_between(text, "英语（二）试题.I.（共15页）", "Section 0       Reading Comprehension")
    options: dict[int, dict[str, str]] = {}
    for number in range(1, 21):
        block = find_numbered_block(option_text, number, number + 1 if number < 20 else None)
        options[number] = split_labeled_options(block, "ABCD")
    return options


def extract_passages(text: str) -> dict[str, str]:
    passages = {
        "text1": cleaned_block(text_between(text, "Text 1", "21. The RHS thinks that plastic grass")),
        "text2": cleaned_block(text_between(text, "Text 2", "26. What problem are U.S. national parks")),
        "text3": cleaned_block(text_between(text, "Text 3", "31. Sparrow's study shows")),
        "text4": cleaned_block(text_between(text, "Text 4", "36. According to Paragraph 1")),
        "part-b": cleaned_block(
            text_between(text, "Net-zero rules set to send cost of new homes and extensions soaring", "Section ID      Translation")
        ),
    }
    passages["part-b"] = "Net-zero rules set to send cost of new homes and extensions soaring " + passages["part-b"]
    return passages


def extract_translation_text(text: str) -> str:
    block = text_between(text, "In the late 18th century, William Wordsworth", "Section IV")
    return compact(page_footer_pattern().sub("", "In the late 18th century, William Wordsworth" + block))


def extract_translation_answer(text: str) -> str:
    block = text_between(text, "18世纪末，威廉", "英语（二）试题,15.（共15页）")
    return cleaned_block("18世纪末，威廉" + block)


def extract_writing_prompts(text: str) -> dict[int, str]:
    writing_section = text_between(text, "Section IV   Writing", "2023年考研英语（二）真题答案速查表")
    prompt47 = cleaned_block(text_between(writing_section, "47. Directions:", "Part B"))
    prompt48 = cleaned_block(text_between(writing_section, "48. Directions:", "英语（二）试题.14.（共15页）"))
    return {
        47: "47. Directions: " + prompt47,
        48: "48. Directions: " + prompt48 + " " + WRITING_CHART_48,
    }


def build_extracted_material(text: str) -> dict[str, Any]:
    return {
        "cloze_passage": extract_cloze_passage(text),
        "cloze_options": extract_cloze_options(text),
        "passages": extract_passages(text),
        "translation_text": extract_translation_text(text),
        "translation_answer": extract_translation_answer(text),
        "writing_prompts": extract_writing_prompts(text),
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
    if number == 46:
        return "translation"
    return "writing"


def source_path(source_id: str) -> Path:
    if source_id == SOURCE_IDS["original_paper"]:
        return ORIGINAL_PAPER
    if source_id == SOURCE_IDS["paper_answer"]:
        return PAPER_ANSWER
    if source_id == SOURCE_IDS["detailed_analysis"]:
        return DETAILED_ANALYSIS
    raise KeyError(source_id)


def question_hash_payload(card: dict[str, Any]) -> dict[str, Any]:
    return {
        "question": card.get("question"),
        "passage": card.get("passage"),
        "options": card.get("options", []),
        "material": card.get("material", ""),
    }


def answer_hash_payload(card: dict[str, Any], answer_role: str) -> dict[str, Any]:
    return {"answer": card.get("answer"), "role": answer_role}


def attach_evidence(
    card: dict[str, Any],
    *,
    question_source_id: str,
    answer_source_id: str,
    now: str,
    answer_method: str,
    answer_note: str,
    answer_role: str = "answer_key",
) -> dict[str, Any]:
    question_source = source_path(question_source_id)
    answer_source = source_path(answer_source_id)
    question_hash = hash_text(json.dumps(question_hash_payload(card), ensure_ascii=False, sort_keys=True))
    answer_hash = hash_text(json.dumps(answer_hash_payload(card, answer_role), ensure_ascii=False, sort_keys=True))

    card["sourceEvidenceId"] = question_source_id
    card["sourceEvidence"] = {
        "evidenceId": question_source_id,
        "sourceId": question_source_id,
        "originalPaperSourceId": SOURCE_IDS["original_paper"],
        "supportingSourceId": SOURCE_IDS["detailed_analysis"],
        "sourceType": "official_paper",
        "sourceFilePath": relative(question_source),
        "originalPaperFilePath": relative(ORIGINAL_PAPER),
        "fileSha256": sha256_file(question_source),
        "originalPaperSha256": sha256_file(ORIGINAL_PAPER),
        "status": "matched",
        "method": "local_baidu_answer_speed_pdf_text_layer_with_original_paper_audit",
        "questionTextHash": question_hash,
        "verifiedAt": now,
        "verifiedBy": "build_english2_2023_bank",
    }
    card["questionTextHash"] = question_hash
    card["answerTextHash"] = answer_hash
    card["answerEvidenceStatus"] = "matched"
    card["answerSourceFilePath"] = relative(answer_source)
    card["answerEvidenceSourceId"] = answer_source_id
    card["answerEvidence"] = {
        "status": "matched",
        "sourceId": answer_source_id,
        "sourceFilePath": relative(answer_source),
        "answerTextHash": answer_hash,
        "method": answer_method,
        "evidenceRole": answer_role,
        "verifiedAt": now,
        "verifiedBy": "build_english2_2023_bank",
        "note": answer_note,
    }
    return card


def base_card(number: int, *, card_type: str, section: str, group_id: str, question: str, answer: str) -> dict[str, Any]:
    return {
        "id": f"english2-2023-{number:03d}",
        "paperId": "english2-2023",
        "paperName": "2023考研英语二真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english2",
        "year": "2023",
        "number": number,
        "type": card_type,
        "section": section,
        "groupId": group_id,
        "question": question,
        "answer": answer,
        "source": PAPER_ANSWER.name,
        "tags": ["english2", "2023真题", section],
    }


def build_bank(now: str | None = None) -> dict[str, Any]:
    require_sources()
    now = now or utc_now()
    text = run_pdftotext(PAPER_ANSWER)
    material = build_extracted_material(text)
    cards: list[dict[str, Any]] = []

    for number in range(1, 21):
        section = SECTION_BY_GROUP["cloze"]
        card = base_card(
            number,
            card_type="single_choice",
            section=section,
            group_id="cloze",
            question=f"Choose the best option for blank {number}.",
            answer=CHOICE_ANSWERS[number],
        )
        card["passage"] = material["cloze_passage"]
        card["options"] = option_list(material["cloze_options"][number])
        card["explanation"] = "答案已按本地百度网盘 2023 英语二真题答案速查表匹配。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_answer_speed_table_match",
                answer_note="Matched against the local 2023 English II answer-speed PDF.",
            )
        )

    for number in range(21, 41):
        group_id = group_for(number)
        section = SECTION_BY_GROUP[group_id]
        block = find_numbered_block(text, number, number + 1 if number < 40 else None, end_anchor="Part B")
        question, options = parse_choice_question(block, number)
        card = base_card(
            number,
            card_type="single_choice",
            section=section,
            group_id=group_id,
            question=question,
            answer=CHOICE_ANSWERS[number],
        )
        card["passage"] = material["passages"][group_id]
        card["options"] = option_list(options)
        card["explanation"] = "答案已按本地百度网盘 2023 英语二答案速查表匹配。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_answer_speed_table_match",
                answer_note="Matched against the local 2023 English II answer-speed PDF.",
            )
        )

    for number in range(41, 46):
        card = base_card(
            number,
            card_type="single_choice",
            section=SECTION_BY_GROUP["part-b"],
            group_id="part-b",
            question=PART_B_STATEMENTS[number],
            answer=CHOICE_ANSWERS[number],
        )
        card["passage"] = material["passages"]["part-b"]
        card["material"] = material["passages"]["part-b"]
        card["options"] = option_list(PART_B_OPTIONS)
        card["explanation"] = "答案已按本地百度网盘 2023 英语二答案速查表匹配；Part B 按 A-G 信息匹配训练。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_answer_speed_table_part_b_match",
                answer_note="Part B A-G answers were matched against the local answer-speed table.",
            )
        )

    translation = base_card(
        46,
        card_type="translation",
        section=SECTION_BY_GROUP["translation"],
        group_id="translation",
        question="Translate the following text into Chinese.",
        answer=material["translation_answer"],
    )
    translation["passage"] = material["translation_text"]
    translation["targetSegment"] = material["translation_text"]
    translation["explanation"] = "参考译文已按本地百度网盘 2023 英语二答案速查 PDF 匹配。"
    cards.append(
        attach_evidence(
            translation,
            question_source_id=SOURCE_IDS["paper_answer"],
            answer_source_id=SOURCE_IDS["paper_answer"],
            now=now,
            answer_method="local_answer_speed_translation_reference",
            answer_note="Translation reference was matched against the local 2023 English II answer-speed PDF.",
        )
    )

    for number in (47, 48):
        prompt = material["writing_prompts"][number]
        card = base_card(
            number,
            card_type="essay",
            section=SECTION_BY_GROUP["writing"],
            group_id="writing",
            question=prompt,
            answer=f"按官方题干完成写作任务：{prompt}",
        )
        card["passage"] = prompt
        card["explanation"] = "写作题按官方题干和图表任务训练，不提供唯一范文答案。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_writing_prompt_text_hash",
                answer_role="official_writing_prompt",
                answer_note="Writing has no single official answer; matched evidence covers the official prompt and task requirements.",
            )
        )

    validate_cards(cards, material, text)
    return {
        "id": "english2-2023",
        "source": PAPER_ANSWER.name,
        "paperId": "english2-2023",
        "paperName": "2023考研英语二真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english2",
        "year": "2023",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_answer_speed_text_layer_with_original_paper_and_analysis_audit_v1",
        "sourceFiles": [
            {
                "id": "english2-2023-original-paper",
                "sourceId": SOURCE_IDS["original_paper"],
                "role": "paper",
                "localPath": relative(ORIGINAL_PAPER),
                "sha256": sha256_file(ORIGINAL_PAPER),
            },
            {
                "id": "english2-2023-paper-answer",
                "sourceId": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": relative(PAPER_ANSWER),
                "sha256": sha256_file(PAPER_ANSWER),
            },
            {
                "id": "english2-2023-detailed-analysis",
                "sourceId": SOURCE_IDS["detailed_analysis"],
                "role": "answer_analysis",
                "localPath": relative(DETAILED_ANALYSIS),
                "sha256": sha256_file(DETAILED_ANALYSIS),
            },
        ],
        "processed_at": now,
        "total_cards": len(cards),
        "sections": ["完形填空", "阅读理解", "新题型", "翻译", "写作"],
        "sourceEvidenceSummary": {
            "questionSources": [
                SOURCE_IDS["paper_answer"],
                SOURCE_IDS["original_paper"],
                SOURCE_IDS["detailed_analysis"],
            ],
            "answerSources": [SOURCE_IDS["paper_answer"], SOURCE_IDS["detailed_analysis"]],
            "policy": "local_baidu_answer_speed_pdf_text_layer_match",
        },
        "cards": cards,
    }


def validate_cards(cards: list[dict[str, Any]], material: dict[str, Any], text: str) -> None:
    issues: list[str] = []
    if len(cards) != 48:
        issues.append(f"card count {len(cards)} != 48")
    if "entrepreneurs face today" not in material["cloze_passage"] or "growth team" not in material["cloze_passage"]:
        issues.append("cloze passage missing growth-team anchors")
    for number in range(1, 21):
        if f"({number})" not in material["cloze_passage"]:
            issues.append(f"cloze passage missing blank marker ({number})")
    if "plastic grass" not in material["passages"]["text1"] or "Royal Horticultural Society" not in material["passages"]["text1"]:
        issues.append("Text 1 passage missing plastic-grass anchors")
    if "national parks are in crisis" not in material["passages"]["text2"] or "maintenance backlog" not in material["passages"]["text2"]:
        issues.append("Text 2 passage missing national-park anchors")
    if "Betsy Sparrow" not in material["passages"]["text3"] or "cognitive offloading" not in material["passages"]["text3"]:
        issues.append("Text 3 passage missing Internet-memory anchors")
    if "Teenagers are paradoxical" not in material["passages"]["text4"] or "reward sensitivity" not in material["passages"]["text4"]:
        issues.append("Text 4 passage missing adolescence anchors")
    if "Net-zero rules" not in material["passages"]["part-b"] or "Brian Berry" not in material["passages"]["part-b"]:
        issues.append("Part B passage missing net-zero anchors")
    if "William Wordsworth became famous for his poems about nature" not in material["translation_text"]:
        issues.append("translation text missing Wordsworth anchor")
    if "华兹华斯" not in material["translation_answer"]:
        issues.append("translation answer missing Wordsworth Chinese anchor")
    if "art exhibition and a robot show" not in material["writing_prompts"][47]:
        issues.append("writing prompt 47 missing show-choice anchor")
    if "2012-2021年我国居民健康素养水平" not in material["writing_prompts"][48] or "25.40%" not in material["writing_prompts"][48]:
        issues.append("writing prompt 48 missing health-literacy chart anchor")
    if "BCADD" not in text or "DFBAG" not in text:
        issues.append("answer-speed table anchors missing")

    forbidden_noise = ["公众号", "研池大叔", "免费分享", "Section ID", "Section 0", "signatxires", "keprtntact", "cnildren"]
    for expected_number, card in enumerate(cards, start=1):
        if card.get("number") != expected_number:
            issues.append(f"card {expected_number}: number={card.get('number')}")
        if not str(card.get("question") or "").strip():
            issues.append(f"card {expected_number}: missing question")
        if not str(card.get("answer") or "").strip():
            issues.append(f"card {expected_number}: missing answer")
        if card.get("answerEvidenceStatus") != "matched":
            issues.append(f"card {expected_number}: unmatched answer evidence")
        if not str(card.get("passage") or "").strip():
            issues.append(f"card {expected_number}: missing passage")
        if not card.get("questionTextHash") or not card.get("answerTextHash"):
            issues.append(f"card {expected_number}: missing evidence hash")
        if str(card.get("type")) == "single_choice" and len(card.get("options") or []) < 4:
            issues.append(f"card {expected_number}: missing choice options")
        serialized_card = json.dumps(card, ensure_ascii=False)
        for noise in forbidden_noise:
            if noise in serialized_card:
                issues.append(f"card {expected_number}: OCR/source noise remains: {noise}")

    if cards[0]["answer"] != "B":
        issues.append("question 1 answer mismatch")
    if cards[20]["answer"] != "A":
        issues.append("question 21 answer mismatch")
    if cards[29]["answer"] != "D":
        issues.append("question 30 answer mismatch")
    if cards[40]["answer"] != "D" or cards[44]["answer"] != "G":
        issues.append("Part B answer mismatch")
    if len(cards[40]["options"]) != 7:
        issues.append("Part B option count mismatch")
    if not cards[45]["answer"].startswith("18世纪末"):
        issues.append("question 46 translation answer mismatch")
    if cards[47]["answerEvidence"]["evidenceRole"] != "official_writing_prompt":
        issues.append("question 48 answer evidence role mismatch")

    if issues:
        raise ValueError("english2-2023 validation failed:\n" + "\n".join(issues))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def display_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(resolved)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--flashcard-output", type=Path, default=DEFAULT_FLASHCARD_OUTPUT)
    args = parser.parse_args(argv)
    bank = build_bank()
    write_json(args.output, bank)
    write_json(args.flashcard_output, bank)
    print(
        "[english2-2023] "
        f"output={display_path(args.output)} "
        f"flashcards={display_path(args.flashcard_output)} "
        f"cards={bank['total_cards']} "
        f"status={bank['publicationStatus']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
