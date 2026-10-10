import base64
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import os
import sys
import subprocess
import unittest
from http.server import ThreadingHTTPServer
import threading
from unittest.mock import patch, MagicMock
from urllib.request import Request, urlopen
from urllib.error import HTTPError

SPEC = importlib.util.spec_from_file_location(
    "private_material_parser",
    Path(__file__).parents[2] / "scripts/pipeline/private-material-parser.py",
)
PARSER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARSER)


def make_pdf(pages=2, lines=None):
    objects = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{4 + i * 2} 0 R" for i in range(pages))
    objects.append(f"<< /Type /Pages /Count {pages} /Kids [{kids}] >>".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for index in range(pages):
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << /Font << /F1 3 0 R >> >> /Contents {5 + index * 2} 0 R >>".encode()
        )
        page_lines = lines or [f"Question {index + 1}: Calculate twelve plus eight."]
        text = " 0 -24 Td ".join(f"({line}) Tj" for line in page_lines)
        stream = f"BT /F1 16 Tf 30 300 Td {text} ET".encode()
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
    def test_pdf_preserves_original_field_lines_and_versions_new_text_extraction(self):
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root)
            path = directory / "synthetic.pdf"
            path.write_bytes(make_pdf(1, ["2024: 80", "2025: 100", "2026: 150"]))
            segment = PARSER.parse_pdf_page(path, 1, directory)
            self.assertEqual(segment["content"], "2024: 80\n2025: 100\n2026: 150")
            self.assertEqual(segment["extractionVersion"], "poppler-pdf-text-v3")
            self.assertEqual(segment["role"], "source_text")
            self.assertFalse(segment["reviewRequired"])
            self.assertTrue(segment["preview"].startswith("data:image/png;base64,"))
            self.assertTrue(all(word["confidence"] is None for word in segment["words"]))

    def test_pdf_xml_and_tsv_use_explicit_line_groups_not_coordinate_guesses(self):
        xml = '<doc><page><line><word xMin="30" yMin="50" xMax="90" yMax="63">题干：求和</word></line><line><word xMin="30" yMin="50" xMax="90" yMax="63">作答：20</word></line><line><word xMin="30" yMin="50" xMax="90" yMax="63">参考答案：21</word></line></page></doc>'.encode()
        tsv = (
            "level\tpage_num\tpar_num\tblock_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
            "1\t1\t0\t0\t0\t0\t0\t0\t400\t400\t-1\t###PAGE###\n"
            "5\t1\t0\t0\t0\t0\t30\t50\t60\t13\t100\t题干：求和\n"
            "5\t1\t0\t0\t1\t0\t30\t50\t60\t13\t100\t作答：20\n"
            "5\t1\t1\t0\t0\t0\t30\t50\t60\t13\t100\t参考答案：21\n"
        ).encode()
        for fallback in [False, True]:
            with self.subTest(fallback=fallback), tempfile.TemporaryDirectory() as root:
                directory = Path(root)

                def tool(name, args, timeout):
                    if name == "pdftotext":
                        if "-bbox-layout" in args:
                            if fallback:
                                raise PARSER.ParserError("PARSER_FAILED:pdftotext")
                            return xml
                        return tsv
                    Path(args[-1]).with_suffix(".png").write_bytes(b"ISOLATED_PREVIEW_STUB")
                    return b""

                with patch.object(PARSER, "run_tool", side_effect=tool):
                    segment = PARSER.parse_pdf_page(directory / "synthetic.pdf", 1, directory)
                self.assertEqual(segment["content"], "题干：求和\n作答：20\n参考答案：21")
                self.assertEqual(len(segment["words"]), 3)

    def test_pdf_xhtml_failure_uses_validated_tsv_without_ocr_or_trusted_answers(self):
        tsv = (
            "level\tpage_num\tpar_num\tblock_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
            "1\t2\t0\t0\t0\t0\t0\t0\t400\t400\t-1\t###PAGE###\n"
            "5\t2\t0\t0\t0\t0\t30\t50\t90\t13\t100\tSynthetic private question\n"
        ).encode()
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root)

            def tool(name, args, timeout):
                self.assertGreater(timeout, 0)
                self.assertLessEqual(timeout, 20)
                if name == "pdftotext":
                    self.assertEqual(args[:4], ["-f", 2, "-l", 2])
                    if "-bbox-layout" in args:
                        raise PARSER.ParserError("PARSER_FAILED:pdftotext")
                    self.assertIn("-tsv", args)
                    return tsv
                self.assertEqual(name, "pdftoppm")
                Path(args[-1]).with_suffix(".png").write_bytes(b"ISOLATED_PREVIEW_STUB")
                return b""

            with (
                patch.object(PARSER, "run_tool", side_effect=tool),
                patch.object(PARSER, "parse_image") as ocr,
            ):
                segment = PARSER.parse_pdf_page(directory / "synthetic.pdf", 2, directory, False)
            self.assertEqual(segment["content"], "Synthetic private question")
            self.assertEqual(segment["words"][0]["bbox"], [30, 50, 120, 63])
            self.assertIsNone(segment["words"][0]["confidence"])
            self.assertEqual(segment["role"], "source_text")
            self.assertEqual(segment["method"], "pdf_text")
            ocr.assert_not_called()

    def test_pdf_tsv_rejects_wrong_page_columns_and_nonfinite_coordinates(self):
        header = "level\tpage_num\tpar_num\tblock_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
        page = "1\t1\t0\t0\t0\t0\t0\t0\t400\t400\t-1\t###PAGE###\n"
        word = "5\t1\t0\t0\t0\t0\t30\t50\t90\t13\t100\tSynthetic\n"
        for value in [
            header.replace("left", "x") + page + word,
            header + page + word.replace("\t30\t", "\tnan\t"),
            header + page + word.replace("5\t1\t", "5\t2\t"),
            header + word,
            header + page + word.replace("\t90\t", "\t-1\t"),
        ]:
            with (
                self.subTest(value=value),
                self.assertRaisesRegex(PARSER.ParserError, "PDF_TEXT_INVALID_RESULT"),
            ):
                PARSER.pdf_tsv_text(value.encode(), 1)
        self.assertEqual(PARSER.pdf_tsv_text((header + page).encode(), 1), ([], ""))

    def test_desktop_origin_is_exact_and_not_an_opaque_or_remote_scheme(self):
        self.assertTrue(PARSER.valid_material_client_origin("tauri://localhost"))
        self.assertTrue(PARSER.valid_material_client_origin("http://tauri.localhost"))
        for origin in [
            "null",
            "*",
            "file://localhost",
            "tauri://evil",
            "tauri://localhost/",
            "tauri://localhost:5000",
        ]:
            self.assertFalse(PARSER.valid_material_client_origin(origin), origin)

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


