#!/usr/bin/env python3
"""
Audit 2025 public-course source PDFs and build a review-only English I draft.

The generated draft is intentionally kept outside the public mini-program bank
until source conflicts and evidence hashes are reviewed.
"""

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
RAW_ROOT = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-2025"
DEFAULT_AUDIT_OUTPUT = RAW_ROOT / "source-audit.json"
DEFAULT_DRAFT_OUTPUT = PROJECT_ROOT / "data" / "flashcards" / "drafts" / "english1-2025-draft.json"

ENGLISH1_PAPER = RAW_ROOT / "english1" / "2025-english1-paper.pdf"
ENGLISH1_ANSWER = RAW_ROOT / "english1" / "2025-english1-answer.pdf"

PAPER_META = {
    "english1/2025-english1-paper.pdf": {
        "id": "english1-2025-paper",
        "track": "english1",
        "subject": "英语",
        "name": "2025考研英语一真题",
        "role": "paper",
    },
    "english1/2025-english1-answer.pdf": {
        "id": "english1-2025-answer",
        "track": "english1",
        "subject": "英语",
        "name": "2025考研英语一答案",
        "role": "answer",
    },
    "english2/2025-english2-paper.pdf": {
        "id": "english2-2025-paper",
        "track": "english2",
        "subject": "英语",
        "name": "2025考研英语二真题",
        "role": "paper",
    },
    "english2/2025-english2-answer-partial.pdf": {
        "id": "english2-2025-answer-partial",
        "track": "english2",
        "subject": "英语",
        "name": "2025考研英语二答案",
        "role": "answer",
        "knownIssue": "source filename marks the answer as missing T1 and T4",
    },
    "math1/2025-math1-paper-answer.pdf": {
        "id": "math1-2025-paper-answer",
        "track": "math1",
        "subject": "数学",
        "name": "2025考研数学一真题及答案",
        "role": "paper_answer",
    },
    "math1/2025-math1-answer.pdf": {
        "id": "math1-2025-answer",
        "track": "math1",
        "subject": "数学",
        "name": "2025考研数学一参考答案",
        "role": "answer",
    },
    "math2/2025-math2-paper.pdf": {
        "id": "math2-2025-paper",
        "track": "math2",
        "subject": "数学",
        "name": "2025考研数学二真题",
        "role": "paper",
    },
    "math2/2025-math2-answer.pdf": {
        "id": "math2-2025-answer",
        "track": "math2",
        "subject": "数学",
        "name": "2025考研数学二答案",
        "role": "answer",
    },
    "math3/2025-math3-paper-answer.pdf": {
        "id": "math3-2025-paper-answer",
        "track": "math3",
        "subject": "数学",
        "name": "2025考研数学三真题及答案",
        "role": "paper_answer",
    },
}

SECTION_I_PASSAGE = """Located in the southern Peloponnesian peninsula, Pavlopetri (the modern name of the site) emerged as a Neolithic settlement around 3500 B.C. This area of the Aegean Sea is (1) to earthquakes and tsunamis, which caused the city to (2) sink. The slow sea level rise in the Mediterranean (3) the city more than 3000 years ago. For millennia, the city's (4) lay unseen below some 13 feet of water. They were covered by a thick layer of sand (5) the island of Laconia. In recent decades, shifting (6) and climate change have eroded a natural barrier that (7) Pavlopetri. In 1967, a scientific survey of the Peloponnesian coast was (8) data to analyze change in sea levels (9) British oceanographer Nicholas Flemming first spotted the sunken (10). A year later, he returned with a few students to (11) the location and map the site. The team identified some 15 buildings, courtyards, a network of streets, and two chamber tombs. (12) the exciting initial finds, the site would lie (13) for decades before archaeologists would return. In 2009 archaeologists Chrysanthi Gallon and Jon Henderson (14) excavation of Pavlopetri in cooperation with the Greek Ministry of Culture.

Since the 1960s, underwater archaeology (15) and tools had made huge advances. The team (16) robotics, sonar mapping, and state-of-the-art graphics to survey the site. From 2009 to 2013 they were able to bring the underwater town to (17). Covering about two and a half acres, Pavlopetri three main roads (18) some 50 rectangular buildings, all of which had open courtyards. Excavations revealed a large number of Minoan-style loom weights, (19) Pavlopetri was a thriving trade center with a (20) textile industry."""

