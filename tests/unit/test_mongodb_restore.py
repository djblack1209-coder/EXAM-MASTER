"""Restore-script format, validation and exit-status regression tests.

MongoDB commands are isolated stubs. Archive fixtures test dispatch and safe
extraction, not BSON validity or a real production/database recovery.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "deploy/scripts/restore-mongodb.sh"
STUB = r"""import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
with open(os.environ['RESTORE_CALL_LOG'], 'a') as stream:
    stream.write(json.dumps({'tool': name, 'args': sys.argv[1:], 'cwd': os.getcwd()}) + '\n')
mode = os.environ.get('RESTORE_TEST_MODE', '')
if name == 'mongorestore':
    raise SystemExit(7 if mode == 'restore-failure' else 0)
if name == 'mongosh':
    expression = sys.argv[-1]
    if 'ping' in expression:
        raise SystemExit(0)
    if mode == 'post-failure':
        raise SystemExit(8)
    print('not-a-count' if mode == 'invalid-count' else '12')
elif name == 'df':
    print('Filesystem 1G-blocks Used Available Use% Mounted\nfixture 40G 5G 35G 12% /')
else:
    raise SystemExit(99)
"""


class MongoRestoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.backups = self.root / "backups"
        self.full = self.backups / "full"
        self.full.mkdir(parents=True)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.calls = self.root / "calls.jsonl"
        for name in ("mongorestore", "mongosh", "df", "tar"):
            path = self.bin / name
            path.write_text(f"#!{sys.executable}\n" + STUB)
            path.chmod(0o755)
        self.env = dict(os.environ)
        for key in (
            "MONGODB_URI",
            "BACKUP_DIR",
            "RESTORE_TEST_MODE",
            "RESTORE_CALL_LOG",
            "BASH_ENV",
            "ENV",
        ):
            self.env.pop(key, None)
        self.env.update(
            {
                "PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
                "BACKUP_DIR": str(self.backups),
                "MONGODB_URI": "mongodb://fixture.invalid/exam-master",
                "RESTORE_CALL_LOG": str(self.calls),
            }
        )

    def checksum(self, path: Path, filename: str | None = None):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        Path(str(path) + ".sha256").write_text(f"{digest}  {filename or path.name}\n")

    def archive(self):
        path = self.full / "test.archive"
        path.write_bytes(b"isolated native-archive dispatch fixture")
        self.checksum(path)
        return path

    def legacy(self, members=None):
        path = self.full / "legacy.tar.gz"
        with tarfile.open(path, "w:gz") as archive:
            for name, kind in members or [("dump/exam-master/questions.bson.gz", "file")]:
                member = tarfile.TarInfo(name)
                if kind == "symlink":
                    member.type = tarfile.SYMTYPE
                    member.linkname = "../../outside"
                    archive.addfile(member)
                else:
                    content = b"isolated BSON dispatch fixture"
                    member.size = len(content)
                    archive.addfile(member, io.BytesIO(content))
        self.checksum(path)
        return path

    def execute(self, *args, mode="", uri=True):
        env = {**self.env, "RESTORE_TEST_MODE": mode}
        if not uri:
            env.pop("MONGODB_URI", None)
        result = subprocess.run(
            ["bash", str(SCRIPT), *map(str, args)],
            input="y\n",
            text=True,
            capture_output=True,
            cwd=self.root,
            env=env,
            timeout=10,
        )
        calls = (
            [json.loads(line) for line in self.calls.read_text().splitlines()]
            if self.calls.exists()
            else []
        )
        return result, calls

    def assert_no_restore(self, calls):
        self.assertFalse(any(call["tool"] == "mongorestore" for call in calls))

    def test_native_archive_uses_matching_mongorestore_options(self):
        path = self.archive()
        result, calls = self.execute("full", path.name)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        restore = next(call for call in calls if call["tool"] == "mongorestore")
        for option in (f"--archive={path}", "--gzip", "--drop", "--stopOnError"):
            self.assertIn(option, restore["args"])
        self.assertFalse(any(call["tool"] == "tar" for call in calls))
        self.assertEqual(restore["cwd"], str(self.root))

    def test_historical_single_root_dump_is_supported(self):
        path = self.legacy()
        result, calls = self.execute("full", path.name)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        restore = next(call for call in calls if call["tool"] == "mongorestore")
        self.assertTrue(restore["args"][-1].endswith("/dump"))
        self.assertFalse(Path(restore["args"][-1]).exists(), "temporary extraction must be removed")

    def test_list_reports_both_formats_without_database_or_log_writes(self):
        native = self.archive()
        legacy = self.legacy()
        (self.bin / "mongorestore").unlink()
        result, calls = self.execute("list", uri=False)
        self.assertEqual(result.returncode, 0)
        self.assertIn(native.name, result.stdout)
        self.assertIn(legacy.name, result.stdout)
        self.assertEqual(calls, [])
        self.assertFalse((self.backups / "logs").exists())

    def test_help_does_not_create_backup_directory(self):
        self.env["BACKUP_DIR"] = str(self.root / "absent")
        result, calls = self.execute("--help", uri=False)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(calls, [])
        self.assertFalse((self.root / "absent").exists())

    def test_missing_checksum_blocks_restore(self):
        path = self.archive()
        Path(str(path) + ".sha256").unlink()
        result, calls = self.execute("full", path.name)
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_restore(calls)

    def test_corrupt_archive_blocks_restore(self):
        path = self.archive()
        path.write_bytes(b"changed")
        result, calls = self.execute("full", path.name)
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_restore(calls)

    def test_checksum_for_another_file_is_rejected(self):
        path = self.archive()
        self.checksum(path, "other.archive")
        result, calls = self.execute("full", path.name)
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_restore(calls)

    def test_relative_backup_path_does_not_change_working_directory(self):
        path = self.archive()
        result, calls = self.execute("full", path.relative_to(self.root))
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertTrue(all(call["cwd"] == str(self.root) for call in calls))

    def test_symlink_backup_is_rejected(self):
        path = self.archive()
        link = self.full / "link.archive"
        link.symlink_to(path)
        self.checksum(link)
        result, calls = self.execute("full", link.name)
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_restore(calls)

    def test_legacy_unsafe_members_are_rejected_before_restore(self):
        cases = [
            [("../outside.bson", "file")],
            [("/absolute/questions.bson", "file")],
            [("dump/link", "symlink"), ("dump/questions.bson", "file")],
            [("dump/questions.bson", "file"), ("dump/questions.bson", "file")],
            [("one/questions.bson", "file"), ("two/questions.bson", "file")],
            [("dump/README", "file")],
        ]
        for members in cases:
            with self.subTest(members=members):
                path = self.legacy(members)
                result, calls = self.execute("full", path.name)
                self.assertNotEqual(result.returncode, 0)
                self.assert_no_restore(calls)

    def test_restore_command_failure_is_propagated(self):
        path = self.archive()
        result, _ = self.execute("full", path.name, mode="restore-failure")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("全量恢复完成", result.stdout)

    def test_post_restore_query_failure_is_propagated(self):
        path = self.archive()
        result, _ = self.execute("full", path.name, mode="post-failure")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("恢复后验证完成", result.stdout)

    def test_nonnumeric_post_restore_count_is_rejected(self):
        path = self.archive()
        result, _ = self.execute("full", path.name, mode="invalid-count")
        self.assertNotEqual(result.returncode, 0)

    def test_restore_requires_explicit_database_uri(self):
        path = self.archive()
        result, calls = self.execute("full", path.name, uri=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
