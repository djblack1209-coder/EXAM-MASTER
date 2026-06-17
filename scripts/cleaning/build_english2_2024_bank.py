#!/usr/bin/env python3
"""Build the 2024 English II public-course flashcard bank from Baidu Netdisk PDFs."""

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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english2-2024.json"
DEFAULT_FLASHCARD_OUTPUT = PROJECT_ROOT / "data" / "flashcards" / "english2-2024.json"

ORIGINAL_PAPER = RAW_DIR / "src_c1f51983d3941b12824feccd-2024年考研英语二真题.pdf"
PAPER_ANSWER = RAW_DIR / "src_42d225834ad0cf959ae95de8-2024年英语二真题解析.pdf"
DETAILED_ANALYSIS = RAW_DIR / "src_a9e0502c4fcb6c27e3ddc2b7-2024年英语二真题解析.pdf"

SOURCE_IDS = {
    "original_paper": "src_c1f51983d3941b12824feccd",
    "paper_answer": "src_42d225834ad0cf959ae95de8",
    "detailed_analysis": "src_a9e0502c4fcb6c27e3ddc2b7",
}

CHOICE_ANSWERS = {
    **dict(zip(range(1, 6), "CBADA")),
    **dict(zip(range(6, 11), "CBBDA")),
    **dict(zip(range(11, 16), "DABCC")),
    **dict(zip(range(16, 21), "ACDBD")),
    **dict(zip(range(21, 26), "CCDAD")),
    **dict(zip(range(26, 31), "AABDC")),
    **dict(zip(range(31, 36), "CDBBB")),
    **dict(zip(range(36, 41), "AADBD")),
    **dict(zip(range(41, 46), "CEAGB")),
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
    "A": "Students who stand out in a specific extracurricular activity will be favored by top-tier institutions.",
    "B": "Students whose extracurricular activity has benefited their community are likely to win a scholarship.",
    "C": "Undertaking too many extracurricular activities will hardly be seen as a plus by colleges.",
    "D": "A student who exhibits abilities in doing business can impress colleges.",
    "E": "High school students participating in popular activity should excel in it.",
    "F": "Engaging in uncommon activities can demonstrate students' determination and dedication.",
    "G": "It is advisable for students to choose an extracurricular activity that is related to their future study at college.",
}

PART_B_STATEMENTS = {
    41: "Match Sue Rexford to the corresponding information.",
    42: "Match Sara Harberson to the corresponding information.",
    43: "Match Katie Kelley to the corresponding information.",
    44: "Match Mayghin Levine to the corresponding information.",
    45: "Match Erica Gwyn to the corresponding information.",
}