SECTION_I_OPTIONS = {
    1: {"A": "relevant", "B": "prone", "C": "available", "D": "alien"},
    2: {"A": "accidentally", "B": "frequently", "C": "gradually", "D": "temporarily"},
    3: {"A": "disguised", "B": "submerged", "C": "relocated", "D": "isolated"},
    4: {"A": "legends", "B": "programs", "C": "remains", "D": "surroundings"},
    5: {"A": "across", "B": "off", "C": "under", "D": "via"},
    6: {"A": "currents", "B": "rivers", "C": "seasons", "D": "winds"},
    7: {"A": "elevated", "B": "separated", "C": "comprised", "D": "protected"},
    8: {"A": "gathering", "B": "restoring", "C": "updating", "D": "supplying"},
    9: {"A": "when", "B": "until", "C": "after", "D": "once"},
    10: {"A": "belongings", "B": "resources", "C": "products", "D": "structures"},
    11: {"A": "preserve", "B": "select", "C": "display", "D": "examine"},
    12: {"A": "Despite", "B": "Unlike", "C": "Besides", "D": "Among"},
    13: {"A": "unchallenged", "B": "unknown", "C": "unorganized", "D": "undisturbed"},
    14: {"A": "suspended", "B": "transferred", "C": "resumed", "D": "canceled"},
    15: {"A": "policies", "B": "theories", "C": "documents", "D": "techniques"},
    16: {"A": "ordered", "B": "provided", "C": "employed", "D": "adjusted"},
    17: {"A": "effect", "B": "light", "C": "reality", "D": "mind"},
    18: {"A": "crossed", "B": "connected", "C": "blocked", "D": "altered"},
    19: {"A": "expecting", "B": "suggesting", "C": "predicting", "D": "recalling"},
    20: {"A": "robust", "B": "diverse", "C": "marginal", "D": "dependent"},
}

