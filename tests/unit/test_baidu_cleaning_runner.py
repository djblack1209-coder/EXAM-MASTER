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

    def test_select_pending_tasks_can_filter_public_course_release_scope(self):
        queue = {
            "tasks": [
                {
                    "taskId": "t_1999",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 1999,
                    "sourceType": "official_paper",
                },
                {
                    "taskId": "t_answer_quick",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005年真题及答案速查.pdf",
                },
                {
                    "taskId": "t_2005",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005年考研英语真题英一二通用.pdf",
                },
                {
                    "taskId": "t_review_source",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2005,
                    "sourceType": "institution_candidate",
                },
                {
                    "taskId": "t_math",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "math1",
                    "year": 2005,
                    "sourceType": "official_paper",
                },
            ]
        }

        selected = select_pending_tasks(
            queue,
            limit=10,
            track="english1",
            min_year=2005,
            max_year=2026,
            source_type="official_paper",
            paper_role="main",
        )

        self.assertEqual([task["taskId"] for task in selected], ["t_2005"])

    def test_select_pending_tasks_balances_release_scope_by_year_and_track(self):
        queue = {
            "tasks": [
                {
                    "taskId": "english1_2006",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2006,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2006年考研英语一真题.pdf",
                },
                {
                    "taskId": "math1_2005",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "math1",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005年数学一真题.pdf",
                },
                {
                    "taskId": "politics_2005",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "politics",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005年政治真题.pdf",
                },
                {
                    "taskId": "english2_2005",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english2",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005年考研英语二真题.pdf",
                },
                {
                    "taskId": "english1_2005",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005年考研英语一真题.pdf",
                },
            ]
        }

        selected = select_pending_tasks(queue, limit=10, source_type="official_paper", paper_role="main")

        self.assertEqual(
            [task["taskId"] for task in selected],
            ["politics_2005", "english1_2005", "english2_2005", "math1_2005", "english1_2006"],
        )

    def test_select_pending_tasks_respects_release_backlog_rank_before_year_balance(self):
        queue = {
            "tasks": [
                {
                    "taskId": "generic_politics_2005",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "politics",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005年政治真题.pdf",
                },
                {
                    "taskId": "release_english1_2018",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2018,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2018年考研英语一真题.pdf",
                    "releaseBacklogSlot": "english1:2018",
                    "releaseBacklogRank": 0,
                    "releaseBlockerCode": "missing_public_course_bank",
                },
            ]
        }

        selected = select_pending_tasks(queue, limit=10, source_type="official_paper", paper_role="main")

        self.assertEqual([task["taskId"] for task in selected], ["release_english1_2018", "generic_politics_2005"])

    def test_paper_role_main_uses_file_name_not_parent_answer_directory(self):
        queue = {
            "tasks": [
                {
                    "taskId": "math2_main",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "math2",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005考研数学二真题.pdf",
                    "fileName": "2005考研数学二真题 .pdf",
                    "remotePath": "/EXAM-MASTER/数学真题答案解析/2005考研数学二真题 .pdf",
                },
                {
                    "taskId": "math2_answer",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "math2",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005数学二答案解析.pdf",
                    "fileName": "2005数学二答案解析.pdf",
                    "remotePath": "/EXAM-MASTER/数学真题答案解析/2005数学二答案解析.pdf",
                },
            ]
        }

        selected = select_pending_tasks(queue, limit=10, source_type="official_paper", paper_role="main")

        self.assertEqual([task["taskId"] for task in selected], ["math2_main"])

    def test_math_official_combined_papers_remain_main_tasks(self):
        queue = {
            "tasks": [
                {
                    "taskId": "math1_combined",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "math1",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005数一标准答案及解析.pdf",
                    "fileName": "2005-数一标准答案及解析 .pdf",
                    "remotePath": "/EXAM-MASTER/数学一真题答案解析/2005-数一标准答案及解析 .pdf",
                },
                {
                    "taskId": "english_answer",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2005,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2005年真题及答案速查.pdf",
                    "fileName": "2005年真题及答案速查.pdf",
                    "remotePath": "/EXAM-MASTER/英语/2005年真题及答案速查.pdf",
                },
            ]
        }

        selected = select_pending_tasks(queue, limit=10, source_type="official_paper", paper_role="main")

        self.assertEqual([task["taskId"] for task in selected], ["math1_combined"])

    def test_english_analysis_papers_are_support_evidence(self):
        queue = {
            "tasks": [
                {
                    "taskId": "english1_main",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2020,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2020年考研英语一真题.pdf",
                },
                {
                    "taskId": "english1_analysis",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2019,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2019考研英语一真题及解析.pdf",
                },
                {
                    "taskId": "english1_answer_analysis",
                    "action": "download_and_extract",
                    "status": "pending",
                    "priority": 100,
                    "track": "english1",
                    "year": 2019,
                    "sourceType": "official_paper",
                    "safeDisplayName": "2019考研英语（一）真题及答案解析.pdf",
                },
            ]
        }

        main_tasks = select_pending_tasks(queue, limit=10, source_type="official_paper", paper_role="main")
        support_tasks = select_pending_tasks(queue, limit=10, source_type="official_paper", paper_role="support")

        self.assertEqual([task["taskId"] for task in main_tasks], ["english1_main"])
        self.assertEqual(
            [task["taskId"] for task in support_tasks],
            ["english1_analysis", "english1_answer_analysis"],
        )

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

    def test_run_queue_once_fails_quality_gate_issues(self):
        with tempfile.TemporaryDirectory() as tmp:
            local_pdf = Path(tmp) / "raw" / "src_1-2023政治.pdf"
            local_pdf.parent.mkdir(parents=True)
            local_pdf.write_bytes(b"%PDF-1.4")

            def quality_gate_processor(task, local_path):
                return {
                    "outputPath": "data/flashcards/politics-2023.json",
                    "questionCount": 34,
                    "missingAnswerCount": 0,
                    "answerEvidenceStatus": "quality_review",
                    "typeCounts": {"single_choice": 32, "multi_choice": 1, "analysis": 1},
                    "qualityIssues": ["politics_question_count_below_expected: expected>=38 actual=34"],
                }

            queue = {
                "tasks": [
                    {
                        "taskId": "t_incomplete_politics",
                        "action": "download_and_extract",
                        "status": "pending",
                        "attempts": 0,
                        "priority": 100,
                        "remotePath": "/EXAM-MASTER/考研历年真题/2023政治.pdf",
                        "expectedLocalPath": str(local_pdf),
                        "subject": "politics",
                        "track": "politics",
                        "year": 2023,
                    }
                ]
            }

            updated, report = run_queue_once(
                queue,
                limit=1,
                now="2026-04-30T00:00:00Z",
                processor=quality_gate_processor,
            )

        task = updated["tasks"][0]
        self.assertEqual(task["status"], "failed")
        self.assertEqual(task["questionCount"], 34)
        self.assertEqual(task["answerEvidenceStatus"], "quality_review")
        self.assertIn("processor quality gate failed", task["lastError"])
        self.assertEqual(report["completed"], 0)
        self.assertEqual(report["failed"], 1)

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

    def test_default_processor_flags_incomplete_politics_distribution(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            cards = (
                [{"id": f"p-s-{index}", "type": "single_choice", "answer": "A"} for index in range(32)]
                + [{"id": "p-m-1", "type": "multi_choice", "answer": "AB"}]
                + [{"id": "p-a-1", "type": "analysis", "answer": "参考答案"}]
            )
            (output_dir / "politics-2023.json").write_text(
                runner.json.dumps({"total_cards": 34, "cards": cards}, ensure_ascii=False),
                encoding="utf-8",
            )

            def fake_run(args, cwd, check):
                return None

            try:
                runner.PROJECT_ROOT = tmp_root
                runner.PDF2FLASHCARD = tmp_root / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
                runner.subprocess.run = fake_run

                result = runner.default_processor(
                    {
                        "subject": "politics",
                        "track": "politics",
                        "year": 2023,
                        "safeDisplayName": "2023考研政治真题.pdf",
                    },
                    tmp_root / "raw" / "2023.pdf",
                )
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(result["questionCount"], 34)
        self.assertEqual(result["answerEvidenceStatus"], "quality_review")
        self.assertIn("politics_question_count_below_expected: expected>=38 actual=34", result["qualityIssues"])
        self.assertIn("politics_analysis_count_below_expected: expected>=5 actual=1", result["qualityIssues"])

    def test_default_processor_flags_incomplete_english1_main_distribution(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            cards = (
                [{"id": f"e-choice-{index}", "type": "single_choice", "answer": "A"} for index in range(45)]
                + [{"id": "e-translation-1", "type": "translation", "answer": "译文"}]
                + [{"id": "e-essay-1", "type": "essay", "answer": "作文要求"}]
            )
            (output_dir / "english1-2018.json").write_text(
                runner.json.dumps({"total_cards": 47, "cards": cards}, ensure_ascii=False),
                encoding="utf-8",
            )

            def fake_run(args, cwd, check):
                return None

            try:
                runner.PROJECT_ROOT = tmp_root
                runner.PDF2FLASHCARD = tmp_root / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
                runner.subprocess.run = fake_run

                result = runner.default_processor(
                    {
                        "subject": "english",
                        "track": "english1",
                        "year": 2018,
                        "safeDisplayName": "2018年考研英语一真题.pdf",
                    },
                    tmp_root / "raw" / "2018.pdf",
                )
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(result["questionCount"], 47)
        self.assertEqual(result["answerEvidenceStatus"], "quality_review")
        self.assertIn("english1_question_count_below_expected: expected>=52 actual=47", result["qualityIssues"])
        self.assertIn("english1_translation_count_below_expected: expected>=5 actual=1", result["qualityIssues"])
        self.assertIn("english1_essay_count_below_expected: expected>=2 actual=1", result["qualityIssues"])

    def test_default_processor_restores_better_existing_output_when_candidate_fails_quality(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            output_path = output_dir / "english1-2018.json"

            def choice_card(index, *, options=4):
                return {
                    "id": f"english1-2018-{index:03d}",
                    "type": "single_choice",
                    "answer": "A",
                    "options": [{"label": label, "text": label} for label in "ABCDEFG"[:options]],
                }

            existing_cards = [choice_card(index) for index in range(1, 45)]
            existing_cards.append(choice_card(45, options=0))
            existing_cards.extend(
                {"id": f"english1-2018-{index:03d}", "type": "translation", "answer": "译文"}
                for index in range(46, 51)
            )
            existing_cards.extend(
                {"id": f"english1-2018-{index:03d}", "type": "essay", "answer": "作文要求"}
                for index in range(51, 53)
            )
            output_path.write_text(
                runner.json.dumps({"total_cards": 52, "cards": existing_cards}, ensure_ascii=False),
                encoding="utf-8",
            )

            candidate_cards = [choice_card(index) for index in range(1, 42)]
            candidate_cards.extend(
                {"id": f"english1-2018-{index:03d}", "type": "translation", "answer": "译文"}
                for index in range(46, 50)
            )
            candidate_cards.extend(
                {"id": f"english1-2018-{index:03d}", "type": "essay", "answer": "作文要求"}
                for index in range(51, 53)
            )

            def fake_run(args, cwd, check):
                output_path.write_text(
                    runner.json.dumps({"total_cards": 47, "cards": candidate_cards}, ensure_ascii=False),
                    encoding="utf-8",
                )

            try:
                runner.PROJECT_ROOT = tmp_root
                runner.PDF2FLASHCARD = tmp_root / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
                runner.subprocess.run = fake_run

                result = runner.default_processor(
                    {
                        "subject": "english",
                        "track": "english1",
                        "year": 2018,
                        "safeDisplayName": "2018年考研英语一真题.pdf",
                    },
                    tmp_root / "raw" / "2018.pdf",
                )
                restored = runner.json.loads(output_path.read_text(encoding="utf-8"))
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(restored["total_cards"], 52)
        self.assertEqual(result["questionCount"], 47)
        self.assertIn("english1_question_count_below_expected: expected>=52 actual=47", result["qualityIssues"])

    def test_english_quality_gate_skips_pre_2005_and_support_evidence(self):
        pre_2005_issues = runner.quality_issues_for_task(
            {"track": "english1", "year": 2001, "safeDisplayName": "2001年考研英语一真题.pdf"},
            question_count=44,
            type_counts={"single_choice": 38, "analysis": 6},
        )
        support_issues = runner.quality_issues_for_task(
            {"track": "english1", "year": 2018, "safeDisplayName": "2018年真题逐题细解.pdf"},
            question_count=1,
            type_counts={"single_choice": 1},
        )

        self.assertEqual(pre_2005_issues, [])
        self.assertEqual(support_issues, [])

    def test_english_quality_gate_flags_incomplete_choice_options(self):
        issues = runner.quality_issues_for_task(
            {"track": "english1", "year": 2018, "safeDisplayName": "2018年考研英语一真题.pdf"},
            question_count=52,
            type_counts={"single_choice": 45, "translation": 5, "essay": 2},
            cards=[
                {
                    "id": "english1-2018-001",
                    "type": "single_choice",
                    "options": [{"label": "A"}, {"label": "B"}, {"label": "C"}, {"label": "D"}],
                },
                {
                    "id": "english1-2018-041",
                    "type": "single_choice",
                    "options": [{"label": label} for label in "ABCDEFG"],
                },
                {
                    "id": "english1-2018-026",
                    "type": "single_choice",
                    "options": [],
                },
            ],
        )

        self.assertEqual(len(issues), 1)
        self.assertIn("english1_choice_option_count_below_minimum", issues[0])
        self.assertIn("english1-2018-026", issues[0])

    def test_choice_option_quality_gate_skips_support_evidence(self):
        issues = runner.quality_issues_for_task(
            {"track": "english1", "year": 2018, "safeDisplayName": "2018年真题及答案速查.pdf"},
            question_count=52,
            type_counts={"single_choice": 45, "translation": 5, "essay": 2},
            cards=[{"id": "support-001", "type": "single_choice", "options": []}],
        )

        self.assertEqual(issues, [])

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

    def test_default_processor_isolates_answer_quick_outputs_even_when_track_known(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_project_root = runner.PROJECT_ROOT
            original_pdf2flashcard = runner.PDF2FLASHCARD
            original_subprocess_run = runner.subprocess.run
            tmp_root = Path(tmp)
            output_dir = tmp_root / "data" / "flashcards"
            output_dir.mkdir(parents=True)
            (output_dir / "english-support-abcdef12-2018.json").write_text(
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
                        "year": 2018,
                        "safeDisplayName": "2018年真题及答案速查.pdf",
                    },
                    tmp_root / "raw" / "2018-answer.pdf",
                )
            finally:
                runner.PROJECT_ROOT = original_project_root
                runner.PDF2FLASHCARD = original_pdf2flashcard
                runner.subprocess.run = original_subprocess_run

        self.assertEqual(calls[0][0][-2:], ["english-support-abcdef12", "2018"])
        self.assertTrue(result["outputPath"].endswith("data/flashcards/english-support-abcdef12-2018.json"))

    def test_output_subject_uses_support_detection_for_answer_quick_files(self):
        subject = runner.output_subject_for_task(
            {
                "subject": "english",
                "track": "english1",
                "sourceId": "src_1234567890abcdef12",
                "safeDisplayName": "2018年真题及答案速查.pdf",
            }
        )

        self.assertEqual(subject, "english-support-abcdef12")

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
