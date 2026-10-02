import base64
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from http.server import ThreadingHTTPServer
import threading
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError

SPEC = importlib.util.spec_from_file_location(
    "private_material_parser",
    Path(__file__).parents[2] / "scripts/pipeline/private-material-parser.py",
)
PARSER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARSER)


def make_pdf(pages=2):
    objects = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{4 + i * 2} 0 R" for i in range(pages))
    objects.append(f"<< /Type /Pages /Count {pages} /Kids [{kids}] >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for index in range(pages):
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << /Font << /F1 3 0 R >> >> /Contents {5 + index * 2} 0 R >>".encode()
        )
        stream = f"BT /F1 16 Tf 30 300 Td (Question {index + 1}: Calculate twelve plus eight.) Tj ET".encode()
        objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream")
    data = b"%PDF-1.4\n"
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f"{number} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(data)
    data += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    data += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    data += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    )
    return data


class PrivateMaterialTests(unittest.TestCase):
    def test_apple_response_budget_keeps_completed_pages_and_resumes_unsent_page(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(PARSER, "apple_capabilities", return_value={"available": True}),
            patch.object(PARSER, "parse_pdf_page") as page,
        ):
            page.side_effect = lambda _path, number, *_args: {
                "id": f"page-{number}",
                "page": number,
                "content": "候选",
                "preview": "A" * 700000,
                "method": "apple_vision",
            }
            value = PARSER.parse_material(
                {
                    "contentBase64": base64.b64encode(make_pdf(6)).decode(),
                    "allowOCR": True,
                    "ocrEngine": "apple-vision",
                },
                directory,
            )
            self.assertEqual([s["page"] for s in value["segments"]], [1, 2])
            self.assertEqual(value["nextPage"], 3)
            self.assertLess(len(json.dumps(value, ensure_ascii=False).encode()), 2000000)
            self.assertEqual(value["status"], "partial")

    def test_expired_apple_deadline_does_not_invoke_recognition(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(PARSER, "apple_capabilities", return_value={"available": True}),
            patch.object(PARSER, "apple_command") as command,
        ):
            path = Path(directory) / "synthetic.png"
            path.write_bytes(b"TEST_ONLY")
            with self.assertRaisesRegex(PARSER.ParserError, "APPLE_VISION_DEADLINE"):
                PARSER.parse_apple_image(path, deadline=PARSER.time.monotonic() - 1)
            command.assert_not_called()

    def test_failed_new_image_rolls_back_only_its_new_copy_without_engine_fallback(self):
        data = b"\x89PNG\r\n\x1a\nTEST_ONLY"
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaisesRegex(PARSER.ParserError, "OCR_CONSENT_REQUIRED"):
                PARSER.parse_material(
                    {"contentBase64": base64.b64encode(data).decode(), "allowOCR": False}, root
                )
            self.assertEqual(list(Path(root).iterdir()), [])
        payload = {
            "ocrEngine": "apple-vision",
            "allowOCR": True,
            "contentBase64": base64.b64encode(data).decode(),
        }
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(PARSER, "apple_capabilities", return_value={"available": True}),
            patch.object(
                PARSER, "parse_apple_image", side_effect=PARSER.ParserError("APPLE_VISION_FAILED")
            ),
            patch.object(PARSER, "parse_image") as fallback,
        ):
            with self.assertRaises(PARSER.ParserError):
                PARSER.parse_material(payload, directory)
            self.assertEqual(list(Path(directory).iterdir()), [])
            fingerprint = PARSER.hashlib.sha256(data).hexdigest()
            old = Path(directory) / fingerprint
            old.mkdir()
            (old / "original.png").write_bytes(data)
            with self.assertRaises(PARSER.ParserError):
                PARSER.parse_material(payload, directory)
            self.assertEqual((old / "original.png").read_bytes(), data)
            fallback.assert_not_called()

    def test_apple_requires_explicit_engine_consent_and_current_capability_before_storage(self):
        with tempfile.TemporaryDirectory() as directory:
            for engine, allowed in [
                ("unknown", True),
                ("apple-vision", False),
                ("apple-vision", 1),
                ("apple-vision", "true"),
            ]:
                with self.assertRaises(PARSER.ParserError):
                    PARSER.parse_material(
                        {"ocrEngine": engine, "allowOCR": allowed, "contentBase64": "invalid"},
                        directory,
                    )
                self.assertEqual(list(Path(directory).iterdir()), [])
            with (
                patch.object(PARSER, "apple_capabilities", return_value={"available": False}),
                patch.object(PARSER, "parse_image") as fallback,
            ):
                with self.assertRaisesRegex(PARSER.ParserError, "APPLE_VISION_UNAVAILABLE"):
                    PARSER.parse_material(
                        {"ocrEngine": "apple-vision", "allowOCR": True, "contentBase64": "invalid"},
                        directory,
                    )
                fallback.assert_not_called()
                self.assertEqual(list(Path(directory).iterdir()), [])

    def test_apple_malformed_receipts_cannot_be_promoted_to_recognized_content(self):
        values = [
            None,
            {},
            {"content": "猜测标准答案", "words": [], "dimensions": {}},
            {"reviewRequired": False},
            {"coordinateSpace": "unknown"},
            {"method": "tesseract"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.png"
            path.write_bytes(b"TEST_ONLY")
            for value in values:
                with (
                    patch.object(PARSER, "apple_capabilities", return_value={"available": True}),
                    patch.object(PARSER, "apple_command", return_value=value),
                ):
                    with self.assertRaises(PARSER.ParserError):
                        PARSER.parse_apple_image(path)

    def test_delete_receipt_is_idempotent_and_storage_failure_is_not_success(self):
        with tempfile.TemporaryDirectory() as directory:
            file_id = "a" * 64
            target = Path(directory) / file_id
            target.mkdir()
            (target / "original.pdf").write_bytes(b"TEST_ONLY")
            with patch.object(PARSER.shutil, "rmtree", side_effect=PermissionError("TEST_ONLY")):
                with self.assertRaises(OSError):
                    PARSER.delete_material(file_id, directory)
            self.assertTrue(target.exists())
            result = PARSER.delete_material(file_id, directory)
            self.assertEqual(result, {"deleted": True, "fileId": file_id, "alreadyAbsent": False})
            self.assertTrue(PARSER.delete_material(file_id, directory)["alreadyAbsent"])

    def test_delete_does_not_race_page_writes_or_follow_symlinks(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            file_id = "b" * 64
            (Path(directory) / file_id).symlink_to(outside)
            with self.assertRaises(PARSER.ParserError):
                PARSER.delete_material(file_id, directory)
            started = threading.Event()
            release = threading.Event()

            def active_parser():
                with PARSER.LOCK:
                    started.set()
                    release.wait(2)

            thread = threading.Thread(target=active_parser)
            thread.start()
            started.wait(2)
            try:
                with self.assertRaisesRegex(PARSER.ParserError, "FILE_BUSY"):
                    PARSER.delete_material("c" * 64, directory)
            finally:
                release.set()
                thread.join(2)

    def test_http_delete_failure_returns_error_and_never_a_success_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            file_id = "d" * 64
            target = Path(directory) / file_id
            target.mkdir()
            server = ThreadingHTTPServer(
                ("127.0.0.1", 0),
                PARSER.make_handler("TEST_ONLY_TOKEN", "http://localhost:5173", directory),
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            request = Request(
                f"http://127.0.0.1:{server.server_port}/delete",
                data=json.dumps({"fileId": file_id}).encode(),
                headers={"Authorization": "Bearer TEST_ONLY_TOKEN"},
            )
            try:
                with patch.object(
                    PARSER.shutil, "rmtree", side_effect=PermissionError("TEST_ONLY")
                ):
                    with self.assertRaises(HTTPError) as error:
                        urlopen(request, timeout=3)
                    self.assertEqual(error.exception.code, 500)
                    self.assertFalse(json.loads(error.exception.read())["success"])
                self.assertTrue(target.exists())
                receipt = json.loads(urlopen(request, timeout=3).read())
                self.assertEqual(receipt["data"]["fileId"], file_id)
                self.assertFalse(target.exists())
            finally:
                server.shutdown()
                server.server_close()

    def test_real_pdf_text_positions_preview_hash_and_resume(self):
        with tempfile.TemporaryDirectory() as directory:
            data = make_pdf(6)
            payload = {
                "contentBase64": base64.b64encode(data).decode(),
                "name": "fixture.pdf",
                "allowOCR": False,
            }
            result = PARSER.parse_material(payload, directory)
            self.assertEqual(len(result["segments"]), 5)
            self.assertEqual(result["nextPage"], 6)
            self.assertEqual(result["segments"][0]["method"], "pdf_text")
            self.assertIn("Calculate", result["segments"][0]["content"])
            self.assertTrue(result["segments"][0]["words"][0]["bbox"])
            self.assertTrue(result["segments"][0]["preview"].startswith("data:image/png;base64,"))
            resumed = PARSER.parse_material({"fileId": result["id"], "startPage": 6}, directory)
            self.assertEqual(resumed["segments"][0]["page"], 6)
            self.assertIsNone(resumed["nextPage"])
            self.assertEqual(result["original"]["sha256"], resumed["original"]["sha256"])

    def test_real_local_ocr_retains_unassigned_role(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.pdf"
            path.write_bytes(make_pdf(1))
            PARSER.run_tool(
                "pdftoppm",
                [
                    "-singlefile",
                    "-scale-to",
                    "1200",
                    "-png",
                    path,
                    Path(directory) / "image",
                ],
            )
            data = (Path(directory) / "image.png").read_bytes()
            result = PARSER.parse_material(
                {"contentBase64": base64.b64encode(data).decode(), "allowOCR": True},
                directory,
            )
            self.assertIn("Calculate", result["segments"][0]["content"])
            self.assertEqual(result["segments"][0]["role"], "unassigned")
            self.assertTrue(result["segments"][0]["reviewRequired"])
            self.assertEqual(result["extraCloudCost"], 0)
            resumed = PARSER.parse_material({"fileId": result["id"], "allowOCR": True}, directory)
            self.assertEqual(resumed["segments"][0]["preview"], result["segments"][0]["preview"])

    def test_magic_bytes_limits_and_path_traversal_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            for payload in [
                {"contentBase64": "invalid!"},
                {"contentBase64": base64.b64encode(b"not a pdf").decode()},
                {"fileId": "../../secret"},
            ]:
                with self.assertRaises(PARSER.ParserError):
                    PARSER.parse_material(payload, directory)

    def test_connector_auth_origin_delete_and_no_network_model(self):
        with tempfile.TemporaryDirectory() as directory:
            token = "isolated-test-only-token-32-characters"
            server = ThreadingHTTPServer(
                ("127.0.0.1", 0),
                PARSER.make_handler(token, "http://localhost:5173", directory),
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_address[1]}"
            headers = {
                "Content-Type": "application/json",
                "Origin": "http://localhost:5173",
                "Authorization": "Bearer " + token,
            }
            health = json.loads(
                urlopen(Request(base + "/health", data=b"{}", headers=headers)).read()
            )
            self.assertTrue(health["data"]["pdfText"])
            self.assertFalse(health["data"]["modelInference"])
            with self.assertRaises(HTTPError) as removed:
                urlopen(Request(base + "/chat", data=b"{}", headers=headers))
            self.assertEqual(removed.exception.code, 410)

            endpoint = f"http://127.0.0.1:{server.server_port}/parse"
            try:
                for headers in [
                    {},
                    {"Authorization": "Bearer " + token, "Origin": "http://evil.local"},
                ]:
                    with self.assertRaises(HTTPError) as context:
                        urlopen(Request(endpoint, data=b"{}", headers=headers), timeout=3)
                    self.assertEqual(context.exception.code, 403)
                payload = {"contentBase64": base64.b64encode(make_pdf(1)).decode()}
                with urlopen(
                    Request(
                        endpoint,
                        data=json.dumps(payload).encode(),
                        headers={"Authorization": "Bearer " + token},
                    ),
                    timeout=10,
                ) as response:
                    result = json.load(response)
                file_id = result["data"]["id"]
                with urlopen(
                    Request(
                        endpoint.replace("/parse", "/delete"),
                        data=json.dumps({"fileId": file_id}).encode(),
                        headers={"Authorization": "Bearer " + token},
                    ),
                    timeout=3,
                ) as response:
                    self.assertTrue(json.load(response)["success"])
                self.assertFalse((Path(directory) / file_id).exists())
            finally:
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    unittest.main()