READING_QUESTIONS = {
    21: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": 'The "rehearsal room" approach requires pupils to',
        "options": {
            "A": "rewrite the lines from Shakespeare.",
            "B": "Watch RSC actors' performances.",
            "C": "play the roles in Shakespeare.",
            "D": "Study drama under RSC artist.",
        },
    },
    22: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": "The study divided the pupils into two groups to find whether",
        "options": {
            "A": "The change in instruction enhances learning outcomes.",
            "B": "expanding vocabulary helps develop reading fluency.",
            "C": "emotion affects understanding of sophisticated works.",
            "D": "the classroom activity stimulates interest in the acts.",
        },
    },
    23: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": 'Control pupils\' reliance on "desert island cliches" shows their',
        "options": {
            "A": "weakness in description",
            "B": "omission of small details.",
            "C": "casual style of writing.",
            "D": "preference for big words",
        },
    },
    24: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": "What can promote children's emotional literacy according to O'Hanlon?",
        "options": {
            "A": "Writing in an imaginative manner.",
            "B": "Identifying with literary characters.",
            "C": "Drawing inspiration from nature.",
            "D": "Concentrating on real-life situations.",
        },
    },
    25: {
        "group": "text1",
        "section": "阅读理解 Text 1",
        "question": "It can be inferred from the last paragraph that",
        "options": {
            "A": "the new teaching method may work best with Shakespeare.",
            "B": "the language of Shakespeare may be formidable for pupils.",
            "C": "other old dramatists may be included in primary education",
            "D": "pupils may be reluctant to work on other old dramatists.",
        },
    },
    26: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "The author expressed great surprise at some scientists' ________.",
        "options": {
            "A": "unwillingness to cut carbon emissions",
            "B": "intention to reduce their research",
            "C": "suspicions about sustainable energy",
            "D": "waste of electricity in their projects",
        },
    },
    27: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "The author believes that carbon emissions from research ________.",
        "options": {
            "A": "have caused grave consequences",
            "B": "have caused groundless worries",
            "C": "are hard to handle at present",
            "D": "are justifiable in the long run",
        },
    },
    28: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "The example of LUMI is used to illustrate ________.",
        "options": {
            "A": "the achievements of great scientists",
            "B": "the urgency of addressing climate change",
            "C": "the rewards of scientific endeavors",
            "D": "the value of fostering human ingenuity",
        },
    },
    29: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "It can be learned from the last two paragraphs that LUMI ________.",
        "options": {
            "A": "is a model of sustainability efforts",
            "B": "is a triumph against energy shortage",
            "C": "owes much to global net-zero initiatives",
            "D": "aims to explore the power of intelligence",
        },
    },
    30: {
        "group": "text2",
        "section": "阅读理解 Text 2",
        "question": "Which of the following statements would the author agree with?",
        "options": {
            "A": "Emission-free modelling demands extra funding",
            "B": "The need for supercomputers is difficult to meet",
            "C": "Energy-intensive research work is inevitable.",
            "D": "The goals of researchers ought to be realistic.",
        },
    },
    31: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "According to Paragraph 1, legitimate streaming services ________.",
        "options": {
            "A": "have drawn lessons from Hollywood",
            "B": "have surpassed cable in revenue",
            "C": "are unpopular with advertisers",
            "D": "are confronted with a real threat",
        },
    },
    32: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "It can be learned that streamers like Netflix ________.",
        "options": {
            "A": "played a part in the fight against illegal file-sharing",
            "B": "reaped benefits from the war with digital pirates",
            "C": "promised to become big job creators in the US",
            "D": "used to collaborate with file uploading platforms",
        },
    },
    33: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "It can be inferred from Paragraph 4 that the MPA ________.",
        "options": {
            "A": "was denied cooperation by Silicon Valley",
            "B": "led a national protest against online piracy",
            "C": "was urged to form an enforcement task force",
            "D": "failed to win support from local authorities",
        },
    },
    34: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "According to Hawley, digital piracy ________.",
        "options": {
            "A": "cannot be checked in spite of new legislation",
            "B": "will possibly overwhelm legitimate streamers",
            "C": "is unlikely to diminish in the near future",
            "D": "has been underestimated by some analysts",
        },
    },
    35: {
        "group": "text3",
        "section": "阅读理解 Text 3",
        "question": "Which of the following is emphasized in the text?",
        "options": {
            "A": "The need to coordinate anti-piracy action",
            "B": "The criminal nature of copyright violation",
            "C": "The prospect of eliminating online piracy",
            "D": "The economic harm from illegal streaming",
        },
    },
    36: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "The author mentions the artifacts from the past to ________.",
        "options": {
            "A": "introduce the collection of antiques",
            "B": "contrast them with everyday items",
            "C": "bring up the issue of preservation",
            "D": "comment on their historical value",
        },
    },
    37: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "Compared with digital objects, tangible artifacts ________.",
        "options": {
            "A": "are less subject to their creators' neglect",
            "B": "convey information in a more direct way",
            "C": "require more international preservation",
            "D": "are less likely to suffer serious damage",
        },
    },
    38: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "According to Paragraph 3, librarians' work may result in ________.",
        "options": {
            "A": "oversupply of materials",
            "B": "undervaluation of libraries",
            "C": "researchers' underperformance",
            "D": "users' overreliance on technology",
        },
    },
    39: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": 'The "ZIP disk" is cited as an example to show ________.',
        "options": {
            "A": "the hazard of retrieving files through unusual means.",
            "B": "the infeasibility of constantly migrating digital assets.",
            "C": "the possibility of losing information in obsolete formats.",
            "D": "the inconvenience of storing information on analog devices.",
        },
    },
    40: {
        "group": "text4",
        "section": "阅读理解 Text 4",
        "question": "Which of the following statements best summarizes the text?",
        "options": {
            "A": "Hard work should be done to preserve artifacts.",
            "B": "Contributions of librarians should be recognized.",
            "C": "Accessing databases is essential to researchers.",
            "D": "Keeping digital historical records is a challenge",
        },
    },
}

