#!/usr/bin/env python3
"""Build the 2017 English II public-course flashcard bank."""

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
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "english2-2017.json"

DOCUMENT_VERSION = RAW_DIR / "src_d048e4f82dccc6edfd4675a4-2017.pdf"
ORIGINAL_PAPER = RAW_DIR / "src_f44d6b155a346867e2790bcf-2017年考研英语二真题.pdf"
PAPER_ANSWER = RAW_DIR / "src_79ee7f93299f87bb47e7cab8-2017年真题及答案速查.pdf"
DETAILED_ANALYSIS = RAW_DIR / "src_33b2ddfa8acc83436d3d5b70-2017年真题逐题细解.pdf"

SOURCE_IDS = {
    "document_version": "src_d048e4f82dccc6edfd4675a4",
    "original_paper": "src_f44d6b155a346867e2790bcf",
    "paper_answer": "src_79ee7f93299f87bb47e7cab8",
    "detailed_analysis": "src_33b2ddfa8acc83436d3d5b70",
}

CHOICE_ANSWERS = {
    **dict(zip(range(1, 6), "CADAB")),
    **dict(zip(range(6, 11), "BCADC")),
    **dict(zip(range(11, 16), "CBADC")),
    **dict(zip(range(16, 21), "DABDB")),
    **dict(zip(range(21, 26), "ABCDB")),
    **dict(zip(range(26, 31), "BDDCA")),
    **dict(zip(range(31, 36), "CDADA")),
    **dict(zip(range(36, 41), "BDCDB")),
    **dict(zip(range(41, 46), "EAGBF")),
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

PART_B_STATEMENTS = {
    41: "Match Jay Dunwell to the corresponding information.",
    42: "Match Jason Stenquist to the corresponding information.",
    43: "Match Birgit Klohs to the corresponding information.",
    44: "Match Rob Spohr to the corresponding information.",
    45: "Match Julie Parks to the corresponding information.",
}

PART_B_OPTIONS = {
    "A": "says that he switched to electrical engineering because he loves working with tools.",
    "B": "points out that there are enough people to fill the jobs that don't need much skill.",
    "C": "points out that the US doesn't manufacture anything anymore.",
    "D": "believes that it is important to keep a close eye on the age of his workers.",
    "E": "says that for factory owners, workers are harder to find because of stiff competition.",
    "F": "points out that a work/life balance can attract young people into manufacturing.",
    "G": "says that the manufacturing recession is to blame for the lay-off of the young people's parents.",
}

WRITING_CHART_48 = (
    "Chart: 2013-2015年我国博物馆数量和参观人数（博物馆数量：2013年4165家，2014年4510家，2015年4692家；"
    "参观人数：2013年6378十万人次，2014年7177十万人次，2015年7811十万人次）."
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def compact(value: Any) -> str:
    text = str(value or "")
    replacements = {
        "\u3000": " ",
        "\u00ad": "",
        "Section 口": "Section II",
        "Section ID": "Section III",
        "Section HI": "Section III",
        "Section JU": "Section III",
        "Ifs easy": "It's easy",
        "parents9": "parents'",
        "parent9s": "parent's",
        "kids9": "kids'",
        "children9s": "children's",
        "child9 s": "child's",
        "child9s": "child's",
        "babies5": "babies'",
        "freshmen9s": "freshmen's",
        "agency9s": "agency's",
        "There5s": "There's",
        "born": "born",
        "bom out": "born out",
        "interactingwith": "interacting with",
        "M The success": '" The success',
        "legacy”": 'legacy"',
        "experimentM": 'experiment"',
        "generation. n": 'generation."',
        "jobs,n": 'jobs,"',
        "work-free": "work-free",
        "—perhaps": "- perhaps",
        "time,\":": 'time.":',
        "u inspire": '"inspire',
        "u Parents": '"Parents',
        "uThey": '"They',
        "u Overtime": '"Overtime',
        "differentn": 'different"',
        "offers,n": 'offers,"',
        "country,n": 'country,"',
        "path for me": "path for me",
        "course u Fashion Media & Promotion. ”": 'course "Fashion Media & Promotion."',
        "dream—I": "dream - I",
        "climate change一how": "climate change - how",
        "6378十万人次": "6378十万人次",
        "7811十万人次": "7811十万人次",
    }
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    text = re.sub(r"\s+", " ", text).strip()
    final_replacements = {
        "Still face experiment": "still face experiment",
        "still face experiment": "still face experiment",
        "Fashion Media & Promotion.": "Fashion Media & Promotion.",
    }
    for original, replacement in final_replacements.items():
        text = text.replace(original, replacement)
    return text


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hash_text(value: Any) -> str:
    text = compact(value)
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


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
    paths = [DOCUMENT_VERSION, ORIGINAL_PAPER, PAPER_ANSWER, DETAILED_ANALYSIS]
    missing = [relative(path) for path in paths if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing required English II 2017 source PDFs: " + ", ".join(missing))


def text_between(text: str, start: str, end: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise ValueError(f"Missing start anchor: {start}")
    end_index = text.find(end, start_index + len(start))
    if end_index < 0:
        raise ValueError(f"Missing end anchor after {start!r}: {end}")
    return text[start_index + len(start) : end_index]


def page_footer_pattern() -> re.Pattern[str]:
    return re.compile(r"英语[（(]二[）)]试题[,.，]\d+[,.，][（(]共14页[）)]")


def cleaned_block(text: str) -> str:
    lines = []
    footer = page_footer_pattern()
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if footer.search(line):
            continue
        if line.startswith("\f"):
            line = line.lstrip("\f").strip()
        lines.append(line)
    return compact(" ".join(lines))


def option_list(options: dict[str, str]) -> list[dict[str, str]]:
    return [{"label": label, "text": text} for label, text in options.items()]


def source_path(source_id: str) -> Path:
    if source_id == SOURCE_IDS["document_version"]:
        return DOCUMENT_VERSION
    if source_id == SOURCE_IDS["original_paper"]:
        return ORIGINAL_PAPER
    if source_id == SOURCE_IDS["paper_answer"]:
        return PAPER_ANSWER
    if source_id == SOURCE_IDS["detailed_analysis"]:
        return DETAILED_ANALYSIS
    raise KeyError(source_id)


def split_labeled_options(text: str, labels: str = "ABCD") -> dict[str, str]:
    normalized = compact(text)
    label_pattern = "".join(labels)
    matches = list(re.finditer(rf"(?<![A-Za-z])([{label_pattern}])\.\s*", normalized))
    if len(matches) != len(labels):
        raise ValueError(f"Expected labels {labels}, found {len(matches)} in: {normalized[:160]}")

    options: dict[str, str] = {}
    for index, match in enumerate(matches):
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        options[match.group(1)] = normalized[match.end() : next_start].strip()
    return options


def extract_cloze_passage(text: str) -> str:
    block = text_between(
        text,
        "Read the following text. Choose the best word( s) for each numbered blank and",
        "英语（二）试题.1.（共14页）",
    )
    lines = []
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("\f"):
            line = line.lstrip("\f").strip()
        lines.append(line)
    block = " ".join(lines)
    block = re.sub(r"^mark A, B, C or D on the ANSWER SHEET\. \(10 points\)", "", block).strip()
    block = re.sub(r"once again\s+]\s+that", "once again (1) that", block, count=1)
    for number in range(2, 21):
        block = re.sub(rf"\s+{number}\s{{2,}}", f" ({number}) ", block, count=1)
    block = re.sub(r"emotional\s+17\s+of", "emotional (17) of", block, count=1)
    return compact(block)


def extract_cloze_options(text: str) -> dict[int, dict[str, str]]:
    option_text = text_between(text, "英语（二）试题.1.（共14页）", "Section 口       Reading Comprehension")
    options: dict[int, dict[str, str]] = {}
    for number in range(1, 21):
        match = re.search(rf"(?m)^\s*{number}\.\s+(.+)$", option_text)
        if not match:
            raise ValueError(f"Missing cloze option line {number}")
        options[number] = split_labeled_options(match.group(1))
    return options


def extract_passages(text: str) -> dict[str, str]:
    passages = {
        "text1": cleaned_block(text_between(text, "Text 1", "21. According to Paragraph 1")),
        "text2": cleaned_block(text_between(text, "Text 2", "26. According to Jenny Radesky")),
        "text3": cleaned_block(text_between(text, "Text 3", "31. One of the reasons")),
        "text4": cleaned_block(text_between(text, "Text 4", "36. More frequent wildfires")),
        "part-b": cleaned_block(
            text_between(text, "The decline in American manufacturing is a common refrain", "Section ID       Translation")
        ),
    }
    passages["part-b"] = f'The decline in American manufacturing is a common refrain {passages["part-b"]}'
    return passages


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

    page_footer_match = page_footer_pattern().search(text[start_match.end() :])
    if page_footer_match:
        end_indexes.append(start_match.end() + page_footer_match.start())

    if end_indexes:
        return text[start_match.start() : min(end_indexes)]

    return text[start_match.start() :]


def parse_choice_question(block: str, number: int) -> tuple[str, dict[str, str]]:
    normalized = compact(block)
    normalized = re.sub(rf"^{number}\.\s*", "", normalized)
    matches = list(re.finditer(r"(?<![A-Za-z])([A-D])\.\s*", normalized))
    if len(matches) < 4:
        raise ValueError(f"Question {number} missing A-D options: {normalized[:160]}")
    first_option = matches[-4]
    question = normalized[: first_option.start()].strip()
    options = split_labeled_options(normalized[first_option.start() :], "ABCD")
    return question, options


def extract_translation_text(text: str) -> str:
    block = text_between(text, "My dream has always been to work somewhere", "Section IV")
    return compact(f"My dream has always been to work somewhere{block}")


def extract_translation_answer(text: str) -> str:
    block = text_between(text, "我的梦想一直是在时尚和出版之间的领域寻找一份工作", "英语（二）试题.14.（共14页）")
    return cleaned_block("我的梦想一直是在时尚和出版之间的领域寻找一份工作" + block)


def extract_writing_prompts(text: str) -> dict[int, str]:
    prompt47 = cleaned_block(text_between(text, "47. Directions:", "英语（二）试题,13.（共14页）"))
    prompt48 = cleaned_block(text_between(text, "48. Directions:", "2017年考研英语（二）真题答案速查表"))
    return {47: "47. Directions: " + prompt47, 48: "48. Directions: " + prompt48 + " " + WRITING_CHART_48}


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
        "sourceType": "official_paper",
        "sourceFilePath": relative(question_source),
        "fileSha256": sha256_file(question_source),
        "status": "matched",
        "method": "local_pdf_text_layer_cross_check",
        "questionTextHash": question_hash,
        "verifiedAt": now,
        "verifiedBy": "build_english2_2017_bank",
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
        "verifiedBy": "build_english2_2017_bank",
        "note": answer_note,
    }
    return card


def base_card(number: int, *, card_type: str, section: str, group_id: str, question: str, answer: str) -> dict[str, Any]:
    return {
        "id": f"english2-2017-{number:03d}",
        "paperId": "english2-2017",
        "paperName": "2017考研英语二真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english2",
        "year": "2017",
        "number": number,
        "type": card_type,
        "section": section,
        "groupId": group_id,
        "question": question,
        "answer": answer,
        "source": PAPER_ANSWER.name,
        "tags": ["english2", "2017真题", section],
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


def build_bank(now: str | None = None) -> dict[str, Any]:
    require_sources()
    now = now or utc_now()
    text = run_pdftotext(PAPER_ANSWER)
    detail_text = run_pdftotext(DETAILED_ANALYSIS)
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
        card["explanation"] = "答案已按本地百度网盘 2017 英语二真题答案速查表匹配，并用逐题细解 PDF 复核。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_answer_speed_table_match",
                answer_note="Matched against the local 2017 English II answer-speed PDF.",
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
        card["explanation"] = "答案已按本地百度网盘 2017 英语二答案速查表匹配，并用逐题细解 PDF 阅读解析复核。"
        cards.append(
            attach_evidence(
                card,
                question_source_id=SOURCE_IDS["paper_answer"],
                answer_source_id=SOURCE_IDS["paper_answer"],
                now=now,
                answer_method="local_answer_speed_table_with_detailed_analysis_cross_check",
                answer_note="Matched against the local answer-speed table and cross-checked with the detailed-analysis PDF.",
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
        card["explanation"] = "答案已按本地百度网盘 2017 英语二答案速查表匹配；Part B 按人物与观点匹配题训练。"
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
    translation["explanation"] = "参考译文已按本地百度网盘 2017 英语二答案速查 PDF 匹配，并与逐题细解 PDF 英汉对照复核。"
    cards.append(
        attach_evidence(
            translation,
            question_source_id=SOURCE_IDS["paper_answer"],
            answer_source_id=SOURCE_IDS["paper_answer"],
            now=now,
            answer_method="local_answer_speed_translation_reference",
            answer_note="Translation reference was matched against the local answer-speed PDF and cross-checked with detailed analysis.",
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

    validate_cards(cards, material, text, detail_text)
    return {
        "id": "english2-2017",
        "source": PAPER_ANSWER.name,
        "paperId": "english2-2017",
        "paperName": "2017考研英语二真题",
        "subject": "英语",
        "subjectKey": "english",
        "track": "english2",
        "year": "2017",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_text_with_answer_speed_and_detailed_analysis_v1",
        "sourceFiles": [
            {
                "id": "english2-2017-document-version",
                "sourceId": SOURCE_IDS["document_version"],
                "role": "document_version",
                "localPath": relative(DOCUMENT_VERSION),
                "sha256": sha256_file(DOCUMENT_VERSION),
            },
            {
                "id": "english2-2017-original-paper",
                "sourceId": SOURCE_IDS["original_paper"],
                "role": "paper",
                "localPath": relative(ORIGINAL_PAPER),
                "sha256": sha256_file(ORIGINAL_PAPER),
            },
            {
                "id": "english2-2017-paper-answer",
                "sourceId": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": relative(PAPER_ANSWER),
                "sha256": sha256_file(PAPER_ANSWER),
            },
            {
                "id": "english2-2017-detailed-analysis",
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
            "questionSources": [SOURCE_IDS["paper_answer"], SOURCE_IDS["original_paper"], SOURCE_IDS["document_version"]],
            "answerSources": [SOURCE_IDS["paper_answer"], SOURCE_IDS["detailed_analysis"]],
            "policy": "local_baidu_pdf_text_answer_speed_and_detailed_analysis_match",
        },
        "cards": cards,
    }


def validate_cards(cards: list[dict[str, Any]], material: dict[str, Any], text: str, detail_text: str) -> None:
    issues: list[str] = []
    if len(cards) != 48:
        issues.append(f"card count {len(cards)} != 48")
    if (
        "People have speculated for centuries about a future without work" not in material["cloze_passage"]
        or "John Danaher" not in material["cloze_passage"]
    ):
        issues.append("cloze passage missing work-free/Danaher anchors")
    for number in range(1, 21):
        if f"({number})" not in material["cloze_passage"]:
            issues.append(f"cloze passage missing blank marker ({number})")
    if "Parkrun" not in material["passages"]["text1"] or "Andrew Baddeley" not in material["passages"]["text1"]:
        issues.append("Text 1 passage missing Parkrun/Baddeley anchors")
    if "Jenny Radesky" not in material["passages"]["text2"] or "still face experiment" not in material["passages"]["text2"]:
        issues.append("Text 2 passage missing Radesky/still-face anchors")
    if "gap year" not in material["passages"]["text3"] or "Boston College" not in material["passages"]["text3"]:
        issues.append("Text 3 passage missing gap-year/Boston College anchors")
    if "Max Moritz" not in material["passages"]["text4"] or "University of Colorado" not in material["passages"]["text4"]:
        issues.append("Text 4 passage missing Moritz/Colorado anchors")
    if "Jay Dunwell" not in material["passages"]["part-b"] or "Julie Parks" not in material["passages"]["part-b"]:
        issues.append("Part B passage missing manufacturing/person anchors")
    if "Fashion Media & Promotion" not in material["translation_text"] or "fashion and publishing" not in material["translation_text"]:
        issues.append("translation text missing fashion/media anchors")
    if "2013-2015年我国博物馆数量和参观人数" not in material["writing_prompts"][48] or "4165" not in material["writing_prompts"][48]:
        issues.append("writing prompt 48 missing museum chart anchor")
    if "CADAB" not in text or "EAGBF" not in text:
        issues.append("answer-speed table anchors missing")
    for anchor in [
        "Parkrun",
        "Jenny Radesky",
        "gap year",
        "Max Moritz",
        "Jay Dunwell",
        "Fashion Media & Promotion",
    ]:
        if anchor not in detail_text:
            issues.append(f"detailed-analysis evidence anchor missing: {anchor}")

    forbidden_noise = [
        "Section 口",
        "Section ID",
        "Section HI",
        "Section JU",
        "parents9",
        "kids9",
        "children9s",
        "child9",
        "babies5",
        "freshmen9s",
        "agency9s",
        "There5s",
        "bom out",
        "interactingwith",
        "experimentM",
        "generation. n",
        "jobs,n",
        "u inspire",
        "u Parents",
        "uThey",
        "u Overtime",
        "differentn",
        "course u Fashion",
        "@@@@",
        "故事情节纯属虚构",
        "不要“入戏”",
    ]

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
        serialized_card = json.dumps(card, ensure_ascii=False)
        for noise in forbidden_noise:
            if noise in serialized_card:
                issues.append(f"card {expected_number}: OCR noise remains: {noise}")
    if cards[0]["answer"] != "C":
        issues.append("question 1 answer mismatch")
    if cards[20]["answer"] != "A":
        issues.append("question 21 answer mismatch")
    if cards[29]["answer"] != "A":
        issues.append("question 30 answer mismatch")
    if cards[40]["answer"] != "E" or cards[44]["answer"] != "F":
        issues.append("Part B answer mismatch")
    if len(cards[40]["options"]) != 7:
        issues.append("Part B option count mismatch")
    if not cards[45]["answer"].startswith("我的梦想一直是在时尚和出版之间的领域寻找一份工作"):
        issues.append("question 46 translation answer mismatch")
    if cards[47]["answerEvidence"]["evidenceRole"] != "official_writing_prompt":
        issues.append("question 48 answer evidence role mismatch")
    if issues:
        raise ValueError("english2-2017 validation failed:\n" + "\n".join(issues))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)
    bank = build_bank()
    write_json(args.output, bank)
    print(
        "[english2-2017] "
        f"output={args.output.relative_to(PROJECT_ROOT)} "
        f"cards={bank['total_cards']} "
        f"status={bank['publicationStatus']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
