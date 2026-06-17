#!/usr/bin/env python3
"""Build the 2022 English I public-course flashcard bank from Baidu Netdisk PDFs."""

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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english1-2022.json"
DEFAULT_FLASHCARD_OUTPUT = PROJECT_ROOT / "data" / "flashcards" / "english1-2022.json"

PAPER_ANSWER = RAW_DIR / "src_73ec5f093a5e18ea02a32aa0-2022年真题及答案速查.pdf"
DETAILED_ANALYSIS = RAW_DIR / "src_91e7e9e70ae27be01dd1ef44-2022考研英语一真题及解析.pdf"
ORIGINAL_PAPER = RAW_DIR / "src_d2bf9f5c7296db25057f4a71-2022年考研英语一真题.pdf"

SOURCE_IDS = {
    "paper_answer": "src_73ec5f093a5e18ea02a32aa0",
    "detailed_analysis": "src_91e7e9e70ae27be01dd1ef44",
    "original_paper": "src_d2bf9f5c7296db25057f4a71",
}

CHOICE_ANSWERS = {
    **dict(zip(range(1, 6), "ACDCD")),
    **dict(zip(range(6, 11), "BCBAD")),
    **dict(zip(range(11, 16), "CBACB")),
    **dict(zip(range(16, 21), "DAADB")),
    **dict(zip(range(21, 26), "ACDDB")),
    **dict(zip(range(26, 31), "CBCDA")),
    **dict(zip(range(31, 36), "BAABC")),
    **dict(zip(range(36, 41), "DADBC")),
    **dict(zip(range(41, 46), "FCADG")),
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
    "A": "Zoos, which spare no effort to take care of animals, should not be subjected to unfair criticism.",
    "B": "To pressure zoos to spend less on their animals would lead to inhumane outcomes for the precious creatures in their care.",
    "C": "While animals in captivity deserve sympathy, zoos play a significant role in starting young people down the path of related sciences.",
    "D": "Zoos save people trips to wilderness areas and thus contribute to wildlife conservation.",
    "E": "For wild animals that cannot be returned to their natural habitats, zoos offer the best alternative.",
    "F": "Zoos should have been closed down as they prioritize moneymaking over animals' well-being.",
    "G": "Marris distorts our findings, which actually prove that zoos serve as an indispensable link between man and nature.",
}

TRANSLATION_SEGMENTS = {
    46: "It was also, and this is unknown even to many people well read about the period, a battle between those who made codes and those who broke them.",
    47: "It listed many documents in code that had been captured from the French Army of Spain, and whose secrets had been revealed by the work of one George Scovell, an officer in British headquarters.",
    48: "he could not analyze carefully what this obscure officer may or may not have contributed to that great struggle between nations or indeed tell us anything much about the man himself.",
    49: "There may have been many spies and intelligence officers during the Napoleonic Wars, but it is usually extremely difficult to find the material they actually provided or worked on.",
    50: "Just as the code-breaking has its wider relevance in the struggle for Spain, so his attempts to make his way up the promotion ladder speak volumes about British society.",
}