SECTION_I_ANSWERS = {
    1: "B",
    2: "C",
    3: "B",
    4: "C",
    5: "B",
    6: "A",
    7: "D",
    8: "A",
    9: "A",
    10: "D",
    11: "D",
    12: "A",
    13: "D",
    14: "C",
    15: "D",
    16: "C",
    17: "B",
    18: "B",
    19: "B",
    20: "A",
}

READING_ANSWERS = {
    21: "C",
    22: "C",
    23: "A",
    24: "B",
    25: "C",
    26: "B",
    27: "D",
    28: "D",
    29: "A",
    30: "C",
    31: "D",
    32: "A",
    33: "C",
    34: "C",
    35: "D",
    36: "C",
    37: "D",
    38: "B",
    39: "C",
    40: "D",
}

PART_B_PARAGRAPHS = {
    "A": "Peters likes to photograph butterflies in a landscape, celebrating the beauty of their surroundings as well as the insects themselves. His pictures of a Glanville fritillary rising from the sea-pinks beside the chalk cliffs of Compton Bay on the Isle of Wight are particularly glorious. These take-off shots are even more challenging because they require a wide-angle lens, which means he must be less than 2cm from the butterfly. It's incredibly difficult to get that close to a skittish sun-warmed insect. Unlike some photographers, who \"cheat\" by keeping insects in a fridge to slow them down, Peters refuses to tamper with wild butterflies.",
    "B": "Peters' signature shot is a butterfly \"take-off\", showing the multiple wing-beats of one butterfly in one frame as it lifts off from a flower. How does he capture it? Technology helps. A typical digital SLR camera shoots 20 frames a second. He uses a high-speed OM System which shoots 120 frames a second.",
    "C": "Britain has relatively few butterfly species compared with mainland Europe and 80% are in decline, mostly because intensive chemical farming has reduced many species to tiny fragments of habitat and small nature reserves. Global heating is benefiting some species but others are too isolated to find suitable new habitat, and gardening habits-paving over gardens and using pesticides-aren't helping either. Butterflies may not pollinate as many plants as wild bees and hoverflies, but because British butterflies are the best-studied group of insects in the world, they are an extremely useful indicator of the wider declines in flying insects.",
    "D": "Five years ago, at summer's end, Andrew Fusek Peters was diagnosed with bowel cancer. \"I was waiting for surgery, feeling really ill, sitting in my garden. It was amazing weather and there were painted lady butterflies everywhere,\" he says. \"They were a symbol of fragile life, of hope and defiance, and something appealed to my soul.\"",
    "E": "That makes it sound easy, and artificial, but Peters insists it is still a massive challenge. He typically takes between 10,000 and 20,000 shots to get one butterfly take-off sequence in focus. At such high shutter speeds, the depth of field is tiny, and as butterflies do not fly in a straight line they swiftly flutter out of focus. As well as thousands of attempts, it takes patience and field craft to anticipate a butterfly's likely flight-line-and catch it-in focus.",
    "F": "So what's the appeal of a long, sweaty day in pursuit of an elusive, fast-moving wild animal? \"It just feels bloody brilliant,\" says Peters. \"If I've had a full day of good encounters with butterflies, met interesting butterfly people and I've got some good shots, that becomes a vault in my spiritual bank. It's a happy feeling.\"",
    "G": "A children's author and poet who had become a keen amateur photographer, Peters watched the butterflies and idly wondered if he could capture them in flight. It swiftly become an obsession as he recovered from a successful operation to remove the cancer. In recent summers, he has travelled the length and breadth of Britain to photograph all 58 native species of butterfly. Now the fruits of those summers have seen published in a beautiful new book.",
    "H": "A butterfly takes off so quickly it is still impossible to react quickly enough to capture that take-off but if he half-presses the shutter, the camera saves the 70 previous frames before the moment he actually takes the picture. \"It's time travel, so I don't miss the moment of take-off,\" he says. After he's captured the butterfly taking off, he layers 10 to 15 frames together in Photoshop.",
}

