from pathlib import Path
import sys
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.source_manifest import merge_manifest, normalize_record  # noqa: E402


class SourceManifestYearTest(unittest.TestCase):
    def test_file_name_year_wins_over_parent_directory_year_range(self):
        item = normalize_record(
            {
                "fs_id": 1,
                "path": "/EXAM-MASTER/考研历年真题/02.考研英语/【真题】1999-2024/英语一考研历年真题/2004年考研英语真题.pdf",
                "server_filename": "2004年考研英语真题.pdf",
                "size": 200_000,
                "server_mtime": 1,
            },
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now="2026-04-30T00:00:00Z",
        )

        self.assertEqual(item["year"], 2004)

    def test_file_name_year_wins_over_course_package_year(self):
        item = normalize_record(
            {
                "fs_id": 2,
                "path": "/EXAM-MASTER/考研历年真题/02.考研英语/2026 黄皮书PDF/2001年真题解析及复习思路.pdf",
                "server_filename": "2001年真题解析及复习思路.pdf",
                "size": 200_000,
                "server_mtime": 1,
            },
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now="2026-04-30T00:00:00Z",
        )

        self.assertEqual(item["year"], 2001)

    def test_1980s_math_file_name_year_wins_over_parent_directory_year_range(self):
        item = normalize_record(
            {
                "fs_id": 9,
                "path": "/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/考研数学真题【真题及解析】（1987-2023）/【完整版】数学一真题答案解析/1987数一真题、标准答案及解析 .pdf",
                "server_filename": "1987数一真题、标准答案及解析 .pdf",
                "size": 200_000,
                "server_mtime": 1,
            },
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now="2026-04-30T00:00:00Z",
        )

        self.assertEqual(item["subject"], "math")
        self.assertEqual(item["track"], "math1")
        self.assertEqual(item["year"], 1987)

    def test_file_name_year_refreshes_stale_manifest_year(self):
        item = normalize_record(
            {
                "fs_id": 10,
                "remotePath": "/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/考研数学真题【真题及解析】（1987-2023）/【完整版】数学一真题答案解析/1988数一真题、标准答案及解析 .pdf",
                "fileName": "1988数一真题、标准答案及解析 .pdf",
                "size": 200_000,
                "mtime": 1,
                "track": "math1",
                "year": 2023,
                "sourceType": "official_paper",
                "status": "discovered",
            },
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now="2026-04-30T00:00:00Z",
        )

        self.assertEqual(item["year"], 1988)

    def test_english_page_range_does_not_match_politics_exam_code(self):
        item = normalize_record(
            {
                "fs_id": 3,
                "path": "/EXAM-MASTER/考研历年真题/02.考研英语/02.考研英语【电子讲义】/2026 田静PDF/25句句真言和每日一句PDF/25年每日一句/25年田静《每日一句》101-120.pdf",
                "server_filename": "25年田静《每日一句》101-120.pdf",
                "size": 200_000,
                "server_mtime": 1,
            },
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now="2026-04-30T00:00:00Z",
        )

        self.assertEqual(item["subject"], "english")
        self.assertEqual(item["track"], "unknown")

    def test_branded_course_material_under_history_parent_is_not_official_paper(self):
        item = normalize_record(
            {
                "fs_id": 4,
                "path": "/EXAM-MASTER/考研历年真题/02.考研英语/02.考研英语【电子讲义】/2026 田静PDF/25句句真言和每日一句PDF/25年每日一句/25年田静《每日一句》101-120.pdf",
                "server_filename": "25年田静《每日一句》101-120.pdf",
                "size": 200_000,
                "server_mtime": 1,
            },
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now="2026-04-30T00:00:00Z",
        )

        self.assertEqual(item["sourceType"], "institution_candidate")
        self.assertIn("copyright_review_required", item["riskFlags"])

    def test_parenthesized_math_track_names_are_recognized(self):
        item = normalize_record(
            {
                "fs_id": 5,
                "path": "/EXAM-MASTER/考研历年真题/03.考研数学/【真题】2010/2010年全国硕士研究生招生考试数学（一）试题.pdf",
                "server_filename": "2010年全国硕士研究生招生考试数学（一）试题.pdf",
                "size": 200_000,
                "server_mtime": 1,
            },
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now="2026-04-30T00:00:00Z",
        )

        self.assertEqual(item["subject"], "math")
        self.assertEqual(item["track"], "math1")

    def test_manifest_merge_refreshes_derived_fields_for_unchanged_files(self):
        now = "2026-04-30T00:00:00Z"
        raw = {
            "fs_id": 6,
            "path": "/EXAM-MASTER/考研历年真题/01.考研政治/01.考研政治【历年真题】/【解析】1994-2024/1995年政治考研真题(理科)及参考答案.pdf",
            "server_filename": "1995年政治考研真题(理科)及参考答案.pdf",
            "size": 200_000,
            "server_mtime": 1,
        }
        corrected = normalize_record(
            raw,
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now=now,
        )
        stale = dict(corrected)
        stale["year"] = 1994
        stale["track"] = "unknown"

        merged, summary = merge_manifest({"version": 1, "items": [stale]}, [corrected], now)
        item = merged["items"][0]

        self.assertEqual(summary["unchanged"], 1)
        self.assertEqual(item["year"], 1995)
        self.assertEqual(item["track"], "politics")

    def test_manifest_merge_revives_missing_file_when_seen_again(self):
        old_now = "2026-04-29T00:00:00Z"
        now = "2026-04-30T00:00:00Z"
        raw = {
            "fs_id": 7,
            "path": "/EXAM-MASTER/考研历年真题/06.计算408/01.考研计算408【历年真题】/2024计算机408真题+解析/2024年408计算机专业基础综合真题+答案.pdf",
            "server_filename": "2024年408计算机专业基础综合真题+答案.pdf",
            "size": 200_000,
            "server_mtime": 1,
        }
        rediscovered = normalize_record(
            raw,
            provider="baidu_pan",
            source_channel="netdisk_full_path",
            now=now,
        )
        stale = dict(rediscovered)
        stale["status"] = "missing"
        stale["missingSince"] = old_now

        merged, summary = merge_manifest({"version": 1, "items": [stale]}, [rediscovered], now)
        item = merged["items"][0]

        self.assertEqual(summary["unchanged"], 1)
        self.assertEqual(summary["missing"], 0)
        self.assertEqual(item["status"], "discovered")
        self.assertNotIn("missingSince", item)

    def test_manifest_blocks_human_verification_drafts_even_when_status_requests_verified(self):
        item = normalize_record(
            {
                "fs_id": 8,
                "path": "/verified-sources/2025-english1-paper.pdf",
                "server_filename": "2025-english1-paper.pdf",
                "size": 250_000,
                "server_mtime": 1,
                "sha256": "sha256:paper",
                "sourceUrl": "",
                "subject": "english",
                "track": "english1",
                "year": 2025,
                "sourceType": "official_paper",
                "status": "verified",
                "answerEvidenceStatus": "matched",
                "sourceRole": "paper",
                "verifiedBy": "",
                "evidenceNote": "DRAFT: human must verify this source before registration.",
                "draftStatus": "requires_human_verification",
                "humanFieldStatus": "requires_human_input",
                "missingHumanFields": ["sourceUrl", "verifiedBy", "evidenceNote"],
            },
            provider="baidu_pan",
            source_channel="verified_registry",
            now="2026-05-24T00:00:00Z",
        )

        self.assertEqual(item["status"], "discovered")
        self.assertTrue(item["eligible"])
        self.assertIn("human_verification_required", item["riskFlags"])
        self.assertTrue(item["legalReview"]["publishBlocked"])
        self.assertEqual(item["missingHumanFields"], ["evidenceNote", "sourceUrl", "verifiedBy"])
        self.assertEqual(item["draftStatus"], "requires_human_verification")
        self.assertEqual(item["humanFieldStatus"], "requires_human_input")


if __name__ == "__main__":
    unittest.main()
