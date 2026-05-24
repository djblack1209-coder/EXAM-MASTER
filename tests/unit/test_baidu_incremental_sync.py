from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu import incremental_sync  # noqa: E402
from scripts.baidu.incremental_sync import download_candidates, merge_sources, select_download_candidates  # noqa: E402


class BaiduIncrementalSyncDownloadTest(unittest.TestCase):
    def test_reexecs_with_python_that_has_baidu_dependencies(self):
        calls = []

        class ReexecCalled(Exception):
            pass

        def fake_execv(executable, args):
            calls.append((executable, args))
            raise ReexecCalled()

        def fake_python_deps_available(path):
            return str(path) == "/usr/bin/python3"

        with self.assertRaises(ReexecCalled):
            incremental_sync.ensure_baidu_runtime(
                ["--dry-run"],
                current_executable="/opt/homebrew/bin/python3",
                modules_available=lambda _name: False,
                python_deps_available=fake_python_deps_available,
                execv=fake_execv,
            )

        self.assertEqual(calls[0][0], "/usr/bin/python3")
        self.assertEqual(calls[0][1][0], "/usr/bin/python3")
        self.assertIn("--dry-run", calls[0][1])

    def test_download_candidates_include_full_netdisk_paths(self):
        manifest = {
            "items": [
                {
                    "sourceId": "src_app",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "app_dir",
                    "fsId": 1,
                    "remotePath": "/apps/考研大师/raw-pdf/2018英语一.pdf",
                    "fileName": "2018英语一.pdf",
                    "size": 200_000,
                    "priority": 80,
                },
                {
                    "sourceId": "src_netdisk",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "netdisk_full_path",
                    "fsId": 2,
                    "remotePath": "/EXAM-MASTER/考研历年真题/2019英语一.pdf",
                    "fileName": "2019英语一.pdf",
                    "size": 210_000,
                    "priority": 90,
                },
                {
                    "sourceId": "src_group",
                    "eligible": True,
                    "status": "discovered",
                    "sourceChannel": "group_service",
                    "fsId": 3,
                    "remotePath": "/apps/考研大师/raw-pdf/2020英语一.pdf",
                    "fileName": "2020英语一.pdf",
                    "size": 220_000,
                    "priority": 100,
                },
            ]
        }

        candidates = select_download_candidates(manifest)

        self.assertEqual([item["sourceId"] for item in candidates], ["src_netdisk", "src_app"])

    def test_group_file_index_handoff_preserves_source_channel(self):
        with tempfile.TemporaryDirectory() as tmp:
            group_export = Path(tmp) / "group-file-source-export.json"
            manifest_path = Path(tmp) / "source-manifest.json"
            group_export.write_text(
                """
{
  "version": 1,
  "source": "group_file_index",
  "items": [
    {
      "path": "/2027考研课程/公共课/2020数学一真题.pdf",
      "server_filename": "2020数学一真题.pdf",
      "size": 220000,
      "source": "group_file_index",
      "source_label": "必定上岸27考研159",
      "subject": "math",
      "track": "math1",
      "year": 2020,
      "sourceType": "official_paper",
      "status": "discovered"
    }
  ]
}
""",
                encoding="utf-8",
            )

            manifest, report = merge_sources(
                app_files=[],
                group_export_path=group_export,
                manifest_path=manifest_path,
            )

        self.assertIn("group_file_index", report["summaries"])
        self.assertEqual(report["inputs"]["groupFiles"], 1)
        self.assertEqual(manifest["items"][0]["sourceChannel"], "group_file_index")
        self.assertEqual(manifest["items"][0]["track"], "math1")

    def test_downloader_enables_full_path_client_when_needed(self):
        created_clients = []

        class FakeBaiduPan:
            def __init__(self, access_token=None, *, allow_full_path=False):
                self.allow_full_path = allow_full_path
                self.downloads = []
                created_clients.append(self)

            def download(self, remote_path, target_path, overwrite=False):
                self.downloads.append((remote_path, target_path, overwrite))
                Path(target_path).write_bytes(b"x" * 10)

        candidates = [
            {
                "sourceId": "src_netdisk",
                "fileName": "2019英语一.pdf",
                "remotePath": "/EXAM-MASTER/考研历年真题/2019英语一.pdf",
                "size": 10,
            }
        ]

        with tempfile.TemporaryDirectory() as tmp, patch(
            "scripts.baidu.incremental_sync.BaiduPan",
            FakeBaiduPan,
        ):
            result = download_candidates(candidates, Path(tmp), dry_run=False)

        self.assertEqual(result["downloaded"], 1)
        self.assertEqual(result["failed"], [])
        self.assertEqual(len(created_clients), 1)
        self.assertTrue(created_clients[0].allow_full_path)


if __name__ == "__main__":
    unittest.main()
