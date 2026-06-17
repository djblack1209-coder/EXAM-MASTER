from pathlib import Path
import json
import sys
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class EnglishWritingPromptVerifyTest(unittest.TestCase):
    def test_marks_writing_cards_as_essay_prompt_evidence_without_model_answer_claim(self):
        from scripts.baidu.english_writing_prompt_verify import verify_bank

        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "english1-2010.json"
            write_json(
                target,
                {
                    "year": "2010",
                    "cards": [
                        {
                            "id": "english1-2010-051",
                            "number": 51,
                            "type": "analysis",
                            "question": "Write a notice for the Postgraduates' Association.",
                            "answer": "无参考答案",
                            "sourceEvidenceId": "src_question",
                            "sourceEvidence": {"sourceId": "src_question"},
                        }
                    ],
                },
            )

            report = verify_bank(target, write=True, now="2026-05-23T00:00:00Z")
            payload = json.loads(target.read_text(encoding="utf-8"))
            card = payload["cards"][0]

        self.assertEqual(report["summary"]["verifiedWritingCards"], 1)
        self.assertEqual(card["type"], "essay")
        self.assertEqual(card["answerEvidenceStatus"], "matched")
        self.assertIn("按官方题干完成写作任务", card["answer"])
        self.assertEqual(card["answerEvidence"]["evidenceRole"], "official_writing_prompt")
        self.assertIn("no single official answer", card["answerEvidence"]["note"])

    def test_extracts_official_writing_prompts_from_source_pdf_text(self):
        from scripts.baidu.english_writing_prompt_verify import verify_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2025.json"
            prompt_source = tmp_dir / "2025-english1-paper.txt"
            prompt_source.write_text(
                "Section III\n"
                "Writing\n"
                "Part A\n"
                "51. Directions:\n"
                "Read the following email from your classmate Paul and write him a reply.\n"
                "Write your answer in about 100 words on the ANSWER SHEET.\n"
                "20 2025 年全国硕士研究生招生考试（英语一）真题试题\n"
                "Part B\n"
                "52. Directions:\n"
                "Write an essay of 160-200 words based on the following drawing. In your essay you should\n"
                "1) describe the drawing briefly,\n"
                "2) explain its intended meaning, and\n"
                "3) give your comments.\n",
                encoding="utf-8",
            )
            write_json(
                target,
                {
                    "year": "2025",
                    "cards": [
                        {
                            "id": "english1-2025-051",
                            "number": 51,
                            "type": "essay",
                            "question": "Write the composition required by the original paper.",
                            "answer": "参考范文",
                            "sourceEvidenceId": "src_question",
                            "sourceEvidence": {"sourceId": "src_question"},
                        },
                        {
                            "id": "english1-2025-052",
                            "number": 52,
                            "type": "essay",
                            "question": "Write the composition required by the original paper.",
                            "answer": "参考范文",
                            "sourceEvidenceId": "src_question",
                            "sourceEvidence": {"sourceId": "src_question"},
                        },
                    ],
                },
            )

            report = verify_bank(target, prompt_source=prompt_source, write=True, now="2026-05-26T00:00:00Z")
            payload = json.loads(target.read_text(encoding="utf-8"))

        self.assertEqual(report["summary"]["verifiedWritingCards"], 2)
        self.assertIn("Read the following email", payload["cards"][0]["question"])
        self.assertNotIn("真题试题", payload["cards"][0]["question"])
        self.assertIn("drawing", payload["cards"][1]["question"])
        self.assertEqual(payload["cards"][0]["passage"], payload["cards"][0]["question"])
        self.assertIn("按官方题干完成写作任务", payload["cards"][1]["answer"])

    def test_english2_extracts_official_writing_prompts_47_and_48(self):
        from scripts.baidu.english_writing_prompt_verify import verify_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english2-2021.json"
            prompt_source = tmp_dir / "2021-english2-paper.txt"
            prompt_source.write_text(
                "Section IV Writing\n"
                "Part A\n"
                "47. Directions:\n"
                "Suppose you are organizing an online meeting. Write an email to invite a professor.\n"
                "You should write about 100 words on the ANSWER SHEET.\n"
                "Part B\n"
                "48. Directions:\n"
                "Write an essay based on the chart below. In your writing, you should\n"
                "1) interpret the chart, and\n"
                "2) give your comments.\n",
                encoding="utf-8",
            )
            write_json(
                target,
                {
                    "year": "2021",
                    "subject": "english2",
                    "cards": [
                        {
                            "id": "english2-2021-047",
                            "number": 47,
                            "type": "analysis",
                            "question": "Write the composition required by the original paper.",
                            "answer": "参考范文",
                            "sourceEvidenceId": "src_question",
                            "sourceEvidence": {"sourceId": "src_question"},
                        },
                        {
                            "id": "english2-2021-048",
                            "number": 48,
                            "type": "analysis",
                            "question": "Write the composition required by the original paper.",
                            "answer": "参考范文",
                            "sourceEvidenceId": "src_question",
                            "sourceEvidence": {"sourceId": "src_question"},
                        },
                    ],
                },
            )

            report = verify_bank(target, prompt_source=prompt_source, write=True, now="2026-05-26T00:00:00Z")
            payload = json.loads(target.read_text(encoding="utf-8"))

        self.assertEqual(report["summary"]["verifiedWritingCards"], 2)
        self.assertIn("online meeting", payload["cards"][0]["question"])
        self.assertIn("chart", payload["cards"][1]["question"])
        self.assertEqual(payload["cards"][0]["type"], "essay")
        self.assertEqual(payload["cards"][1]["type"], "essay")
        self.assertEqual(payload["cards"][0]["answerEvidence"]["evidenceRole"], "official_writing_prompt")
        self.assertEqual(payload["cards"][1]["answerEvidenceStatus"], "matched")


if __name__ == "__main__":
    unittest.main()
