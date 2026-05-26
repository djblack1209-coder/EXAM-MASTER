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


class EnglishAnswerKeyVerifyTest(unittest.TestCase):
    def test_verifier_promotes_exact_answer_key_matches_but_leaves_writing_unverified(self):
        from scripts.baidu.english_answer_key_verify import verify_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2010.json"
            answer_key = tmp_dir / "src_answer-2010年真题及答案速查.txt"
            manifest = tmp_dir / "source-manifest.json"
            answer_key.write_text(
                "2010年考研英语（一）真题答案速查表\n"
                "1 - 5 ABCBC  6 ~ 10 BDACD  41 ~45 BFDGA\n"
                "46. 科学家急忙赶来挽救这种局面。\n",
                encoding="utf-8",
            )
            write_json(
                target,
                {
                    "year": "2010",
                    "cards": [
                        {
                            "id": "english1-2010-001",
                            "number": 1,
                            "type": "single_choice",
                            "question": "Q1",
                            "answer": "A",
                            "sourceEvidenceId": "src_question",
                        },
                        {
                            "id": "english1-2010-041",
                            "number": 41,
                            "type": "single_choice",
                            "question": "Q41",
                            "answer": "B",
                            "sourceEvidenceId": "src_question",
                        },
                        {
                            "id": "english1-2010-046",
                            "number": 46,
                            "type": "analysis",
                            "question": "Translate 46",
                            "answer": "",
                            "sourceEvidenceId": "src_question",
                        },
                        {
                            "id": "english1-2010-051",
                            "number": 51,
                            "type": "analysis",
                            "question": "Writing Part A",
                            "answer": "No official answer",
                            "sourceEvidenceId": "src_question",
                        },
                    ],
                },
            )
            write_json(
                manifest,
                {
                    "items": [
                        {
                            "sourceId": "src_answer",
                            "status": "discovered",
                            "answerEvidenceStatus": "",
                            "processing": {"verified": False},
                        }
                    ]
                },
            )

            report = verify_bank(
                target,
                answer_key,
                write=True,
                update_manifest=True,
                manifest_path=manifest,
                now="2026-05-23T00:00:00Z",
            )
            payload = json.loads(target.read_text(encoding="utf-8"))
            updated_manifest = json.loads(manifest.read_text(encoding="utf-8"))

        self.assertEqual(report["summary"]["matchedCards"], 3)
        self.assertEqual(report["summary"]["writingUnverifiedCount"], 1)
        self.assertEqual(report["summary"]["manifestUpdates"], 1)
        matched = {card["number"]: card for card in payload["cards"]}
        self.assertEqual(matched[1]["answerEvidenceStatus"], "matched")
        self.assertEqual(matched[41]["answerEvidenceStatus"], "matched")
        self.assertEqual(matched[46]["type"], "translation")
        self.assertEqual(matched[46]["answer"], "科学家急忙赶来挽救这种局面。")
        self.assertNotEqual(matched[51].get("answerEvidenceStatus"), "matched")
        manifest_item = updated_manifest["items"][0]
        self.assertEqual(manifest_item["status"], "verified")
        self.assertEqual(manifest_item["answerEvidenceStatus"], "matched")
        self.assertTrue(manifest_item["processing"]["verified"])

    def test_verifier_records_mismatch_and_repairs_from_source_key(self):
        from scripts.baidu.english_answer_key_verify import verify_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2010.json"
            answer_key = tmp_dir / "src_answer-2010年真题及答案速查.txt"
            answer_key.write_text("2010年考研英语（一）真题答案速查表\n1 - 5 ABCBC\n", encoding="utf-8")
            write_json(
                target,
                {
                    "year": "2010",
                    "cards": [
                        {
                            "id": "english1-2010-002",
                            "number": 2,
                            "type": "single_choice",
                            "question": "Q2",
                            "answer": "D",
                            "sourceEvidenceId": "src_question",
                        }
                    ],
                },
            )

            report = verify_bank(target, answer_key, write=True, now="2026-05-23T00:00:00Z")
            payload = json.loads(target.read_text(encoding="utf-8"))

        self.assertEqual(report["summary"]["mismatchCount"], 1)
        self.assertEqual(report["mismatches"][0]["cardAnswer"], "D")
        self.assertEqual(report["mismatches"][0]["answerKey"], "B")
        self.assertEqual(payload["cards"][0]["answer"], "B")
        self.assertEqual(payload["cards"][0]["answerEvidenceStatus"], "matched")

    def test_verifier_uses_dominant_question_source_for_cards_missing_source_id(self):
        from scripts.baidu.english_answer_key_verify import verify_bank

        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            target = tmp_dir / "english1-2010.json"
            answer_key = tmp_dir / "src_answer-2010年真题及答案速查.txt"
            answer_key.write_text("2010年考研英语（一）真题答案速查表\n1 - 5 ABCBC\n", encoding="utf-8")
            write_json(
                target,
                {
                    "year": "2010",
                    "cards": [
                        {
                            "id": "english1-2010-001",
                            "number": 1,
                            "type": "single_choice",
                            "question": "Q1",
                            "answer": "A",
                            "sourceEvidenceId": "src_question",
                        },
                        {
                            "id": "english1-2010-002",
                            "number": 2,
                            "type": "single_choice",
                            "question": "Q2",
                            "answer": "B",
                            "sourceEvidenceId": "src_question",
                        },
                        {
                            "id": "english1-2010-003",
                            "number": 3,
                            "type": "single_choice",
                            "question": "Q3",
                            "answer": "C",
                        },
                    ],
                },
            )

            verify_bank(target, answer_key, write=True, now="2026-05-23T00:00:00Z")
            payload = json.loads(target.read_text(encoding="utf-8"))

        self.assertEqual(payload["cards"][2]["sourceEvidenceId"], "src_question")
        self.assertEqual(payload["cards"][2]["sourceEvidence"]["sourceId"], "src_question")

    def test_verifier_parses_inline_answer_pdf_style_keys(self):
        from scripts.baidu.english_answer_key_verify import build_answer_key

        with tempfile.TemporaryDirectory() as tmp:
            answer_key = Path(tmp) / "2025-english1-answer.txt"
            answer_key.write_text(
                "2025 年全国硕士研究生招生考试（英语一）参考答案\n"
                "1.【答案】[B] prone\n"
                "18.【答案】[B]connected\n"
                "41. 【答案】[D] Five years ago,\n"
                "(46) Recent decades have seen science move into a convention where engagement in the subject can only be done through institutions such as a university.\n"
                "【参考译文】近几十年来，科学已经进入了一种惯例，在这种惯例中，\n"
                "3 2025 年全国硕士研究生招生考试（英语一）参考答案\n"
                "只有通过大学等机构才能参与这一学科。\n"
                "(47) But by utilizing the natural curiosity of the general public it is possible to overcome many of these challenges.\n"
                "【参考译文】但是，通过利用公众的自然好奇心，可以让非科学家通过直接参与研究过程来克服许多挑战。\n"
                "Section III Writing\n",
                encoding="utf-8",
            )

            key = build_answer_key(answer_key)

        self.assertEqual(key["choiceAnswers"]["1"], "B")
        self.assertEqual(key["choiceAnswers"]["18"], "B")
        self.assertEqual(key["choiceAnswers"]["41"], "D")
        self.assertEqual(
            key["numberedAnswers"]["46"],
            "近几十年来，科学已经进入了一种惯例，在这种惯例中，只有通过大学等机构才能参与这一学科。",
        )
        self.assertEqual(
            key["numberedAnswers"]["47"],
            "但是，通过利用公众的自然好奇心，可以让非科学家通过直接参与研究过程来克服许多挑战。",
        )


if __name__ == "__main__":
    unittest.main()
