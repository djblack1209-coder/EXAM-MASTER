import json
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = PROJECT_ROOT / "scripts" / "baidu" / "group_file_index.py"
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.group_file_index import (  # noqa: E402
    DEFAULT_DEST_ROOT,
    build_index,
    build_source_export,
    build_transfer_queue,
    extract_json_items,
    parse_accessibility_text,
)


def test_group_file_index_normalizes_json_records_and_requires_approval_for_documents():
    raw_items = [
        {"fileName": "2027考研课程【此文件夹自动更新-无需保存】", "type": "folder", "sharer": "13800138000"},
        {
            "fileName": "2018年考研英语一真题.pdf",
            "path": "/群文件/英语/2018年考研英语一真题.pdf",
            "size": 220_000,
        },
        {"fileName": "扫码加群.pdf", "path": "/群文件/扫码加群.pdf", "size": 220_000},
        {"fileName": "课程视频.mp4", "path": "/群文件/课程视频.mp4", "size": 5_000_000},
    ]

    index = build_index(
        raw_items,
        group_name="必定上岸27考研159",
        dest_root=DEFAULT_DEST_ROOT,
        now="2026-05-22T00:00:00Z",
    )
    queue = build_transfer_queue(index, dest_root=DEFAULT_DEST_ROOT)

    assert index["mode"] == "read_only_index"
    assert index["summary"]["folderRecords"] == 1
    assert index["summary"]["approvalRequiredTransfers"] == 1
    assert index["summary"]["rejectedRecords"] == 2
    assert index["items"][0]["decision"] == "expand_folder_index"
    assert index["items"][0]["sharerDisplay"] == "1***0"
    assert queue["mode"] == "approval_queue"
    assert queue["items"][0]["track"] == "english1"
    assert queue["items"][0]["year"] == 2018
    assert queue["items"][0]["targetDirectory"] == "/apps/考研大师/raw-pdf/english1/2018"
    assert queue["items"][0]["status"] == "approval_required"


def test_group_file_index_parses_accessibility_text_exports():
    records = parse_accessibility_text(
        """
        群文件
        链接 2025年考研政治真题及答案.pdf
        分享人：李雷
        2026-05-21 22:00
        链接 课程视频.mp4
        分享人：韩梅梅
        """
    )

    assert [record["fileName"] for record in records] == ["2025年考研政治真题及答案.pdf", "课程视频.mp4"]
    assert records[0]["sharer"] == "李雷"
    assert records[0]["shareTime"] == "2026-05-21"


def test_group_file_index_extracts_computer_use_snapshot_text():
    payload = {"app_state": "链接 2024年数学一真题.pdf\n分享人：张三"}

    records = extract_json_items(payload)

    assert records == [{"fileName": "2024年数学一真题.pdf", "sourceLine": "链接 2024年数学一真题.pdf", "sharer": "张三"}]


def test_group_file_index_exports_source_manifest_handoff_shape():
    index = build_index(
        [
            {
                "fileName": "2022年数学三真题解析.pdf",
                "path": "/群文件/数学/2022年数学三真题解析.pdf",
                "size": 320_000,
                "server_mtime": 1710000000,
            },
            {"fileName": "广告二维码.pdf", "path": "/群文件/广告二维码.pdf", "size": 220_000},
        ],
        group_name="必定上岸27考研159",
        dest_root=DEFAULT_DEST_ROOT,
        now="2026-05-22T00:00:00Z",
    )

    export = build_source_export(index)

    assert export["source"] == "group_file_index"
    assert len(export["items"]) == 1
    assert export["items"][0] == {
        "path": "/群文件/数学/2022年数学三真题解析.pdf",
        "server_filename": "2022年数学三真题解析.pdf",
        "size": 320000,
        "server_mtime": 1710000000,
        "source": "group_file_index",
        "source_label": "必定上岸27考研159",
        "subject": "math",
        "track": "math3",
        "year": 2022,
        "sourceType": "official_paper",
        "status": "discovered",
    }


def test_group_file_index_supports_items_json_payload():
    payload = {"items": [{"fileName": "2024政治真题.pdf", "size": 200_000}]}

    assert extract_json_items(json.loads(json.dumps(payload))) == payload["items"]


def test_group_file_index_missing_input_returns_operator_friendly_blocker(tmp_path):
    missing = tmp_path / "missing-export.json"
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--input", str(missing), "--dry-run"],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 2
    assert "[group-file-index] blocked:" in result.stdout
    assert "Group file export not found" in result.stdout
    assert "Traceback" not in result.stderr
