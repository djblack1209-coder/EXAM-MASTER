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
            card = repaired["cards"][0]

        self.assertEqual(report["summary"]["repairedAnswers"], 1)
        self.assertEqual(report["summary"]["remainingMissingAnswers"], 0)
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
        self.assertEqual(report["summary"]["answerKeyTextCandidates"], 11)
        self.assertEqual([card["answer"] for card in repaired_cards], ["B", "A", "A", "BFDGA"])
        self.assertTrue(all(card["answerEvidenceStatus"] == "candidate_matched" for card in repaired_cards))
        self.assertEqual(repaired_cards[0]["answerEvidence"]["method"], "companion_answer_key_text")

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