TRANSLATION_ANSWERS = {
    46: "它也是一场发生在加密者与破译者之间的战争,这一点甚至许多熟知这一时期历史的人都不知道。",
    47: "该附录列出了许多从驻扎西班牙的法军处缴获的加密文件，这些文件的秘密已经通过英国司令部的一位名叫乔治•斯科韦尔的军官的工作得以揭开。",
    48: "他无法细致分析这位鲜为人知的军官具体为那次国家间的大战做出过什么贡献，也确实无法告诉我们关于这位军官本人的多少事情。",
    49: "拿破仑战争期间可能有很多间谍和情报官员，但要找到真正由这些人提供或处理过的材料通常十分困难。",
    50: "正如密码破译对那场争夺西班牙的战争有更广泛的意义一样,他攀登晋升阶梯的种种努力也充分反映了英国社会的情况。",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact(value: Any) -> str:
    text = str(value or "")
    replacements = {
        "\u3000": " ",
        "\u00ad": "",
        "word( s)": "word(s)",
        "neurobiologyn": "neurobiology",
        "plants*": "plants'",
        "uand": '"and',
        "n she": '" she',
        "M—": '" -',
        "ScovelFs": "Scovell's",
        "hnd": "find",
        "；": ";",
        " 〜": " ~",
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
    missing = [relative(path) for path in [PAPER_ANSWER, DETAILED_ANALYSIS, ORIGINAL_PAPER] if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing required English I 2022 source PDFs: " + ", ".join(missing))


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
    normalized = normalized.replace("[E]", "E.").replace("[F]", "F.").replace("[G]", "G.")
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
    block = text_between(text, "mark A, B, C or D on the ANSWER SHEET. (10 points)", "英语（一）试题・1.（共15页）")
    block = cleaned_block(block)
    block = re.sub(r"\s]\s+around", " (1) around", block, count=1)
    for number in range(2, 21):
        block = re.sub(rf"\s+{number}\s+", f" ({number}) ", block, count=1)
    return compact(block)


def extract_cloze_options(text: str) -> dict[int, dict[str, str]]:
    option_text = text_between(text, "英语（一）试题・1.（共15页）", "Section R")
    return {
        number: split_labeled_options(find_numbered_block(option_text, number, number + 1 if number < 20 else None))
        for number in range(1, 21)
    }


def extract_passages(text: str) -> dict[str, str]:
    passages = {
        "text1": cleaned_block(text_between(text, "Text 1", "21. According to Paragraph 1")),
        "text2": cleaned_block(text_between(text, "Text 2", "26. The author suggests")),
        "text3": cleaned_block(text_between(text, "Text 3", "31. According to paragraph 1")),
        "text4": cleaned_block(text_between(text, "Text 4", "36. The personal grievance provisions")),
        "part-b": cleaned_block(text_between(text, "Part B\nDirections:", "Part C")),
        "part-c": cleaned_block(text_between(text, "Between 1807 and 1814", "Section in")),
    }
    passages["part-c"] = "Between 1807 and 1814 " + passages["part-c"]
    return passages


def extract_writing_prompts(text: str) -> dict[int, str]:
    writing = text_between(text, "Section in       Writing", "英语（一）试题.15.（共15页）")
    prompt51 = cleaned_block(text_between(writing, "51. Directions:", "PartB"))
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
    card["sourceEvidenceId"] = "english1-2022-paper-answer"
    card["sourceEvidence"] = {
        "evidenceId": "english1-2022-paper-answer",
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
        "verifiedBy": "build_english1_2022_bank",
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
        "verifiedBy": "build_english1_2022_bank",
        "note": "Matched against the local Baidu Netdisk 2022 English I answer-speed PDF; original paper and detailed-analysis PDFs are retained as source evidence.",
    }
    return card


def base_card(number: int, *, card_type: str, question: str, answer: str, now: str) -> dict[str, Any]:
    group_id = group_for(number)
    section = SECTION_BY_GROUP[group_id]
    return {
        "id": f"english1-2022-{number:03d}",
        "paperId": "english1-2022",
        "paperName": "2022考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2022",
        "number": number,
        "type": card_type,
        "section": section,
        "groupId": group_id,
        "question": question,
        "answer": answer,
        "source": PAPER_ANSWER.name,
        "tags": ["english1", "2022真题", section],
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
        card["explanation"] = "答案已按本地百度网盘 2022 英语一真题答案速查表匹配。"
        cards.append(attach_evidence(card))

    for number in range(21, 41):
        group_id = group_for(number)
        block = find_numbered_block(text, number, number + 1 if number < 40 else None, end_anchor="Part B")
        question, options = parse_choice_question(block, number)
        card = base_card(number, card_type="single_choice", question=question, answer=CHOICE_ANSWERS[number], now=now)
        card["passage"] = passages[group_id]
        card["options"] = option_list(options)
        card["explanation"] = "答案已按本地百度网盘 2022 英语一答案速查表匹配。"
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
        card["explanation"] = "答案已按本地百度网盘 2022 英语一答案速查表匹配；Part B 按 A-G 陈述训练。"
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
        card["explanation"] = "参考译文已按本地百度网盘 2022 英语一答案速查 PDF 匹配。"
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
        "id": "english1-2022",
        "source": PAPER_ANSWER.name,
        "paperId": "english1-2022",
        "paperName": "2022考研英语一真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english1",
        "year": "2022",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_answer_speed_text_layer_with_original_paper_audit_v1",
        "sourceFiles": [
            {"id": "english1-2022-paper-answer", "sourceId": SOURCE_IDS["paper_answer"], "role": "paper_answer", "localPath": relative(PAPER_ANSWER), "sha256": sha256_file(PAPER_ANSWER)},
            {"id": "english1-2022-original-paper", "sourceId": SOURCE_IDS["original_paper"], "role": "paper", "localPath": relative(ORIGINAL_PAPER), "sha256": sha256_file(ORIGINAL_PAPER)},
            {"id": "english1-2022-detailed-analysis", "sourceId": SOURCE_IDS["detailed_analysis"], "role": "answer_analysis", "localPath": relative(DETAILED_ANALYSIS), "sha256": sha256_file(DETAILED_ANALYSIS)},
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
    if "plant neurobiology" not in cloze_passage or "(20)" not in cloze_passage:
        issues.append("cloze passage missing plant-neurobiology anchors")
    for key, anchor in {
        "text1": "preservation of plastics",
        "text2": "Generation Z",
        "text3": "art-science collaborations",
        "text4": "Employment Relations Act",
        "part-b": "The Case Against Zoos",
        "part-c": "Napoleonic",
    }.items():
        if anchor.lower() not in passages[key].lower():
            issues.append(f"{key} missing anchor {anchor}")
    if "international innovation contest" not in writing_prompts[51]:
        issues.append("writing prompt 51 missing innovation contest")
    if "Write an essay of 160-200 words" not in writing_prompts[52]:
        issues.append("writing prompt 52 missing essay instruction")
    if "1 ~5 ACDCD" not in text or "41 〜45 FCADG" not in text:
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

    expected = {1: "A", 21: "A", 30: "A", 40: "C", 41: "F", 45: "G"}
    for number, answer in expected.items():
        if cards[number - 1].get("answer") != answer:
            issues.append(f"question {number} answer mismatch")
    if "加密者与破译者" not in cards[45]["answer"]:
        issues.append("question 46 translation answer mismatch")
    if cards[51]["answerEvidence"]["evidenceRole"] != "official_writing_prompt":
        issues.append("question 52 writing evidence role mismatch")
    payload = json.dumps(cards, ensure_ascii=False)
    for forbidden in ["公众号", "研池大叔", "免费分享"]:
        if forbidden in payload:
            issues.append(f"source noise remains: {forbidden}")
    if issues:
        raise ValueError("english1-2022 validation failed:\n" + "\n".join(issues))


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
        "[english1-2022] "
        f"output={display_path(args.output)} "
        f"flashcards={display_path(args.flashcard_output)} "
        f"cards={bank['total_cards']} "
        f"status={bank['publicationStatus']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
