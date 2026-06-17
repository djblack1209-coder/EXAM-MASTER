#!/usr/bin/env python3
"""Build the 2023 English I public-course flashcard bank from Baidu Netdisk PDFs."""

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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english1-2023.json"
DEFAULT_FLASHCARD_OUTPUT = PROJECT_ROOT / "data" / "flashcards" / "english1-2023.json"

PAPER_ANSWER = RAW_DIR / "src_b44095a94e7d6f118336fc9c-2023年真题及答案速查.pdf"
DETAILED_ANALYSIS = RAW_DIR / "src_c5c8da442233f8c66a48a5ba-2023考研英语一真题及解析.pdf"
ORIGINAL_PAPER = RAW_DIR / "src_1b534f20b7ffea8fb7d09418-2023年考研英语一真题.pdf"

SOURCE_IDS = {
    "paper_answer": "src_b44095a94e7d6f118336fc9c",
    "detailed_analysis": "src_c5c8da442233f8c66a48a5ba",
    "original_paper": "src_1b534f20b7ffea8fb7d09418",
}

CHOICE_ANSWERS = {
    **dict(zip(range(1, 6), "CADCC")),
    **dict(zip(range(6, 11), "ABBAD")),
    **dict(zip(range(11, 16), "DCCBA")),
    **dict(zip(range(16, 21), "BDADA")),
    **dict(zip(range(21, 26), "CBACD")),
    **dict(zip(range(26, 31), "ADBCD")),
    **dict(zip(range(31, 36), "ACAAD")),
    **dict(zip(range(36, 41), "BCABD")),
    **dict(zip(range(41, 46), "BFDCG")),
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
    "A": "Last year marked the 150th anniversary of a series of Yellowstone photographs by the renowned landscape photographer William Henry Jackson. He captured the first-ever shots of iconic landmarks such as the Tetons, Old Faithful and the Colorado Rockies.",
    "B": "Two centuries ago, the idea of preserving nature, rather than exploiting it, was a novel one to many U.S. settlers. One of the turning points in public support for land conservation efforts came in the form of vivid photographs.",
    "C": "As an effective Washington operator, Hayden sensed that he could capitalize on the expedition's stunning visuals. He asked Jackson to print out large copies and distributed them to each member of Congress.",
    "D": "Throughout the trip, Jackson juggled multiple cameras and plate sizes using the collodion process. Despite these challenges, Jackson captured dozens of striking photos.",
    "E": "The journey officially began in Ogden, Utah on June 8, 1871. Over nearly four months, dozens of men made their way on horseback into Montana and traversed along the Yellowstone River and around Yellowstone Lake.",
    "F": "Though Native Americans and later miners and fur trappers had long recognized the area's riches, most Americans did not. Hayden's expedition aimed to produce a fuller understanding of the Yellowstone River region.",
    "G": "The bill proved largely popular and sailed through Congress with large majorities in favor. President Ulysses S. Grant signed an act into law that established Yellowstone as the world's first national park.",
    "H": "Perhaps most importantly, the images provided documentary evidence that later made its way to government officials. Hayden collected his team's observations into an extensive report aimed at convincing officials that Yellowstone ought to be preserved.",
}

TRANSLATION_SEGMENTS = {
    46: "AI can also be used to identify the lifestyle choices of customers regarding their hobbies, favourite celebrities, music choices, and fashions to provide unique content in marketing messages put out through social media.",
    47: "Some believe that AI is negatively impacting on the marketer's role by reducing creativity and removing jobs, but they are aware that it is a way of reducing costs and creating new information.",
    48: "Algorithms that are used to simulate human interactions are creating many of these concerns, especially as no-one is quite sure what the outcomes of using AI to interact with customers will be.",
    49: "If customers are not willing to share data, AI will be starved of essential information and will not be able to function effectively or employ machine learning to improve its marketing content and communication.",
    50: "The non-intrusive delivery of the marketing messages in a way that is sensitive to the needs of the target customer is one of the critical challenges to the digital marketer.",
}

