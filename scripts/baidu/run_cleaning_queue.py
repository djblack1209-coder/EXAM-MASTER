#!/usr/bin/env python3
"""
Run a small batch from data/cleaning-queue.json.

This runner intentionally processes only explicit pending
download_and_extract tasks. Scheduled scans should generate the queue; a
separate operator/worker should run this file with a small --limit and a
configured free or low-cost OpenAI-compatible LLM endpoint.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BAIDU_DIR = PROJECT_ROOT / "scripts" / "baidu"
sys.path.insert(0, str(BAIDU_DIR))

from pan import BaiduPan  # noqa: E402


DEFAULT_QUEUE = PROJECT_ROOT / "data" / "cleaning-queue.json"
PDF2FLASHCARD = PROJECT_ROOT / "scripts" / "pipeline" / "pdf2flashcard-v2.py"
DEFAULT_ENV_FILES = [PROJECT_ROOT / ".env", PROJECT_ROOT / "laf-backend" / ".env"]
LLM_PROVIDER_KEY_ENVS = [
    "LLM_API_KEY",
    "OPENAI_API_KEY",
    "IFLOW_API_KEY",
    "NVIDIA_API_KEY",
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "OPENROUTER_API_KEY",
    "CEREBRAS_API_KEY",
    "MISTRAL_API_KEY",
    "GITHUB_MODELS_TOKEN",
    "HF_TOKEN",
    "HUGGINGFACE_API_KEY",
    "GPT_API_FREE_KEY",
    "VERCEL_AI_GATEWAY_API_KEY",
    "SILICONFLOW_OFFICIAL_API_KEY",
    *[f"SILICONFLOW_DS_KEY_{index}" for index in range(1, 11)],
]
SUPPORT_EVIDENCE_NAME_PATTERNS = (
    "逐题",
    "逐词",
    "细解",
    "精讲",
    "答题卡",
    "answer",
    "analysis",
    "explanation",
)
ANSWER_PLACEHOLDERS = {
    "完整的参考答案全文",
    "完整的答案解析文本",
    "参考答案全文",
    "答案解析文本",
}
PUBLIC_RELEASE_TRACK_ORDER = {
    "politics": 0,
    "english1": 1,
    "english2": 2,
    "math1": 3,
    "math2": 4,
    "math3": 5,
}


def ensure_baidu_runtime(
    argv: list[str],
    *,
    current_executable: str | None = None,
    module_available: Callable[[str], bool] | None = None,
    execv: Callable[[str, list[str]], None] | None = None,
) -> None:
    current_executable = current_executable or sys.executable
    module_available = module_available or (lambda name: importlib.util.find_spec(name) is not None)
    execv = execv or os.execv
    if module_available("requests"):
        return

    venv_python = PROJECT_ROOT / ".venv-baidu" / "bin" / "python"
    if venv_python.exists() and os.path.abspath(current_executable) != os.path.abspath(str(venv_python)):
        execv(str(venv_python), [str(venv_python), str(Path(__file__).resolve()), *argv])
        return

    raise SystemExit(
        "requests is required for Baidu Pan API calls. Install Baidu cleaning dependencies with "
        "`python3 -m venv .venv-baidu && .venv-baidu/bin/pip install -r requirements-baidu.txt` "
        "or run this script with `.venv-baidu/bin/python`."
    )


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path, default: Any | None = None) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def strip_inline_comment(value: str) -> str:
    quote = ""
    for index, char in enumerate(value):
        previous = value[index - 1] if index > 0 else " "
        if char in ("'", '"') and previous != "\\":
            quote = "" if quote == char else quote or char
        if char == "#" and not quote and previous.isspace():
            return value[:index].strip()
    return value.strip()


def normalize_env_value(raw_value: str) -> str:
    value = strip_inline_comment(str(raw_value or "").strip())
    if len(value) >= 2 and value[0] in ("'", '"') and value[-1] == value[0]:
        value = value[1:-1]
    if raw_value.strip().startswith('"'):
        value = value.replace("\\n", "\n").replace("\\r", "\r").replace('\\"', '"')
    return value


def load_env_files(paths: list[Path], *, override: bool = False) -> dict[str, str]:
    loaded: dict[str, str] = {}
    pattern = re.compile(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$")
    for path in paths:
        if not path.exists() or not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            match = pattern.match(line.strip())
            if not match:
                continue
            key, raw_value = match.groups()
            value = normalize_env_value(raw_value)
            loaded[key] = value
            if override or key not in os.environ:
                os.environ[key] = value
    return loaded


def select_pending_tasks(
    queue: dict[str, Any],
    *,
    limit: int,
    task_id: str | None = None,
    source_id: str | None = None,
    track: str | None = None,
    min_year: int | None = None,
    max_year: int | None = None,
    source_type: str | None = None,
    paper_role: str = "all",
) -> list[dict[str, Any]]:
    tasks = [
        task for task in queue.get("tasks", [])
        if isinstance(task, dict)
        and task.get("status") == "pending"
        and task.get("action") == "download_and_extract"
    ]
    if task_id:
        tasks = [task for task in tasks if task.get("taskId") == task_id]
    if source_id:
        tasks = [task for task in tasks if task.get("sourceId") == source_id]
    if track:
        tasks = [task for task in tasks if str(task.get("track") or "") == track]
    if source_type:
        tasks = [task for task in tasks if str(task.get("sourceType") or "") == source_type]
    if min_year is not None:
        tasks = [task for task in tasks if safe_int(task.get("year")) >= min_year]
    if max_year is not None:
        tasks = [task for task in tasks if safe_int(task.get("year")) <= max_year]
    if paper_role == "main":
        tasks = [task for task in tasks if not is_support_evidence_task(task)]
    elif paper_role == "support":
        tasks = [task for task in tasks if is_support_evidence_task(task)]
    tasks.sort(key=cleaning_task_sort_key)
    return tasks[:limit] if limit > 0 else tasks


def is_support_evidence_task(task: dict[str, Any]) -> bool:
    evidence_name = " ".join(
        str(task.get(key) or "")
        for key in ("safeDisplayName", "fileName")
    ).lower()
    track = str(task.get("track") or "")
    if track.startswith("math") and "真题" in evidence_name:
        return False
    if track.startswith("math") and re.search(r"\d{4}\s*数[一二三]\s*标准答案及解析", evidence_name):
        return False
    if any(pattern in evidence_name for pattern in ("答案速查", "参考答案", "标准答案", "答案解析", "真题解析", "解析册")):
        return True
    return any(pattern.lower() in evidence_name for pattern in SUPPORT_EVIDENCE_NAME_PATTERNS)


def cleaning_task_sort_key(task: dict[str, Any]) -> tuple[Any, ...]:
    track = str(task.get("track") or "")
    year = safe_int(task.get("year"))
    release_year = year if 2005 <= year <= 2026 else 9999
    track_order = PUBLIC_RELEASE_TRACK_ORDER.get(track, len(PUBLIC_RELEASE_TRACK_ORDER))
    release_rank = safe_int(task.get("releaseBacklogRank"), 999_999)
    return (
        release_rank,
        -int(task.get("priority") or 0),
        release_year,
        track_order,
        year,
        str(task.get("safeDisplayName") or task.get("fileName") or ""),
    )


def safe_int(value: Any, fallback: int = -1) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def default_downloader(tasks: list[dict[str, Any]]) -> BaiduPan:
    allow_full_path = any(
        task.get("sourceChannel") == "netdisk_full_path"
        or str(task.get("remotePath") or "").startswith("/EXAM-MASTER/")
        for task in tasks
    )
    return BaiduPan(allow_full_path=allow_full_path)


def output_subject_for_task(task: dict[str, Any]) -> str:
    track = str(task.get("track") or "").strip()
    subject = str(task.get("subject") or "").strip()
    source_id = re.sub(r"[^A-Za-z0-9]+", "", str(task.get("sourceId") or ""))
    evidence_name = " ".join(
        str(task.get(key) or "")
        for key in ("safeDisplayName", "fileName", "remotePath")
    ).lower()
    is_support_evidence = any(pattern.lower() in evidence_name for pattern in SUPPORT_EVIDENCE_NAME_PATTERNS)
    if track and track.lower() != "unknown" and not is_support_evidence:
        return track
    if subject and source_id:
        return f"{subject}-support-{source_id[-8:]}"
    return subject or "unknown"


def has_usable_answer(card: dict[str, Any]) -> bool:
    answer = str(card.get("answer") or "").strip()
    return bool(answer) and answer not in ANSWER_PLACEHOLDERS


def default_processor(task: dict[str, Any], local_path: Path) -> dict[str, Any]:
    subject = output_subject_for_task(task)
    year = str(task.get("year") or "unknown")
    subprocess.run(
        [sys.executable, str(PDF2FLASHCARD), str(local_path), subject, year],
        cwd=str(PROJECT_ROOT),
        check=True,
    )

    output_path = PROJECT_ROOT / "data" / "flashcards" / f"{subject}-{year}.json"
    question_count = 0
    missing_answer_count = 0
    if output_path.exists():
        payload = read_json(output_path, {})
        cards = payload.get("cards", [])
        question_count = int(payload.get("total_cards") or len(cards) or 0)
        if isinstance(cards, list):
            missing_answer_count = sum(1 for card in cards if not has_usable_answer(card))

    return {
        "outputPath": str(output_path),
        "questionCount": question_count,
        "missingAnswerCount": missing_answer_count,
        "answerEvidenceStatus": "missing_answers" if missing_answer_count else "manual_review",
    }


def run_queue_once(
    queue: dict[str, Any],
    *,
    limit: int,
    now: str | None = None,
    task_id: str | None = None,
    source_id: str | None = None,
    track: str | None = None,
    min_year: int | None = None,
    max_year: int | None = None,
    source_type: str | None = None,
    paper_role: str = "all",
    downloader: Any | None = None,
    processor: Callable[[dict[str, Any], Path], dict[str, Any]] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    now = now or utc_now()
    updated = deepcopy(queue)
    planned = select_pending_tasks(
        updated,
        limit=limit,
        task_id=task_id,
        source_id=source_id,
        track=track,
        min_year=min_year,
        max_year=max_year,
        source_type=source_type,
        paper_role=paper_role,
    )
    active_downloader = downloader or (default_downloader(planned) if planned else None)
    active_processor = processor or default_processor
    by_task_id = {task.get("taskId"): task for task in updated.get("tasks", [])}

    report = {
        "runAt": now,
        "planned": len(planned),
        "completed": 0,
        "failed": 0,
        "skippedExistingLocal": 0,
        "tasks": [],
    }

    for planned_task in planned:
        task = by_task_id.get(planned_task.get("taskId"))
        if not task:
            continue
        local_path = Path(task["expectedLocalPath"])
        task["attempts"] = int(task.get("attempts") or 0) + 1
        task["updatedAt"] = now
        try:
            if local_path.exists() and local_path.stat().st_size > 0:
                report["skippedExistingLocal"] += 1
            else:
                local_path.parent.mkdir(parents=True, exist_ok=True)
                if active_downloader is None:
                    raise RuntimeError("downloader is not configured")
                active_downloader.download(task["remotePath"], str(local_path), overwrite=False)

            result = active_processor(task, local_path)
            question_count = int(result.get("questionCount") or 0)
            if question_count <= 0:
                raise RuntimeError(f"processor produced 0 questions for {task.get('taskId')}")
            missing_answer_count = int(result.get("missingAnswerCount") or 0)
            answer_evidence_status = result.get("answerEvidenceStatus", "manual_review")
            if missing_answer_count > 0:
                answer_evidence_status = "missing_answers"
            task["status"] = "completed"
            task["completedAt"] = now
            task.pop("lastError", None)
            task.update(
                {
                    "localPath": str(local_path),
                    "outputPath": result.get("outputPath"),
                    "questionCount": question_count,
                    "missingAnswerCount": missing_answer_count,
                    "answerEvidenceStatus": answer_evidence_status,
                }
            )
            report["completed"] += 1
            report["tasks"].append({"taskId": task["taskId"], "status": "completed"})
        except Exception as exc:  # noqa: BLE001 - batch runner records per-task failures.
            task["status"] = "failed"
            task["failedAt"] = now
            task["lastError"] = str(exc)
            report["failed"] += 1
            report["tasks"].append({"taskId": task.get("taskId"), "status": "failed", "error": str(exc)})

    updated["lastRunnerReport"] = report
    return updated, report


def ensure_llm_configured() -> None:
    if any(os.environ.get(key) for key in LLM_PROVIDER_KEY_ENVS):
        return
    raise SystemExit(
        "At least one LLM provider key is required before running cleaning tasks. "
        "Use any free or low-cost OpenAI-compatible endpoint through LLM_BASE_URL/LLM_MODEL "
        "or provider envs such as GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY."
    )


def run_self_test() -> None:
    queue = {
        "tasks": [
            {"taskId": "t1", "action": "manual_review", "status": "pending", "priority": 100},
            {"taskId": "t2", "action": "download_and_extract", "status": "pending", "priority": 90},
        ]
    }
    assert [task["taskId"] for task in select_pending_tasks(queue, limit=10)] == ["t2"]
    print("[cleaning-runner] self-test passed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a small batch from data/cleaning-queue.json.")
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--output", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--task-id", help="Run one explicit pending download_and_extract task.")
    parser.add_argument("--source-id", help="Run pending download_and_extract tasks for one explicit sourceId.")
    parser.add_argument("--track", help="Only run pending tasks for a public course track, e.g. english1.")
    parser.add_argument("--min-year", type=int, help="Only run tasks with year >= this value.")
    parser.add_argument("--max-year", type=int, help="Only run tasks with year <= this value.")
    parser.add_argument("--source-type", help="Only run tasks with this sourceType, e.g. official_paper.")
    parser.add_argument(
        "--paper-role",
        choices=["all", "main", "support"],
        default="all",
        help="Filter official-paper tasks by role inferred from the filename/path.",
    )
    parser.add_argument("--env-file", action="append", type=Path, default=[])
    parser.add_argument("--no-default-env-files", action="store_true")
    parser.add_argument("--override-env", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return

    if not args.dry_run:
        ensure_baidu_runtime(sys.argv[1:])

    env_files = ([] if args.no_default_env_files else DEFAULT_ENV_FILES) + args.env_file
    load_env_files(env_files, override=args.override_env)

    queue = read_json(args.queue, {"tasks": []})
    planned = select_pending_tasks(
        queue,
        limit=args.limit,
        task_id=args.task_id,
        source_id=args.source_id,
        track=args.track,
        min_year=args.min_year,
        max_year=args.max_year,
        source_type=args.source_type,
        paper_role=args.paper_role,
    )
    print(f"[cleaning-runner] planned={len(planned)} limit={args.limit}")
    for task in planned[:20]:
        print(f"[cleaning-runner] plan {task.get('taskId')} {task.get('safeDisplayName') or task.get('fileName')}")
    if args.dry_run:
        print("[cleaning-runner] dry-run, queue not changed")
        return

    ensure_llm_configured()
    updated, report = run_queue_once(
        queue,
        limit=args.limit,
        task_id=args.task_id,
        source_id=args.source_id,
        track=args.track,
        min_year=args.min_year,
        max_year=args.max_year,
        source_type=args.source_type,
        paper_role=args.paper_role,
    )
    write_json(args.output, updated)
    print(
        "[cleaning-runner] "
        + " ".join(f"{key}={value}" for key, value in report.items() if key != "tasks")
    )
    print(f"[cleaning-runner] wrote {args.output}")


if __name__ == "__main__":
    main()
