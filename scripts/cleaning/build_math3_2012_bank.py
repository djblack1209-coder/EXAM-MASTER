#!/usr/bin/env python3
"""
Build the 2012 Math III public-course bank from the local Baidu Netdisk PDF.

The source is a scanned paper-answer PDF without a usable text layer. Its
answers and explanations appear immediately after each question, so question
evidence is generated from per-question cropped page images.
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
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox" / "public-course-history" / "math3" / "2012"
DEFAULT_OUTPUT = PROJECT_ROOT / "src" / "config" / "flashcard-banks" / "math3-2012.json"
DEFAULT_ASSET_DIR = PROJECT_ROOT / "cdn-assets" / "question-bank" / "math3-2012"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math3-2012-release-assets"

PAPER_ANSWER = RAW_DIR / "2012-math3-paper-answer.pdf"

SOURCE_IDS = {
    "paper_answer": "math3-2012-paper-answer",
}

PAPER_SOURCE_ID = "src_c5b7051dec72a3ed3e898a0b"

CHOICE_ANSWERS = {
    1: "C",
    2: "C",
    3: "B",
    4: "D",
    5: "C",
    6: "B",
    7: "D",
    8: "B",
}

FILL_ANSWERS = {
    9: "e^(-sqrt(2))",
    10: "4",
    11: "2dx - dy",
    12: "4 ln 2",
    13: "-27",
    14: "3/4",
}

SHORT_ANSWERS = {
    15: "极限为 1/12。",
    16: "二重积分值为 1/2。",
    17: "总成本函数 C(x,y)=20x+x^2/4+6y+y^2/2+10000；x=24,y=26 时最小成本 11118；甲产品边际成本为 32 万元/件。",
    18: "不等式证明见答案原页，利用 f(x)=x ln((1+x)/(1-x))+cos x-1-x^2/2 及单调性讨论。",
    19: "f(x)=e^x；曲线 y=f(x^2)∫_0^x f(-t^2)dt 的拐点为 (0,0)。",
    20: "|A|=1-a^4；a=-1；通解为 k(1,1,1,1)^T + (0,-1,0,0)^T。",
    21: "a=-1；二次型矩阵、特征值 0,2,6 及正交变换过程见答案原页。",
    22: "P(X=2Y)=1/4；cov(X-Y,Y)=-2/3；rho_XY=0。",
    23: "f_V(v)=2e^(-2v), v>0, 其他为 0；E(U+V)=2。",
}

QUESTION_CROPS: dict[str, tuple[int, int, int]] = {
    "01": (1, 370, 180),
    "02": (1, 750, 270),
    "03-a": (1, 1175, 345),
    "03-b": (2, 45, 150),
    "04": (2, 395, 285),
    "05": (2, 900, 235),
    "06-a": (2, 1310, 200),
    "06-b": (3, 45, 375),
    "07": (3, 715, 125),
    "08": (3, 1080, 410),
    "09": (4, 555, 75),
    "10": (5, 60, 175),
    "11": (5, 445, 80),
    "12": (5, 720, 50),
    "13": (5, 915, 110),
    "14": (5, 1165, 60),
    "15": (6, 385, 135),
    "16": (6, 895, 105),
    "17": (7, 595, 265),
    "18": (8, 465, 130),
    "19": (9, 160, 150),
    "20": (9, 850, 280),
    "21": (10, 1120, 190),
    "22-a": (11, 1310, 190),
    "22-b": (12, 110, 370),
    "23": (12, 1035, 175),
}

QUESTION_IMAGES: dict[int, list[str]] = {
    1: ["01"],
    2: ["02"],
    3: ["03-a", "03-b"],
    4: ["04"],
    5: ["05"],
    6: ["06-a", "06-b"],
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
    22: ["22-a", "22-b"],
    23: ["23"],
}

ANSWER_PAGES = {
    1: [1],
    2: [1],
    3: [1, 2],
    4: [2],
    5: [2],
    6: [2, 3],
    7: [3],
    8: [3, 4],
    9: [4],
    10: [5],
    11: [5],
    12: [5],
    13: [5],
    14: [5, 6],
    15: [6],
    16: [6, 7],
    17: [7, 8],
    18: [8],
    19: [9],
    20: [9, 10],
    21: [10, 11],
    22: [11, 12],
    23: [12, 13],
}


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


def render_pdf_assets(pdf: Path, prefix: str, *, asset_dir: Path, force: bool, pages: set[int] | None = None) -> None:
    if not pdf.exists():
        raise FileNotFoundError(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    expected = sorted(asset_dir.glob(f"{prefix}-*.jpg"))
    if expected and not force:
        return
    if force:
        for item in expected:
            item.unlink()

    TMP_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for item in TMP_RENDER_DIR.glob(f"{prefix}-*.jpg"):
        item.unlink()

    output_prefix = TMP_RENDER_DIR / prefix
    run(["pdftoppm", "-r", "130", "-jpeg", "-jpegopt", "quality=70", str(pdf), str(output_prefix)])

    for rendered in sorted(TMP_RENDER_DIR.glob(f"{prefix}-*.jpg")):
        page = int(rendered.stem.split("-")[-1])
        if pages is not None and page not in pages:
            continue
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def crop_question_assets(*, asset_dir: Path, force: bool) -> None:
    asset_dir.mkdir(parents=True, exist_ok=True)
    for crop_id, (page, y_offset, height) in QUESTION_CROPS.items():
        source = asset_dir / f"answer-page-{page:02d}.jpg"
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
                f"crop=iw:{height}:0:{y_offset}",
                str(target),
            ]
        )


def question_image_ref(crop_id: str) -> dict[str, str]:
    return {
        "src": f"question-bank/math3-2012/question-{crop_id}.jpg",
        "caption": f"题面裁切图 q{crop_id}",
        "alt": f"2012考研数学三第{crop_id.split('-')[0]}题题面裁切图",
    }


def answer_image_ref(page: int) -> dict[str, str]:
    return {
        "src": f"question-bank/math3-2012/answer-page-{page:02d}.jpg",
        "caption": f"答案解析 p.{page}",
        "alt": f"2012考研数学三答案解析 p.{page}",
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
    return f"2012考研数学三第{number}题（{section_for(number)}）。题干、公式和图形以题面裁切图为准。"


def explanation_for(number: int) -> str:
    if number <= 8:
        return "答案来自本地百度网盘 2012 数学三真题及解析 PDF；选择题解析见答案原页图。"
    if number <= 14:
        return "答案来自本地百度网盘 2012 数学三真题及解析 PDF；完整题干、公式和解析见原页图。"
    return "答案来自本地百度网盘 2012 数学三真题及解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math3-2012-q{number:02d}",
        "sourceId": PAPER_SOURCE_ID,
        "answerSourceId": PAPER_SOURCE_ID,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "question_crop_and_answer_page_image",
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
        "id": f"math3-2012-{number:03d}",
        "number": number,
        "paperId": "math3-2012",
        "paperName": "2012考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2012",
        "section": section_for(number),
        "type": card_type,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": explanation_for(number),
        "questionImages": [question_image_ref(crop_id) for crop_id in QUESTION_IMAGES[number]],
        "answerImages": [answer_image_ref(page) for page in ANSWER_PAGES[number]],
        "tags": ["math3", "2012", section_for(number)],
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
    for expected_number, card in enumerate(cards, start=1):
        if card.get("number") != expected_number:
            issues.append(f"card {expected_number}: number={card.get('number')}")
        card_type = str(card.get("type") or "")
        counts[card_type] = counts.get(card_type, 0) + 1
        if not str(card.get("question") or "").strip():
            issues.append(f"card {expected_number}: missing question")
        if not str(card.get("answer") or "").strip():
            issues.append(f"card {expected_number}: missing answer")
        if not card.get("questionImages"):
            issues.append(f"card {expected_number}: missing question images")
        if not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing answer images")
        for image in [*card.get("questionImages", []), *card.get("answerImages", [])]:
            relative = str(image.get("src", "")).removeprefix("question-bank/math3-2012/")
            if relative and not (asset_dir / relative).exists():
                issues.append(f"card {expected_number}: missing asset {relative}")
        if card_type == "single_choice":
            labels = [option.get("label") for option in card.get("options", [])]
            if labels != ["A", "B", "C", "D"]:
                issues.append(f"card {expected_number}: invalid options {labels}")
    expected_counts = {"single_choice": 8, "short_answer": 15}
    if len(cards) != 23:
        issues.append(f"card count {len(cards)} != 23")
    if counts != expected_counts:
        issues.append(f"type counts {counts} != {expected_counts}")
    if issues:
        raise ValueError("math3-2012 validation failed:\n" + "\n".join(issues))


def build_payload(*, asset_dir: Path, force_assets: bool) -> dict[str, Any]:
    render_pdf_assets(PAPER_ANSWER, "answer-page", asset_dir=asset_dir, force=force_assets, pages=set(range(1, 14)))
    crop_question_assets(asset_dir=asset_dir, force=force_assets)
    cards = [build_card(number) for number in range(1, 24)]
    validate_cards(cards, asset_dir=asset_dir)

    return {
        "id": "math3-2012",
        "source": SOURCE_IDS["paper_answer"],
        "paperId": "math3-2012",
        "paperName": "2012考研数学三真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math3",
        "year": "2012",
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_question_crop_answer_page_image_v1",
        "sourceFiles": [
            {
                "id": SOURCE_IDS["paper_answer"],
                "role": "paper_answer",
                "localPath": str(PAPER_ANSWER.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(PAPER_ANSWER),
                "sourceId": PAPER_SOURCE_ID,
            },
        ],
        "assetRoot": "question-bank/math3-2012",
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
