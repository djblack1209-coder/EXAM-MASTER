from pathlib import Path
import sys
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.public_course_candidate_coverage import analyze_candidate_coverage  # noqa: E402


class PublicCourseCandidateCoverageTest(unittest.TestCase):
    def test_counts_raw_candidates_clean_candidates_and_answer_named_sources(self):
        manifest = {
            "items": [
                {
                    "sourceId": "src_clean_math",
                    "sourceChannel": "netdisk_full_path",
                    "eligible": True,
                    "sourceType": "official_paper",
                    "track": "math1",
                    "year": 2010,
                    "fileName": "2010年数学（一）真题及参考答案.pdf",
                    "remotePath": "/EXAM-MASTER/考研历年真题/03.考研数学/2010年数学（一）真题及参考答案.pdf",
                    "riskFlags": [],
                },
                {
                    "sourceId": "src_brand_math",
                    "sourceChannel": "netdisk_full_path",
                    "eligible": True,
                    "sourceType": "institution_candidate",
                    "track": "math1",
                    "year": 2010,
                    "fileName": "2010数学一真题做题本.pdf",
                    "remotePath": "/EXAM-MASTER/考研历年真题/03.考研数学/2010数学一真题做题本.pdf",
                    "riskFlags": ["brand_leak", "copyright_review_required"],
                },
                {
                    "sourceId": "src_app_dir",
                    "sourceChannel": "app_dir",
                    "eligible": True,
                    "sourceType": "official_paper",
                    "track": "math1",
                    "year": 2011,
                    "fileName": "2011数学一真题.pdf",
                    "remotePath": "/apps/考研大师/raw-pdf/2011数学一真题.pdf",
                    "riskFlags": [],
                },
            ]
        }

        report = analyze_candidate_coverage(manifest, tracks=["math1"], years=[2010, 2011], source_channel="netdisk_full_path")
        row = report["matrix"]["math1"]["2010"]

        self.assertEqual(report["summary"]["math1"]["presentYears"], [2010])
        self.assertEqual(report["summary"]["math1"]["missingYears"], [2011])
        self.assertEqual(report["summary"]["math1"]["cleanYears"], [2010])
        self.assertEqual(report["summary"]["math1"]["answerNamedYears"], [2010])
        self.assertEqual(row["candidateCount"], 2)
        self.assertEqual(row["cleanCandidateCount"], 1)
        self.assertEqual(row["answerNamedCount"], 1)
        self.assertEqual(row["samples"][0]["sourceId"], "src_clean_math")


if __name__ == "__main__":
    unittest.main()
