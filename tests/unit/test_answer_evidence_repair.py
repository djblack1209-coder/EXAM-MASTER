from pathlib import Path
import json
import subprocess
import sys
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
SCRIPT = PROJECT_ROOT / "scripts" / "baidu" / "answer_evidence_repair.py"


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def bank_payload(source: str, subject: str, year: int, cards: list[dict]) -> dict:
    return {
        "source": source,
        "subject": subject,
        "year": year,
        "total_cards": len(cards),
        "cards": cards,
    }


class AnswerEvidenceRepairTest(unittest.TestCase):
    def test_repair_fills_missing_answer_from_companion_without_marking_matched(self):
        from scripts.baidu.answer_evidence_repair import repair_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "flashcards" / "english1-2001.json"
            companion = tmp_dir / "flashcards" / "english-2001.json"
            queue = tmp_dir / "cleaning-queue.json"
            manifest = tmp_dir / "source-manifest.json"

            write_json(
                target,
                bank_payload(
                    "2001 paper.pdf",
                    "english1",
                    2001,
                    [
                        {
                            "id": "english1-2001-021",
                            "number": 21,
                            "type": "single_choice",
                            "question": "Question 21",
                            "options": [
                                {"label": "A", "text": "Alpha"},
                                {"label": "B", "text": "Beta"},
                                {"label": "C", "text": "Gamma"},
                                {"label": "D", "text": "Delta"},
                            ],
                            "answer": "",
                            "explanation": "",
                        }
                    ],
                ),
            )
            write_json(
                companion,
                bank_payload(
                    "2001 answers.pdf",
                    "english",
                    2001,
                    [
                        {
                            "id": "english-2001-021",
                            "number": 21,
                            "type": "single_choice",
                            "question": "Answer row 21",
                            "answer": "A",
                            "explanation": "Answer evidence text",
                        }
                    ],
                ),
            )
            write_json(
                queue,
                {
                    "tasks": [
                        {"sourceId": "src_question", "outputPath": str(target), "status": "completed"},
                        {"sourceId": "src_answer", "outputPath": str(companion), "status": "completed"},
                    ]
                },
            )
            write_json(
                manifest,
                {
                    "items": [
                        {
                            "sourceId": "src_question",
                            "sourceType": "official_paper",
                            "contentHash": "question-pdf-hash",
                            "remotePath": "/EXAM-MASTER/2001 paper.pdf",
                        },
                        {
                            "sourceId": "src_answer",
                            "sourceType": "official_paper",
                            "contentHash": "answer-pdf-hash",
                            "remotePath": "/EXAM-MASTER/2001 answers.pdf",
                        },
                    ]
                },
            )

            report = repair_bank(
                target,
                [companion],
                queue_path=queue,
                source_manifest_path=manifest,
                write=True,
                mark_companions_supporting=True,
                now="2026-04-30T00:00:00Z",
            )
            repaired = json.loads(target.read_text(encoding="utf-8"))
            companion_payload = json.loads(companion.read_text(encoding="utf-8"))
            queue_payload = json.loads(queue.read_text(encoding="utf-8"))
            card = repaired["cards"][0]

        self.assertEqual(report["summary"]["repairedAnswers"], 1)
        self.assertEqual(report["summary"]["remainingMissingAnswers"], 0)
        self.assertTrue(report["summary"]["queueUpdated"])
        self.assertEqual(card["answer"], "A")
        self.assertEqual(card["explanation"], "Answer evidence text")
        self.assertEqual(card["answerEvidenceStatus"], "candidate_matched")
        self.assertNotEqual(card["answerEvidenceStatus"], "matched")
        self.assertEqual(card["sourceEvidenceId"], "src_question")
        self.assertEqual(card["answerEvidenceSourceId"], "src_answer")
        self.assertTrue(card["questionTextHash"].startswith("sha256:"))
        self.assertTrue(card["answerTextHash"].startswith("sha256:"))
        self.assertTrue(companion_payload["supportingEvidenceOnly"])
        self.assertEqual(companion_payload["supportingEvidenceUsedBy"], str(target))
        target_task = next(task for task in queue_payload["tasks"] if task["sourceId"] == "src_question")
        self.assertEqual(target_task["missingAnswerCount"], 0)
        self.assertEqual(target_task["answerEvidenceStatus"], "candidate_repaired")
        self.assertEqual(target_task["answerEvidenceRepairedAt"], "2026-04-30T00:00:00Z")

    def test_conflicting_companion_answers_are_reported_and_skipped(self):
        from scripts.baidu.answer_evidence_repair import repair_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "target.json"
            first = tmp_dir / "first.json"
            second = tmp_dir / "second.json"
            write_json(
                target,
                bank_payload(
                    "target.pdf",
                    "english1",
                    2001,
                    [{"id": "q21", "number": 21, "type": "single_choice", "question": "Q", "answer": ""}],
                ),
            )
            write_json(first, bank_payload("a.pdf", "english", 2001, [{"number": 21, "answer": "A"}]))
            write_json(second, bank_payload("b.pdf", "english", 2001, [{"number": 21, "answer": "B"}]))

            report = repair_bank(target, [first, second], write=True, now="2026-04-30T00:00:00Z")
            card = json.loads(target.read_text(encoding="utf-8"))["cards"][0]

        self.assertEqual(report["summary"]["conflictCount"], 1)
        self.assertEqual(report["summary"]["repairedAnswers"], 0)
        self.assertEqual(card["answer"], "")

    def test_original_answer_key_wins_over_conflicting_cleaned_json_candidate(self):
        from scripts.baidu.answer_evidence_repair import repair_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "target.json"
            companion = tmp_dir / "companion.json"
            answer_key_text = tmp_dir / "answer-key.txt"
            queue = tmp_dir / "cleaning-queue.json"
            answer_key_text.write_text("2005年考研英语（一）真题答案速查表\n45 B\n41 ~45 ECGFB\n", encoding="utf-8")
            write_json(
                target,
                bank_payload(
                    "target.pdf",
                    "english1",
                    2005,
                    [{"id": "q45", "number": 45, "type": "single_choice", "question": "Q45", "answer": ""}],
                ),
            )
            write_json(companion, bank_payload("answers.pdf", "english", 2005, [{"number": 45, "answer": "F"}]))
            write_json(
                queue,
                {
                    "tasks": [
                        {"sourceId": "src_answer_key", "outputPath": str(companion), "localPath": str(answer_key_text)}
                    ]
                },
            )

            report = repair_bank(target, [companion], queue_path=queue, write=True, now="2026-04-30T00:00:00Z")
            card = json.loads(target.read_text(encoding="utf-8"))["cards"][0]

        self.assertEqual(report["summary"]["conflictCount"], 0)
        self.assertEqual(report["summary"]["repairedAnswers"], 1)
        self.assertEqual(card["answer"], "B")
        self.assertEqual(card["answerEvidence"]["conflictResolution"], "preferred_original_answer_key")
        self.assertEqual(len(card["answerEvidence"]["conflictCandidates"]), 2)

    def test_repair_fills_missing_answers_from_companion_answer_key_text(self):
        from scripts.baidu.answer_evidence_repair import repair_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "target.json"
            companion = tmp_dir / "companion.json"
            answer_key_text = tmp_dir / "answer-key.txt"
            queue = tmp_dir / "cleaning-queue.json"
            answer_key_text.write_text(
                "2010年考研英语（一）真题答案速查表\n"
                "21-25 BADAB  36 -40 ADCBD 41 ~45 BFDGA\n",
                encoding="utf-8",
            )
            write_json(
                target,
                bank_payload(
                    "target.pdf",
                    "english1",
                    2010,
                    [
                        {"id": "q21", "number": 21, "type": "single_choice", "question": "Q21", "answer": ""},
                        {"id": "q22", "number": 22, "type": "single_choice", "question": "Q22", "answer": ""},
                        {"id": "q36", "number": 36, "type": "single_choice", "question": "Q36", "answer": ""},
                        {
                            "id": "q41",
                            "number": 41,
                            "type": "analysis",
                            "question": "For questions 41-45, choose the most suitable paragraphs.",
                            "answer": "完整的参考答案全文",
                        },
                    ],
                ),
            )
            write_json(companion, bank_payload("answers.pdf", "english", 2010, []))
            write_json(
                queue,
                {
                    "tasks": [
                        {"sourceId": "src_answer_key", "outputPath": str(companion), "localPath": str(answer_key_text)}
                    ]
                },
            )

            report = repair_bank(
                target,
                [companion],
                queue_path=queue,
                write=True,
                now="2026-04-30T00:00:00Z",
            )
            repaired_cards = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual(report["summary"]["repairedAnswers"], 4)
        self.assertEqual(report["summary"]["answerKeyTextCandidates"], 15)
        self.assertEqual([card["answer"] for card in repaired_cards], ["B", "A", "A", "BFDGA"])
        self.assertTrue(all(card["answerEvidenceStatus"] == "candidate_matched" for card in repaired_cards))
        self.assertEqual(repaired_cards[0]["answerEvidence"]["method"], "companion_answer_key_text")

    def test_repair_reads_answer_key_text_from_companion_source_in_raw_inbox(self):
        from scripts.baidu import answer_evidence_repair
        from scripts.baidu.answer_evidence_repair import repair_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "target.json"
            companion = tmp_dir / "companion.json"
            raw_inbox = tmp_dir / "raw-inbox"
            raw_inbox.mkdir()
            answer_key_text = raw_inbox / "src_answer-2005答案速查.txt"
            answer_key_text.write_text(
                "2005年考研英语（一）真题答案速查表\n"
                "21-25 CBACB 41 ~45 ECGFB\n",
                encoding="utf-8",
            )
            write_json(
                target,
                bank_payload(
                    "target.pdf",
                    "english1",
                    2005,
                    [
                        {"id": "q21", "number": 21, "type": "single_choice", "question": "Q21", "answer": ""},
                        {
                            "id": "q41",
                            "number": 41,
                            "type": "analysis",
                            "question": "For questions 41-45, choose the suitable paragraphs.",
                            "answer": "",
                        },
                    ],
                ),
            )
            write_json(companion, bank_payload("src_answer-2005答案速查.txt", "english-support", 2005, []))

            original_raw_inbox = answer_evidence_repair.DEFAULT_RAW_INBOX
            try:
                answer_evidence_repair.DEFAULT_RAW_INBOX = raw_inbox
                report = repair_bank(target, [companion], write=True, now="2026-04-30T00:00:00Z")
            finally:
                answer_evidence_repair.DEFAULT_RAW_INBOX = original_raw_inbox
            repaired_cards = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual(report["summary"]["repairedAnswers"], 2)
        self.assertEqual(report["summary"]["answerKeyTextCandidates"], 10)
        self.assertEqual(report["summary"]["answerKeyGroupCandidates"], 2)
        self.assertEqual([card["answer"] for card in repaired_cards], ["C", "ECGFB"])
        self.assertEqual(repaired_cards[1]["answerEvidence"]["method"], "companion_answer_key_range_text")

    def test_repair_fills_subjective_answers_from_numbered_answer_key_text(self):
        from scripts.baidu.answer_evidence_repair import repair_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "target.json"
            companion = tmp_dir / "companion.json"
            answer_key_text = tmp_dir / "answer-key.txt"
            queue = tmp_dir / "cleaning-queue.json"
            answer_key_text.write_text(
                "2007年考研英语（一）真题答案速查表\n"
                "1 ~5 BDACC   41 ~45 FDBCE\n"
                "46. 传统上,这些院校一直把法律学习视为律师的专利，而不是受教育者知识储备的必要组成\n"
                "    部分。\n"
                "47. 另一方面，法律将这些概念和日常实际相结合,正如新闻记者每天报道和评论新闻时的做\n"
                "    法一样。\n"
                "英语（一）试题.14.（共14页）\n",
                encoding="utf-8",
            )
            write_json(
                target,
                bank_payload(
                    "target.pdf",
                    "english1",
                    2007,
                    [
                        {"id": "q46", "number": 46, "type": "analysis", "question": "Q46", "answer": ""},
                        {"id": "q47", "number": 47, "type": "analysis", "question": "Q47", "answer": ""},
                    ],
                ),
            )
            write_json(companion, bank_payload("answers.pdf", "english", 2007, []))
            write_json(
                queue,
                {
                    "tasks": [
                        {"sourceId": "src_answer_key", "outputPath": str(companion), "localPath": str(answer_key_text)}
                    ]
                },
            )

            report = repair_bank(target, [companion], queue_path=queue, write=True, now="2026-04-30T00:00:00Z")
            repaired_cards = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual(report["summary"]["repairedAnswers"], 2)
        self.assertEqual(report["summary"]["numberedAnswerTextCandidates"], 2)
        self.assertEqual(
            repaired_cards[0]["answer"],
            "传统上,这些院校一直把法律学习视为律师的专利，而不是受教育者知识储备的必要组成部分。",
        )
        self.assertEqual(
            repaired_cards[1]["answer"],
            "另一方面，法律将这些概念和日常实际相结合,正如新闻记者每天报道和评论新闻时的做法一样。",
        )
        self.assertEqual(repaired_cards[0]["answerEvidence"]["method"], "companion_numbered_answer_text")

    def test_repair_fills_politics_subjective_answer_from_numbered_answer_points(self):
        from scripts.baidu.answer_evidence_repair import repair_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "politics-2023.json"
            companion = tmp_dir / "politics-support.json"
            answer_text = tmp_dir / "politics-answer.txt"
            queue = tmp_dir / "cleaning-queue.json"
            answer_text.write_text(
                "35.【答案要点】（1）人民性是马克思主义的本质属性，坚持人民至上是根本政治立场。\n"
                "坚持以人民为中心的发展思想，发展为了人民、发展依靠人民、发展成果由人民共享。\n"
                "36.【答案要点】团结奋斗是中国共产党和中国人民最显著的精神标识。\n",
                encoding="utf-8",
            )
            write_json(
                target,
                bank_payload(
                    "politics paper.pdf",
                    "politics",
                    2023,
                    [{"id": "politics-2023-035", "number": 35, "type": "analysis", "question": "Q35", "answer": ""}],
                ),
            )
            write_json(companion, bank_payload("politics answers.pdf", "politics", 2023, []))
            write_json(
                queue,
                {
                    "tasks": [
                        {"sourceId": "src_question", "outputPath": str(target), "status": "completed"},
                        {"sourceId": "src_answer", "outputPath": str(companion), "localPath": str(answer_text)},
                    ]
                },
            )

            report = repair_bank(target, [companion], queue_path=queue, write=True, now="2026-04-30T00:00:00Z")
            repaired_cards = json.loads(target.read_text(encoding="utf-8"))["cards"]

        self.assertEqual(report["summary"]["repairedAnswers"], 1)
        self.assertIn("人民性是马克思主义的本质属性", repaired_cards[0]["answer"])
        self.assertEqual(repaired_cards[0]["answerEvidence"]["method"], "companion_numbered_answer_text")

    def test_cli_writes_report_and_requires_write_flag_to_mutate(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "target.json"
            companion = tmp_dir / "companion.json"
            output = tmp_dir / "repair-report.json"
            write_json(
                target,
                bank_payload(
                    "target.pdf",
                    "english1",
                    2001,
                    [{"id": "q21", "number": 21, "type": "single_choice", "question": "Q", "answer": ""}],
                ),
            )
            write_json(companion, bank_payload("answer.pdf", "english", 2001, [{"number": 21, "answer": "A"}]))

            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--target",
                    str(target),
                    "--companion",
                    str(companion),
                    "--output",
                    str(output),
                ],
                cwd=PROJECT_ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

            card = json.loads(target.read_text(encoding="utf-8"))["cards"][0]
            report = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(result.returncode, 0)
        self.assertEqual(card["answer"], "")
        self.assertEqual(report["summary"]["repairedAnswers"], 1)
        self.assertIn("write=False", result.stdout)


if __name__ == "__main__":
    unittest.main()
