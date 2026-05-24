import json
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = PROJECT_ROOT / "scripts" / "baidu" / "professional_index.py"
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.professional_index import infer_course_code  # noqa: E402


def test_professional_index_course_code_ignores_years():
    assert infer_course_code("护理综合答案中南大学2009.doc") == ""
    assert infer_course_code("北京大学光华管理学院431金融学历年考研真题汇编.pdf") == "431"


def test_professional_index_builds_compact_index(tmp_path):
    manifest = tmp_path / "professional-source-manifest.json"
    output = tmp_path / "professional-source-index.json"
    mini_output = tmp_path / "mini.json"
    manifest.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "sourceId": "src_ok",
                        "remotePath": "/EXAM-MASTER/考研历年真题/全国专业课真题/1、全国专业课真题（第1部分）/北京大学光华管理学院431金融学历年考研真题汇编.pdf",
                        "safeDisplayName": "北京大学光华管理学院431金融学历年考研真题汇编.pdf",
                        "extension": ".pdf",
                        "sourceType": "official_paper",
                        "status": "discovered",
                        "eligible": True,
                        "riskFlags": [],
                    },
                    {
                        "sourceId": "src_risk",
                        "remotePath": "/EXAM-MASTER/考研历年真题/全国专业课真题/广告.pdf",
                        "safeDisplayName": "广告.pdf",
                        "sourceType": "official_paper",
                        "status": "discovered",
                        "eligible": True,
                        "riskFlags": ["ad_or_promo"],
                    },
                    {
                        "sourceId": "src_track",
                        "remotePath": "/EXAM-MASTER/考研历年真题/全国专业课真题/英语资料.pdf",
                        "safeDisplayName": "英语资料.pdf",
                        "extension": ".pdf",
                        "sourceType": "official_paper",
                        "status": "discovered",
                        "eligible": True,
                        "riskFlags": [],
                        "track": "english",
                    },
                    {
                        "sourceId": "src_institution",
                        "remotePath": "/EXAM-MASTER/考研专业课/新东方431金融强化讲义.pdf",
                        "safeDisplayName": "新东方431金融强化讲义.pdf",
                        "extension": ".pdf",
                        "sourceType": "institution_candidate",
                        "status": "discovered",
                        "eligible": True,
                        "riskFlags": ["institution_candidate", "copyright_review_required"],
                        "legalReview": {"copyrightReviewRequired": True, "publishBlocked": True},
                    },
                    {
                        "sourceId": "src_dup",
                        "remotePath": "/EXAM-MASTER/考研历年真题/全国专业课真题/1、全国专业课真题（第1部分）/北京大学光华管理学院431金融学历年考研真题汇编.pdf",
                        "safeDisplayName": "北京大学光华管理学院431金融学历年考研真题汇编.pdf",
                        "extension": ".pdf",
                        "sourceType": "official_paper",
                        "status": "discovered",
                        "eligible": True,
                        "riskFlags": [],
                    },
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--manifest",
            str(manifest),
            "--output",
            str(output),
            "--mini-output",
            str(mini_output),
            "--mini-limit",
            "1",
        ],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    payload = json.loads(mini_output.read_text(encoding="utf-8"))
    assert payload["summary"]["publicationMode"] == "index_only"
    assert payload["summary"]["eligibleIndexSources"] == 4
    assert payload["summary"]["institutionCandidateSources"] == 1
    assert payload["summary"]["reviewRequiredSources"] == 1
    assert payload["summary"]["duplicateGroupCount"] == 1
    assert payload["summary"]["embeddedItems"] == 1
    assert payload["items"][0]["school"] == "北京大学"
    assert payload["items"][0]["courseCode"] == "431"
    assert payload["items"][0]["direction"] in {"金融", "经济金融", "管理学", "其他专业"}
    assert payload["items"][0]["priorityTier"] == "T0"
    assert payload["items"][0]["duplicateGroupSize"] == 2
    assert payload["items"][0]["duplicateRank"] == 1
    assert {direction["name"] for direction in payload["directions"]} >= {"公共英语"}

    full_payload = json.loads(output.read_text(encoding="utf-8"))
    institution_item = next(item for item in full_payload["items"] if item["sourceId"] == "src_institution")
    assert institution_item["sourceInstitution"] == "新东方"
    assert institution_item["priorityTier"] == "T2"
    assert institution_item["cleaningStatus"] == "review_required"
    assert "版权复核" in institution_item["riskLabels"]
