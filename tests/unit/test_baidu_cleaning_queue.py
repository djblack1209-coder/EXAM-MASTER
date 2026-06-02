from pathlib import Path
import sys
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.cleaning_queue import build_cleaning_queue  # noqa: E402


class BaiduCleaningQueueTest(unittest.TestCase):
    def test_queue_preserves_completed_task_until_source_fingerprint_changes(self):
        manifest = {
            "items": [
                {
                    "sourceId": "src_pdf",
                    "fingerprint": "fp_v1",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 1001,
                    "remotePath": "/EXAM-MASTER/考研历年真题/2018英语一.pdf",
                    "fileName": "2018英语一.pdf",
                    "safeDisplayName": "2018英语一.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "english1",
                    "subject": "english",
                    "year": 2018,
                    "priority": 100,
                    "riskFlags": [],
                    "size": 200_000,
                    "contentHash": "md5:v1",
                }
            ]
        }
        first = build_cleaning_queue(manifest, now="2026-04-30T00:00:00Z")
        completed_task = dict(first["tasks"][0], status="completed", attempts=1, completedAt="2026-04-30T01:00:00Z")
        second = build_cleaning_queue(
            manifest,
            previous_queue={"tasks": [completed_task]},
            now="2026-04-30T02:00:00Z",
        )

        self.assertEqual(second["tasks"][0]["status"], "completed")
        self.assertEqual(second["tasks"][0]["attempts"], 1)

        changed_manifest = {"items": [dict(manifest["items"][0], fingerprint="fp_v2", size=210_000, contentHash="md5:v2")]}
        changed = build_cleaning_queue(
            changed_manifest,
            previous_queue=second,
            now="2026-04-30T03:00:00Z",
        )

        task = changed["tasks"][0]
        self.assertEqual(task["status"], "pending")
        self.assertEqual(task["statusReason"], "source_changed")
        self.assertEqual(task["attempts"], 0)

    def test_queue_routes_review_and_group_sources_to_separate_actions(self):
        manifest = {
            "items": [
                {
                    "sourceId": "src_brand",
                    "fingerprint": "fp_brand",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 2001,
                    "remotePath": "/EXAM-MASTER/课程/名师讲义.pdf",
                    "fileName": "名师讲义.pdf",
                    "extension": ".pdf",
                    "sourceType": "institution_candidate",
                    "track": "politics",
                    "subject": "politics",
                    "year": 2026,
                    "priority": 70,
                    "riskFlags": ["copyright_review_required"],
                },
                {
                    "sourceId": "src_group",
                    "fingerprint": "fp_group",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "group_service",
                    "remotePath": "/群资料/2020数学一真题.pdf",
                    "fileName": "2020数学一真题.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "math1",
                    "subject": "math",
                    "year": 2020,
                    "priority": 100,
                    "riskFlags": [],
                },
                {
                    "sourceId": "src_group_file_index",
                    "fingerprint": "fp_group_file_index",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "group_file_index",
                    "remotePath": "/2027考研课程/公共课/2021数学二真题.pdf",
                    "fileName": "2021数学二真题.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "math2",
                    "subject": "math",
                    "year": 2021,
                    "examCycle": 2027,
                    "collectionRoot": "2027考研",
                    "courseCategory": "public_course",
                    "institutionName": "某机构A",
                    "institutionKey": "某机构A",
                    "targetDirectory": "/apps/考研大师/raw-pdf/2027考研/public-course/某机构A/math2/2021",
                    "approvalRequired": True,
                    "priority": 100,
                    "riskFlags": [],
                },
            ]
        }

        queue = build_cleaning_queue(manifest, now="2026-04-30T00:00:00Z")
        actions = {task["sourceId"]: task["action"] for task in queue["tasks"]}

        self.assertEqual(actions["src_brand"], "manual_review")
        self.assertEqual(actions["src_group"], "transfer_or_direct_download")
        self.assertEqual(actions["src_group_file_index"], "transfer_or_direct_download")
        self.assertEqual(queue["summary"]["manualReviewTasks"], 1)
        self.assertEqual(queue["summary"]["transferTasks"], 2)
        group_file_task = next(task for task in queue["tasks"] if task["sourceId"] == "src_group_file_index")
        self.assertEqual(group_file_task["examCycle"], 2027)
        self.assertEqual(group_file_task["courseCategory"], "public_course")
        self.assertEqual(group_file_task["institutionKey"], "某机构A")
        self.assertTrue(group_file_task["approvalRequired"])
        self.assertEqual(
            group_file_task["targetDirectory"],
            "/apps/考研大师/raw-pdf/2027考研/public-course/某机构A/math2/2021",
        )

    def test_queue_summary_splits_actionable_and_blocked_pending_tasks(self):
        manifest = {
            "items": [
                {
                    "sourceId": "src_auto",
                    "fingerprint": "fp_auto",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 3001,
                    "remotePath": "/EXAM-MASTER/考研历年真题/2018英语一.pdf",
                    "fileName": "2018英语一.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "english1",
                    "subject": "english",
                    "year": 2018,
                    "priority": 100,
                    "riskFlags": [],
                },
                {
                    "sourceId": "src_manual",
                    "fingerprint": "fp_manual",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 3002,
                    "remotePath": "/EXAM-MASTER/机构讲义.pdf",
                    "fileName": "机构讲义.pdf",
                    "extension": ".pdf",
                    "sourceType": "institution_candidate",
                    "track": "politics",
                    "subject": "politics",
                    "year": 2026,
                    "priority": 80,
                    "riskFlags": ["copyright_review_required"],
                },
                {
                    "sourceId": "src_transfer",
                    "fingerprint": "fp_transfer",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "group_file_index",
                    "remotePath": "/群文件/2027考研/公共课/某机构A/2021数学二真题.pdf",
                    "fileName": "2021数学二真题.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "math2",
                    "subject": "math",
                    "year": 2021,
                    "priority": 100,
                    "riskFlags": [],
                },
            ]
        }

        queue = build_cleaning_queue(manifest, now="2026-04-30T00:00:00Z")

        self.assertEqual(queue["summary"]["automationActionablePendingTasks"], 1)
        self.assertEqual(queue["summary"]["manualBlockedPendingTasks"], 1)
        self.assertEqual(queue["summary"]["transferBlockedPendingTasks"], 1)

    def test_queue_prioritizes_release_backlog_slots_before_generic_sources(self):
        manifest = {
            "items": [
                {
                    "sourceId": "src_generic_english",
                    "fingerprint": "fp_generic_english",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 4001,
                    "remotePath": "/EXAM-MASTER/考研历年真题/2000英语一.pdf",
                    "fileName": "2000英语一.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "english1",
                    "subject": "english",
                    "year": 2000,
                    "priority": 100,
                    "riskFlags": [],
                },
                {
                    "sourceId": "src_release_politics",
                    "fingerprint": "fp_release_politics",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 4002,
                    "remotePath": "/EXAM-MASTER/考研历年真题/2023政治.pdf",
                    "fileName": "2023政治.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "politics",
                    "subject": "politics",
                    "year": 2023,
                    "priority": 100,
                    "riskFlags": [],
                },
            ]
        }
        release_backlog = {
            "nextBalancedPublicCourseSlots": [
                {
                    "slotKey": "politics:2023",
                    "track": "politics",
                    "year": 2023,
                    "blockerCode": "missing_public_course_bank",
                    "sourceEvidenceStatus": "publishable_source_present",
                }
            ]
        }

        queue = build_cleaning_queue(
            manifest,
            release_backlog=release_backlog,
            now="2026-04-30T00:00:00Z",
        )

        self.assertEqual(queue["tasks"][0]["sourceId"], "src_release_politics")
        self.assertEqual(queue["tasks"][0]["releaseBacklogSlot"], "politics:2023")
        self.assertEqual(queue["tasks"][0]["releaseBacklogRank"], 0)
        self.assertEqual(queue["tasks"][0]["releaseBlockerCode"], "missing_public_course_bank")
        self.assertEqual(queue["summary"]["releaseBacklogTasks"], 1)
        self.assertEqual(queue["summary"]["releaseBacklogAutomationActionablePendingTasks"], 1)

    def test_known_mislabeled_math2_2016_source_is_manual_review(self):
        manifest = {
            "items": [
                {
                    "sourceId": "src_97fdbcbd12d0815374fbe91f",
                    "fingerprint": "fp_mislabeled_math2",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 769678800788424,
                    "remotePath": "/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/考研数学真题【真题及解析】（1987-2023）/【完整版】数学二真题答案解析/2016考研数学二真题 .pdf",
                    "fileName": "2016考研数学二真题 .pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "math2",
                    "subject": "math",
                    "year": 2016,
                    "priority": 100,
                    "riskFlags": [],
                    "contentHash": "5347d192as7e7e3d20fdf8d7db3fdd68",
                }
            ]
        }
        release_backlog = {
            "nextBalancedPublicCourseSlots": [
                {
                    "slotKey": "math2:2016",
                    "track": "math2",
                    "year": 2016,
                    "blockerCode": "missing_public_course_bank",
                    "sourceEvidenceStatus": "publishable_source_present",
                }
            ]
        }

        queue = build_cleaning_queue(
            manifest,
            release_backlog=release_backlog,
            now="2026-06-02T00:00:00Z",
        )

        task = queue["tasks"][0]
        self.assertEqual(task["action"], "manual_review")
        self.assertEqual(task["statusReason"], "legal_or_quality_review_required")
        self.assertIn("source_content_mismatch", task["riskFlags"])
        self.assertEqual(task["releaseBacklogSlot"], "math2:2016")
        self.assertEqual(queue["summary"]["releaseBacklogAutomationActionablePendingTasks"], 0)
        self.assertEqual(queue["summary"]["releaseBacklogManualBlockedPendingTasks"], 1)

    def test_limited_queue_summary_counts_only_returned_tasks(self):
        manifest = {
            "items": [
                {
                    "sourceId": "src_keep",
                    "fingerprint": "fp_keep",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 5001,
                    "remotePath": "/EXAM-MASTER/考研历年真题/2023政治.pdf",
                    "fileName": "2023政治.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "politics",
                    "subject": "politics",
                    "year": 2023,
                    "priority": 100,
                    "riskFlags": [],
                },
                {
                    "sourceId": "src_drop",
                    "fingerprint": "fp_drop",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 5002,
                    "remotePath": "/EXAM-MASTER/考研历年真题/2024政治.pdf",
                    "fileName": "2024政治.pdf",
                    "extension": ".pdf",
                    "sourceType": "official_paper",
                    "track": "politics",
                    "subject": "politics",
                    "year": 2024,
                    "priority": 90,
                    "riskFlags": [],
                },
            ]
        }
        previous_queue = {
            "tasks": [
                {
                    "sourceId": "src_keep",
                    "fingerprint": "fp_keep",
                    "action": "download_and_extract",
                    "status": "pending",
                },
                {
                    "sourceId": "src_drop",
                    "fingerprint": "fp_drop",
                    "action": "download_and_extract",
                    "status": "pending",
                },
            ]
        }

        queue = build_cleaning_queue(
            manifest,
            previous_queue=previous_queue,
            now="2026-04-30T00:00:00Z",
            limit=1,
        )

        self.assertEqual(queue["summary"]["totalTasks"], 1)
        self.assertEqual(queue["summary"]["preservedTasks"], 1)
        self.assertEqual(queue["summary"]["newOrChangedTasks"], 0)


if __name__ == "__main__":
    unittest.main()
