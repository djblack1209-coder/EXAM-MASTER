#!/usr/bin/env python3
"""
Build the 2019 Math II public-course bank from the local Baidu Netdisk PDF.

The source is a 5-page scanned PDF without a usable text layer. Pages 1-4 are
question pages and page 5 is a compact answer key. The builder publishes
question crops and trims the promotional tail from the answer page evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math2-2019.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math2-2019"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math2-2019-release-assets"

PAPER_ANSWER = RAW_DIR / "src_021a329bfc22c3b26ed9b510-2019考研数学二真题.pdf"

SOURCE_IDS = {
    "paper_answer": "math2-2019-paper-answer",
}

PAPER_SOURCE_ID = "src_021a329bfc22c3b26ed9b510"

CHOICE_ANSWERS = {
    1: "C",
    2: "B",
    3: "D",
    4: "D",
    5: "A",
    6: "A",
    7: "A",
    8: "C",
}

FILL_ANSWERS = {
    9: "4e^(3/2)",
    10: "3π/2+2",
    11: "yf(y^2/x)",
    12: "1/2 ln3",
    13: "1/4(cos1-1)",
    14: "-4",
}

SHORT_ANSWERS = {
    15: "f'(x) 分段表达式、极小值点 x=-1 与 x=1/e、极大值点 x=0；完整极值结果见答案原页。",
    16: "不定积分为 -2ln|x-1|-3/(x-1)+ln(x^2+x+1)+C。",
    17: "(I) y(x)=sqrt(x)e^(x^2/2)；(II) 旋转体体积为 1/2π(e^4-e)。",
    18: "二重积分值为 43√2/120。",
    19: "S_n=1/2+e^(-π)(1-e^(-(n-1)π))/(1-e^(-π))+1/2e^(-nπ)，lim S_n=1/2+1/(e^π-1)。",
    20: "a=-3/4，b=3/4。",
    21: "证明略，完整证明见答案原页。",
    22: "a≠-1 时向量组 I 与 II 等价；a=1 时 β3=(3-2k)α1+(-2+k)α2+kα3；a≠±1 时 β3=α1-α2+α3。",
    23: "(I) x=3，y=-2；(II) 可取满足 P^(-1)AP=B 的 P=[[-1,-1,-1],[2,1,2],[0,0,4]]。",
}

# crop_id -> (source page, x offset, y offset, width, height), measured on 130dpi renders.
QUESTION_CROPS: dict[str, tuple[int, int, int, int, int]] = {
    "01": (1, 20, 245, 835, 105),
    "02": (1, 20, 350, 890, 115),
    "03": (1, 20, 470, 1025, 110),
    "04": (1, 20, 575, 1025, 80),
    "05": (1, 20, 660, 850, 175),
    "06": (1, 20, 850, 1025, 150),
    "07": (1, 20, 1025, 1025, 125),
    "08": (1, 20, 1160, 1025, 130),
    "09": (1, 20, 1305, 850, 85),
    "10": (1, 20, 1390, 850, 80),
    "11": (2, 20, 30, 1025, 70),
    "12": (2, 20, 100, 1025, 70),
    "13": (2, 20, 170, 1025, 80),
    "14": (2, 20, 250, 1025, 150),
    "15": (2, 20, 465, 850, 130),
    "16": (2, 20, 760, 850, 150),
    "17": (2, 20, 1065, 850, 190),
    "18": (3, 20, 20, 850, 145),
    "19": (3, 20, 465, 1025, 125),
    "20": (3, 20, 950, 1025, 155),
    "21": (4, 20, 20, 850, 185),
    "22": (4, 20, 425, 1025, 250),
    "23": (4, 20, 885, 1025, 245),
}

QUESTION_IMAGES: dict[int, list[str]] = {
    1: ["01"],
    2: ["02"],
    3: ["03"],
    4: ["04"],
    5: ["05"],
    6: ["06"],
    7: ["07"],
    8: ["08"],
    9: ["09"],
    10: ["10"],
    11: ["11"],
    12: ["12"],
    13: ["13"],
    14: ["14"],
    15: ["15"],
    16: ["16"],
    17: ["17"],
    18: ["18"],
    19: ["19"],
    20: ["20"],
    21: ["21"],
    22: ["22"],
    23: ["23"],
}

ANSWER_PAGES = {number: [5] for number in range(1, 24)}


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


def render_pdf_assets(pdf: Path, prefix: str, *, asset_dir: Path, force: bool, pages: set[int]) -> None:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = [asset_dir / f"{prefix}-{page:02d}.jpg" for page in sorted(pages)]
    if all(path.exists() for path in expected) and not force:
        return
    if force:
        for item in asset_dir.glob(f"{prefix}-*.jpg"):
            item.unlink()

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob(f"{prefix}-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / prefix
    run(["pdftoppm", "-r", "130", "-jpeg", "-jpegopt", "quality=70", str(pdf), str(output_prefix)])

    for page in sorted(pages):
        rendered = TMP_RENDER_DIR / f"{prefix}-{page:02d}.jpg"
        if not rendered.exists():
            rendered = TMP_RENDER_DIR / f"{prefix}-{page}.jpg"
        if not rendered.exists():
            raise FileNotFoundError(rendered)
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def crop_assets(*, asset_dir: Path, force: bool) -> None:
    asset_dir.mkdir(parents=True, exist_ok=True)
    if force:
        for stale in asset_dir.glob("question-*.jpg"):
            stale.unlink()

    for crop_id, (page, x_offset, y_offset, width, height) in QUESTION_CROPS.items():
        source = asset_dir / f"paper-page-{page:02d}.jpg"
        target = asset_dir / f"question-{crop_id}.jpg"
        if target.exists() and not force:
            continue
        if not source.exists():
            raise FileNotFoundError(source)
        run(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(source),
                "-vf",
                f"crop={width}:{height}:{x_offset}:{y_offset}",
                str(target),
            ]
        )

    answer_source = asset_dir / "paper-page-05.jpg"
    answer_target = asset_dir / "answer-page-05.jpg"
    if (not answer_target.exists()) or force:
        run(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(answer_source),
                "-vf",
                "crop=iw:1280:0:0",
                str(answer_target),
            ]
        )


def question_image_ref(crop_id: str) -> dict[str, str]:
    return {
        "src": f"question-bank/math2-2019/question-{crop_id}.jpg",
        "caption": f"题面裁切图 q{crop_id}",
        "alt": f"2019考研数学二第{crop_id}题题面裁切图",
    }


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/math2-2019/answer-page-{page:02d}.jpg",
        "caption": f"参考答案 p.{page}",
        "alt": f"2019考研数学二参考答案 p.{page}",
    }


def section_for(number: int) -> str:
    if number <= 8:
        return "选择题"
    if number <= 14:
        return "填空题"
    return "解答题"


def type_for(number: int) -> str:
    if number <= 8:
        return "single_choice"
    return "short_answer"


def answer_for(number: int) -> str:
    if number in CHOICE_ANSWERS:
        return CHOICE_ANSWERS[number]
    if number in FILL_ANSWERS:
        return FILL_ANSWERS[number]
    return SHORT_ANSWERS[number]


def question_anchor(number: int) -> str:
    return f"2019考研数学二第{number}题（{section_for(number)}）。题干、公式和图形以题面裁切图为准。"


def explanation_for(number: int) -> str:
    if number <= 8:
        return "答案来自本地百度网盘 2019 数学二真题 PDF；选择题答案键见参考答案页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2019 数学二真题 PDF；完整题干、公式和答案键见原页图。"
    return "答案来自本地百度网盘 2019 数学二真题 PDF；完整演算、证明或推导过程见参考答案页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math2-2019-q{number:02d}",
        "sourceId": PAPER_SOURCE_ID,
        "answerSourceId": PAPER_SOURCE_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "question_crop_and_trimmed_answer_key_page_image",
        "sourceEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceStatus": "matched",
        "answerTextHash": answer_hash,
    }


def build_card(number: int) -> dict[str, Any]:
    question = question_anchor(number)
    answer = answer_for(number)
    question_hash = sha256_text(f"{question}|crops:{QUESTION_IMAGES[number]}")
    answer_hash = sha256_text(f"{answer}|answer-pages:{ANSWER_PAGES[number]}")
    card_type = type_for(number)
    options = (
        [
            {"label": "A", "text": "A"},
            {"label": "B", "text": "B"},
            {"label": "C", "text": "C"},
            {"label": "D", "text": "D"},
        ]
        if card_type == "single_choice"
        else []
    )

    return {
        "id": f"math2-2019-{number:03d}",
        "number": number,
        "paperId": "math2-2019",
        "paperName": "2019考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2019",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": [question_image_ref(crop_id) for crop_id in QUESTION_IMAGES[number]],
        "answerImages": [answer_image_ref(page) for page in ANSWER_PAGES[number]],
        "tags": ["math2", "2019", section_for(number)],
        "difficulty": 3 if number >= 15 else 2,
        "sourceEvidenceId": SOURCE_IDS["paper_answer"],
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": source_evidence(number, answer_hash),
    }


def validate_cards(cards: list[dict[str, Any]], *, asset_dir: Path) -> None:
    issues: list[str] = []
    counts: dict[str, int] = {}
    section_counts: dict[str, int] = {}
    for expected_number, card in enumerate(cards, start=1):
        if card.get("number") != expected_number:
            issues.append(f"card {expected_number}: number={card.get('number')}")
        card_type = str(card.get("type") or "")
        section = str(card.get("section") or "")
        counts[card_type] = counts.get(card_type, 0) + 1
        section_counts[section] = section_counts.get(section, 0) + 1
        if not str(card.get("question") or "").strip():
            issues.append(f"card {expected_number}: missing question")
        if not str(card.get("answer") or "").strip():
            issues.append(f"card {expected_number}: missing answer")
        if not card.get("questionImages"):
            issues.append(f"card {expected_number}: missing question images")
        if not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing answer images")
        for image in [*card.get("questionImages", []), *card.get("answerImages", [])]:
            relative = str(image.get("src", "")).removeprefix("question-bank/math2-2019/")
            if relative and not (asset_dir / relative).exists():
                issues.append(f"card {expected_number}: missing asset {relative}")
            if "paper-page" in relative:
                issues.append(f"card {expected_number}: raw paper page referenced {relative}")
        if card_type == "single_choice":
            labels = [option.get("label") for option in card.get("options", [])]
            if labels != ["A", "B", "C", "D"]:
                issues.append(f"card {expected_number}: invalid options {labels}")
    expected_counts = {"single_choice": 8, "short_answer": 15}
    expected_section_counts = {"选择题": 8, "填空题": 6, "解答题": 9}
    if len(cards) != 23:
        issues.append(f"card count {len(cards)} != 23")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if section_counts != expected_section_counts:
        issues.append(f"section counts {section_counts} != {expected_section_counts}")
    if issues:
        raise ValueError("math2-2019 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "paper-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 6)))
    crop_assets(asset_dir=asset_dir, force=force_assets)
    for raw_page in asset_dir.glob("paper-page-*.jpg"):
        raw_page.unlink()
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards, asset_dir=asset_dir)

    return {
        "id": "math2-2019",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math2-2019",
        "paperName": "2019考研数学二真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math2",
        "year": "2019",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_question_crop_trimmed_answer_key_image_v1",
        "sourceFiles": [
            {
                "id": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": str(PAPER_ANSWER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(PAPER_ANSWER),
                "sourceId": PAPER_SOURCE_ID,
                "evidenceNote": "The 5-page scanned source uses pages 1-4 for questions and page 5 for the reference answer key. Question pages include a faint publisher watermark that does not contain answers; the published answer-page-05 crop removes the promotional tail below q23.",
            },
        ],
        "assetRoot": "question-bank/math2-2019",
        "processed_at": utc_now(),
        "total_cards": len(cards),
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
