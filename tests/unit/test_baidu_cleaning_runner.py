from pathlib import Path
import sys
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.run_cleaning_queue import load_env_files, run_queue_once, select_pending_tasks  # noqa: E402
import scripts.baidu.run_cleaning_queue as runner  # noqa: E402


class BaiduCleaningRunnerTest(unittest.TestCase):
    def test_load_env_files_parses_quoted_values_without_shell_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_file = Path(tmp) / ".env"
            env_file.write_text(
                "\n".join(
                    [
                        "LLM_BASE_URL=https://example.test/v1",
                        "GROQ_API_KEY='test-key-with-#-inside'",
                        "BAD LINE THAT SHELL WOULD REJECT",
                        "COMMENTED=value # inline comment",
                    ]
                ),
                encoding="utf-8",
            )

            loaded = load_env_files([env_file], override=True)

        self.assertEqual(loaded["LLM_BASE_URL"], "https://example.test/v1")
        self.assertEqual(loaded["GROQ_API_KEY"], "test-key-with-#-inside")
        self.assertEqual(loaded["COMMENTED"], "value")

    def test_select_pending_tasks_only_runs_auto_download_tasks(self):
        queue = {
            "tasks": [
                {"taskId": "t_review", "action": "manual_review", "status": "pending", "priority": 100},
                {"taskId": "t_done", "action": "download_and_extract", "status": "completed", "priority": 100},
                {"taskId": "t_auto", "action": "download_and_extract", "status": "pending", "priority": 90},
            ]
        }

        selected = select_pending_tasks(queue, limit=10)

        self.assertEqual([task["taskId"] for task in selected], ["t_auto"])

    def test_select_pending_tasks_can_target_task_id_or_source_id(self):
        queue = {
            "tasks": [
                {
                    "taskId": "t_high",
                    "sourceId": "src_high",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                },
                {
                    "taskId": "t_answer",
                    "sourceId": "src_answer",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 20,
                },
            ]
        }

        by_task = select_pending_tasks(queue, limit=1, task_id="t_answer")
        by_source = select_pending_tasks(queue, limit=1, source_id="src_answer")

        self.assertEqual([task["taskId"] for task in by_task], ["t_answer"])
        self.assertEqual([task["taskId"] for task in by_source], ["t_answer"])

    def test_reexecs_with_baidu_virtualenv_when_requests_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            tmp_root = Path(tmp)
            venv_python = tmp_root / ".venv-baidu" / "bin" / "python"
            venv_python.parent.mkdir(parents=True)
            venv_python.write_text("#!/bin/sh\n", encoding="utf-8")
            calls = []

            class ReexecCalled(Exception):
                pass

            def fake_execv(executable, args):
                calls.append((executable, args))
                raise ReexecCalled()

            try:
                runner.PROJECT_ROOT = tmp_root
                with self.assertRaises(ReexecCalled):
                    runner.ensure_baidu_runtime(
                        ["--limit", "1"],
                        current_executable="/usr/bin/python3",
                        module_available=lambda _name: False,
                        execv=fake_execv,
                    )
            finally:
                runner.PROJECT_ROOT = original_project_root

        self.assertEqual(calls[0][0], str(venv_python))
        self.assertEqual(calls[0][1][0], str(venv_python))
        self.assertIn("--limit", calls[0][1])

    def test_reexecs_when_current_python_resolves_to_same_base_binary(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            tmp_root = Path(tmp)
            base_python = tmp_root / "base" / "python3.14"
            base_python.parent.mkdir(parents=True)
            base_python.write_text("#!/bin/sh\n", encoding="utf-8")
            venv_python = tmp_root / ".venv-baidu" / "bin" / "python"
            venv_python.parent.mkdir(parents=True)
            venv_python.symlink_to(base_python)
            calls = []

            class ReexecCalled(Exception):
                pass

            def fake_execv(executable, args):
                calls.append((executable, args))
                raise ReexecCalled()

            try:
                runner.PROJECT_ROOT = tmp_root
                with self.assertRaises(ReexecCalled):
                    runner.ensure_baidu_runtime(
                        ["--limit", "1"],
                        current_executable=str(base_python),
                        module_available=lambda _name: False,
                        execv=fake_execv,
                    )
            finally:
                runner.PROJECT_ROOT = original_project_root

        self.assertEqual(calls[0][0], str(venv_python))

    def test_run_queue_once_downloads_and_marks_completed(self):
        with tempfile.TemporaryDirectory() as tmp:
            local_pdf = Path(tmp) / "raw" / "src_1-2018英语一.pdf"
            downloads = []
            processed = []

            class FakeDownloader:
                def download(self, remote_path, target_path, overwrite=False):
                    downloads.append((remote_path, target_path, overwrite))
                    Path(target_path).parent.mkdir(parents=True, exist_ok=True)
                    Path(target_path).write_bytes(b"%PDF-1.4")

            def fake_processor(task, local_path):
                processed.append((task["taskId"], str(local_path)))
                return {
                    "outputPath": "data/flashcards/english-2018.json",
                    "questionCount": 3,
                    "answerEvidenceStatus": "manual_review",
                }

            queue = {
                "tasks": [
                    {
                        "taskId": "t_auto",
                        "sourceId": "src_1",
                        "fingerprint": "fp1",
                        "action": "download_and_extract",
                        "status": "pending",
                        "attempts": 0,
                        "priority": 100,
                        "remotePath": "/EXAM-MASTER/考研历年真题/2018英语一.pdf",
                        "expectedLocalPath": str(local_pdf),
                        "subject": "english",
                        "track": "english1",
                        "year": 2018,
                    }
                ]
            }

            updated, report = run_queue_once(
                queue,
                limit=1,
                now="2026-04-30T00:00:00Z",
                downloader=FakeDownloader(),
                processor=fake_processor,
            )

        task = updated["tasks"][0]
        self.assertEqual(task["status"], "completed")
        self.assertEqual(task["attempts"], 1)
        self.assertEqual(task["completedAt"], "2026-04-30T00:00:00Z")
        self.assertEqual(task["questionCount"], 3)
        self.assertEqual(task["answerEvidenceStatus"], "manual_review")
        self.assertEqual(downloads[0][0], "/EXAM-MASTER/考研历年真题/2018英语一.pdf")
        self.assertEqual(processed[0], ("t_auto", str(local_pdf)))
        self.assertEqual(report["completed"], 1)
        self.assertEqual(report["failed"], 0)

    def test_run_queue_once_marks_zero_question_output_failed(self):
        with tempfile.TemporaryDirectory() as tmp:
            local_pdf = Path(tmp) / "raw" / "src_1-2018英语一.pdf"

            class FakeDownloader:
                def download(self, remote_path, target_path, overwrite=False):
                    Path(target_path).parent.mkdir(parents=True, exist_ok=True)
                    Path(target_path).write_bytes(b"%PDF-1.4")

            def zero_question_processor(task, local_path):
                return {
                    "outputPath": "data/flashcards/english-2018.json",
                    "questionCount": 0,
                    "answerEvidenceStatus": "manual_review",
                }

            queue = {
                "tasks": [
                    {
                        "taskId": "t_zero",
                        "action": "download_and_extract",
                        "status": "pending",
                        "attempts": 0,
                        "priority": 100,
                        "remotePath": "/EXAM-MASTER/考研历年真题/2018英语一.pdf",
                        "expectedLocalPath": str(local_pdf),
                        "subject": "english",
                        "track": "english1",
                        "year": 2018,
                    }
                ]
            }

            updated, report = run_queue_once(
                queue,
                limit=1,
                now="2026-04-30T00:00:00Z",
                downloader=FakeDownloader(),
                processor=zero_question_processor,
            )

        task = updated["tasks"][0]
        self.assertEqual(task["status"], "failed")
        self.assertIn("0 questions", task["lastError"])
        self.assertEqual(report["completed"], 0)
        self.assertEqual(report["failed"], 1)

    def test_run_queue_once_records_missing_answer_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            local_pdf = Path(tmp) / "raw" / "src_1-2018英语一.pdf"

            class FakeDownloader:
                def download(self, remote_path, target_path, overwrite=False):
                    Path(target_path).parent.mkdir(parents=True, exist_ok=True)
                    Path(target_path).write_bytes(b"%PDF-1.4")

            def missing_answer_processor(task, local_path):
                return {
                    "outputPath": "data/flashcards/english-2018.json",
                    "questionCount": 3,
                    "missingAnswerCount": 2,
                    "answerEvidenceStatus": "manual_review",
                }

            queue = {
                "tasks": [
                    {
                        "taskId": "t_missing_answers",
                        "action": "download_and_extract",
                        "status": "pending",
                        "attempts": 0,
                        "priority": 100,
                        "remotePath": "/EXAM-MASTER/考研历年真题/2018英语一.pdf",
                        "expectedLocalPath": str(local_pdf),
                        "subject": "english",
                        "track": "english1",
                        "year": 2018,
                    }
                ]
            }

            updated, report = run_queue_once(
                queue,
                limit=1,
                now="2026-04-30T00:00:00Z",
                downloader=FakeDownloader(),
                processor=missing_answer_processor,
            )

        task = updated["tasks"][0]
        self.assertEqual(task["status"], "completed")
        self.assertEqual(task["missingAnswerCount"], 2)
        self.assertEqual(task["answerEvidenceStatus"], "missing_answers")
        self.assertEqual(report["completed"], 1)

    def test_default_processor_uses_track_specific_output_to_avoid_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            (output_dir / "english1-2001.json").write_text(
                '{"total_cards":1,"cards":[{"id":"english1-2001-001","answer":"A"}]}',
                encoding="utf-8",
            )
            calls = []

            def fake_run(args, cwd, check):
                calls.append((args, cwd, check))

            try:
                runner.PROJECT_ROOT = tmp_root
                runner.PDF2FLASHCARD = tmp_root / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
                runner.subprocess.run = fake_run

                result = runner.default_processor(
                    {"subject": "english", "track": "english1", "year": 2001},
                    tmp_root / "raw" / "2001.pdf",
                )
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(calls[0][0][-2:], ["english1", "2001"])
        self.assertTrue(result["outputPath"].endswith("data/flashcards/english1-2001.json"))

    def test_default_processor_counts_known_answer_placeholders_as_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            (output_dir / "english1-2010.json").write_text(
                '{"total_cards":1,"cards":[{"id":"english1-2010-041","answer":"完整的参考答案全文"}]}',
                encoding="utf-8",
            )

            def fake_run(args, cwd, check):
                return None

            try:
                runner.PROJECT_ROOT = tmp_root
                runner.PDF2FLASHCARD = tmp_root / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
                runner.subprocess.run = fake_run

                result = runner.default_processor(
                    {"subject": "english", "track": "english1", "year": 2010},
                    tmp_root / "raw" / "2010.pdf",
                )
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(result["missingAnswerCount"], 1)
        self.assertEqual(result["answerEvidenceStatus"], "missing_answers")

    def test_default_processor_isolates_unknown_track_outputs_by_source_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            (output_dir / "english-support-abcdef12-2001.json").write_text(
                '{"total_cards":1,"cards":[{"id":"support-001","answer":"A"}]}',
                encoding="utf-8",
            )
            calls = []

            def fake_run(args, cwd, check):
                calls.append((args, cwd, check))

            try:
                runner.PROJECT_ROOT = tmp_root
                runner.PDF2FLASHCARD = tmp_root / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
                runner.subprocess.run = fake_run

                result = runner.default_processor(
                    {
                        "subject": "english",
                        "track": "unknown",
                        "sourceId": "src_1234567890abcdef12",
                        "year": 2001,
                    },
                    tmp_root / "raw" / "2001-answer.pdf",
                )
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(calls[0][0][-2:], ["english-support-abcdef12", "2001"])
        self.assertTrue(result["outputPath"].endswith("data/flashcards/english-support-abcdef12-2001.json"))
        self.assertEqual(result["questionCount"], 1)

    def test_default_processor_isolates_answer_analysis_outputs_even_when_track_known(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            (output_dir / "english-support-abcdef12-2010.json").write_text(
                '{"total_cards":1,"cards":[{"id":"support-001","answer":"A"}]}',
                encoding="utf-8",
            )
            calls = []

            def fake_run(args, cwd, check):
                calls.append((args, cwd, check))

            try:
                runner.PROJECT_ROOT = tmp_root
                runner.PDF2FLASHCARD = tmp_root / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
                runner.subprocess.run = fake_run

                result = runner.default_processor(
                    {
                        "subject": "english",
                        "track": "english1",
                        "sourceId": "src_1234567890abcdef12",
                        "year": 2010,
                        "safeDisplayName": "2010年真题逐题细解.pdf",
                    },
                    tmp_root / "raw" / "2010-answer.pdf",
                )
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(calls[0][0][-2:], ["english-support-abcdef12", "2010"])
        self.assertTrue(result["outputPath"].endswith("data/flashcards/english-support-abcdef12-2010.json"))

    def test_default_processor_falls_back_to_subject_when_track_unknown(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            (output_dir / "english-2001.json").write_text(
                '{"total_cards":1,"cards":[{"id":"english-2001-001","answer":"A"}]}',
                encoding="utf-8",
            )
            calls = []

            def fake_run(args, cwd, check):
                calls.append((args, cwd, check))

            try:
                runner.PROJECT_ROOT = tmp_root
                runner.PDF2FLASHCARD = tmp_root / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
                runner.subprocess.run = fake_run

                result = runner.default_processor(
                    {"subject": "english", "track": "unknown", "year": 2001},
                    tmp_root / "raw" / "2001-answer.pdf",
                )
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(calls[0][0][-2:], ["english", "2001"])
        self.assertTrue(result["outputPath"].endswith("data/flashcards/english-2001.json"))


if __name__ == "__main__":
    unittest.main()
