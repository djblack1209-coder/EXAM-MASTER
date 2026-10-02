"""显式独立入口：真实macOS Vision/Poppler/HTTP，合成资料；不联系供应商。"""

import base64
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import zlib

from tests.unit.test_private_material_parser import PARSER, make_pdf

BINARY, FIXTURES = sys.argv[1:3]
sys.argv[1:] = []
os.environ["MATERIAL_APPLE_VISION_BIN"] = BINARY


def invoke(value, timeout=12):
    result = subprocess.run(
        [BINARY, "--recognize"],
        input=json.dumps(value).encode(),
        capture_output=True,
        timeout=timeout,
        env={"PATH": os.environ["PATH"], "TMPDIR": "/tmp"},
    )
    assert result.returncode == 0 and not result.stderr and len(result.stdout) <= 2 * 1024 * 1024
    return json.loads(result.stdout)


def payload(name="printed.png"):
    return {
        "consent": True,
        "languages": ["zh-Hans", "en-US"],
        "contentBase64": base64.b64encode((Path(FIXTURES) / name).read_bytes()).decode(),
    }


class NativeAppleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # 只对此公开合成图允许45秒首次CPU模型初始化；私人解析器始终12秒。
        cls.printed = invoke(payload(), timeout=45)

    def test_real_printed_chinese_english_raw_candidates_and_coordinates(self):
        self.assertTrue(self.printed["success"])
        data = self.printed["data"]
        self.assertIn("十二", data["content"])
        self.assertIn("Calculate", data["content"])
        self.assertEqual(data["compute"], "cpu")
        self.assertEqual(data["coordinateSpace"], "preview_pixels_top_left")
        self.assertFalse(data["languageCorrection"])
        self.assertTrue(data["reviewRequired"])
        self.assertLessEqual(len(base64.b64decode(data["preview"].split(",")[1])), 512 * 1024)
        for word in data["words"]:
            self.assertEqual(word["role"], "unassigned")
            x1, y1, x2, y2 = word["bbox"]
            self.assertTrue(0 <= x1 < x2 <= data["dimensions"]["width"])
            self.assertTrue(0 <= y1 < y2 <= data["dimensions"]["height"])

    def test_blank_image_is_no_text_candidate_not_a_correct_answer(self):
        value = invoke(payload("blank.png"))
        self.assertTrue(value["success"])
        self.assertEqual(value["data"]["content"], "")
        self.assertEqual(value["data"]["words"], [])
        self.assertTrue(value["data"]["reviewRequired"])

    def test_orientation_and_preview_dimensions_share_coordinate_space(self):
        value = invoke(payload("oriented.jpg"))
        self.assertTrue(value["success"])
        self.assertEqual(value["data"]["dimensions"], {"width": 800, "height": 1200})
        self.assertEqual(value["data"]["coordinateSpace"], "preview_pixels_top_left")

    def test_false_or_coerced_consent_rejected_before_image_decode(self):
        for value in [False, 1, "true", None]:
            self.assertEqual(
                invoke({"consent": value, "contentBase64": "invalid"})["code"], "CONSENT_REQUIRED"
            )

    def test_paths_urls_unknown_keys_and_unsupported_languages_rejected(self):
        for key in ["path", "url", "command"]:
            value = payload()
            value[key] = "TEST_ONLY_INVALID"
            self.assertEqual(invoke(value)["code"], "INVALID_REQUEST")
        for languages in [[], ["fake"], ["en-US", "en-US"], "en-US"]:
            value = payload()
            value["languages"] = languages
            self.assertEqual(invoke(value)["code"], "LANGUAGE_UNSUPPORTED")

    def test_noncanonical_base64_wrong_image_and_byte_limit(self):
        for content in ["not-base64!", "dGVzdA==", "dGVzdA==\n"]:
            value = payload()
            value["contentBase64"] = content
            self.assertFalse(invoke(value)["success"])
        value = payload()
        value["contentBase64"] = "A" * (4 * ((PARSER.MAX_BYTES + 2) // 3) + 4)
        self.assertEqual(invoke(value)["code"], "RESOURCE_LIMIT")

    def test_pixel_budget_rejected_before_large_decompression(self):
        def chunk(name, content):
            return (
                struct.pack(">I", len(content))
                + name
                + content
                + struct.pack(">I", zlib.crc32(name + content))
            )

        huge = (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 6000, 6000, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\0"))
            + chunk(b"IEND", b"")
        )
        value = payload()
        value["contentBase64"] = base64.b64encode(huge).decode()
        self.assertEqual(invoke(value)["code"], "PIXEL_LIMIT")

    def test_real_python_image_receipt_private_source_and_uncertainty(self):
        with tempfile.TemporaryDirectory() as root:
            value = PARSER.parse_material(
                {
                    "contentBase64": payload()["contentBase64"],
                    "allowOCR": True,
                    "ocrEngine": "apple-vision",
                },
                root,
            )
            segment = value["segments"][0]
            self.assertEqual(value["recognitionEngine"], "apple-vision")
            self.assertEqual(value["scope"], "private")
            self.assertFalse(value["publishable"])
            self.assertEqual(value["extraCloudCost"], 0)
            self.assertEqual(segment["method"], "apple_vision")
            self.assertEqual(segment["role"], "unassigned")
            self.assertIn("十二", segment["content"])
            self.assertEqual(segment["recognitionStatus"], "text_candidate")
            self.assertTrue(segment["uncertainties"])
            self.assertTrue(Path(root, value["id"], "original.png").exists())

    def test_real_scanned_pdf_five_page_batch_and_original_resume(self):
        with tempfile.TemporaryDirectory() as root:
            value = PARSER.parse_material(
                {
                    "contentBase64": base64.b64encode(
                        Path(FIXTURES, "scanned.pdf").read_bytes()
                    ).decode(),
                    "allowOCR": True,
                    "ocrEngine": "apple-vision",
                },
                root,
            )
            self.assertEqual(value["nextPage"], 6)
            self.assertEqual(len(value["segments"]), 5)
            for segment in value["segments"]:
                self.assertEqual(segment["method"], "apple_vision")
                self.assertTrue(segment["reviewRequired"])
            resumed = PARSER.parse_material(
                {
                    "fileId": value["id"],
                    "startPage": 6,
                    "allowOCR": True,
                    "ocrEngine": "apple-vision",
                },
                root,
            )
            self.assertEqual(resumed["segments"][0]["page"], 6)
            self.assertIsNone(resumed["nextPage"])
            self.assertEqual(resumed["original"], value["original"])

    def test_text_pdf_keeps_real_poppler_without_ocr_even_when_apple_selected(self):
        with (
            tempfile.TemporaryDirectory() as root,
            patch.object(
                PARSER, "parse_apple_image", side_effect=AssertionError("OCR must not run")
            ),
        ):
            value = PARSER.parse_material(
                {
                    "contentBase64": base64.b64encode(make_pdf(1)).decode(),
                    "allowOCR": True,
                    "ocrEngine": "apple-vision",
                },
                root,
            )
            self.assertEqual(value["segments"][0]["method"], "pdf_text")
            self.assertFalse(value["segments"][0]["reviewRequired"])

    def test_real_http_auth_engine_health_ocr_and_idempotent_delete(self):
        with tempfile.TemporaryDirectory() as root:
            token = "TEST_ONLY_Apple_private_material_token_32"
            server = ThreadingHTTPServer(
                ("127.0.0.1", 0), PARSER.make_handler(token, "http://localhost:5173", root)
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()

            def request(path, data, auth=token):
                return urlopen(
                    Request(
                        f"http://127.0.0.1:{server.server_port}" + path,
                        data=json.dumps(data).encode(),
                        headers={
                            "Authorization": "Bearer " + auth,
                            "Origin": "http://localhost:5173",
                        },
                    ),
                    timeout=15,
                )

            try:
                with self.assertRaises(HTTPError) as error:
                    request("/parse", {}, "TEST_ONLY_WRONG")
                self.assertEqual(error.exception.code, 403)
                self.assertEqual(list(Path(root).iterdir()), [])
                with request("/health", {}) as r:
                    health = json.load(r)
                self.assertTrue(health["data"]["ocrEngines"]["appleVision"]["available"])
                self.assertEqual(
                    health["data"]["ocrEngines"]["appleVision"]["recognitionState"], "not_tested"
                )
                with request(
                    "/parse",
                    {
                        "contentBase64": payload()["contentBase64"],
                        "allowOCR": True,
                        "ocrEngine": "apple-vision",
                    },
                ) as r:
                    value = json.load(r)["data"]
                self.assertEqual(value["segments"][0]["method"], "apple_vision")
                for absent in [False, True]:
                    with request("/delete", {"fileId": value["id"]}) as r:
                        receipt = json.load(r)["data"]
                    self.assertEqual(receipt["alreadyAbsent"], absent)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
