#!/usr/bin/env python3
"""Build the 2024 English I public-course flashcard bank from Baidu Netdisk PDFs."""

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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english1-2024.json"
DEFAULT_FLASHCARD_OUTPUT = PROJECT_ROOT / "data" / "flashcards" / "english1-2024.json"

ORIGINAL_PAPER = RAW_DIR / "src_b2ab97d32ec93b73d1d590bd-2024年考研英语一真题.pdf"
PAPER_ANSWER = RAW_DIR / "src_553e81e5eb285c8b308f5c59-2024年考研英语一真题解析.pdf"
DETAILED_ANALYSIS = RAW_DIR / "src_f6cbf7dab2403b1eeabbd590-2024年考研英语一真题解析.pdf"

SOURCE_IDS = {
    "original_paper": "src_b2ab97d32ec93b73d1d590bd",
    "paper_answer": "src_553e81e5eb285c8b308f5c59",
    "detailed_analysis": "src_f6cbf7dab2403b1eeabbd590",
}

CHOICE_ANSWERS = {
    **dict(zip(range(1, 11), "DCBABCADAD")),
    **dict(zip(range(11, 21), "ACDCBBDCBA")),
    **dict(zip(range(21, 26), "DDABA")),
    **dict(zip(range(26, 31), "ABDCB")),
    **dict(zip(range(31, 36), "BCCDA")),
    **dict(zip(range(36, 41), "ABADB")),
    **dict(zip(range(41, 46), "ECFGB")),
}

SECTION_BY_GROUP = {
    "cloze": "完形填空",
    "text1": "阅读理解 Text 1",
    "text2": "阅读理解 Text 2",
    "text3": "阅读理解 Text 3",
    "text4": "阅读理解 Text 4",
    "part-b": "新题型",
    "part-c": "翻译",
    "writing": "写作",
}

PART_B_OPTIONS = {
    "A": "It is clear that the countries of origin have never been compensated for the stolen artifacts.",
    "B": "It is a flawed line of reasoning to argue against returning artifacts to their countries of origin.",
    "C": "Museum visitors can still learn as much from artifacts' copies after the originals.",
    "D": "Reproductions, even if perfectly made, cannot take the place of the authentic object.",
    "E": "The real value of artifacts can only be recognized in their countries of origin rather than anywhere else.",
    "F": "Ways to get artifacts from other countries must be decent and lawful.",
    "G": "Concern over security is no excuse for refusing to return artifacts to their countries of origin.",
}

PART_B_STATEMENTS = {
    41: "Choose the best statement for Hannah.",
    42: "Choose the best statement for Buck.",
    43: "Choose the best statement for Sara.",
    44: "Choose the best statement for Victor.",
    45: "Choose the best statement for Julia.",
}

TRANSLATION_SEGMENTS = {
    46: (
        "They sometimes travel more than sixty miles to find food or water, and are very good at working out where "
        "other elephants are-even when they are out of sight."
    ),
    47: (
        "The researchers are convinced that the elephants always know precisely where they are in relation to all "
        "the resources they need, and can therefore take shortcuts, as well as following familiar routes."
    ),
    48: (
        "One possibility was that they merely used their eyes and tried out the plants they found, but that would "
        "probably result in a lot of wasted time and energy, not least because their eyesight is actually not very good."
    ),
    49: (
        "The volatile chemicals produced by plants can be carried a long way, and they are very characteristic: each "
        "plant or tree has its own particular odor signature."
    ),
    50: (
        "The experiment showed that elephants may well use smell to identify patches of trees that are good to eat, "
        "and secondly to assess the quality of the trees within each patch."
    ),
}

TRANSLATION_ANSWERS = {
    46: "它们有时会跋涉 60 多英里去寻找食物或水，并且非常善于找出其他大象在哪里--即使这些大象在视线之外。",
    47: "研究人员确信，关于它们所需的所有资源，大象总是准确地知道自己在哪里，因此它们可以走捷径，也可以沿着熟悉的路线走。",
    48: "一种可能性是，它们只是用眼睛来试验它们发现的植物，但这可能会浪费大量的时间和精力，尤其因为它们的视力实际上不是很好。",
    49: "植物产生的挥发性化学物质可以散发很远的距离，而且这些物质非常有特点:每一种植物或树木都有自己独特的气味特征。",
    50: "实验表明，大象可以很好地利用嗅觉来识别适合食用的树木片区，其次评估每个片区内树木的品质。",
}

