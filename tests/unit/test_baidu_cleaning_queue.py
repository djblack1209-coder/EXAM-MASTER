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


if __name__ == "__main__":
    unittest.main()
