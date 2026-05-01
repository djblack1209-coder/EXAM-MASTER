from pathlib import Path
import sys
import tempfile
import unittest
import json


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.group_sync import (  # noqa: E402
    build_group_export_records,
    extract_surl,
    filter_share_files,
    flatten_share_tree,
    sync_sharelinks,
    transfer_files,
    validate_registry,
)


class BaiduGroupSyncShareLinkTest(unittest.TestCase):
    def test_filter_share_files_keeps_documents_and_rejects_noise(self):
        files = [
            {"fs_id": 1, "server_filename": "2018英语一真题.pdf", "size": 220_000},
            {"fs_id": 2, "server_filename": "扫码加群.pdf", "size": 220_000},
            {"fs_id": 3, "server_filename": "课程视频.mp4", "size": 5_000_000},
            {"fs_id": 4, "server_filename": "空白答案.pdf", "size": 12_000},
            {"fs_id": 5, "server_filename": "数学讲义", "isdir": 1, "size": 0},
        ]

        selected = filter_share_files(files, {"min_size_kb": 50})

        self.assertEqual([item["fs_id"] for item in selected], [1])

    def test_extract_surl_supports_share_redirect_url(self):
        self.assertEqual(extract_surl("https://pan.baidu.com/s/1AbCdEf"), "AbCdEf")
        self.assertEqual(extract_surl("https://pan.baidu.com/share/init?surl=AbCdEf"), "AbCdEf")

    def test_validate_registry_reports_duplicates_and_inbox_fallbacks(self):
        registry = {
            "version": 1,
            "links": [
                {
                    "id": "lnk_dup",
                    "url": "https://pan.baidu.com/s/1first",
                    "pwd": "1111",
                    "subject": "english",
                    "year": 2024,
                },
                {
                    "id": "lnk_dup",
                    "url": "https://pan.baidu.com/s/1second",
                    "pwd": "2222",
                },
            ],
        }

        result = validate_registry(registry)

        self.assertEqual(result["errors"], ["duplicate link id: lnk_dup"])
        self.assertEqual(result["warnings"], ["link lnk_dup has no subject/year; files will transfer to inbox"])

    def test_transfer_files_retries_rate_limited_batch(self):
        class FakeResponse:
            def __init__(self, payload):
                self.payload = payload

            def raise_for_status(self):
                return None

            def json(self):
                return self.payload

        class FakeSession:
            def __init__(self):
                self.calls = 0

            def post(self, *args, **kwargs):
                self.calls += 1
                if self.calls == 1:
                    return FakeResponse({"errno": 12, "errmsg": "rate limited"})
                return FakeResponse({"errno": 0})

        fake_session = FakeSession()
        slept = []

        result = transfer_files(
            {"shareid": "share-1", "uk": "uk-1", "sekey": "sek"},
            [1001],
            "/apps/考研大师/raw-pdf/english/2024",
            access_token="token",
            session=fake_session,
            sleep_fn=lambda seconds: slept.append(seconds),
            max_retries=1,
            retry_delay=3,
        )

        self.assertEqual(result, {"success": [1001], "failed": []})
        self.assertEqual(fake_session.calls, 2)
        self.assertEqual(slept, [3])

    def test_flatten_share_tree_recursively_expands_shared_folders(self):
        root_files = [
            {"fs_id": 10, "server_filename": "英语", "path": "/英语", "isdir": 1},
            {"fs_id": 11, "server_filename": "根目录说明.pdf", "path": "/根目录说明.pdf", "size": 80_000},
        ]
        children = {
            "/英语": [
                {"fs_id": 12, "server_filename": "2018英语一真题.pdf", "path": "/英语/2018英语一真题.pdf", "size": 220_000},
                {"fs_id": 13, "server_filename": "答案", "path": "/英语/答案", "isdir": 1},
            ],
            "/英语/答案": [
                {"fs_id": 14, "server_filename": "2018英语一答案.pdf", "path": "/英语/答案/2018英语一答案.pdf", "size": 120_000},
            ],
        }

        flattened = flatten_share_tree(root_files, lambda path: children.get(path, []))

        self.assertEqual([item["fs_id"] for item in flattened], [11, 12, 14])

    def test_build_group_export_records_preserves_manifest_fields(self):
        link = {
            "id": "lnk_20260429_001",
            "label": "英语一历年真题",
            "subject": "english",
            "track": "english1",
            "year": 2018,
        }
        files = [
            {
                "fs_id": 1001,
                "server_filename": "2018英语一真题.pdf",
                "size": 220_000,
                "server_mtime": 1710000000,
                "md5": "abc123",
            }
        ]

        records = build_group_export_records(files, link, "/apps/考研大师/raw-pdf/english/2018")

        self.assertEqual(
            records,
            [
                {
                    "path": "/apps/考研大师/raw-pdf/english/2018/2018英语一真题.pdf",
                    "server_filename": "2018英语一真题.pdf",
                    "fs_id": 1001,
                    "size": 220_000,
                    "server_mtime": 1710000000,
                    "md5": "abc123",
                    "source": "sharelink",
                    "source_label": "英语一历年真题",
                    "link_id": "lnk_20260429_001",
                    "subject": "english",
                    "track": "english1",
                    "year": 2018,
                }
            ],
        )

    def test_sync_sharelinks_dry_run_plans_without_writing_state_or_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            registry_path = tmp_path / "link-registry.json"
            state_path = tmp_path / "transferred-links.json"
            export_path = tmp_path / "group-export-latest.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "links": [
                            {
                                "id": "lnk_eng_2018",
                                "url": "https://pan.baidu.com/s/1example",
                                "pwd": "abcd",
                                "label": "英语一历年真题",
                                "subject": "english",
                                "track": "english1",
                                "year": 2018,
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            def fake_resolver(url, pwd):
                return {
                    "shareid": "share-1",
                    "uk": "uk-1",
                    "sekey": "sek",
                    "files": [
                        {"fs_id": 1001, "server_filename": "2018英语一真题.pdf", "size": 220_000},
                        {"fs_id": 1002, "server_filename": "扫码加群.pdf", "size": 220_000},
                    ],
                }

            def failing_transfer(*args, **kwargs):
                raise AssertionError("dry-run must not transfer files")

            def failing_incremental(*args, **kwargs):
                raise AssertionError("dry-run must not run incremental sync")

            planned = sync_sharelinks(
                registry_path=registry_path,
                state_path=state_path,
                export_path=export_path,
                dest_dir="/apps/考研大师/raw-pdf",
                dry_run=True,
                resolver=fake_resolver,
                transfer=failing_transfer,
                run_incremental=failing_incremental,
            )

            self.assertEqual(len(planned), 1)
            self.assertFalse(state_path.exists())
            self.assertFalse(export_path.exists())

    def test_sync_sharelinks_writes_state_export_and_runs_incremental_sync(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            registry_path = tmp_path / "link-registry.json"
            state_path = tmp_path / "transferred-links.json"
            export_path = tmp_path / "group-export-latest.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "links": [
                            {
                                "id": "lnk_math_2025",
                                "url": "https://pan.baidu.com/s/1example",
                                "pwd": "abcd",
                                "label": "数学一强化资料",
                                "subject": "math",
                                "track": "math1",
                                "year": 2025,
                                "filter": {"extensions": [".pdf"], "min_size_kb": 50},
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            transferred_batches = []
            incremental_exports = []

            def fake_resolver(url, pwd):
                return {
                    "shareid": "share-1",
                    "uk": "uk-1",
                    "sekey": "sek",
                    "files": [
                        {
                            "fs_id": 2001,
                            "server_filename": "2025数学一强化讲义.pdf",
                            "size": 330_000,
                            "server_mtime": 1710000001,
                        }
                    ],
                }

            def fake_transfer(share_info, file_ids, dest_path):
                transferred_batches.append((share_info["shareid"], file_ids, dest_path))
                return {"success": file_ids, "failed": []}

            def fake_incremental(path):
                incremental_exports.append(Path(path))

            records = sync_sharelinks(
                registry_path=registry_path,
                state_path=state_path,
                export_path=export_path,
                dest_dir="/apps/考研大师/raw-pdf",
                resolver=fake_resolver,
                transfer=fake_transfer,
                run_incremental=fake_incremental,
            )

            self.assertEqual(len(records), 1)
            self.assertEqual(
                transferred_batches,
                [("share-1", [2001], "/apps/考研大师/raw-pdf/math/2025")],
            )
            state = json.loads(state_path.read_text(encoding="utf-8"))
            self.assertEqual(state["done"]["lnk_math_2025"]["fs_ids"], ["2001"])
            export = json.loads(export_path.read_text(encoding="utf-8"))
            self.assertEqual(export["files"][0]["path"], "/apps/考研大师/raw-pdf/math/2025/2025数学一强化讲义.pdf")
            self.assertEqual(export["files"][0]["link_id"], "lnk_math_2025")
            self.assertEqual(incremental_exports, [export_path])

    def test_sync_sharelinks_writes_report_and_continues_after_link_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            registry_path = tmp_path / "link-registry.json"
            state_path = tmp_path / "transferred-links.json"
            export_path = tmp_path / "group-export-latest.json"
            report_path = tmp_path / "group-sync-report.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "links": [
                            {
                                "id": "lnk_broken",
                                "url": "https://pan.baidu.com/s/1broken",
                                "pwd": "bad0",
                                "label": "失效链接",
                                "subject": "english",
                                "track": "english1",
                                "year": 2024,
                            },
                            {
                                "id": "lnk_ok",
                                "url": "https://pan.baidu.com/s/1ok",
                                "pwd": "ok00",
                                "label": "政治真题",
                                "subject": "politics",
                                "track": "politics",
                                "year": 2024,
                            },
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            def fake_resolver(url, pwd):
                if "broken" in url:
                    raise ValueError("share password verification failed")
                return {
                    "shareid": "share-ok",
                    "uk": "uk-ok",
                    "sekey": "sek",
                    "files": [
                        {
                            "fs_id": 3001,
                            "server_filename": "2024政治真题.pdf",
                            "size": 440_000,
                        }
                    ],
                }

            def fake_transfer(share_info, file_ids, dest_path):
                return {"success": file_ids, "failed": []}

            records = sync_sharelinks(
                registry_path=registry_path,
                state_path=state_path,
                export_path=export_path,
                report_path=report_path,
                dest_dir="/apps/考研大师/raw-pdf",
                resolver=fake_resolver,
                transfer=fake_transfer,
                run_incremental=lambda path: None,
            )

            self.assertEqual([record["link_id"] for record in records], ["lnk_ok"])
            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(report["summary"]["errors"], 1)
            self.assertEqual(report["summary"]["transferred"], 1)
            self.assertEqual(
                [(row["id"], row["status"]) for row in report["links"]],
                [("lnk_broken", "failed"), ("lnk_ok", "transferred")],
            )
            self.assertIn("share password verification failed", report["links"][0]["error"])


if __name__ == "__main__":
    unittest.main()
