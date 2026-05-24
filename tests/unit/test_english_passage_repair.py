from pathlib import Path
import json
import subprocess
import sys
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
SCRIPT = PROJECT_ROOT / "scripts" / "baidu" / "english_passage_repair.py"


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class EnglishPassageRepairTest(unittest.TestCase):
    def test_extracts_passage_groups_and_repairs_existing_cards(self):
        from scripts.baidu import english_passage_repair

        paper_text = """
Section I Use of English
Directions:
Read the following text. Choose the best word(s). (10 points)
Cloze passage first paragraph.

Cloze passage second paragraph.

1. A. One B. Two C. Three D. Four

Section II Reading Comprehension
Part A

Text 1

Text one paragraph.

21. Question 21

Text 2

Text two paragraph.

26. Question 26

Text 3

Text three paragraph.

31. Question 31

Text 4

Text four paragraph.

Part B

Part B material. [A] Candidate paragraph A.
[B] Candidate paragraph B.
[C] Candidate paragraph C.
[D] Candidate paragraph D.
[E] Candidate paragraph E.
[F] Candidate paragraph F.
[G] Candidate paragraph G.

Part C

Part C translation material.

Section III Writing
"""

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2005.json"
            source = tmp_dir / "paper.pdf"
            write_json(
                target,
                {
                    "cards": [
                        {"id": "q1", "number": 1, "question": "Q1"},
                        {"id": "q21", "number": 21, "question": "Q21"},
                        {"id": "q26", "number": 26, "question": "Q26"},
                        {"id": "q31", "number": 31, "question": "Q31"},
                        {"id": "q36", "number": 36, "question": "Q36"},
                        {"id": "q41", "number": 41, "question": "Q41"},
                        {"id": "q46", "number": 46, "question": "Q46"},
                    ]
                },
            )
            source.write_text("placeholder", encoding="utf-8")
            original_extract = english_passage_repair.extract_pdf_text
            try:
                english_passage_repair.extract_pdf_text = lambda _path: paper_text
                report = english_passage_repair.repair_english_passages(target, source, write=True)
            finally:
                english_passage_repair.extract_pdf_text = original_extract
            repaired = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual(report["summary"]["passageGroupCount"], 7)
        self.assertEqual(report["summary"]["repairedCardCount"], 7)
        self.assertEqual(repaired[0]["groupId"], "cloze")
        self.assertEqual(repaired[1]["groupId"], "text1")
        self.assertEqual(repaired[5]["groupId"], "part-b")
        self.assertIn("Text one paragraph", repaired[1]["passage"])
        self.assertTrue(repaired[1]["passageSegments"])
        self.assertEqual(len(repaired[5]["options"]), 7)
        self.assertEqual(repaired[5]["options"][0]["label"], "A")
        self.assertIn("Part B material", repaired[5]["passage"])

    def test_extracts_scanned_style_fullwidth_choice_markers_and_strips_watermarks(self):
        from scripts.baidu import english_passage_repair

        paper_text = """
--- PAGE 1 ---
【微信公众号：研池大叔】
Section I Use of English
Directions：
Read the following text. Choose the best word（s）. （10 points）
Cloze body.

1.［A］ one
［B］ two

Section II Reading Comprehension
PartA
Text 1
Text one paragraph.

21.The word means

Text 2
Text two paragraph.

26.Question

Text 3
Text three paragraph.

31.Question

Text 4
Text four paragraph.

36.Question

Part B
Directions：
In the following article, choose A-G. （10 points）
Part B article body.
（41）
［A］ Option A.
［B］ Option B.
［C］ Option C.
［D］ Option D.
［E］ Option E.
［F］ Option F.
［G］ Option G.

Part C
Directions：
Read carefully. （10 points）
Part C body.

Section III Writing
"""

        passages = english_passage_repair.extract_english_passages(paper_text)

        self.assertEqual(set(passages.keys()), {"cloze", "text1", "text2", "text3", "text4", "part-b", "part-c"})
        self.assertEqual(passages["cloze"]["passage"], "Cloze body.")
        self.assertEqual(passages["text1"]["passage"], "Text one paragraph.")
        self.assertEqual(passages["part-b"]["passage"], "Part B article body. （41）")
        self.assertEqual([option["label"] for option in passages["part-b"]["options"]], list("ABCDEFG"))

    def test_extracts_part_b_heading_options_with_dot_labels(self):
        from scripts.baidu import english_passage_repair

        paper_text = """
Section I Use of English
Cloze body.
1. [AJ one

Section II Reading Comprehension
PartA
Text 1
Text one paragraph.
21. Question
Text 2
Text two paragraph.
26. Question
Text 3
Text three paragraph.
31. Question
Text 4
Text four paragraph.
36. Question

Part B
Directions:
Choose a heading from the list A-G. (10 points)
A. Set a Good Example for Your Kids
B. Build Your Kids' Work Skills
C. Place Time Limits on Leisure Activities
D. Talk about the Future on a Regular Basis
E. Help Kids Develop Coping Strategies
F. Help Your Kids Figure Out Who They Are
G. Build Your Kids' Sense of Responsibility
How Can a Parent Help?
Mothers and fathers can do a lot.
41
You can start this process when they are 11 or 12.

Part C
Directions:
Part C body.

Section III Writing
"""

        passages = english_passage_repair.extract_english_passages(paper_text)

        self.assertLess(len(passages["cloze"]["passage"]), 80)
        self.assertEqual([option["label"] for option in passages["part-b"]["options"]], list("ABCDEFG"))
        self.assertEqual(passages["part-b"]["options"][0]["text"], "Set a Good Example for Your Kids")
        self.assertIn("How Can a Parent Help?", passages["part-b"]["passage"])
        self.assertNotIn("Set a Good Example", passages["part-b"]["passage"])

    def test_rebuilds_missing_cloze_cards_from_source_options(self):
        from scripts.baidu import english_passage_repair

        paper_text = """
Section I
Use of English
Directions:
Choose the best words. (10 points)
Cloze article body with blank 1 and blank 2.
1. [AJ Alpha
B, Beta
[C] Gamma
[D] Delta
2. [A] One
[B] Two
[C] Three
[D] Four

Section II Reading Comprehension
Text 1
Text one paragraph.
21. Question
"""

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2007.json"
            source = tmp_dir / "paper.pdf"
            write_json(
                target,
                {
                    "id": "english1-2007",
                    "subject": "english1",
                    "year": 2007,
                    "cards": [
                        {
                            "id": "english1-2007-001",
                            "number": 1,
                            "question": "wrong merged question",
                            "answer": "C",
                            "options": [],
                        }
                    ],
                },
            )
            source.write_text("placeholder", encoding="utf-8")
            original_extract = english_passage_repair.extract_pdf_text
            try:
                english_passage_repair.extract_pdf_text = lambda _path: paper_text
                report = english_passage_repair.repair_english_passages(
                    target,
                    source,
                    write=True,
                    repair_cloze_cards=True,
                    reset_cloze_answers=True,
                )
            finally:
                english_passage_repair.extract_pdf_text = original_extract
            repaired = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual(report["summary"]["clozeOptionNumberCount"], 2)
        self.assertEqual(report["summary"]["clozeRebuiltCount"], 2)
        self.assertEqual(report["summary"]["clozeAddedCount"], 1)
        self.assertEqual([card["number"] for card in repaired], [1, 2])
        self.assertEqual(repaired[0]["answer"], "")
        self.assertEqual(repaired[0]["question"], "完形填空第 1 空：阅读全文后选择最合适的选项。")
        self.assertEqual([option["label"] for option in repaired[0]["options"]], list("ABCD"))
        self.assertIn("Cloze article body", repaired[1]["passage"])

    def test_rebuilds_missing_translation_cards_from_part_c_segments(self):
        from scripts.baidu import english_passage_repair

        paper_text = """
Section I Use of English
Cloze body.
1. A. one B. two C. three D. four

Section II Reading Comprehension
PartA
Text 1
Text one paragraph.
21. Question
Text 2
Text two paragraph.
26. Question
Text 3
Text three paragraph.
31. Question
Text 4
Text four paragraph.
36. Question

Part B
Part B body. [A] One
[B] Two
[C] Three
[D] Four
[E] Five
[F] Six
[G] Seven

Part C
Directions:
Read carefully. (10 points)
Part C intro. (46) First translation segment. (47) Second translation segment.

Section III Writing
"""

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2005.json"
            source = tmp_dir / "paper.pdf"
            write_json(target, {"id": "english1-2005", "year": 2005, "subject": "english1", "cards": []})
            source.write_text("placeholder", encoding="utf-8")
            original_extract = english_passage_repair.extract_pdf_text
            try:
                english_passage_repair.extract_pdf_text = lambda _path: paper_text
                report = english_passage_repair.repair_english_passages(
                    target,
                    source,
                    write=True,
                    repair_translation_cards=True,
                    reset_translation_answers=True,
                )
            finally:
                english_passage_repair.extract_pdf_text = original_extract
            repaired = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual(report["summary"]["translationSegmentCount"], 2)
        self.assertEqual(report["summary"]["translationRebuiltCount"], 2)
        self.assertEqual(report["summary"]["translationAddedCount"], 2)
        self.assertEqual([card["number"] for card in repaired], [46, 47])
        self.assertEqual(repaired[0]["type"], "translation")
        self.assertEqual(repaired[0]["answer"], "")
        self.assertEqual(repaired[0]["targetSegment"], "First translation segment.")
        self.assertIn("Part C intro", repaired[1]["passage"])

    def test_rebuilds_translation_card_when_ocr_misses_closing_parenthesis(self):
        from scripts.baidu import english_passage_repair

        paper_text = """
Section I Use of English
Cloze body.
1. A. one B. two C. three D. four

Section II Reading Comprehension
PartA
Text 1
Text one paragraph.
21. Question
Text 2
Text two paragraph.
26. Question
Text 3
Text three paragraph.
31. Question
Text 4
Text four paragraph.
36. Question

Part B
Part B body. [A] One
[B] Two
[C] Three
[D] Four
[E] Five
[F] Six
[G] Seven

Part C
Directions:
Read carefully. (10 points)
Part C intro. （46 Allen's first marked sentence. (47) Second marked sentence.

Section III Writing
"""

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2011.json"
            source = tmp_dir / "paper.pdf"
            write_json(target, {"id": "english1-2011", "year": 2011, "subject": "english1", "cards": []})
            source.write_text("placeholder", encoding="utf-8")
            original_extract = english_passage_repair.extract_pdf_text
            try:
                english_passage_repair.extract_pdf_text = lambda _path: paper_text
                report = english_passage_repair.repair_english_passages(
                    target,
                    source,
                    write=True,
                    repair_translation_cards=True,
                    reset_translation_answers=True,
                )
            finally:
                english_passage_repair.extract_pdf_text = original_extract
            repaired = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual(report["summary"]["translationSegmentCount"], 2)
        self.assertEqual([card["number"] for card in repaired], [46, 47])
        self.assertEqual(repaired[0]["targetSegment"], "Allen's first marked sentence.")

    def test_rebuilds_missing_part_b_cards_from_source_options(self):
        from scripts.baidu import english_passage_repair

        paper_text = """
Section I Use of English
Cloze body.
1. [A] One [B] Two [C] Three [D] Four

Section II Reading Comprehension
Text 1
Text one paragraph.
21. Question
Text 2
Text two paragraph.
26. Question
Text 3
Text three paragraph.
31. Question
Text 4
Text four paragraph.
36. Question

Part B
Directions:
Choose A-G.
Part B article body.
(41)
[A] Option A.
[B] Option B.
[C] Option C.
[D] Option D.
[E] Option E.
[F] Option F.
[G] Option G.

Part C
Part C body.

Section III Writing
"""

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2010.json"
            source = tmp_dir / "paper.pdf"
            write_json(
                target,
                {
                    "id": "english1-2010",
                    "year": 2010,
                    "subject": "english1",
                    "cards": [{"id": "english1-2010-041", "number": 41, "answer": "A"}],
                },
            )
            source.write_text("placeholder", encoding="utf-8")
            original_extract = english_passage_repair.extract_pdf_text
            try:
                english_passage_repair.extract_pdf_text = lambda _path: paper_text
                english_passage_repair.repair_english_passages(
                    target,
                    source,
                    write=True,
                    repair_part_b_cards=True,
                    reset_part_b_answers=True,
                )
            finally:
                english_passage_repair.extract_pdf_text = original_extract
            repaired = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual([card["number"] for card in repaired], [41, 42, 43, 44, 45])
        self.assertEqual(repaired[0]["answer"], "")
        self.assertEqual(repaired[-1]["type"], "single_choice")
        self.assertEqual([option["label"] for option in repaired[-1]["options"]], list("ABCDEFG"))
        self.assertIn("Part B article body", repaired[-1]["passage"])

    def test_cli_writes_report_without_mutating_unless_write_is_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "target.json"
            source = tmp_dir / "source.txt"
            output = tmp_dir / "report.json"
            write_json(target, {"cards": [{"id": "q21", "number": 21, "question": "Q21"}]})
            source.write_text("not a real pdf", encoding="utf-8")

            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--target",
                    str(target),
                    "--source-pdf",
                    str(source),
                    "--output",
                    str(output),
                ],
                cwd=PROJECT_ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            card = json.loads(target.read_text(encoding="utf-8"))["cards"][0]

            self.assertEqual(result.returncode, 0)
            self.assertTrue(output.exists())
            self.assertNotIn("passage", card)
            self.assertIn("write=False", result.stdout)


if __name__ == "__main__":
    unittest.main()
