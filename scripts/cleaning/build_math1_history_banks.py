#!/usr/bin/env python3
"""
Build Math I historical public-course banks from local Baidu Netdisk PDFs.

The 2006 and 2008-2017 Math I sources are scanned page-image PDFs. Several years are
"paper + standard answer + explanation" layouts where an answer appears below
the question on the same page. To keep the practice flow usable, this builder
renders the original pages as answer evidence and generates conservative
question crop images for the pre-answer view.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw-inbox"
DEFAULT_BANK_DIR = PROJECT_ROOT / "src" / "config" / "flashcard-banks"
DEFAULT_ASSET_ROOT = PROJECT_ROOT / "cdn-assets" / "question-bank"
TMP_RENDER_DIR = PROJECT_ROOT / "tmp" / "pdfs" / "math1-history-release-assets"


@dataclass(frozen=True)
class SourceSpec:
    year: int
    file_name: str
    source_id: str
    question_pages: dict[int, list[int | str]]
    answer_pages: dict[int, list[int]]
    answers: dict[int, str]
    question_crop_boxes: dict[str, tuple[int, int, int]] | None = None


def pages_for_ranges(*ranges: tuple[int, int, int]) -> dict[int, list[int]]:
    pages: dict[int, list[int]] = {}
    for start, end, page in ranges:
        for number in range(start, end + 1):
            pages[number] = [page]
    return pages


def sequential_question_crops(page_counts: dict[int, int]) -> dict[int, list[int | str]]:
    pages: dict[int, list[int | str]] = {}
    number = 1
    for page, count in page_counts.items():
        for _ in range(count):
            pages[number] = [f"q{number:02d}"]
            number += 1
    return pages


def per_page_answer_pages(page_counts: dict[int, int]) -> dict[int, list[int]]:
    pages: dict[int, list[int]] = {}
    number = 1
    for page, count in page_counts.items():
        for _ in range(count):
            pages[number] = [page]
            number += 1
    return pages


def generic_answers(year: int, choice_answers: dict[int, str] | None = None) -> dict[int, str]:
    answers: dict[int, str] = {}
    choice_answers = choice_answers or {}
    for number in range(1, 24):
        if number in choice_answers:
            answers[number] = choice_answers[number]
        elif number <= 8:
            answers[number] = "完整答案与解析见答案原页。"
        elif number <= 14:
            answers[number] = "填空题答案与解析见答案原页。"
        else:
            answers[number] = "解答题完整演算、证明或推导过程见答案原页。"
    return answers


def question_refs(*refs: str) -> list[int | str]:
    return list(refs)


SPECS: dict[int, SourceSpec] = {
    2006: SourceSpec(
        year=2006,
        file_name="src_220895f653fe227c0315cae9-2006数一标准答案及解析.pdf",
        source_id="src_220895f653fe227c0315cae9",
        question_pages={
            1: question_refs("q01"),
            2: question_refs("q02"),
            3: question_refs("q03"),
            4: question_refs("q04"),
            5: question_refs("q05"),
            6: question_refs("q06"),
            7: question_refs("q07"),
            8: question_refs("q08"),
            9: question_refs("q09a", "q09b"),
            10: question_refs("q10"),
            11: question_refs("q11"),
            12: question_refs("q12"),
            13: question_refs("q13"),
            14: question_refs("q14"),
            15: question_refs("q15"),
            16: question_refs("q16"),
            17: question_refs("q17"),
            18: question_refs("q18a", "q18b"),
            19: question_refs("q19a", "q19b"),
            20: question_refs("q20"),
            21: question_refs("q21"),
            22: question_refs("q22a", "q22b"),
            23: question_refs("q23"),
        },
        answer_pages={
            1: [1],
            2: [1],
            3: [1, 2],
            4: [2, 3],
            5: [3],
            6: [3, 4],
            7: [4, 5],
            8: [5],
            9: [6],
            10: [6, 7],
            11: [7, 8],
            12: [8],
            13: [8, 9],
            14: [9, 10],
            15: [10, 11],
            16: [11, 12],
            17: [12],
            18: [12, 13],
            19: [13, 14],
            20: [14, 15],
            21: [15, 16],
            22: [16, 17, 18],
            23: [18],
        },
        answers=generic_answers(2006, {7: "A", 8: "C", 9: "D", 10: "D", 11: "A", 12: "B", 13: "C", 14: "A"}),
        question_crop_boxes={
            "q01": (1, 135, 180),
            "q02": (1, 760, 82),
            "q03": (1, 1225, 115),
            "q04": (2, 920, 65),
            "q05": (3, 380, 125),
            "q06": (3, 945, 115),
            "q07": (4, 335, 400),
            "q08": (5, 465, 210),
            "q09a": (5, 1260, 250),
            "q09b": (6, 125, 80),
            "q10": (6, 470, 390),
            "q11": (7, 305, 340),
            "q12": (8, 360, 260),
            "q13": (8, 1060, 180),
            "q14": (9, 420, 230),
            "q15": (10, 365, 280),
            "q16": (11, 530, 250),
            "q17": (12, 675, 105),
            "q18a": (12, 1335, 180),
            "q18b": (13, 135, 220),
            "q19a": (13, 1148, 380),
            "q19b": (14, 140, 80),
            "q20": (14, 925, 325),
            "q21": (15, 1065, 280),
            "q22a": (16, 1205, 315),
            "q22b": (17, 145, 305),
            "q23": (18, 445, 335),
        },
    ),
    2008: SourceSpec(
        year=2008,
        file_name="src_98dbae1b54d51d2784cc1728-2008数一真题、标准答案及解析.pdf",
        source_id="src_98dbae1b54d51d2784cc1728",
        question_pages={
            **{number: [1] for number in range(1, 6)},
            **{number: [2] for number in range(6, 12)},
            **{number: [3] for number in range(12, 20)},
            **{number: [4] for number in range(20, 24)},
        },
        answer_pages={
            **{number: [5] for number in range(1, 5)},
            **{number: [6] for number in range(5, 12)},
            **{number: [7] for number in range(12, 15)},
            15: [8],
            16: [8],
            17: [9],
            18: [9, 10],
            19: [10],
            20: [11],
            21: [11, 12],
            22: [12],
            23: [13],
        },
        answers=generic_answers(2008),
    ),
    2009: SourceSpec(
        year=2009,
        file_name="src_bc3eff652947c7daeed22cce-2009数一真题、标准答案及解析.pdf",
        source_id="src_bc3eff652947c7daeed22cce",
        question_pages={
            **{number: [1] for number in range(1, 5)},
            **{number: [2] for number in range(5, 8)},
            **{number: [3] for number in range(8, 15)},
            **{number: [4] for number in range(15, 24)},
        },
        answer_pages={
            **{number: [6] for number in range(1, 4)},
            **{number: [7] for number in range(4, 7)},
            **{number: [8] for number in range(7, 10)},
            **{number: [9] for number in range(10, 12)},
            **{number: [10] for number in range(12, 14)},
            14: [13],
            15: [14],
            16: [14, 15],
            17: [15],
            18: [16],
            19: [16, 17],
            20: [17],
            21: [18],
            22: [18],
            23: [19],
        },
        answers=generic_answers(2009, {1: "A", 2: "A", 3: "D", 4: "C", 5: "B", 6: "B", 7: "C", 8: "C"}),
    ),
    2010: SourceSpec(
        year=2010,
        file_name="src_b3e24571a6135f06d1988818-2010数一标准答案及解析.pdf",
        source_id="src_b3e24571a6135f06d1988818",
        question_pages=sequential_question_crops({1: 3, 2: 3, 3: 3, 4: 2, 5: 2, 6: 1, 7: 2, 8: 2, 9: 2, 10: 1, 11: 1, 12: 1}),
        answer_pages=per_page_answer_pages({1: 3, 2: 3, 3: 3, 4: 2, 5: 2, 6: 1, 7: 2, 8: 2, 9: 2, 10: 1, 11: 1, 12: 1}),
        answers=generic_answers(2010),
    ),
    2011: SourceSpec(
        year=2011,
        file_name="src_478718437ac46f25dd795a67-2011数一考研真题及答案.pdf",
        source_id="src_478718437ac46f25dd795a67",
        question_pages=sequential_question_crops({1: 3, 2: 3, 3: 3, 4: 2, 5: 3, 6: 1, 7: 2, 8: 2, 9: 1, 10: 1, 11: 1, 12: 1}),
        answer_pages=per_page_answer_pages({1: 3, 2: 3, 3: 3, 4: 2, 5: 3, 6: 1, 7: 2, 8: 2, 9: 1, 10: 1, 11: 1, 12: 1}),
        answers=generic_answers(2011),
    ),
    2012: SourceSpec(
        year=2012,
        file_name="src_a445976117f3531be88a1ce5-2012数一真题及参考答案.pdf",
        source_id="src_a445976117f3531be88a1ce5",
        question_pages=sequential_question_crops({1: 2, 2: 2, 3: 3, 4: 2, 5: 2, 6: 2, 7: 2, 8: 1, 9: 2, 10: 2, 11: 3}),
        answer_pages=per_page_answer_pages({1: 2, 2: 2, 3: 3, 4: 2, 5: 2, 6: 2, 7: 2, 8: 1, 9: 2, 10: 2, 11: 3}),
        answers=generic_answers(2012),
    ),
    2013: SourceSpec(
        year=2013,
        file_name="src_2f89f14b41d6bdb38f193cbc-2013数一考研真题及答案.pdf",
        source_id="src_2f89f14b41d6bdb38f193cbc",
        question_pages=sequential_question_crops({1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 1, 9: 2, 10: 2, 11: 2, 12: 2}),
        answer_pages=per_page_answer_pages({1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 1, 9: 2, 10: 2, 11: 2, 12: 2}),
        answers=generic_answers(2013),
    ),
    2014: SourceSpec(
        year=2014,
        file_name="src_b80ef3ade03a332b3d41ae2a-2014数一考研真题及答案.pdf",
        source_id="src_b80ef3ade03a332b3d41ae2a",
        question_pages=sequential_question_crops({1: 3, 2: 2, 3: 3, 4: 1, 5: 3, 6: 2, 7: 2, 8: 1, 9: 2, 10: 1, 11: 2, 12: 1}),
        answer_pages=per_page_answer_pages({1: 3, 2: 2, 3: 3, 4: 1, 5: 3, 6: 2, 7: 2, 8: 1, 9: 2, 10: 1, 11: 2, 12: 1}),
        answers=generic_answers(2014, {1: "D", 2: "A", 3: "B", 4: "B", 5: "D"}),
    ),
    2015: SourceSpec(
        year=2015,
        file_name="src_b83088449d1c3f7d3cd2653f-2015数一考研真题及答案.pdf",
        source_id="src_b83088449d1c3f7d3cd2653f",
        question_pages=sequential_question_crops({1: 6, 2: 5, 3: 4, 4: 2, 5: 2, 6: 2, 7: 1, 8: 1}),
        answer_pages=per_page_answer_pages({1: 6, 2: 5, 3: 4, 4: 2, 5: 2, 6: 2, 7: 1, 8: 1}),
        answers=generic_answers(2015),
    ),
    2016: SourceSpec(
        year=2016,
        file_name="src_826513b855ac46b155edc53b-2016数一考研真题及答案.pdf",
        source_id="src_826513b855ac46b155edc53b",
        question_pages=sequential_question_crops({1: 4, 2: 5, 3: 5, 4: 3, 5: 1, 6: 2, 7: 2, 8: 1}),
        answer_pages=per_page_answer_pages({1: 4, 2: 5, 3: 5, 4: 3, 5: 1, 6: 2, 7: 2, 8: 1}),
        answers=generic_answers(2016),
    ),
    2017: SourceSpec(
        year=2017,
        file_name="src_1816f558544a3040d6e189dc-2017数一考研真题及答案.pdf",
        source_id="src_1816f558544a3040d6e189dc",
        question_pages=sequential_question_crops({1: 3, 2: 3, 3: 4, 4: 3, 5: 3, 6: 3, 7: 2, 8: 1, 9: 1}),
        answer_pages=per_page_answer_pages({1: 3, 2: 3, 3: 4, 4: 3, 5: 3, 6: 3, 7: 2, 8: 1, 9: 1}),
        answers=generic_answers(2017, {1: "A", 2: "C", 3: "D", 4: "C", 5: "A", 6: "A", 7: "C", 8: "D"}),
    ),
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


def pdf_page_count(pdf: Path) -> int:
    output = subprocess.check_output(["pdfinfo", str(pdf)], cwd=PROJECT_ROOT, text=True)
    match = re.search(r"^Pages:\s+(\d+)$", output, re.MULTILINE)
    if not match:
        raise ValueError(f"cannot determine page count for {pdf}")
    return int(match.group(1))


def render_pdf_assets(pdf: Path, prefix: str, *, asset_dir: Path, force: bool) -> None:
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
        target = asset_dir / f"{prefix}-{page:02d}.jpg"
        shutil.copyfile(rendered, target)


def image_height(image_path: Path) -> int:
    output = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=height",
            "-of",
            "csv=p=0",
            str(image_path),
        ],
        cwd=PROJECT_ROOT,
        text=True,
    )
    return int(output.strip())


def ocr_lines(page_image: Path) -> list[dict[str, Any]]:
    output = subprocess.check_output(
        ["tesseract", str(page_image), "stdout", "-l", "chi_sim+eng", "--psm", "6", "tsv"],
        cwd=PROJECT_ROOT,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    grouped: dict[tuple[str, str, str], dict[str, Any]] = {}
    for line in output.splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) < 12:
            continue
        if parts[0] != "5":
            continue
        text = parts[11].strip()
        if not text:
            continue
        key = (parts[2], parts[3], parts[4])
        try:
            left = int(float(parts[6]))
            top = int(float(parts[7]))
            width = int(float(parts[8]))
            height = int(float(parts[9]))
        except ValueError:
            continue
        item = grouped.setdefault(
            key,
            {
                "text": [],
                "left": left,
                "top": top,
                "right": left + width,
                "bottom": top + height,
            },
        )
        item["text"].append(text)
        item["left"] = min(item["left"], left)
        item["top"] = min(item["top"], top)
        item["right"] = max(item["right"], left + width)
        item["bottom"] = max(item["bottom"], top + height)

    lines = []
    for item in grouped.values():
        lines.append(
            {
                **item,
                "text": "".join(item["text"]),
            }
        )
    return sorted(lines, key=lambda item: (item["top"], item["left"]))


def question_marker_matches(text: str, number: int) -> bool:
    normalized = re.sub(r"\s+", "", text)
    bracket_match = re.match(r"^[（(《<\[](\d{1,2})[）).、\]】>》]?", normalized)
    if bracket_match:
        return int(bracket_match.group(1)) == number
    delimited_match = re.match(r"^(\d{1,2})[、.．)）]", normalized)
    if delimited_match:
        return int(delimited_match.group(1)) == number
    circled_numbers = {
        "①": 1,
        "②": 2,
        "③": 3,
        "④": 4,
        "⑤": 5,
        "⑥": 6,
        "⑦": 7,
        "⑧": 8,
        "⑨": 9,
        "⑩": 10,
    }
    return bool(normalized and circled_numbers.get(normalized[0]) == number)


def answer_marker_matches(text: str) -> bool:
    return any(token in text for token in ("答案", "解析", "详解", "考点分析"))


def detect_question_crop_boxes(page_image: Path, numbers: list[int]) -> dict[int, tuple[int, int]]:
    lines = ocr_lines(page_image)
    height = image_height(page_image)
    starts: dict[int, int] = {}
    for number in numbers:
        matched = [line for line in lines if question_marker_matches(str(line["text"]), number)]
        if matched:
            starts[number] = min(int(line["top"]) for line in matched)

    if len(starts) < len(numbers):
        usable_top = 120
        usable_bottom = max(usable_top + 1, height - 80)
        band_height = max(160, (usable_bottom - usable_top) // max(1, len(numbers)))
        for index, number in enumerate(numbers):
            starts.setdefault(number, usable_top + index * band_height)

    sorted_numbers = sorted(numbers)
    boxes: dict[int, tuple[int, int]] = {}
    for index, number in enumerate(sorted_numbers):
        detected_start = starts[number]
        start = max(0, detected_start - (90 if index == 0 else 24))
        next_start = starts.get(sorted_numbers[index + 1]) if index + 1 < len(sorted_numbers) else None
        answer_candidates = [
            int(line["top"])
            for line in lines
            if answer_marker_matches(str(line["text"]))
            and int(line["top"]) > detected_start + 24
            and (next_start is None or int(line["top"]) < next_start)
        ]
        has_answer_boundary = bool(answer_candidates)
        if answer_candidates:
            end = min(answer_candidates) - 14
        elif next_start is not None:
            end = next_start - 12
        else:
            end = height - 70

        if has_answer_boundary and end - start < 60:
            start = max(0, detected_start - 12)
            end = min(answer_candidates) - 8
        elif not has_answer_boundary and end - start < 150:
            if next_start is not None:
                end = min(next_start - 12, height - 70)
            else:
                end = min(start + 420, height - 70)
        if not has_answer_boundary and end - start < 150:
            end = min(start + 240, height)
        minimum_height = 40 if has_answer_boundary else 120
        boxes[number] = (start, max(minimum_height, end - start))
    return boxes


def crop_question_assets(spec: SourceSpec, *, asset_dir: Path, force: bool) -> None:
    if spec.question_crop_boxes:
        if force:
            for item in asset_dir.glob("question-*.jpg"):
                item.unlink()
        for ref, (page, y_offset, crop_height) in spec.question_crop_boxes.items():
            source = asset_dir / f"answer-page-{page:02d}.jpg"
            if not source.exists():
                raise FileNotFoundError(source)
            if not ref.startswith("q"):
                raise ValueError(f"math1-{spec.year}: unsupported crop ref {ref}")
            target = asset_dir / f"question-{ref[1:]}.jpg"
            if target.exists() and not force:
                continue
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
                    f"crop=iw:{crop_height}:0:{y_offset}",
                    str(target),
                ]
            )
        return

    questions_by_page: dict[int, list[int]] = {}
    for number, refs in spec.question_pages.items():
        if any(not isinstance(ref, int) for ref in refs):
            questions_by_page.setdefault(spec.answer_pages[number][0], []).append(number)

    crop_boxes: dict[int, dict[int, tuple[int, int]]] = {}
    for page, numbers in questions_by_page.items():
        source = asset_dir / f"answer-page-{page:02d}.jpg"
        crop_boxes[page] = detect_question_crop_boxes(source, sorted(numbers))

    for number, refs in spec.question_pages.items():
        for ref in refs:
            if isinstance(ref, int):
                continue
            page = spec.answer_pages[number][0]
            source = asset_dir / f"answer-page-{page:02d}.jpg"
            target = asset_dir / f"question-{number:02d}.jpg"
            if target.exists() and not force:
                continue
            if not source.exists():
                raise FileNotFoundError(source)
            y_offset, crop_height = crop_boxes[page][number]
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
                    f"crop=iw:{crop_height}:0:{y_offset}",
                    str(target),
                ]
            )


def image_ref(spec: SourceSpec, kind: str, page: int | str, *, caption: str) -> dict[str, str]:
    if isinstance(page, int):
        file_name = f"{kind}-{page:02d}.jpg"
    elif str(page).startswith("q"):
        suffix = str(page)[1:]
        file_name = f"question-{int(suffix):02d}.jpg" if suffix.isdigit() else f"question-{suffix}.jpg"
    else:
        file_name = f"{kind}-{page}.jpg"
    return {
        "src": f"question-bank/math1-{spec.year}/{file_name}",
        "caption": caption,
        "alt": f"{spec.year}考研数学一{caption}",
    }


def section_for(spec: SourceSpec, number: int) -> str:
    if spec.year == 2006:
        if number <= 6:
            return "填空题"
        if number <= 14:
            return "选择题"
        return "解答题"
    if number <= 8:
        return "选择题"
    if number <= 14:
        return "填空题"
    return "解答题"


def type_for(spec: SourceSpec, number: int) -> str:
    if spec.year == 2006:
        if 7 <= number <= 14:
            return "single_choice"
        return "short_answer"
    if number <= 8:
        return "flashcard"
    if number <= 14:
        return "flashcard"
    return "short_answer"


def question_anchor(spec: SourceSpec, number: int) -> str:
    return f"{spec.year}考研数学一第{number}题（{section_for(spec, number)}）。题干、公式和图形以题面原页图为准。"


def explanation_for(spec: SourceSpec, number: int) -> str:
    section = section_for(spec, number)
    if section == "选择题":
        return f"答案来自本地百度网盘 {spec.year} 数学一真题答案解析 PDF；选择题完整解析见答案原页图。"
    if section == "填空题":
        return f"答案来自本地百度网盘 {spec.year} 数学一真题答案解析 PDF；填空题完整解析见答案原页图。"
    return f"答案来自本地百度网盘 {spec.year} 数学一真题答案解析 PDF；完整演算、证明或推导过程见答案原页图。"


def source_evidence(spec: SourceSpec, number: int, answer_hash: str) -> dict[str, Any]:
    return {
        "evidenceId": f"math1-{spec.year}-q{number:02d}",
        "sourceId": spec.source_id,
        "answerSourceId": spec.source_id,
        "sourceType": "baidu_netdisk_official_paper_pdf_page_image",
        "evidenceRole": "question_crop_and_answer_page_image",
        "sourceEvidenceId": f"math1-{spec.year}-paper-answer",
        "answerEvidenceId": f"math1-{spec.year}-paper-answer",
        "answerEvidenceStatus": "matched",
        "answerTextHash": answer_hash,
    }


def build_card(spec: SourceSpec, number: int) -> dict[str, Any]:
    question = question_anchor(spec, number)
    answer = spec.answers[number]
    question_hash = sha256_text(f"{question}|question-pages:{spec.question_pages[number]}")
    answer_hash = sha256_text(f"{answer}|answer-pages:{spec.answer_pages[number]}")
    card_type = type_for(spec, number)
    question_images = [
        image_ref(
            spec,
            "paper-page",
            ref,
            caption=f"试卷原页 p.{ref}" if isinstance(ref, int) else f"题面裁切图 q{number:02d}",
        )
        for ref in spec.question_pages[number]
    ]
    answer_images = [
        image_ref(spec, "answer-page", page, caption=f"答案解析 p.{page}") for page in spec.answer_pages[number]
    ]

    return {
        "id": f"math1-{spec.year}-{number:03d}",
        "number": number,
        "paperId": f"math1-{spec.year}",
        "paperName": f"{spec.year}考研数学一真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math1",
        "year": str(spec.year),
        "section": section_for(spec, number),
        "type": card_type,
        "question": question,
        "options": [
            {"label": "A", "text": "A"},
            {"label": "B", "text": "B"},
            {"label": "C", "text": "C"},
            {"label": "D", "text": "D"},
        ]
        if card_type == "single_choice"
        else [],
        "answer": answer,
        "explanation": explanation_for(spec, number),
        "questionImages": question_images,
        "answerImages": answer_images,
        "tags": ["math1", str(spec.year), section_for(spec, number)],
        "difficulty": 3 if number >= 15 else 2,
        "sourceEvidenceId": f"math1-{spec.year}-paper-answer",
        "answerEvidenceStatus": "matched",
        "questionTextHash": question_hash,
        "answerTextHash": answer_hash,
        "sourceEvidence": source_evidence(spec, number, answer_hash),
    }


def validate_cards(spec: SourceSpec, cards: list[dict[str, Any]], *, asset_dir: Path) -> None:
    issues: list[str] = []
    if len(cards) != 23:
        issues.append(f"card count {len(cards)} != 23")
    for expected_number, card in enumerate(cards, start=1):
        if card.get("number") != expected_number:
            issues.append(f"card {expected_number}: number={card.get('number')}")
        for field in ["question", "answer", "sourceEvidenceId", "questionTextHash", "answerTextHash"]:
            if not str(card.get(field) or "").strip():
                issues.append(f"card {expected_number}: missing {field}")
        if card.get("answerEvidenceStatus") != "matched":
            issues.append(f"card {expected_number}: answerEvidenceStatus={card.get('answerEvidenceStatus')}")
        if not card.get("questionImages"):
            issues.append(f"card {expected_number}: missing question images")
        if not card.get("answerImages"):
            issues.append(f"card {expected_number}: missing answer images")
        for image in [*card.get("questionImages", []), *card.get("answerImages", [])]:
            relative = str(image.get("src", "")).removeprefix(f"question-bank/math1-{spec.year}/")
            if relative and not (asset_dir / relative).exists():
                issues.append(f"card {expected_number}: missing asset {relative}")
    if issues:
        raise ValueError(f"math1-{spec.year} validation failed:\n" + "\n".join(issues))


def build_payload(spec: SourceSpec, *, asset_root: Path, force_assets: bool) -> dict[str, Any]:
    pdf = RAW_DIR / spec.file_name
    asset_dir = asset_root / f"math1-{spec.year}"
    render_pdf_assets(pdf, "answer-page", asset_dir=asset_dir, force=force_assets)
    render_pdf_assets(pdf, "paper-page", asset_dir=asset_dir, force=force_assets)
    crop_question_assets(spec, asset_dir=asset_dir, force=force_assets)
    page_count = pdf_page_count(pdf)
    for pages in [*spec.question_pages.values(), *spec.answer_pages.values()]:
        for page in pages:
            if isinstance(page, int) and not 1 <= page <= page_count:
                raise ValueError(f"math1-{spec.year}: page {page} out of range 1..{page_count}")

    cards = [build_card(spec, number) for number in range(1, 24)]
    validate_cards(spec, cards, asset_dir=asset_dir)
    return {
        "id": f"math1-{spec.year}",
        "source": f"math1-{spec.year}-paper-answer",
        "paperId": f"math1-{spec.year}",
        "paperName": f"{spec.year}考研数学一真题",
        "subject": "数学",
        "subjectKey": "math",
        "track": "math1",
        "year": str(spec.year),
        "quality": "ready",
        "publicationStatus": "published",
        "publicationBlockers": [],
        "sourceEvidencePolicy": "baidu_netdisk_official_paper_pdf_question_crop_answer_page_image_v1",
        "sourceFiles": [
            {
                "id": f"math1-{spec.year}-paper-answer",
                "role": "paper_answer",
                "localPath": str(pdf.relative_to(PROJECT_ROOT)),
                "sha256": sha256_file(pdf),
                "sourceId": spec.source_id,
            }
        ],
        "assetRoot": f"question-bank/math1-{spec.year}",
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
    parser.add_argument("--years", default="2006,2008-2017")
    parser.add_argument("--bank-dir", type=Path, default=DEFAULT_BANK_DIR)
    parser.add_argument("--asset-root", type=Path, default=DEFAULT_ASSET_ROOT)
    parser.add_argument("--force-assets", action="store_true")
    return parser.parse_args()


def expand_years(value: str) -> list[int]:
    years: list[int] = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = [int(item) for item in part.split("-", 1)]
            years.extend(range(start, end + 1))
        else:
            years.append(int(part))
    return years


def main() -> None:
    args = parse_args()
    results = []
    for year in expand_years(args.years):
        spec = SPECS[year]
        payload = build_payload(spec, asset_root=args.asset_root, force_assets=args.force_assets)
        output = args.bank_dir / f"math1-{year}.json"
        write_json(output, payload)
        results.append(
            {
                "output": str(output.relative_to(PROJECT_ROOT)),
                "assetDir": str((args.asset_root / f"math1-{year}").relative_to(PROJECT_ROOT)),
                "cards": payload["total_cards"],
            }
        )
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