TRANSLATION_ANSWERS = {
    46: "近几十年来，科学已经进入了一种惯例，在这种惯例中，只有通过大学等机构才能参与这一学科。",
    47: "但是，通过利用公众的自然好奇心，可以让非科学家通过直接参与研究过程来克服许多挑战。",
    48: "科学家们采用了多种方式让公众参与他们的研究，例如将数据分析转化为在线游戏，或将样本收集转化为智能手机应用程序。",
    49: "这些群体是城市科学家和专业科学家迅速扩大的生物技术社会运动的一部分，他们寻求将发现机构交到任何有热情的人手中。",
    50: "他们汇集资源，合作，跳出思维定势，找到解决方案和绕过障碍的方法，为了科学而探索科学，而在这个过程没有在正式环境中工作的传统界限中。",
}

WRITING_ANSWERS = {
    51: "Dear Paul,\n\nI'm glad to hear you're excited about the craft-making show. The young craftsmen will showcase a mix of traditional and modern crafts, including paper-cutting, pottery-making, embroidery, 3D-printed crafts, and eco-friendly handmade products. For the presentation work, it would be helpful if you could prepare display boards, organize seating, and help set up the demonstration area.\n\nThank you again for your support. I look forward to working with you to make the event a success.\n\nYours sincerely,\nLi Ming",
    52: "The table presents the average ownership of major durable consumer goods per 100 households in China from 2014 to 2023. Air-conditioners increased from 75.2 to 145.9, washing machines rose from 83.7 to 98.2, and refrigerators grew from 85.5 to 103.4.\n\nThis trend reflects economic growth, rising living standards, and wider access to efficient household appliances. As household incomes improve, families are more able to purchase goods that enhance comfort and convenience. Technological progress and broader distribution also make these products more affordable and available.\n\nOverall, the figures show a normal and positive improvement in daily life, and this trend is likely to continue as consumption quality keeps rising.",
}