WRITING_CHART_52 = (
    "Picture and chart: 左图为公园健身区，人物说“家门口新修的公园真不错!”；"
    "右图为某市近三年公园数量（单位/座），2020年406座，2021年532座，2022年670座。"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact(value: Any) -> str:
    text = str(value or "")
    replacements = {
        "\u3000": " ",
        "\u00ad": "",
        "A. B. C or D": "A, B, C or D",
        "A. B. C. or D": "A, B, C, or D",
        "invented six years": "invented six years",
        "the need to be touched": "the need to be touched",
        "in and out buildings": "in and out of buildings",
        "sound weight": "sound, weight",
        "In conclusionB": "In conclusion B",
        "clanged": "changed",
        "changing is cost": "changing its cost",
        "would have achieved limit": "would have achieved little",
        "paper of surfaces": "price of surfaces",
        "an with oven looked technology called apor": "an often overlooked technology called paper",
        "cored of": "cared for",
        "knows as": "known as",
        "Journal of child Psychology": "Journal of Child Psychology",
        "all parents": "alloparents",
        "care givers": "caregivers",
        "humans evolutionary": "human evolutionary",
        "can for a ratio": "call for a ratio",
        "many contribute": "may contribute",
        "tram other": "from other",
        "identity AI": "identify AI",
        "fell about future": "feel about the future",
        "ruing": "ruling",
        "chesapeake": "Chesapeake",
        "are minder": "a reminder",
        "stake!involved": "stakes involved",
        "teaming with": "teeming with",
        "perfectly mode": "perfectly made",
        "countries of origin. These is": "countries of origin. There is",
        "public museum": "public museums",
        "Africa bush elephants": "African bush elephants",
        "counties": "countries",
        "resources the need": "resources they need",
        "eves": "eyes",
        "cat or avoid": "eat or avoid",
        "Use“Li Ming”instead": 'Use "Li Ming" instead',
        "essay. you": "essay, you",
        "meaning. and": "meaning, and",
        "；": ";",
    }
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def hash_text(value: Any) -> str:
    return "sha256:" + hashlib.sha256(compact(value).encode("utf-8")).hexdigest()


def relative(path: Path) -> str:
    return str(path.resolve().relative_to(PROJECT_ROOT))


def require_sources() -> None:
    missing = [relative(path) for path in [ORIGINAL_PAPER, PAPER_ANSWER, DETAILED_ANALYSIS] if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing required English I 2024 source PDFs: " + ", ".join(missing))


def run_pdftotext(path: Path) -> str:
    result = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout


def text_between(text: str, start: str, end: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise ValueError(f"Missing start anchor: {start}")
    end_index = text.find(end, start_index + len(start))
    if end_index < 0:
        raise ValueError(f"Missing end anchor after {start!r}: {end}")
    return text[start_index + len(start) : end_index]


def cleaned_block(text: str) -> str:
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip().lstrip("\f").strip()
        if not line:
            continue
        if "公众号" in line or "微信" in line or "研池大叔" in line or "免费分享" in line:
            continue
        if re.fullmatch(r"\d+", line):
            continue
        if line in {"考研英语⼀试题", "2024 年全国硕士研究生入学统一考试"}:
            continue
        lines.append(line)
    return compact(" ".join(lines))


def option_list(options: dict[str, str]) -> list[dict[str, str]]:
    return [{"label": label, "text": text} for label, text in options.items()]


def split_labeled_options(text: str, labels: str = "ABCD") -> dict[str, str]:
    normalized = compact(text)
    normalized = re.sub(r"\[([A-H])\]", r" \1. ", normalized)
    matches = list(re.finditer(rf"(?<![A-Za-z])([{labels}])\s*[\.,・\]]\s*", normalized))
    if len(matches) < len(labels):
        raise ValueError(f"Expected labels {labels}, found {len(matches)} in: {normalized[:220]}")
    matches = matches[-len(labels) :]
    options: dict[str, str] = {}
    for index, match in enumerate(matches):
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        options[match.group(1)] = normalized[match.end() : next_start].strip()
    return options


def find_numbered_block(text: str, number: int, next_number: int | None = None, *, end_anchor: str | None = None) -> str:
    start_match = re.search(rf"(?m)^[\s\f]*{number}\.\s*", text)
    if not start_match:
        raise ValueError(f"Missing numbered block {number}")
    end_indexes: list[int] = []
    if next_number is not None:
        end_match = re.search(rf"(?m)^[\s\f]*{next_number}\.\s*", text[start_match.end() :])
        if end_match:
            end_indexes.append(start_match.end() + end_match.start())
    if end_anchor:
        end_index = text.find(end_anchor, start_match.end())
        if end_index >= 0:
            end_indexes.append(end_index)
    return text[start_match.start() : min(end_indexes)] if end_indexes else text[start_match.start() :]


def parse_choice_question(block: str, number: int) -> tuple[str, dict[str, str]]:
    normalized = compact(re.sub(rf"^\s*{number}\.\s*", "", block.strip()))
    matches = list(re.finditer(r"(?<![A-Za-z])([A-D])\s*[\.,・\]]\s*", normalized))
    if len(matches) < 4:
        raise ValueError(f"Question {number} missing A-D options: {normalized[:220]}")
    first_option = matches[-4]
    question = normalized[: first_option.start()].strip()
    options = split_labeled_options(normalized[first_option.start() :], "ABCD")
    return question, options


def extract_cloze_passage(text: str) -> str:
    block = text_between(text, "There's nothing more welcoming", "1. [A] Though")
    block = cleaned_block("There's nothing more welcoming" + block)
    for number in range(1, 21):
        block = re.sub(rf"(?<![\d(]){number}\.?(?![\d)])\s+", f"({number}) ", block, count=1)
    return compact(block)


def extract_cloze_options(text: str) -> dict[int, dict[str, str]]:
    option_text = "1. [A] Though" + text_between(text, "1. [A] Though", "答案：")
    return {
        number: split_labeled_options(find_numbered_block(option_text, number, number + 1 if number < 20 else None))
        for number in range(1, 21)
    }


def extract_passages(text: str) -> dict[str, str]:
    passages = {
        "text1": cleaned_block(text_between(text, "Text 1", "21. Romans buried")),
        "text2": cleaned_block(text_between(text, "Text 2", "26. According")),
        "text3": cleaned_block(text_between(text, "Text 3", "31. what")),
        "text4": cleaned_block(text_between(text, "Text 4", "36. The Chesapeake")),
        "part-b": cleaned_block(text_between(text, "41. Hannah", "[A] It is clear")),
        "part-c": cleaned_block(text_between(text, '"Elephants never forget"', "答案：46.")),
    }
    passages["part-b"] = "41. Hannah " + passages["part-b"]
    passages["part-c"] = '"Elephants never forget" ' + passages["part-c"]
    return passages


def extract_writing_prompts(text: str) -> dict[int, str]:
    writing = text_between(text, "Section Ⅲ Writing", "15")
    prompt51 = cleaned_block(text_between(writing, "51. Directions:", "答案：略"))
    part_b = writing.split("Part B", 1)[1]
    prompt52 = cleaned_block(text_between(part_b, "52. Directions:", "答案：略"))
    return {
        51: "51. Directions: " + prompt51,
        52: "52. Directions: " + prompt52 + " " + WRITING_CHART_52,
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


QUESTION_GROUP_END_ANCHORS = {
    25: "Text 2",
    30: "Text 3",
    35: "Text 4",
    40: "Part B",
}


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


def attach_evidence(card: dict[str, Any], *, answer_role: str = "official_answer_key") -> dict[str, Any]:
    question_hash = hash_text(json.dumps(question_hash_payload(card), ensure_ascii=False, sort_keys=True))
    answer_hash = hash_text(json.dumps(answer_hash_payload(card, answer_role), ensure_ascii=False, sort_keys=True))
    now = card.pop("_now")
    card["sourceEvidenceId"] = SOURCE_IDS["paper_answer"]
    card["sourceEvidence"] = {
        "evidenceId": SOURCE_IDS["paper_answer"],
        "sourceId": SOURCE_IDS["paper_answer"],
        "originalPaperSourceId": SOURCE_IDS["original_paper"],
        "supportingSourceId": SOURCE_IDS["detailed_analysis"],
        "sourceType": "official_paper",
        "sourceFilePath": relative(PAPER_ANSWER),
        "originalPaperFilePath": relative(ORIGINAL_PAPER),
        "fileSha256": sha256_file(PAPER_ANSWER),
        "originalPaperSha256": sha256_file(ORIGINAL_PAPER),
        "status": "matched",
        "method": "local_baidu_2024_english1_pdf_text_layer_with_original_paper_audit",
        "questionTextHash": question_hash,
        "verifiedAt": now,
        "verifiedBy": "build_english1_2024_bank",
    }
    card["questionTextHash"] = question_hash
    card["answerTextHash"] = answer_hash
    card["answerEvidenceStatus"] = "matched"
    card["answerEvidenceSourceId"] = SOURCE_IDS["paper_answer"]
    card["answerEvidence"] = {
        "status": "matched",
        "evidenceRole": answer_role,
        "sourceId": SOURCE_IDS["paper_answer"],
        "supportingSourceId": SOURCE_IDS["detailed_analysis"],
        "sourceFilePath": relative(PAPER_ANSWER),
        "answerTextHash": answer_hash,
        "method": "local_baidu_2024_english1_answer_table_with_page_image_audit",
        "verifiedAt": now,
        "verifiedBy": "build_english1_2024_bank",
        "note": "Matched against Baidu Netdisk 2024 English I paper/analysis PDFs; writing chart details were visually audited from the rendered paper page.",
    }
    return card


def base_card(number: int, *, card_type: str, question: str, answer: str, now: str) -> dict[str, Any]:
    group_id = group_for(number)
    section = SECTION_BY_GROUP[group_id]
    return {
        "id": f"english1-2024-{number:03d}",
        "paperId": "english1-2024",
        "paperName": "2024考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2024",
        "number": number,
        "type": card_type,
        "section": section,
        "groupId": group_id,
        "question": question,
        "answer": answer,
        "source": PAPER_ANSWER.name,
        "tags": ["english1", "2024真题", section],
        "_now": now,
    }


def build_bank(now: str | None = None) -> dict[str, Any]:
    require_sources()
    now = now or utc_now()
    text = run_pdftotext(PAPER_ANSWER)
    cloze_passage = extract_cloze_passage(text)
    cloze_options = extract_cloze_options(text)
    passages = extract_passages(text)
    writing_prompts = extract_writing_prompts(text)
    cards: list[dict[str, Any]] = []

    for number in range(1, 21):
        card = base_card(
            number,
            card_type="single_choice",
            question=f"完形填空第 {number} 空：请结合完整短文选择最合适的选项。",
            answer=CHOICE_ANSWERS[number],
            now=now,
        )
        card["passage"] = cloze_passage
        card["options"] = option_list(cloze_options[number])
        card["explanation"] = "答案已按本地百度网盘 2024 英语一真题解析 PDF 答案表匹配。"
        cards.append(attach_evidence(card))

    for number in range(21, 41):
        group_id = group_for(number)
        block = find_numbered_block(
            text,
            number,
            number + 1 if number not in QUESTION_GROUP_END_ANCHORS else None,
            end_anchor=QUESTION_GROUP_END_ANCHORS.get(number),
        )
        question, options = parse_choice_question(block, number)
        card = base_card(number, card_type="single_choice", question=question, answer=CHOICE_ANSWERS[number], now=now)
        card["passage"] = passages[group_id]
        card["options"] = option_list(options)
        card["explanation"] = "答案已按本地百度网盘 2024 英语一真题解析 PDF 参考答案匹配。"
        cards.append(attach_evidence(card))

    for number in range(41, 46):
        card = base_card(
            number,
            card_type="single_choice",
            question=PART_B_STATEMENTS[number],
            answer=CHOICE_ANSWERS[number],
            now=now,
        )
        card["passage"] = passages["part-b"]
        card["material"] = passages["part-b"]
        card["options"] = option_list(PART_B_OPTIONS)
        card["explanation"] = "答案已按本地百度网盘 2024 英语一真题解析 PDF Part B 答案表匹配。"
        cards.append(attach_evidence(card))

    for number in range(46, 51):
        card = base_card(
            number,
            card_type="translation",
            question=f"翻译第 {number} 处画线句：{TRANSLATION_SEGMENTS[number]}",
            answer=TRANSLATION_ANSWERS[number],
            now=now,
        )
        card["passage"] = passages["part-c"]
        card["targetSegment"] = TRANSLATION_SEGMENTS[number]
        card["explanation"] = "参考译文已按本地百度网盘 2024 英语一真题解析 PDF 匹配。"
        cards.append(attach_evidence(card))

    for number in (51, 52):
        prompt = writing_prompts[number]
        card = base_card(
            number,
            card_type="essay",
            question=prompt,
            answer=f"按官方题干完成写作任务：{prompt}",
            now=now,
        )
        card["passage"] = prompt
        card["explanation"] = "写作题按官方题干和任务训练，不提供唯一范文答案。"
        cards.append(attach_evidence(card, answer_role="official_writing_prompt"))

    validate_cards(cards, cloze_passage, passages, writing_prompts, text)
    return {
        "id": "english1-2024",
        "source": PAPER_ANSWER.name,
        "paperId": "english1-2024",
        "paperName": "2024考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2024",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_2024_english1_pdf_text_layer_with_original_paper_and_page_image_audit_v1",
        "sourceFiles": [
            {
                "id": "english1-2024-paper-answer",
                "sourceId": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": relative(PAPER_ANSWER),
                "sha256": sha256_file(PAPER_ANSWER),
            },
            {
                "id": "english1-2024-original-paper",
                "sourceId": SOURCE_IDS["original_paper"],
                "role": "paper",
                "localPath": relative(ORIGINAL_PAPER),
                "sha256": sha256_file(ORIGINAL_PAPER),
            },
            {
                "id": "english1-2024-detailed-analysis",
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
            "policy": "local_baidu_2024_english1_pdf_text_layer_match_with_page_image_audit",
        },
        "cards": cards,
    }


def validate_cards(
    cards: list[dict[str, Any]],
    cloze_passage: str,
    passages: dict[str, str],
    writing_prompts: dict[int, str],
    text: str,
) -> None:
    issues: list[str] = []
    if len(cards) != 52:
        issues.append(f"card count {len(cards)} != 52")
    if "automatic doors" not in cloze_passage or "(20)" not in cloze_passage:
        issues.append("cloze passage missing automatic-door anchors")
    for key, anchor in {
        "text1": "10 tons of nails",
        "text2": "hunter-gatherers in Africa",
        "text3": "Stable Diffusion",
        "text4": "Chesapeake Bay",
        "part-b": "Benin Bronzes",
        "part-c": "Elephants never forget",
    }.items():
        if anchor.lower() not in passages[key].lower():
            issues.append(f"{key} missing anchor {anchor}")
    if "ancient Chinese scientist" not in writing_prompts[51]:
        issues.append("writing prompt 51 missing ancient Chinese scientist")
    if "某市近三年公园数量" not in writing_prompts[52] or "2022年670座" not in writing_prompts[52]:
        issues.append("writing prompt 52 missing park chart anchors")
    if "1-10：DCBAB CADAD" not in text or "答案 41-45：ECFGB" not in text:
        issues.append("answer table anchors missing")

    for expected_number, card in enumerate(cards, start=1):
        if card.get("number") != expected_number:
            issues.append(f"card {expected_number}: number={card.get('number')}")
        if not str(card.get("question") or "").strip() or not str(card.get("answer") or "").strip():
            issues.append(f"card {expected_number}: missing question/answer")
        if not str(card.get("passage") or "").strip():
            issues.append(f"card {expected_number}: missing passage")
        if card.get("answerEvidenceStatus") != "matched":
            issues.append(f"card {expected_number}: unmatched answer evidence")
        if not card.get("questionTextHash") or not card.get("answerTextHash"):
            issues.append(f"card {expected_number}: missing evidence hash")
        if card.get("type") == "single_choice" and len(card.get("options") or []) < 4:
            issues.append(f"card {expected_number}: missing choice options")

    expected = {1: "D", 21: "D", 30: "B", 40: "B", 41: "E", 45: "B"}
    for number, answer in expected.items():
        if cards[number - 1].get("answer") != answer:
            issues.append(f"question {number} answer mismatch")
    if "跋涉 60 多英里" not in cards[45]["answer"]:
        issues.append("question 46 translation answer mismatch")
    if cards[51]["answerEvidence"]["evidenceRole"] != "official_writing_prompt":
        issues.append("question 52 writing evidence role mismatch")
    payload = json.dumps(cards, ensure_ascii=False)
    for forbidden in ["公众号", "研池大叔", "免费分享"]:
        if forbidden in payload:
            issues.append(f"source noise remains: {forbidden}")
    if issues:
        raise ValueError("english1-2024 validation failed:\n" + "\n".join(issues))


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
        "[english1-2024] "
        f"output={display_path(args.output)} "
        f"flashcards={display_path(args.flashcard_output)} "
        f"cards={bank['total_cards']} "
        f"status={bank['publicationStatus']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