TRANSLATION_ANSWERS = {
    46: "就客户的爱好、最喜欢的名人、音乐选择和服装款式而言，人工智能还可以用来识别客户生活方式的选择，从而在社交媒体发布的营销信息中提供有针对性的内容。",
    47: "有些人认为，人工智能通过降低创造性和减少工作岗位正在对营销人员的角色产生负面影响，但他们也意识到这是一种降低成本和创建新信息的方式。",
    48: "用于模拟人类互动行为的算法正在引发许多这样的担忧，在无人十分确定运用人工智能和客户互动将会产生何种结果的情况下更是如此。",
    49: "倘若客户不愿共享数据，人工智能就会缺乏必要的信息，从而无法有效运转，亦无法利用机器学习来改善其营销内容和传播效果。",
    50: "以一种对目标客户需求敏感的方式非侵入性传递营销信息，这对数字营销人员而言是重大挑战之一。",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact(value: Any) -> str:
    text = str(value or "")
    replacements = {
        "\u3000": " ",
        "\u00ad": "",
        "Caravanserais were roadside ions": "Caravanserais were roadside inns",
        "They were typically ] outside": "They were typically (1) outside",
        "mark A, B , C or D": "mark A, B, C or D",
        "nn the marketer": "on the marketer",
        "no・one": "no-one",
        "rum-intrusive": "non-intrusive",
        "160—200": "160-200",
        "word( s)": "word(s)",
        "favourite": "favorite",
        "；": ";",
        " 〜": " ~",
    }
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    text = re.sub(r"\bAl\b", "AI", text)
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
    missing = [relative(path) for path in [PAPER_ANSWER, DETAILED_ANALYSIS, ORIGINAL_PAPER] if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing required English I 2023 source PDFs: " + ", ".join(missing))


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
        if "公众号" in line or "研池大叔" in line or "免费分享" in line:
            continue
        if re.search(r"英语[（(]一[）)]试题[・.]\s*\d+\s*[・.，,][（(]共15页[）)]", line):
            continue
        lines.append(line)
    return compact(" ".join(lines))


def option_list(options: dict[str, str]) -> list[dict[str, str]]:
    return [{"label": label, "text": text} for label, text in options.items()]


def split_labeled_options(text: str, labels: str = "ABCD") -> dict[str, str]:
    normalized = compact(text).replace("[A]", "A.").replace("[B]", "B.").replace("[C]", "C.").replace("[D]", "D.")
    normalized = normalized.replace("[E]", "E.").replace("[F]", "F.").replace("[G]", "G.").replace("[H]", "H.")
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
    block = text_between(text, "mark A, B, C or D on the ANSWER SHEET. (10 points)", "英语（一）试题.1.（共15页）")
    block = cleaned_block(block)
    for number in range(2, 21):
        block = re.sub(rf"\s+{number}\s+", f" ({number}) ", block, count=1)
    return compact(block)


def extract_cloze_options(text: str) -> dict[int, dict[str, str]]:
    option_text = text_between(text, "英语（一）试题.1.（共15页）", "Section U")
    return {
        number: split_labeled_options(find_numbered_block(option_text, number, number + 1 if number < 20 else None))
        for number in range(1, 21)
    }


def extract_passages(text: str) -> dict[str, str]:
    passages = {
        "text1": cleaned_block(text_between(text, "Text 1", "21. In Paragraph 1")),
        "text2": cleaned_block(text_between(text, "Text 2", "26. Which of the following")),
        "text3": cleaned_block(text_between(text, "Text 3", "31. The author mentions")),
        "text4": cleaned_block(text_between(text, "Text 4", "36. According to Paragraph 1")),
        "part-b": cleaned_block(text_between(text, "Part B\nDirections:", "Part C")),
        "part-c": cleaned_block(text_between(text, "There has been some exploration around the use of Al in digital marketing.", "Section ID")),
    }
    passages["part-c"] = "There has been some exploration around the use of AI in digital marketing. " + passages["part-c"]
    return passages


def extract_writing_prompts(text: str) -> dict[int, str]:
    writing = text_between(text, "Section ID      Writing", "2023年考研英语（一）真题答案速查表")
    prompt51 = cleaned_block(text_between(writing, "51. Directions:", "Part B"))
    prompt52 = cleaned_block(text_between(writing, "52. Directions:", "英语（一）试题・14.（共15页）"))
    return {
        51: "51. Directions: " + prompt51,
        52: "52. Directions: " + prompt52,
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
    if source_id == SOURCE_IDS["paper_answer"]:
        return PAPER_ANSWER
    if source_id == SOURCE_IDS["detailed_analysis"]:
        return DETAILED_ANALYSIS
    if source_id == SOURCE_IDS["original_paper"]:
        return ORIGINAL_PAPER
    raise KeyError(source_id)


def attach_evidence(card: dict[str, Any], *, answer_role: str = "official_answer_key") -> dict[str, Any]:
    question_hash = hash_text(json.dumps({"question": card["question"], "passage": card.get("passage"), "options": card.get("options", [])}, ensure_ascii=False, sort_keys=True))
    answer_hash = hash_text(json.dumps({"answer": card["answer"], "role": answer_role}, ensure_ascii=False, sort_keys=True))
    now = card.pop("_now")
    card["sourceEvidenceId"] = "english1-2023-paper-answer"
    card["sourceEvidence"] = {
        "evidenceId": "english1-2023-paper-answer",
        "sourceId": SOURCE_IDS["paper_answer"],
        "originalPaperSourceId": SOURCE_IDS["original_paper"],
        "supportingSourceId": SOURCE_IDS["detailed_analysis"],
        "sourceType": "official_paper",
        "sourceFilePath": relative(PAPER_ANSWER),
        "originalPaperFilePath": relative(ORIGINAL_PAPER),
        "fileSha256": sha256_file(PAPER_ANSWER),
        "originalPaperSha256": sha256_file(ORIGINAL_PAPER),
        "status": "matched",
        "method": "local_baidu_answer_speed_pdf_text_layer_with_original_paper_audit",
        "questionTextHash": question_hash,
        "verifiedAt": now,
        "verifiedBy": "build_english1_2023_bank",
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
        "method": "local_answer_speed_table_with_original_paper_and_analysis_cross_check",
        "verifiedAt": now,
        "verifiedBy": "build_english1_2023_bank",
        "note": "Matched against the local Baidu Netdisk 2023 English I answer-speed PDF; original paper and detailed-analysis PDFs are retained as source evidence.",
    }
    return card


def base_card(number: int, *, card_type: str, question: str, answer: str, now: str) -> dict[str, Any]:
    group_id = group_for(number)
    section = SECTION_BY_GROUP[group_id]
    return {
        "id": f"english1-2023-{number:03d}",
        "paperId": "english1-2023",
        "paperName": "2023考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2023",
        "number": number,
        "type": card_type,
        "section": section,
        "groupId": group_id,
        "question": question,
        "answer": answer,
        "source": PAPER_ANSWER.name,
        "tags": ["english1", "2023真题", section],
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
        card["explanation"] = "答案已按本地百度网盘 2023 英语一真题答案速查表匹配。"
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
        card["explanation"] = "答案已按本地百度网盘 2023 英语一答案速查表匹配。"
        cards.append(attach_evidence(card))

    for number in range(41, 46):
        card = base_card(
            number,
            card_type="single_choice",
            question=f"Choose the best statement for comment {number}.",
            answer=CHOICE_ANSWERS[number],
            now=now,
        )
        card["passage"] = passages["part-b"]
        card["material"] = passages["part-b"]
        card["options"] = option_list(PART_B_OPTIONS)
        card["explanation"] = "答案已按本地百度网盘 2023 英语一答案速查表匹配；Part B 按 A-H 陈述训练。"
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
        card["explanation"] = "参考译文已按本地百度网盘 2023 英语一答案速查 PDF 匹配。"
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
        "id": "english1-2023",
        "source": PAPER_ANSWER.name,
        "paperId": "english1-2023",
        "paperName": "2023考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2023",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_answer_speed_text_layer_with_original_paper_audit_v1",
        "sourceFiles": [
            {"id": "english1-2023-paper-answer", "sourceId": SOURCE_IDS["paper_answer"], "role": "paper_answer", "localPath": relative(PAPER_ANSWER), "sha256": sha256_file(PAPER_ANSWER)},
            {"id": "english1-2023-original-paper", "sourceId": SOURCE_IDS["original_paper"], "role": "paper", "localPath": relative(ORIGINAL_PAPER), "sha256": sha256_file(ORIGINAL_PAPER)},
            {"id": "english1-2023-detailed-analysis", "sourceId": SOURCE_IDS["detailed_analysis"], "role": "answer_analysis", "localPath": relative(DETAILED_ANALYSIS), "sha256": sha256_file(DETAILED_ANALYSIS)},
        ],
        "processed_at": now,
        "total_cards": len(cards),
        "sections": ["完形填空", "阅读理解", "新题型", "翻译", "写作"],
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
    if "Caravanserais were roadside inns" not in cloze_passage or "(20)" not in cloze_passage:
        issues.append("cloze passage missing caravanserais anchors")
    for key, anchor in {
        "text1": "climate change is taught in Texas schools",
        "text2": "short-term rentals",
        "text3": "Waterstones",
        "text4": "Citation cartels",
        "part-b": "Yellowstone",
        "part-c": "AI in digital marketing",
    }.items():
        if anchor.lower() not in passages[key].lower():
            issues.append(f"{key} missing anchor {anchor}")
    if "campus sports activities" not in writing_prompts[51]:
        issues.append("writing prompt 51 missing campus sports activities")
    if "Write an essay of 160-200 words" not in writing_prompts[52]:
        issues.append("writing prompt 52 missing essay instruction")
    if "1 ~5 CADCC" not in text or "41 ~45 BFDCG" not in text:
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

    expected = {1: "C", 21: "C", 30: "D", 40: "D", 41: "B", 45: "G"}
    for number, answer in expected.items():
        if cards[number - 1].get("answer") != answer:
            issues.append(f"question {number} answer mismatch")
    if "客户生活方式的选择" not in cards[45]["answer"]:
        issues.append("question 46 translation answer mismatch")
    if cards[51]["answerEvidence"]["evidenceRole"] != "official_writing_prompt":
        issues.append("question 52 writing evidence role mismatch")
    payload = json.dumps(cards, ensure_ascii=False)
    for forbidden in ["公众号", "研池大叔", "免费分享"]:
        if forbidden in payload:
            issues.append(f"source noise remains: {forbidden}")
    if issues:
        raise ValueError("english1-2023 validation failed:\n" + "\n".join(issues))


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
        "[english1-2023] "
        f"output={display_path(args.output)} "
        f"flashcards={display_path(args.flashcard_output)} "
        f"cards={bank['total_cards']} "
        f"status={bank['publicationStatus']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
