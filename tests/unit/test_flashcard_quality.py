from pathlib import Path
import json
import subprocess
import sys
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
SCRIPT = PROJECT_ROOT / "scripts" / "baidu" / "flashcard_quality.py"


def write_bank(directory: Path, name: str, cards: list[dict]) -> Path:
    path = directory / name
    path.write_text(
        json.dumps(
            {
                "source": name.replace(".json", ".pdf"),
                "subject": "english",
                "year": "2024",
                "total_cards": len(cards),
                "cards": cards,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


class FlashcardQualityTest(unittest.TestCase):
    def test_report_blocks_missing_answers_and_unmatched_source_evidence(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                    },
                    {
                        "id": "english-2024-002",
                        "type": "single_choice",
                        "question": "Question 2",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "",
                    },
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["fileCount"], 1)
        self.assertEqual(report["summary"]["cardCount"], 2)
        self.assertEqual(report["summary"]["missingAnswerCount"], 1)
        self.assertEqual(report["summary"]["sourceEvidenceBlockerCount"], 2)
        self.assertEqual(report["files"][0]["status"], "blocked")
        self.assertEqual(report["files"][0]["blockedCards"][1]["cardId"], "english-2024-002")
        self.assertIn("answer", report["files"][0]["blockedCards"][1]["missingFields"])

    def test_report_treats_known_answer_placeholders_as_missing(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-041",
                        "type": "analysis",
                        "question": "Question 41",
                        "options": [],
                        "answer": "完整的参考答案全文",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertEqual(report["summary"]["missingAnswerCount"], 1)
        self.assertIn("answer", report["files"][0]["blockedCards"][0]["missingFields"])

    def test_report_allows_answer_matched_cards_with_hashes(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                        "sourceEvidenceId": "src_ev_english_2024_001",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": "sha256:q1",
                        "answerTextHash": "sha256:a1",
                        "passage": "Full source passage.",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertTrue(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["blockerCount"], 0)
        self.assertEqual(report["files"][0]["status"], "passed")

    def test_report_allows_english_gap_fill_questions_with_a_to_g_options(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-041",
                        "type": "single_choice",
                        "question": "Choose the most suitable paragraph.",
                        "options": [
                            {"label": "A", "text": "Option A"},
                            {"label": "B", "text": "Option B"},
                            {"label": "C", "text": "Option C"},
                            {"label": "D", "text": "Option D"},
                            {"label": "E", "text": "Option E"},
                            {"label": "F", "text": "Option F"},
                            {"label": "G", "text": "Option G"},
                        ],
                        "answer": "E",
                        "sourceEvidenceId": "src_ev_english_2024_041",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": "sha256:q41",
                        "answerTextHash": "sha256:a41",
                        "passage": "Full source passage.",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertTrue(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["blockerCount"], 0)

    def test_report_allows_english_gap_fill_questions_with_a_to_h_options(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2023.json",
                [
                    {
                        "id": "english-2023-041",
                        "type": "single_choice",
                        "question": "Choose the most suitable paragraph.",
                        "options": [
                            {"label": "A", "text": "Option A"},
                            {"label": "B", "text": "Option B"},
                            {"label": "C", "text": "Option C"},
                            {"label": "D", "text": "Option D"},
                            {"label": "E", "text": "Option E"},
                            {"label": "F", "text": "Option F"},
                            {"label": "G", "text": "Option G"},
                            {"label": "H", "text": "Option H"},
                        ],
                        "answer": "F",
                        "sourceEvidenceId": "src_ev_english_2023_041",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": "sha256:q41",
                        "answerTextHash": "sha256:a41",
                        "passage": "Full source passage.",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertTrue(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["blockerCount"], 0)

    def test_report_counts_invalid_choice_options_as_grading_blocker(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                        ],
                        "answer": "A",
                        "sourceEvidenceId": "src_ev_english_2024_001",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": "sha256:q1",
                        "answerTextHash": "sha256:a1",
                        "passage": "Full source passage.",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["gradingBlockerCount"], 1)
        self.assertIn("options=A-D-or-A-G", report["files"][0]["blockedCards"][0]["missingFields"])

    def test_report_blocks_draft_publication_status_even_when_cards_are_structured(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            path = write_bank(
                flashcard_dir,
                "english1-2025-draft.json",
                [
                    {
                        "id": "english1-2025-021",
                        "type": "single_choice",
                        "question": "Question 21",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "C",
                        "sourceEvidenceId": "src_ev_english_2025_021",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": "sha256:q21",
                        "answerTextHash": "sha256:a21",
                    }
                ],
            )
            payload = json.loads(path.read_text(encoding="utf-8"))
            payload["publicationStatus"] = "draft"
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            report = build_quality_report(flashcard_dir)

        self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["publicationBlockerCount"], 1)
        self.assertEqual(report["files"][0]["status"], "blocked")
        self.assertIn("publicationStatus=draft", report["files"][0]["publicationBlockers"])

    def test_report_skips_supporting_evidence_files(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                        "sourceEvidenceId": "src_ev_english_2024_001",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": "sha256:q1",
                        "answerTextHash": "sha256:a1",
                        "passage": "Full source passage.",
                    }
                ],
            )
            support_path = write_bank(
                flashcard_dir,
                "english-support-abcd1234-2024.json",
                [
                    {
                        "id": "support-001",
                        "type": "single_choice",
                        "question": "Support only",
                        "options": [],
                        "answer": "",
                    }
                ],
            )
            support_payload = json.loads(support_path.read_text(encoding="utf-8"))
            support_payload["supportingEvidenceOnly"] = True
            support_path.write_text(json.dumps(support_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            report = build_quality_report(flashcard_dir)

        self.assertTrue(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["fileCount"], 1)
        self.assertEqual(report["summary"]["skippedFileCount"], 1)
        self.assertEqual(report["summary"]["missingAnswerCount"], 0)
        self.assertEqual(report["skippedFiles"][0]["reason"], "supportingEvidenceOnly")

    def test_report_skips_files_outside_release_year_scope_by_default(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english1-2001.json",
                [
                    {
                        "id": "english1-2001-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                    }
                ],
            )
            payload_path = flashcard_dir / "english1-2001.json"
            payload = json.loads(payload_path.read_text(encoding="utf-8"))
            payload["year"] = "2001"
            payload_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            report = build_quality_report(flashcard_dir)

        self.assertEqual(report["summary"]["fileCount"], 0)
        self.assertEqual(report["summary"]["skippedFileCount"], 1)
        self.assertEqual(report["skippedFiles"][0]["reason"], "outsideReleaseYear:2001")

    def test_report_blocks_english_choice_cards_without_passage_material(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english1-2024.json",
                [
                    {
                        "id": "english1-2024-021",
                        "type": "single_choice",
                        "question": "Question 21",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                        "sourceEvidenceId": "src_ev_english_2024_021",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": "sha256:q21",
                        "answerTextHash": "sha256:a21",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["gradingBlockerCount"], 1)
        self.assertIn("passage", report["files"][0]["blockedCards"][0]["missingFields"])

    def test_cli_fail_on_blockers_exits_two_and_writes_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            flashcard_dir = tmp_dir / "flashcards"
            flashcard_dir.mkdir()
            output = tmp_dir / "quality.json"
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [],
                        "answer": "",
                    }
                ],
            )

            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--flashcard-dir",
                    str(flashcard_dir),
                    "--output",
                    str(output),
                    "--fail-on-blockers",
                ],
                cwd=PROJECT_ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(result.returncode, 2)
            self.assertTrue(output.exists())
            self.assertIn("canPromoteToPublic=False", result.stdout)


if __name__ == "__main__":
    unittest.main()
