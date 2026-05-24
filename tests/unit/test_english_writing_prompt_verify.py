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


if __name__ == "__main__":
    unittest.main()
