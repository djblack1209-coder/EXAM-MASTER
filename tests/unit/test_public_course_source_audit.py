import unittest
from pathlib import Path

from scripts.cleaning import audit_public_course_2025 as source_audit


class PublicCourseSourceAuditTest(unittest.TestCase):
    def test_detects_missing_politics_answer_markers(self):
        text = "\n".join(
            [
                "1. 【答案】A",
                "2. 【答案】B",
                "3. 【答案】C",
                "*4.［答案】AB",
                "6.【答案要点】主观题答案",
            ]
        )

        blockers = source_audit.politics_answer_marker_blockers(text, expected_numbers=range(1, 7))

        self.assertEqual(blockers, ["missing_answer_markers:5"])

    def test_display_path_allows_external_temp_outputs(self):
        self.assertEqual(source_audit.display_path(Path("/tmp/source-audit.json")), "/tmp/source-audit.json")


if __name__ == "__main__":
    unittest.main()
