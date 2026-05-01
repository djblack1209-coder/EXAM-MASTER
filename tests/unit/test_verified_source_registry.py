from pathlib import Path
import json
import sys
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.verified_source_registry import build_verified_source_export  # noqa: E402


class VerifiedSourceRegistryTest(unittest.TestCase):
    def test_build_export_computes_hash_and_preserves_release_evidence_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            source_path = tmp_path / "official-2024-english2.pdf"
            source_path.write_bytes(b"official exam source bytes")
            registry_path = tmp_path / "verified-source-registry.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "sources": [
                            {
                                "id": "official_english2_2024",
                                "localPath": str(source_path),
                                "sourceUrl": "https://example.edu.cn/official-2024-english2.pdf",
                                "subject": "english",
                                "track": "english2",
                                "year": 2024,
                                "sourceType": "official_paper",
                                "answerEvidenceStatus": "matched",
                                "verifiedBy": "release-operator",
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            export = build_verified_source_export(registry_path)

            self.assertEqual(export["version"], 1)
            self.assertEqual(len(export["files"]), 1)
            item = export["files"][0]
            self.assertEqual(item["server_filename"], "official-2024-english2.pdf")
            self.assertEqual(item["sourceUrl"], "https://example.edu.cn/official-2024-english2.pdf")
            self.assertEqual(item["track"], "english2")
            self.assertEqual(item["year"], 2024)
            self.assertEqual(item["status"], "verified")
            self.assertEqual(item["answerEvidenceStatus"], "matched")
            self.assertEqual(item["verifiedBy"], "release-operator")
            self.assertTrue(item["sha256"].startswith("sha256:"))

    def test_rejects_unmatched_answer_evidence_for_release_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            source_path = tmp_path / "official-2024-politics.pdf"
            source_path.write_bytes(b"official exam source bytes")
            registry_path = tmp_path / "verified-source-registry.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "sources": [
                            {
                                "localPath": str(source_path),
                                "sourceUrl": "https://example.edu.cn/official-2024-politics.pdf",
                                "track": "politics",
                                "year": 2024,
                                "answerEvidenceStatus": "manual_review",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            with self.assertRaises(ValueError) as ctx:
                build_verified_source_export(registry_path)

            self.assertIn("answerEvidenceStatus must be matched", str(ctx.exception))

    def test_allows_official_syllabus_without_answer_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            source_path = tmp_path / "2022-math-syllabus.html"
            source_path.write_text("<html><title>2022 math syllabus</title></html>", encoding="utf-8")
            registry_path = tmp_path / "verified-source-registry.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "sources": [
                            {
                                "localPath": str(source_path),
                                "sourceUrl": "https://yankao.neea.edu.cn/html1/report/21115/5103-1.htm",
                                "subject": "math",
                                "track": "math1",
                                "year": 2022,
                                "sourceType": "official_syllabus",
                                "verifiedBy": "release-operator",
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            export = build_verified_source_export(registry_path)

            self.assertEqual(export["files"][0]["sourceType"], "official_syllabus")
            self.assertEqual(export["files"][0]["answerEvidenceStatus"], "not_applicable")

    def test_allows_official_question_paper_as_non_publishable_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            source_path = tmp_path / "2012-politics-question-paper.html"
            source_path.write_text("<html><title>2012 politics paper</title></html>", encoding="utf-8")
            registry_path = tmp_path / "verified-source-registry.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "sources": [
                            {
                                "localPath": str(source_path),
                                "sourceUrl": "https://yz.chsi.com.cn/kyzx/politics/200908/20090813/30056540-8.html",
                                "subject": "politics",
                                "track": "politics",
                                "year": 2012,
                                "sourceType": "official_question_paper",
                                "verifiedBy": "release-operator",
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            export = build_verified_source_export(registry_path)

            self.assertEqual(export["files"][0]["sourceType"], "official_question_paper")
            self.assertEqual(export["files"][0]["answerEvidenceStatus"], "answer_missing")


if __name__ == "__main__":
    unittest.main()