class AppleReadinessHTTPTests(unittest.TestCase):
    def setUp(self):
        self.release = threading.Event()
        self.warm_started = threading.Event()
        self.commands = []
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.binary = self.root / "synthetic-native-adapter"
        self.binary.write_text("TEST_ONLY_NATIVE_IDENTITY")
        self.binary.chmod(0o700)
        self.token = "TEST_ONLY_READINESS_32_CHARACTER_TOKEN"
        self.platform = patch.object(PARSER.sys, "platform", "darwin")
        self.platform.start()
        self.environment = patch.dict(
            PARSER.os.environ, {"MATERIAL_APPLE_VISION_BIN": str(self.binary)}
        )
        self.environment.start()
        self.native = patch.object(PARSER, "apple_command", side_effect=self.command)
        self.native.start()
        self.server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            PARSER.make_handler(self.token, "http://127.0.0.1:51639", self.root / "storage"),
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.release.set()
        if hasattr(PARSER, "stop_apple_warmup"):
            PARSER.stop_apple_warmup()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.native.stop()
        self.environment.stop()
        self.platform.stop()
        self.temp.cleanup()

    def command(self, mode, payload=None, timeout=12, **_options):
        self.commands.append((mode, payload, timeout))
        if mode == "--capabilities":
            return {
                "contract": PARSER.APPLE_CONTRACT,
                "revision": 3,
                "compute": "cpu",
                "maxBytes": PARSER.MAX_BYTES,
                "maxPixels": 24000000,
                "dataFlow": "device_only",
                "recognitionState": "not_tested",
                "languages": PARSER.APPLE_LANGUAGES,
            }
        if mode == "--warmup":
            self.warm_started.set()
            self.release.wait(2)
            return {
                "contract": PARSER.APPLE_CONTRACT,
                "revision": 3,
                "compute": "cpu",
                "dataFlow": "device_only",
                "readiness": "ready",
                "sampleKind": "project_synthetic_text",
                "privateInput": False,
                "recognitionState": "not_tested",
            }
        raise AssertionError("Private recognition must not execute while preparing")

    def post(self, path, body):
        request = Request(
            f"http://127.0.0.1:{self.server.server_port}{path}",
            data=json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + self.token, "Origin": "http://127.0.0.1:51639"},
        )
        try:
            with urlopen(request, timeout=2) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def health(self):
        status, value = self.post("/health", {})
        self.assertEqual(status, 200)
        return value["data"]["ocrEngines"]["appleVision"]

    def test_protocol_capability_does_not_accept_private_file_before_synthetic_readiness(self):
        health = self.health()
        self.assertFalse(health["available"])
        self.assertEqual(
            health["readiness"], {"contract": "wenli-apple-readiness-v1", "status": "preparing"}
        )
        self.assertTrue(self.warm_started.wait(1))
        status, _ = self.post(
            "/parse",
            {
                "contentBase64": "PRIVATE_BODY_NOT_TO_DECODE",
                "allowOCR": True,
                "ocrEngine": "apple-vision",
            },
        )
        self.assertEqual(status, 422)
        self.assertEqual(list((self.root / "storage").glob("*/original.*")), [])
        self.health()
        self.assertEqual([c for c in self.commands if c[0] == "--warmup"], [("--warmup", None, 45)])
        self.assertFalse(any(c[0] == "--recognize" for c in self.commands))
        self.release.set()
        for _ in range(100):
            health = self.health()
            if health["available"]:
                break
            time.sleep(0.01)
        self.assertTrue(health["available"])
        self.assertEqual(health["readiness"]["status"], "ready")
        self.assertEqual(health["recognitionState"], "not_tested")

    def finish_worker(self):
        worker = PARSER.APPLE_WARM_STATE["thread"]
        self.release.set()
        if worker:
            worker.join(timeout=2)
            self.assertFalse(worker.is_alive())

    def test_private_or_unknown_warmup_receipt_never_opens_recognition_or_automatically_retries(
        self,
    ):
        original = self.command
        for field, bad in [
            ("privateInput", True),
            ("privateInput", 0),
            ("recognitionState", "accuracy_verified"),
            ("sampleKind", "private"),
            ("revision", 2),
        ]:
            PARSER.stop_apple_warmup()
            self.release.clear()
            self.commands.clear()

            def invalid(mode, *args, **kwargs):
                value = original(mode, *args, **kwargs)
                if mode == "--warmup":
                    value[field] = bad
                return value

            self.native.return_value = None
            PARSER.apple_command.side_effect = invalid
            self.health()
            self.finish_worker()
            health = self.health()
            self.assertFalse(health["available"])
            self.assertEqual(health["readiness"]["status"], "failed")
            self.health()
            self.assertEqual(len([c for c in self.commands if c[0] == "--warmup"]), 1)

    def test_replacing_native_identity_rejects_the_old_in_flight_ready_receipt(self):
        self.health()
        self.assertTrue(self.warm_started.wait(1))
        self.binary.write_text("TEST_ONLY_CHANGED_NATIVE_IDENTITY")
        self.assertFalse(self.health()["available"])
        self.finish_worker()
        self.assertEqual(PARSER.APPLE_WARM_STATE["status"], "preparing")
        self.assertFalse(self.health()["available"])
        self.finish_worker()
        self.assertTrue(self.health()["available"])
        self.assertEqual(len([c for c in self.commands if c[0] == "--warmup"]), 2)

    def test_unauthorized_health_does_not_start_synthetic_work(self):
        request = Request(
            f"http://127.0.0.1:{self.server.server_port}/health",
            data=b"{}",
            headers={"Authorization": "Bearer TEST_ONLY_INVALID"},
        )
        with self.assertRaises(HTTPError) as error:
            urlopen(request, timeout=2)
        self.assertEqual(error.exception.code, 403)
        self.assertEqual(self.commands, [])

    def test_private_timeout_normally_terminates_owned_native_before_forced_cleanup(self):
        self.native.stop()
        process = MagicMock()
        process.returncode = -15
        process.communicate.side_effect = [
            PARSER.subprocess.TimeoutExpired("TEST_ONLY_NATIVE", 12),
            (b"", b""),
        ]
        with patch.object(PARSER.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(PARSER.ParserError, "APPLE_VISION_FAILED"):
                PARSER.apple_command("--recognize", {"consent": True}, timeout=12)
        process.terminate.assert_called_once()
        process.kill.assert_not_called()
        self.assertEqual(process.communicate.call_args_list[0].kwargs["timeout"], 12)
        self.native.start()

    def test_private_timeout_forces_only_the_unresponsive_owned_process_and_reaps_it(self):
        self.native.stop()
        process = MagicMock()
        process.communicate.side_effect = [
            PARSER.subprocess.TimeoutExpired("TEST_ONLY_NATIVE", 12),
            PARSER.subprocess.TimeoutExpired("TEST_ONLY_NATIVE", 3),
            (b"", b""),
        ]
        with patch.object(PARSER.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(PARSER.ParserError, "APPLE_VISION_FAILED"):
                PARSER.apple_command("--recognize", {"consent": True}, timeout=12)
        process.terminate.assert_called_once()
        process.kill.assert_called_once()
        self.assertEqual(len(process.communicate.call_args_list), 3)
        self.native.start()


@unittest.skipUnless(sys.platform == "darwin", "macOS connector process lifecycle")
class AppleWarmupShutdownTests(unittest.TestCase):
    def test_stopping_synthetic_warmup_reaps_its_real_child_without_promoting_late_readiness(self):
        with tempfile.TemporaryDirectory(prefix="yozi-warmup-stop-") as root:
            binary = Path(root) / "synthetic-adapter"
            binary.write_text(f"#!{sys.executable}\nimport time\ntime.sleep(60)\n")
            binary.chmod(0o700)
            with patch.dict(os.environ, {"MATERIAL_APPLE_VISION_BIN": str(binary)}):
                try:
                    self.assertEqual(PARSER.apple_readiness()["status"], "preparing")
                    deadline = time.monotonic() + 3
                    process = None
                    while time.monotonic() < deadline:
                        with PARSER.APPLE_WARM_LOCK:
                            process = PARSER.APPLE_WARM_STATE["process"]
                        if process:
                            break
                        time.sleep(0.01)
                    self.assertIsNotNone(process)
                    PARSER.stop_apple_warmup()
                    self.assertIsNotNone(process.poll())
                    self.assertEqual(PARSER.APPLE_WARM_STATE["status"], "unavailable")
                    self.assertIsNone(PARSER.APPLE_WARM_STATE["thread"])
                    self.assertIsNone(PARSER.APPLE_WARM_STATE["process"])
                finally:
                    PARSER.stop_apple_warmup()

    def test_sigterm_closes_real_http_server_and_its_active_synthetic_child(self):
        with tempfile.TemporaryDirectory(prefix="yozi-warmup-http-stop-") as root:
            directory = Path(root)
            marker = directory / "owned-child.pid"
            binary = directory / "synthetic-adapter"
            caps = {
                "contract": PARSER.APPLE_CONTRACT,
                "revision": 3,
                "compute": "cpu",
                "maxBytes": PARSER.MAX_BYTES,
                "maxPixels": 24000000,
                "dataFlow": "device_only",
                "recognitionState": "not_tested",
                "languages": PARSER.APPLE_LANGUAGES,
            }
            binary.write_text(
                f"#!{sys.executable}\nimport os,sys,json,time\n"
                f"if sys.argv[1]=='--capabilities': print({json.dumps({'success': True, 'data': caps})!r})\n"
                f"else:\n open({str(marker)!r},'w').write(str(os.getpid()))\n time.sleep(60)\n"
            )
            binary.chmod(0o700)
            token = "TEST_ONLY_HTTP_SHUTDOWN_TOKEN_32_CHARACTERS"
            port_holder = ThreadingHTTPServer(
                ("127.0.0.1", 0), PARSER.make_handler(token, "http://localhost:5173", directory)
            )
            port = port_holder.server_port
            port_holder.server_close()
            process = subprocess.Popen(
                [sys.executable, str(SPEC.origin)],
                env={
                    **os.environ,
                    "MATERIAL_APPLE_VISION_BIN": str(binary),
                    "MATERIAL_CONNECTOR_TOKEN": token,
                    "MATERIAL_CONNECTOR_ORIGIN": "http://localhost:5173",
                    "MATERIAL_CONNECTOR_PORT": str(port),
                    "MATERIAL_CONNECTOR_STORAGE": str(directory / "storage"),
                },
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                request = Request(
                    f"http://127.0.0.1:{port}/health",
                    data=b"{}",
                    headers={"Authorization": "Bearer " + token},
                )
                deadline = time.monotonic() + 4
                while True:
                    try:
                        with urlopen(request, timeout=1) as response:
                            health = json.load(response)
                        break
                    except OSError:
                        self.assertLess(time.monotonic(), deadline)
                        time.sleep(0.01)
                self.assertFalse(health["data"]["ocrEngines"]["appleVision"]["available"])
                while not marker.exists() or not marker.read_text().isdigit():
                    self.assertLess(time.monotonic(), deadline)
                    time.sleep(0.01)
                child_pid = int(marker.read_text())
                process.terminate()
                process.communicate(timeout=8)
                self.assertEqual(process.returncode, 0)
                with self.assertRaises(ProcessLookupError):
                    os.kill(child_pid, 0)
                self.assertEqual(list((directory / "storage").glob("*/original.*")), [])
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.communicate(timeout=8)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.communicate()


if __name__ == "__main__":
    unittest.main()