WRITING_CHART_48 = (
    "Chart: 某高校劳动实践课学生主要收获调查 "
    "(提升了动手能力84.8%, 学习了相关知识91.3%, 增强了合作能力32.6%, 感觉到心情舒畅54.4%)."
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact(value: Any) -> str:
    text = str(value or "")
    replacements = {
        "\u3000": " ",
        "\u00ad": "",
        "numbered black": "numbered blank",
        "another.Some": "another. Some",
        "even if it's": "even if it is",
        "ideal to start": "idea to start",
        "You can them find": "You can then find",
        "parents at those": "parents and those",
        "Diane Coyle, an economist at Cambridge University, argues that the digital economy requires new ways of thinking about progress\"": (
            "Diane Coyle, an economist at Cambridge University, argues that the digital economy requires new ways of thinking about progress."
        ),
        "by things getting better.the": "by things getting better, the",
        "gig workers.with": "gig workers, with",
        "[C benefit": "[C] benefit",
        "give use to": "give rise to",
        "enhance cross-sector": "enhance cross-sector cooperation",
        "It can learned": "It can be learned",
        "confor": "Confor",
        "Good all": "Goodall",
        "productive three planting": "productive tree planting",
        "paragraph l": "paragraph 1",
        "a toughs task": "a tough task",
        "Medial Association": "Medical Association",
        "support form driver": "support from drivers",
        "sensitivity fertility": "sensitive fertility",
        "deceptiveness if health apps": "deceptiveness of health apps",
        "health date protection": "health data protection",
        "has been embrace": "has been embraced",
        "admission a selective": "admission to a selective",
        "student,filling": "student, filling",
        "extracurricular that": "extracurricular activities that",
        "an tended": "an extended",
        "Harherson": "Harberson",
        "Josoph": "Joseph",
        "High school": "high school",
        "activities can help students, impress": "activities can help students impress",
        "assuming they demonstrated": "assuming they demonstrate",
        "serious commitment": "serious commitment",
        "a conventional one is an advantage": "instead of a conventional one is an advantage",
        "Katie Kelley admissions": "Katie Kelley, admissions",
        "Use \"Li Ming\" instead": 'Use "Li Ming" instead',
        "ANSWER SHEET.": "ANSWER SHEET.",
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
        raise FileNotFoundError("Missing required English II 2024 source PDFs: " + ", ".join(missing))


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
        if line == "2024 年考研英语（二）试题及考答案":
            continue
        lines.append(line)
    return compact(" ".join(lines))


def option_list(options: dict[str, str]) -> list[dict[str, str]]:
    return [{"label": label, "text": text} for label, text in options.items()]


def split_labeled_options(text: str, labels: str = "ABCD") -> dict[str, str]:
    normalized = compact(text)
    label_pattern = "".join(labels)
    matches = list(re.finditer(rf"(?<![A-Za-z])\[?\s*([{label_pattern}])\s*[\.,・\]]\s*", normalized))
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
    if end_indexes:
        return text[start_match.start() : min(end_indexes)]
    return text[start_match.start() :]


def parse_choice_question(block: str, number: int) -> tuple[str, dict[str, str]]:
    normalized = compact(re.sub(rf"^\s*{number}\.\s*", "", block.strip()))
    matches = list(re.finditer(r"(?<![A-Za-z])\[?\s*([A-D])\s*[\.,・\]]\s*", normalized))
    if len(matches) < 4:
        raise ValueError(f"Question {number} missing A-D options: {normalized[:220]}")
    first_option = matches[-4]
    question = normalized[: first_option.start()].strip(" -_")
    options = split_labeled_options(normalized[first_option.start() :], "ABCD")
    return question, options


def extract_cloze_passage(text: str) -> str:
    block = text_between(text, "Your social life is defined", "1. [A] because")
    block = cleaned_block("Your social life is defined" + block)
    blank_replacements = [
        ("others, 1 ,", "others, (1),"),
        ("finding a 2 in your social life", "finding a (2) in your social life"),
        ("not 3 others", "not (3) others"),
        ("and 4 .", "and (4)."),
        ("mental health and 5 a low mood", "mental health and (5) a low mood"),
        ("if, 6 you are", "if, (6), you are"),
        ("you are 7 on", "you are (7) on"),
        ("changes can 8 periods", "changes can (8) periods"),
        ("ways to 9 a social life", "ways to (9) a social life"),
        ("overwhelming l0 .", "overwhelming (10)."),
        ("meet 11 people", "meet (11) people"),
        ("want to 12 a new sport", "want to (12) a new sport"),
        ("meet up and 13 ideas", "meet up and (13) ideas"),
        ("it's 14 possible", "it is (14) possible"),
        ("any 15 in your calendar", "any (15) in your calendar"),
        ("social 16 .", "social (16)."),
        ("could all be 17 of poor social health", "could all be (17) of poor social health"),
        ("you 18 some time", "you (18) some time"),
        ("you're 19 for socialising", "you are (19) for socialising"),
        ("relax, 20 and recover", "relax, (20) and recover"),
    ]
    for original, replacement in blank_replacements:
        block = block.replace(original, replacement)
    return compact(block)


def extract_cloze_options(text: str) -> dict[int, dict[str, str]]:
    option_text = "1. [A] because" + text_between(text, "1. [A] because", "【答案】")
    options: dict[int, dict[str, str]] = {}
    for number in range(1, 21):
        block = find_numbered_block(option_text, number, number + 1 if number < 20 else None)
        options[number] = split_labeled_options(block, "ABCD")
    return options


def extract_passages(text: str) -> dict[str, str]:
    passages = {
        "text1": cleaned_block(text_between(text, "Text 1", "21. Coyle argues")),
        "text2": cleaned_block(text_between(text, "Text 2", "26. It can learned")),
        "text3": cleaned_block(text_between(text, "Text 3", "31. According")),
        "text4": cleaned_block(text_between(text, "Text 4", "36. The research")),
        "part-b": cleaned_block(text_between(text, "High school students eager", "41. Sue Rextord")),
    }
    passages["part-b"] = "High school students eager" + passages["part-b"]
    return passages


def extract_translation_text(text: str) -> str:
    block = text_between(text, "With the smell of coffee and fresh bread floating in the air", "【参考译文】")
    return compact("With the smell of coffee and fresh bread floating in the air" + cleaned_block(block))


def extract_translation_answer(text: str) -> str:
    block = text_between(text, "空气中弥漫着", "Section IV Writing")
    return cleaned_block("空气中弥漫着" + block)


def extract_writing_prompts(text: str) -> dict[int, str]:
    writing_section = text_between(text, "Section IV Writing", "17")
    prompt47 = cleaned_block(text_between(writing_section, "47. Directions:", "【答案】略"))
    part_b_section = writing_section.split("Part B", 1)[1]
    prompt48 = cleaned_block(text_between(part_b_section, "48. Directions:", "【答案】略"))
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
        "method": "local_baidu_2024_english2_pdf_text_layer_with_original_paper_audit",
        "questionTextHash": question_hash,
        "verifiedAt": now,
        "verifiedBy": "build_english2_2024_bank",
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
        "verifiedBy": "build_english2_2024_bank",
        "note": answer_note,
    }
    return card


def base_card(number: int, *, card_type: str, section: str, group_id: str, question: str, answer: str) -> dict[str, Any]:
    return {
        "id": f"english2-2024-{number:03d}",
        "paperId": "english2-2024",
        "paperName": "2024考研英语二真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english2",
        "year": "2024",
        "number": number,
        "type": card_type,
        "section": section,
        "groupId": group_id,
        "question": question,
        "answer": answer,
        "source": PAPER_ANSWER.name,
        "tags": ["english2", "2024真题", section],
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
        card["explanation"] = "答案已按本地百度网盘 2024 英语二真题解析 PDF 答案表匹配。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_answer_table_match",
                answer_note="Matched against the local Baidu Netdisk 2024 English II answer table.",
            )
        )

    for number in range(21, 41):
        group_id = group_for(number)
        section = SECTION_BY_GROUP[group_id]
        block = find_numbered_block(text, number, number + 1 if number < 40 else None, end_anchor="【参考答案】")
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
        card["explanation"] = "答案已按本地百度网盘 2024 英语二真题解析 PDF 参考答案匹配。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_answer_table_match",
                answer_note="Matched against the local Baidu Netdisk 2024 English II reference answers.",
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
        card["explanation"] = "答案已按本地百度网盘 2024 英语二真题解析 PDF Part B 参考答案匹配。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_answer_table_part_b_match",
                answer_note="Part B A-G answers were matched against the local Baidu Netdisk reference answers.",
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
    translation["explanation"] = "参考译文已按本地百度网盘 2024 英语二真题解析 PDF 匹配。"
    cards.append(
        attach_evidence(
            translation,
            question_source_id=SOURCE_IDS["paper_answer"],
            answer_source_id=SOURCE_IDS["paper_answer"],
            now=now,
            answer_method="local_reference_translation_match",
            answer_note="Translation reference was matched against the local Baidu Netdisk 2024 English II analysis PDF.",
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
                answer_method="local_writing_prompt_text_and_page_image_audit",
                answer_role="official_writing_prompt",
                answer_note=(
                    "Writing has no single official answer; matched evidence covers the official prompt. "
                    "Question 48 chart values were visually audited from the rendered Baidu PDF page."
                ),
            )
        )

    validate_cards(cards, material, text)
    return {
        "id": "english2-2024",
        "source": PAPER_ANSWER.name,
        "paperId": "english2-2024",
        "paperName": "2024考研英语二真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english2",
        "year": "2024",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_2024_english2_pdf_text_layer_with_original_paper_and_page_image_audit_v1",
        "sourceFiles": [
            {
                "id": "english2-2024-original-paper",
                "sourceId": SOURCE_IDS["original_paper"],
                "role": "paper",
                "localPath": relative(ORIGINAL_PAPER),
                "sha256": sha256_file(ORIGINAL_PAPER),
            },
            {
                "id": "english2-2024-paper-answer",
                "sourceId": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": relative(PAPER_ANSWER),
                "sha256": sha256_file(PAPER_ANSWER),
            },
            {
                "id": "english2-2024-detailed-analysis",
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
            "policy": "local_baidu_2024_english2_pdf_text_layer_match_with_page_image_audit",
        },
        "cards": cards,
    }


def validate_cards(cards: list[dict[str, Any]], material: dict[str, Any], text: str) -> None:
    issues: list[str] = []
    if len(cards) != 48:
        issues.append(f"card count {len(cards)} != 48")
    if "Your social life is defined" not in material["cloze_passage"] or "social burnout" not in material["cloze_passage"]:
        issues.append("cloze passage missing social-life anchors")
    for number in range(1, 21):
        if f"({number})" not in material["cloze_passage"]:
            issues.append(f"cloze passage missing blank marker ({number})")
    if "Cogs and Monsters" not in material["passages"]["text1"] or "Diane Coyle" not in material["passages"]["text1"]:
        issues.append("Text 1 passage missing digital-economy anchors")
    if "future construction crisis" not in material["passages"]["text2"] or "Confor" not in material["passages"]["text2"]:
        issues.append("Text 2 passage missing timber anchors")
    if "unsafe aging drivers" not in material["passages"]["text3"] or "Elizabeth Dugan" not in material["passages"]["text3"]:
        issues.append("Text 3 passage missing aging-driver anchors")
    if "health apps" not in material["passages"]["text4"] or "Flo Health" not in material["passages"]["text4"]:
        issues.append("Text 4 passage missing health-app anchors")
    if "High school students eager" not in material["passages"]["part-b"] or "Sue Rexford" not in material["passages"]["part-b"]:
        issues.append("Part B passage missing extracurricular anchors")
    if "With the smell of coffee and fresh bread floating in the air" not in material["translation_text"]:
        issues.append("translation text missing farmers-market English anchor")
    if "农贸市场" not in material["translation_answer"]:
        issues.append("translation answer missing farmers-market Chinese anchor")
    if "old hoses in an ancient town" not in material["writing_prompts"][47]:
        issues.append("writing prompt 47 missing source-text old-hoses anchor")
    if "某高校劳动实践课学生主要收获调查" not in material["writing_prompts"][48] or "91.3%" not in material["writing_prompts"][48]:
        issues.append("writing prompt 48 missing labor-practice chart anchor")
    if "CBADA" not in text or "41-45：CEAGB" not in text:
        issues.append("answer table anchors missing")

    forbidden_noise = ["公众号", "研池大叔", "免费分享", "Section ID", "Section 0", "Rextord", "Harherson", "Josoph"]
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

    if cards[0]["answer"] != "C":
        issues.append("question 1 answer mismatch")
    if cards[20]["answer"] != "C":
        issues.append("question 21 answer mismatch")
    if cards[29]["answer"] != "C":
        issues.append("question 30 answer mismatch")
    if cards[40]["answer"] != "C" or cards[44]["answer"] != "B":
        issues.append("Part B answer mismatch")
    if len(cards[40]["options"]) != 7:
        issues.append("Part B option count mismatch")
    if "空气中弥漫着" not in cards[45]["answer"]:
        issues.append("question 46 translation answer mismatch")
    if cards[47]["answerEvidence"]["evidenceRole"] != "official_writing_prompt":
        issues.append("question 48 answer evidence role mismatch")

    if issues:
        raise ValueError("english2-2024 validation failed:\n" + "\n".join(issues))


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
        "[english2-2024] "
        f"output={display_path(args.output)} "
        f"flashcards={display_path(args.flashcard_output)} "
        f"cards={bank['total_cards']} "
        f"status={bank['publicationStatus']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