PART_B_CONFLICT_NOTE = (
    "The local Baidu source says Paragraph F and G have been correctly placed, but an external version found during "
    "source review marks A/C/H as placed and leaves 41-45 as D/G/B/E/F. Keep this paper in draft until the official "
    "layout is cross-checked."
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_command(args: list[str]) -> str:
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


POLITICS_ANSWER_MARKER_RE = re.compile(
    r"(?m)^\s*\*?\s*(?P<number>\d{1,2})\s*[.．、,，]?\s*[【\[\［]\s*答案(?:要点)?\s*[】\]\］]"
)


def pdf_text(path: Path, first: int | None = None, last: int | None = None) -> str:
    args = ["pdftotext"]
    if first is not None:
        args.extend(["-f", str(first)])
    if last is not None:
        args.extend(["-l", str(last)])
    args.extend([str(path), "-"])
    return run_command(args).replace("\x00", "")


def pdf_page_count(path: Path) -> int:
    info = run_command(["pdfinfo", str(path)])
    match = re.search(r"^Pages:\s+(\d+)", info, re.MULTILINE)
    return int(match.group(1)) if match else 0


def clean_text(text: str) -> str:
    text = text.replace("\f", "\n")
    text = text.replace("2025 年全国硕士研究生招生考试（英语一）真题试题", "")
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def compact(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def politics_answer_marker_blockers(text: str, expected_numbers: range = range(1, 39)) -> list[str]:
    found = {
        int(match.group("number"))
        for match in POLITICS_ANSWER_MARKER_RE.finditer(text or "")
        if 1 <= int(match.group("number")) <= 99
    }
    missing = [number for number in expected_numbers if number not in found]
    if not missing:
        return []
    return [f"missing_answer_markers:{','.join(str(number) for number in missing)}"]


def infer_history_source_meta(path: Path) -> dict[str, str]:
    parts = path.parts
    if "public-course-history" not in parts:
        return {}

    track = ""
    year = ""
    for index, part in enumerate(parts):
        if part in {"politics", "english1", "english2", "math1", "math2", "math3"}:
            track = part
            if index + 1 < len(parts) and re.fullmatch(r"(?:19|20)\d{2}", parts[index + 1]):
                year = parts[index + 1]
            break
    if not track or not year:
        return {}

    subject = "政治" if track == "politics" else "英语" if track.startswith("english") else "数学"
    file_name = path.name.lower()
    if "paper-answer" in file_name or "真题及答案" in file_name or "真题及解析" in file_name:
        role = "paper_answer"
    elif "answer" in file_name or "答案" in file_name or "解析" in file_name:
        role = "answer"
    elif "paper" in file_name or "真题" in file_name:
        role = "paper"
    else:
        role = ""

    return {
        "id": f"{track}-{year}-{role or path.stem}",
        "track": track,
        "subject": subject,
        "year": year,
        "name": path.stem,
        "role": role,
    }


def source_meta_for(path: Path, raw_root: Path) -> dict[str, str]:
    rel = str(path.relative_to(raw_root))
    meta = dict(PAPER_META.get(rel, {}))
    if not meta:
        meta = infer_history_source_meta(path)
    return meta


def section_between(text: str, start: str, end: str) -> str:
    start_index = text.index(start)
    end_index = text.index(end, start_index + len(start)) if end else len(text)
    return clean_text(text[start_index:end_index])


def extract_text_a_passages(paper_text: str) -> dict[str, str]:
    cleaned = clean_text(paper_text)
    return {
        "text1": compact(section_between(cleaned, "Text 1", "21.The").split("Text 1", 1)[1]),
        "text2": compact(section_between(cleaned, "Text 2", "26. The").split("Text 2", 1)[1]),
        "text3": compact(section_between(cleaned, "Text 3", "31. According").split("Text 3", 1)[1]),
        "text4": compact(section_between(cleaned, "Text 4", "36. The").split("Text 4", 1)[1]),
    }


def extract_part_b_material(paper_text: str) -> str:
    cleaned = clean_text(paper_text)
    part_b = section_between(cleaned, "Part B", "Part C")
    body = part_b.split("[A]", 1)[1]
    return compact("[A]" + body)


def extract_part_c_material(paper_text: str) -> str:
    cleaned = clean_text(paper_text)
    part_c = section_between(cleaned, "Part C", "Section III")
    return compact(part_c)


def source_evidence(source_id: str, path: Path) -> dict[str, str]:
    return {
        "evidenceId": source_id,
        "sourceId": source_id,
        "sourceType": "official_paper",
        "sourceFilePath": str(path.relative_to(PROJECT_ROOT)),
        "fileSha256": sha256_file(path),
        "status": "draft_review",
        "method": "pdf_text_layer_extraction",
    }


def card_hash(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def option_list(options: dict[str, str]) -> list[dict[str, str]]:
    return [{"label": label, "text": text} for label, text in options.items()]


def add_evidence(card: dict[str, Any], source_id: str, source_path: Path, answer_source_path: Path) -> dict[str, Any]:
    card["sourceEvidenceId"] = source_id
    card["sourceEvidence"] = source_evidence(source_id, source_path)
    card["questionTextHash"] = card_hash(card["question"])
    card["answerTextHash"] = card_hash(str(card["answer"]))
    card["answerEvidenceStatus"] = "draft_matched"
    card["answerSourceFilePath"] = str(answer_source_path.relative_to(PROJECT_ROOT))
    return card


def build_english1_draft() -> dict[str, Any]:
    paper_text = pdf_text(ENGLISH1_PAPER)
    text_a_passages = extract_text_a_passages(paper_text)
    part_b_material = extract_part_b_material(paper_text)
    part_c_material = extract_part_c_material(paper_text)
    cards: list[dict[str, Any]] = []

    for number in range(1, 21):
      card = {
          "id": f"english1-2025-{number:03d}",
          "paperId": "english1-2025",
          "paperName": "2025考研英语一真题",
          "subject": "英语",
          "track": "english1",
          "year": "2025",
          "number": number,
          "type": "single_choice",
          "section": "完形填空",
          "groupId": "cloze",
          "question": f"Choose the best option for blank {number}.",
          "passage": SECTION_I_PASSAGE,
          "options": option_list(SECTION_I_OPTIONS[number]),
          "answer": SECTION_I_ANSWERS[number],
          "explanation": "待复核答案解析",
          "source": "2025-english1-paper.pdf",
          "tags": ["english1", "2025真题", "完形填空"],
      }
      cards.append(add_evidence(card, "english1-2025-paper", ENGLISH1_PAPER, ENGLISH1_ANSWER))

    for number in range(21, 41):
        question = READING_QUESTIONS[number]
        card = {
            "id": f"english1-2025-{number:03d}",
            "paperId": "english1-2025",
            "paperName": "2025考研英语一真题",
            "subject": "英语",
            "track": "english1",
            "year": "2025",
            "number": number,
            "type": "single_choice",
            "section": question["section"],
            "groupId": question["group"],
            "question": question["question"],
            "passage": text_a_passages[question["group"]],
            "options": option_list(question["options"]),
            "answer": READING_ANSWERS[number],
            "explanation": "待复核答案解析",
            "source": "2025-english1-paper.pdf",
            "tags": ["english1", "2025真题", "阅读理解"],
        }
        cards.append(add_evidence(card, "english1-2025-paper", ENGLISH1_PAPER, ENGLISH1_ANSWER))

    for number, answer in {41: "D", 42: "G", 43: "B", 44: "E", 45: "F"}.items():
        card = {
            "id": f"english1-2025-{number:03d}",
            "paperId": "english1-2025",
            "paperName": "2025考研英语一真题",
            "subject": "英语",
            "track": "english1",
            "year": "2025",
            "number": number,
            "type": "single_choice",
            "section": "新题型",
            "groupId": "part-b",
            "question": f"Choose the most suitable paragraph for blank {number}.",
            "passage": part_b_material,
            "options": option_list(PART_B_PARAGRAPHS),
            "answer": answer,
            "explanation": PART_B_CONFLICT_NOTE,
            "source": "2025-english1-paper.pdf",
            "tags": ["english1", "2025真题", "新题型", "待复核"],
        }
        cards.append(add_evidence(card, "english1-2025-paper", ENGLISH1_PAPER, ENGLISH1_ANSWER))

    for number in range(46, 51):
        card = {
            "id": f"english1-2025-{number:03d}",
            "paperId": "english1-2025",
            "paperName": "2025考研英语一真题",
            "subject": "英语",
            "track": "english1",
            "year": "2025",
            "number": number,
            "type": "translation",
            "section": "翻译",
            "groupId": "part-c",
            "question": f"Translate sentence {number} into Chinese.",
            "passage": part_c_material,
            "answer": TRANSLATION_ANSWERS[number],
            "explanation": "待复核译文",
            "source": "2025-english1-paper.pdf",
            "tags": ["english1", "2025真题", "翻译"],
        }
        cards.append(add_evidence(card, "english1-2025-paper", ENGLISH1_PAPER, ENGLISH1_ANSWER))

    for number in (51, 52):
        card = {
            "id": f"english1-2025-{number:03d}",
            "paperId": "english1-2025",
            "paperName": "2025考研英语一真题",
            "subject": "英语",
            "track": "english1",
            "year": "2025",
            "number": number,
            "type": "essay",
            "section": "写作",
            "groupId": "writing",
            "question": "Write the composition required by the original paper.",
            "passage": "See the original paper for the writing prompt and chart/table material.",
            "answer": WRITING_ANSWERS[number],
            "explanation": "参考范文，待人工复核",
            "source": "2025-english1-paper.pdf",
            "tags": ["english1", "2025真题", "写作"],
        }
        cards.append(add_evidence(card, "english1-2025-paper", ENGLISH1_PAPER, ENGLISH1_ANSWER))

    return {
        "id": "english1-2025",
        "source": "2025-english1-paper.pdf",
        "paperId": "english1-2025",
        "paperName": "2025考研英语一真题",
        "subject": "英语",
        "track": "english1",
        "year": "2025",
        "quality": "needs_review",
        "publicationStatus": "draft",
        "publicationBlockers": [
            "Part B fixed paragraph layout conflicts between current Baidu source and an external source",
            "Answer evidence is draft_matched and requires human review before public promotion",
        ],
        "processed_at": utc_now(),
        "total_cards": len(cards),
        "sections": ["完形填空", "阅读理解", "新题型", "翻译", "写作"],
        "cards": cards,
    }


def audit_sources(raw_root: Path = RAW_ROOT) -> dict[str, Any]:
    sources = []
    for path in sorted(raw_root.rglob("*.pdf")):
        meta = source_meta_for(path, raw_root)
        sample_text = pdf_text(path, 1, min(2, pdf_page_count(path)))
        text_chars = len(sample_text.strip())
        page_count = pdf_page_count(path)
        text_layer = "usable" if text_chars >= 300 else "missing_or_sparse"
        quality = "needs_cleaning"
        if meta.get("track") == "english1" and meta.get("role") in {"paper", "answer"} and text_layer == "usable":
            quality = "needs_review"
        elif meta.get("track") == "english2" and meta.get("role") == "answer":
            quality = "needs_passage"
        elif meta.get("subject") == "数学":
            quality = "needs_ocr"

        blockers: list[str] = []
        if text_layer == "missing_or_sparse":
            blockers.append("no usable text layer")
        if meta.get("knownIssue"):
            blockers.append(meta["knownIssue"])
        if meta.get("track") == "politics" and meta.get("role") in {"answer", "paper_answer"} and text_layer == "usable":
            blockers.extend(politics_answer_marker_blockers(pdf_text(path)))

        sources.append(
            {
                "id": meta.get("id", str(path.relative_to(raw_root))),
                "track": meta.get("track", ""),
                "subject": meta.get("subject", ""),
                "year": meta.get("year", "2025"),
                "name": meta.get("name", path.stem),
                "role": meta.get("role", ""),
                "localPath": str(path.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(path),
                "pageCount": page_count,
                "sampleTextCharsFirstTwoPages": text_chars,
                "textLayer": text_layer,
                "quality": quality,
                "blockers": blockers,
            }
        )

    return {
        "version": 1,
        "generatedAt": utc_now(),
        "root": str(raw_root.relative_to(PROJECT_ROOT)),
        "summary": {
            "sourceCount": len(sources),
            "usableTextLayerCount": sum(1 for item in sources if item["textLayer"] == "usable"),
            "needsOcrCount": sum(1 for item in sources if item["quality"] == "needs_ocr"),
            "blockedCount": sum(1 for item in sources if item["blockers"]),
        },
        "sources": sources,
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit public-course PDFs and build review-only 2025 drafts.")
    parser.add_argument("--root", type=Path, default=RAW_ROOT)
    parser.add_argument("--audit-output", type=Path)
    parser.add_argument("--draft-output", type=Path, default=DEFAULT_DRAFT_OUTPUT)
    parser.add_argument("--skip-draft", action="store_true")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    audit_output = args.audit_output or (root / "source-audit.json")

    audit = audit_sources(root)
    write_json(audit_output, audit)

    if not args.skip_draft and root == RAW_ROOT.resolve():
        draft = build_english1_draft()
        write_json(args.draft_output, draft)
        print(
            "[public-course-2025] "
            f"audit={display_path(audit_output)} "
            f"draft={display_path(args.draft_output)} "
            f"cards={draft['total_cards']} "
            f"status={draft['publicationStatus']}"
        )
    else:
        print(f"[public-course-source-audit] audit={display_path(audit_output)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
