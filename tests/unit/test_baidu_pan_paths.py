from pathlib import Path
import sys
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.baidu.pan import BaiduPan, normalize_path  # noqa: E402


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.calls = 0

    def get(self, *args, **kwargs):
        self.calls += 1
        return FakeResponse(self.payloads.pop(0))


class BaiduPanPathTest(unittest.TestCase):
    def test_relative_paths_stay_under_app_root(self):
        self.assertEqual(normalize_path("raw-pdf"), "/apps/考研大师/raw-pdf")

    def test_absolute_paths_stay_under_app_root_by_default(self):
        self.assertEqual(normalize_path("/EXAM-MASTER"), "/apps/考研大师/EXAM-MASTER")

    def test_absolute_paths_can_be_explicitly_scanned_outside_app_root(self):
        self.assertEqual(normalize_path("/EXAM-MASTER", allow_full_path=True), "/EXAM-MASTER")

    def test_get_retries_baidu_frequency_limit(self):
        pan = BaiduPan(access_token="token")
        pan.session = FakeSession(
            [
                {"errno": -6, "errmsg": "hit frequency limit"},
                {"errno": 0, "list": [{"server_filename": "ok.pdf"}]},
            ]
        )

        data = pan._get("https://example.invalid", {"method": "list"}, sleep_fn=lambda _seconds: None)

        self.assertEqual(data["list"][0]["server_filename"], "ok.pdf")
        self.assertEqual(pan.session.calls, 2)


if __name__ == "__main__":
    unittest.main()
